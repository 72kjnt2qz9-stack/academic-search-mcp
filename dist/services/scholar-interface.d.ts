import { AxiosRequestConfig } from 'axios';
import { SearchParameters, Paper, AccessStatus } from '../types/index.js';
/**
 * Google Scholar interface implementation
 * Handles direct communication with Google Scholar including HTTP requests,
 * rate limiting, and HTML parsing
 *
 * Requirements: 1.1, 7.5, 1.2, 4.1, 4.2
 */
export declare class ScholarInterface {
    private httpClient;
    private lastRequestTime;
    private readonly minRequestInterval;
    private readonly maxRetries;
    private readonly baseBackoffDelay;
    constructor();
    /**
     * Performs an HTTP request with rate limiting and retry logic
     * Implements exponential backoff for rate limiting scenarios
     *
     * Requirements: 1.1, 7.5
     */
    performRequest(url: string, config?: AxiosRequestConfig): Promise<string>;
    /**
     * Enforces minimum time between requests to respect rate limits
     */
    private enforceRateLimit;
    /**
     * Calculates exponential backoff delay for retry attempts
     */
    private calculateBackoffDelay;
    /**
     * Builds Google Scholar search URL with proper parameter encoding
     * Handles keywords, authors, and date range parameters
     *
     * Requirements: 1.1, 2.1, 3.1
     */
    buildSearchUrl(parameters: SearchParameters): string;
    /**
     * Extracts year from various date formats
     * Supports YYYY, YYYY-MM-DD, and other ISO date formats
     *
     * Requirements: 3.1, 3.4, 3.5
     */
    private extractYear;
    /**
     * Parses Google Scholar search result HTML to extract paper information
     * Extracts titles, authors, venues, dates, and citation counts
     * Optionally fetches abstracts and full text for each paper
     *
     * Requirements: 1.2, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3
     */
    parseSearchResults(html: string, fetchAbstracts?: boolean, fetchFullText?: boolean): Promise<Paper[]>;
    /**
     * Parses a single search result item from Google Scholar
     * Optionally fetches abstract and full text content
     */
    private parseSearchResultItem;
    /**
     * Parses author information string to extract authors, venue, and year
     * Handles multiple formats:
     * - "Author1, Author2 - Venue, Year - Publisher"
     * - "Author1 - Year - Publisher"
     * - "Author1, Author2 - Year - Publisher"
     */
    private parseAuthorInfo;
    /**
     * Extracts citation count from a search result item
     */
    private extractCitationCount;
    /**
     * Extracts abstract from a paper's detail page
     * Navigates to individual paper pages and extracts abstract content
     * Handles cases where abstracts are not available
     *
     * Requirements: 5.1, 5.2, 5.3
     */
    extractAbstract(paperUrl: string): Promise<string | null>;
    /**
     * Attempts to access and retrieve full text content from a paper
     * Tries to access full paper content when available
     * Detects and handles paywalls and access restrictions
     * Preserves document formatting and structure
     *
     * Requirements: 6.1, 6.2, 6.3
     */
    attemptFullTextAccess(paperUrl: string): Promise<{
        fullText: string | null;
        accessStatus: AccessStatus;
    }>;
    /**
     * Utility method for sleeping/waiting
     */
    private sleep;
}
//# sourceMappingURL=scholar-interface.d.ts.map