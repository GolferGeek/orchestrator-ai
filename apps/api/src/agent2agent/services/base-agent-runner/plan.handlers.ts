import Ajv from 'ajv';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { LLMService } from '@llm/llm.service';
import type { LLMResponse } from '@llm/services/llm-interfaces';
import type { ConversationMessage } from '../../context-optimization/context-optimization.service';
import { PlansService } from '../../plans/services/plans.service';
import type { Plan } from '../../plans/services/plans.service';
import type { PlanVersion } from '../../plans/services/plan-versions.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import {
  fetchConversationHistory,
  fetchExistingPlan,
  buildResponseMetadata,
  callLLM,
  handleError,
  resolveConversationId,
  resolveTaskId,
  resolveUserId,
} from './shared.helpers';
import { AgentTaskMode, TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';
import type {
  PlanCreatePayload,
  PlanDeletePayload,
  PlanDeleteVersionPayload,
  PlanEditPayload,
  PlanListPayload,
  PlanMergeVersionsPayload,
  PlanReadPayload,
  PlanSetCurrentPayload,
  PlanCopyVersionPayload,
  PlanRerunPayload,
  PlanCreateResponseContent,
  PlanListResponseContent,
  PlanReadResponseContent,
  PlanRerunResponseContent,
  PlanResponseMetadata,
} from '@orchestrator-ai/transport-types/modes/plan.types';
import type { ActionExecutionContext } from '../../common/interfaces/action-handler.interface';

export interface PlanHandlerDependencies {
  llmService: LLMService;
  plansService: PlansService;
  conversationsService: Agent2AgentConversationsService;
}

const EMPTY_USAGE = {
  inputTokens: 0 as number,
  outputTokens: 0 as number,
  totalTokens: 0 as number,
  cost: 0 as number,
};

const EMPTY_PLAN_METADATA: PlanResponseMetadata = {
  provider: '',
  model: '',
  usage: EMPTY_USAGE,
};

export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    const payload = (request.payload ?? {}) as Partial<PlanCreatePayload>;
    const { userId, conversationId, taskId, executionContext } =
      buildPlanActionContext(definition, request);

    const namespace = resolveNamespace(definition, organizationSlug);
    const existingPlan = (await fetchExistingPlan(
      services.plansService,
      request,
    )) as Plan | null;

    if (existingPlan && payload.forceNew !== true) {
      const currentVersion = existingPlan.currentVersion ?? null;
      if (!currentVersion) {
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          'Existing plan is missing a current version',
        );
      }

      const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
        planMetadata: extractPlanMetadata(currentVersion.content),
        planStructureApplied: Boolean(definition.planStructure),
        source: 'existing',
      });

      request.planId = existingPlan.id;

      return TaskResponseDto.success(AgentTaskMode.PLAN, {
        content: {
          plan: serializePlan(existingPlan, definition, existingPlan.userId),
          version: serializePlanVersion(currentVersion),
          isNew: false,
        },
        metadata,
      });
    }

    const conversationHistory = await fetchConversationHistory(
      services.conversationsService,
      request,
    );
    const planningPrompt = buildPlanningPrompt(
      definition,
      conversationHistory,
      definition.planStructure ?? null,
    );

    let planSourceContent: unknown = payload.content;
    let llmResponse: LLMResponse | null = null;

    if (!planSourceContent) {
      const userMessage =
        typeof request.userMessage === 'string' &&
        request.userMessage.trim().length > 0
          ? request.userMessage.trim()
          : 'Generate a detailed, actionable plan that satisfies the conversation context.';

      // Extract LLM configuration from payload (required from frontend)
      const payloadAny = payload as any;
      const providerName = payloadAny.currentProvider ?? payloadAny.llmSelection?.providerName;
      const modelName = payloadAny.currentModel ?? payloadAny.llmSelection?.modelName;

      // Validate LLM configuration (no fallbacks - frontend must provide)
      if (!providerName || !modelName) {
        throw new Error(
          'LLM provider and model must be specified in the request payload. ' +
          'Frontend must send currentProvider and currentModel.'
        );
      }

      llmResponse = await callLLM(
        services.llmService,
        {
          providerName,
          modelName,
          temperature: payloadAny.temperature,
          maxTokens: payloadAny.maxTokens,
          conversationId,
          sessionId: request.sessionId,
          userId,
          organizationSlug: namespace,
          agentSlug: definition.slug,
          callerType: 'agent',
          callerName: `${definition.slug}-plan-create`,
          stream: false,
        },
        planningPrompt,
        userMessage,
        conversationHistory,
      );

      planSourceContent = llmResponse.content;
    }

    const { content: normalizedContent, parsed } = normalizePlanContent(
      planSourceContent,
      definition.planStructure ?? null,
    );

    const planFormat = resolvePlanFormat(definition);
    const planMetadata = extractPlanMetadata(parsed ?? normalizedContent);

    const createResult = await services.plansService.executeAction<
      PlanCreateResponseContent
    >(
      'create',
      {
        title:
          (payload.title && payload.title.trim().length > 0
            ? payload.title
            : null) ?? 'Plan',
        content: normalizedContent,
        format: planFormat,
        agentName: definition.displayName ?? definition.slug,
        namespace,
        taskId,
        metadata: {
          planMetadata,
          planStructureApplied: Boolean(definition.planStructure),
          source: llmResponse ? 'llm' : 'payload',
        },
      },
      executionContext,
    );

    if (!createResult.success || !createResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        createResult.error?.message ?? 'Failed to create plan',
      );
    }

    const { plan, version, isNew } = createResult.data;
    const baseMetadata = createBaseMetadataFromLLM(llmResponse);
    const metadata = buildResponseMetadata(baseMetadata as unknown as Record<string, unknown>, {
      planMetadata,
      planFormat,
      planStructureApplied: Boolean(definition.planStructure),
      isNew,
      conversationId,
    });

    request.planId = plan.id;

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: serializePlan(plan, definition, userId),
        version: serializePlanVersion(version),
        isNew,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanRead(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as Partial<PlanReadPayload>;
    const { userId, conversationId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const plan =
      ((await fetchExistingPlan(
        services.plansService,
        request,
      )) as Plan | null) ?? null;
    if (!plan) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'No plan found for this conversation',
      );
    }

    request.planId = plan.id;

    if (payload.versionId) {
      const listResult = await services.plansService.executeAction<PlanListResponseContent>(
        'list',
        {},
        executionContext,
      );

      if (!listResult.success || !listResult.data) {
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          listResult.error?.message ??
            'Unable to list plan versions for version lookup',
        );
      }

      const targetVersion = (listResult.data.versions ?? []).find(
        (version) => version.id === payload.versionId,
      );

      if (!targetVersion) {
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          `Plan version ${payload.versionId} not found`,
        );
      }

      const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
        planMetadata: extractPlanMetadata(targetVersion.content),
        requestedVersionId: payload.versionId,
      });

      return TaskResponseDto.success(AgentTaskMode.PLAN, {
        content: {
          plan: {
            ...serializePlan(plan, definition, userId),
            currentVersion: serializePlanVersion(targetVersion) ?? undefined,
          },
        },
        metadata,
      });
    }

    const currentVersion = plan.currentVersion ?? null;

    const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      planMetadata: extractPlanMetadata(
        currentVersion?.content ?? plan.currentVersion ?? '',
      ),
      conversationId,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: {
          ...serializePlan(plan, definition, userId),
          currentVersion: serializePlanVersion(currentVersion) ?? undefined,
        },
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanList(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as Partial<PlanListPayload>;
    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const listResult = await services.plansService.executeAction<PlanListResponseContent>(
      'list',
      {
        includeArchived: payload.includeArchived ?? false,
      },
      executionContext,
    );

    if (!listResult.success || !listResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        listResult.error?.message ?? 'Failed to list plan versions',
      );
    }

    const responsePlan = serializePlan(listResult.data.plan, definition, userId);
    const responseVersions = (listResult.data.versions ?? []).map((version) =>
      serializePlanVersion(version),
    );

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: responsePlan,
        versions: responseVersions.filter(
          (version): version is NonNullable<typeof version> => Boolean(version),
        ),
      },
      metadata: buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
        versionCount: responseVersions.length,
      }),
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanEdit(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as Partial<PlanEditPayload>;
    if (!payload.editedContent) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'editedContent is required to edit a plan',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const normalized = normalizePlanContent(
      payload.editedContent,
      definition.planStructure ?? null,
    );
    const planMetadata = extractPlanMetadata(
      normalized.parsed ?? normalized.content,
    );

    const editResult = await services.plansService.executeAction<PlanCreateResponseContent>(
      'edit',
      {
        content: normalized.content,
        metadata: {
          comment: payload.comment,
          planMetadata,
          planStructureApplied: Boolean(definition.planStructure),
        },
      },
      executionContext,
    );

    if (!editResult.success || !editResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        editResult.error?.message ?? 'Failed to edit plan',
      );
    }

    const baseMetadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      planMetadata,
      source: 'manual-edit',
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: serializePlan(editResult.data.plan, definition, userId),
        version: serializePlanVersion(editResult.data.version),
        isNew: true,
      },
      metadata: baseMetadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanRerun(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanRerunPayload;
    if (!payload.versionId || !payload.rerunConfig) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'versionId and rerunConfig are required for rerun action',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const rerunResult =
      await services.plansService.executeAction<PlanRerunResponseContent>(
        'rerun',
        payload,
        executionContext,
      );

    if (!rerunResult.success || !rerunResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        rerunResult.error?.message ?? 'Failed to rerun plan generation',
      );
    }

    const versionMetadata =
      (rerunResult.data.version?.metadata as Record<string, unknown>) ?? {};
    const llmInfo = (versionMetadata?.llmRerunInfo ?? {}) as Record<
      string,
      unknown
    >;
    const llmMetadata = (versionMetadata?.llmMetadata ?? {}) as Record<
      string,
      unknown
    >;

    const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      provider: typeof llmInfo.provider === 'string' ? llmInfo.provider : '',
      model: typeof llmInfo.model === 'string' ? llmInfo.model : '',
      usage: normalizeUsage(llmMetadata.usage),
      planMetadata: extractPlanMetadata(rerunResult.data.version.content),
      sourceVersionId: payload.versionId,
      rerunConfig: payload.rerunConfig,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: serializePlan(rerunResult.data.plan, definition, userId),
        version: serializePlanVersion(rerunResult.data.version),
        isNew: true,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanSetCurrent(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanSetCurrentPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'versionId is required to set current plan version',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const result = await services.plansService.executeAction<PlanCreateResponseContent>(
      'set_current',
      payload,
      executionContext,
    );

    if (!result.success || !result.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        result.error?.message ?? 'Failed to set current plan version',
      );
    }

    const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      planMetadata: extractPlanMetadata(result.data.version.content),
      updatedVersionId: payload.versionId,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: serializePlan(result.data.plan, definition, userId),
        version: serializePlanVersion(result.data.version),
        isNew: false,
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanDeleteVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanDeleteVersionPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'versionId is required to delete a plan version',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const deleteResult = await services.plansService.executeAction(
      'delete_version',
      payload,
      executionContext,
    );

    if (!deleteResult.success || !deleteResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        deleteResult.error?.message ?? 'Failed to delete plan version',
      );
    }

    const serializedPlan = serializePlan(
      deleteResult.data.plan,
      definition,
      userId,
    );
    const remainingVersions = (deleteResult.data.remainingVersions ?? []).map(
      (version: any) => serializePlanVersion(version),
    );

    const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      deletedVersionId: payload.versionId,
      remainingVersionCount: remainingVersions.length,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        deletedVersionId: payload.versionId,
        plan: serializedPlan,
        remainingVersions: remainingVersions.filter(
          (version: any): version is NonNullable<typeof version> => Boolean(version),
        ),
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanMergeVersions(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanMergeVersionsPayload;
    if (!payload.versionIds || payload.versionIds.length < 2) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'At least two versionIds are required to merge versions',
      );
    }

    if (!payload.mergePrompt || payload.mergePrompt.trim().length === 0) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'mergePrompt is required to merge versions',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const planFormat = resolvePlanFormat(definition);
    const mergeResult = await services.plansService.executeAction(
      'merge_versions',
      {
        versionIds: payload.versionIds,
        mergePrompt: payload.mergePrompt,
        planStructure: definition.planStructure ?? null,
        llmConfig: normalizeLlmConfig(definition.llm),
        preferredFormat: planFormat,
      },
      executionContext,
    );

    if (!mergeResult.success || !mergeResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        mergeResult.error?.message ?? 'Failed to merge plan versions',
      );
    }

    const mergedVersion = serializePlanVersion(mergeResult.data.mergedVersion);
    const llmMetadata = mergeResult.data.llmMetadata ?? null;
    const planMetadata = extractPlanMetadata(
      mergeResult.data.mergedVersion?.content,
    );
    const metadata = buildResponseMetadata(
      llmMetadata
        ? {
            provider: llmMetadata.provider ?? '',
            model: llmMetadata.model ?? '',
            usage: normalizeUsage(llmMetadata.usage),
          }
        : (EMPTY_PLAN_METADATA as unknown as Record<string, unknown>),
      {
        planMetadata,
        mergedVersionId: mergedVersion?.id,
        mergedVersionCount: payload.versionIds.length,
      },
    );

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        plan: serializePlan(mergeResult.data.plan, definition, userId),
        mergedVersion,
        sourceVersions: (mergeResult.data.sourceVersions ?? []).map(
          (version: any) => serializePlanVersion(version),
        ),
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanCopyVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanCopyVersionPayload;
    if (!payload.versionId) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'versionId is required to copy a plan version',
      );
    }

    const { userId, executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const copyResult = await services.plansService.executeAction(
      'copy_version',
      payload,
      executionContext,
    );

    if (!copyResult.success || !copyResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        copyResult.error?.message ?? 'Failed to copy plan version',
      );
    }

    const metadata = buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
      sourceVersionId: payload.versionId,
      copiedVersionId: copyResult.data.copiedVersion?.id,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        sourcePlan: serializePlan(copyResult.data.sourcePlan, definition, userId),
        sourceVersion: serializePlanVersion(copyResult.data.sourceVersion),
        targetPlan: serializePlan(copyResult.data.targetPlan, definition, userId),
        copiedVersion: serializePlanVersion(copyResult.data.copiedVersion),
      },
      metadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export async function handlePlanDelete(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void organizationSlug;
  try {
    const payload = (request.payload ?? {}) as PlanDeletePayload;
    void payload;

    const { executionContext } = buildPlanActionContext(
      definition,
      request,
    );

    const deleteResult = await services.plansService.executeAction(
      'delete',
      {},
      executionContext,
    );

    if (!deleteResult.success || !deleteResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        deleteResult.error?.message ?? 'Failed to delete plan',
      );
    }

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        deletedPlanId: deleteResult.data.deletedPlanId,
        deletedVersionCount: deleteResult.data.deletedVersionCount,
      },
      metadata: buildResponseMetadata(EMPTY_PLAN_METADATA as unknown as Record<string, unknown>, {
        deletedPlanId: deleteResult.data.deletedPlanId,
        deletedVersionCount: deleteResult.data.deletedVersionCount,
      }),
    });
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}

