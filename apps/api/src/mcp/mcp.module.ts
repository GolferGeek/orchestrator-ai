import { Module, OnModuleInit } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { MCPClientService } from './client/mcp-client.service';
import { SupabaseMCPServer } from './servers/supabase/supabase-mcp.server';
import { LLMModule } from '@/llms/llm.module';
import { SupabaseModule } from '@/supabase/supabase.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    LLMModule, // For SQL generation capabilities
    SupabaseModule, // For database access
  ],
  controllers: [MCPController],
  providers: [
    MCPClientService,
    SupabaseMCPServer,
    // Additional MCP servers can be added here
  ],
  exports: [MCPClientService, SupabaseMCPServer],
})
export class MCPModule implements OnModuleInit {
  constructor(
    private readonly mcpClientService: MCPClientService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Auto-register Supabase MCP server
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseKey) {
        await this.mcpClientService.registerServer({
          id: 'supabase-server',
          name: 'supabase',
          type: 'same-box',
          transport: 'http',
          endpoint: 'http://localhost:4000/mcp/supabase',
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

        console.log('✅ Supabase MCP server registered successfully');
      } else {
        console.warn('⚠️ Supabase configuration missing - MCP server not registered');
      }
    } catch (error) {
      console.error('❌ Failed to register Supabase MCP server:', error);
    }
  }
}
