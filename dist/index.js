import { MCPServer } from './server/index.js';
import { fileURLToPath } from 'url';
/**
 * Main entry point for the Google Scholar MCP Server
 * Starts the MCP server and handles graceful shutdown
 */
async function main() {
    try {
        console.error('Initializing Google Scholar MCP Server...');
        const server = new MCPServer();
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.error('Received SIGINT, shutting down gracefully...');
            try {
                await server.stop();
            }
            catch (error) {
                console.error('Error during shutdown:', error);
            }
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.error('Received SIGTERM, shutting down gracefully...');
            try {
                await server.stop();
            }
            catch (error) {
                console.error('Error during shutdown:', error);
            }
            process.exit(0);
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught exception:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        console.error('Starting MCP server...');
        await server.start();
        console.error('Google Scholar MCP Server started successfully');
    }
    catch (error) {
        console.error('Failed to start Google Scholar MCP Server:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}
// Check if this file is being run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('index.js');
if (isMainModule) {
    main().catch((error) => {
        console.error('Unhandled error in main:', error);
        process.exit(1);
    });
}
export * from './types/index.js';
export * from './services/index.js';
export * from './server/index.js';
//# sourceMappingURL=index.js.map