export function buildPlanningPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: ConversationMessage[],
  planStructure: unknown,
): string {
  const basePromptCandidates = [
    definition.prompts?.plan,
    definition.prompts?.system,
    definition.llm?.systemPrompt,
    definition.context?.systemPrompt,
  ];

  const basePrompt =
    basePromptCandidates.find(
      (prompt): prompt is string =>
        typeof prompt === 'string' && prompt.trim().length > 0,
    ) ??
    `You are ${definition.displayName ?? definition.slug}, an expert planning assistant. Create detailed, actionable plans.`;

  const historySection =
    conversationHistory.length > 0
      ? conversationHistory
          .map((message) => `${message.role}: ${message.content}`.trim())
          .join('\n')
      : 'No prior conversation history was provided.';

  let prompt = `${basePrompt.trim()}\n\nConversation history:\n${historySection}`;

  if (planStructure) {
    prompt += `\n\nYour plan must follow this structure:\n${safeStringify(planStructure)}`;
    prompt += '\n\nIMPORTANT: You MUST return your response as valid JSON that strictly validates against the plan structure above. Do not return plain text, explanations, or any other format. Return ONLY valid JSON matching the structure exactly.';
  } else {
    prompt +=
      '\n\nGenerate a structured plan with named phases, clear steps, owners, and measurable outcomes.';
  }

  prompt +=
    '\n\nProvide concise steps, sequencing, success criteria, and any dependencies.';

  return prompt;
}

