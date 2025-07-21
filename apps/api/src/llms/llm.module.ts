import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { CIDAFMModule } from '../cidafm/cidafm.module';

@Module({
  imports: [SupabaseModule, CIDAFMModule],
  controllers: [LLMController],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
