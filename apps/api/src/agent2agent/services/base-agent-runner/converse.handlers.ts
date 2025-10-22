import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import type { ConversationMessage } from '../../context-optimization/context-optimization.service';
import { LLMService } from '@llm/llm.service';
import { ConverseModePayload } from '@orchestrator-ai/transport-types';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import {
  fetchConversationHistory,
  callLLM,
  resolveUserId,
  resolveConversationId,
  handleError,
  buildResponseMetadata,
  shouldStreamResponse,
} from './shared.helpers';
import { TaskRequestDto, AgentTaskMode } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';

export interface ConverseHandlerDependencies {
  llmService: LLMService;
  conversationsService: Agent2AgentConversationsService;
}

/**
 * Executes conversational mode for an agent.
 * @param definition - Agent runtime definition configuration
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Required service dependencies for execution
 * @returns A task response containing conversation results
 */
export async function executeConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: ConverseHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    const userId = resolveUserId(request);
    if (!userId) {
      throw new Error('Unable to determine user identity for conversation');
    }

    const existingConversationId = resolveConversationId(request) ?? undefined;
    const namespace =
      organizationSlug ?? definition.organizationSlug ?? 'global';

    const conversation =
      await services.conversationsService.getOrCreateConversation(
        existingConversationId,
        userId,
        definition.slug,
        namespace ?? 'global',
      );

    request.conversationId = conversation.id;

    const history = await fetchConversationHistory(
      services.conversationsService,
      request,
    );

    const systemPrompt = buildConversationalPrompt(definition, history);
    const payload = (request.payload ?? {}) as ConverseModePayload;
    const userMessage = request.userMessage?.trim() ?? '';

    if (!userMessage) {
      throw new Error('User message is required to execute Converse mode');
    }

    // Extract LLM configuration from payload (required from frontend)
    // Frontend sends config.provider and config.model in the payload
    const payloadRec = payload as Record<string, unknown>;
    const llmSelection = payloadRec.llmSelection as
      | Record<string, unknown>
      | undefined;
    const config = payloadRec.config as
      | {
          provider?: string;
          model?: string;
          temperature?: number;
          maxTokens?: number;
        }
      | undefined;
    const providerName = config?.provider ?? llmSelection?.providerName;
    const modelName = config?.model ?? llmSelection?.modelName;

    // Validate LLM configuration (no fallbacks - frontend must provide)
    if (!providerName || !modelName) {
      throw new Error(
        'LLM provider and model must be specified in the request payload. ' +
          'Frontend must send config.provider and config.model.',
      );
    }

    const llmConfig = {
      providerName,
      modelName,
      temperature:
        config?.temperature ?? llmSelection?.temperature ?? payload.temperature,
      maxTokens:
        config?.maxTokens ?? llmSelection?.maxTokens ?? payload.maxTokens,
      conversationId: conversation.id,
      sessionId: request.sessionId,
      userId,
      organizationSlug: namespace,
      agentSlug: definition.slug,
      stream: shouldStreamResponse(request),
      callerType: 'agent',
      callerName: `${definition.slug}-converse`,
    };

    const llmResponse = await callLLM(
      services.llmService,
      llmConfig,
      systemPrompt,
      userMessage,
      history,
    );

    const timestamp = new Date().toISOString();
    const updatedHistory: ConversationMessage[] = [...history];

    if (userMessage.length > 0) {
      updatedHistory.push({
        role: 'user',
        content: userMessage,
        timestamp,
      });
    }

    updatedHistory.push({
      role: 'assistant',
      content: llmResponse.content,
      timestamp,
      metadata: {
        provider: llmResponse.metadata?.provider,
        model: llmResponse.metadata?.model,
      },
    });

    const maxHistoryEntries = 50;
    const trimmedHistory =
      updatedHistory.length > maxHistoryEntries
        ? updatedHistory.slice(updatedHistory.length - maxHistoryEntries)
        : updatedHistory;

    await services.conversationsService.updateConversation(
      conversation.id,
      userId,
      {
        metadata: {
          history: trimmedHistory,
          lastAssistantMessageAt: timestamp,
        },
      },
    );

    const usage = llmResponse.metadata?.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    const normalizedUsage = {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens:
        usage.totalTokens ??
        (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      cost: usage.cost ?? 0,
    };

    const responseMetadata = buildResponseMetadata(
      {
        provider: llmResponse.metadata?.provider ?? 'unknown',
        model: llmResponse.metadata?.model ?? 'unknown',
        usage: normalizedUsage,
        thinking: llmResponse.metadata?.thinking,
      },
      undefined,
    );

    return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      content: {
        message: llmResponse.content,
      },
      metadata: responseMetadata,
    });
  } catch (error) {
    return handleError(AgentTaskMode.CONVERSE, error);
  }
}

/**
 * Builds the system prompt used for conversational interactions.
 * @param definition - Agent runtime definition containing prompt templates
 * @param conversationHistory - Ordered list of prior conversation messages
 * @returns A formatted system prompt string
 */
export function buildConversationalPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: ConversationMessage[],
): string {
  const promptCandidate =
    definition.prompts?.system ??
    definition.llm?.systemPrompt ??
    definition.context?.system_prompt ??
    definition.context?.systemPrompt ??
    definition.description;

  const fallbackName = definition.displayName ?? definition.slug;
  let prompt =
    typeof promptCandidate === 'string' && promptCandidate.trim().length > 0
      ? promptCandidate.trim()
      : [
          `You are ${fallbackName}.`,
          'Respond helpfully and concisely.',
          'Ask a clarifying question when it helps progress the conversation.',
          'Follow organizational policies and agent guidelines.',
        ].join(' ');

  const additionalGuidance =
    typeof definition.context?.conversation_guidelines === 'string'
      ? definition.context?.conversation_guidelines
      : typeof definition.context?.conversationGuidelines === 'string'
        ? definition.context?.conversationGuidelines
        : typeof definition.context?.instructions === 'string'
          ? definition.context?.instructions
          : null;

  if (additionalGuidance && additionalGuidance.trim().length > 0) {
    prompt += `\n\nAgent guidance:\n${additionalGuidance.trim()}`;
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const formattedHistory = conversationHistory
      .slice(-10)
      .map((message) =>
        `${message.role ?? 'unknown'}: ${message.content ?? ''}`.trim(),
      )
      .filter((line) => line.length > 0)
      .join('\n');

    if (formattedHistory.length > 0) {
      prompt += `\n\nRecent conversation history:\n${formattedHistory}`;
    }
  }

  return prompt;
}