export function validatePlanStructure(
  planContent: unknown,
  planStructure: unknown,
): unknown {
  if (!planStructure) {
    return planContent;
  }

  const schema =
    typeof planStructure === 'string'
      ? parseJsonSafely(planStructure, 'plan_structure must be valid JSON')
      : planStructure;

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });

  const validate = ajv.compile(schema as Record<string, unknown>);
  const candidate = coercePlanContent(planContent);

  if (!validate(candidate)) {
    const message = ajv.errorsText(validate.errors, { separator: '; ' });
    const error = new Error(
      `Plan does not conform to required structure: ${message}`,
    );
    (error as any).details = validate.errors;
    throw error;
  }

  return candidate;
}

export function extractPlanMetadata(
  planContent: unknown,
): Record<string, unknown> {
  if (planContent === undefined || planContent === null) {
    return { hasContent: false };
  }

  if (typeof planContent === 'string') {
    const trimmed = planContent.trim();
    const metadata: Record<string, unknown> = {
      format: 'text',
      contentLength: trimmed.length,
    };

    if (trimmed.length > 0) {
      metadata.preview = trimmed.slice(0, 200);
    }

    const parsed = tryParseJson(trimmed);
    if (parsed !== null) {
      const keys = Object.keys(
        parsed as Record<string, unknown>,
      );
      metadata.format = Array.isArray(parsed) ? 'array' : 'json';
      metadata.keyCount = keys.length;
      if (keys.length > 0) {
        metadata.topLevelKeys = keys.slice(0, 10);
      }
    }

    return metadata;
  }

  if (Array.isArray(planContent)) {
    return {
      format: 'array',
      length: planContent.length,
    };
  }

  if (typeof planContent === 'object') {
    const keys = Object.keys(planContent as Record<string, unknown>);
    return {
      format: 'object',
      keyCount: keys.length,
      topLevelKeys: keys.slice(0, 10),
    };
  }

  return {
    format: typeof planContent,
  };
}

