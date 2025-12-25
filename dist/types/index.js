/**
 * Core data models and interfaces for the Google Scholar MCP Server
 *
 * These interfaces define the structure for search parameters, citations,
 * papers, and search results as specified in the requirements and design documents.
 */
/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(response) {
    return response && response.error === true;
}
/**
 * Type guard to check if search parameters are valid
 */
export function isValidSearchParameters(params) {
    return (params &&
        typeof params === 'object' &&
        Array.isArray(params.keywords) &&
        params.keywords.length > 0 &&
        params.keywords.every((k) => typeof k === 'string' && k.trim().length > 0));
}
//# sourceMappingURL=index.js.map