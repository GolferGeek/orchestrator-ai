import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { LLMService } from '@llm/llm.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { StreamingService } from './streaming.service';

/**
 * API Agent Runner
 *
 * Executes agents that make HTTP API calls. API agents:
 * - Make HTTP requests (GET, POST, PUT, DELETE, PATCH)
 * - Support request headers, body, query params
 * - Handle authentication (API keys, Bearer tokens, Basic auth)
 * - Transform responses before saving
 * - Store API results as deliverables
 *
 * API agents are configured with:
 * - config.api.url: API endpoint URL
 * - config.api.method: HTTP method
 * - config.api.headers: Request headers
 * - config.api.body: Request body (for POST/PUT/PATCH)
 * - config.api.auth: Authentication configuration
 * - config.deliverable: Output format configuration
 *
 * @example
 * Agent configuration:
 * {
 *   type: 'api',
 *   config: {
 *     api: {
 *       url: 'https://api.example.com/users',
 *       method: 'GET',
 *       headers: {
 *         'Authorization': 'Bearer {{metadata.token}}'
 *       }
 *     },
 *     deliverable: {
 *       format: 'json',
 *       type: 'api-response'
 *     }
 *   }
 * }
 */
@Injectable()
export class ApiAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(ApiAgentRunnerService.name);

  constructor(
    httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
      httpService, // Pass httpService to base class as last parameter
    );
  }

  /**
   * PLAN mode - not yet implemented for API agents
   */
  protected handlePlan(
    _definition: AgentRuntimeDefinition,
    _request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return Promise.resolve(
      TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'PLAN mode not yet implemented for API agents',
      ),
    );
  }

  /**
   * Override handleBuild to skip base class streaming logic
   * API agents have their own SSE handling in executeBuild
   */
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = (request.payload ?? {}) as { action?: string };
    const action =
      typeof payload.action === 'string' ? payload.action : 'create';

    // For create action, go directly to executeBuild (which has SSE logic)
    if (action === 'create') {
      return await this.executeBuild(definition, request, organizationSlug);
    }

    // For other actions, use base class logic
    return await super.handleBuild(definition, request, organizationSlug);
  }

  /**
   * BUILD mode - execute HTTP API call and save results
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      // Validate required context
      const userId = this.resolveUserId(request);
      const conversationId = this.resolveConversationId(request);
      const taskId =
        ((request.payload as Record<string, unknown>)?.taskId as
          | string
          | null) || null;

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Missing required userId or conversationId for API execution',
        );
      }

      // Check execution mode - handle websocket/polling differently
      const executionMode =
        ((request.payload as Record<string, unknown>)
          ?.executionMode as string) || 'immediate';

      // Register stream if using websocket/polling mode (for SSE progress updates)
      // But still execute synchronously and wait for the result
      if (executionMode === 'websocket' || executionMode === 'polling') {
        this.logger.log(
          `🔌 API Agent ${definition.slug}: ${executionMode} mode detected - registering stream for progress updates`,
        );

        if (taskId) {
          // Register stream session with StreamingService for progress updates
          const streamId = this.streamingService.registerStream(
            taskId,
            definition.slug,
            organizationSlug || 'global',
            AgentTaskMode.BUILD,
            conversationId,
            userId,
          );
          this.logger.log(
            `✅ API Agent ${definition.slug}: Stream registered with streamId=${streamId} for progress updates`,
          );
        }
      }

      // Continue with synchronous execution (wait for API response)
      this.logger.log(
        `⚡ API Agent ${definition.slug}: immediate mode - executing synchronously`,
      );

      // Extract provider and model from payload (same pattern as context-agent-runner)
      const payload = request.payload;
      const config = payload?.config as
        | { provider?: string; model?: string }
        | undefined;

      // Check config for LLM settings
      const provider = config?.provider ?? null;
      const model = config?.model ?? null;

      if (
        !provider ||
        !model ||
        typeof provider !== 'string' ||
        typeof model !== 'string'
      ) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          `Missing LLM configuration: provider=${provider}, model=${model}. Ensure LLM provider and model are selected in the UI.`,
        );
      }

      // Create enriched request with extracted values for interpolation
      const enrichedRequest = {
        ...request,
        userId,
        conversationId,
        taskId: taskId ?? undefined,
        payload: {
          ...(request.payload as Record<string, unknown>),
          provider,
          model,
        },
      };

      // Get API configuration
      const apiConfig = this.asRecord(definition.config?.api);
      if (!apiConfig) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'No API configuration found or URL missing',
        );
      }

      const urlTemplate =
        this.ensureString(apiConfig.url) ??
        this.ensureString(apiConfig.endpoint);
      if (!urlTemplate) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'API configuration missing URL string',
        );
      }

      this.logger.log(
        `Executing API call to ${urlTemplate} for agent ${definition.slug}`,
      );

      // 1. Interpolate URL and parameters
      const url = this.interpolateString(urlTemplate, enrichedRequest);
      const method = (
        this.ensureString(apiConfig.method) ?? 'GET'
      ).toUpperCase();

      // 2. Build headers
      const headersRecord = this.asRecord(apiConfig.headers);
      const headers = this.buildHeaders(
        headersRecord ? this.toPlainRecord(headersRecord) : {},
        enrichedRequest,
      );

      // 3. Build request body (for POST/PUT/PATCH)
      let body: unknown = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && apiConfig.body) {
        const bodyRecord = this.asRecord(apiConfig.body);
        if (bodyRecord) {
          body = this.interpolateObject(
            this.toPlainRecord(bodyRecord),
            enrichedRequest,
          );
        } else if (typeof apiConfig.body === 'string') {
          body = this.interpolateString(apiConfig.body, enrichedRequest);
        } else {
          body = apiConfig.body;
        }
      }

      // 4. Build query parameters
      let queryParams: Record<string, unknown> = {};
      const queryParamsRecord = this.asRecord(apiConfig.queryParams);
      if (queryParamsRecord) {
        queryParams = this.interpolateObject(
          this.toPlainRecord(queryParamsRecord),
          enrichedRequest,
        );
      }

      // 5. Execute HTTP request
      // Observability: Calling external API
      await this.emitObservabilityEvent('agent.progress', 'Calling external API', {
        definition,
        request,
        organizationSlug,
        taskId: taskId ?? undefined,
        progress: 30,
      });

      const startTime = Date.now();
      let response: unknown;

      try {
        const observable = this.httpService.request({
          url,
          method: method,
          headers,
          data: body,
          params: queryParams,
          timeout: this.ensureNumber(apiConfig.timeout) ?? 30000,
          validateStatus: () => true, // Don't throw on non-2xx status
        });

        response = await firstValueFrom(observable);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`API call failed: ${errorMessage}`);

        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          `API call failed: ${errorMessage}`,
        );
      }

      const duration = Date.now() - startTime;

      // Observability: Processing API response
      await this.emitObservabilityEvent('agent.progress', 'Processing API response', {
        definition,
        request,
        organizationSlug,
        taskId: taskId ?? undefined,
        progress: 60,
      });

      // 6. Check response status
      const responseTyped = response as {
        status: number;
        data: unknown;
        headers: Record<string, unknown>;
      };
      const statusCode = responseTyped.status;
      const isSuccess = statusCode >= 200 && statusCode < 300;

      if (!isSuccess && apiConfig.failOnError !== false) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          `API returned error status ${statusCode}: ${JSON.stringify(responseTyped.data)}`,
        );
      }

      // 7. Format response data
      // Observability: Formatting response
      await this.emitObservabilityEvent('agent.progress', 'Formatting response', {
        definition,
        request,
        organizationSlug,
        taskId: taskId ?? undefined,
        progress: 80,
      });

      const responseData = responseTyped.data;
      const formattedContent = this.formatApiResponse(
        responseData,
        definition.config?.deliverable?.format || 'json',
        {
          statusCode,
          headers: responseTyped.headers,
          duration,
        },
      );

      // 8. Save deliverable (unless configured to skip and wait for completion)
      const deliverableConfig = this.asRecord(definition.config?.deliverable);
      const skipDeliverable = deliverableConfig?.skip === true;

      if (skipDeliverable) {
        this.logger.log(
          `Async agent ${definition.slug} - waiting for completion callback`,
        );

        // Wait for the completion callback to be triggered
        // The completion endpoint will emit 'task.completion' event with deliverable
        const completionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => {
              this.eventEmitter.removeAllListeners(`task.completion.${taskId}`);
              reject(new Error('Task completion timeout after 5 minutes'));
            },
            5 * 60 * 1000,
          ); // 5 minute timeout

          this.eventEmitter.once(
            `task.completion.${taskId}`,
            (data: { deliverable: unknown; error?: string }) => {
              clearTimeout(timeout);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.deliverable);
              }
            },
          );
        });

        try {
          const deliverable = await completionPromise;

          return TaskResponseDto.success(AgentTaskMode.BUILD, {
            content: deliverable,
            metadata: this.buildMetadata(request, {
              apiUrl: url,
              method,
              statusCode,
              duration,
              success: isSuccess,
              async: true,
            }),
          });
        } catch (error) {
          return TaskResponseDto.failure(
            AgentTaskMode.BUILD,
            error instanceof Error ? error.message : 'Task completion failed',
          );
        }
      }

      const targetDeliverableId = this.resolveDeliverableIdFromRequest(request);

      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            ((request.payload as Record<string, unknown>)?.title as string) ||
            `API Response: ${definition.displayName}`,
          content: formattedContent,
          format: definition.config?.deliverable?.format || 'json',
          type: definition.config?.deliverable?.type || 'api-response',
          deliverableId: targetDeliverableId ?? undefined,
          agentName: definition.slug,
          namespace: organizationSlug || 'default',
          taskId: taskId ?? undefined,
          metadata: {
            apiUrl: url,
            method,
            statusCode,
            duration,
            success: isSuccess,
          },
        },
        {
          conversationId,
          userId,
          agentSlug: definition.slug,
          taskId: taskId ?? undefined,
        },
      );

      if (!deliverableResult.success) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          deliverableResult.error?.message || 'Failed to create deliverable',
        );
      }

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: deliverableResult.data,
        metadata: this.buildMetadata(request, {
          apiUrl: url,
          method,
          statusCode,
          duration,
          success: isSuccess,
        }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `API agent ${definition.slug} BUILD failed: ${errorMessage}`,
      );

      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        `Failed to execute API agent: ${errorMessage}`,
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toPlainRecord(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(Object.entries(record)) as Record<
      string,
      unknown
    >;
  }

  private ensureString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private ensureNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  /**
   * Build request headers with interpolation and authentication
   */
  private buildHeaders(
    configHeaders: Record<string, unknown>,
    request: TaskRequestDto,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Orchestrator-AI/1.0',
    };

    // Add configured headers with interpolation
    for (const [key, value] of Object.entries(configHeaders)) {
      if (typeof value === 'string') {
        headers[key] = this.interpolateString(value, request);
      } else {
        headers[key] = String(value);
      }
    }

    return headers;
  }

  /**
   * Interpolate a string with request data
   * Supports {{payload.field}}, {{metadata.field}}, {{userMessage}}, {{taskId}}, {{conversationId}}, {{userId}} syntax
   */
  private interpolateString(template: string, request: TaskRequestDto): string {
    return template.replace(
      /\{\{([^}]+)\}\}/g,
      (match: string, path: string) => {
        const keys = path.trim().split('.');
        let value: unknown = request;

        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            return match; // Keep original if not found
          }
        }

        return typeof value === 'string' ? value : JSON.stringify(value);
      },
    );
  }

  /**
   * Interpolate an object recursively with request data
   */
  private interpolateObject(
    obj: Record<string, unknown>,
    request: TaskRequestDto,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.interpolateString(value, request);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(
          value as Record<string, unknown>,
          request,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Format API response based on output format
   */
  private formatApiResponse(
    data: unknown,
    format: string,
    metadata: {
      statusCode: number;
      headers: Record<string, unknown>;
      duration: number;
    },
  ): string {
    // If data is an object with a 'markdown' field, extract it directly
    if (data && typeof data === 'object' && 'markdown' in data) {
      const markdownContent = (data as { markdown: unknown }).markdown;
      return typeof markdownContent === 'string'
        ? markdownContent
        : String(markdownContent);
    }

    // If data is already a string (assumed to be markdown), return it directly
    if (typeof data === 'string') {
      return data;
    }

    // Legacy behavior: wrap in JSON structure
    if (format === 'json') {
      return JSON.stringify(
        {
          statusCode: metadata.statusCode,
          duration: metadata.duration,
          data,
        },
        null,
        2,
      );
    } else if (format === 'markdown') {
      let markdown = '# API Response\n\n';
      markdown += `**Status Code:** ${metadata.statusCode}\n`;
      markdown += `**Duration:** ${metadata.duration}ms\n\n`;
      markdown += '## Response Data\n\n';
      markdown += '```json\n';
      markdown += JSON.stringify(data, null, 2);
      markdown += '\n```\n';
      return markdown;
    } else {
      // Plain text or fallback
      return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Execute API call asynchronously (for websocket/polling modes)
   * This runs the same logic as executeBuild but without waiting for completion
   */
  private async executeApiCallAsync(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
    userId: string,
    conversationId: string,
    taskId: string | null,
  ): Promise<void> {
    try {
      this.logger.log(`🚀 Starting async API execution for task ${taskId}`);

      // Create enriched request
      const payload = request.payload;
      const config = payload?.config as
        | { provider?: string; model?: string }
        | undefined;
      const provider = config?.provider ?? null;
      const model = config?.model ?? null;

      const enrichedRequest = {
        ...request,
        userId,
        conversationId,
        taskId: taskId ?? undefined,
        payload: {
          ...(request.payload as Record<string, unknown>),
          provider,
          model,
        },
      };

      // Get API configuration (same as sync version)
      const apiConfig = this.asRecord(definition.config?.api);
      if (!apiConfig) {
        this.logger.error(`No API configuration found for ${definition.slug}`);
        return;
      }

      const urlTemplate =
        this.ensureString(apiConfig.url) ??
        this.ensureString(apiConfig.endpoint);
      if (!urlTemplate) {
        this.logger.error(
          `API configuration missing URL for ${definition.slug}`,
        );
        return;
      }

      // Execute HTTP request
      const url = this.interpolateString(urlTemplate, enrichedRequest);
      const method = (
        this.ensureString(apiConfig.method) ?? 'GET'
      ).toUpperCase();

      const headersRecord = this.asRecord(apiConfig.headers);
      const headers = this.buildHeaders(
        headersRecord ? this.toPlainRecord(headersRecord) : {},
        enrichedRequest,
      );

      let body: unknown = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && apiConfig.body) {
        const bodyRecord = this.asRecord(apiConfig.body);
        if (bodyRecord) {
          body = this.interpolateObject(
            this.toPlainRecord(bodyRecord),
            enrichedRequest,
          );
        } else if (typeof apiConfig.body === 'string') {
          body = this.interpolateString(apiConfig.body, enrichedRequest);
        } else {
          body = apiConfig.body;
        }
      }

      let queryParams: Record<string, unknown> = {};
      const queryParamsRecord = this.asRecord(apiConfig.queryParams);
      if (queryParamsRecord) {
        queryParams = this.interpolateObject(
          this.toPlainRecord(queryParamsRecord),
          enrichedRequest,
        );
      }

      this.logger.log(`📡 Making async API call to ${url}`);
      const startTime = Date.now();

      const observable = this.httpService.request({
        url,
        method: method,
        headers,
        data: body,
        params: queryParams,
        timeout: this.ensureNumber(apiConfig.timeout) ?? 30000,
        validateStatus: () => true,
      });

      const response = await firstValueFrom(observable);
      const duration = Date.now() - startTime;

      const responseTyped = response as {
        status: number;
        data: unknown;
        headers: Record<string, unknown>;
      };

      this.logger.log(
        `✅ Async API call completed: ${responseTyped.status} in ${duration}ms`,
      );

      // Format response and create deliverable
      const responseData = responseTyped.data;
      const formattedContent = this.formatApiResponse(
        responseData,
        definition.config?.deliverable?.format || 'json',
        {
          statusCode: responseTyped.status,
          headers: responseTyped.headers,
          duration,
        },
      );

      const targetDeliverableId = this.resolveDeliverableIdFromRequest(request);

      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            ((request.payload as Record<string, unknown>)?.title as string) ||
            `API Response: ${definition.displayName}`,
          content: formattedContent,
          format: definition.config?.deliverable?.format || 'json',
          type: definition.config?.deliverable?.type || 'api-response',
          deliverableId: targetDeliverableId ?? undefined,
        },
        {
          conversationId: conversationId || '',
          userId: userId || 'unknown',
          organizationSlug: organizationSlug || 'global',
        },
      );

      // Emit completion event with deliverable
      if (taskId) {
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          deliverable: deliverableResult.data,
        });

        this.logger.log(`📨 Emitted task completion event for ${taskId}`);
      }
    } catch (error) {
      this.logger.error(`❌ Async API execution failed:`, error);

      if (taskId) {
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          error:
            error instanceof Error ? error.message : 'Async execution failed',
        });
      }
    }
  }
}
