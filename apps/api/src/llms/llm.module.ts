import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { SanitizationManagementController } from './sanitization-management.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { CIDAFMModule } from '../cidafm/cidafm.module';
import { CentralizedRoutingService } from './centralized-routing.service';
import { RunMetadataService } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { SecretRedactionService } from './secret-redaction.service';
import { PIIPatternService } from './pii-pattern.service';
import { PseudonymizationService } from './pseudonymization.service';
import { DataSanitizationService } from './data-sanitization.service';
import { LocalModelStatusService } from './local-model-status.service';
import { LocalLLMService } from './local-llm.service';
import { MemoryManagerService } from './memory-manager.service';
import { ModelMonitorService } from './model-monitor.service';
import { ProductionOptimizationController } from './production-optimization.controller';
import { LlmUsageController } from './llm-usage.controller';

@Module({
  imports: [SupabaseModule, CIDAFMModule, HttpModule],
  controllers: [LLMController, SanitizationManagementController, LlmUsageController, ProductionOptimizationController],
  providers: [
    LLMService,
    CentralizedRoutingService,
    RunMetadataService,
    ProviderConfigService,
    SecretRedactionService,
    PIIPatternService,
    PseudonymizationService,
    DataSanitizationService,
    LocalModelStatusService,
    LocalLLMService,
    MemoryManagerService,
    ModelMonitorService,
  ],
  exports: [
    LLMService,
    CentralizedRoutingService,
    RunMetadataService,
    ProviderConfigService,
    SecretRedactionService,
    PIIPatternService,
    PseudonymizationService,
    DataSanitizationService,
    LocalModelStatusService,
    LocalLLMService,
    MemoryManagerService,
    ModelMonitorService,
  ],
})
export class LLMModule {}
