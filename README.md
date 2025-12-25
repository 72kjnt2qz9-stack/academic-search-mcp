# Academic Search MCP Server

A Model Context Protocol server that provides access to Google Scholar and JSTOR academic search capabilities with institutional authentication support.

## Features

### Google Scholar Integration
- Search academic papers by keywords
- Filter by author names and publication dates
- Retrieve citations, abstracts, and full text when available
- No authentication required

### JSTOR Integration  
- Browser-based Okta authentication for institutional access
- Full JSTOR database search with authenticated sessions
- Automatic session management and cookie handling
- Secure credential storage with expiration

### MCP Tools
- **`search_scholar`** - Google Scholar search (no auth required)
- **`authenticate_jstor`** - Browser-based JSTOR authentication
- **`search_jstor`** - JSTOR search (requires authentication first)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   npm run build
   ```

2. **Start the MCP server:**
   ```bash
   npm start
   ```

3. **Authenticate with JSTOR (if you have institutional access):**
   Use the `authenticate_jstor` tool - it will open your browser for Okta login

4. **Search academic papers:**
   - Use `search_scholar` for Google Scholar (works immediately)
   - Use `search_jstor` for JSTOR (after authentication)

## Authentication Workflow

### JSTOR Authentication
1. Call `authenticate_jstor` tool
2. Browser opens to JSTOR website (uses your system's default browser when possible)
3. Click "Access through your institution" 
4. Complete your Okta login process
5. Tool automatically extracts session cookies
6. Use `search_jstor` for authenticated searches

### Authentication Management
- **Check status:** `authenticate_jstor` with `action: "status"`
- **Clear session:** `authenticate_jstor` with `action: "clear"`
- Sessions expire after 24 hours automatically

## Requirements

- Node.js 18+ 
- npm
- For JSTOR: Institutional access via Okta
- System browser (Chrome, Safari, Firefox, or Edge) - falls back to bundled Chromium if needed

## Installation

```bash
npm install
```

## Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run property-based tests
npm run test:pbt

# Watch mode for tests
npm run test:watch
```

## Usage

This server will be implemented according to the MCP specification and can be used with any MCP-compatible client.

## Project Structure

```
src/
├── index.ts                   # Main entry point
├── types/                     # Type definitions
├── services/                  # Business logic services
│   ├── search-service.ts      # Search orchestration
│   ├── scholar-interface.ts   # Google Scholar interface
│   ├── jstor-interface.ts     # JSTOR interface with auth
│   └── auth-service.ts        # Browser-based authentication
└── server/                    # MCP server implementation
    └── mcp-server.ts          # MCP protocol implementation
```

## Security

- Session cookies are stored locally in `.jstor-session.json` (gitignored)
- Credentials are never logged or exposed in responses
- Sessions expire automatically after 24 hours
- Browser-based authentication ensures secure Okta flow

## Testing

The project uses a dual testing approach:
- Unit tests with Vitest for specific functionality
- Property-based tests with fast-check for universal properties

## License

MIT