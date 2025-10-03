import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { Agent2AgentTasksService } from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgentTaskMode } from './dto/task-request.dto';
import { AgentType } from '../common/types/agent-conversations.types';
import { AgentRegistryService } from '../agent-platform/services/agent-registry.service';
import { AgentRecord } from '../agent-platform/interfaces/agent-record.interface';
import { Public } from '../auth/decorators/public.decorator';
import { AgentDeliverablesService } from './services/agent-deliverables.service';

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

interface JsonRpcErrorEnvelope {
  jsonrpc: '2.0';
  id: any;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

@Controller()
export class Agent2AgentController {
  constructor(
    private readonly cardBuilder: AgentCardBuilderService,
    private readonly gateway: AgentExecutionGateway,
    private readonly tasksService: Agent2AgentTasksService,
    private readonly taskStatusService: Agent2AgentTaskStatusService,
    private readonly agentConversationsService: Agent2AgentConversationsService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentDeliverablesService: AgentDeliverablesService,
  ) {}

  private readonly logger = new Logger(Agent2AgentController.name);

  /**
   * Create conversation for database agents
   * Route: POST /agent-to-agent/conversations
   */
  @Post('agent-to-agent/conversations')
  @UseGuards(JwtAuthGuard)
  async createConversation(
    @Body() body: { agentName: string; namespace: string; conversationId?: string; metadata?: Record<string, any> },
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ) {
    const conversation = await this.agentConversationsService.createConversation(
      currentUser.id,
      body.agentName,
      body.namespace, // No AgentType casting needed - just a string
      {
        conversationId: body.conversationId,
        metadata: body.metadata,
      },
    );
    
    return conversation;
  }

