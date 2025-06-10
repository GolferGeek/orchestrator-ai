import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SimpleFunctionAgentBaseService } from '../../../base/services/base-services/function/simple-function-agent-base.service';
import { LLMService } from '../../../base/services/llm/llm.service';
import { AgentContextService } from '../../../base/services/base-services/a2a-base/agent-context.service';

@Injectable()
export class HRAssistantService extends SimpleFunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService: HttpService,
    contextService: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
} 