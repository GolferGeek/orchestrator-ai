import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  Agent2AgentTasksService,
  LlmSelection,
  ConversationMessage,
} from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AgentTaskMode,
  NormalizedTaskRequestDto,
} from './dto/task-request.dto';
import { AgentRegistryService } from '../agent-platform/services/agent-registry.service';
import { AgentRecord } from '../agent-platform/interfaces/agent.interface';
import { Public } from '../auth/decorators/public.decorator';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import { SupabaseService } from '../supabase/supabase.service';
import { load as yamlLoad } from 'js-yaml';
import {
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
} from '@orchestrator-ai/transport-types';
import { Response, Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AgentStreamChunkEvent,
  AgentStreamCompleteEvent,
  AgentStreamErrorEvent,
} from '../agent-platform/services/agent-runtime-stream.service';
import {
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
  SSEEvent,
} from '@orchestrator-ai/transport-types';
import { CreateStreamTokenDto } from './dto/create-stream-token.dto';
import {
  StreamTokenClaims,
  StreamTokenService,
} from '../auth/services/stream-token.service';
import { TaskStatusService } from './tasks/task-status.service';
import { TasksService } from './tasks/tasks.service';
import { DeliverablesService } from './deliverables/deliverables.service';
import {
  DeliverableFormat,
  DeliverableVersionCreationType,
} from './deliverables/dto';

interface NormalizedTaskRequest {
  dto: NormalizedTaskRequestDto;
  jsonrpc?: {
    id: string | number | null;
    method?: string | null;
  };
}

/**
 * Database record type for conversations table (organization_slug only)
 */
interface ConversationOrgRecord {
  organization_slug: string;
}

interface TaskExecutionResult {
  taskCompletionHandled?: boolean;
  metadata?: {
    taskCompletionHandled?: boolean;
    [key: string]: unknown;
  };
  deliverableId?: string;
  [key: string]: unknown;
}

interface RequestWithStreamData extends Request {
  sanitizedUrl?: string;
  streamTokenClaims?: StreamTokenClaims;
}

interface FrontendTaskRequest {
  jsonrpc?: string;
  mode?: string;
  method?: string;
  prompt?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  conversationId?: string;
  params?: Record<string, unknown>;
  llmSelection?: LlmSelection;
  executionMode?: string;
  taskId?: string;
  timeoutSeconds?: number;
  metadata?: Record<string, unknown>;
  id?: string;
  [key: string]: unknown;
}

// Use shared protocol types
type JsonRpcSuccessEnvelope = A2ATaskSuccessResponse;
type JsonRpcErrorEnvelope = A2ATaskErrorResponse;

type AgentTaskRecord = NonNullable<
  Awaited<ReturnType<Agent2AgentTasksService['getTaskById']>>
>;

@Controller()
export class Agent2AgentController {
  constructor(
    private readonly cardBuilder: AgentCardBuilderService,
    private readonly gateway: AgentExecutionGateway,
    private readonly tasksService: Agent2AgentTasksService,
    private readonly agentTaskStatusService: Agent2AgentTaskStatusService,
    private readonly taskStatusCache: TaskStatusService,
    private readonly agentConversationsService: Agent2AgentConversationsService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentDeliverablesService: Agent2AgentDeliverablesService,
    private readonly supabaseService: SupabaseService,
    private readonly streamTokenService: StreamTokenService,
    private readonly eventEmitter: EventEmitter2,
    private readonly deliverablesService: DeliverablesService,
    private readonly taskUpdateService: TasksService,
  ) {}

  private readonly logger = new Logger(Agent2AgentController.name);

