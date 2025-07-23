import { Module, OnModuleInit, Global } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { MCPClientService } from './client/mcp-client.service';
import { SupabaseMCPServer } from './servers/supabase/supabase-mcp.server';
import { MCPRegistryService } from './mcp-registry.service';
import { LLMModule } from '@/llms/llm.module';
import { SupabaseModule } from '@/supabase/supabase.module';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    LLMModule, // For SQL generation capabilities
    SupabaseModule, // For database access
  ],
  controllers: [MCPController],
  providers: [
    MCPClientService,
    SupabaseMCPServer,
    MCPRegistryService,
    // Additional MCP servers can be added here
  ],
  exports: [MCPClientService, SupabaseMCPServer, MCPRegistryService],
})
export class MCPModule implements OnModuleInit {
  constructor(
    private readonly mcpClientService: MCPClientService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    console.log('🚀 MCPModule onModuleInit called');
    console.log(`📊 MCP Client Service available: ${!!this.mcpClientService}`);
    
    // Register the MCP client service in the global registry
    MCPRegistryService.setMCPClient(this.mcpClientService);
    console.log('✅ MCPClientService registered in global registry');
    
    // Auto-register Supabase MCP server
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

      console.log(`🔑 Supabase URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
      console.log(`🔑 Supabase Key: ${supabaseKey ? 'SET' : 'MISSING'}`);

      if (supabaseUrl && supabaseKey) {
        console.log('📡 Registering Supabase MCP Server...');
        
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
        
        // Check if server is available
        const availableServers = this.mcpClientService.getAvailableServers?.() || [];
        console.log(`🌐 Available MCP servers: ${availableServers.join(', ') || 'none'}`);
        console.log(`🔍 MCP Service available: ${this.mcpClientService.isAvailable?.() || false}`);
      } else {
        console.warn('⚠️ Supabase configuration missing - MCP server not registered');
      }
    } catch (error) {
      console.error('❌ Failed to register Supabase MCP server:', error);
    }
  }
}