  /**
   * Get hierarchy of database agents (A2A protocol)
   * Route: GET /agent-to-agent/.well-known/hierarchy
   */
  @Get('agent-to-agent/.well-known/hierarchy')
  @Public()
  async getAgentHierarchy(
    @Headers('x-agent-namespace') namespaceHeader?: string,
    @Headers('X-Agent-Namespace') namespaceHeaderCaps?: string,
  ) {
    // Handle both lowercase and capitalized header names
    const effectiveNamespace = namespaceHeader || namespaceHeaderCaps;
    const namespaces = effectiveNamespace
      ? effectiveNamespace
          .split(',')
          .map((ns) => ns.trim())
          .filter(Boolean)
      : undefined;

    try {
      const databaseAgents = await this.fetchDatabaseAgents(namespaces);
      const hierarchy = this.buildDatabaseHierarchy(databaseAgents);

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents: databaseAgents.length,
          rootNodes: hierarchy.length,
          namespaces: namespaces ?? 'all',
          source: 'database',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching agent hierarchy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        metadata: {
          totalAgents: 0,
          rootNodes: 0,
          namespaces: namespaces ?? 'all',
          source: 'database',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  @Get([
    'agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json',
    'agents/:orgSlug/:agentSlug/.well-known/agent.json',
  ])
  async getAgentCard(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Query('includePrivate') includePrivate?: string,
    @Query('include_private') includePrivateSnake?: string,
  ) {
    const org = orgSlug === 'global' ? null : orgSlug;
    const includePrivateFields = this.resolveBooleanQuery(
      includePrivate,
      includePrivateSnake,
    );

    const options =
      includePrivateFields === undefined ? undefined : { includePrivateFields };

    return this.cardBuilder.build(org, agentSlug, options);
  }

  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks')
  @UseGuards(JwtAuthGuard)
  async executeTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Body() body: any,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ): Promise<TaskResponseDto | JsonRpcSuccessEnvelope | JsonRpcErrorEnvelope> {
    // CRITICAL: Log that this controller method was called
    console.log(`🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`);
    this.logger.log(`🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`);
    
    const org = orgSlug === 'global' ? null : orgSlug;
    
    // ADAPTER: Transform frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
    const adaptedBody = this.adaptFrontendRequest(body);
    
    const { dto, jsonrpc } = await this.normalizeTaskRequest(adaptedBody);
    
    try {
      // Get the agent record to use the correct agent_type
      const agentRecord = await this.agentRegistry.getAgent(org, agentSlug);
      if (!agentRecord) {
        throw new Error(`Agent ${agentSlug} not found in organization ${org || 'global'}`);
      }

      this.logger.debug(`🔍 [Agent2AgentController] Creating task for user ${currentUser.id}, agent ${agentSlug}`);
      this.logger.debug(`🔍 Normalized DTO: ${JSON.stringify({ mode: dto.mode, conversationId: dto.conversationId })}`);
      this.logger.debug(`🔍 Agent record: ${JSON.stringify({ agentType: agentRecord.agent_type, slug: agentRecord.slug })}`);
      
      // Extract data from normalized DTO (which came from adaptedBody)
      const taskIdFromPayload = dto.payload?.taskId || body.id; // JSON-RPC id or payload.taskId
      const llmSelectionFromPayload = dto.payload?.llmSelection;
      const conversationHistoryFromMessages = dto.messages?.map(msg => ({
        role: msg.role,
        content: String(msg.content || ''),
        timestamp: new Date().toISOString(),
      })) || [];
      
      // Use namespace as agentType for database agents (clean architecture separation)
      const effectiveAgentType = (org || 'global') as AgentType;
      
      // CRITICAL: Persist task AND conversation to database BEFORE execution
      // (like DynamicAgentsController does)
      // TasksService.createTask automatically handles conversation creation/retrieval
      this.logger.debug(`📝 Attempting to create task in database with:`, {
        userId: currentUser.id,
        agentName: agentSlug,
        originalAgentType: agentRecord.agent_type,
        effectiveAgentType,
        orgSlug: org,
        method: dto.mode,
        conversationId: dto.conversationId,
        taskId: taskIdFromPayload,
      });
      
      this.logger.debug(`🚨 [Agent2AgentController] CALLING tasksService.createTask with effectiveAgentType: "${effectiveAgentType}"`);
      
      const task = await this.tasksService.createTask(
        currentUser.id,
        agentSlug, // agentName
        effectiveAgentType, // Use namespace as agent_type for database agents
        {
          method: dto.mode, // Use the normalized mode from DTO
          prompt: dto.userMessage || '',
          conversationId: dto.conversationId, // Will be validated/created by TasksService
          taskId: taskIdFromPayload,
          metadata: dto.metadata || {},
          llmSelection: llmSelectionFromPayload,
          conversationHistory: conversationHistoryFromMessages,
        },
      );

      this.logger.debug(`✅ Task ${task.id} and conversation ${task.agentConversationId} persisted to database`);

      // Execute the agent with the persisted task ID
      const result = await this.gateway.execute(org, agentSlug, dto);

      // Check if task completion was already handled by the agent (to avoid duplicate completion)
      const taskAlreadyHandled = result && (
        ((result as any).taskCompletionHandled === true) ||
        ((result as any).metadata && (result as any).metadata.taskCompletionHandled === true)
      );

      if (!taskAlreadyHandled) {
        // Create deliverable using Agent2Agent deliverable service
        const deliverableId = await this.agentDeliverablesService.createFromTaskResult(
          result,
          currentUser.id,
          task.id,
          agentSlug,
          dto.conversationId || '',
          dto.mode,
        );

        // Attach deliverable ID to result if created
        if (deliverableId && typeof result === 'object' && result !== null) {
          (result as any).deliverableId = deliverableId;
        }

        // Update task with result
        await this.taskStatusService.completeTask(
          task.id,
          currentUser.id,
          result,
        );
      } else {
        this.logger.debug(`🎯 [Agent2AgentController] Task ${task.id} was already completed by agent instance – skipping duplicate completion call`);
      }

      this.logRequest({
        org,
        agentSlug,
        dto,
        jsonrpc,
        status: 'success',
        error: null,
      });

      if (jsonrpc) {
        return {
          jsonrpc: '2.0',
          id: jsonrpc.id ?? null,
          result,
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`❌ [Agent2AgentController] Error executing task:`, error);
      
      if (!jsonrpc) {
        this.logRequest({
          org,
          agentSlug,
          dto,
          jsonrpc: null,
          status: 'error',
          error,
        });
        throw error;
      }

      this.logRequest({
        org,
        agentSlug,
        dto,
        jsonrpc,
        status: 'error',
        error,
      });

      return this.buildJsonRpcError(jsonrpc.id ?? null, error);
    }
  }

  /**
   * Minimal health endpoint for A2A agents
   * Route: GET /agent-to-agent/:orgSlug/:agentSlug/health
   * Public: returns a simple status payload without secrets
   */
  @Get('agent-to-agent/:orgSlug/:agentSlug/health')
  async getHealth(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
  ) {
    const org = orgSlug === 'global' ? null : orgSlug;
    // We do not fetch agent details here to avoid side effects; this is a simple liveness check
    return {
      ok: true,
      service: 'agent-to-agent',
      organization: org ?? 'global',
      agent: agentSlug,
      timestamp: new Date().toISOString(),
    };
  }


  /**
   * Adapt frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
   * Frontend sends: { method, prompt, conversationHistory, llmSelection, ... }
   * Backend expects: { mode, userMessage, messages, payload, metadata, ... }
   */
  private adaptFrontendRequest(body: any): any {
    // Check if it's JSON-RPC format (frontend now sends this for database agents)
    if (body.jsonrpc === '2.0') {
      this.logger.debug('📥 Request is JSON-RPC 2.0 format - passing through to normalizeTaskRequest');
      return body; // Let normalizeTaskRequest handle JSON-RPC
    }
    
    // If it already has 'mode' field, assume it's already in correct format
    if (body.mode) {
      this.logger.debug('📥 Request already in Agent2Agent format');
      return body;
    }

    this.logger.debug(`📥 Adapting frontend CreateTaskDto to Agent2Agent format: method=${body.method}`);
    
    // Transform frontend format to backend format
    const adapted: any = {
      // Map 'method' to 'mode' enum
      mode: body.method || 'converse',
      
      // Map 'prompt' to 'userMessage'
      userMessage: body.prompt,
      
      // Map 'conversationHistory' to 'messages'
      messages: body.conversationHistory?.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      
      // Pass through standard fields
      conversationId: body.conversationId,
      
      // Pack additional data into payload
      payload: {
        ...(body.params || {}),
        llmSelection: body.llmSelection,
        executionMode: body.executionMode,
        taskId: body.taskId,
        timeoutSeconds: body.timeoutSeconds,
      },
      
      // Preserve metadata
      metadata: body.metadata,
    };

    this.logger.debug(`✅ Adapted request: mode=${adapted.mode}, conversationId=${adapted.conversationId}`);
    
    return adapted;
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

  private buildJsonRpcError(id: any, error: unknown): JsonRpcErrorEnvelope {
    const { code, message, data } = this.mapExceptionToError(error);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {}),
      },
    };
  }

  private mapExceptionToError(error: unknown): {
    code: number;
    message: string;
    data?: any;
  } {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      const payload =
        typeof response === 'string'
          ? { message: response, statusCode: status }
          : response;

      return {
        code: this.statusToJsonRpcCode(status),
        message: this.extractMessage(payload) ?? error.message,
        data: payload,
      };
    }

    const fallbackMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return {
      code: -32603,
      message: fallbackMessage || 'Internal server error',
    };
  }

