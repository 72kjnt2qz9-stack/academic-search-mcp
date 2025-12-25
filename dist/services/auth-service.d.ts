/**
 * Authentication service for JSTOR via Okta
 * Handles browser-based authentication and cookie extraction
 */
export declare class AuthService {
    private cookieStorePath;
    private sessionCookies;
    constructor();
    /**
     * Authenticate with JSTOR via Okta using browser automation
     * Opens browser for user to complete Okta login, then extracts cookies
     * Attempts to use system default browser when possible
     */
    authenticateWithBrowser(jstorUrl?: string): Promise<{
        success: boolean;
        message: string;
        cookiesFound?: number;
        sessionValid?: boolean;
    }>;
    /**
     * Wait for user to complete authentication in the browser
     */
    private waitForUserAuthentication;
    /**
     * Validate that the current session has access to JSTOR
     */
    private validateSession;
    /**
     * Store cookies securely in a local file
     */
    private storeCookies;
    /**
     * Load stored cookies if they exist and are still valid
     */
    loadStoredCookies(): Promise<string | null>;
    /**
     * Clear stored cookies
     */
    clearStoredCookies(): Promise<void>;
    /**
     * Get current session cookies
     */
    getSessionCookies(): string | null;
    /**
     * Check if we have valid authentication
     */
    hasValidAuthentication(): Promise<boolean>;
    /**
     * Get authentication status information
     */
    getAuthStatus(): Promise<{
        authenticated: boolean;
        cookiesPresent: boolean;
        sessionAge?: number;
        expiresIn?: number;
    }>;
}
//# sourceMappingURL=auth-service.d.ts.map