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
import { Agent2AgentTasksService } from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgentTaskMode, NormalizedTaskRequestDto } from './dto/task-request.dto';
import { AgentType } from '@/agent2agent/types/agent-conversations.types';
import { AgentRegistryService } from '../agent-platform/services/agent-registry.service';
import { AgentRecord } from '../agent-platform/interfaces/agent-record.interface';
import { Public } from '../auth/decorators/public.decorator';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  JsonRpcErrorCode,
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

interface NormalizedTaskRequest {
  dto: NormalizedTaskRequestDto;
  jsonrpc?: {
    id: any;
    method?: string | null;
  };
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
    private readonly taskStatusService: Agent2AgentTaskStatusService,
    private readonly agentConversationsService: Agent2AgentConversationsService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentDeliverablesService: Agent2AgentDeliverablesService,
    private readonly supabaseService: SupabaseService,
    private readonly streamTokenService: StreamTokenService,
    private readonly eventEmitter: EventEmitter2,
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
    @Req() request: Request,
  ): Promise<TaskResponseDto | JsonRpcSuccessEnvelope | JsonRpcErrorEnvelope> {
    // CRITICAL: Log that this controller method was called
    console.log(`🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`);
    this.logger.log(`🚨🚨🚨 [Agent2AgentController.executeTask] METHOD CALLED - orgSlug: ${orgSlug}, agentSlug: ${agentSlug}`);
    
    let org = orgSlug === 'global' ? null : orgSlug;

    // ADAPTER: Transform frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
    const adaptedBody = this.adaptFrontendRequest(body);

    const { dto, jsonrpc } = await this.normalizeTaskRequest(adaptedBody);

    // If conversation exists, use its organization_slug for routing
    // This handles cases where frontend sends 'global' but conversation is actually in a specific org
    if (dto.conversationId) {
      try {
        const { data: conversation } = await this.supabaseService
          .getAnonClient()
          .from('conversations')
          .select('organization_slug')
          .eq('id', dto.conversationId)
          .single();

        if (conversation?.organization_slug) {
          this.logger.debug(`🔍 Using organization_slug from conversation: ${conversation.organization_slug}`);
          org = conversation.organization_slug;
        }
      } catch (error) {
        // Conversation doesn't exist yet, will be created with org from URL
        this.logger.debug(`Conversation ${dto.conversationId} not found, will create with org: ${org}`);
      }
    }

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
          method: dto.mode, // Use the normalized mode from DTO (guaranteed to be set)
          prompt: dto.userMessage || '',
          conversationId: dto.conversationId, // Will be validated/created by TasksService
          taskId: taskIdFromPayload,
          metadata: dto.metadata || {},
          llmSelection: llmSelectionFromPayload,
          conversationHistory: conversationHistoryFromMessages,
        },
      );

      this.logger.debug(`✅ Task ${task.id} and conversation ${task.agentConversationId} persisted to database`);

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
        // Return JSON-RPC 2.0 success response
        return {
          jsonrpc: '2.0',
          id: jsonrpc.id ?? null,
          result,
        } as A2ATaskSuccessResponse;
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

  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream-token')
  @UseGuards(JwtAuthGuard)
  async createStreamToken(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Body() body: CreateStreamTokenDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: Request,
  ) {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);
    const sanitizedUrl =
      (request as any).sanitizedUrl ??
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
      organizationSlug: organizationSlug ?? 'global',
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
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);
    const claims = (request as any).streamTokenClaims as
      | StreamTokenClaims
      | undefined;

    if (claims) {
      if (
        claims.taskId !== taskId ||
        claims.agentSlug !== agentSlug ||
        (claims.organizationSlug ?? null) !== organizationSlug
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
      (request as any).sanitizedUrl ??
      this.streamTokenService.stripTokenFromUrl(
        request.originalUrl || request.url,
      );

    console.log('📡 Opening SSE stream', {
      userId: currentUser.id,
      taskId,
      agentSlug,
      organizationSlug: organizationSlug ?? 'global',
      streamId: streamId ?? null,
      allowedStreamId: allowedStreamId ?? null,
      conversationId: expectedConversationId ?? null,
      url: sanitizedUrl,
    });

    this.logger.debug('Opening SSE stream', {
      userId: currentUser.id,
      taskId,
      agentSlug,
      organizationSlug: organizationSlug ?? 'global',
      streamId: streamId ?? null,
      url: sanitizedUrl,
    });

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

    const cleanup = () => {
      if (!streamActive) {
        return;
      }
      streamActive = false;
      clearInterval(keepAlive);
      this.eventEmitter.off('agent.stream.chunk', chunkListener);
      this.eventEmitter.off('agent.stream.complete', completeListener);
      this.eventEmitter.off('agent.stream.error', errorListener);
    };

    const endStream = (reason: string) => {
      if (streamActive) {
        this.logger.debug('Closing SSE stream', {
          userId: currentUser.id,
          taskId,
          reason,
        });
      }
      cleanup();
      if (!response.writableEnded) {
        response.end();
      }
    };

    const chunkListener = (event: AgentStreamChunkEvent) => {
      console.log('🎵 SSE chunk event received', { 
        eventAgentSlug: event.agentSlug,
        eventOrgSlug: event.organizationSlug,
        eventStreamId: event.streamId,
        filterAgentSlug: agentSlug,
        filterOrgSlug: organizationSlug,
        filterStreamId: streamId,
        allowedStreamId,
      });
      if (
        !this.matchesStreamEvent(event, {
          agentSlug,
          organizationSlug,
          streamId,
          allowedStreamId,
          conversationId: expectedConversationId,
        })
      ) {
        console.log('❌ Event did not match filters');
        return;
      }
      console.log('✅ Event matched, writing to stream');
      this.writeSseEvent(response, this.toChunkSseEvent(event));
    };

    const completeListener = (event: AgentStreamCompleteEvent) => {
      console.log('🏁 SSE complete event received', { 
        eventAgentSlug: event.agentSlug,
        eventOrgSlug: event.organizationSlug,
        eventStreamId: event.streamId,
      });
      if (
        !this.matchesStreamEvent(event, {
          agentSlug,
          organizationSlug,
          streamId,
          allowedStreamId,
          conversationId: expectedConversationId,
        })
      ) {
        console.log('❌ Complete event did not match filters');
        return;
      }
      console.log('✅ Complete event matched, writing to stream and ending');
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
  private normalizeOrgSlug(orgSlug: string): string | null {
    if (!orgSlug || orgSlug === 'global') {
      return null;
    }
    return orgSlug;
  }

  private attachStreamMetadata(
    result: TaskResponseDto,
    params: {
      request: Request;
      organizationSlug: string | null;
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
      (payload.metadata as Record<string, any> | undefined) ?? {};

    payload.metadata = metadata;

    const streamId = this.extractStreamId(result);
    const orgSegment = params.organizationSlug ?? 'global';
    const basePath = `/agent-to-agent/${orgSegment}/${params.agentSlug}/tasks/${params.taskId}`;
    const streamPath = `${basePath}/stream`;
    const tokenPath = `${basePath}/stream-token`;
    const baseUrl = this.buildBaseUrl(params.request);
    const streamUrl = baseUrl ? `${baseUrl}${streamPath}` : streamPath;
    const tokenUrl = baseUrl ? `${baseUrl}${tokenPath}` : tokenPath;

    metadata.streamEndpoint = streamPath;
    metadata.streamTokenEndpoint = tokenPath;

    const existingStreaming =
      (metadata.streaming as Record<string, any> | undefined) ?? {};

    const streamingMetadata: Record<string, any> = {
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
    const metadata = result.payload?.metadata as Record<string, any> | undefined;
    if (!metadata) {
      return undefined;
    }

    const candidates: Array<unknown> = [
      metadata.streamId,
      metadata.streaming?.streamId,
    ];

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
    organizationSlug: string | null,
  ): void {
    if (task.agentName !== agentSlug) {
      throw new UnauthorizedException(
        'Task does not belong to the requested agent',
      );
    }

    const taskNamespace =
      typeof task.namespace === 'string' && task.namespace.length
        ? task.namespace
        : null;
    const taskOrg =
      taskNamespace === 'global' || taskNamespace === null
        ? null
        : taskNamespace;

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
      organizationSlug: string | null;
      streamId?: string;
      allowedStreamId?: string;
      conversationId?: string | null;
    },
  ): boolean {
    if (event.agentSlug !== filters.agentSlug) {
      return false;
    }
    if ((event.organizationSlug ?? null) !== filters.organizationSlug) {
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
        orchestrationRunId: event.orchestrationRunId,
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
        orchestrationRunId: event.orchestrationRunId,
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
        orchestrationRunId: event.orchestrationRunId,
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

    // Ensure mode is always set (default to converse if not specified)
    if (!dto.mode) {
      dto.mode = AgentTaskMode.CONVERSE;
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
