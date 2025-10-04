import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { PlansService } from './services/plans.service';
import { PlanVersionsService } from './services/plan-versions.service';
import { PlansRepository } from './repositories/plans.repository';
import { PlanVersionsRepository } from './repositories/plan-versions.repository';

@Module({
  imports: [
    SupabaseModule,
    // Note: We may need to import LLMModule later for merge functionality
    // For now, keeping it simple
  ],
  providers: [
    PlansService,
    PlanVersionsService,
    PlansRepository,
    PlanVersionsRepository,
  ],
  exports: [PlansService, PlanVersionsService],
})
export class PlansModule {}
