import { isValidSearchParameters } from '../types/index.js';
import { ScholarInterface } from './scholar-interface.js';
/**
 * Search service that orchestrates the complete search workflow
 * Handles parameter validation, search execution, and result processing
 *
 * Requirements: 1.1, 7.3
 */
export class SearchService {
    scholarInterface;
    constructor() {
        this.scholarInterface = new ScholarInterface();
    }
    /**
     * Executes a complete search workflow
     * Coordinates all search steps from validation to result formatting
     *
     * Requirements: 1.1, 7.3
     */
    async executeSearch(parameters) {
        const startTime = Date.now();
        try {
            // Step 1: Validate input parameters
            const validationResult = this.validateSearchParameters(parameters);
            if (validationResult !== null) {
                return validationResult; // Return validation error
            }
            // Step 2: Apply result filtering and limiting
            const processedParameters = this.applyResultLimiting(parameters);
            // Step 3: Build search URL
            const searchUrl = this.scholarInterface.buildSearchUrl(processedParameters);
            // Step 4: Perform search request
            const html = await this.scholarInterface.performRequest(searchUrl);
            // Step 5: Parse search results
            const papers = await this.scholarInterface.parseSearchResults(html, true, // fetchAbstracts
            true // fetchFullText
            );
            // Step 6: Apply additional filtering
            const filteredPapers = this.applyResultFiltering(papers, processedParameters);
            // Step 7: Calculate execution time
            const executionTime = Date.now() - startTime;
            // Step 8: Build and return search result
            const searchResult = {
                papers: filteredPapers,
                totalResults: filteredPapers.length,
                searchQuery: this.buildQueryString(processedParameters),
                executionTime
            };
            return searchResult;
        }
        catch (error) {
            // Handle and propagate errors appropriately
            return this.createErrorResponse('SEARCH_EXECUTION_FAILED', `Search execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
        }
    }
    /**
     * Validates search parameters and returns error if invalid
     * Returns null if parameters are valid
     *
     * Requirements: 1.4, 3.4
     */
    validateSearchParameters(parameters) {
        // Basic structure validation
        if (!isValidSearchParameters(parameters)) {
            return this.createErrorResponse('INVALID_PARAMETERS', 'Invalid search parameters: keywords array is required and must contain non-empty strings');
        }
        // Validate keywords
        if (!parameters.keywords || parameters.keywords.length === 0) {
            return this.createErrorResponse('EMPTY_KEYWORDS', 'Keywords are required for search');
        }
        // Check for empty or whitespace-only keywords
        const invalidKeywords = parameters.keywords.filter(keyword => !keyword || typeof keyword !== 'string' || keyword.trim().length === 0);
        if (invalidKeywords.length > 0) {
            return this.createErrorResponse('INVALID_KEYWORDS', 'All keywords must be non-empty strings');
        }
        // Validate authors if provided
        if (parameters.authors) {
            if (!Array.isArray(parameters.authors)) {
                return this.createErrorResponse('INVALID_AUTHORS', 'Authors must be an array of strings');
            }
            const invalidAuthors = parameters.authors.filter(author => !author || typeof author !== 'string' || author.trim().length === 0);
            if (invalidAuthors.length > 0) {
                return this.createErrorResponse('INVALID_AUTHORS', 'All author names must be non-empty strings');
            }
        }
        // Validate date range if provided
        if (parameters.dateRange) {
            const dateValidation = this.validateDateRange(parameters.dateRange);
            if (dateValidation !== null) {
                return dateValidation;
            }
        }
        // Validate maxResults if provided
        if (parameters.maxResults !== undefined) {
            if (typeof parameters.maxResults !== 'number' || parameters.maxResults < 1 || parameters.maxResults > 1000) {
                return this.createErrorResponse('INVALID_MAX_RESULTS', 'maxResults must be a number between 1 and 1000');
            }
        }
        return null; // Parameters are valid
    }
    /**
     * Validates date range parameters
     * Returns error if dates are invalid, null if valid
     *
     * Requirements: 3.4
     */
    validateDateRange(dateRange) {
        const validateDateFormat = (dateString, fieldName) => {
            // Support YYYY and YYYY-MM-DD formats
            const yearOnlyPattern = /^\d{4}$/;
            const fullDatePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!yearOnlyPattern.test(dateString) && !fullDatePattern.test(dateString)) {
                return this.createErrorResponse('INVALID_DATE_FORMAT', `${fieldName} must be in YYYY or YYYY-MM-DD format`);
            }
            // Validate year range
            const year = parseInt(dateString.substring(0, 4), 10);
            const currentYear = new Date().getFullYear();
            if (year < 1900 || year > currentYear + 10) {
                return this.createErrorResponse('INVALID_DATE_RANGE', `${fieldName} year must be between 1900 and ${currentYear + 10}`);
            }
            // Validate full date if provided
            if (fullDatePattern.test(dateString)) {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                    return this.createErrorResponse('INVALID_DATE', `${fieldName} is not a valid date`);
                }
            }
            return null;
        };
        // Validate start date
        if (dateRange.start) {
            const startValidation = validateDateFormat(dateRange.start, 'Start date');
            if (startValidation !== null) {
                return startValidation;
            }
        }
        // Validate end date
        if (dateRange.end) {
            const endValidation = validateDateFormat(dateRange.end, 'End date');
            if (endValidation !== null) {
                return endValidation;
            }
        }
        // Validate date range logic
        if (dateRange.start && dateRange.end) {
            const startYear = parseInt(dateRange.start.substring(0, 4), 10);
            const endYear = parseInt(dateRange.end.substring(0, 4), 10);
            if (startYear > endYear) {
                return this.createErrorResponse('INVALID_DATE_RANGE', 'Start date cannot be after end date');
            }
        }
        return null;
    }
    /**
     * Applies result count limits to ensure performance constraints
     *
     * Requirements: 1.5
     */
    applyResultLimiting(parameters) {
        const processedParameters = { ...parameters };
        // Apply default or maximum result limits
        const defaultMaxResults = 20;
        const absoluteMaxResults = 100;
        if (!processedParameters.maxResults) {
            processedParameters.maxResults = defaultMaxResults;
        }
        else {
            processedParameters.maxResults = Math.min(processedParameters.maxResults, absoluteMaxResults);
        }
        return processedParameters;
    }
    /**
     * Applies additional filtering to search results
     * Filters by date ranges and author specifications
     *
     * Requirements: 2.1, 3.1, 3.2, 3.3
     */
    applyResultFiltering(papers, parameters) {
        let filteredPapers = [...papers];
        // Apply author filtering if specified
        if (parameters.authors && parameters.authors.length > 0) {
            filteredPapers = this.filterByAuthors(filteredPapers, parameters.authors);
        }
        // Apply date range filtering if specified
        if (parameters.dateRange) {
            filteredPapers = this.filterByDateRange(filteredPapers, parameters.dateRange);
        }
        // Apply result count limit
        if (parameters.maxResults) {
            filteredPapers = filteredPapers.slice(0, parameters.maxResults);
        }
        return filteredPapers;
    }
    /**
     * Filters papers by author names
     * Returns papers that include any of the specified authors
     *
     * Requirements: 2.1, 2.2
     */
    filterByAuthors(papers, authors) {
        const normalizedAuthors = authors.map(author => author.toLowerCase().trim());
        return papers.filter(paper => {
            const paperAuthors = paper.citation.authors.map(author => author.toLowerCase().trim());
            // Check if any of the specified authors match any of the paper's authors
            return normalizedAuthors.some(searchAuthor => paperAuthors.some(paperAuthor => paperAuthor.includes(searchAuthor) || searchAuthor.includes(paperAuthor)));
        });
    }
    /**
     * Filters papers by publication date range
     *
     * Requirements: 3.1, 3.2, 3.3
     */
    filterByDateRange(papers, dateRange) {
        return papers.filter(paper => {
            const paperYear = paper.citation.year;
            // Skip papers without year information
            if (!paperYear) {
                return false;
            }
            // Check start date constraint
            if (dateRange.start) {
                const startYear = parseInt(dateRange.start.substring(0, 4), 10);
                if (paperYear < startYear) {
                    return false;
                }
            }
            // Check end date constraint
            if (dateRange.end) {
                const endYear = parseInt(dateRange.end.substring(0, 4), 10);
                if (paperYear > endYear) {
                    return false;
                }
            }
            return true;
        });
    }
    /**
     * Builds a human-readable query string for the search result
     */
    buildQueryString(parameters) {
        const parts = [];
        // Add keywords
        if (parameters.keywords && parameters.keywords.length > 0) {
            parts.push(`keywords: ${parameters.keywords.join(', ')}`);
        }
        // Add authors
        if (parameters.authors && parameters.authors.length > 0) {
            parts.push(`authors: ${parameters.authors.join(', ')}`);
        }
        // Add date range
        if (parameters.dateRange) {
            if (parameters.dateRange.start && parameters.dateRange.end) {
                parts.push(`date range: ${parameters.dateRange.start} to ${parameters.dateRange.end}`);
            }
            else if (parameters.dateRange.start) {
                parts.push(`from: ${parameters.dateRange.start}`);
            }
            else if (parameters.dateRange.end) {
                parts.push(`until: ${parameters.dateRange.end}`);
            }
        }
        // Add result limit
        if (parameters.maxResults) {
            parts.push(`limit: ${parameters.maxResults}`);
        }
        return parts.join(', ');
    }
    /**
     * Creates a standardized error response
     */
    createErrorResponse(code, message, details) {
        return {
            error: true,
            code,
            message,
            details,
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=search-service.js.map