  private statusToJsonRpcCode(status: number): number {
    switch (status) {
      case 400:
      case 422:
        return -32602; // Invalid params
      case 401:
        return -32001; // Unauthorized
      case 403:
        return -32003; // Forbidden
      case 404:
        return -32004; // Not found
      case 409:
        return -32009; // Conflict
      case 429:
        return -32042; // Rate limited
      case 500:
        return -32603; // Internal error
      default:
        if (status >= 500) {
          return -32603;
        }
        return -32000; // Server error (generic)
    }
  }

  private extractMessage(payload: any): string | null {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string') {
      return payload;
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (Array.isArray(payload.message) && payload.message.length) {
      return payload.message.join(', ');
    }
    return null;
  }

  private logRequest(params: {
    org: string | null;
    agentSlug: string;
    dto: TaskRequestDto;
    jsonrpc: NormalizedTaskRequest['jsonrpc'] | null | undefined;
    status: 'success' | 'error';
    error: unknown;
  }) {
    const { org, agentSlug, dto, jsonrpc, status, error } = params;
    const base = {
      organization: org ?? 'global',
      agent: agentSlug,
      mode: dto.mode,
      conversationId: dto.conversationId ?? null,
      planId: dto.planId ?? null,
      orchestrationRunId: dto.orchestrationRunId ?? null,
      jsonrpc: jsonrpc
        ? {
            id: jsonrpc.id ?? null,
            method: jsonrpc.method ?? null,
          }
        : null,
    };

    if (status === 'success') {
      this.logger.log({
        ...base,
        status,
      });
      return;
    }

    const mapped = this.mapExceptionToError(error);

    this.logger.warn({
      ...base,
      status,
      error: {
        code: mapped.code,
        message: mapped.message,
      },
    });
  }

