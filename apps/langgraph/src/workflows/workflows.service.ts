import { Injectable } from '@nestjs/common';
import { MarketingSwarmGraph, MarketingSwarmState } from './graphs/marketing-swarm.graph';
import { RequirementsWriterGraph, RequirementsWriterState } from './graphs/requirements-writer.graph';
import { MetricsAgentGraph, MetricsAgentState } from './graphs/metrics-agent.graph';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly marketingSwarmGraph: MarketingSwarmGraph,
    private readonly requirementsWriterGraph: RequirementsWriterGraph,
    private readonly metricsAgentGraph: MetricsAgentGraph,
  ) {}

  async executeMarketingSwarm(request: WorkflowRequestDto): Promise<MarketingSwarmState> {
    const input: MarketingSwarmState = {
      announcement: request.prompt,
      provider: request.provider,
      model: request.model,
      taskId: request.taskId,
      conversationId: request.conversationId,
      userId: request.userId,
      statusWebhook: request.statusWebhook,
    };

    return this.marketingSwarmGraph.execute(input);
  }

  async executeRequirementsWriter(request: WorkflowRequestDto): Promise<RequirementsWriterState> {
    const input: RequirementsWriterState = {
      prompt: request.prompt,
      provider: request.provider,
      model: request.model,
      taskId: request.taskId,
      conversationId: request.conversationId,
      userId: request.userId,
      statusWebhook: request.statusWebhook,
      metadata: request.metadata,
    };

    return this.requirementsWriterGraph.execute(input);
  }

  async executeMetricsAgent(request: WorkflowRequestDto): Promise<MetricsAgentState> {
    const input: MetricsAgentState = {
      prompt: request.prompt,
      provider: request.provider,
      model: request.model,
      taskId: request.taskId,
      conversationId: request.conversationId,
      userId: request.userId,
      statusWebhook: request.statusWebhook,
    };

    return this.metricsAgentGraph.execute(input);
  }
}
