import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  Req,
  Headers,
} from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { AppService } from '../app.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { AuthService } from '../auth/auth.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatusService } from '../tasks/task-status.service';
import {
  CreateTaskDto,
  AgentType,
} from '../common/types/agent-conversations.types';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { CentralizedRoutingService } from '../llms/centralized-routing.service';
import { PIIService } from '../services/pii.service';
import { SpeechService } from '../speech/speech.service';
import { Request as ExpressRequest } from 'express';
import { AgentRegistryService } from '../agent-platform/services/agent-registry.service';
import { AgentRecord } from '../agent-platform/interfaces/agent-record.interface';
import { AgentHierarchy } from '../agent-discovery.service';
import { AgentExecutionGateway } from '../agent2agent/services/agent-execution-gateway.service';
import {
  AgentTaskMode,
  TaskRequestDto,
} from '../agent2agent/dto/task-request.dto';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly appService: AppService,
    private readonly tasksService: TasksService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly taskStatusService: TaskStatusService,
    private readonly contextOptimizationService: ContextOptimizationService,
    private readonly centralizedRoutingService: CentralizedRoutingService,
    private readonly piiService: PIIService,
    private readonly speechService: SpeechService,
    private readonly authService: AuthService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentGateway: AgentExecutionGateway,
  ) {}

  /**
   * Debug endpoint to see raw discovered agents
   * Route: GET /agents/.well-known/debug-agents
   */
  @Get('.well-known/debug-agents')
  @Public()
  async getDebugAgents() {
    const agents = this.agentDiscovery.getDiscoveredAgents();
    return {
      success: true,
      data: agents.map((a) => ({
        name: a.name,
        path: a.path,
        reportsTo: a.reportsTo,
        hasConfig: !!a.configPath,
      })),
      total: agents.length,
    };
  }

  // Redact common secret patterns in log messages
  private redactString(input: string): string {
    try {
      let s = input;
      const patterns: Array<[RegExp, string]> = [
        [/sk-[A-Za-z0-9-_]{10,}/g, 'sk-REDACTED'],
        [/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer REDACTED'],
        [/api[-_]?key\s*[:=]\s*[^\s"']+/gi, 'api_key=REDACTED'],
        [/x-?api-?key\s*[:=]\s*[^\s"']+/gi, 'x-api-key=REDACTED'],
        [/authorization\s*[:=]\s*[^\s"']+/gi, 'authorization=REDACTED'],
        [/("authorization"\s*:\s*")[^"]+(")/gi, '"authorization":"REDACTED"'],
        [/("x-?api-?key"\s*:\s*")[^"]+(")/gi, '"x-api-key":"REDACTED"'],
        [/("api[-_]?key"\s*:\s*")[^"]+(")/gi, '"apiKey":"REDACTED"'],
        [/("token"\s*:\s*")[^"]+(")/gi, '"token":"REDACTED"'],
      ];
      for (const [re, repl] of patterns) s = s.replace(re, repl);
      return s;
    } catch {
      return input;
    }
  }

  /**
   * Get agent hierarchy
   * Route: GET /agents/.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
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
      await this.agentDiscovery.discoverAgents();

      const databaseAgents = await this.fetchDatabaseAgents(namespaces);
      const databaseHierarchy = this.buildDatabaseHierarchy(databaseAgents);

      const filesystemHierarchy = this.agentDiscovery.getAgentHierarchy(
        namespaces,
      );
      const hierarchy = this.mergeHierarchies(
        filesystemHierarchy,
        databaseHierarchy,
      );

      const filesystemCount = namespaces?.length
        ? this.agentDiscovery.getDiscoveredAgentsForNamespaces(namespaces)
            .length
        : this.agentDiscovery.getDiscoveredAgents().length;

      const totalAgents = filesystemCount + databaseAgents.length;

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents,
          rootNodes: hierarchy.length,
          namespaces: namespaces ?? 'all',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        metadata: {
          totalAgents: 0,
          rootNodes: 0,
          namespaces: namespaces ?? 'all',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle tasks for any discovered agent
   * Route: POST /agents/:agentType/:agentName/tasks
   */
  @Post(':agentType/:agentName/tasks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleTasks(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @Body() taskRequest: any, // Change from CreateTaskDto to any to handle both formats
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() req: ExpressRequest & { activeNamespace?: string },
  ) {
    // 🔍 Log minimal info about incoming request
    this.logger.log(
      `[DynamicAgentsController] ${taskRequest?.method || 'unknown'} request to ${agentType}/${agentName}`,
    );

    const { activeNamespace } = await this.resolveNamespaceContext(
      currentUser,
      req,
    );

    req.activeNamespace = activeNamespace;

    // Check if this is a JSON-RPC request and convert it to CreateTaskDto format
    let normalizedTaskRequest: CreateTaskDto;

    if (taskRequest && taskRequest.jsonrpc === '2.0' && taskRequest.method) {
      // This is a JSON-RPC request - convert to CreateTaskDto format

      const params = taskRequest.params || {};
      normalizedTaskRequest = {
        method: taskRequest.method,
        prompt:
          params.message ||
          params.userMessage ||
          params.prompt ||
          'No message provided',
        params: {
          ...params,
          // Preserve the original JSON-RPC structure for the agent
          jsonrpc: taskRequest.jsonrpc,
          jsonrpcId: taskRequest.id,
          jsonrpcMethod: taskRequest.method,
        },
        conversationId: params.conversationId || params.session_id,
        taskId: params.taskId,
        timeoutSeconds: params.timeoutSeconds,
        llmSelection: params.llmSelection,
        executionMode: params.executionMode,
        conversationHistory:
          params.conversation_history || params.conversationHistory || [],
      };
    } else {
      // This is already in CreateTaskDto format
      normalizedTaskRequest = taskRequest as CreateTaskDto;
    }

    // Debug: Log the received LLM selection
    // Log only minimal llm selection info to avoid leaking sensitive fields
    const _sel = normalizedTaskRequest.llmSelection;
    this.logger.log(
      `🎤 [DynamicAgentsController] Received llmSelection: provider=${_sel?.providerName ?? 'n/a'}, model=${_sel?.modelName ?? 'n/a'}`,
    );
    this.logger.log(
      `🎤 [DynamicAgentsController] Full normalized request has llmSelection: ${!!normalizedTaskRequest.llmSelection}`,
    );
    if (normalizedTaskRequest.llmSelection) {
      this.logger.log(
        `🎤 [DynamicAgentsController] llmSelection.providerName: ${normalizedTaskRequest.llmSelection.providerName}`,
      );
      this.logger.log(
        `🎤 [DynamicAgentsController] llmSelection.modelName: ${normalizedTaskRequest.llmSelection.modelName}`,
      );
    }

    // Validate required fields
    if (!normalizedTaskRequest.method || !normalizedTaskRequest.prompt) {
      throw new Error('Method and prompt are required');
    }

    const normalizedNamespace =
      activeNamespace && activeNamespace !== 'global'
        ? activeNamespace
        : null;

    const databaseAgent = await this.findDatabaseAgentRecord(
      normalizedNamespace,
      agentName,
    );

    if (databaseAgent) {
      return this.executeDatabaseAgentTask(
        databaseAgent,
        normalizedNamespace,
        normalizedTaskRequest,
        currentUser,
      );
    }

    // 🎤 AUDIO DETECTION AND TRANSCRIPTION - Convert audio to text if detected
    let transcribedText: string | null = null;
    let audioDetected = false;

    try {
      // Check if prompt contains base64 audio data
      if (this.isBase64Audio(normalizedTaskRequest.prompt)) {
        this.logger.log(
          `🎤 [DynamicAgentsController] Audio detected in prompt for ${agentType}/${agentName}`,
        );
        audioDetected = true;

        // Extract audio format and data from the prompt
        const audioData = normalizedTaskRequest.prompt;

        // Transcribe the audio using speech service
        const transcriptionResult = await this.speechService.transcribeAudio(
          audioData,
          'wav', // Default to WAV format
          48000, // Default sample rate
        );

        transcribedText = transcriptionResult.text;
        this.logger.log(
          `🎤 [DynamicAgentsController] Audio transcribed: "${transcribedText}" (confidence: ${transcriptionResult.confidence || 'N/A'})`,
        );

        // Replace the audio prompt with transcribed text
        normalizedTaskRequest.prompt = transcribedText;

        // Add audio metadata to the request
        if (!normalizedTaskRequest.metadata) {
          normalizedTaskRequest.metadata = {};
        }
        normalizedTaskRequest.metadata.audioInput = {
          detected: true,
          transcribedText: transcribedText,
          confidence: transcriptionResult.confidence,
          originalFormat: 'wav',
        };
      }
    } catch (_audioError) {
      const errMsg = _audioError instanceof Error ? this.redactString(_audioError.message) : 'Unknown error';
      this.logger.error(
        `🎤 [DynamicAgentsController] Audio transcription failed for ${agentType}/${agentName}: ${errMsg}`,
      );
      // If audio transcription fails, continue with original prompt but log the error
      if (audioDetected) {
        throw new BadRequestException(
          `Audio transcription failed: ${_audioError instanceof Error ? _audioError.message : 'Unknown error'}`,
        );
      }
    }

    // Attach namespace metadata
    normalizedTaskRequest.metadata = {
      ...(normalizedTaskRequest.metadata || {}),
      namespace: activeNamespace,
    };

    // 🔒 PII POLICY CHECK - Block sensitive data before it reaches any agent
    // PII policy check

    // Check PII policy directly without centralized routing
    const piiResult = await this.piiService.checkPolicy(
      normalizedTaskRequest.prompt,
      {
        conversationId: normalizedTaskRequest.conversationId,
        userId: currentUser?.id,
        requestId: `agent-${agentType}-${agentName}-${Date.now()}`,
        providerName: normalizedTaskRequest.llmSelection?.providerName,
      },
    );

    // Create routing decision for compatibility with existing code
    let routingDecision;
    if (piiResult.metadata.showstopperDetected) {
      // Block the request due to PII policy violation
      routingDecision = {
        provider: 'policy-blocked',
        model: 'showstopper-pii',
        isLocal: true,
        fallbackUsed: false,
        complexityScore: 0,
        reasoningPath: piiResult.metadata.policyDecision.reasoningPath,
        piiMetadata: piiResult.metadata,
        originalPrompt: normalizedTaskRequest.prompt,
        routeToAgent: false,
        blockingReason: 'showstopper-pii',
      };
    } else {
      // Simple model selection based on mode - no centralized routing needed
      const isConversationMode =
        normalizedTaskRequest.method === 'converse' ||
        normalizedTaskRequest.method === 'plan';

      let selectedProvider, selectedModel;
      if (isConversationMode) {
        // Use system model for conversation/plan mode
        const systemConfig = JSON.parse(
          process.env.MODEL_CONFIG_GLOBAL_JSON ||
            '{"provider":"ollama","model":"llama3.2:1b"}',
        );
        selectedProvider = systemConfig.provider;
        selectedModel = systemConfig.model;
        // Using system model
      } else {
        // Use passed llmSelection for deliverable mode (build/process)
        selectedProvider =
          normalizedTaskRequest.llmSelection?.providerName || 'ollama';
        selectedModel =
          normalizedTaskRequest.llmSelection?.modelName || 'llama3.2:1b';
        // Using explicit model
      }

      routingDecision = {
        provider: selectedProvider,
        model: selectedModel,
        isLocal: selectedProvider.toLowerCase() === 'ollama',
        fallbackUsed: false,
        complexityScore: 0,
        reasoningPath: [
          `Simple mode-based routing: ${normalizedTaskRequest.method} mode`,
        ],
        piiMetadata: piiResult.metadata,
        originalPrompt: normalizedTaskRequest.prompt,
        routeToAgent: true,
      };
    }

    // Check if request was blocked by PII policy
    if (routingDecision.provider === 'policy-blocked') {
      this.logger.warn(
        `🚫 [DynamicAgentsController] Request blocked by PII policy: ${routingDecision.piiMetadata?.policyDecision?.violations?.join(', ')}`,
      );

      // Create a blocked task response immediately
      const task = await this.tasksService.createTask(
        currentUser.id,
        agentName,
        agentType as AgentType,
        {
          ...normalizedTaskRequest,
          conversationHistory: normalizedTaskRequest.conversationHistory || [],
        },
      );

      const userMessage = routingDecision.piiMetadata?.userMessage;
      const defaultMessage =
        'Request blocked due to PII policy violation. Please rephrase your request without including sensitive personal information.';
      const messageSummary = userMessage?.summary || defaultMessage;

      // Mark task as failed with PII violation
      await this.taskStatusService.failTask(
        task.id,
        currentUser.id,
        messageSummary,
      );

      // Return a successful response with PII policy block information
      return {
        success: false,
        blocked: true,
        reason: 'PII_POLICY_VIOLATION',
        message: messageSummary,
        taskId: task.id,
        conversationId: task.agentConversationId,
        details: {
          reason:
            userMessage?.details?.join(' ') ||
            'Sensitive personal information detected.',
          suggestion:
            userMessage?.blockingDetails?.recommendation ||
            'Please remove any SSNs, credit card numbers, API keys, or other sensitive data and try again.',
          detectedTypes: userMessage?.blockingDetails?.showstopperTypes || [],
        },
        piiMetadata: routingDecision.piiMetadata,
      };
    }

    // PII check passed

    // Extract auth token from request
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName, [
      activeNamespace,
    ]);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get agent configuration for timeout and other settings
    const agentCard = await agentInstance.getAgentCard();
    const defaultTimeout = parseInt(process.env.AGENT_TASK_TIMEOUT_SECONDS || '300', 10);
    const agentTimeout = agentCard.timeout || defaultTimeout; // Prefer card, else env fallback

    // Task type is no longer used - all tasks are handled as ephemeral

    // Create task with agent-specific timeout
    // Optimize context (backend-intelligent) with feature flag
    const wp = normalizedTaskRequest.params?.workProduct;
    const optimizationEnabled =
      (process.env.CONTEXT_OPTIMIZATION_ENABLED ?? 'true') !== 'false';
    const optimizedHistory = optimizationEnabled
      ? await this.contextOptimizationService.optimizeContext({
          fullHistory: normalizedTaskRequest.conversationHistory || [],
          conversationId: normalizedTaskRequest.conversationId,
          workProductType: wp?.type,
          workProductId: wp?.id,
          tokenBudget: this.getTokenBudget(normalizedTaskRequest.llmSelection),
        })
      : normalizedTaskRequest.conversationHistory || [];

    const normalizedOptimizedHistory = (optimizedHistory || []).map(
      (m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        ...(m.metadata ? { metadata: m.metadata } : {}),
      }),
    );

    const taskRequestWithTimeout = {
      ...normalizedTaskRequest,
      conversationHistory: normalizedOptimizedHistory,
      llmMetadata: {
        ...(normalizedTaskRequest as any).llmMetadata,
        contextOptimization: optimizationEnabled
          ? {
              strategy: 'backend_intelligent',
              originalMessageCount: (
                normalizedTaskRequest.conversationHistory || []
              ).length,
              optimizedMessageCount: normalizedOptimizedHistory.length,
              workProductType: wp?.type,
            }
          : undefined,
      },
      timeoutSeconds: agentTimeout,
    };

    const task = await this.tasksService.createTask(
      currentUser.id,
      agentName,
      agentType as AgentType,
      taskRequestWithTimeout,
    );

    try {
      // Task status already initialized in TasksService.createTask()
      // No need to duplicate TaskStatusService.createTask() call here

      // If client provided workProduct, bind it immutably to the conversation once
      if (wp && task.agentConversationId) {
        try {
          await this.agentConversationsService.setPrimaryWorkProduct(
            task.agentConversationId,
            currentUser.id,
            { type: wp.type, id: wp.id },
          );
        } catch (_e) {}
      }

      // Prepare request for agent with task context
      const authenticatedTaskRequest = {
        ...normalizedTaskRequest.params,
        method: normalizedTaskRequest.method,
        prompt: normalizedTaskRequest.prompt,
        taskId: task.id,
        conversationId: normalizedTaskRequest.conversationId, // Pass conversation ID to agent services
        currentUser,
        authToken: token,
        llmSelection: normalizedTaskRequest.llmSelection,
        conversationHistory: normalizedTaskRequest.conversationHistory || [],
        metadata: {
          ...normalizedTaskRequest.metadata, // Pass existing metadata
          // Python agents expect llmPreferences in metadata
          llmPreferences: normalizedTaskRequest.llmSelection,
        },
        // NEW ARCHITECTURE: Pass PII metadata and routing decision to agents
        piiMetadata: routingDecision.piiMetadata,
        routingDecision: routingDecision,
        originalPrompt: routingDecision.originalPrompt,
      };

      // Debug: Log what we're sending to the agent
      this.logger.log(
        `🎯 [DynamicAgentsController] Sending to agent ${agentType}/${agentName}:`,
      );
      this.logger.log(
        `   metadata.llmPreferences: ${JSON.stringify(authenticatedTaskRequest.metadata?.llmPreferences)}`,
      );
      this.logger.log(
        `   Has providerName: ${!!authenticatedTaskRequest.metadata?.llmPreferences?.providerName}`,
      );
      this.logger.log(
        `   Has modelName: ${!!authenticatedTaskRequest.metadata?.llmPreferences?.modelName}`,
      );

      // In A2A architecture, all execution modes should await completion
      // The difference is only in progress reporting:
      // - immediate: no progress updates
      // - websocket/polling: progress updates via WebSocket during processing

      const executionMode = normalizedTaskRequest.executionMode;
      this.logger.log(
        `🚀 Processing task ${task.id} in ${executionMode} mode - will await completion`,
      );

      // 🔍 DEBUG: Log before calling JSON-RPC processing
      // Call agent's processJsonRpcRequest

      // Wrap into JSON-RPC request to use the normalized A2A path
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: task.id,
        method: authenticatedTaskRequest.method || 'converse',
        params: authenticatedTaskRequest,
      };

      // All modes await the result for proper A2A behavior
      const rpcResponse =
        await agentInstance.processJsonRpcRequest(jsonRpcRequest);
      const result = rpcResponse?.result ?? rpcResponse; // Unwrap JSON-RPC result

      // 🔍 DEBUG: Log the result from JSON-RPC processing
      // Request completed

      const taskAlreadyHandled =
        result &&
        typeof result === 'object' &&
        (result.__taskCompletionHandled === true ||
          (result.metadata && result.metadata.taskCompletionHandled === true));

      if (!taskAlreadyHandled) {
        // Store the result in the task record with deliverable auto-creation
        // Use the agent's completeTask method to enable deliverable creation
        if (agentInstance.completeTask) {
          await agentInstance.completeTask(task.id, currentUser.id, result);
        } else {
          // Fallback to direct task completion if agent doesn't have completeTask method
          await this.taskStatusService.completeTask(
            task.id,
            currentUser.id,
            result,
          );
        }
      } else {
        this.logger.debug(
          `🎯 [DynamicAgentsController] Task ${task.id} was already completed by agent instance – skipping duplicate completion call`,
        );
      }

      // 🔊 OPTIONAL AUDIO SYNTHESIS - Convert response to speech if original input was audio
      let responseAudio: string | undefined = undefined;

      if (audioDetected && transcribedText && result?.message) {
        try {
          this.logger.log(
            `🔊 [DynamicAgentsController] Synthesizing audio response for ${agentType}/${agentName}`,
          );

          const synthesisResult = await this.speechService.synthesizeText(
            result.message,
            'EXAVITQu4vr4xnSDxMaL', // Default to Bella voice from Eleven Labs
            0.5, // Default stability setting
          );

          responseAudio = synthesisResult.audioData;
          this.logger.log(
            `🔊 [DynamicAgentsController] Audio response synthesized successfully for ${agentType}/${agentName}`,
          );
        } catch (_synthesisError) {
          this.logger.error(
        `🔊 [DynamicAgentsController] Audio synthesis failed for ${agentType}/${agentName}: ${
          _synthesisError instanceof Error ? this.redactString(_synthesisError.message) : 'Unknown error'
        }`,
      );
          // Continue without audio - don't fail the entire request
        }
      }

      // Normalize result metadata so frontend sees final PII in parsedResponse.metadata.piiMetadata
      try {
        const finalPii =
          result?.piiMetadata ||
          result?.metadata?.piiMetadata ||
          routingDecision.piiMetadata;
        if (result && typeof result === 'object') {
          result.metadata = {
            ...(result.metadata || {}),
            piiMetadata: finalPii,
          };
        }
      } catch {}

      // Return the result for immediate response
      return {
        taskId: task.id,
        conversationId: task.agentConversationId,
        status: 'completed',
        result,
        // Expose final LLM metadata at top-level for the frontend
        ...(result?.metadata && {
          metadata: {
            ...result.metadata,
            // Prefer LLM-level PII over routing-level
            piiMetadata:
              result?.piiMetadata ||
              result?.metadata?.piiMetadata ||
              routingDecision.piiMetadata,
          },
        }),
        // Also expose the final LLM PII metadata directly for convenience
        ...(result?.piiMetadata && {
          piiMetadata: result.piiMetadata,
        }),
        // Fallback: if no LLM PII provided, include routing-level PII
        ...(!(result?.piiMetadata || result?.metadata?.piiMetadata) && {
          piiMetadata: routingDecision.piiMetadata,
        }),
        // Include any PII metadata from the agent result if available
        ...(result?.metadata?.piiMetadata && {
          agentPiiMetadata: result.metadata.piiMetadata,
        }),
        // Include audio synthesis results if available
        ...(responseAudio && {
          responseAudio: responseAudio,
          audioSynthesis: {
            synthesized: true,
            voiceId: 'EXAVITQu4vr4xnSDxMaL',
            format: 'mp3',
          },
        }),
        // Include audio input metadata for frontend reference
        ...(audioDetected && {
          audioInput: {
            detected: true,
            transcribedText: transcribedText,
            originalFormat: 'wav',
          },
        }),
      };
    } catch (error) {
      // Mark task as failed via TaskStatusService (single source of truth)
      const redactedMessage =
        error instanceof Error ? this.redactString(error.message) : 'Unknown error';
      await this.taskStatusService.failTask(
        task.id,
        currentUser.id,
        redactedMessage,
      );

      // Return standardized failure payload (keep HTTP 200 per @HttpCode)
      return {
        taskId: task.id,
        conversationId: task.agentConversationId,
        status: 'failed',
        error: {
          code: 'agent_execution_error',
          message: redactedMessage,
        },
        metadata: {
          agentType,
          agentName,
          namespace: activeNamespace,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private getTokenBudget(llmSelection?: any): number {
    const budgets: Record<string, number> = {
      'claude-3-5-sonnet': 100000,
      'claude-3-haiku': 150000,
      'gpt-4-turbo': 100000,
      default: 80000,
    };
    const modelName: string =
      (llmSelection && llmSelection.modelName) || 'default';
    const hasKey = Object.prototype.hasOwnProperty.call(budgets, modelName);
    const value: number = hasKey
      ? (budgets[modelName] as number)
      : (budgets['default'] as number);
    return value;
  }

  /**
   * Get agent card for any discovered agent
   * Route: GET /agents/:agentType/:agentName/.well-known/agent.json
   */
  @Get(':agentType/:agentName/.well-known/agent.json')
  @UseGuards(JwtAuthGuard)
  async getAgentCard(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req()
    req: ExpressRequest & { activeNamespace?: string },
  ) {
    const { activeNamespace } = await this.resolveNamespaceContext(
      currentUser,
      req,
    );

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName, [
      activeNamespace,
    ]);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the agent card
    return agentInstance.getAgentCard();
  }

  /**
   * Health check for any discovered agent
   * Route: GET /agents/:agentType/:agentName/health
   */
  @Get(':agentType/:agentName/health')
  @UseGuards(JwtAuthGuard)
  async getAgentHealth(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() req: ExpressRequest,
  ) {
    const { activeNamespace } = await this.resolveNamespaceContext(
      currentUser,
      req,
    );

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName, [
      activeNamespace,
    ]);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the health status if available
    if (agentInstance.getHealthStatus) {
      return agentInstance.getHealthStatus();
    }

    return { status: 'healthy', message: 'Agent is running' };
  }

  /**
   * Find an agent instance by type and name
   */
  private findAgentInstance(
    agentType: string,
    agentName: string,
    namespaces: string[],
  ): any {
    const discoveredAgents = namespaces.length
      ? this.appService.getDiscoveredAgentsByNamespaces(namespaces)
      : this.appService.getDiscoveredAgents();
    const agentInstances = namespaces.length
      ? this.appService.getAgentInstancesByNamespaces(namespaces)
      : this.appService.getAgentInstances();

    const normalizedExpectedRelative = this.normalizeAgentName(
      `${agentType}/${agentName}`,
    );
    const normalizedExpectedNamespaced = new Set(
      namespaces.map((ns) =>
        this.normalizeAgentName(`${ns}/${agentType}/${agentName}`),
      ),
    );

    const agentIndex = discoveredAgents.findIndex((a) => {
      const relativePath = a.relativePath || a.path;
      const namespacedPath = a.namespacedPath || a.path;

      const normalizedRelative = this.normalizeAgentName(relativePath);
      const normalizedNamespaced = this.normalizeAgentName(namespacedPath);

      if (normalizedRelative === normalizedExpectedRelative) return true;
      if (normalizedNamespaced === normalizedExpectedRelative) return true;
      if (normalizedExpectedNamespaced.has(normalizedNamespaced)) return true;

      // Fallback for agents missing path metadata
      return a.type === agentType && a.name === agentName;
    });

    if (agentIndex === -1) {
      return null;
    }

    return agentInstances[agentIndex] || null;
  }

  /**
   * Process task asynchronously - simplified version using TaskStatusService
   */
  // processTaskAsync method removed - all execution modes now use synchronous await pattern

  private async resolveNamespaceContext(
    currentUser: SupabaseAuthUserDto,
    req: ExpressRequest,
  ): Promise<{ activeNamespace: string; allowedNamespaces: string[] }> {
    const namespaces = await this.authService.getNamespaceAccessForUser(
      currentUser.id,
    );

    if (!namespaces.length) {
      throw new ForbiddenException('User has no namespaces assigned');
    }

    let requestedNamespace: string | undefined;
    const headerValue = req.header?.('x-agent-namespace');
    if (headerValue) {
      requestedNamespace = headerValue;
    }

    if (!requestedNamespace) {
      const queryValue = req.query?.['namespace'];
      if (typeof queryValue === 'string') {
        requestedNamespace = queryValue;
      } else if (Array.isArray(queryValue) && queryValue.length > 0) {
        const first = queryValue[0];
        if (typeof first === 'string') {
          requestedNamespace = first;
        }
      }
    }

    let activeNamespace = this.pickDefaultNamespace(namespaces);

    if (requestedNamespace) {
      if (!namespaces.includes(requestedNamespace)) {
        throw new ForbiddenException(
          `Namespace ${requestedNamespace} is not permitted for this user`,
        );
      }
      activeNamespace = requestedNamespace;
    }

    return {
      activeNamespace,
      allowedNamespaces: namespaces,
    };
  }

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

  private async findDatabaseAgentRecord(
    namespace: string | null,
    agentName: string,
  ): Promise<AgentRecord | null> {
    const addVariant = (slug: string | null | undefined, variants: Set<string>) => {
      if (!slug) {
        return;
      }
      const trimmed = slug.trim();
      if (trimmed.length) {
        variants.add(trimmed);
      }
    };

    const normalizedTarget = this.normalizeAgentName(agentName);

    const legacySlugAliases: Record<string, string | undefined> = {
      hierarchy_orchestrator: 'hiverarchy-orchestrator',
      hierarchy_researcher: 'hiverarchy-researcher',
      hierarchy_child_builder: 'hiverarchy-child-builder',
      child_topic_finder: 'hiverarchy-child-builder',
      child_topic_builder: 'hiverarchy-child-builder',
      child_topic_generator: 'hiverarchy-child-builder',
      hierarchy_outliner: 'hiverarchy-outliner',
      hierarchy_outline_builder: 'hiverarchy-outliner',
      hierarchy_writer: 'hiverarchy-writer',
      hierarchy_editor: 'hiverarchy-editor',
      hierarchy_image_generator: 'hiverarchy-image-generator',
      hierarchy_human_review: undefined,
      hiverarchy_orchestrator: 'hiverarchy-orchestrator',
      hiverarchy_researcher: 'hiverarchy-researcher',
      hiverarchy_child_finder: 'hiverarchy-child-builder',
      supabase_post_update: 'supabase-post-update',
      supabase_child_create: 'supabase-child-create',
      supabase_child_creator: 'supabase-child-create',
      supabase_idea_list: 'supabase-idea-list',
    };
    const slugVariants = new Set<string>();

    addVariant(agentName, slugVariants);
    addVariant(agentName.replace(/_/g, '-'), slugVariants);
    addVariant(agentName.replace(/-/g, '_'), slugVariants);

    if (normalizedTarget.includes('hierarchy')) {
      const corrected = normalizedTarget.replace('hierarchy', 'hiverarchy');
      addVariant(corrected.replace(/_/g, '-'), slugVariants);
      addVariant(corrected.replace(/_/g, '_'), slugVariants);
    }

    const alias = legacySlugAliases[normalizedTarget];
    if (alias && alias.trim().length) {
      addVariant(alias, slugVariants);
      addVariant(alias.replace(/-/g, '_'), slugVariants);
    }

    const lookupNamespace = namespace ?? null;
    for (const slug of slugVariants) {
      const record = await this.agentRegistry.getAgent(lookupNamespace, slug);
      if (record) {
        return record;
      }
    }

    const candidateRecords = lookupNamespace
      ? await this.agentRegistry.listAgents(lookupNamespace)
      : await this.agentRegistry.listAllAgents();

    const matched = candidateRecords.find((record) => {
      const recordNormalized = this.normalizeAgentName(record.slug);
      if (recordNormalized === normalizedTarget) {
        return true;
      }
      if (slugVariants.has(record.slug)) {
        return true;
      }
      if (slugVariants.has(record.slug.replace(/_/g, '-'))) {
        return true;
      }
      if (slugVariants.has(record.slug.replace(/-/g, '_'))) {
        return true;
      }
      return false;
    });

    if (matched) {
      return matched;
    }

    if (lookupNamespace) {
      const globalMatch = (await this.agentRegistry.listAllAgents()).find(
        (record) => this.normalizeAgentName(record.slug) === normalizedTarget,
      );
      if (globalMatch) {
        return globalMatch;
      }
    }

    return null;
  }

  private buildDatabaseHierarchy(records: AgentRecord[]): AgentHierarchy[] {
    if (!records.length) {
      return [];
    }

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
      children: AgentHierarchy[] = [],
    ): AgentHierarchy => {
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

    const roots: AgentHierarchy[] = [];

    grouped.forEach((agents, namespaceKey) => {
      const orchestrators = agents.filter(
        (agent) =>
          agent.agent_type === 'orchestrator' || agent.config?.orchestrator,
      );

      const tools = agents.filter(
        (agent) => agent.config?.agent_category === 'tool',
      );

      const specialists = agents.filter(
        (agent) =>
          agent.agent_type !== 'orchestrator' &&
          !agent.config?.orchestrator &&
          agent.config?.agent_category !== 'tool',
      );

      const specialistNodes = specialists.map((record) =>
        createNode(record, []),
      );
      const specialistBySlug = new Map(
        specialistNodes.map((node) => [node.name, node]),
      );

      const appendToolsFolder = () => {
        if (!tools.length) {
          return;
        }

        const toolNodes = tools
          .map((tool) => {
            const node = this.cloneHierarchyNode(createNode(tool, []));
            return {
              ...node,
              metadata: {
                ...(node.metadata || {}),
                category: 'tool',
              },
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        roots.push({
          id: `${namespaceKey ?? 'global'}::tools`,
          name: 'tools',
          displayName: 'Tools',
          type: 'tool_group',
          path: `db://${namespaceKey ?? 'global'}/tools`,
          namespace: namespaceKey ?? undefined,
          metadata: {
            category: 'tool_group',
            source: 'database',
            namespace: namespaceKey ?? null,
          },
          children: toolNodes,
        });
      };

      if (!orchestrators.length) {
        const sorted = specialistNodes
          .map((node) => this.cloneHierarchyNode(node))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        roots.push(...sorted);
        appendToolsFolder();
        return;
      }

      // Track which specialists are assigned to orchestrators
      const assignedSpecialistSlugs = new Set<string>();

      orchestrators.forEach((record) => {
        // Filter specialists that report to this orchestrator
        const matchingSpecialists = specialists.filter((child) => {
          // Check YAML for hierarchy.reportsTo or hierarchy.reports_to
          let reportsTo = null;
          try {
            const yamlData = child.yaml ? JSON.parse(child.yaml) : null;
            reportsTo = yamlData?.hierarchy?.reportsTo || yamlData?.hierarchy?.reports_to || null;
          } catch {
            // Ignore parse errors
          }
          if (reportsTo === record.slug) {
            assignedSpecialistSlugs.add(child.slug);
            return true;
          }
          return false;
        });

        const children = matchingSpecialists.map((child) => {
          const specialistNode = specialistBySlug.get(child.slug);
          return specialistNode
            ? this.cloneHierarchyNode(specialistNode)
            : createNode(child, []);
        });

        children.sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );

        roots.push(createNode(record, children));
      });

      // Add standalone specialists (those not assigned to any orchestrator) as root nodes
      const standaloneSpecialists = specialists.filter(
        (specialist) => !assignedSpecialistSlugs.has(specialist.slug)
      );

      if (standaloneSpecialists.length > 0) {
        const standaloneNodes = standaloneSpecialists
          .map((specialist) => {
            const node = specialistBySlug.get(specialist.slug);
            return node ? this.cloneHierarchyNode(node) : createNode(specialist, []);
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        roots.push(...standaloneNodes);
      }

      appendToolsFolder();
    });

    roots.sort((a, b) => {
      const aIsTool = a.type === 'tool_group';
      const bIsTool = b.type === 'tool_group';
      if (aIsTool && !bIsTool) {
        return 1;
      }
      if (!aIsTool && bIsTool) {
        return -1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return roots;
  }

  private mergeHierarchies(
    filesystem: AgentHierarchy[],
    database: AgentHierarchy[],
  ): AgentHierarchy[] {
    if (!database.length) {
      return filesystem.map((node) => this.cloneHierarchyNode(node));
    }

    const merged = filesystem.map((node) => this.cloneHierarchyNode(node));
    const keyFor = (node: AgentHierarchy) =>
      `${node.namespace ?? 'global'}::${this.normalizeAgentName(node.name)}`;
    const indexByKey = new Map<string, number>();
    merged.forEach((node, index) => {
      indexByKey.set(keyFor(node), index);
    });

    for (const node of database) {
      const key = keyFor(node);
      const cloned = this.cloneHierarchyNode(node);
      if (indexByKey.has(key)) {
        const targetIndex = indexByKey.get(key)!;
        merged[targetIndex] = cloned;
      } else {
        indexByKey.set(key, merged.length);
        merged.push(cloned);
      }
    }

    merged.sort((a, b) => {
      const aIsTool = a.type === 'tool_group';
      const bIsTool = b.type === 'tool_group';
      if (aIsTool && !bIsTool) {
        return 1;
      }
      if (!aIsTool && bIsTool) {
        return -1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return merged;
  }

  private cloneHierarchyNode(node: AgentHierarchy): AgentHierarchy {
    return {
      ...node,
      children: Array.isArray(node.children)
        ? node.children.map((child) => this.cloneHierarchyNode(child))
        : [],
    };
  }

  private async executeDatabaseAgentTask(
    record: AgentRecord,
    namespace: string | null,
    legacyRequest: CreateTaskDto,
    currentUser: SupabaseAuthUserDto,
  ) {
    const taskRequest = this.mapLegacyTaskToAgentRequest(legacyRequest, currentUser);
    return this.agentGateway.execute(namespace, record.slug, taskRequest);
  }

  private mapLegacyTaskToAgentRequest(
    request: CreateTaskDto,
    currentUser: SupabaseAuthUserDto,
  ): TaskRequestDto {
    const dto = new TaskRequestDto();
    dto.mode = this.mapLegacyMode(request.params?.mode ?? request.method);
    dto.conversationId = request.conversationId;
    dto.userMessage = request.prompt;
    dto.metadata = {
      ...(request.metadata ?? {}),
      createdBy: currentUser?.id ?? null,
      executionMode: request.executionMode ?? 'immediate',
    };

    if (request.params?.planId) {
      dto.planId = request.params.planId;
    }

    if (request.params?.orchestrationId) {
      dto.orchestrationId = request.params.orchestrationId;
    }

    if (request.params?.orchestrationRunId) {
      dto.orchestrationRunId = request.params.orchestrationRunId;
    }

    if (request.params?.orchestrationSlug) {
      dto.orchestrationSlug = request.params.orchestrationSlug;
    }

    dto.payload = {
      prompt: request.prompt,
      params: request.params ?? {},
      llmSelection: request.llmSelection ?? null,
      llmMetadata: request.llmMetadata ?? null,
      conversationHistory: request.conversationHistory ?? [],
      executionMode: request.executionMode ?? 'immediate',
      taskId: request.taskId,
      timeoutSeconds: request.timeoutSeconds,
      metadata: request.metadata ?? {},
      options: {
        stream:
          request.metadata?.stream === true ||
          request.executionMode === 'websocket',
      },
    };

    if (request.conversationHistory?.length) {
      dto.messages = request.conversationHistory.map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));
    }

    return dto;
  }

  private mapLegacyMode(rawMode?: string | null): AgentTaskMode {
    const mode = (rawMode || 'converse').toLowerCase();

    switch (mode) {
      case 'plan':
        return AgentTaskMode.PLAN;
      case 'build':
        return AgentTaskMode.BUILD;
      case 'human_response':
        return AgentTaskMode.HUMAN_RESPONSE;
      case 'orchestrate_create':
        return AgentTaskMode.ORCHESTRATE_CREATE;
      case 'orchestrate_execute':
        return AgentTaskMode.ORCHESTRATE_EXECUTE;
      case 'orchestrate_continue':
        return AgentTaskMode.ORCHESTRATOR_RUN_CONTINUE;
      case 'orchestrator_run_start':
        return AgentTaskMode.ORCHESTRATOR_RUN_START;
      case 'orchestrator_run_continue':
        return AgentTaskMode.ORCHESTRATOR_RUN_CONTINUE;
      case 'orchestrator_run_pause':
        return AgentTaskMode.ORCHESTRATOR_RUN_PAUSE;
      case 'orchestrator_run_resume':
        return AgentTaskMode.ORCHESTRATOR_RUN_RESUME;
      case 'orchestrator_run_human_response':
        return AgentTaskMode.ORCHESTRATOR_RUN_HUMAN_RESPONSE;
      case 'orchestrator_run_cancel':
        return AgentTaskMode.ORCHESTRATOR_RUN_CANCEL;
      case 'orchestrator_plan_create':
        return AgentTaskMode.ORCHESTRATOR_PLAN_CREATE;
      case 'orchestrator_plan_update':
        return AgentTaskMode.ORCHESTRATOR_PLAN_UPDATE;
      case 'orchestrator_plan_review':
        return AgentTaskMode.ORCHESTRATOR_PLAN_REVIEW;
      case 'orchestrator_plan_approve':
        return AgentTaskMode.ORCHESTRATOR_PLAN_APPROVE;
      case 'orchestrator_plan_reject':
        return AgentTaskMode.ORCHESTRATOR_PLAN_REJECT;
      case 'orchestrator_plan_archive':
        return AgentTaskMode.ORCHESTRATOR_PLAN_ARCHIVE;
      case 'orchestrator_recipe_save':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_SAVE;
      case 'orchestrator_recipe_update':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_UPDATE;
      case 'orchestrator_recipe_validate':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_VALIDATE;
      case 'orchestrator_recipe_delete':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_DELETE;
      case 'orchestrator_recipe_load':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_LOAD;
      case 'orchestrator_recipe_list':
        return AgentTaskMode.ORCHESTRATOR_RECIPE_LIST;
      default:
        return AgentTaskMode.CONVERSE;
    }
  }

  private pickDefaultNamespace(namespaces: string[]): string {
    if (!namespaces.length) {
      return 'demo';
    }

    const preferred = namespaces.find((ns) => ns !== 'demo');
    return preferred || namespaces[0] || 'demo';
  }

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }

  /**
   * Check if the prompt contains base64 audio data
   * Detects common patterns for base64-encoded WAV files
   */
  private isBase64Audio(prompt: string): boolean {
    if (!prompt || typeof prompt !== 'string') {
      return false;
    }

    // Check for base64 audio data patterns
    // WAV files typically start with specific headers when base64 encoded
    const base64AudioPatterns = [
      /^data:audio\/wav;base64,/i,
      /^data:audio\/x-wav;base64,/i,
      /^data:audio\/webm;base64,/i,
      /^data:audio\/mp3;base64,/i,
      /^data:audio\/mpeg;base64,/i,
      // Check for raw base64 that looks like audio (starts with common WAV header patterns)
      /^UklGR[A-Za-z0-9+/]{8,}/, // RIFF header in base64
      /^UklGRg[A-Za-z0-9+/]{8,}/, // RIFF header in base64
    ];

    // Check if the prompt matches any audio pattern
    const isAudio = base64AudioPatterns.some((pattern) => pattern.test(prompt));

    // Also check for very long base64-like strings (likely audio data)
    const isLongBase64 =
      prompt.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(prompt);

    return isAudio || isLongBase64;
  }
}
