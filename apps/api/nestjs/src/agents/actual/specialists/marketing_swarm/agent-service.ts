import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FunctionAgentBaseService } from '../../../base/services/base-services';
import { LLMService } from '../../../base/services/llm/llm.service';
import { AgentContextService } from '../../../base/services/base-services/a2a-base/agent-context.service';

@Injectable()
export class MarketingSwarmService extends FunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService: HttpService,
    contextService: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
} 