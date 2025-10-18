import { NotFoundException } from '@nestjs/common';
import { LLMService } from '@llm/llm.service';
import type { LLMResponse } from '@llm/services/llm-interfaces';
import type { ConversationMessage } from '../../context-optimization/context-optimization.service';
import { PlansService } from '../../plans/services/plans.service';
import { DeliverablesService } from '../../deliverables/deliverables.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { ContextOptimizationService } from '../../context-optimization/context-optimization.service';
import { TaskRequestDto, AgentTaskMode } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';
import type { AgentRuntimeDefinition } from '../../../agent-platform/interfaces/database-agent-definition.interface';

/**
 * Fetches conversation history required for agent execution.
 * @param conversationsService - Conversations service dependency
 * @param request - Task request containing conversation identifiers
 * @returns A list of conversation messages
 */
export async function fetchConversationHistory(
  conversationsService: Agent2AgentConversationsService,
  request: TaskRequestDto,
): Promise<ConversationMessage[]> {
  const inlineMessages = Array.isArray(request.messages)
    ? request.messages
        .map((message) => ({
          role: String(message.role ?? '').trim() || 'user',
          content:
            typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content ?? ''),
          timestamp: new Date().toISOString(),
        }))
        .filter((message) => message.content.length > 0)
    : [];

  const userId = resolveUserId(request);
  const conversationId = resolveConversationId(request);

  if (!userId || !conversationId) {
    return inlineMessages;
  }

  try {
    const conversation = await conversationsService.getConversationById(
      conversationId,
      userId,
    );

    const metadataHistory = conversation?.metadata?.history;
    if (!Array.isArray(metadataHistory)) {
      return inlineMessages;
    }

    const normalizedHistory = metadataHistory
      .map((item: any): ConversationMessage | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const role = typeof item.role === 'string' ? item.role : null;
        const content =
          typeof item.content === 'string'
            ? item.content
            : typeof item.content !== 'undefined'
              ? JSON.stringify(item.content)
              : null;
        if (!role || !content) {
          return null;
        }

        return {
          role,
          content,
          timestamp:
            typeof item.timestamp === 'string'
              ? item.timestamp
              : new Date().toISOString(),
          metadata:
            item.metadata && typeof item.metadata === 'object'
              ? item.metadata
              : undefined,
        };
      })
      .filter((message): message is ConversationMessage => Boolean(message));

    return normalizedHistory.length > 0 ? normalizedHistory : inlineMessages;
  } catch (_error) {
    return inlineMessages;
  }
}

/**
 * Fetches existing plan data for the provided request context.
 * @param plansService - Plans service dependency
 * @param request - Task request containing plan identifiers
 * @returns The plan data if present
 */
export async function fetchExistingPlan(
  plansService: PlansService,
  request: TaskRequestDto,
): Promise<unknown> {
  const userId = resolveUserId(request);
  if (!userId) {
    return null;
  }

  const planIdCandidates: Array<unknown> = [
    request.planId,
    request.payload?.planId,
    request.payload?.plan?.id,
    request.metadata?.planId,
    request.metadata?.plan_id,
  ];

  const planId = planIdCandidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );

  try {
    if (planId) {
      return await plansService.findOne(planId, userId);
    }

    const conversationId = resolveConversationId(request);
    if (!conversationId) {
      return null;
    }

    return await plansService.findByConversationId(conversationId, userId);
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetches deliverable details used for BUILD mode helpers.
 * @param deliverablesService - Deliverables service dependency
 * @param request - Task request containing deliverable identifiers
 * @returns Deliverable payload data
 */
export async function fetchExistingDeliverable(
  deliverablesService: DeliverablesService,
  request: TaskRequestDto,
): Promise<unknown> {
  const userId = resolveUserId(request);
  if (!userId) {
    return null;
  }

  const deliverableIdCandidates: Array<unknown> = [
    request.payload?.deliverableId,
    request.payload?.deliverable?.id,
    request.metadata?.deliverableId,
    request.metadata?.deliverable_id,
  ];

  const deliverableId = deliverableIdCandidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );

  try {
    if (deliverableId) {
      return await deliverablesService.findOne(deliverableId, userId);
    }

    const conversationId = resolveConversationId(request);
    if (!conversationId) {
      return null;
    }

    const deliverables = await deliverablesService.findByConversationId(
      conversationId,
      userId,
    );

    return deliverables.length > 0 ? deliverables[0] : null;
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    throw error;
  }
}

