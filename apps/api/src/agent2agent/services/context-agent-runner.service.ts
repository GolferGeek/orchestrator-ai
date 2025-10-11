import { Injectable, Logger } from '@nestjs/common';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { LLMService } from '@llm/llm.service';
import { PlansService } from '../plans/services/plans.service';
import { DeliverablesService } from '../deliverables/deliverables.service';

/**
 * Context Agent Runner
 *
 * Handles execution of context agents - agents that fetch contextual information
 * (plans, deliverables, conversation history) and use it with LLM to generate responses.
 *
 * Context agents are the most common type, replacing traditional "LLM agents".
 * They differ from pure LLM agents by fetching and optimizing context before calling the LLM.
 *
 * Data Sources:
 * - `context` column: Markdown instructions/context
 * - `config.context.sources`: Array of context sources to fetch
 * - `config.context.systemPromptTemplate`: Template for system prompt
 *
 * BUILD Mode:
 * 1. Fetch context from configured sources
 * 2. Optimize context to token budget
 * 3. Combine with markdown from context column
 * 4. Interpolate into system prompt template
 * 5. Make ONE LLM call
 * 6. Save deliverable
 *
 * @example
 * ```typescript
 * // Agent definition
 * {
 *   type: 'context',
 *   context: '# Plan Analyzer\nYou analyze project plans...',
 *   config: {
 *     context: {
 *       sources: ['plans', 'deliverables'],
 *       systemPromptTemplate: 'Analyze: {{plan.content}}',
 *       tokenBudget: 8000
 *     }
 *   },
 *   llm: {
 *     provider: 'anthropic',
 *     model: 'claude-3-5-sonnet'
 *   }
 * }
 * ```
 */
