import { Module } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { MCPClientService } from './client/mcp-client.service';
import { SupabaseMCPServer } from './servers/supabase/supabase-mcp.server';
import { LLMModule } from '@/llms/llm.module';
import { SupabaseModule } from '@/supabase/supabase.module';

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
export class MCPModule {}
