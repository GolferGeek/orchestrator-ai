import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { LLMHttpClientService } from '../services/llm-http-client.service';
import { WebhookStatusService } from '../services/webhook-status.service';
import { LLMNodeExecutor } from './nodes/llm-node';
import { MarketingSwarmGraph } from './graphs/marketing-swarm.graph';
import { RequirementsWriterGraph } from './graphs/requirements-writer.graph';
import { MetricsAgentGraph } from './graphs/metrics-agent.graph';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    LLMHttpClientService,
    WebhookStatusService,
    LLMNodeExecutor,
    MarketingSwarmGraph,
    RequirementsWriterGraph,
    MetricsAgentGraph,
  ],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
