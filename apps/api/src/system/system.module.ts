import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SystemController],
})
export class SystemModule {}
