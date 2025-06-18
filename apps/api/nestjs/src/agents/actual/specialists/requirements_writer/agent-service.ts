import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from '@agents/base/implementations/base-services/function/python-function-agent-base.service';
import { LLMService } from '@/llms/llm.service';

@Injectable()
export class RequirementsWriterService extends PythonFunctionAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService
  ) {
    super(httpService, llmService);
    // Python script path will be set by AgentDiscoveryService during discovery
  }
} 