import { Module, Global } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { SupabaseMCPController } from './servers/data/supabase/supabase-mcp.controller';
import { SupabaseMCPService } from './servers/data/supabase/supabase-mcp.service';
import { MCPClientService, MCPClientFactory } from './clients/mcp-client.service';
import { LLMModule } from '../src/llms/llm.module';

/**
 * MCP (Model Context Protocol) Module
 * 
 * Provides MCP server and client functionality for the API:
 * - Supabase MCP server with database integration
 * - Universal MCP client for agent use
 * - HTTP endpoints for MCP operations
 * - Automatic startup and lifecycle management
 * 
 * This module is marked as @Global so MCP services can be injected
 * anywhere in the application without importing this module.
 */
@Global()
@Module({
  imports: [LLMModule], // Import LLM module for SQL generation
  controllers: [MCPController, SupabaseMCPController],
  providers: [
    // MCP Server
    SupabaseMCPService,
    
    // MCP Client Factory (only the factory, not pre-initialized clients)
    MCPClientFactory,
  ],
  exports: [
    SupabaseMCPService,
    MCPClientFactory,
  ],
})
export class MCPModule {
  /**
   * Module initialization logs
   */
  constructor(private readonly supabaseMcpService: SupabaseMCPService) {
    // Service initialization happens in SupabaseMCPService.onModuleInit()
    // This constructor just provides access to the service for logging
  }
}