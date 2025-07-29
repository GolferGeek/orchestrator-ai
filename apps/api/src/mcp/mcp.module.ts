import { Module, OnModuleInit, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MCPController } from './mcp.controller';
import { MCPClientService } from './client/mcp-client.service';
import { SupabaseMCPServer } from './servers/supabase/supabase-mcp.server';
import { MCPRegistryService } from './mcp-registry.service';
import { LLMModule } from '@/llms/llm.module';
import { LLMService } from '@/llms/llm.service';
import { SupabaseModule } from '@/supabase/supabase.module';
import { ConfigService } from '@nestjs/config';
import { MCPExecutionTrackerService } from './servers/supabase/services/mcp-execution-tracker.service';
import { ContextLearningService } from './servers/supabase/services/context-learning.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Global()
@Module({
  imports: [
    HttpModule, // For heartbeat HTTP requests
    LLMModule, // For SQL generation capabilities
    SupabaseModule, // For database access
  ],
  controllers: [MCPController],
  providers: [
    MCPClientService,
    SupabaseMCPServer,
    MCPRegistryService,
    MCPExecutionTrackerService,
    ContextLearningService,
    // Additional MCP servers can be added here
  ],
  exports: [MCPClientService, SupabaseMCPServer, MCPRegistryService],
})
export class MCPModule implements OnModuleInit {
  constructor(
    private readonly mcpClientService: MCPClientService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseMCPServer: SupabaseMCPServer,
  ) {}

  async onModuleInit() {
    console.log('🚀 MCPModule onModuleInit called');
    console.log(`📊 MCP Client Service available: ${!!this.mcpClientService}`);

    // Register the MCP client service in the global registry
    MCPRegistryService.setMCPClient(this.mcpClientService);
    console.log('✅ MCPClientService registered in global registry');

    // Auto-register Supabase MCP server with both MCP Client and MCP Pool
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
      const baseUrl = this.configService.get<string>(
        'BASE_URL',
        'http://localhost:4000',
      );

      console.log(`🔑 Supabase URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
      console.log(`🔑 Supabase Key: ${supabaseKey ? 'SET' : 'MISSING'}`);
      console.log(`🌐 Base URL: ${baseUrl}`);

      if (supabaseUrl && supabaseKey) {
        console.log('📡 Auto-registering Enhanced Supabase MCP Server...');

        // Initialize the Supabase MCP Server first
        console.log('🔧 Initializing Supabase MCP Server...');
        await this.supabaseMCPServer.initialize({
          supabaseUrl,
          supabaseKey,
          enableCaching: true,
          cacheTTL: 300000, // 5 minutes
          maxQueryTimeout: 30000, // 30 seconds
          sqlModels: ['claude-3-5-sonnet', 'gpt-4'],
          enableContextLearning: true,
          defaultLLMProvider: 'anthropic',
          defaultLLMModel: 'claude-3-5-sonnet',
        });
        console.log('✅ Supabase MCP Server initialized successfully');

        // Register with MCP Client Service (legacy compatibility)
        await this.mcpClientService.registerServer({
          id: 'supabase-mcp',
          name: 'supabase',
          type: 'same-box',
          transport: 'http',
          endpoint: `${baseUrl}/mcp/supabase`,
          authentication: {
            type: 'bearer',
            token: supabaseKey,
          },
          timeout: 30000,
          maxRetries: 3,
          healthCheck: {
            enabled: true,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            retries: 3,
          },
        });
        console.log('✅ Supabase MCP registered with MCP Client Service');

        // MCP Pool Service removed - using direct MCP Client Service

        // Check if server is available
        const availableServers =
          this.mcpClientService.getAvailableServers?.() || [];
        console.log(
          `🌐 Available MCP servers: ${availableServers.join(', ') || 'none'}`,
        );
        console.log(
          `🔍 MCP Service available: ${this.mcpClientService.isAvailable?.() || false}`,
        );

        console.log(
          '🎉 Auto-registration completed - Enhanced Supabase MCP available via MCP Client Service',
        );
      } else {
        console.warn(
          '⚠️ Supabase configuration missing - MCP server not registered',
        );
      }
    } catch (error) {
      console.error('❌ Failed to auto-register Supabase MCP server:', error);
    }
  }
}
