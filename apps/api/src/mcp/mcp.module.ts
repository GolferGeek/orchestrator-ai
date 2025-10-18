import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LLMModule } from '../llms/llm.module';
import { MCPController } from './mcp.controller';
import { MCPService } from './mcp.service';
import { MCPClientService } from './clients/mcp-client.service';

// Service and tool handlers for different namespaces
import { SupabaseMCPService } from './services/supabase/supabase-mcp.service';
import { SlackMCPTools } from './tools/slack.tools';
import { NotionMCPTools } from './tools/notion.tools';

/**
 * MCP Module
 *
 * Unified Model Context Protocol module implementing MCP 2025-03-26 specification
 * Provides single-app architecture supporting multiple tool namespaces:
 * - Data tools: supabase/, sqlserver/, postgres/
 * - Productivity tools: slack/, notion/, asana/
 * - Utility tools: system/, file/, network/
 */
@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LLMModule,
  ],
  controllers: [MCPController],
  providers: [
    MCPService,
    MCPClientService,

    // Service namespace handlers
    SupabaseMCPService,
    SlackMCPTools,
    NotionMCPTools,

    // Additional service handlers can be added here
    // SQLServerMCPService,
    // PostgresMCPService,
    // AsanaMCPService,
    // TrelloMCPService,
    // FileMCPService,
    // SystemMCPService,
  ],
  exports: [
    MCPService,
    MCPClientService,

    // Export service handlers for use in other modules
    SupabaseMCPService,
    SlackMCPTools,
    NotionMCPTools,
  ],
})
export class MCPModule {
  constructor(private readonly mcpService: MCPService) {
    void this.initializeModule();
  }

  /**
   * Initialize the MCP module
   */
  private async initializeModule(): Promise<void> {
    try {
      // Initialize MCP service and verify tool handlers
      const serverInfo = this.mcpService.initialize();

      console.log(
        `✅ MCP Server initialized: ${serverInfo.serverInfo.name} v${serverInfo.serverInfo.version}`,
      );
      console.log(`📋 Protocol version: ${serverInfo.protocolVersion}`);

      // List available tools for debugging
      const toolsResult = await this.mcpService.listTools();
      const namespaces = [
        ...new Set(toolsResult.tools.map((tool) => tool.name.split('/')[0])),
      ];

      console.log(
        `🔧 ${toolsResult.tools.length} tools loaded across ${namespaces.length} namespaces: ${namespaces.join(', ')}`,
      );

      // Health check all tool handlers
      const pingResult = await this.mcpService.ping();
      console.log(`❤️  MCP health status: ${pingResult.status}`);

      // Log namespace health
      Object.entries(pingResult.namespaces || {}).forEach(
        ([namespace, healthy]) => {
          const _status = healthy ? '✅' : '❌';
          console.log(
            `   ${_status} ${namespace}: ${healthy ? 'healthy' : 'unhealthy'}`,
          );
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ MCP Module initialization failed: ${errorMessage}`);
    }
  }
}
