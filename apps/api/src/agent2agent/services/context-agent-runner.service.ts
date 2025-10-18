import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import type { BuildCreatePayload } from '@orchestrator-ai/transport-types/modes/build.types';
import type {
  DeliverableData,
  DeliverableVersionData,
} from '@orchestrator-ai/transport-types/shared/data-types';
import { LLMService } from '@llm/llm.service';
import { BaseAgentRunner } from './base-agent-runner.service';
import {
  buildDeliverableMetadata,
  validateDeliverableSchema,
  validateDeliverableStructure,
} from './base-agent-runner/build.handlers';
import {
  buildResponseMetadata,
  callLLM,
  fetchConversationHistory,
  optimizeContext,
} from './base-agent-runner/shared.helpers';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import {
  ContextOptimizationService,
  ConversationMessage,
} from '../context-optimization/context-optimization.service';
import type { ActionExecutionContext } from '../common/interfaces/action-handler.interface';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { PlansService, type Plan } from '../plans/services/plans.service';
import type { PlanVersion } from '../plans/services/plan-versions.service';

type ExtendedBuildCreatePayload = BuildCreatePayload & {
  content?: unknown;
  deliverableId?: string;
  rerunConfig?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  rerunContext?: {
    sourceVersion?: DeliverableVersionData | null;
    deliverable?: DeliverableData | null;
  };
  mergeContext?: {
    versionIds: string[];
    mergePrompt: string;
    sourceVersions?: DeliverableVersionData[];
    deliverable?: DeliverableData | null;
  };
};

type PlanContextSource = 'requested-version' | 'current' | 'none';

interface PlanListActionResult {
  plan: Plan;
  versions: PlanVersion[];
}