  private resolveBooleanQuery(
    ...candidates: Array<string | undefined>
  ): boolean | undefined {
    for (const value of candidates) {
      if (value === undefined) {
        continue;
      }
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  }

  /**
   * Fetch database agents filtered by namespaces
   */
  private async fetchDatabaseAgents(
    namespaces?: string[],
  ): Promise<AgentRecord[]> {
    if (namespaces && namespaces.length > 0) {
      const normalized = namespaces
        .map((ns) => (ns && ns.trim().length ? ns.trim() : null))
        .map((ns) => (ns === 'global' ? null : ns));
      return this.agentRegistry.listAgentsForNamespaces(normalized);
    }

    return this.agentRegistry.listAllAgents();
  }

  /**
   * Build hierarchy structure from database agent records
   */
  private buildDatabaseHierarchy(records: AgentRecord[]): any[] {
    if (!records.length) {
      return [];
    }

    // Group agents by organization
    const grouped = new Map<string | null, AgentRecord[]>();
    for (const record of records) {
      const key = record.organization_slug ?? null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }

    const createNode = (
      record: AgentRecord,
      children: any[] = [],
    ): any => {
      const isTool = record.config?.agent_category === 'tool';
      const isOrchestrator =
        record.agent_type === 'orchestrator' || record.config?.orchestrator;
      const category = isTool
        ? 'tool'
        : isOrchestrator
        ? 'orchestrator'
        : record.agent_type ?? 'specialist';

      return {
        id: record.id,
        name: record.slug,
        displayName: record.display_name,
        type: isTool ? 'tool' : record.agent_type ?? 'specialist',
        path: `db://${record.organization_slug ?? 'global'}/${record.slug}`,
        relativePath: record.slug,
        namespace: record.organization_slug ?? undefined,
        namespacedPath: `db://${record.organization_slug ?? 'global'}/${record.slug}`,
        metadata: {
          description: record.description ?? undefined,
          version: record.version ?? undefined,
          category,
          agentType: record.agent_type,
          source: 'database',
          namespace: record.organization_slug ?? null,
          isTool: isTool || undefined,
          isOrchestrator: isOrchestrator || undefined,
          // Expose execution fields from config for frontend
          execution_profile: record.config?.execution_profile ?? undefined,
          execution_capabilities: record.config?.execution_capabilities ?? undefined,
        },
        children,
      };
    };

    const roots: any[] = [];

    grouped.forEach((agents, namespaceKey) => {
      // Group agents by logical hierarchy based on naming patterns
      const orchestrators = agents.filter(
        (a) => a.agent_type === 'orchestrator' || a.config?.orchestrator,
      );
      const nonOrchestrators = agents.filter(
        (a) => a.agent_type !== 'orchestrator' && !a.config?.orchestrator,
      );

      // Create orchestrator nodes with their related children
      orchestrators.forEach((orc) => {
        // Find children that belong to this orchestrator based on naming pattern
        const orcPrefix = orc.slug.replace('-orchestrator', '').replace('_orchestrator', '');
        const children = nonOrchestrators
          .filter((agent) => {
            // Match agents with same prefix (e.g., "hiverarchy-*" for "hiverarchy-orchestrator")
            return agent.slug.startsWith(orcPrefix + '-') || agent.slug.startsWith(orcPrefix + '_');
          })
          .map((child) => createNode(child));

        roots.push(createNode(orc, children));
      });

      // Add standalone agents (not belonging to any orchestrator)
      const standaloneAgents = nonOrchestrators.filter((agent) => {
        // Check if this agent belongs to any orchestrator
        return !orchestrators.some((orc) => {
          const orcPrefix = orc.slug.replace('-orchestrator', '').replace('_orchestrator', '');
          return agent.slug.startsWith(orcPrefix + '-') || agent.slug.startsWith(orcPrefix + '_');
        });
      });

      standaloneAgents.forEach((agent) => {
        roots.push(createNode(agent, []));
      });
    });

    return roots;
  }
}
