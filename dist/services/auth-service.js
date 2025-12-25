import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
/**
 * Authentication service for JSTOR via Okta
 * Handles browser-based authentication and cookie extraction
 */
export class AuthService {
    cookieStorePath;
    sessionCookies = null;
    constructor() {
        // Store cookies in a temporary file (will be gitignored)
        this.cookieStorePath = path.join(process.cwd(), '.jstor-session.json');
    }
    /**
     * Authenticate with JSTOR via Okta using browser automation
     * Opens browser for user to complete Okta login, then extracts cookies
     * Attempts to use system default browser when possible
     */
    async authenticateWithBrowser(jstorUrl = 'https://www.jstor.org') {
        let browser = null;
        try {
            console.log('Starting browser-based JSTOR authentication...');
            // Launch browser in non-headless mode so user can see and interact
            // Try to use system default browser, fall back to bundled Chromium
            const launchOptions = {
                headless: false,
                defaultViewport: { width: 1200, height: 800 },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            };
            // Try to detect and use system browser
            try {
                // On macOS, try to use the default browser
                if (process.platform === 'darwin') {
                    // Try common browser locations
                    const browserPaths = [
                        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                        '/Applications/Safari.app/Contents/MacOS/Safari',
                        '/Applications/Firefox.app/Contents/MacOS/firefox',
                        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
                    ];
                    for (const browserPath of browserPaths) {
                        try {
                            const fs = await import('fs/promises');
                            await fs.access(browserPath);
                            console.log(`Using browser: ${browserPath}`);
                            browser = await puppeteer.launch({
                                ...launchOptions,
                                executablePath: browserPath
                            });
                            break;
                        }
                        catch (error) {
                            // Browser not found, try next one
                            continue;
                        }
                    }
                }
            }
            catch (error) {
                console.log('Could not detect system browser, using bundled Chromium');
            }
            // If no system browser found, use bundled Chromium
            if (!browser) {
                console.log('Using bundled Chromium browser');
                browser = await puppeteer.launch(launchOptions);
            }
            const page = await browser.newPage();
            // Set a realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            console.log(`Opening JSTOR at: ${jstorUrl}`);
            await page.goto(jstorUrl, { waitUntil: 'networkidle0', timeout: 30000 });
            // Look for institutional access or login links
            await this.waitForUserAuthentication(page);
            // Extract cookies after authentication
            const cookies = await page.cookies();
            const relevantCookies = cookies.filter(cookie => cookie.domain.includes('jstor.org') ||
                cookie.domain.includes('okta.com') ||
                cookie.name.toLowerCase().includes('session') ||
                cookie.name.toLowerCase().includes('auth'));
            if (relevantCookies.length === 0) {
                return {
                    success: false,
                    message: 'No authentication cookies found. Please ensure you completed the login process.',
                    cookiesFound: 0
                };
            }
            // Convert cookies to header format
            const cookieHeader = relevantCookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');
            // Store cookies securely
            await this.storeCookies(cookieHeader, relevantCookies);
            this.sessionCookies = cookieHeader;
            // Test if the session is valid
            const isValid = await this.validateSession(page);
            return {
                success: true,
                message: `Authentication successful! Found ${relevantCookies.length} session cookies.`,
                cookiesFound: relevantCookies.length,
                sessionValid: isValid
            };
        }
        catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    /**
     * Wait for user to complete authentication in the browser
     */
    async waitForUserAuthentication(page) {
        console.log('Waiting for user to complete authentication...');
        console.log('Please:');
        console.log('1. Click on "Access through your institution" or similar');
        console.log('2. Complete your Okta login process');
        console.log('3. Wait until you can see JSTOR content or search interface');
        console.log('4. The browser will close automatically once cookies are extracted');
        // Wait for signs of successful authentication
        // This could be presence of user account info, search interface, etc.
        const maxWaitTime = 300000; // 5 minutes
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Check for common indicators of successful JSTOR authentication
                const indicators = await page.evaluate(() => {
                    // This code runs in the browser context where document and window are available
                    const doc = globalThis.document;
                    const win = globalThis.window;
                    const body = doc.body.innerText.toLowerCase();
                    const hasUserAccount = doc.querySelector('[data-qa="user-menu"]') !== null ||
                        doc.querySelector('.user-menu') !== null ||
                        body.includes('my account') ||
                        body.includes('sign out');
                    const hasSearchInterface = doc.querySelector('input[type="search"]') !== null ||
                        doc.querySelector('.search-input') !== null ||
                        body.includes('search jstor');
                    const hasInstitutionalAccess = body.includes('institutional access') ||
                        body.includes('university') ||
                        body.includes('library access');
                    return {
                        hasUserAccount,
                        hasSearchInterface,
                        hasInstitutionalAccess,
                        currentUrl: win.location.href
                    };
                });
                // If we detect successful authentication, break out of waiting
                if (indicators.hasUserAccount ||
                    (indicators.hasSearchInterface && indicators.currentUrl.includes('jstor.org'))) {
                    console.log('✓ Authentication detected! Extracting cookies...');
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Give a moment for all cookies to be set
                    break;
                }
                // Check if we're still on an authentication page
                const currentUrl = page.url();
                if (currentUrl.includes('okta.com') || currentUrl.includes('login') || currentUrl.includes('auth')) {
                    console.log('Still on authentication page, waiting...');
                }
                await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
            }
            catch (error) {
                // Continue waiting even if there are evaluation errors
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        if (Date.now() - startTime >= maxWaitTime) {
            throw new Error('Authentication timeout - please try again and complete the login process more quickly');
        }
    }
    /**
     * Validate that the current session has access to JSTOR
     */
    async validateSession(page) {
        try {
            // Try to access a search page or user account area
            await page.goto('https://www.jstor.org/action/doBasicSearch?Query=test', {
                waitUntil: 'networkidle0',
                timeout: 10000
            });
            // Check if we can see search results or if we're redirected to login
            const hasAccess = await page.evaluate(() => {
                const doc = globalThis.document;
                const body = doc.body.innerText.toLowerCase();
                return !body.includes('sign in') &&
                    !body.includes('login required') &&
                    (body.includes('search results') || body.includes('articles') || body.includes('jstor'));
            });
            return hasAccess;
        }
        catch (error) {
            console.warn('Session validation failed:', error);
            return false;
        }
    }
    /**
     * Store cookies securely in a local file
     */
    async storeCookies(cookieHeader, cookies) {
        const sessionData = {
            cookieHeader,
            cookies,
            timestamp: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
        };
        try {
            await fs.writeFile(this.cookieStorePath, JSON.stringify(sessionData, null, 2));
            console.log(`Cookies stored securely at: ${this.cookieStorePath}`);
        }
        catch (error) {
            console.warn('Failed to store cookies:', error);
        }
    }
    /**
     * Load stored cookies if they exist and are still valid
     */
    async loadStoredCookies() {
        try {
            const data = await fs.readFile(this.cookieStorePath, 'utf-8');
            const sessionData = JSON.parse(data);
            // Check if cookies are still valid (not expired)
            if (Date.now() > sessionData.expiresAt) {
                console.log('Stored cookies have expired');
                await this.clearStoredCookies();
                return null;
            }
            this.sessionCookies = sessionData.cookieHeader;
            console.log('Loaded stored authentication cookies');
            return sessionData.cookieHeader;
        }
        catch (error) {
            // File doesn't exist or is corrupted
            return null;
        }
    }
    /**
     * Clear stored cookies
     */
    async clearStoredCookies() {
        try {
            await fs.unlink(this.cookieStorePath);
            this.sessionCookies = null;
            console.log('Cleared stored cookies');
        }
        catch (error) {
            // File might not exist, which is fine
        }
    }
    /**
     * Get current session cookies
     */
    getSessionCookies() {
        return this.sessionCookies;
    }
    /**
     * Check if we have valid authentication
     */
    async hasValidAuthentication() {
        // First try to load stored cookies
        const storedCookies = await this.loadStoredCookies();
        if (storedCookies) {
            return true;
        }
        return this.sessionCookies !== null;
    }
    /**
     * Get authentication status information
     */
    async getAuthStatus() {
        const hasAuth = await this.hasValidAuthentication();
        if (!hasAuth) {
            return {
                authenticated: false,
                cookiesPresent: false
            };
        }
        try {
            const data = await fs.readFile(this.cookieStorePath, 'utf-8');
            const sessionData = JSON.parse(data);
            const now = Date.now();
            return {
                authenticated: true,
                cookiesPresent: true,
                sessionAge: Math.floor((now - sessionData.timestamp) / 1000 / 60), // minutes
                expiresIn: Math.floor((sessionData.expiresAt - now) / 1000 / 60) // minutes
            };
        }
        catch (error) {
            return {
                authenticated: hasAuth,
                cookiesPresent: this.sessionCookies !== null
            };
        }
    }
}
//# sourceMappingURL=auth-service.js.map