@Injectable()
export class ContextAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(ContextAgentRunnerService.name);

  constructor(
    private readonly contextOptimization: ContextOptimizationService,
    private readonly llmService: LLMService,
    private readonly plansService: PlansService,
    private readonly deliverablesService: DeliverablesService,
  ) {
    super();
  }

  /**
   * CONVERSE mode - conversational interaction
   * Context agents use default implementation from BaseAgentRunner
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Context agents don't have special CONVERSE logic yet
    // Return a simple response indicating this mode isn't fully implemented
    return TaskResponseDto.failure(
      AgentTaskMode.CONVERSE,
      'CONVERSE mode not yet implemented for context agents',
    );
  }

  /**
   * PLAN mode - planning
   * Context agents use default implementation from BaseAgentRunner
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Context agents don't have special PLAN logic yet
    // Return a simple response indicating this mode isn't fully implemented
    return TaskResponseDto.failure(
      AgentTaskMode.PLAN,
      'PLAN mode not yet implemented for context agents',
    );
  }

  /**
   * BUILD mode - fetch context and generate deliverable with LLM
   */
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      // Check if this is a non-create action (read, list, edit)
      const action = (request.payload as any)?.action || 'create';
      if (action !== 'create') {
        return this.handleBuildAction(
          definition,
          request,
          organizationSlug,
          action,
        );
      }

      // Standard create action with LLM
      this.logger.debug(
        `Context agent ${definition.slug} executing BUILD mode (create action)`,
      );

      // 1. Fetch context from sources
      const contextData = await this.fetchContextFromSources(
        definition,
        request,
      );

      // 2. Optimize context to token budget
      const tokenBudget = definition.config?.context?.tokenBudget || 8000;
      const optimizedContext = await this.contextOptimization.optimizeContext({
        fullHistory: contextData.history || [],
        conversationId: request.conversationId,
        tokenBudget,
      });

      // 3. Build system prompt
      const systemPrompt = this.buildSystemPrompt(definition, {
        ...contextData,
        history: optimizedContext,
      });

      // 4. Call LLM
      const llmConfig = definition.llm || {};
      const response = await this.llmService.generateResponse(
        systemPrompt,
        request.userMessage || '',
        {
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
          provider: (llmConfig.provider || 'anthropic') as
            | 'openai'
            | 'anthropic'
            | 'ollama'
            | 'google',
          conversationId: request.conversationId,
          sessionId: request.sessionId,
          userId: this.resolveUserId(request) || undefined,
        } as any,
      );

      // 5. Save deliverable
      const userId = this.resolveUserId(request);
      const conversationId = this.resolveConversationId(request);
      const taskId = this.resolveTaskId(request);

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Missing required userId or conversationId for deliverable creation',
        );
      }

      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title: (request.payload as any)?.title || 'Context Agent Output',
          content: response.content,
          format: definition.config?.deliverable?.format || 'markdown',
          type: definition.config?.deliverable?.type || 'document',
          agentName: definition.slug,
          namespace: organizationSlug || 'default',
          taskId: taskId || undefined,
          metadata: {
            llmProvider: response.metadata?.provider,
            llmModel: response.metadata?.model,
            usage: response.metadata?.usage,
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
        content: {
          deliverable: deliverableResult.data.deliverable,
          version: deliverableResult.data.version,
          isNew: deliverableResult.data.isNew,
        },
        metadata: {
          provider: response.metadata?.provider,
          model: response.metadata?.model,
          usage: response.metadata?.usage,
        },
      });
    } catch (error) {
      this.logger.error(
        `Context agent ${definition.slug} BUILD failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        `Failed to execute context agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle non-create BUILD actions (read, list, edit, etc.)
   */
  private async handleBuildAction(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
    action: string,
  ): Promise<TaskResponseDto> {
    const userId = this.resolveUserId(request);
    const conversationId = this.resolveConversationId(request);

    if (!userId || !conversationId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Missing required userId or conversationId',
      );
    }

    // Extract params from payload (excluding action)
    const {
      action: _,
      taskId: __,
      llmSelection: ___,
      ...params
    } = (request.payload as any) || {};

    // Route to DeliverablesService
    const result = await this.deliverablesService.executeAction(
      action,
      params,
      {
        conversationId,
        userId,
        agentSlug: definition.slug,
      },
    );

    if (!result.success) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        result.error?.message || `Failed to execute action: ${action}`,
      );
    }

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: result.data,
      metadata: {
        action,
        executedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Fetch context from configured sources
   */
  private async fetchContextFromSources(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
  ): Promise<{
    plan?: any;
    deliverables?: any[];
    history?: any[];
    projects?: any;
  }> {
    const sources = definition.config?.context?.sources || [];
    const contextData: any = {};

    const conversationId = this.resolveConversationId(request);
    const userId = this.resolveUserId(request);

    // Fetch from each source
    for (const source of sources) {
      try {
        switch (source) {
          case 'plans':
            if (conversationId && userId) {
              const planResult = await this.plansService.executeAction(
                'read',
                {},
                {
                  conversationId,
                  userId,
                  agentSlug: definition.slug,
                },
              );
              if (planResult.success) {
                contextData.plan = planResult.data;
              }
            }
            break;

          case 'deliverables':
            if (conversationId && userId) {
              const deliverablesResult =
                await this.deliverablesService.executeAction(
                  'list',
                  {},
                  {
                    conversationId,
                    userId,
                    agentSlug: definition.slug,
                  },
                );
              if (deliverablesResult.success) {
                contextData.deliverables = deliverablesResult.data;
              }
            }
            break;

          case 'conversations':
            // Conversation history will be optimized separately
            // For now, placeholder
            contextData.history = [];
            break;

          case 'projects':
            // Projects - placeholder for now
            // Requires ProjectsService integration
            break;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch context from source '${source}': ${String(error)}`,
        );
        // Continue with other sources
      }
    }

    return contextData;
  }

  /**
   * Build system prompt from template and context
   */
  private buildSystemPrompt(
    definition: AgentRuntimeDefinition,
    contextData: Record<string, any>,
  ): string {
    // Get markdown from context column
    const contextMarkdown =
      typeof definition.context === 'string'
        ? definition.context
        : JSON.stringify(definition.context || {});

    // Get template from config
    const template =
      definition.config?.context?.systemPromptTemplate || contextMarkdown;

    // Simple template interpolation
    // Supports {{variable}} and {{object.property}} syntax
    let prompt = template;

    // Replace variables
    const variableRegex = /\{\{([^}]+)\}\}/g;
    prompt = prompt.replace(variableRegex, (match: string, path: string) => {
      const keys = path.trim().split('.');
      let value: any = contextData;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match; // Keep original if not found
        }
      }

      return typeof value === 'string' ? value : JSON.stringify(value);
    });

    return prompt;
  }
}
