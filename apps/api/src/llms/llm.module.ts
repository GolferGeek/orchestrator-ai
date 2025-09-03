import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { CIDAFMModule } from '../cidafm/cidafm.module';
import { CentralizedRoutingService } from './centralized-routing.service';
import { RunMetadataService } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { SecretRedactionService } from './secret-redaction.service';
import { LocalModelStatusService } from './local-model-status.service';
import { LocalLLMService } from './local-llm.service';
import { LlmUsageController } from './llm-usage.controller';

@Module({
  imports: [SupabaseModule, CIDAFMModule, HttpModule],
  controllers: [LLMController, LlmUsageController],
  providers: [
    LLMService,
    CentralizedRoutingService,
    RunMetadataService,
    ProviderConfigService,
    SecretRedactionService,
    LocalModelStatusService,
    LocalLLMService,
  ],
  exports: [
    LLMService,
    CentralizedRoutingService,
    RunMetadataService,
    ProviderConfigService,
    SecretRedactionService,
    LocalModelStatusService,
    LocalLLMService,
  ],
})
export class LLMModule {}
