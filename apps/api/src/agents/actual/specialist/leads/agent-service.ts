import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

@Injectable()
export class LeadsAgentService extends ContextAgentBaseService {
  constructor(httpService: HttpService, llmService: LLMService) {
    super(httpService, llmService);
  }
}