function buildPlanActionContext(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
): {
  userId: string;
  conversationId: string;
  taskId?: string;
  executionContext: ActionExecutionContext;
} {
  const userId = resolveUserId(request);
  if (!userId) {
    throw new Error('Unable to determine user identity for plan operation');
  }

  const conversationId = resolveConversationId(request);
  if (!conversationId) {
    throw new Error('Missing conversationId for plan operation');
  }
  request.conversationId = conversationId;

  const taskId = resolveTaskId(request) ?? undefined;

  return {
    userId,
    conversationId,
    taskId,
    executionContext: {
      conversationId,
      userId,
      agentSlug: definition.slug,
      taskId,
      metadata: request.metadata ?? {},
    },
  };
}

function resolveNamespace(
  definition: AgentRuntimeDefinition,
  organizationSlug: string | null,
): string {
  return organizationSlug ?? definition.organizationSlug ?? 'global';
}

function normalizeUsage(usage: any): typeof EMPTY_USAGE {
  if (!usage || typeof usage !== 'object') {
    return EMPTY_USAGE;
  }

  const inputTokens = numberOrZero(
    usage.inputTokens ?? usage.promptTokens ?? usage.total_input_tokens,
  );
  const outputTokens = numberOrZero(
    usage.outputTokens ?? usage.completionTokens ?? usage.total_output_tokens,
  );
  const totalTokens = numberOrZero(
    usage.totalTokens ?? usage.total_tokens,
    inputTokens + outputTokens,
  );
  const cost = numberOrZero(usage.cost ?? usage.price);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
  };
}

