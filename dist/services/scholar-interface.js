import axios from 'axios';
import * as cheerio from 'cheerio';
/**
 * Google Scholar interface implementation
 * Handles direct communication with Google Scholar including HTTP requests,
 * rate limiting, and HTML parsing
 *
 * Requirements: 1.1, 7.5, 1.2, 4.1, 4.2
 */
export class ScholarInterface {
    httpClient;
    lastRequestTime = 0;
    minRequestInterval = 1000; // 1 second between requests
    maxRetries = 3;
    baseBackoffDelay = 1000; // 1 second base delay
    constructor() {
        this.httpClient = axios.create({
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        });
    }
    /**
     * Performs an HTTP request with rate limiting and retry logic
     * Implements exponential backoff for rate limiting scenarios
     *
     * Requirements: 1.1, 7.5
     */
    async performRequest(url, config) {
        await this.enforceRateLimit();
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await this.httpClient.get(url, config);
                if (response.status === 200) {
                    return response.data;
                }
                // Handle rate limiting (429) or server errors (5xx)
                if (response.status === 429 || response.status >= 500) {
                    const backoffDelay = this.calculateBackoffDelay(attempt);
                    await this.sleep(backoffDelay);
                    continue;
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
     * Builds Google Scholar search URL with proper parameter encoding
     * Handles keywords, authors, and date range parameters
     *
     * Requirements: 1.1, 2.1, 3.1
     */
    buildSearchUrl(parameters) {
        const baseUrl = 'https://scholar.google.com/scholar';
        const searchParams = new URLSearchParams();
        // Add keywords as the main query parameter
        if (parameters.keywords && parameters.keywords.length > 0) {
            const keywordQuery = parameters.keywords
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0)
                .join(' ');
            searchParams.set('q', keywordQuery);
        }
        // Add author filtering if specified
        if (parameters.authors && parameters.authors.length > 0) {
            const authorQuery = parameters.authors
                .map(author => `author:"${author.trim()}"`)
                .join(' OR ');
            // Combine with existing query or set as new query
            const existingQuery = searchParams.get('q') || '';
            const combinedQuery = existingQuery
                ? `${existingQuery} (${authorQuery})`
                : authorQuery;
            searchParams.set('q', combinedQuery);
        }
        // Add date range filtering if specified
        if (parameters.dateRange) {
            if (parameters.dateRange.start && parameters.dateRange.end) {
                // Both start and end dates specified
                const startYear = this.extractYear(parameters.dateRange.start);
                const endYear = this.extractYear(parameters.dateRange.end);
                searchParams.set('as_ylo', startYear.toString());
                searchParams.set('as_yhi', endYear.toString());
            }
            else if (parameters.dateRange.start) {
                // Only start date specified
                const startYear = this.extractYear(parameters.dateRange.start);
                searchParams.set('as_ylo', startYear.toString());
            }
            else if (parameters.dateRange.end) {
                // Only end date specified
                const endYear = this.extractYear(parameters.dateRange.end);
                searchParams.set('as_yhi', endYear.toString());
            }
        }
        // Set result count limit if specified
        if (parameters.maxResults) {
            searchParams.set('num', Math.min(parameters.maxResults, 100).toString());
        }
        // Add additional parameters for better results
        searchParams.set('hl', 'en'); // Language: English
        searchParams.set('as_sdt', '0,5'); // Include patents and citations
        return `${baseUrl}?${searchParams.toString()}`;
    }
    /**
     * Extracts year from various date formats
     * Supports YYYY, YYYY-MM-DD, and other ISO date formats
     *
     * Requirements: 3.1, 3.4, 3.5
     */
    extractYear(dateString) {
        // Handle various date formats
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
     * Parses Google Scholar search result HTML to extract paper information
     * Extracts titles, authors, venues, dates, and citation counts
     * Optionally fetches abstracts and full text for each paper
     *
     * Requirements: 1.2, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3
     */
    async parseSearchResults(html, fetchAbstracts = false, fetchFullText = false) {
        const $ = cheerio.load(html);
        const papers = [];
        // Google Scholar search results are contained in div elements with class 'gs_r gs_or gs_scl'
        const resultElements = $('.gs_r.gs_or.gs_scl').toArray();
        for (let index = 0; index < resultElements.length; index++) {
            try {
                const element = resultElements[index];
                const paper = await this.parseSearchResultItem($, $(element), fetchAbstracts, fetchFullText);
                if (paper) {
                    papers.push(paper);
                }
            }
            catch (error) {
                // Log parsing error but continue with other results
                console.warn(`Failed to parse search result item ${index}:`, error);
            }
        }
        return papers;
    }
    /**
     * Parses a single search result item from Google Scholar
     * Optionally fetches abstract and full text content
     */
    async parseSearchResultItem($, $item, fetchAbstracts = false, fetchFullText = false) {
        // Extract title and URL from the h3.gs_rt a element
        const $titleLink = $item.find('.gs_rt a');
        const title = $titleLink.text().trim();
        const url = $titleLink.attr('href') || undefined;
        if (!title) {
            return null; // Skip items without titles
        }
        // Extract authors and publication info from .gs_a
        const $authorInfo = $item.find('.gs_a');
        const authorInfoText = $authorInfo.text().trim();
        const { authors, venue, year } = this.parseAuthorInfo(authorInfoText);
        // Extract citation count from footer links
        const citationCount = this.extractCitationCount($, $item);
        // Extract abstract/snippet from .gs_rs
        const $snippet = $item.find('.gs_rs');
        let abstract = $snippet.text().trim() || undefined;
        // Create citation object
        const citation = {
            title,
            authors,
            venue,
            year,
            url,
            citationCount
        };
        // Initialize paper with basic information
        let paper = {
            citation,
            abstract,
            accessStatus: 'unavailable'
        };
        // Optionally fetch detailed abstract from paper page
        if (fetchAbstracts && url) {
            try {
                const detailedAbstract = await this.extractAbstract(url);
                if (detailedAbstract && detailedAbstract.length > (abstract?.length || 0)) {
                    paper.abstract = detailedAbstract;
                }
            }
            catch (error) {
                console.warn(`Failed to fetch abstract for paper: ${title}`, error);
            }
        }
        // Optionally attempt full text access
        if (fetchFullText && url) {
            try {
                const { fullText, accessStatus } = await this.attemptFullTextAccess(url);
                paper.fullText = fullText || undefined;
                paper.accessStatus = accessStatus;
            }
            catch (error) {
                console.warn(`Failed to fetch full text for paper: ${title}`, error);
                paper.accessStatus = 'unavailable';
            }
        }
        return paper;
    }
    /**
     * Parses author information string to extract authors, venue, and year
     * Handles multiple formats:
     * - "Author1, Author2 - Venue, Year - Publisher"
     * - "Author1 - Year - Publisher"
     * - "Author1, Author2 - Year - Publisher"
     */
    parseAuthorInfo(authorInfoText) {
        const authors = [];
        let venue;
        let year;
        if (!authorInfoText) {
            return { authors };
        }
        // Split by ' - ' to separate different parts
        const parts = authorInfoText.split(' - ');
        if (parts.length === 0) {
            return { authors };
        }
        const firstPart = parts[0].trim();
        // Check if we have the format: "Authors - Venue, Year - Publisher"
        if (parts.length >= 3) {
            // This is likely: "Author1, Author2 - Venue, Year - Publisher"
            // First part: authors only
            // Second part: venue, year
            // Third part: publisher
            // First part should contain only authors separated by commas
            const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
            authors.push(...authorNames);
            // Parse second part for venue and year
            const secondPart = parts[1].trim();
            const yearMatch = secondPart.match(/\b(\d{4})\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[1], 10);
                venue = secondPart.replace(/\b\d{4}\b/, '').replace(/,\s*$/, '').trim();
                venue = venue.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                if (venue === '') {
                    venue = undefined;
                }
            }
            else {
                // No year in second part, treat as venue
                venue = secondPart;
            }
        }
        else if (parts.length === 2) {
            // This could be: "Authors - Year" or "Authors - Venue" or "Authors - Venue, Year"
            const secondPart = parts[1].trim();
            // Check if second part is just a year
            const justYearMatch = secondPart.match(/^(\d{4})$/);
            if (justYearMatch) {
                // Format: "Authors - Year"
                const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
                authors.push(...authorNames);
                year = parseInt(justYearMatch[1], 10);
            }
            else {
                // Check if second part contains a year
                const yearMatch = secondPart.match(/\b(\d{4})\b/);
                if (yearMatch) {
                    // Format: "Authors - Venue, Year"
                    const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
                    authors.push(...authorNames);
                    year = parseInt(yearMatch[1], 10);
                    venue = secondPart.replace(/\b\d{4}\b/, '').replace(/,\s*$/, '').trim();
                    venue = venue.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                    if (venue === '') {
                        venue = undefined;
                    }
                }
                else {
                    // Format: "Authors - Venue" (no year)
                    const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
                    authors.push(...authorNames);
                    venue = secondPart;
                }
            }
        }
        else {
            // Only one part, treat as authors
            const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
            authors.push(...authorNames);
        }
        return { authors, venue, year };
    }
    /**
     * Extracts citation count from a search result item
     */
    extractCitationCount($, $item) {
        // Citation count is in footer links with text like "Cited by 123"
        const $citedBy = $item.find('.gs_fl a').filter((i, el) => {
            return $(el).text().includes('Cited by');
        });
        if ($citedBy.length > 0) {
            const citedByText = $citedBy.text();
            const match = citedByText.match(/Cited by (\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        return undefined;
    }
    /**
     * Extracts abstract from a paper's detail page
     * Navigates to individual paper pages and extracts abstract content
     * Handles cases where abstracts are not available
     *
     * Requirements: 5.1, 5.2, 5.3
     */
    async extractAbstract(paperUrl) {
        if (!paperUrl) {
            return null;
        }
        try {
            // Perform request to the paper's detail page
            const html = await this.performRequest(paperUrl);
            const $ = cheerio.load(html);
            // Try multiple selectors for abstract content
            // Different publishers and platforms use different structures
            const abstractSelectors = [
                // Common abstract selectors
                '.abstract',
                '#abstract',
                '.abstract-content',
                '.abstract-text',
                '[data-testid="abstract"]',
                '.section-abstract',
                '.abstract-full-text',
                // Publisher-specific selectors
                '.abstractSection', // Springer
                '.abstract-content p', // Some journals
                '.hlFld-Abstract', // Some academic sites
                '.abstract .content', // Generic content wrapper
                // Fallback selectors
                'div[class*="abstract"]',
                'section[class*="abstract"]',
                'p[class*="abstract"]'
            ];
            let abstractText = null;
            // Try each selector until we find abstract content
            for (const selector of abstractSelectors) {
                const $abstractElement = $(selector).first();
                if ($abstractElement.length > 0) {
                    const text = $abstractElement.text().trim();
                    // Validate that this looks like an abstract (reasonable length, not just navigation text)
                    if (text.length > 50 && text.length < 5000) {
                        abstractText = text;
                        break;
                    }
                }
            }
            // If no abstract found with specific selectors, try to find it in meta tags
            if (!abstractText) {
                const metaAbstract = $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="abstract"]').attr('content');
                if (metaAbstract && metaAbstract.length > 50) {
                    abstractText = metaAbstract.trim();
                }
            }
            // Clean up the abstract text
            if (abstractText) {
                // Remove extra whitespace and normalize
                abstractText = abstractText
                    .replace(/\s+/g, ' ')
                    .replace(/^\s*abstract\s*:?\s*/i, '') // Remove "Abstract:" prefix
                    .trim();
                // Validate final abstract quality
                if (abstractText.length < 20) {
                    return null; // Too short to be a meaningful abstract
                }
                return abstractText;
            }
            return null;
        }
        catch (error) {
            // Log error but don't throw - abstract extraction is optional
            console.warn(`Failed to extract abstract from ${paperUrl}:`, error);
            return null;
        }
    }
    /**
     * Attempts to access and retrieve full text content from a paper
     * Tries to access full paper content when available
     * Detects and handles paywalls and access restrictions
     * Preserves document formatting and structure
     *
     * Requirements: 6.1, 6.2, 6.3
     */
    async attemptFullTextAccess(paperUrl) {
        if (!paperUrl) {
            return { fullText: null, accessStatus: 'unavailable' };
        }
        try {
            // Perform request to the paper URL
            const html = await this.performRequest(paperUrl);
            const $ = cheerio.load(html);
            // Check for common paywall indicators
            const paywallIndicators = [
                'paywall',
                'subscription required',
                'access denied',
                'login required',
                'purchase',
                'subscribe',
                'institutional access',
                'member access'
            ];
            const pageText = $.text().toLowerCase();
            const hasPaywallIndicators = paywallIndicators.some(indicator => pageText.includes(indicator));
            // Check for specific paywall elements
            const paywallSelectors = [
                '.paywall',
                '.subscription-required',
                '.access-denied',
                '.login-required',
                '[class*="paywall"]',
                '[id*="paywall"]'
            ];
            const hasPaywallElements = paywallSelectors.some(selector => $(selector).length > 0);
            if (hasPaywallIndicators || hasPaywallElements) {
                return { fullText: null, accessStatus: 'restricted' };
            }
            // Try to extract full text content
            const fullTextSelectors = [
                // Main content areas
                '.main-content',
                '.article-content',
                '.paper-content',
                '.full-text',
                '.document-content',
                // Academic paper specific
                '.article-body',
                '.paper-body',
                '.content-body',
                '.manuscript',
                // Generic content containers
                'main',
                '.content',
                '#content',
                // Publisher specific
                '.article-section', // Many publishers
                '.section-content', // Academic journals
                // Fallback
                'body'
            ];
            let fullText = null;
            let bestContent = '';
            let bestScore = 0;
            // Try each selector and score the content quality
            for (const selector of fullTextSelectors) {
                const $contentElement = $(selector);
                if ($contentElement.length > 0) {
                    const text = $contentElement.text().trim();
                    // Score content based on length and academic indicators
                    let score = text.length;
                    // Bonus for academic keywords
                    const academicKeywords = ['abstract', 'introduction', 'methodology', 'results', 'conclusion', 'references'];
                    academicKeywords.forEach(keyword => {
                        if (text.toLowerCase().includes(keyword)) {
                            score += 1000;
                        }
                    });
                    // Penalty for navigation/UI text
                    const uiKeywords = ['navigation', 'menu', 'footer', 'header', 'sidebar'];
                    uiKeywords.forEach(keyword => {
                        if (text.toLowerCase().includes(keyword)) {
                            score -= 500;
                        }
                    });
                    if (score > bestScore && text.length > 500) {
                        bestScore = score;
                        bestContent = text;
                    }
                }
            }
            if (bestContent && bestContent.length > 1000) {
                // Clean up the full text
                fullText = bestContent
                    .replace(/\s+/g, ' ')
                    .trim();
                // Preserve some structure by maintaining paragraph breaks
                fullText = fullText.replace(/\.\s+/g, '.\n\n');
                return { fullText, accessStatus: 'free' };
            }
            // If we got some content but it's short, it might be restricted
            if (bestContent && bestContent.length > 200) {
                return { fullText: null, accessStatus: 'restricted' };
            }
            return { fullText: null, accessStatus: 'unavailable' };
        }
        catch (error) {
            // Log error but don't throw - full text access is optional
            console.warn(`Failed to access full text from ${paperUrl}:`, error);
            return { fullText: null, accessStatus: 'unavailable' };
        }
    }
    /**
     * Utility method for sleeping/waiting
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=scholar-interface.js.map