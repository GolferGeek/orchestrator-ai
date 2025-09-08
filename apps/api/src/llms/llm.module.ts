import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { SanitizationManagementController } from './sanitization-management.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { CIDAFMModule } from '../cidafm/cidafm.module';
import { SovereignPolicyModule } from '../config/sovereign-policy.module';
import { FeatureFlagModule } from '../config/feature-flag.module';
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
import { SourceBlindingService } from './source-blinding.service';
import { BlindedLLMService } from './blinded-llm.service';
import { BlindedHttpService } from './blinded-http.service';
import { PIIService } from '../services/pii.service';

@Module({
  imports: [SupabaseModule, CIDAFMModule, SovereignPolicyModule, FeatureFlagModule, HttpModule],
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
    SourceBlindingService,
    BlindedLLMService,
    BlindedHttpService,
    PIIService,
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
    SourceBlindingService,
    BlindedLLMService,
    BlindedHttpService,
    PIIService,
  ],
})
export class LLMModule {}