function createBaseMetadataFromLLM(
  response: LLMResponse | null,
): PlanResponseMetadata {
  if (!response) {
    return EMPTY_PLAN_METADATA;
  }

  return {
    provider: response.metadata?.provider ?? '',
    model: response.metadata?.model ?? '',
    usage: normalizeUsage(response.metadata?.usage),
  };
}

function serializePlan(
  plan: Plan | Record<string, any>,
  definition: AgentRuntimeDefinition,
  fallbackUserId: string,
): PlanCreateResponseContent['plan'] {
  const record = plan as Record<string, any>;

  const createdAt = toIsoString(
    record.createdAt ?? record.created_at ?? new Date().toISOString(),
  );
  const updatedAt = toIsoString(
    record.updatedAt ?? record.updated_at ?? createdAt,
  );

  const agentName =
    record.agentName ??
    record.agent_name ??
    definition.displayName ??
    definition.slug;

  const userId = record.userId ?? record.user_id ?? fallbackUserId;
  const namespace = record.namespace ?? record.agent_namespace ?? 'default';

  return {
    id: record.id,
    conversationId: record.conversationId ?? record.conversation_id,
    userId,
    agentName,
    namespace,
    title: record.title ?? record.name ?? 'Plan',
    currentVersionId:
      record.currentVersionId ??
      record.current_version_id ??
      record.currentVersion?.id ??
      '',
    createdAt,
    updatedAt,
  };
}