/**
 * Optimizes contextual data for downstream LLM calls.
 * @param contextOptimization - Context optimization service dependency
 * @param history - Conversation history to optimize
 * @param definition - Agent definition providing configuration
 * @returns Optimized context data
 */
export async function optimizeContext(
  contextOptimization: ContextOptimizationService,
  history: unknown[],
  definition: AgentRuntimeDefinition,
): Promise<ConversationMessage[]> {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  const conversationHistory = history
    .map((entry): ConversationMessage | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const message = entry as Partial<ConversationMessage>;
      if (typeof message.role !== 'string' || typeof message.content !== 'string') {
        return null;
      }

      return {
        role: message.role,
        content: message.content,
        timestamp:
          typeof message.timestamp === 'string' && message.timestamp.trim().length > 0
            ? message.timestamp
            : new Date().toISOString(),
        metadata:
          message.metadata && typeof message.metadata === 'object'
            ? message.metadata
            : undefined,
      };
    })
    .filter((message): message is ConversationMessage => message !== null);

  if (conversationHistory.length === 0) {
    return [];
  }

  const tokenBudgetCandidates: Array<unknown> = [
    (definition.config as any)?.plan?.tokenBudget,
    (definition.config as any)?.plan?.token_budget,
    (definition.config as any)?.planning?.tokenBudget,
    (definition.config as any)?.planning?.token_budget,
    (definition.config as any)?.context?.tokenBudget,
    (definition.config as any)?.context?.token_budget,
    (definition.context as any)?.tokenBudget,
    (definition.context as any)?.token_budget,
  ];

  const resolvedBudget =
    tokenBudgetCandidates
      .map((candidate) => {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          return candidate;
        }

        if (typeof candidate === 'string') {
          const parsed = Number(candidate);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }

        return null;
      })
      .find((value): value is number => value !== null && value > 0) ?? 8000;

  try {
    return await contextOptimization.optimizeContext({
      fullHistory: conversationHistory,
      tokenBudget: resolvedBudget,
    });
  } catch (_error) {
    return conversationHistory;
  }
}

/**
 * Calls the configured LLM provider for content generation.
 * @param llmService - LLM service dependency
 * @param llmConfig - Configuration overrides for the LLM request
 * @param systemPrompt - System prompt passed to the model
 * @param userMessage - User message prompt content
 * @param conversationHistory - Optional conversation history context
 * @returns The raw LLM response payload
 */
export async function callLLM(
  llmService: LLMService,
  llmConfig: Record<string, unknown> | null | undefined,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[],
): Promise<LLMResponse> {
  if (!userMessage || !userMessage.trim()) {
    throw new Error('User message is required for LLM invocation');
  }

  const config = llmConfig ?? {};
  const provider =
    typeof config.provider === 'string'
      ? config.provider
      : typeof config.providerName === 'string'
        ? config.providerName
        : null;
  const model =
    typeof config.model === 'string'
      ? config.model
      : typeof config.modelName === 'string'
        ? config.modelName
        : null;

  if (!provider || !model) {
    throw new Error('LLM provider and model must be explicitly specified in the configuration');
  }

  // DEBUG: Log LLM configuration before processing
  console.log('🔍 [DEBUG] callLLM - Input llmConfig:', JSON.stringify(llmConfig, null, 2));
  console.log('🔍 [DEBUG] callLLM - Resolved provider:', provider);
  console.log('🔍 [DEBUG] callLLM - Resolved model:', model);
  console.log('🔍 [DEBUG] callLLM - System prompt (first 500 chars):', systemPrompt.substring(0, 500));
  console.log('🔍 [DEBUG] callLLM - System prompt (last 500 chars):', systemPrompt.substring(Math.max(0, systemPrompt.length - 500)));
  console.log('🔍 [DEBUG] callLLM - User message:', userMessage);

  const temperature =
    typeof config.temperature === 'number' ? config.temperature : undefined;
  const maxTokens =
    typeof config.maxTokens === 'number' ? config.maxTokens : undefined;
  const stream =
    typeof config.stream === 'boolean' ? config.stream : undefined;
  const conversationId =
    typeof config.conversationId === 'string'
      ? (config.conversationId as string)
      : undefined;
  const sessionId =
    typeof config.sessionId === 'string'
      ? (config.sessionId as string)
      : undefined;
  const userId =
    typeof config.userId === 'string' ? (config.userId as string) : undefined;
  const callerType =
    typeof config.callerType === 'string'
      ? (config.callerType as string)
      : 'agent';
  const callerName =
    typeof config.callerName === 'string'
      ? (config.callerName as string)
      : 'agent-converse-mode';
  const organizationSlug =
    typeof config.organizationSlug === 'string'
      ? (config.organizationSlug as string)
      : config.organizationSlug === null
        ? null
        : undefined;
  const agentSlug =
    typeof config.agentSlug === 'string'
      ? (config.agentSlug as string)
      : undefined;

  try {
    const options: Record<string, any> = {
      temperature,
      maxTokens,
      stream,
      provider: provider as
        | 'openai'
        | 'anthropic'
        | 'ollama'
        | 'google'
        | string,
      providerName: provider,
      conversationId,
      sessionId,
      userId,
      callerType,
      callerName,
      organizationSlug,
      agentSlug,
      // Pass conversation history for providers that support it.
      previousMessages: conversationHistory,
    };

    if (model) {
      options.modelName = model;
    }

    const response = await llmService.generateResponse(
      systemPrompt,
      userMessage,
      options as any,
    );

    if (
      !response ||
      typeof response !== 'object' ||
      typeof (response as LLMResponse).content !== 'string'
    ) {
      throw new Error('LLM returned an unexpected response');
    }

    return response as LLMResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to generate response from LLM');
  }
}

