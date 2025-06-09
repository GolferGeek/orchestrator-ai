import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrchestratorService } from './agent-service';
import { LLMModule } from '../../base/services/llm/llm.module';

@Module({
  imports: [HttpModule, LLMModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {} 