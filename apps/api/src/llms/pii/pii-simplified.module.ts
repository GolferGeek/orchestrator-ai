/**
 * Simplified PII Module
 *
 * Provides the clean, simplified PII services
 * Can be used alongside legacy services during migration
 */

import { Module } from '@nestjs/common';
import { SimplifiedPIIService } from './pii-simplified.service';
import { PIIPatternService } from '../pii-pattern.service';
import { DictionaryPseudonymizerService } from './dictionary-pseudonymizer.service';
import { SimplifiedCentralizedRoutingService } from '../centralized-routing-simplified.service';
import { FeatureFlagService } from '@/config/feature-flag.service';
import { SovereignPolicyService } from '@/config/sovereign-policy.service';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    SimplifiedPIIService,
    PIIPatternService,
    DictionaryPseudonymizerService,
    SimplifiedCentralizedRoutingService,
    FeatureFlagService,
    SovereignPolicyService,
  ],
  exports: [SimplifiedPIIService, SimplifiedCentralizedRoutingService],
})
export class SimplifiedPIIModule {}
