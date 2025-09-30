import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgentTaskMode } from './dto/task-request.dto';

interface NormalizedTaskRequest {
  dto: TaskRequestDto;
  jsonrpc?: {
    id: any;
    method?: string | null;
  };
}

interface JsonRpcSuccessEnvelope {
  jsonrpc: '2.0';
  id: any;
  result: TaskResponseDto;
}

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
    @Body() body: any,
  ): Promise<TaskResponseDto | JsonRpcSuccessEnvelope> {
    const org = orgSlug === 'global' ? null : orgSlug;
    const { dto, jsonrpc } = await this.normalizeTaskRequest(body);
    const result = await this.gateway.execute(org, agentSlug, dto);

    if (jsonrpc) {
      return {
        jsonrpc: '2.0',
        id: jsonrpc.id ?? null,
        result,
      };
    }

    return result;
  }

  private async normalizeTaskRequest(
    payload: any,
  ): Promise<NormalizedTaskRequest> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body must be a JSON object.');
    }

    const isJsonRpc =
      typeof payload.jsonrpc === 'string' && payload.jsonrpc.length > 0;

    const candidateSource = isJsonRpc ? (payload.params ?? {}) : payload;
    const candidate = { ...candidateSource };

    if (isJsonRpc && !candidate.mode && typeof payload.method === 'string') {
      const mapped = this.mapMethodToMode(payload.method);
      if (mapped) {
        candidate.mode = mapped;
      }
    }

    const dto = plainToInstance(TaskRequestDto, candidate);
    const errors = await validate(dto, {
      whitelist: true,
      forbidUnknownValues: false,
      forbidNonWhitelisted: false,
    });

    if (errors.length) {
      throw new BadRequestException(this.formatValidationErrors(errors));
    }

    let jsonrpc: NormalizedTaskRequest['jsonrpc'] | undefined;

    if (isJsonRpc) {
      const jsonrpcContext = {
        id: payload.id ?? null,
        method: payload.method ?? null,
      };

      dto.metadata = {
        ...(dto.metadata ?? {}),
        jsonrpc: jsonrpcContext,
      };

      jsonrpc = jsonrpcContext;
    }

    return { dto, jsonrpc };
  }

  private mapMethodToMode(method: string): AgentTaskMode | undefined {
    const normalized = method.trim().toLowerCase();
    switch (normalized) {
      case 'converse':
      case 'agent.converse':
      case 'tasks.converse':
        return AgentTaskMode.CONVERSE;
      case 'plan':
      case 'agent.plan':
      case 'tasks.plan':
        return AgentTaskMode.PLAN;
      case 'build':
      case 'agent.build':
      case 'tasks.build':
        return AgentTaskMode.BUILD;
      case 'orchestrate.create':
      case 'agent.orchestrate_create':
      case 'orchestrate_create':
        return AgentTaskMode.ORCHESTRATE_CREATE;
      case 'orchestrate.execute':
      case 'agent.orchestrate_execute':
      case 'orchestrate_execute':
        return AgentTaskMode.ORCHESTRATE_EXECUTE;
      case 'orchestrate.continue':
      case 'agent.orchestrate_continue':
      case 'orchestrate_continue':
        return AgentTaskMode.ORCHESTRATE_CONTINUE;
      case 'orchestrate.save_recipe':
      case 'agent.orchestrate_save_recipe':
      case 'orchestrate_save_recipe':
        return AgentTaskMode.ORCHESTRATE_SAVE_RECIPE;
      default:
        return undefined;
    }
  }

  private formatValidationErrors(errors: any[]): string {
    const messages = errors
      .map((error) => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        if (error.children && error.children.length) {
          return this.formatValidationErrors(error.children);
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length
      ? messages.join('; ')
      : 'Invalid task request payload.';
  }
}
