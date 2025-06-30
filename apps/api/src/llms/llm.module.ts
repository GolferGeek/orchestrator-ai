import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { CIDAFMModule } from '../cidafm/cidafm.module';

@Module({
  imports: [SupabaseModule, CIDAFMModule],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