  /**
   * Create conversation for database agents
   * Route: POST /agent-to-agent/conversations
   */
  @Post('agent-to-agent/conversations')
  @UseGuards(JwtAuthGuard)
  async createConversation(
    @Body()
    body: {
      agentName: string;
      namespace: string;
      conversationId?: string;
      metadata?: Record<string, unknown>;
    },
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ) {
    const conversation =
      await this.agentConversationsService.createConversation(
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
    @Body() body: FrontendTaskRequest,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: RequestWithStreamData,
  ): Promise<TaskResponseDto | JsonRpcSuccessEnvelope | JsonRpcErrorEnvelope> {
    // CRITICAL: Log that this controller method was called
    console.log(
      `🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`,
    );
    this.logger.log(
      `🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`,
    );

    let org = this.normalizeOrgSlug(orgSlug);

    // ADAPTER: Transform frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
    const adaptedBody = this.adaptFrontendRequest(body);

    const { dto, jsonrpc } = await this.normalizeTaskRequest(adaptedBody);

    // If conversation exists, use its organization_slug for routing
    // This handles cases where frontend sends 'global' but conversation is actually in a specific org
    if (dto.conversationId) {
      try {
        const { data: result } = await this.supabaseService
          .getAnonClient()
          .from('conversations')
          .select('organization_slug')
          .eq('id', dto.conversationId)
          .single();

        const conversation = result as ConversationOrgRecord | null;
        if (conversation?.organization_slug) {
          this.logger.debug(
            `🔍 Using organization_slug from conversation: ${conversation.organization_slug}`,
          );
          org = conversation.organization_slug;
        }
      } catch (error) {
        // Conversation doesn't exist yet, will be created with org from URL
        this.logger.debug(
          `Conversation ${dto.conversationId} not found, will create with org: ${org}`,
          {
            cause: error instanceof Error ? error.message : error,
          },
        );
      }
    }

    try {
      // Get the agent record to use the correct agent_type
      const agentRecord = await this.agentRegistry.getAgent(org, agentSlug);
      if (!agentRecord) {
        throw new Error(
          `Agent ${agentSlug} not found in organization ${org || 'global'}`,
        );
      }

      this.logger.debug(
        `🔍 [Agent2AgentController] Creating task for user ${currentUser.id}, agent ${agentSlug}`,
      );
      this.logger.debug(
        `🔍 Normalized DTO: ${JSON.stringify({ mode: dto.mode, conversationId: dto.conversationId })}`,
      );
      this.logger.debug(
        `🔍 Agent record: ${JSON.stringify({ agentType: agentRecord.agent_type, slug: agentRecord.slug })}`,
      );

      // Extract data from normalized DTO (which came from adaptedBody)
      const taskIdFromPayload =
        (typeof dto.payload?.taskId === 'string'
          ? dto.payload.taskId
          : undefined) || body.id; // JSON-RPC id or payload.taskId

      // Extract LLM selection from payload
      // Frontend sends it in payload.config.provider/model format (JSON-RPC)
      // Legacy format was payload.llmSelection
      let llmSelectionFromPayload: LlmSelection | undefined;
      if (dto.payload?.config && typeof dto.payload.config === 'object') {
        const config = dto.payload.config as {
          provider?: string;
          model?: string;
          temperature?: number;
          maxTokens?: number;
        };
        if (config.provider && config.model) {
          // LlmSelection type uses 'provider' and 'model' fields (not providerName/modelName)
          llmSelectionFromPayload = {
            provider: config.provider,
            model: config.model,
            ...(config.temperature !== undefined && {
              temperature: config.temperature,
            }),
            ...(config.maxTokens !== undefined && {
              maxTokens: config.maxTokens,
            }),
          };
        }
      } else if (dto.payload?.llmSelection) {
        // Fallback to legacy format
        llmSelectionFromPayload = dto.payload.llmSelection as LlmSelection;
      }

      this.logger.debug(
        `🔍 [Agent2AgentController] llmSelectionFromPayload: ${JSON.stringify(llmSelectionFromPayload)}`,
      );
      const conversationHistoryFromMessages: ConversationMessage[] =
        dto.messages?.map((msg) => {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content && typeof msg.content === 'object'
                ? JSON.stringify(msg.content)
                : '';
          return {
            role: msg.role,
            content,
            timestamp: new Date().toISOString(),
          };
        }) || [];

      // Use namespace as agentType for database agents (clean architecture separation)
      const effectiveAgentType = org || 'global';

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

      this.logger.debug(
        `🚨 [Agent2AgentController] CALLING tasksService.createTask with effectiveAgentType: "${effectiveAgentType}"`,
      );

      const task = await this.tasksService.createTask(
        currentUser.id,
        agentSlug, // agentName
        effectiveAgentType, // Use namespace as agent_type for database agents
        {
          method: dto.mode, // Use the normalized mode from DTO (guaranteed to be set)
          prompt: dto.userMessage || '',
          conversationId: dto.conversationId, // Will be validated/created by TasksService
          taskId: taskIdFromPayload,
          metadata: dto.metadata || {},
          llmSelection: llmSelectionFromPayload,
          conversationHistory: conversationHistoryFromMessages,
        },
      );

      this.logger.debug(
        `✅ Task ${task.id} and conversation ${task.agentConversationId} persisted to database`,
      );

      // Add userId and taskId to metadata for mode router (needed for plans/deliverables services)
      dto.metadata = {
        ...dto.metadata,
        userId: currentUser.id,
        createdBy: currentUser.id,
        taskId: task.id,
      };

      // Also add taskId to payload for backward compatibility
      if (dto.payload) {
        dto.payload.taskId = task.id;
      }

      // Mark task as running before execution starts
      await this.agentTaskStatusService.updateTaskStatus(
        task.id,
        currentUser.id,
        { status: 'running' },
      );

      // Execute the agent with the persisted task ID
      const result = await this.gateway.execute(org, agentSlug, dto);
      this.attachStreamMetadata(result, {
        request,
        organizationSlug: org,
        agentSlug,
        taskId: task.id,
        conversationId: task.agentConversationId ?? null,
      });

      // Check if task completion was already handled by the agent (to avoid duplicate completion)
      const typedResult = result as unknown as TaskExecutionResult;
      const taskAlreadyHandled =
        result &&
        (typedResult.taskCompletionHandled === true ||
          (typedResult.metadata &&
            typedResult.metadata.taskCompletionHandled === true));

      if (!taskAlreadyHandled) {
        // Create deliverable using Agent2Agent deliverable service
        const deliverableId =
          await this.agentDeliverablesService.createFromTaskResult(
            result,
            currentUser.id,
            task.id,
            agentSlug,
            dto.conversationId || '',
            dto.mode,
          );

        // Attach deliverable ID to result if created
        if (deliverableId && typeof result === 'object' && result !== null) {
          typedResult.deliverableId = deliverableId;
        }

        // Update task with result
        await this.agentTaskStatusService.completeTask(
          task.id,
          currentUser.id,
          result,
        );
      } else {
        this.logger.debug(
          `🎯 [Agent2AgentController] Task ${task.id} was already completed by agent instance – skipping duplicate completion call`,
        );
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
        // Return JSON-RPC 2.0 success response
        return {
          jsonrpc: '2.0',
          id: jsonrpc.id ?? null,
          result,
        } as A2ATaskSuccessResponse;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `❌ [Agent2AgentController] Error executing task:`,
        error,
      );

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
   * Completion callback endpoint for async agents (e.g., n8n workflows)
   * This is NOT authenticated - n8n sends results here with taskId/userId in body
   * Route: POST /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/complete
   */
  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/complete')
  @HttpCode(200)
  async handleTaskCompletion(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      conversationId: string;
      status: 'success' | 'failed';
      results?: unknown;
      error?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `📥 Completion callback received for task ${taskId} from agent ${agentSlug} with status: ${body.status}`,
    );

    try {
      const org = this.normalizeOrgSlug(orgSlug);

      // Update task status
      if (body.status === 'failed') {
        await this.taskUpdateService.updateTask(taskId, body.userId, {
          status: 'failed',
          progress: 0,
          progressMessage: body.error || 'Task failed',
        });

        // Emit failure event for async agents waiting for completion
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          error: body.error || 'Task failed',
        });

        return {
          success: true,
          message: 'Task marked as failed',
        };
      }

      // Success case - update task and create deliverable
      // Extract deliverable type from results if available
      const resultsObj = body.results as
        | { type?: string; payload?: { type?: string } }
        | undefined;
      const deliverableType =
        resultsObj?.type || resultsObj?.payload?.type || null;

      await this.taskUpdateService.updateTask(taskId, body.userId, {
        status: 'completed',
        progress: 100,
        progressMessage: 'Task completed successfully',
        response: body.results ? JSON.stringify(body.results) : undefined,
        ...(deliverableType && { deliverableType }),
      });

      // Create deliverable with results
      if (body.results && body.conversationId) {
        // Format results based on agent type
        const formattedContent = this.formatCompletionResults(
          agentSlug,
          body.results,
        );

        await this.deliverablesService.create(
          {
            title: `Results from ${agentSlug}`,
            conversationId: body.conversationId,
            agentName: agentSlug,
            initialContent: formattedContent,
            initialFormat: DeliverableFormat.MARKDOWN,
            initialCreationType:
              DeliverableVersionCreationType.CONVERSATION_TASK,
            initialTaskId: taskId,
            initialMetadata: {
              completedAt: new Date().toISOString(),
              agentSlug,
              organizationSlug: org,
            },
          },
          body.userId,
        );

        this.logger.log(`✅ Deliverable created for completed task ${taskId}`);

        // Emit event for async agents waiting for completion
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          deliverable: formattedContent,
        });
      }

