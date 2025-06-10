import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from '../../../base/services/base-services';
import { LLMService } from '../../../base/services/llm/llm.service';
import { AgentContextService } from '../../../base/services/base-services/a2a-base/agent-context.service';

@Injectable()
export class RequirementsWriterService extends PythonFunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(llmService, httpService, contextService);
    // Python script path will be set by AgentDiscoveryService during discovery
  }
} 