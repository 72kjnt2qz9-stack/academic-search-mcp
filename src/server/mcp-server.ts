import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SearchParameters, SearchResult, ErrorResponse, isValidSearchParameters } from '../types/index.js';
import { SearchService } from '../services/search-service.js';
import { JstorInterface } from '../services/jstor-interface.js';

/**
 * MCP Server for Google Scholar academic search
 * Exposes a single search tool that provides access to Google Scholar functionality
 * 
 * Requirements: 7.1, 7.2
 */
export class MCPServer {
  private server: Server;
  private searchService: SearchService;
  private jstorInterface: JstorInterface;

  constructor() {
    this.server = new Server({
      name: 'academic-search-mcp',
      version: '1.0.0',
    });

    this.searchService = new SearchService();
    this.jstorInterface = new JstorInterface();
    this.setupToolHandlers();
  }

  /**
   * Set up MCP tool handlers and register the search tool
   * Requirements: 7.1, 7.2
   */
  private setupToolHandlers(): void {
    // Register the list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          this.getSearchToolDefinition(),
          this.getJstorSearchToolDefinition(),
          this.getJstorAuthToolDefinition()
        ],
      };
    });

    // Register the call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'search_scholar') {
        return await this.handleSearchTool(args);
      }

      if (name === 'search_jstor') {
        return await this.handleJstorSearchTool(args);
      }

      if (name === 'authenticate_jstor') {
        return await this.handleJstorAuthTool(args);
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  /**
   * Define the search tool schema with parameter validation
   * Requirements: 7.2
   */
  private getSearchToolDefinition(): Tool {
    return {
      name: 'search_scholar',
      description: 'Search Google Scholar for academic papers with keyword, author, and date filtering',
      inputSchema: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
            minItems: 1,
            description: 'Array of keywords to search for in papers',
          },
          authors: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
            description: 'Optional array of author names to filter by',
          },
          dateRange: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$',
                description: 'Start date in ISO format (YYYY-MM-DD) or partial (YYYY)',
              },
              end: {
                type: 'string',
                pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$',
                description: 'End date in ISO format (YYYY-MM-DD) or partial (YYYY)',
              },
            },
            additionalProperties: false,
            description: 'Optional date range for filtering publications',
          },
          maxResults: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of results to return (1-100, default: 20)',
          },
        },
        required: ['keywords'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Handle search tool calls and route to search service
   * Requirements: 7.3, 7.4
   */
  private async handleSearchTool(args: any): Promise<any> {
    try {
      // Validate input parameters
      if (!isValidSearchParameters(args)) {
        return this.createErrorResponse(
          'INVALID_PARAMETERS',
          'Invalid search parameters. Keywords array is required and must contain non-empty strings.',
          args
        );
      }

      const searchParams = args as SearchParameters;

      // Additional validation for date range
      if (searchParams.dateRange) {
        const dateValidation = this.validateDateRange(searchParams.dateRange);
        if (!dateValidation.valid) {
          return this.createErrorResponse(
            'INVALID_DATE_RANGE',
            dateValidation.message,
            searchParams.dateRange
          );
        }
      }

      // Execute the actual search using the search service
      const result = await this.searchService.executeSearch(searchParams);

      // Check if the result is an error
      if ('error' in result && result.error) {
        return this.createErrorResponse(
          result.code,
          result.message,
          result.details
        );
      }

      // Return successful search result
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        'INTERNAL_ERROR',
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Define the JSTOR search tool schema
   */
  private getJstorSearchToolDefinition(): Tool {
    return {
      name: 'search_jstor',
      description: 'Search JSTOR for academic papers. Use authenticate_jstor tool first for full institutional access.',
      inputSchema: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
            minItems: 1,
            description: 'Array of keywords to search for in papers',
          },
          authors: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
            description: 'Optional array of author names to filter by',
          },
          dateRange: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$',
                description: 'Start date in ISO format (YYYY-MM-DD) or partial (YYYY)',
              },
              end: {
                type: 'string',
                pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$',
                description: 'End date in ISO format (YYYY-MM-DD) or partial (YYYY)',
              },
            },
            additionalProperties: false,
            description: 'Optional date range for filtering publications',
          },
          maxResults: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of results to return (1-100, default: 20)',
          },
        },
        required: ['keywords'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Define the JSTOR authentication tool schema
   */
  private getJstorAuthToolDefinition(): Tool {
    return {
      name: 'authenticate_jstor',
      description: 'Authenticate with JSTOR using browser-based Okta login. Opens browser for user to complete institutional authentication.',
      inputSchema: {
        type: 'object',
        properties: {
          jstor_url: {
            type: 'string',
            default: 'https://www.jstor.org',
            description: 'JSTOR URL to authenticate with (default: https://www.jstor.org)',
          },
          action: {
            type: 'string',
            enum: ['authenticate', 'status', 'clear'],
            default: 'authenticate',
            description: 'Action to perform: authenticate (login), status (check current auth), or clear (logout)',
          }
        },
        additionalProperties: false,
      },
    };
  }

  /**
   * Handle JSTOR authentication tool calls
   */
  private async handleJstorAuthTool(args: any): Promise<any> {
    try {
      const action = args?.action || 'authenticate';
      const jstorUrl = args?.jstor_url || 'https://www.jstor.org';

      switch (action) {
        case 'authenticate':
          console.log('Starting JSTOR authentication process...');
          const authResult = await this.jstorInterface.authenticateWithBrowser(jstorUrl);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'authenticate',
                  success: authResult.success,
                  message: authResult.message,
                  details: {
                    cookiesFound: authResult.cookiesFound,
                    sessionValid: authResult.sessionValid,
                    nextSteps: authResult.success 
                      ? 'You can now use search_jstor tool with full institutional access'
                      : 'Please try authenticating again and ensure you complete the Okta login process'
                  }
                }, null, 2),
              },
            ],
          };

        case 'status':
          const status = await this.jstorInterface.getAuthenticationStatus();
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'status',
                  ...status,
                  message: status.authenticated 
                    ? `Authenticated session active (${status.sessionAge} minutes old, expires in ${status.expiresIn} minutes)`
                    : 'Not authenticated - use authenticate_jstor tool to login'
                }, null, 2),
              },
            ],
          };

        case 'clear':
          await this.jstorInterface.clearAuthentication();
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'clear',
                  success: true,
                  message: 'Authentication cleared successfully',
                  nextSteps: 'Use authenticate_jstor tool to login again when needed'
                }, null, 2),
              },
            ],
          };

        default:
          return this.createErrorResponse(
            'INVALID_ACTION',
            `Invalid action: ${action}. Use 'authenticate', 'status', or 'clear'`,
            { action, validActions: ['authenticate', 'status', 'clear'] }
          );
      }

    } catch (error) {
      return this.createErrorResponse(
        'AUTHENTICATION_ERROR',
        `JSTOR authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
  private async handleJstorSearchTool(args: any): Promise<any> {
    try {
      // Validate input parameters
      if (!isValidSearchParameters(args)) {
        return this.createErrorResponse(
          'INVALID_PARAMETERS',
          'Invalid search parameters. Keywords array is required and must contain non-empty strings.',
          args
        );
      }

      const searchParams = args as SearchParameters;

      // Additional validation for date range
      if (searchParams.dateRange) {
        const dateValidation = this.validateDateRange(searchParams.dateRange);
        if (!dateValidation.valid) {
          return this.createErrorResponse(
            'INVALID_DATE_RANGE',
            dateValidation.message,
            searchParams.dateRange
          );
        }
      }

      // Attempt to perform JSTOR search using the interface
      try {
        const searchUrl = this.jstorInterface.buildSearchUrl(searchParams);
        const html = await this.jstorInterface.performRequest(searchUrl);
        const papers = await this.jstorInterface.parseSearchResults(html, false, false);
        
        const searchResult: SearchResult = {
          papers,
          totalResults: papers.length,
          searchQuery: searchParams.keywords.join(' '),
          executionTime: Date.now() - Date.now() // Will be calculated properly
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(searchResult, null, 2),
            },
          ],
        };
        
      } catch (error) {
        // If JSTOR search fails (expected without authentication), return helpful message
        const limitedResult: SearchResult = {
          papers: [],
          totalResults: 0,
          searchQuery: searchParams.keywords.join(' '),
          executionTime: 0,
        };

        const message = {
          ...limitedResult,
          notice: `JSTOR search failed: ${error instanceof Error ? error.message : 'Unknown error'}. This is expected without institutional authentication. For comprehensive academic search, try the search_scholar tool.`,
          status: 'access_restricted',
          searchUrl: this.jstorInterface.buildSearchUrl(searchParams)
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(message, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      return this.createErrorResponse(
        'INTERNAL_ERROR',
        `JSTOR search error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
  private validateDateRange(dateRange: { start?: string; end?: string }): { valid: boolean; message: string } {
    const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;

    if (dateRange.start && !datePattern.test(dateRange.start)) {
      return {
        valid: false,
        message: 'Invalid start date format. Use YYYY, YYYY-MM, or YYYY-MM-DD format.',
      };
    }

    if (dateRange.end && !datePattern.test(dateRange.end)) {
      return {
        valid: false,
        message: 'Invalid end date format. Use YYYY, YYYY-MM, or YYYY-MM-DD format.',
      };
    }

    // Check if start date is before end date (basic validation)
    if (dateRange.start && dateRange.end) {
      const startYear = parseInt(dateRange.start.substring(0, 4));
      const endYear = parseInt(dateRange.end.substring(0, 4));
      
      if (startYear > endYear) {
        return {
          valid: false,
          message: 'Start date cannot be after end date.',
        };
      }
    }

    return { valid: true, message: '' };
  }

  /**
   * Create standardized error response
   * Requirements: 7.4
   */
  private createErrorResponse(code: string, message: string, details?: any): any {
    const errorResponse: ErrorResponse = {
      error: true,
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }
}