function serializePlanVersion(
  version: PlanVersion | Record<string, any> | null | undefined,
): PlanCreateResponseContent['version'] | null {
  if (!version) {
    return null;
  }

  const record = version as Record<string, any>;
  const rawFormat = typeof record.format === 'string' ? record.format : 'markdown';
  const format: 'json' | 'markdown' =
    rawFormat === 'text' ? 'markdown' :
    rawFormat === 'json' ? 'json' :
    'markdown';

  return {
    id: record.id,
    planId: record.planId ?? record.plan_id,
    versionNumber: numberOrZero(
      record.versionNumber ?? record.version_number ?? 1,
      1,
    ),
    content: record.content ?? '',
    format,
    createdByType:
      record.createdByType ?? record.created_by_type ?? 'agent',
    createdById:
      record.createdById ?? record.created_by_id ?? null,
    metadata: record.metadata ?? undefined,
    isCurrentVersion: Boolean(
      record.isCurrentVersion ?? record.is_current_version,
    ),
    createdAt: toIsoString(record.createdAt ?? record.created_at),
  };
}

function normalizePlanContent(
  rawContent: unknown,
  planStructure: unknown,
): { content: string; parsed?: unknown } {
  if (planStructure) {
    const validated = validatePlanStructure(rawContent, planStructure);

    if (validated === undefined || validated === null) {
      return { content: '' };
    }

    if (typeof validated === 'string') {
      return { content: validated };
    }

    return {
      content: JSON.stringify(validated, null, 2),
      parsed: validated,
    };
  }

  if (typeof rawContent === 'string') {
    const candidate = extractCodeFenceContent(rawContent.trim());
    const parsed = tryParseJson(candidate);
    if (parsed !== null) {
      return {
        content: JSON.stringify(parsed, null, 2),
        parsed,
      };
    }

    return { content: candidate };
  }

  if (rawContent && typeof rawContent === 'object') {
    return {
      content: JSON.stringify(rawContent, null, 2),
      parsed: rawContent,
    };
  }

  return {
    content:
      rawContent === undefined || rawContent === null
        ? ''
        : String(rawContent),
  };
}

function resolvePlanFormat(
  definition: AgentRuntimeDefinition,
): 'markdown' | 'json' | 'text' {
  const formatCandidate =
    (definition.config as any)?.plan?.format ??
    (definition.config as any)?.plan?.outputFormat ??
    (definition.config as any)?.planning?.format ??
    (definition.config as any)?.planFormat;

  if (typeof formatCandidate === 'string') {
    const normalized = formatCandidate.toLowerCase();
    if (normalized === 'json') {
      return 'json';
    }
    if (normalized === 'markdown') {
      return 'markdown';
    }
  }

  return 'markdown';
}

function coercePlanContent(planContent: unknown): unknown {
  if (typeof planContent === 'string') {
    const candidate = extractCodeFenceContent(planContent.trim());
    const parsed = tryParseJson(candidate);
    return parsed !== null ? parsed : candidate;
  }

  if (Array.isArray(planContent)) {
    return planContent;
  }

  if (planContent && typeof planContent === 'object') {
    return planContent;
  }

  return planContent ?? '';
}

function tryParseJson(value: string): any | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractCodeFenceContent(value: string): string {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }
  return value;
}

function parseJsonSafely(value: string, errorMessage: string): any {
  try {
    return JSON.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Unable to parse JSON';
    throw new Error(`${errorMessage}: ${reason}`);
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function numberOrZero(value: unknown, fallback = 0): number {
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

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeLlmConfig(
  llmConfig: AgentRuntimeDefinition['llm'] | undefined,
): Record<string, unknown> | null {
  if (!llmConfig) {
    return null;
  }

  const provider =
    typeof llmConfig.provider === 'string'
      ? llmConfig.provider
      : typeof llmConfig.raw?.provider === 'string'
        ? llmConfig.raw.provider
        : undefined;

  const model =
    typeof llmConfig.model === 'string'
      ? llmConfig.model
      : typeof llmConfig.raw?.model === 'string'
        ? llmConfig.raw.model
        : undefined;

  const normalized: Record<string, unknown> = {};

  if (provider) {
    normalized.provider = provider;
    normalized.providerName = provider;
  }

  if (model) {
    normalized.model = model;
    normalized.modelName = model;
  }

  if (typeof llmConfig.temperature === 'number') {
    normalized.temperature = llmConfig.temperature;
  }

  if (typeof llmConfig.maxTokens === 'number') {
    normalized.maxTokens = llmConfig.maxTokens;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}
