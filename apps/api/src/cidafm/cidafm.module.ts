import { Module } from '@nestjs/common';
import { CIDAFMController } from './cidafm.controller';
import { CIDAFMService } from './cidafm.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CIDAFMController],
  providers: [CIDAFMService],
  exports: [CIDAFMService],
})
export class CIDAFMModule {}