/**
 * Core data models and interfaces for the Google Scholar MCP Server
 * 
 * These interfaces define the structure for search parameters, citations,
 * papers, and search results as specified in the requirements and design documents.
 */

/**
 * Parameters for conducting academic paper searches
 * Supports keyword-based searches with optional author and date filtering
 * 
 * Requirements: 1.2, 4.1, 4.2
 */
export interface SearchParameters {
  /** Array of keywords to search for in papers */
  keywords: string[];
  
  /** Optional array of author names to filter by */
  authors?: string[];
  
  /** Optional date range for filtering publications */
  dateRange?: {
    /** Start date in ISO format (YYYY-MM-DD) or partial (YYYY) */
    start?: string;
    /** End date in ISO format (YYYY-MM-DD) or partial (YYYY) */
    end?: string;
  };
  
  /** Maximum number of results to return (default: reasonable limit for performance) */
  maxResults?: number;
}

/**
 * Complete citation metadata for an academic paper
 * Includes all available bibliographic information
 * 
 * Requirements: 4.1, 4.2
 */
export interface Citation {
  /** Full title of the paper */
  title: string;
  
  /** Array of author names in order */
  authors: string[];
  
  /** Publication venue (journal, conference, etc.) - optional if not available */
  venue?: string;
  
  /** Publication year - optional if not available */
  year?: number;
  
  /** Digital Object Identifier - optional if not available */
  doi?: string;
  
  /** URL to the paper or its page - optional if not available */
  url?: string;
  
  /** Number of citations this paper has received - optional if not available */
  citationCount?: number;
}

/**
 * Access status for paper content
 * Indicates whether full text is available and under what conditions
 */
export type AccessStatus = 'free' | 'restricted' | 'unavailable';

/**
 * Complete paper information including citation, abstract, and full text
 * Represents a single academic paper with all available content
 * 
 * Requirements: 1.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2
 */
export interface Paper {
  /** Complete citation metadata */
  citation: Citation;
  
  /** Abstract text - optional if not available */
  abstract?: string;
  
  /** Full paper text - optional based on access restrictions */
  fullText?: string;
  
  /** Indicates the access status of the full text */
  accessStatus: AccessStatus;
}

/**
 * Complete search results including papers and metadata
 * Contains all papers found plus search execution information
 * 
 * Requirements: 1.2, 4.1, 4.2, 7.3
 */
export interface SearchResult {
  /** Array of papers found in the search */
  papers: Paper[];
  
  /** Total number of results found (may be larger than papers.length due to limits) */
  totalResults: number;
  
  /** The search query string that was executed */
  searchQuery: string;
  
  /** Time taken to execute the search in milliseconds */
  executionTime: number;
}

/**
 * Error response structure for failed operations
 * Provides consistent error reporting across the system
 */
export interface ErrorResponse {
  /** Always true for error responses */
  error: true;
  
  /** Human-readable error message */
  message: string;
  
  /** Machine-readable error code */
  code: string;
  
  /** Optional additional error details */
  details?: any;
  
  /** ISO timestamp when the error occurred */
  timestamp: string;
}

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(response: any): response is ErrorResponse {
  return response && response.error === true;
}

/**
 * Type guard to check if search parameters are valid
 */
export function isValidSearchParameters(params: any): params is SearchParameters {
  return (
    params &&
    typeof params === 'object' &&
    Array.isArray(params.keywords) &&
    params.keywords.length > 0 &&
    params.keywords.every((k: any) => typeof k === 'string' && k.trim().length > 0)
  );
}