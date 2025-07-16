import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function/function-agent-base.service';
import { LLMService } from '@/llms/llm.service';

@Injectable()
export class HRAssistantService extends FunctionAgentBaseService {
  constructor(httpService: HttpService, llmService: LLMService) {
    super(httpService, llmService);
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'HR Assistant';
  }
}
