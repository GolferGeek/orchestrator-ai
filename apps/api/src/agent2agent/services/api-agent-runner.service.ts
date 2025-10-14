import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { LLMService } from '@llm/llm.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';

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
    private readonly httpService: HttpService,
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
    );
  }

  /**
   * CONVERSE mode - not yet implemented for API agents
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.CONVERSE,
      'CONVERSE mode not yet implemented for API agents',
    );
  }

  /**
   * PLAN mode - not yet implemented for API agents
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.PLAN,
      'PLAN mode not yet implemented for API agents',
    );
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
      const taskId = (request.payload as any)?.taskId || null;

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Missing required userId or conversationId for API execution',
        );
      }

      // Get API configuration
      const apiConfig = definition.config?.api;
      if (!apiConfig || !apiConfig.url) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'No API configuration found or URL missing',
        );
      }

      this.logger.log(
        `Executing API call to ${apiConfig.url} for agent ${definition.slug}`,
      );

      // 1. Interpolate URL and parameters
      const url = this.interpolateString(apiConfig.url, request);
      const method = (apiConfig.method || 'GET').toUpperCase();

      // 2. Build headers
      const headers = this.buildHeaders(apiConfig.headers || {}, request);

      // 3. Build request body (for POST/PUT/PATCH)
      let body: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && apiConfig.body) {
        body = this.interpolateObject(apiConfig.body, request);
      }

      // 4. Build query parameters
      let queryParams: Record<string, any> = {};
      if (apiConfig.queryParams) {
        queryParams = this.interpolateObject(apiConfig.queryParams, request);
      }

      // 5. Execute HTTP request
      const startTime = Date.now();
      let response: any;

      try {
        const observable = this.httpService.request({
          url,
          method: method,
          headers,
          data: body,
          params: queryParams,
          timeout: apiConfig.timeout || 30000,
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

      // 6. Check response status
      const statusCode = response.status;
      const isSuccess = statusCode >= 200 && statusCode < 300;

      if (!isSuccess && apiConfig.failOnError !== false) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          `API returned error status ${statusCode}: ${JSON.stringify(response.data)}`,
        );
      }

      // 7. Format response data
      const responseData = response.data;
      const formattedContent = this.formatApiResponse(
        responseData,
        definition.config?.deliverable?.format || 'json',
        {
          statusCode,
          headers: response.headers,
          duration,
        },
      );

      // 8. Save deliverable
      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            (request.payload as any)?.title ||
            `API Response: ${definition.displayName}`,
          content: formattedContent,
          format: definition.config?.deliverable?.format || 'json',
          type: definition.config?.deliverable?.type || 'api-response',
          agentName: definition.slug,
          namespace: organizationSlug || 'default',
          taskId: taskId || undefined,
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
          taskId: taskId || undefined,
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

  /**
   * Build request headers with interpolation and authentication
   */
  private buildHeaders(
    configHeaders: Record<string, any>,
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
   * Supports {{payload.field}}, {{metadata.field}}, {{userMessage}} syntax
   */
  private interpolateString(template: string, request: TaskRequestDto): string {
    return template.replace(
      /\{\{([^}]+)\}\}/g,
      (match: string, path: string) => {
        const keys = path.trim().split('.');
        let value: any = request;

        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
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
    obj: Record<string, any>,
    request: TaskRequestDto,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.interpolateString(value, request);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value, request);
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
    data: any,
    format: string,
    metadata: { statusCode: number; headers: any; duration: number },
  ): string {
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
      // Plain text or raw response
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  }
}
