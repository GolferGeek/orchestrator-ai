import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller()
export class Agent2AgentController {
  constructor(
    private readonly cardBuilder: AgentCardBuilderService,
    private readonly gateway: AgentExecutionGateway,
  ) {}

  @Get([
    'agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json',
    'agents/:orgSlug/:agentSlug/.well-known/agent.json',
  ])
  async getAgentCard(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
  ) {
    const org = orgSlug === 'global' ? null : orgSlug;
    return this.cardBuilder.build(org, agentSlug);
  }

  @Post([
    'agent-to-agent/:orgSlug/:agentSlug/tasks',
    'agents/:orgSlug/:agentSlug/tasks',
  ])
  @UseGuards(ApiKeyGuard)
  async executeTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Body() dto: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const org = orgSlug === 'global' ? null : orgSlug;
    return this.gateway.execute(org, agentSlug, dto);
  }
}