/**
 * Resolves the user identifier from a task request.
 * @param request - Task request containing metadata
 * @returns The resolved user identifier or null
 */
export function resolveUserId(request: TaskRequestDto): string | null {
  const fromMetadata = request.metadata?.userId ?? request.metadata?.createdBy;
  if (fromMetadata) {
    return String(fromMetadata);
  }

  const payload = request.payload ?? {};
  const fromPayload =
    payload.userId ??
    payload.createdBy ??
    payload.metadata?.userId ??
    payload.metadata?.createdBy;
  if (fromPayload) {
    return String(fromPayload);
  }

  const fromMessages = Array.isArray(request.messages)
    ? request.messages
        .map((message) => (message as any)?.metadata?.userId)
        .find((value) => typeof value === 'string' && value.trim().length > 0)
    : null;

  if (fromMessages) {
    return String(fromMessages);
  }

  return null;
}

/**
 * Resolves the conversation identifier from a task request.
 * @param request - Task request containing metadata
 * @returns The resolved conversation identifier or null
 */
export function resolveConversationId(request: TaskRequestDto): string | null {
  if (typeof request.conversationId === 'string') {
    return request.conversationId;
  }

  const payloadConversation =
    request.payload?.conversationId ?? request.payload?.metadata?.conversationId;
  if (typeof payloadConversation === 'string') {
    return payloadConversation;
  }

  const metadataConversation = request.metadata?.conversationId;
  if (typeof metadataConversation === 'string') {
    return metadataConversation;
  }

  return null;
}

/**
 * Resolves the task identifier from a task request.
 * @param request - Task request containing metadata
 * @returns The resolved task identifier or null
 */
export function resolveTaskId(request: TaskRequestDto): string | null {
  const metadataTaskId = request.metadata?.taskId;
  if (typeof metadataTaskId === 'string') {
    return metadataTaskId;
  }

  const payloadTaskId =
    (request.payload as any)?.taskId ??
    (request.payload as any)?.metadata?.taskId;
  if (typeof payloadTaskId === 'string') {
    return payloadTaskId;
  }

  return null;
}

/**
 * Builds metadata for task responses.
 * @param baseMetadata - Base metadata payload
 * @param overrides - Additional overrides applied to metadata
 * @returns Merged metadata object
 */
export function buildResponseMetadata(
  baseMetadata: Record<string, unknown> | null | undefined,
  overrides: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...(baseMetadata ?? {}),
    ...(overrides ?? {}),
  };
}

/**
 * Handles an error by converting it into a TaskResponseDto failure.
 * @param mode - Agent task mode associated with the error
 * @param error - Underlying error that occurred
 * @returns A failure task response
 */
export function handleError(
  mode: AgentTaskMode,
  error: unknown,
): TaskResponseDto {
  const reason =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  return TaskResponseDto.failure(mode, reason);
}

/**
 * Determines whether the request prefers streaming delivery.
 * @param request - Task request containing streaming preferences
 * @returns True when streaming is requested
 */
export function shouldStreamResponse(request: TaskRequestDto): boolean {
  const payloadStream =
    request.payload?.options?.stream ?? request.payload?.stream;
  if (typeof payloadStream === 'boolean') {
    return payloadStream;
  }

  if (typeof request.metadata?.stream === 'boolean') {
    return request.metadata.stream;
  }

  return false;
}