      return {
        success: true,
        message: 'Task completed and deliverable created',
      };
    } catch (error) {
      this.logger.error(
        `Failed to handle completion callback for task ${taskId}:`,
        error,
      );
      throw error;
    }
  }

  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream-token')
  @UseGuards(JwtAuthGuard)
  async createStreamToken(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Body() body: CreateStreamTokenDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: RequestWithStreamData,
  ) {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);
    const sanitizedUrl =
      request.sanitizedUrl ??
      this.streamTokenService.stripTokenFromUrl(
        request.originalUrl || request.url,
      );

    const task = await this.ensureTaskOwnership(taskId, currentUser.id);
    this.assertTaskContext(task, agentSlug, organizationSlug);

    const { token, expiresAt } = this.streamTokenService.issueToken({
      user: currentUser,
      taskId,
      agentSlug,
      organizationSlug,
      streamId: body.streamId,
      conversationId: task.agentConversationId ?? null,
    });

    this.logger.debug('Issued stream token', {
      userId: currentUser.id,
      taskId,
      agentSlug,
      organizationSlug,
      streamId: body.streamId ?? null,
      url: sanitizedUrl,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Get('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream')
  @UseGuards(JwtAuthGuard)
  async streamAgentTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Query('streamId') streamIdParam: string | undefined,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: RequestWithStreamData,
    @Res() response: Response,
  ): Promise<void> {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);
    const claims = request.streamTokenClaims;

    if (claims) {
      if (
        claims.taskId !== taskId ||
        claims.agentSlug !== agentSlug ||
        claims.organizationSlug !== organizationSlug
      ) {
        throw new UnauthorizedException('Stream token does not match request');
      }
    }

    const task = await this.ensureTaskOwnership(taskId, currentUser.id);
    this.assertTaskContext(task, agentSlug, organizationSlug);

    const streamId = streamIdParam || claims?.streamId;
    const allowedStreamId = claims?.streamId;
    const expectedConversationId = task.agentConversationId ?? null;

    const sanitizedUrl =
      request.sanitizedUrl ??
      this.streamTokenService.stripTokenFromUrl(
        request.originalUrl || request.url,
      );

    this.logger.debug('Opening SSE stream', {
      userId: currentUser.id,
      taskId,
      agentSlug,
      organizationSlug,
      streamId: streamId ?? null,
      url: sanitizedUrl,
    });

    let streamSessionId: string | null = null;
    try {
      streamSessionId = this.taskStatusCache.registerStreamSession({
        taskId,
        userId: currentUser.id,
        agentSlug,
        organizationSlug,
        streamId: streamId ?? null,
        conversationId: expectedConversationId,
      });
    } catch (error) {
      this.logger.warn('Failed to register stream session', {
        taskId,
        streamId: streamId ?? null,
        error: (error as Error)?.message,
      });
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    response.flushHeaders?.();
    response.write(': connected\n\n');

    const keepAlive = setInterval(() => {
      response.write(': keepalive\n\n');
    }, 15000);

    let streamActive = true;

    const cleanup = (cleanupReason?: string) => {
      if (!streamActive) {
        return;
      }
      streamActive = false;
      clearInterval(keepAlive);
      this.eventEmitter.off('agent.stream.chunk', chunkListener);
      this.eventEmitter.off('agent.stream.complete', completeListener);
      this.eventEmitter.off('agent.stream.error', errorListener);
      if (streamSessionId) {
        this.taskStatusCache.unregisterStreamSession(
          streamSessionId,
          cleanupReason ?? 'connection_cleanup',
        );
        streamSessionId = null;
      }
    };

    const endStream = (reason: string) => {
      if (streamActive) {
        this.logger.debug('Closing SSE stream', {
          userId: currentUser.id,
          taskId,
          reason,
        });
      }
      cleanup(reason);
      if (!response.writableEnded) {
        response.end();
      }
    };

    const chunkListener = (event: AgentStreamChunkEvent) => {
      if (
        !this.matchesStreamEvent(event, {
          agentSlug,
          organizationSlug,
          streamId,
          allowedStreamId,
          conversationId: expectedConversationId,
        })
      ) {
        return;
      }
      this.writeSseEvent(response, this.toChunkSseEvent(event));
    };

    const completeListener = (event: AgentStreamCompleteEvent) => {
      if (
        !this.matchesStreamEvent(event, {
          agentSlug,
          organizationSlug,
          streamId,
          allowedStreamId,
          conversationId: expectedConversationId,
        })
      ) {
        return;
      }
      this.writeSseEvent(response, this.toCompleteSseEvent(event));
      endStream('complete');
    };

    const errorListener = (event: AgentStreamErrorEvent) => {
      if (
        !this.matchesStreamEvent(event, {
          agentSlug,
          organizationSlug,
          streamId,
          allowedStreamId,
          conversationId: expectedConversationId,
        })
      ) {
        return;
      }
      this.writeSseEvent(response, this.toErrorSseEvent(event));
      endStream('error');
    };

    this.eventEmitter.on('agent.stream.chunk', chunkListener);
    this.eventEmitter.on('agent.stream.complete', completeListener);
    this.eventEmitter.on('agent.stream.error', errorListener);

    request.on('close', () => endStream('client_closed'));
    request.on('error', () => endStream('client_error'));
    response.on('close', () => endStream('response_closed'));
    response.on('error', () => endStream('response_error'));
  }

  /**
   * Minimal health endpoint for A2A agents
   * Route: GET /agent-to-agent/:orgSlug/:agentSlug/health
   * Public: returns a simple status payload without secrets
   */
  private normalizeOrgSlug(orgSlug: string): string {
    // 'global' is now an explicit organization slug for shared agents
    // No longer converting to null
    return orgSlug || 'global';
  }

  private attachStreamMetadata(
    result: TaskResponseDto,
    params: {
      request: Request;
      organizationSlug: string;
      agentSlug: string;
      taskId: string;
      conversationId: string | null;
    },
  ): void {
    if (!result || typeof result !== 'object' || !result.payload) {
      return;
    }

    const payload = result.payload;
    const metadata =
      (payload.metadata as Record<string, unknown> | undefined) ?? {};

    payload.metadata = metadata;

    const streamId = this.extractStreamId(result);
    const basePath = `/agent-to-agent/${params.organizationSlug}/${params.agentSlug}/tasks/${params.taskId}`;
    const streamPath = `${basePath}/stream`;
    const tokenPath = `${basePath}/stream-token`;
    const baseUrl = this.buildBaseUrl(params.request);
    const streamUrl = baseUrl ? `${baseUrl}${streamPath}` : streamPath;
    const tokenUrl = baseUrl ? `${baseUrl}${tokenPath}` : tokenPath;

    metadata.streamEndpoint = streamPath;
    metadata.streamTokenEndpoint = tokenPath;

    const existingStreaming =
      (metadata.streaming as Record<string, unknown> | undefined) ?? {};

    const streamingMetadata: Record<string, unknown> = {
      ...existingStreaming,
      streamEndpoint: streamPath,
      streamTokenEndpoint: tokenPath,
      streamUrl,
      streamTokenUrl: tokenUrl,
    };

    if (streamId) {
      streamingMetadata.streamId = streamId;
    }
    if (params.conversationId) {
      streamingMetadata.conversationId = params.conversationId;
    }

    metadata.streaming = streamingMetadata;
  }

  private extractStreamId(result: TaskResponseDto): string | undefined {
    const metadata = result.payload?.metadata as
      | Record<string, unknown>
      | undefined;
    if (!metadata) {
      return undefined;
    }

    const streaming = metadata.streaming as { streamId?: unknown } | undefined;
    const candidates: Array<unknown> = [metadata.streamId, streaming?.streamId];

    for (const candidate of candidates) {
      const value = this.asString(candidate);
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private buildBaseUrl(request: Request): string | null {
    const host =
      request.get('x-forwarded-host') ??
      request.get('host') ??
      request.headers['host'];

    if (!host || typeof host !== 'string') {
      return null;
    }

    const proto =
      request.get('x-forwarded-proto') ??
      request.protocol ??
      (request.secure ? 'https' : 'http');

    return `${proto}://${host}`;
  }

  private async ensureTaskOwnership(
    taskId: string,
    userId: string,
  ): Promise<AgentTaskRecord> {
    const task = await this.tasksService.getTaskById(taskId, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private assertTaskContext(
    task: AgentTaskRecord,
    agentSlug: string,
    organizationSlug: string,
  ): void {
    if (task.agentName !== agentSlug) {
      throw new UnauthorizedException(
        'Task does not belong to the requested agent',
      );
    }

    // Normalize task namespace: null → 'global', empty → 'global'
    const taskOrg =
      !task.namespace || task.namespace === '' ? 'global' : task.namespace;

    if (taskOrg !== organizationSlug) {
      throw new UnauthorizedException(
        'Task does not belong to the requested organization',
      );
    }
  }

  private matchesStreamEvent(
    event:
      | AgentStreamChunkEvent
      | AgentStreamCompleteEvent
      | AgentStreamErrorEvent,
    filters: {
      agentSlug: string;
      organizationSlug: string;
      streamId?: string;
      allowedStreamId?: string;
      conversationId?: string | null;
    },
  ): boolean {
    if (event.agentSlug !== filters.agentSlug) {
      return false;
    }
    // Normalize: null or undefined → 'global'
    const eventOrg = event.organizationSlug || 'global';
    if (eventOrg !== filters.organizationSlug) {
      return false;
    }

    const candidateStreamIds = [
      filters.streamId,
      filters.allowedStreamId,
    ].filter((id): id is string => Boolean(id));

    if (candidateStreamIds.length > 0) {
      return candidateStreamIds.includes(event.streamId);
    }

    if (filters.conversationId) {
      return event.conversationId === filters.conversationId;
    }

    return true;
  }

  private toChunkSseEvent(
    event: AgentStreamChunkEvent,
  ): AgentStreamChunkSSEEvent {
    return {
      event: 'agent_stream_chunk',
      data: {
        streamId: event.streamId,
        conversationId: event.conversationId,
        organizationSlug: event.organizationSlug ?? null,
        agentSlug: event.agentSlug,
        mode: event.mode,
        timestamp: new Date().toISOString(),
        chunk: {
          type: event.chunk.type,
          content: event.chunk.content,
          metadata: event.chunk.metadata,
        },
      },
    };
  }

  private toCompleteSseEvent(
    event: AgentStreamCompleteEvent,
  ): AgentStreamCompleteSSEEvent {
    return {
      event: 'agent_stream_complete',
      data: {
        streamId: event.streamId,
        conversationId: event.conversationId,
        organizationSlug: event.organizationSlug ?? null,
        agentSlug: event.agentSlug,
        mode: event.mode,
        timestamp: new Date().toISOString(),
        type: 'complete',
      },
    };
  }

  private toErrorSseEvent(
    event: AgentStreamErrorEvent,
  ): AgentStreamErrorSSEEvent {
    return {
      event: 'agent_stream_error',
      data: {
        streamId: event.streamId,
        conversationId: event.conversationId,
        organizationSlug: event.organizationSlug ?? null,
        agentSlug: event.agentSlug,
        mode: event.mode,
        timestamp: new Date().toISOString(),
        type: 'error',
        error: event.error,
      },
    };
  }

  private writeSseEvent(response: Response, event: SSEEvent): void {
    response.write(`event: ${event.event}\n`);
    response.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }

  @Get('agent-to-agent/:orgSlug/:agentSlug/health')
  getHealth(
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
  private adaptFrontendRequest(body: FrontendTaskRequest): FrontendTaskRequest {
    // Check if it's JSON-RPC format (frontend now sends this for database agents)
    if (body.jsonrpc === '2.0') {
      this.logger.debug(
        '📥 Request is JSON-RPC 2.0 format - passing through to normalizeTaskRequest',
      );
      return body; // Let normalizeTaskRequest handle JSON-RPC
    }

    // If it already has 'mode' field, assume it's already in correct format
    if (body.mode) {
      this.logger.debug('📥 Request already in Agent2Agent format');
      return body;
    }

    this.logger.debug(
      `📥 Adapting frontend CreateTaskDto to Agent2Agent format: method=${body.method}`,
    );

    // Transform frontend format to backend format
    const adapted: FrontendTaskRequest = {
      // Map 'method' to 'mode' enum
      mode: body.method || 'converse',

      // Map 'prompt' to 'userMessage'
      userMessage: body.prompt,

      // Map 'conversationHistory' to 'messages'
      messages: body.conversationHistory?.map((msg) => ({
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

    this.logger.debug(
      `✅ Adapted request: mode=${adapted.mode}, conversationId=${adapted.conversationId}`,
    );

    return adapted;
  }

  private async normalizeTaskRequest(
    payload: unknown,
  ): Promise<NormalizedTaskRequest> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body must be a JSON object.');
    }

    const typedPayload = payload as {
      jsonrpc?: unknown;
      params?: unknown;
      method?: unknown;
      mode?: unknown;
      id?: unknown;
    };

    const isJsonRpc =
      typeof typedPayload.jsonrpc === 'string' &&
      typedPayload.jsonrpc.length > 0;

    const candidateSource = isJsonRpc
      ? (typedPayload.params ?? {})
      : typedPayload;
    const candidate = { ...(candidateSource as Record<string, unknown>) };

    if (
      isJsonRpc &&
      !(candidate as Record<string, unknown>).mode &&
      typeof typedPayload.method === 'string'
    ) {
      const mapped = this.mapMethodToMode(typedPayload.method);
      if (mapped) {
        (candidate as Record<string, unknown>).mode = mapped;
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

    // Ensure mode is always set (default to converse if not specified)
    if (!dto.mode) {
      dto.mode = AgentTaskMode.CONVERSE;
    }

    let jsonrpc: NormalizedTaskRequest['jsonrpc'] | undefined;

    if (isJsonRpc) {
      const jsonrpcContext: NonNullable<NormalizedTaskRequest['jsonrpc']> = {
        id:
          typeof typedPayload.id === 'string' ||
          typeof typedPayload.id === 'number'
            ? typedPayload.id
            : null,
        method:
          typeof typedPayload.method === 'string' ? typedPayload.method : null,
      };

      dto.metadata = {
        ...(dto.metadata ?? {}),
        jsonrpc: jsonrpcContext,
      };

      jsonrpc = jsonrpcContext;
    }

    return { dto: dto as NormalizedTaskRequestDto, jsonrpc };
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
      default:
        return undefined;
    }
  }

  private formatValidationErrors(
    errors: Array<{
      constraints?: Record<string, string>;
      children?: Array<{
        constraints?: Record<string, string>;
        children?: unknown[];
      }>;
    }>,
  ): string {
    const messages = errors
      .map((error) => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        if (error.children && error.children.length) {
          return this.formatValidationErrors(
            error.children as unknown as Array<{
              constraints?: Record<string, string>;
              children?: Array<{
                constraints?: Record<string, string>;
                children?: unknown[];
              }>;
            }>,
          );
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length
      ? messages.join('; ')
      : 'Invalid task request payload.';
  }

  private buildJsonRpcError(
    id: string | number | null,
    error: unknown,
  ): JsonRpcErrorEnvelope {
    const { code, message, data } = this.mapExceptionToError(error);

    // Return JSON-RPC 2.0 error response
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    } as A2ATaskErrorResponse;
  }

  private mapExceptionToError(error: unknown): {
    code: number;
    message: string;
    data?: unknown;
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

  private extractMessage(payload: unknown): string | null {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string') {
      return payload;
    }
    const typedPayload = payload as {
      message?: unknown;
    };
    if (typeof typedPayload.message === 'string') {
      return typedPayload.message;
    }
    if (Array.isArray(typedPayload.message) && typedPayload.message.length) {
      return typedPayload.message.join(', ');
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
  private buildDatabaseHierarchy(records: AgentRecord[]): unknown[] {
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
      children: unknown[] = [],
    ): unknown => {
      const isTool = record.config?.agent_category === 'tool';
      const isOrchestrator =
        record.agent_type === 'orchestrator' || record.config?.orchestrator;
      const category = isTool
        ? 'tool'
        : isOrchestrator
          ? 'orchestrator'
          : (record.agent_type ?? 'specialist');
      const executionModes = this.extractExecutionModes(record);

      return {
        id: record.id,
        name: record.slug,
        displayName: record.display_name,
        type: isTool ? 'tool' : (record.agent_type ?? 'specialist'),
        path: `db://${record.organization_slug ?? 'global'}/${record.slug}`,
        relativePath: record.slug,
        namespace: record.organization_slug ?? undefined,
        namespacedPath: `db://${record.organization_slug ?? 'global'}/${record.slug}`,
        execution_modes: executionModes.length > 0 ? executionModes : undefined,
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
          execution_capabilities:
            record.config?.execution_capabilities ?? undefined,
          execution_modes:
            executionModes.length > 0 ? executionModes : undefined,
        },
        children,
      };
    };

    const roots: unknown[] = [];

    grouped.forEach((agents, _namespaceKey) => {
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
        const orcPrefix = orc.slug
          .replace('-orchestrator', '')
          .replace('_orchestrator', '');
        const children = nonOrchestrators
          .filter((agent) => {
            // Match agents with same prefix (e.g., "hiverarchy-*" for "hiverarchy-orchestrator")
            return (
              agent.slug.startsWith(orcPrefix + '-') ||
              agent.slug.startsWith(orcPrefix + '_')
            );
          })
          .map((child) => createNode(child));

        roots.push(createNode(orc, children));
      });

      // Add standalone agents (not belonging to any orchestrator)
      const standaloneAgents = nonOrchestrators.filter((agent) => {
        // Check if this agent belongs to any orchestrator
        return !orchestrators.some((orc) => {
          const orcPrefix = orc.slug
            .replace('-orchestrator', '')
            .replace('_orchestrator', '');
          return (
            agent.slug.startsWith(orcPrefix + '-') ||
            agent.slug.startsWith(orcPrefix + '_')
          );
        });
      });

      standaloneAgents.forEach((agent) => {
        roots.push(createNode(agent, []));
      });
    });

    return roots;
  }

  private extractExecutionModes(record: AgentRecord): string[] {
    const modes = new Set<string>();

    const configExecutionModes =
      (record.config as { execution_modes?: unknown; executionModes?: unknown } | null)
        ?.execution_modes ??
      (record.config as { execution_modes?: unknown; executionModes?: unknown } | null)
        ?.executionModes;

    if (Array.isArray(configExecutionModes)) {
      for (const mode of configExecutionModes) {
        if (typeof mode === 'string' && mode.trim().length > 0) {
          modes.add(mode);
        }
      }
    }

    if (record.yaml) {
      try {
        const parsed =
          typeof record.yaml === 'string'
            ? (yamlLoad(record.yaml) as Record<string, any>)
            : (record.yaml as unknown as Record<string, any>);
        const yamlConfig = parsed?.configuration as
          | Record<string, any>
          | undefined;
        const yamlExecutionModes =
          yamlConfig?.execution_modes ?? yamlConfig?.executionModes;

        if (Array.isArray(yamlExecutionModes)) {
          for (const mode of yamlExecutionModes) {
            if (typeof mode === 'string' && mode.trim().length > 0) {
              modes.add(mode);
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to parse YAML for agent ${record.slug}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    if (modes.size === 0) {
      modes.add('immediate');
    }

    return Array.from(modes);
  }

  /**
   * Format completion results from async agents into markdown
   */
  private formatCompletionResults(agentSlug: string, results: unknown): string {
    // Handle marketing swarm specific format
    if (agentSlug.includes('marketing')) {
      const resultsObj = results as Record<string, unknown>;
      const sections: string[] = ['# Marketing Content Package\n'];

      if (resultsObj.webPost) {
        sections.push('## Web Post\n');
        sections.push(
          typeof resultsObj.webPost === 'string'
            ? resultsObj.webPost
            : JSON.stringify(resultsObj.webPost, null, 2),
        );
        sections.push('\n');
      }

      if (resultsObj.seoContent) {
        sections.push('## SEO Content\n');
        sections.push(
          typeof resultsObj.seoContent === 'string'
            ? resultsObj.seoContent
            : JSON.stringify(resultsObj.seoContent, null, 2),
        );
        sections.push('\n');
      }

      if (resultsObj.socialMedia) {
        sections.push('## Social Media\n');
        sections.push(
          typeof resultsObj.socialMedia === 'string'
            ? resultsObj.socialMedia
            : JSON.stringify(resultsObj.socialMedia, null, 2),
        );
        sections.push('\n');
      }

      return sections.join('\n');
    }

    // Default format - JSON
    return '```json\n' + JSON.stringify(results, null, 2) + '\n```';
  }
}
