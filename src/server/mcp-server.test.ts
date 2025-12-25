import { describe, it, expect } from 'vitest';
import { MCPServer } from './mcp-server.js';

describe('MCPServer', () => {
  it('should create an instance without errors', () => {
    expect(() => new MCPServer()).not.toThrow();
  });

  it('should have the correct tool definition', () => {
    const server = new MCPServer();
    // Access the private method for testing
    const toolDef = (server as any).getSearchToolDefinition();
    
    expect(toolDef.name).toBe('search_scholar');
    expect(toolDef.description).toContain('Search Google Scholar');
    expect(toolDef.inputSchema.properties.keywords).toBeDefined();
    expect(toolDef.inputSchema.required).toContain('keywords');
  });

  it('should validate date range correctly', () => {
    const server = new MCPServer();
    
    // Valid date ranges
    expect((server as any).validateDateRange({ start: '2020' })).toEqual({ valid: true, message: '' });
    expect((server as any).validateDateRange({ start: '2020-01' })).toEqual({ valid: true, message: '' });
    expect((server as any).validateDateRange({ start: '2020-01-01' })).toEqual({ valid: true, message: '' });
    
    // Invalid date ranges
    expect((server as any).validateDateRange({ start: 'invalid' }).valid).toBe(false);
    expect((server as any).validateDateRange({ start: '2025', end: '2020' }).valid).toBe(false);
  });

  it('should create error responses correctly', () => {
    const server = new MCPServer();
    const errorResponse = (server as any).createErrorResponse('TEST_ERROR', 'Test message', { test: true });
    
    expect(errorResponse.content[0].text).toContain('TEST_ERROR');
    expect(errorResponse.content[0].text).toContain('Test message');
    expect(errorResponse.isError).toBe(true);
  });
});