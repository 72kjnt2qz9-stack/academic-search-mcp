/**
 * MCP Server for Google Scholar academic search
 * Exposes a single search tool that provides access to Google Scholar functionality
 *
 * Requirements: 7.1, 7.2
 */
export declare class MCPServer {
    private server;
    private searchService;
    private jstorInterface;
    constructor();
    /**
     * Set up MCP tool handlers and register the search tool
     * Requirements: 7.1, 7.2
     */
    private setupToolHandlers;
    /**
     * Define the search tool schema with parameter validation
     * Requirements: 7.2
     */
    private getSearchToolDefinition;
    /**
     * Handle search tool calls and route to search service
     * Requirements: 7.3, 7.4
     */
    private handleSearchTool;
    /**
     * Define the JSTOR search tool schema
     */
    private getJstorSearchToolDefinition;
    /**
     * Define the JSTOR authentication tool schema
     */
    private getJstorAuthToolDefinition;
    /**
     * Handle JSTOR authentication tool calls
     */
    private handleJstorAuthTool;
    private handleJstorSearchTool;
    private validateDateRange;
    /**
     * Create standardized error response
     * Requirements: 7.4
     */
    private createErrorResponse;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Stop the MCP server
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=mcp-server.d.ts.map