import { Injectable } from '@nestjs/common';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';

export interface AgentExecutionContext {
  agent: { slug: string; mode_profile: string };
  request: TaskRequestDto;
  routingMetadata?: Record<string, any>;
}

@Injectable()
export class AgentModeRouterService {
  async execute(context: AgentExecutionContext): Promise<TaskResponseDto> {
    switch (context.request.mode) {
      case AgentTaskMode.CONVERSE:
        return this.handleConverse(context);
      case AgentTaskMode.PLAN:
        return this.handlePlan(context);
      case AgentTaskMode.BUILD:
        return this.handleBuild(context);
      case AgentTaskMode.HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      default:
        return TaskResponseDto.failure(
          context.request.mode,
          'Unsupported mode',
        );
    }
  }

  private async handleConverse(context: AgentExecutionContext) {
    return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      content: {
        message: context.request.userMessage ?? 'Hello from agent.',
      },
      metadata: context.routingMetadata,
    });
  }

  private async handlePlan(context: AgentExecutionContext) {
    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        planDraft: {
          summary: 'Plan generation placeholder',
          agent: context.agent.slug,
        },
      },
    });
  }

  private async handleBuild(context: AgentExecutionContext) {
    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        status: 'build_started',
        agent: context.agent.slug,
      },
    });
  }
}
