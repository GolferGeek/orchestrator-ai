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
import { StreamingService } from './streaming.service';

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
    streamingService: StreamingService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
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
      const payloadOverrides =
        (request.payload as Record<string, unknown>) ?? {};

      // Validate required context
      const userId = this.resolveUserId(request);
      const conversationId = this.resolveConversationId(request);
      const taskIdRaw: unknown = payloadOverrides.taskId;
      const taskId = taskIdRaw || null;

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

      // Extract provider/model from request metadata for LLM-powered tools
      const metadata = this.asRecord(request.metadata);
      const payload = this.asRecord(request.payload);

      // Check for provider/model in metadata.buildRerun.config (from rerun action)
      const buildRerun = this.asRecord(metadata?.buildRerun);
      const buildRerunConfig = this.asRecord(buildRerun?.config);

      // Check for provider/model in payload.config (from frontend)
      const payloadConfig = this.asRecord(payload?.config);

      // Try metadata first, then buildRerun.config, then payload.config
      const providerFromMetadata =
        this.ensureString(metadata?.provider) ||
        this.ensureString(buildRerunConfig?.provider) ||
        this.ensureString(payloadConfig?.provider);
      const modelFromMetadata =
        this.ensureString(metadata?.model) ||
        this.ensureString(buildRerunConfig?.model) ||
        this.ensureString(payloadConfig?.model);

      this.logger.debug(
        `Provider/model extraction - ` +
          `metadata: ${String(metadata?.provider)}/${String(metadata?.model)}, ` +
          `buildRerun.config: ${String(buildRerunConfig?.provider)}/${String(buildRerunConfig?.model)}, ` +
          `payload.config: ${String(payloadConfig?.provider)}/${String(payloadConfig?.model)}, ` +
          `final: ${providerFromMetadata}/${modelFromMetadata}`,
      );

      // Merge tool params: config < payload < metadata (for provider/model)
      const toolParams = this.mergeToolParams(
        this.asRecord(configRecord?.toolParams),
        this.asRecord(payloadOverrides.toolParams),
      );

      // Auto-inject provider/model from metadata into LLM-powered tools
      if (providerFromMetadata && modelFromMetadata) {
        // Inject into generate-sql tool
        const generateSqlParams = toolParams['supabase/generate-sql'] || {};
        toolParams['supabase/generate-sql'] = {
          ...generateSqlParams,
          provider: providerFromMetadata,
          model: modelFromMetadata,
        };

        // Inject into analyze-results tool
        const analyzeResultsParams =
          toolParams['supabase/analyze-results'] || {};
        toolParams['supabase/analyze-results'] = {
          ...analyzeResultsParams,
          provider: providerFromMetadata,
          model: modelFromMetadata,
        };

        this.logger.debug(
          `Auto-injected LLM config for Supabase tools: ${providerFromMetadata}/${modelFromMetadata}`,
        );
      }

      // Validate tools configuration
      if (tools.length === 0) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'No tools configured for this agent',
        );
      }

      // Validate namespace format for all tools (fail-fast per PRD §6)
      for (const toolName of tools) {
        if (!toolName.includes('/')) {
          return TaskResponseDto.failure(
            AgentTaskMode.BUILD,
            `Tool '${toolName}' must include namespace: expected 'namespace/tool'`,
          );
        }
      }

      // 2. Resolve execution configuration
      const executionMode = this.resolveExecutionMode(
        payloadOverrides.toolExecutionMode ?? configRecord?.toolExecutionMode,
      );
      const stopOnError =
        this.ensureBoolean(payloadOverrides.stopOnError) ??
        this.ensureBoolean(configRecord?.stopOnError) ??
        true;

      // Log execution metadata for observability (PRD §8)
      this.logger.log(
        `Executing ${tools.length} tools for agent ${definition.slug}`,
      );
      this.logger.debug(
        `Tool execution config - Mode: ${executionMode}, StopOnError: ${stopOnError}, Tools: ${tools.join(', ')}`,
      );

      // 3. Execute tools sequentially (or in parallel if configured)
      const toolResults: Array<{
        tool: string;
        success: boolean;
        result?: unknown;
        error?: string;
      }> = [];

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
            const resultValue: unknown = result.value;
            toolResults.push({
              tool: toolName,
              success: true,
              result: resultValue,
            });
          } else {
            const reason: unknown = result.reason;
            const reasonObj = reason as { message?: string } | undefined;
            toolResults.push({
              tool: toolName,
              success: false,
              error: reasonObj?.message || String(reason),
            });
          }
        });
      } else {
        // Execute tools sequentially with result chaining
        let previousResult: unknown = null;

        for (const toolName of tools) {
          try {
            let params = toolParams[toolName] || {};

            // Auto-inject provider/model for LLM-powered tools
            if (providerFromMetadata && modelFromMetadata) {
              if (
                toolName === 'supabase/generate-sql' ||
                toolName === 'supabase/analyze-results'
              ) {
                params = {
                  ...params,
                  provider: providerFromMetadata,
                  model: modelFromMetadata,
                };
                this.logger.debug(
                  `Injected provider/model for ${toolName}: ${providerFromMetadata}/${modelFromMetadata}`,
                );
              }
            } else {
              this.logger.warn(
                `No provider/model metadata found for ${toolName}. Provider: ${providerFromMetadata}, Model: ${modelFromMetadata}`,
              );
            }

            // Chain results: merge previous tool's output into current params
            const chainedParams = this.chainToolParams(
              params,
              previousResult,
              toolName,
            );

            const result: unknown = await this.executeTool(
              toolName,
              chainedParams,
              request,
            );

            toolResults.push({
              tool: toolName,
              success: true,
              result,
            });

            previousResult = result;
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
      const configAny = definition.config as
        | Record<string, unknown>
        | undefined;
      const deliverableConfigAny = configAny?.deliverable as
        | Record<string, unknown>
        | undefined;
      const formatRaw: unknown = deliverableConfigAny?.format;
      const typeRaw: unknown = deliverableConfigAny?.type;

      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title:
            (request.payload as Record<string, unknown>)?.title ||
            `Tool Execution: ${definition.displayName}`,
          content: formattedContent,
          format: formatRaw || 'json',
          type: typeRaw || 'tool-result',
          deliverableId: targetDeliverableId ?? undefined,
          agentName: definition.slug,
          namespace: organizationSlug || 'default',
          taskId: taskId ?? undefined,
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
          taskId: typeof taskId === 'string' ? taskId : undefined,
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
          stopOnError,
          toolsUsed: tools,
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

  private toPlainRecord(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(Object.entries(record));
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

  /**
   * Chain tool parameters by merging previous tool's result
   *
   * Handles common chaining patterns:
   * - generate-sql outputs { sql: "..." } → execute-sql needs { sql: "..." }
   * - execute-sql outputs results array → analyze-results needs { data: [...] }
   * - JSON responses are parsed and merged into params
   */
  private chainToolParams(
    params: Record<string, unknown>,
    previousResult: unknown,
    currentToolName: string,
  ): Record<string, unknown> {
    if (!previousResult) {
      return params;
    }

    const chained = { ...params };

    // Parse JSON string results
    let resultData: unknown = previousResult;
    if (typeof previousResult === 'string') {
      try {
        resultData = JSON.parse(previousResult);
      } catch {
        // Not JSON, use as-is
        resultData = previousResult;
      }
    }

    // Handle array results (from MCP content array)
    if (Array.isArray(resultData) && resultData.length > 0) {
      // Extract first item if it's a string
      const firstItem = resultData[0] as unknown;
      if (typeof firstItem === 'string') {
        try {
          resultData = JSON.parse(firstItem) as Record<string, unknown>;
        } catch {
          resultData = firstItem;
        }
      }
    }

    // Tool-specific chaining logic
    if (
      currentToolName === 'supabase/execute-sql' ||
      currentToolName.endsWith('/execute-sql')
    ) {
      // execute-sql needs 'sql' param from generate-sql
      const resultObj = resultData as Record<string, unknown>;
      if (resultObj && typeof resultObj === 'object' && 'sql' in resultObj) {
        chained.sql = resultObj.sql;
        this.logger.debug(
          `Chained SQL: ${String(resultObj.sql).substring(0, 100)}...`,
        );
      }
    } else if (
      currentToolName === 'supabase/analyze-results' ||
      currentToolName.endsWith('/analyze-results')
    ) {
      // analyze-results needs 'data' param from execute-sql
      const resultObj = resultData as Record<string, unknown>;
      if (resultObj && typeof resultObj === 'object' && 'data' in resultObj) {
        // execute-sql returns { data: [...], row_count, ... }
        chained.data = resultObj.data;
        const dataArray = resultObj.data as unknown[];
        this.logger.debug(
          `Chained ${dataArray?.length || 0} result rows for analysis`,
        );
      } else if (Array.isArray(resultData)) {
        chained.data = resultData;
        this.logger.debug(
          `Chained ${resultData.length} result rows for analysis`,
        );
      } else if (
        resultObj &&
        typeof resultObj === 'object' &&
        'rows' in resultObj
      ) {
        chained.data = resultObj.rows;
      } else if (
        resultObj &&
        typeof resultObj === 'object' &&
        'results' in resultObj
      ) {
        chained.data = resultObj.results;
      } else {
        chained.data = resultData;
      }
    }

    return chained;
  }

  private mergeToolParams(
    base: Record<string, unknown> | null,
    override: Record<string, unknown> | null,
  ): Record<string, Record<string, unknown>> {
    const merged: Record<string, Record<string, unknown>> = {};

    // Apply base params first
    if (base) {
      for (const [key, value] of Object.entries(base)) {
        const record = this.asRecord(value);
        if (record) {
          merged[key] = this.toPlainRecord(record);
        }
      }
    }

    // Deep merge override params per tool
    if (override) {
      for (const [key, value] of Object.entries(override)) {
        const record = this.asRecord(value);
        if (record) {
          // Deep merge: combine base and override params for this tool
          merged[key] = {
            ...(merged[key] || {}),
            ...this.toPlainRecord(record),
          };
        }
      }
    }

    return merged;
  }

  /**
   * Execute a single MCP tool
   */
  private async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    request: TaskRequestDto,
  ): Promise<unknown> {
    this.logger.debug(
      `Executing tool: ${toolName} with params: ${JSON.stringify(params)}`,
    );

    // Interpolate parameters with request data
    const interpolatedParams = this.interpolateParams(params, request);
    this.logger.debug(
      `Interpolated params for ${toolName}: ${JSON.stringify(interpolatedParams)}`,
    );

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
            return {
              type: 'image',
              data: itemRec.data,
              mimeType: itemRec.mimeType,
            };
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
      const errorContent = result.content as unknown as Array<
        Record<string, unknown>
      >;
      throw new Error(
        (errorContent?.[0]?.text as string) || 'Tool execution failed',
      );
    }
  }

  /**
   * Interpolate parameters with request data
   *
   * Supports template variable syntax:
   * - `{{payload.field}}` - Access request payload fields
   * - `{{metadata.field}}` - Access request metadata fields
   * - `{{payload.nested.field}}` - Access nested object fields
   *
   * Non-string values are passed through as-is.
   *
   * @example
   * ```typescript
   * const params = {
   *   query: "{{payload.userMessage}}",
   *   max_rows: 100,
   *   table: "{{metadata.table}}"
   * };
   * const interpolated = this.interpolateParams(params, request);
   * // Result: { query: "actual message", max_rows: 100, table: "users" }
   * ```
   *
   * @param params - Parameter object with potential template variables
   * @param request - Task request containing payload and metadata
   * @returns Interpolated parameter object
   */
  private interpolateParams(
    params: Record<string, unknown>,
    request: TaskRequestDto,
  ): Record<string, unknown> {
    this.logger.debug(`[INTERPOLATE] Starting interpolation`);
    this.logger.debug(
      `[INTERPOLATE] Request keys: ${Object.keys(request).join(', ')}`,
    );
    this.logger.debug(
      `[INTERPOLATE] Request.payload type: ${typeof request.payload}`,
    );
    this.logger.debug(
      `[INTERPOLATE] Request.payload keys: ${request.payload && typeof request.payload === 'object' ? Object.keys(request.payload).join(', ') : 'none'}`,
    );
    this.logger.debug(
      `[INTERPOLATE] Params to interpolate: ${JSON.stringify(params).substring(0, 300)}`,
    );

    const interpolated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Replace template variables
        interpolated[key] = value.replace(
          /\{\{([^}]+)\}\}/g,
          (match: string, path: string) => {
            this.logger.debug(`[INTERPOLATE] Processing template: ${match}`);
            const keys = path.trim().split('.');
            let val: unknown = request;

            for (const k of keys) {
              if (val && typeof val === 'object' && k in val) {
                const objVal = val as Record<string, unknown>;
                val = objVal[k];
                this.logger.debug(
                  `[INTERPOLATE] Found key '${k}', type: ${typeof val}`,
                );
              } else {
                this.logger.warn(
                  `[INTERPOLATE] Template variable ${match} not found. Key '${k}' not in object. ` +
                    `Available keys: ${val && typeof val === 'object' ? Object.keys(val).join(', ') : 'none'}`,
                );
                return match; // Keep original if not found
              }
            }

            const result = typeof val === 'string' ? val : JSON.stringify(val);
            this.logger.debug(
              `[INTERPOLATE] Final value for ${match}: ${result}`,
            );
            return result;
          },
        );
      } else {
        const valueAny: unknown = value;
        interpolated[key] = valueAny;
      }
    }

    this.logger.debug(
      `[INTERPOLATE] Result: ${JSON.stringify(interpolated).substring(0, 300)}`,
    );
    return interpolated;
  }

  /**
   * Format tool results based on output format
   */
  private formatToolResults(
    results: Array<{
      tool: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }>,
    format: string,
  ): string {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    } else if (format === 'markdown') {
      // Check if these are Supabase tools for special formatting
      const isSupabaseTools = results.some((r) =>
        r.tool.startsWith('supabase/'),
      );

      if (isSupabaseTools) {
        return this.formatSupabaseResults(results);
      }

      // Default markdown formatting
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

  /**
   * Format Supabase tool results in a user-friendly markdown format
   */
  private formatSupabaseResults(
    results: Array<{
      tool: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }>,
  ): string {
    let markdown = '';

    // Extract SQL and analysis from results
    let sql = '';
    let analysis = '';
    const errors: string[] = [];

    for (const result of results) {
      if (!result.success) {
        errors.push(`${result.tool}: ${result.error}`);
        continue;
      }

      // Handle generate-sql result
      if (result.tool === 'supabase/generate-sql' && result.result) {
        try {
          const resultArray = Array.isArray(result.result)
            ? result.result
            : [result.result];
          const sqlData = JSON.parse(String(resultArray[0])) as Record<
            string,
            unknown
          >;
          sql = (sqlData.sql as string) || '';
        } catch {
          // Ignore parse errors
        }
      }

      // Handle analyze-results result
      if (result.tool === 'supabase/analyze-results' && result.result) {
        try {
          const resultArray = Array.isArray(result.result)
            ? result.result
            : [result.result];
          const analysisData =
            typeof resultArray[0] === 'string'
              ? (JSON.parse(resultArray[0]) as Record<string, unknown>)
              : (resultArray[0] as Record<string, unknown>);

          // Format the analysis nicely
          const stakeholderSummary = analysisData.stakeholder_summary as
            | Record<string, unknown>
            | undefined;
          if (stakeholderSummary?.key_insights) {
            analysis = '## Analysis\n\n';
            const insights = stakeholderSummary.key_insights;
            if (Array.isArray(insights)) {
              insights.forEach((insight: unknown) => {
                analysis += `- ${String(insight)}\n`;
              });
            }
          } else if (analysisData.key_insights) {
            analysis = '## Analysis\n\n';
            const insights = analysisData.key_insights as Record<
              string,
              unknown
            >;
            Object.values(insights).forEach((insight: unknown) => {
              analysis += `- ${String(insight)}\n`;
            });
          } else {
            analysis = `## Analysis\n\n${JSON.stringify(analysisData, null, 2)}\n`;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Build the final markdown
    if (errors.length > 0) {
      markdown += '## ❌ Errors\n\n';
      errors.forEach((error) => {
        markdown += `- ${error}\n`;
      });
      markdown += '\n';
    }

    if (sql) {
      markdown += '## SQL Query\n\n';
      markdown += '```sql\n';
      markdown += sql;
      markdown += '\n```\n\n';
    }

    if (analysis) {
      markdown += analysis;
    }

    return markdown || '## No Results\n\nNo SQL or analysis generated.';
  }
}
