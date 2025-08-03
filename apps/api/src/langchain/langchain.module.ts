import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';

// Core LangChain services
import { SupabaseToolsService } from './services/supabase-tools.service';
import { LangChainNotionService } from './services/notion-tools.service';
import { LangChainClientService } from './services/langchain-client.service';

/**
 * LangChain Module
 * 
 * Provides LangChain.js integration for agent-based workflows including:
 * - Supabase/PostgreSQL operations with natural language queries
 * - Notion API tool integration
 * - Core LangChain orchestration
 * 
 * Note: Database-specific services (SupabaseToolsService) are separate from
 * the main app services to allow for multiple database type support.
 */
@Module({
  imports: [
    HttpModule,      // For HTTP-based tools and integrations
    SupabaseModule,  // For database connectivity
    LLMModule,       // For language model access
  ],
  providers: [
    SupabaseToolsService,
    LangChainNotionService,
    LangChainClientService,
  ],
  exports: [
    SupabaseToolsService,
    LangChainNotionService,
    LangChainClientService,
  ],
})
export class LangChainModule {}