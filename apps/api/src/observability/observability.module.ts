import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ObservabilityWebhookService } from './observability-webhook.service';
import { ObservabilityStreamController } from './observability-stream.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [HttpModule, AuthModule, SupabaseModule],
  providers: [ObservabilityWebhookService],
  controllers: [ObservabilityStreamController],
  exports: [ObservabilityWebhookService],
})
export class ObservabilityModule {}

