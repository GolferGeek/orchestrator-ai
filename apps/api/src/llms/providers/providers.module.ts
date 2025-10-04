import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ModelsController } from '../models/models.controller';
import { ModelsService } from '../models/models.service';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ProvidersController, ModelsController],
  providers: [ProvidersService, ModelsService],
  exports: [ProvidersService, ModelsService],
})
export class ProvidersModule {}
