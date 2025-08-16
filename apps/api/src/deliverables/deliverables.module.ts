import { Module } from '@nestjs/common';
import { DeliverablesService } from './deliverables.service';
import { DeliverablesController } from './deliverables.controller';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { DeliverableVersionsController } from './deliverable-versions.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [DeliverablesController, DeliverableVersionsController],
  providers: [DeliverablesService, DeliverableVersionsService],
  exports: [DeliverablesService, DeliverableVersionsService],
})
export class DeliverablesModule {}
