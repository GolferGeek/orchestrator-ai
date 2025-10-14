import { Injectable, Logger } from '@nestjs/common';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
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
   * CONVERSE mode - not yet implemented for tool agents
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.CONVERSE,
      'CONVERSE mode not yet implemented for tool agents',
    );
  }

  /**
   * PLAN mode - not yet implemented for tool agents
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.PLAN,
      'PLAN mode not yet implemented for tool agents',
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
      const payloadOverrides = ((request.payload as any) ?? {}) as Record<
        string,
        any
      >;

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

      // 1. Get tool configuration from agent definition
      let tools = definition.config?.tools || [];
      if (
        Array.isArray(payloadOverrides.tools) &&
        payloadOverrides.tools.length > 0
      ) {
        tools = payloadOverrides.tools;
      }
      const toolParams = {
        ...(definition.config?.toolParams || {}),
        ...(payloadOverrides.toolParams || {}),
      };

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
      const toolResults = [];
      const executionMode =
        payloadOverrides.toolExecutionMode ||
        definition.config?.toolExecutionMode ||
        'sequential';
      const stopOnError =
        payloadOverrides.stopOnError ?? definition.config?.stopOnError ?? true;

      if (executionMode === 'parallel') {
        // Execute all tools in parallel
        const promises = tools.map((toolName: string) =>
          this.executeTool(toolName, toolParams[toolName] || {}, request),
        );
        const results = await Promise.allSettled(promises);

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result && result.status === 'fulfilled') {
            toolResults.push({
              tool: tools[i],
              success: true,
              result: result.value,
            });
          } else if (result && result.status === 'rejected') {
            const reason = result.reason;
            toolResults.push({
              tool: tools[i],
              success: false,
              error: reason?.message || String(reason),
            });
          }
        }
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
            if (stopOnError !== false) {
              break;
            }
          }
        }
      }

      // 3. Format results
      const successfulTools = toolResults.filter((r) => r.success);
      const failedTools = toolResults.filter((r) => !r.success);

      const formattedContent = this.formatToolResults(
        toolResults,
        definition.config?.deliverable?.format || 'json',
      );

      // 4. Save deliverable
      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            (request.payload as any)?.title ||
            `Tool Execution: ${definition.displayName}`,
          content: formattedContent,
          format: definition.config?.deliverable?.format || 'json',
          type: definition.config?.deliverable?.type || 'tool-result',
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
        return result.content.map((item: any) => {
          if (item.type === 'text') {
            return item.text;
          } else if (item.type === 'image') {
            return { type: 'image', data: item.data, mimeType: item.mimeType };
          } else if (item.type === 'resource') {
            return {
              type: 'resource',
              uri: item.uri,
              text: item.text,
              mimeType: item.mimeType,
            };
          }
          return item;
        });
      }
      return result.content;
    } else {
      const errorContent = result.content as any;
      throw new Error(errorContent?.[0]?.text || 'Tool execution failed');
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