interface BuildContextResult {
  plan: Plan | null;
  planVersion: PlanVersion | null;
  planSource: PlanContextSource;
  conversationHistory: ConversationMessage[];
  optimizedHistory: ConversationMessage[];
  error?: string;
}

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
    contextOptimization: ContextOptimizationService,
    llmService: LLMService,
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
   * BUILD mode - fetch context and generate deliverable with LLM
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = (request.payload ?? {}) as ExtendedBuildCreatePayload;

    try {
      const userId = this.resolveUserId(request);
      if (!userId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'User identity is required for build execution',
        );
      }

      const conversationId = this.resolveConversationId(request);
      if (!conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Conversation context is required for build execution',
        );
      }
      request.conversationId = conversationId;

      const taskId = this.resolveTaskId(request) ?? undefined;
      const executionContext: ActionExecutionContext = {
        conversationId,
        userId,
        agentSlug: definition.slug,
        taskId,
        metadata: request.metadata ?? {},
      };

      const requestedPlanVersionId =
        typeof payload.planVersionId === 'string' &&
        payload.planVersionId.trim().length > 0
          ? payload.planVersionId.trim()
          : null;

      const buildContext = await this.gatherBuildContext(
        definition,
        request,
        executionContext,
        requestedPlanVersionId,
      );

      if (buildContext.error) {
        return TaskResponseDto.failure(AgentTaskMode.BUILD, buildContext.error);
      }

      const namespace = this.resolveNamespace(definition, organizationSlug);
      const conversationForPrompt =
        buildContext.optimizedHistory.length > 0
          ? buildContext.optimizedHistory
          : buildContext.conversationHistory;

      const deliverableStructure = definition.deliverableStructure ?? null;
      const outputSchema =
        (typeof definition.ioSchema === 'object' && definition.ioSchema?.output) ?? definition.ioSchema ?? null;

      const systemPrompt = this.buildExecutionPrompt(definition, {
        plan: buildContext.plan,
        planVersion: buildContext.planVersion,
        conversationHistory: conversationForPrompt,
        deliverableStructure,
        outputSchema,
        rerunContext: payload.rerunContext ?? undefined,
        mergeContext: payload.mergeContext ?? undefined,
      });

      const userMessage = this.resolveUserMessage(payload, request);

      let finalContent: string | null = null;
      const providedContent = this.normalizeDeliverableContent(
        payload.content,
      );
      if (providedContent.trim().length > 0) {
        finalContent = providedContent;
      }

      let llmMetadata: Record<string, unknown> | null = null;

      if (!finalContent) {
        const llmConfig = this.buildLlmConfig(
          definition,
          payload,
          conversationId,
          userId,
          namespace,
          request,
        );

        const llmResponse = await callLLM(
          this.llmService,
          llmConfig,
          systemPrompt,
          userMessage,
          conversationForPrompt,
        );

        finalContent = this.normalizeDeliverableContent(llmResponse.content);
        llmMetadata = (llmResponse.metadata as unknown as Record<string, unknown>) ?? null;
      }

      if (!finalContent || finalContent.trim().length === 0) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Generated deliverable content was empty',
        );
      }

      // Validate structure but don't fail - just log warnings
      try {
        validateDeliverableStructure(finalContent, deliverableStructure);
      } catch (error: any) {
        this.logger.warn(
          `Deliverable structure validation warning: ${error?.message || error}. Continuing anyway.`,
        );
      }

      try {
        validateDeliverableSchema(finalContent, outputSchema);
      } catch (error: any) {
        this.logger.warn(
          `Deliverable schema validation warning: ${error?.message || error}. Continuing anyway.`,
        );
      }

      // Extract the actual deliverable content for storage
      // The validation functions work with the full response, but we only want to store the unwrapped content
      const contentForStorage = this.extractDeliverableContent(finalContent, deliverableStructure);

      const deliverableFormat = this.resolveDeliverableFormat(
        contentForStorage,
        payload,
        definition,
      );

      const deliverableType = this.resolveDeliverableType(payload, definition);

      const targetDeliverableId = this.resolveDeliverableId(payload, request);

      const createResult = await this.deliverablesService.executeAction(
        'create',
        {
          title: this.resolveDeliverableTitle(
            payload,
            buildContext.plan,
            definition,
            finalContent,
          ),
          content: contentForStorage,
          format: deliverableFormat,
          type: deliverableType,
          deliverableId: targetDeliverableId ?? undefined,
          agentName: definition.displayName ?? definition.slug,
          taskId,
          metadata: this.compactMetadata({
            planId: buildContext.plan?.id ?? null,
            planVersionId:
              buildContext.planVersion?.id ?? requestedPlanVersionId ?? null,
            planSource: buildContext.planSource,
            conversationMessageCount: conversationForPrompt.length,
            deliverableStructureApplied: Boolean(deliverableStructure),
            ioSchemaApplied: Boolean(outputSchema),
            rerunContext: payload.rerunContext
              ? {
                  sourceVersionId:
                    payload.rerunContext.sourceVersion?.id ?? null,
                  deliverableId: payload.rerunContext.deliverable?.id ?? null,
                  providerOverride: payload.rerunConfig?.provider ?? null,
                  modelOverride: payload.rerunConfig?.model ?? null,
                }
              : undefined,
            mergeContext: payload.mergeContext
              ? {
                  versionIds: payload.mergeContext.versionIds,
                  mergePrompt: payload.mergeContext.mergePrompt,
                }
              : undefined,
            llm: llmMetadata ?? undefined,
          }),
        },
        executionContext,
      );

      if (!createResult.success || !createResult.data) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          createResult.error?.message ?? 'Failed to create deliverable',
        );
      }

      const usage = this.normalizeUsage(llmMetadata?.usage);
      const provider = this.resolveProvider(llmMetadata, definition, payload);
      const model = this.resolveModel(llmMetadata, definition, payload);

      const metadata = buildResponseMetadata(
        {
          provider,
          model,
          usage,
        },
        this.compactMetadata({
          namespace,
          planId: buildContext.plan?.id ?? null,
          planVersionId:
            buildContext.planVersion?.id ?? requestedPlanVersionId ?? null,
          planSource: buildContext.planSource,
          planTitle: buildContext.plan?.title ?? null,
          conversationMessageCount: conversationForPrompt.length,
          deliverableStructureApplied: Boolean(deliverableStructure),
          ioSchemaApplied: Boolean(outputSchema),
          deliverableMetadata: buildDeliverableMetadata(
            createResult.data.version?.content ?? finalContent,
          ),
          rerun: payload.rerunContext
            ? {
                sourceVersionId:
                  payload.rerunContext.sourceVersion?.id ?? null,
                deliverableId: payload.rerunContext.deliverable?.id ?? null,
              }
            : undefined,
          merge: payload.mergeContext
            ? {
                versionIds: payload.mergeContext.versionIds,
              }
            : undefined,
        }),
      );

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          deliverable: createResult.data.deliverable,
          version: createResult.data.version,
          isNew: createResult.data.isNew,
        },
        metadata,
      });
    } catch (error) {
      this.logger.error(
        `Context agent ${definition.slug} BUILD failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  private async gatherBuildContext(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    executionContext: ActionExecutionContext,
    requestedPlanVersionId: string | null,
  ): Promise<BuildContextResult> {
    const conversationHistory = await fetchConversationHistory(
      this.conversationsService,
      request,
    );
    const optimizedHistory = await optimizeContext(
      this.contextOptimization,
      conversationHistory,
      definition,
    );

    let plan: Plan | null = null;
    if (executionContext.conversationId) {
      plan = await this.plansService.findByConversationId(
        executionContext.conversationId,
        executionContext.userId,
      );
    }

    let planVersion: PlanVersion | null =
      (plan?.currentVersion as PlanVersion | undefined) ?? null;
    let planSource: PlanContextSource = planVersion ? 'current' : 'none';

    if (requestedPlanVersionId) {
      const listResult = await this.plansService.executeAction<
        PlanListActionResult
      >('list', { includeArchived: true }, executionContext);

      if (!listResult.success) {
        if (listResult.error?.code === 'NOT_FOUND') {
          return {
            plan,
            planVersion: null,
            planSource: 'none',
            conversationHistory,
            optimizedHistory,
            error: `Plan version ${requestedPlanVersionId} not found`,
          };
        }

        throw new Error(
          listResult.error?.message ?? 'Unable to fetch plan versions',
        );
      }

      const versions = listResult.data?.versions ?? [];
      const targetVersion = versions.find(
        (version) => version.id === requestedPlanVersionId,
      );

      if (!targetVersion) {
        return {
          plan: listResult.data?.plan ?? plan,
          planVersion: null,
          planSource: 'none',
          conversationHistory,
          optimizedHistory,
          error: `Plan version ${requestedPlanVersionId} not found`,
        };
      }

      planVersion = targetVersion;
      planSource = 'requested-version';
      plan = plan ?? listResult.data?.plan ?? null;
    }

    if (plan?.id) {
      request.planId = plan.id;
    }

    return {
      plan,
      planVersion,
      planSource,
      conversationHistory,
      optimizedHistory,
    };
  }

  private buildExecutionPrompt(
    definition: AgentRuntimeDefinition,
    options: {
      plan: Plan | null;
      planVersion: PlanVersion | null;
      conversationHistory: ConversationMessage[];
      deliverableStructure?: unknown;
      outputSchema?: unknown;
      rerunContext?: ExtendedBuildCreatePayload['rerunContext'];
      mergeContext?: ExtendedBuildCreatePayload['mergeContext'];
    },
  ): string {
    const basePromptCandidates = [
      definition.prompts?.build,
      definition.prompts?.system,
      definition.llm?.systemPrompt,
      definition.context?.systemPrompt,
    ];

    const basePrompt =
      basePromptCandidates.find(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.trim().length > 0,
      ) ??
      `You are ${
        definition.displayName ?? definition.slug
      }, an expert builder responsible for producing high-quality deliverables from plans and conversations.`;

    const sections: string[] = [basePrompt.trim()];

    if (options.planVersion?.content) {
      const planHeader = options.plan?.title
        ? `${options.plan.title} (Plan Version ${
            options.planVersion.versionNumber ?? ''
          })`
        : `Plan Version ${options.planVersion.versionNumber ?? ''}`;
      sections.push(
        `${planHeader}:\n${this.stringifyForPrompt(options.planVersion.content)}`,
      );
    }

    if (options.conversationHistory.length > 0) {
      const recentMessages = options.conversationHistory
        .slice(-10)
        .map(
          (message) =>
            `${message.role.toUpperCase()}: ${message.content}`.trim(),
        )
        .join('\n');
      sections.push(`Recent Conversation:\n${recentMessages}`);
    }

    if (options.rerunContext?.sourceVersion?.content) {
      sections.push(
        `Previous Deliverable Version:\n${this.stringifyForPrompt(
          options.rerunContext.sourceVersion.content,
        )}`,
      );
    }

    if (
      options.mergeContext?.sourceVersions &&
      options.mergeContext.sourceVersions.length > 0
    ) {
      const mergeSummary = options.mergeContext.sourceVersions
        .map(
          (version, index) =>
            `Source ${index + 1} (${version.id}):\n${this.stringifyForPrompt(version.content)}`,
        )
        .join('\n\n');
      sections.push(
        `Merge Source Versions (IDs: ${options.mergeContext.versionIds.join(', ')}):\n${mergeSummary}`,
      );
    }

    if (options.deliverableStructure) {
      sections.push(
        `Deliverable Structure Requirements:\n${this.stringifyForPrompt(options.deliverableStructure)}`,
      );
    }

    if (options.outputSchema) {
      sections.push(
        `Output Schema Requirements:\n${this.stringifyForPrompt(options.outputSchema)}`,
      );
    }

    let instruction =
      'Generate a complete, polished deliverable that satisfies the user request.';

    if (options.deliverableStructure || options.outputSchema) {
      instruction +=
        ' IMPORTANT: You MUST return your response as valid JSON that strictly validates against the provided Output Schema Requirements. Do not return plain text, explanations, or any other format. Return ONLY valid JSON matching the schema structure exactly.';
    }

    if (options.mergeContext?.mergePrompt) {
      instruction += ` Merge guidance: ${options.mergeContext.mergePrompt.trim()}.`;
    }

    sections.push(instruction);

    return sections.join('\n\n---\n\n');
  }

  private resolveNamespace(
    definition: AgentRuntimeDefinition,
    organizationSlug: string | null,
  ): string {
    return (
      organizationSlug ??
      definition.organizationSlug ??
      (definition.context?.namespace as string | undefined) ??
      'global'
    );
  }

  private resolveUserMessage(
    payload: ExtendedBuildCreatePayload,
    request: TaskRequestDto,
  ): string {
    if (
      payload.mergeContext?.mergePrompt &&
      payload.mergeContext.mergePrompt.trim().length > 0
    ) {
      return payload.mergeContext.mergePrompt.trim();
    }

    if (
      typeof request.userMessage === 'string' &&
      request.userMessage.trim().length > 0
    ) {
      return request.userMessage.trim();
    }

    return 'Generate the requested deliverable using the provided context.';
  }

  private buildLlmConfig(
    definition: AgentRuntimeDefinition,
    payload: ExtendedBuildCreatePayload,
    conversationId: string,
    userId: string,
    namespace: string,
    request: TaskRequestDto,
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {
      conversationId,
      sessionId: request.sessionId,
      userId,
      organizationSlug: namespace,
      agentSlug: definition.slug,
      callerType: 'agent',
      callerName: `${definition.slug}-build-create`,
      stream: false,
    };

    // Extract provider and model from payload (from frontend store)
    const payloadAny = payload as any;
    const providerName = payloadAny.currentProvider ?? payload.rerunConfig?.provider;
    const modelName = payloadAny.currentModel ?? payload.rerunConfig?.model;

    if (providerName && providerName.trim().length > 0) {
      config.providerName = providerName.trim();
    }

    if (modelName && modelName.trim().length > 0) {
      config.modelName = modelName.trim();
    }

    if (typeof payloadAny.temperature === 'number') {
      config.temperature = payloadAny.temperature;
    } else if (typeof payload.rerunConfig?.temperature === 'number') {
      config.temperature = payload.rerunConfig.temperature;
    }

    if (typeof payloadAny.maxTokens === 'number') {
      config.maxTokens = payloadAny.maxTokens;
    } else if (typeof payload.rerunConfig?.maxTokens === 'number') {
      config.maxTokens = payload.rerunConfig.maxTokens;
    }

    return config;
  }

  private normalizeDeliverableContent(content: unknown): string {
    if (content === null || content === undefined) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch (_error) {
        return String(content);
      }
    }

    return String(content);
  }

  /**
   * Extract the actual deliverable content from the LLM response for storage.
   * The LLM returns data wrapped in io_schema format: {status, blog_post: {title, content, ...}}
   * But we only want to store the actual content (markdown) in the version.
   */
  private extractDeliverableContent(rawContent: string, deliverableStructure: unknown): string {
    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // If not JSON, return as-is (might be plain markdown)
      return rawContent;
    }

    // If it's not an object, return as-is
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return rawContent;
    }

    // Look for common wrapper keys that contain the actual deliverable
    const wrapperKeys = ['blog_post', 'deliverable', 'data', 'output', 'result'];

    for (const key of wrapperKeys) {
      if (key in parsed && parsed[key] && typeof parsed[key] === 'object') {
        const deliverableData = parsed[key];

        // If the deliverable has a 'content' field, extract just that (the markdown)
        if ('content' in deliverableData && typeof deliverableData.content === 'string') {
          return deliverableData.content;
        }

        // Otherwise, stringify the entire deliverable object
        return JSON.stringify(deliverableData, null, 2);
      }
    }

    // If no wrapper found, check if this object itself has a content field
    if ('content' in parsed && typeof parsed.content === 'string') {
      return parsed.content;
    }

    // Fallback: return the original content
    return rawContent;
  }

  private resolveDeliverableFormat(
    content: string,
    payload: ExtendedBuildCreatePayload,
    definition: AgentRuntimeDefinition,
  ): string {
    const mergeFormat =
      payload.mergeContext?.sourceVersions &&
      payload.mergeContext.sourceVersions.length > 0
        ? payload.mergeContext.sourceVersions[0]?.format
        : null;

    const rerunFormat = payload.rerunContext?.sourceVersion?.format;
    const configuredFormat = definition.config?.deliverable?.format;

    const candidates = [rerunFormat, mergeFormat, configuredFormat];

    const selected = candidates.find(
      (format): format is string =>
        typeof format === 'string' && format.trim().length > 0,
    );

    if (selected) {
      return selected;
    }

    return this.isJsonString(content) ? 'json' : 'markdown';
  }

  private resolveDeliverableType(
    payload: ExtendedBuildCreatePayload,
    definition: AgentRuntimeDefinition,
  ): string {
    if (payload.type && payload.type.trim().length > 0) {
      return payload.type.trim();
    }

    const rerunType = payload.rerunContext?.deliverable?.type;
    if (rerunType && rerunType.trim().length > 0) {
      return rerunType;
    }

    const configuredType = definition.config?.deliverable?.type;
    if (configuredType && configuredType.trim().length > 0) {
      return configuredType;
    }

    return 'document';
  }

  private resolveDeliverableTitle(
    payload: ExtendedBuildCreatePayload,
    plan: Plan | null,
    definition: AgentRuntimeDefinition,
    rawContent?: string,
  ): string {
    if (payload.title && payload.title.trim().length > 0) {
      return payload.title.trim();
    }

    const rerunTitle = payload.rerunContext?.deliverable?.title;
    if (rerunTitle && rerunTitle.trim().length > 0) {
      return rerunTitle.trim();
    }

    // Try to extract title from LLM response
    if (rawContent) {
      const extractedTitle = this.extractDeliverableTitle(rawContent);
      if (extractedTitle) {
        return extractedTitle;
      }
    }

    if (plan?.title && plan.title.trim().length > 0) {
      return plan.title.trim();
    }

    return `${definition.displayName ?? definition.slug} Deliverable`;
  }

  /**
   * Extract title from LLM response.
   * Looks for title in the deliverable structure: {blog_post: {title: "..."}}
   */
  private extractDeliverableTitle(rawContent: string): string | null {
    try {
      const parsed = JSON.parse(rawContent);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      // Look for common wrapper keys
      const wrapperKeys = ['blog_post', 'deliverable', 'data', 'output', 'result'];

      for (const key of wrapperKeys) {
        if (key in parsed && parsed[key] && typeof parsed[key] === 'object') {
          const deliverableData = parsed[key];
          if ('title' in deliverableData && typeof deliverableData.title === 'string' && deliverableData.title.trim().length > 0) {
            return deliverableData.title.trim();
          }
        }
      }

      // Check top-level title
      if ('title' in parsed && typeof parsed.title === 'string' && parsed.title.trim().length > 0) {
        return parsed.title.trim();
      }

      return null;
    } catch {
      return null;
    }
  }

  private resolveDeliverableId(
    payload: ExtendedBuildCreatePayload,
    request: TaskRequestDto,
  ): string | null {
    const baseId = this.resolveDeliverableIdFromRequest(request);

    const candidates: Array<unknown> = [
      payload.deliverableId,
      payload.rerunContext?.deliverable?.id,
      payload.mergeContext?.deliverable?.id,
      baseId,
    ];

    const match = candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return match ? match.trim() : null;
  }

  private resolveProvider(
    metadata: Record<string, unknown> | null,
    definition: AgentRuntimeDefinition,
    payload: ExtendedBuildCreatePayload,
  ): string {
    const fromMetadata = metadata?.provider;
    if (
      typeof fromMetadata === 'string' &&
      fromMetadata.trim().length > 0
    ) {
      return fromMetadata;
    }

    if (
      payload.rerunConfig?.provider &&
      payload.rerunConfig.provider.trim().length > 0
    ) {
      return payload.rerunConfig.provider.trim();
    }

    const fromDefinition = definition.llm?.provider;
    if (
      typeof fromDefinition === 'string' &&
      fromDefinition.trim().length > 0
    ) {
      return fromDefinition;
    }

    return '';
  }

  private resolveModel(
    metadata: Record<string, unknown> | null,
    definition: AgentRuntimeDefinition,
    payload: ExtendedBuildCreatePayload,
  ): string {
    const fromMetadata = metadata?.model;
    if (typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
      return fromMetadata;
    }

    if (
      payload.rerunConfig?.model &&
      payload.rerunConfig.model.trim().length > 0
    ) {
      return payload.rerunConfig.model.trim();
    }

    const fromDefinition = definition.llm?.model;
    if (
      typeof fromDefinition === 'string' &&
      fromDefinition.trim().length > 0
    ) {
      return fromDefinition;
    }

    return '';
  }

  private normalizeUsage(raw: unknown): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  } {
    if (!raw || typeof raw !== 'object') {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
    }

    const value = raw as Record<string, unknown>;

    const inputTokens = this.numberOrZero(
      value.inputTokens ?? value.promptTokens ?? value.total_input_tokens,
    );
    const outputTokens = this.numberOrZero(
      value.outputTokens ?? value.completionTokens ?? value.total_output_tokens,
    );
    const totalTokens = this.numberOrZero(
      value.totalTokens ?? value.total_tokens,
      inputTokens + outputTokens,
    );
    const cost = this.numberOrZero(value.cost ?? value.price);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
    };
  }

  private isJsonString(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }

    try {
      JSON.parse(trimmed);
      return true;
    } catch (_error) {
      return false;
    }
  }

  private compactMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.entries(metadata).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );
  }

  private stringifyForPrompt(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value);
    }
  }

  private numberOrZero(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}
