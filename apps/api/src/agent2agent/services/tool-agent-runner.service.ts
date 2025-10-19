import { Injectable, Logger } from '@nestjs/common';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { MCPService } from '../../mcp/mcp.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { LLMService } from '@llm/llm.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';

/**
 * Tool Agent Runner
 *
 * Executes agents that invoke MCP tools. Tool agents:
 * - Execute one or more MCP tool calls in BUILD mode
 * - Can chain tool calls together
 * - Store tool results as deliverables
 * - Support tool configuration via agent config
 *
 * Tool agents are configured with:
 * - config.tools: Array of tool names to execute
 * - config.toolParams: Parameters for each tool
 * - config.deliverable: Output format configuration
 *
 * @example
 * Agent configuration:
 * {
 *   type: 'tool',
 *   config: {
 *     tools: ['supabase/query', 'slack/post-message'],
 *     toolParams: {
 *       'supabase/query': { table: 'users' },
 *       'slack/post-message': { channel: '#general' }
 *     },
 *     deliverable: {
 *       format: 'json',
 *       type: 'tool-result'
 *     }
 *   }
 * }
 */
@Injectable()
export class ToolAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(ToolAgentRunnerService.name);

  constructor(
    private readonly mcpService: MCPService,
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
   * PLAN mode - not yet implemented for tool agents
   */
  protected handlePlan(
    _definition: AgentRuntimeDefinition,
    _request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return Promise.resolve(
      TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'PLAN mode not yet implemented for tool agents',
      ),
    );
  }

  /**
   * BUILD mode - execute MCP tools and save results
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const payloadOverrides = (request.payload as Record<string, unknown>) ?? {};

      // Validate required context
      const userId = this.resolveUserId(request);
      const conversationId = this.resolveConversationId(request);
      const taskId = payloadOverrides.taskId || null;

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Missing required userId or conversationId for tool execution',
        );
      }

      const configRecord = this.asRecord(definition.config);
      const configTools = this.ensureStringArray(configRecord?.tools) ?? [];
      const overrideTools = this.ensureStringArray(payloadOverrides.tools);
      const tools: string[] =
        overrideTools && overrideTools.length > 0 ? overrideTools : configTools;

      const toolParams = this.mergeToolParams(
        this.asRecord(configRecord?.toolParams),
        this.asRecord(payloadOverrides.toolParams),
      );

      if (tools.length === 0) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'No tools configured for this agent',
        );
      }

      this.logger.log(
        `Executing ${tools.length} tools for agent ${definition.slug}`,
      );

      // 2. Execute tools sequentially (or in parallel if configured)
      const toolResults: Array<{
        tool: string;
        success: boolean;
        result?: any;
        error?: string;
      }> = [];
      const executionMode = this.resolveExecutionMode(
        payloadOverrides.toolExecutionMode ?? configRecord?.toolExecutionMode,
      );
      const stopOnError =
        this.ensureBoolean(payloadOverrides.stopOnError) ??
        this.ensureBoolean(configRecord?.stopOnError) ??
        true;

      if (executionMode === 'parallel') {
        // Execute all tools in parallel
        const promises = tools.map((toolName) =>
          this.executeTool(toolName, toolParams[toolName] ?? {}, request),
        );
        const results = await Promise.allSettled(promises);

        tools.forEach((toolName, index) => {
          const result = results[index];
          if (!result) {
            return;
          }
          if (result.status === 'fulfilled') {
            toolResults.push({
              tool: toolName,
              success: true,
              result: result.value,
            });
          } else {
            const reason = result.reason;
            toolResults.push({
              tool: toolName,
              success: false,
              error: reason?.message || String(reason),
            });
          }
        });
      } else {
        // Execute tools sequentially
        for (const toolName of tools) {
          try {
            const params = toolParams[toolName] || {};
            const result = await this.executeTool(toolName, params, request);

            toolResults.push({
              tool: toolName,
              success: true,
              result,
            });

            this.logger.debug(`Tool ${toolName} executed successfully`);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            toolResults.push({
              tool: toolName,
              success: false,
              error: errorMessage,
            });

            this.logger.error(`Tool ${toolName} failed: ${errorMessage}`);

            // Stop execution on first error if stopOnError is true
            if (stopOnError) {
              break;
            }
          }
        }
      }

      // 3. Format results
      const successfulTools = toolResults.filter((r) => r.success);
      const failedTools = toolResults.filter((r) => !r.success);

      const deliverableConfig = this.asRecord(configRecord?.deliverable);
      const deliverableFormat =
        this.ensureString(deliverableConfig?.format) ?? 'json';
      const formattedContent = this.formatToolResults(
        toolResults,
        deliverableFormat,
      );

      const targetDeliverableId = this.resolveDeliverableIdFromRequest(request);

      // 4. Save deliverable
      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            (request.payload as Record<string, unknown>)?.title ||
            `Tool Execution: ${definition.displayName}`,
          content: formattedContent,
          format: definition.config?.deliverable?.format || 'json',
          type: definition.config?.deliverable?.type || 'tool-result',
          deliverableId: targetDeliverableId ?? undefined,
          agentName: definition.slug,
          namespace: organizationSlug || 'default',
          taskId: taskId || undefined,
          metadata: {
            toolsExecuted: tools.length,
            successfulTools: successfulTools.length,
            failedTools: failedTools.length,
            executionMode,
            stopOnError: stopOnError !== false,
            toolsUsed: tools,
          },
        },
        {
          conversationId,
          userId,
          agentSlug: definition.slug,
          taskId: (typeof taskId === 'string' ? taskId : undefined),
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
          toolsExecuted: tools.length,
          successfulTools: successfulTools.length,
          failedTools: failedTools.length,
          executionMode,
        }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Tool agent ${definition.slug} BUILD failed: ${errorMessage}`,
      );

      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        `Failed to execute tool agent: ${errorMessage}`,
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toPlainRecord(record: Record<string, unknown>): Record<string, any> {
    return Object.fromEntries(Object.entries(record)) as Record<string, any>;
  }

  private ensureString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private ensureStringArray(value: unknown): string[] | null {
    if (!value) {
      return null;
    }
    if (Array.isArray(value)) {
      const sanitized = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
        .filter((entry): entry is string => Boolean(entry));
      return sanitized.length ? sanitized : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : null;
    }
    return null;
  }

  private ensureBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return null;
  }

  private resolveExecutionMode(value: unknown): 'sequential' | 'parallel' {
    const normalized = this.ensureString(value);
    return normalized === 'parallel' ? 'parallel' : 'sequential';
  }

  private mergeToolParams(
    base: Record<string, unknown> | null,
    override: Record<string, unknown> | null,
  ): Record<string, Record<string, any>> {
    const merged: Record<string, Record<string, any>> = {};

    const apply = (source: Record<string, unknown> | null) => {
      if (!source) {
        return;
      }
      for (const [key, value] of Object.entries(source)) {
        const record = this.asRecord(value);
        if (record) {
          merged[key] = this.toPlainRecord(record);
        }
      }
    };

    apply(base);
    apply(override);

    return merged;
  }

  /**
   * Execute a single MCP tool
   */
  private async executeTool(
    toolName: string,
    params: Record<string, any>,
    request: TaskRequestDto,
  ): Promise<any> {
    this.logger.debug(`Executing tool: ${toolName}`);

    // Interpolate parameters with request data
    const interpolatedParams = this.interpolateParams(params, request);

    // Call MCP service
    const result = await this.mcpService.callTool({
      name: toolName,
      arguments: interpolatedParams,
    });

    if (!result.isError && result.content) {
      // Extract content from MCP response
      if (Array.isArray(result.content)) {
        // Handle array of content items
        return result.content.map((item: unknown) => {
          const itemRec = item as Record<string, unknown>;
          if (itemRec.type === 'text') {
            return itemRec.text;
          } else if (itemRec.type === 'image') {
            return { type: 'image', data: itemRec.data, mimeType: itemRec.mimeType };
          } else if (itemRec.type === 'resource') {
            return {
              type: 'resource',
              uri: itemRec.uri,
              text: itemRec.text,
              mimeType: itemRec.mimeType,
            };
          }
          return item;
        });
      }
      return result.content;
    } else {
      const errorContent = result.content as unknown as Array<Record<string, unknown>>;
      throw new Error((errorContent?.[0]?.text as string) || 'Tool execution failed');
    }
  }

  /**
   * Interpolate parameters with request data
   * Supports {{payload.field}} and {{metadata.field}} syntax
   */
  private interpolateParams(
    params: Record<string, any>,
    request: TaskRequestDto,
  ): Record<string, any> {
    const interpolated: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Replace template variables
        interpolated[key] = value.replace(
          /\{\{([^}]+)\}\}/g,
          (match: string, path: string) => {
            const keys = path.trim().split('.');
            let val: any = request;

            for (const k of keys) {
              if (val && typeof val === 'object' && k in val) {
                val = val[k];
              } else {
                return match; // Keep original if not found
              }
            }

            return typeof val === 'string' ? val : JSON.stringify(val);
          },
        );
      } else {
        interpolated[key] = value;
      }
    }

    return interpolated;
  }

  /**
   * Format tool results based on output format
   */
  private formatToolResults(
    results: Array<{
      tool: string;
      success: boolean;
      result?: any;
      error?: string;
    }>,
    format: string,
  ): string {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    } else if (format === 'markdown') {
      let markdown = '# Tool Execution Results\n\n';

      for (const result of results) {
        markdown += `## ${result.tool}\n\n`;

        if (result.success) {
          markdown += '**Status:** ✅ Success\n\n';
          markdown += '**Result:**\n```json\n';
          markdown += JSON.stringify(result.result, null, 2);
          markdown += '\n```\n\n';
        } else {
          markdown += '**Status:** ❌ Failed\n\n';
          markdown += `**Error:** ${result.error}\n\n`;
        }
      }

      return markdown;
    } else {
      // Default to plain text
      return results
        .map((r) => {
          if (r.success) {
            return `${r.tool}: SUCCESS\n${JSON.stringify(r.result)}`;
          } else {
            return `${r.tool}: FAILED - ${r.error}`;
          }
        })
        .join('\n\n');
    }
  }
}
