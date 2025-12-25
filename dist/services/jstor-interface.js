import axios from 'axios';
import * as cheerio from 'cheerio';
import { AuthService } from './auth-service.js';
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
export class JstorInterface {
    httpClient;
    authService;
    lastRequestTime = 0;
    minRequestInterval = 2000; // 2 seconds between requests (more conservative than Google Scholar)
    maxRetries = 3;
    baseBackoffDelay = 2000; // 2 second base delay
    constructor() {
        this.authService = new AuthService();
        this.httpClient = axios.create({
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            }
        });
    }
    /**
     * Performs an HTTP request with rate limiting, retry logic, and authentication
     * Uses stored session cookies when available
     */
    async performRequest(url, config) {
        await this.enforceRateLimit();
        // Try to load stored authentication cookies
        const cookies = await this.authService.loadStoredCookies();
        // Add authentication cookies to request if available
        const requestConfig = { ...config };
        if (cookies) {
            requestConfig.headers = {
                ...requestConfig.headers,
                'Cookie': cookies
            };
        }
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await this.httpClient.get(url, requestConfig);
                if (response.status === 200) {
                    return response.data;
                }
                // Handle rate limiting (429) or server errors (5xx)
                if (response.status === 429 || response.status >= 500) {
                    const backoffDelay = this.calculateBackoffDelay(attempt);
                    await this.sleep(backoffDelay);
                    continue;
                }
                // JSTOR returns 403 for blocked requests - might need re-authentication
                if (response.status === 403) {
                    if (cookies) {
                        throw new Error('JSTOR access denied - authentication may have expired. Try re-authenticating with authenticate_jstor tool.');
                    }
                    else {
                        throw new Error('JSTOR access denied - authentication required. Use authenticate_jstor tool first.');
                    }
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            catch (error) {
                lastError = error;
                // Check if it's a rate limiting or server error that we should retry
                if (axios.isAxiosError(error)) {
                    const status = error.response?.status;
                    if (status === 429 || (status && status >= 500)) {
                        const backoffDelay = this.calculateBackoffDelay(attempt);
                        await this.sleep(backoffDelay);
                        continue;
                    }
                    // Don't retry 403 errors - they indicate access restrictions
                    if (status === 403) {
                        if (cookies) {
                            throw new Error('JSTOR authentication expired - please re-authenticate using authenticate_jstor tool');
                        }
                        else {
                            throw new Error('JSTOR authentication required - please authenticate using authenticate_jstor tool');
                        }
                    }
                }
                // For other errors, don't retry
                if (attempt === this.maxRetries - 1) {
                    throw error;
                }
            }
        }
        throw lastError || new Error('Request failed after all retry attempts');
    }
    /**
     * Enforces minimum time between requests to respect rate limits
     * More conservative than Google Scholar
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await this.sleep(waitTime);
        }
        this.lastRequestTime = Date.now();
    }
    /**
     * Calculates exponential backoff delay for retry attempts
     */
    calculateBackoffDelay(attempt) {
        return this.baseBackoffDelay * Math.pow(2, attempt) + Math.random() * 1000;
    }
    /**
     * Builds JSTOR search URL with proper parameter encoding
     * Currently focuses on publicly accessible content
     *
     * Note: Full search functionality requires institutional access
     */
    buildSearchUrl(parameters) {
        // For now, we'll return a placeholder that indicates JSTOR search
        // is not fully implemented without authentication
        const baseUrl = 'https://www.jstor.org/action/doBasicSearch';
        const searchParams = new URLSearchParams();
        // Add keywords as the main query parameter
        if (parameters.keywords && parameters.keywords.length > 0) {
            const keywordQuery = parameters.keywords
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0)
                .join(' ');
            searchParams.set('Query', keywordQuery);
        }
        // Add sorting (relevance by default)
        searchParams.set('so', 'rel');
        // Add date range filtering if specified
        if (parameters.dateRange) {
            if (parameters.dateRange.start) {
                const startYear = this.extractYear(parameters.dateRange.start);
                searchParams.set('sd', startYear.toString());
            }
            if (parameters.dateRange.end) {
                const endYear = this.extractYear(parameters.dateRange.end);
                searchParams.set('ed', endYear.toString());
            }
        }
        // Limit results if specified
        if (parameters.maxResults) {
            searchParams.set('size', Math.min(parameters.maxResults, 100).toString());
        }
        return `${baseUrl}?${searchParams.toString()}`;
    }
    /**
     * Extracts year from various date formats
     */
    extractYear(dateString) {
        const yearMatch = dateString.match(/^(\d{4})/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (year >= 1900 && year <= new Date().getFullYear() + 10) {
                return year;
            }
        }
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY or YYYY-MM-DD format.`);
    }
    /**
     * Attempts to parse JSTOR search results
     * Now supports authenticated content when session cookies are available
     */
    async parseSearchResults(html, fetchAbstracts = false, fetchFullText = false) {
        const $ = cheerio.load(html);
        const papers = [];
        // Check if we got a login page or access denied
        const pageText = $.text().toLowerCase();
        if (pageText.includes('sign in required') || pageText.includes('login required')) {
            console.warn('JSTOR search requires authentication - use authenticate_jstor tool first');
            return papers;
        }
        // Look for JSTOR search result items
        // JSTOR uses various selectors depending on the page layout
        const resultSelectors = [
            '.result-item',
            '.search-result-item',
            '.obj_article_summary',
            '[data-qa="search-result"]',
            '.citation'
        ];
        let resultElements = null;
        // Try different selectors to find results
        for (const selector of resultSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                resultElements = elements;
                console.log(`Found ${elements.length} results using selector: ${selector}`);
                break;
            }
        }
        if (!resultElements || resultElements.length === 0) {
            // Try a more generic approach - look for links to JSTOR articles
            const articleLinks = $('a[href*="/stable/"]');
            if (articleLinks.length > 0) {
                console.log(`Found ${articleLinks.length} article links as fallback`);
                articleLinks.each((index, element) => {
                    if (papers.length >= 20)
                        return false; // Limit results
                    const $link = $(element);
                    const title = $link.text().trim() || $link.attr('title') || 'Untitled';
                    const url = $link.attr('href');
                    if (title && url && title.length > 10) { // Filter out navigation links
                        papers.push({
                            citation: {
                                title,
                                authors: [],
                                venue: 'JSTOR',
                                year: undefined,
                                citationCount: undefined,
                                url: url.startsWith('http') ? url : `https://www.jstor.org${url}`,
                            },
                            abstract: undefined,
                            fullText: undefined,
                            accessStatus: 'unknown'
                        });
                    }
                });
            }
            if (papers.length === 0) {
                console.warn('No JSTOR search results found - page structure may have changed or no results available');
            }
            return papers;
        }
        // Parse structured search results
        resultElements.each((index, element) => {
            if (papers.length >= 20)
                return false; // Limit results
            const $result = $(element);
            // Extract title
            const titleSelectors = [
                '.title a',
                '.result-title a',
                '[data-qa="title"] a',
                'h3 a',
                '.citation-title a'
            ];
            let title = '';
            let url = '';
            for (const selector of titleSelectors) {
                const $titleElement = $result.find(selector).first();
                if ($titleElement.length > 0) {
                    title = $titleElement.text().trim();
                    url = $titleElement.attr('href') || '';
                    break;
                }
            }
            if (!title) {
                // Fallback: try to find any link with substantial text
                const $anyLink = $result.find('a').filter((i, el) => $(el).text().trim().length > 10).first();
                if ($anyLink.length > 0) {
                    title = $anyLink.text().trim();
                    url = $anyLink.attr('href') || '';
                }
            }
            if (!title)
                return; // Skip if no title found
            // Extract authors
            const authorSelectors = [
                '.authors',
                '.result-authors',
                '[data-qa="authors"]',
                '.citation-authors'
            ];
            let authors = [];
            for (const selector of authorSelectors) {
                const $authors = $result.find(selector).first();
                if ($authors.length > 0) {
                    const authorText = $authors.text().trim();
                    if (authorText) {
                        // Split authors by common separators
                        authors = authorText
                            .split(/[,;]|and\s+/)
                            .map(author => author.trim())
                            .filter(author => author.length > 0);
                        break;
                    }
                }
            }
            // Extract publication info
            const pubInfoSelectors = [
                '.publication-info',
                '.result-publication',
                '[data-qa="publication"]',
                '.citation-publication'
            ];
            let venue = '';
            let year = null;
            for (const selector of pubInfoSelectors) {
                const $pubInfo = $result.find(selector).first();
                if ($pubInfo.length > 0) {
                    const pubText = $pubInfo.text().trim();
                    venue = pubText;
                    // Extract year from publication info
                    const yearMatch = pubText.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch) {
                        year = parseInt(yearMatch[0]);
                    }
                    break;
                }
            }
            // Ensure URL is absolute
            if (url && !url.startsWith('http')) {
                url = `https://www.jstor.org${url}`;
            }
            papers.push({
                citation: {
                    title,
                    authors,
                    venue: venue || 'JSTOR',
                    year: year || undefined,
                    citationCount: undefined, // JSTOR doesn't typically show citation counts in search results
                    url: url || '',
                },
                abstract: undefined,
                fullText: undefined,
                accessStatus: 'unknown'
            });
        });
        console.log(`Successfully parsed ${papers.length} JSTOR search results`);
        return papers;
    }
    /**
     * Placeholder for JSTOR-specific abstract extraction
     * Will be implemented when authentication is added
     */
    async extractAbstract(paperUrl) {
        console.warn('JSTOR abstract extraction requires institutional access');
        return null;
    }
    /**
     * Placeholder for JSTOR full text access
     * Will be implemented when authentication is added
     */
    async attemptFullTextAccess(paperUrl) {
        console.warn('JSTOR full text access requires institutional authentication');
        return { fullText: null, accessStatus: 'restricted' };
    }
    /**
     * Utility method for sleeping/waiting
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Authenticate with JSTOR via browser-based Okta login
     */
    async authenticateWithBrowser(jstorUrl) {
        return await this.authService.authenticateWithBrowser(jstorUrl);
    }
    /**
     * Check current authentication status
     */
    async getAuthenticationStatus() {
        return await this.authService.getAuthStatus();
    }
    /**
     * Clear stored authentication
     */
    async clearAuthentication() {
        await this.authService.clearStoredCookies();
    }
    /**
     * Check if we have valid authentication
     */
    async hasValidAuthentication() {
        return await this.authService.hasValidAuthentication();
    }
}
//# sourceMappingURL=jstor-interface.js.map