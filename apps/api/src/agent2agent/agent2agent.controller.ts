import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';

@Controller('agent-to-agent/:orgSlug/:agentSlug')
export class Agent2AgentController {
  constructor(
    private readonly cardBuilder: AgentCardBuilderService,
    private readonly gateway: AgentExecutionGateway,
  ) {}

  @Get('.well-known/agent.json')
  async getAgentCard(@Param('orgSlug') orgSlug: string, @Param('agentSlug') agentSlug: string) {
    const org = orgSlug === 'global' ? null : orgSlug;
    return this.cardBuilder.build(org, agentSlug);
  }

  @Post('tasks')
  async executeTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Body() dto: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const org = orgSlug === 'global' ? null : orgSlug;
    return this.gateway.execute(org, agentSlug, dto);
  }
}
