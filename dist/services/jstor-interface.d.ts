import { AxiosRequestConfig } from 'axios';
import { SearchParameters, Paper, AccessStatus } from '../types/index.js';
/**
 * JSTOR interface implementation
 * Handles communication with JSTOR including institutional authentication via Okta
 *
 * Features:
 * - Browser-based Okta authentication
 * - Session cookie management
 * - Authenticated search capabilities
 * - Fallback to public content when not authenticated
 */
export declare class JstorInterface {
    private httpClient;
    private authService;
    private lastRequestTime;
    private readonly minRequestInterval;
    private readonly maxRetries;
    private readonly baseBackoffDelay;
    constructor();
    /**
     * Performs an HTTP request with rate limiting, retry logic, and authentication
     * Uses stored session cookies when available
     */
    performRequest(url: string, config?: AxiosRequestConfig): Promise<string>;
    /**
     * Enforces minimum time between requests to respect rate limits
     * More conservative than Google Scholar
     */
    private enforceRateLimit;
    /**
     * Calculates exponential backoff delay for retry attempts
     */
    private calculateBackoffDelay;
    /**
     * Builds JSTOR search URL with proper parameter encoding
     * Currently focuses on publicly accessible content
     *
     * Note: Full search functionality requires institutional access
     */
    buildSearchUrl(parameters: SearchParameters): string;
    /**
     * Extracts year from various date formats
     */
    private extractYear;
    /**
     * Attempts to parse JSTOR search results
     * Now supports authenticated content when session cookies are available
     */
    parseSearchResults(html: string, fetchAbstracts?: boolean, fetchFullText?: boolean): Promise<Paper[]>;
    /**
     * Placeholder for JSTOR-specific abstract extraction
     * Will be implemented when authentication is added
     */
    extractAbstract(paperUrl: string): Promise<string | null>;
    /**
     * Placeholder for JSTOR full text access
     * Will be implemented when authentication is added
     */
    attemptFullTextAccess(paperUrl: string): Promise<{
        fullText: string | null;
        accessStatus: AccessStatus;
    }>;
    /**
     * Utility method for sleeping/waiting
     */
    private sleep;
    /**
     * Authenticate with JSTOR via browser-based Okta login
     */
    authenticateWithBrowser(jstorUrl?: string): Promise<{
        success: boolean;
        message: string;
        cookiesFound?: number;
        sessionValid?: boolean;
    }>;
    /**
     * Check current authentication status
     */
    getAuthenticationStatus(): Promise<{
        authenticated: boolean;
        cookiesPresent: boolean;
        sessionAge?: number;
        expiresIn?: number;
    }>;
    /**
     * Clear stored authentication
     */
    clearAuthentication(): Promise<void>;
    /**
     * Check if we have valid authentication
     */
    hasValidAuthentication(): Promise<boolean>;
}
//# sourceMappingURL=jstor-interface.d.ts.map