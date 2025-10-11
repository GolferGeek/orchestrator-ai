import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { DeliverablesService } from '../deliverables/deliverables.service';

/**
 * External Agent Runner
 *
 * Executes agents that call external A2A-compatible agents. External agents:
 * - Call other agent systems via HTTP using A2A protocol
 * - Forward task requests to external endpoints
 * - Handle external agent responses
 * - Support authentication and routing
 * - Store external agent results as deliverables
 *
 * External agents are configured with:
 * - config.external.url: External agent endpoint URL
 * - config.external.apiKey: Authentication API key
 * - config.external.headers: Additional request headers
 * - config.external.timeout: Request timeout
 * - config.deliverable: Output format configuration
 *
 * @example
 * Agent configuration:
 * {
 *   type: 'external',
 *   config: {
 *     external: {
 *       url: 'https://external-agent.example.com/task',
 *       apiKey: 'secret-key',
 *       timeout: 60000
 *     },
 *     deliverable: {
 *       format: 'json',
 *       type: 'external-response'
 *     }
 *   }
 * }
 */
@Injectable()
export class ExternalAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(ExternalAgentRunnerService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly deliverablesService: DeliverablesService,
  ) {
    super();
  }

  /**
   * CONVERSE mode - forward to external agent
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return await this.forwardToExternalAgent(
      definition,
      request,
      organizationSlug,
      AgentTaskMode.CONVERSE,
    );
  }

  /**
   * PLAN mode - forward to external agent
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return await this.forwardToExternalAgent(
      definition,
      request,
      organizationSlug,
      AgentTaskMode.PLAN,
    );
  }

  /**
   * BUILD mode - forward to external agent
   */
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Check for non-create actions (read, list, etc.)
    const action = (request.payload as any)?.action;
    if (action && action !== 'create') {
      return await this.handleBuildAction(
        definition,
        request,
        organizationSlug,
      );
    }

    return await this.forwardToExternalAgent(
      definition,
      request,
      organizationSlug,
      AgentTaskMode.BUILD,
    );
  }

  /**
   * Forward task request to external agent
   */
  private async forwardToExternalAgent(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
    mode: AgentTaskMode,
  ): Promise<TaskResponseDto> {
    try {
      // Validate required context
      const userId = this.resolveUserId(request);
      const conversationId = this.resolveConversationId(request);
      const taskId = (request.payload as any)?.taskId || null;

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          mode,
          'Missing required userId or conversationId for external agent call',
        );
      }

      // Get external agent configuration
      const externalConfig = definition.config?.external;
      if (!externalConfig || !externalConfig.url) {
        return TaskResponseDto.failure(
          mode,
          'No external agent configuration found or URL missing',
        );
      }

      this.logger.log(
        `Forwarding ${mode} request to external agent at ${externalConfig.url}`,
      );

      // 1. Build A2A request
      const a2aRequest: TaskRequestDto = {
        mode,
        conversationId,
        sessionId: request.sessionId,
        userMessage: request.userMessage,
        payload: request.payload,
        metadata: {
          ...request.metadata,
          forwardedFrom: definition.slug,
          organizationSlug,
        },
      };

      // 2. Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Orchestrator-AI-A2A/1.0',
      };

      // Add API key if configured
      if (externalConfig.apiKey) {
        headers['X-API-Key'] = externalConfig.apiKey;
      }

      // Add custom headers
      if (externalConfig.headers) {
        Object.assign(headers, externalConfig.headers);
      }

      // 3. Execute HTTP request
      const startTime = Date.now();
      let response: any;

      try {
        const observable = this.httpService.request({
          url: externalConfig.url,
          method: 'POST',
          headers,
          data: a2aRequest,
          timeout: externalConfig.timeout || 60000,
          validateStatus: () => true, // Don't throw on non-2xx status
        });

        response = await firstValueFrom(observable);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`External agent call failed: ${errorMessage}`);

        return TaskResponseDto.failure(
          mode,
          `External agent call failed: ${errorMessage}`,
        );
      }

      const duration = Date.now() - startTime;

      // 4. Check response status
      const statusCode = response.status;
      if (statusCode !== 200) {
        return TaskResponseDto.failure(
          mode,
          `External agent returned error status ${statusCode}: ${JSON.stringify(response.data)}`,
        );
      }

      // 5. Parse A2A response
      const a2aResponse = response.data as TaskResponseDto;

      if (!a2aResponse || typeof a2aResponse.success !== 'boolean') {
        return TaskResponseDto.failure(
          mode,
          'Invalid A2A response format from external agent',
        );
      }

      // 6. If BUILD mode and successful, save deliverable
      if (mode === AgentTaskMode.BUILD && a2aResponse.success) {
        const deliverableResult = await this.deliverablesService.executeAction(
          'create',
          {
            title:
              (request.payload as any)?.title ||
              `External Agent Response: ${definition.displayName}`,
            content: JSON.stringify(a2aResponse.payload?.content, null, 2),
            format: definition.config?.deliverable?.format || 'json',
            type: definition.config?.deliverable?.type || 'external-response',
            agentName: definition.slug,
            namespace: organizationSlug || 'default',
            taskId: taskId || undefined,
            metadata: {
              externalUrl: externalConfig.url,
              duration,
              externalAgentSuccess: a2aResponse.success,
              externalMetadata: a2aResponse.payload?.metadata,
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
            mode,
            deliverableResult.error?.message || 'Failed to create deliverable',
          );
        }

        return TaskResponseDto.success(mode, {
          content: deliverableResult.data,
          metadata: this.buildMetadata(request, {
            externalUrl: externalConfig.url,
            duration,
            externalAgentSuccess: a2aResponse.success,
            externalMetadata: a2aResponse.payload?.metadata,
          }),
        });
      }

      // 7. For CONVERSE/PLAN or failed BUILD, return external response directly
      return a2aResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `External agent ${definition.slug} ${mode} failed: ${errorMessage}`,
      );

      return TaskResponseDto.failure(
        mode,
        `Failed to execute external agent: ${errorMessage}`,
      );
    }
  }

  /**
   * Handle non-create BUILD actions (read, list, etc.)
   */
  private async handleBuildAction(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const action = (request.payload as any)?.action;
    const userId = this.resolveUserId(request);
    const conversationId = this.resolveConversationId(request);

    if (!userId || !conversationId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Missing required userId or conversationId',
      );
    }

    // Route to DeliverablesService for non-create actions
    const result = await this.deliverablesService.executeAction(
      action,
      request.payload,
      {
        conversationId,
        userId,
        agentSlug: definition.slug,
      },
    );

    if (!result.success) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        result.error?.message || `Action ${action} failed`,
      );
    }

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: result.data,
      metadata: this.buildMetadata(request, {
        action,
      }),
    });
  }
}
