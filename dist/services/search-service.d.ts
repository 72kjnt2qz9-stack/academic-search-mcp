import { SearchParameters, SearchResult, ErrorResponse } from '../types/index.js';
/**
 * Search service that orchestrates the complete search workflow
 * Handles parameter validation, search execution, and result processing
 *
 * Requirements: 1.1, 7.3
 */
export declare class SearchService {
    private scholarInterface;
    constructor();
    /**
     * Executes a complete search workflow
     * Coordinates all search steps from validation to result formatting
     *
     * Requirements: 1.1, 7.3
     */
    executeSearch(parameters: SearchParameters): Promise<SearchResult | ErrorResponse>;
    /**
     * Validates search parameters and returns error if invalid
     * Returns null if parameters are valid
     *
     * Requirements: 1.4, 3.4
     */
    private validateSearchParameters;
    /**
     * Validates date range parameters
     * Returns error if dates are invalid, null if valid
     *
     * Requirements: 3.4
     */
    private validateDateRange;
    /**
     * Applies result count limits to ensure performance constraints
     *
     * Requirements: 1.5
     */
    private applyResultLimiting;
    /**
     * Applies additional filtering to search results
     * Filters by date ranges and author specifications
     *
     * Requirements: 2.1, 3.1, 3.2, 3.3
     */
    private applyResultFiltering;
    /**
     * Filters papers by author names
     * Returns papers that include any of the specified authors
     *
     * Requirements: 2.1, 2.2
     */
    private filterByAuthors;
    /**
     * Filters papers by publication date range
     *
     * Requirements: 3.1, 3.2, 3.3
     */
    private filterByDateRange;
    /**
     * Builds a human-readable query string for the search result
     */
    private buildQueryString;
    /**
     * Creates a standardized error response
     */
    private createErrorResponse;
}
//# sourceMappingURL=search-service.d.ts.map