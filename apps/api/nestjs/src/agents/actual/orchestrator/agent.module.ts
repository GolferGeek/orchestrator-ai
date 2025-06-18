import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrchestratorService } from './agent-service';
import { LLMModule } from '@/llms/llm.module';
import { SessionsModule } from '../../../sessions/sessions.module';

@Module({
  imports: [HttpModule, LLMModule, SessionsModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {} 