import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule, HttpModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
