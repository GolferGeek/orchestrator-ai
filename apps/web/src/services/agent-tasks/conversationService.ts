/**
 * Conversation Service
 *
 * Handles Converse mode operations for agent conversations.
 * This service manages all conversation-related business logic, keeping the store
 * as pure state. The frontend updates automatically via Vue reactivity.
 *
 * Key Responsibilities:
 * - Send converse requests to backend
 * - Process converse responses
 * - Update store state via simple mutations
 * - Handle streaming responses
 * - Manage conversation lifecycle
 */

import type {
  AgentTaskMode,
  ConverseRequest,
  ConverseResponse,
  LLMSelection,
  ServiceConfig,
  ServiceError,
  SendTaskParams,
} from './types';
import {
  createServiceError,
  validateRequired,
  buildRequestMetadata,
  debugLog,
  extractErrorMessage,
  extractErrorCode,
} from './types';
import { tasksService } from '../tasksService';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useLLMStore } from '@/stores/llmStore';
import { useAuthStore } from '@/stores/authStore';
import { usePlanStore } from '@/stores/planStore';

/**
 * Parameters for sending a converse request
 */
export interface SendConverseParams {
  agentSlug: string;
  namespace?: string;
  userMessage: string;
  conversationId: string;
  llmSelection: LLMSelection;
  stream?: boolean;
}

/**
 * Conversation Service
 */
export class ConversationService {
  private config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Sends a converse request to the backend
   *
   * @param params - Converse parameters
   * @returns The converse response
   */
  async sendConverse(params: SendConverseParams): Promise<ConverseResponse> {
    debugLog(this.config, 'sendConverse', params);

    try {
      // Validate required parameters
      validateRequired(params, ['agentSlug', 'userMessage', 'conversationId']);
      validateRequired(params.llmSelection, ['providerName', 'modelName']);

      const authStore = useAuthStore();
      const userId = authStore.user?.id;
      if (!userId) {
        throw createServiceError('AUTH_ERROR', 'User not authenticated');
      }

      // Build request metadata
      const metadata = buildRequestMetadata(userId, params.conversationId, params.stream);

      // Create converse request payload
      const request: ConverseRequest = {
        mode: 'converse' as AgentTaskMode.CONVERSE,
        userMessage: params.userMessage,
        llmSelection: params.llmSelection,
        metadata,
        temperature: params.llmSelection.temperature,
        maxTokens: params.llmSelection.maxTokens,
      };

      debugLog(this.config, 'Sending converse request:', request);

      // Send request to backend via tasksService
      const response = await tasksService.createAgentTask(
        'agent', // agentType - not used in new routing
        params.agentSlug,
        {
          method: 'agent.converse',
          prompt: params.userMessage,
          conversationId: params.conversationId,
          llmSelection: params.llmSelection,
          params: {
            mode: 'converse',
            payload: {
              temperature: params.llmSelection.temperature,
              maxTokens: params.llmSelection.maxTokens,
            },
          },
        },
        {
          namespace: params.namespace || 'demo',
        }
      );

      debugLog(this.config, 'Received converse response:', response);

      // Handle the response
      return await this.handleResponse(response, params.conversationId);
    } catch (error) {
      debugLog(this.config, 'Error in sendConverse:', error);
      return this.handleError(error, params.conversationId);
    }
  }

  /**
   * Processes a converse response from the backend
   *
   * @param response - Raw backend response
   * @param conversationId - Conversation ID
   * @returns Processed converse response
   */
  async handleResponse(response: any, conversationId: string): Promise<ConverseResponse> {
    debugLog(this.config, 'handleResponse', { response, conversationId });

    try {
      // Extract result from JSON-RPC response
      const result = response.result;
      if (!result) {
        throw createServiceError(
          'INVALID_RESPONSE',
          'Response does not contain result',
          { response }
        );
      }

      // Check if response indicates success
      if (result.success === false) {
        return this.handleErrorResponse(result, conversationId);
      }

      return this.handleSuccess(result, conversationId);
    } catch (error) {
      debugLog(this.config, 'Error in handleResponse:', error);
      throw createServiceError(
        'RESPONSE_PROCESSING_ERROR',
        extractErrorMessage(error),
        { response },
        error as Error
      );
    }
  }

  /**
   * Handles a successful converse response
   *
   * @param response - Successful converse response
   * @param conversationId - Conversation ID
   * @returns Processed converse response
   */
  private handleSuccess(response: any, conversationId: string): ConverseResponse {
    debugLog(this.config, 'handleSuccess', { response, conversationId });

    try {
      // Extract message from response content
      const message = response.content?.message || response.payload?.content?.message || '';

      // Build standard converse response
      const converseResponse: ConverseResponse = {
        success: true,
        mode: 'converse' as AgentTaskMode.CONVERSE,
        content: {
          message,
        },
        metadata: {
          provider: response.metadata?.provider || 'unknown',
          model: response.metadata?.model || 'unknown',
          usage: {
            inputTokens: response.metadata?.usage?.inputTokens || 0,
            outputTokens: response.metadata?.usage?.outputTokens || 0,
            totalTokens: response.metadata?.usage?.totalTokens || 0,
            cost: response.metadata?.usage?.cost || 0,
          },
          executionTimeMs: response.metadata?.executionTimeMs,
          streamId: response.metadata?.streamId,
        },
      };

      // Update store with new message (Vue reactivity handles UI updates)
      const chatStore = useAgentChatStore();
      chatStore.addMessage(conversationId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: message,
        timestamp: new Date(),
        metadata: {
          provider: converseResponse.metadata.provider,
          model: converseResponse.metadata.model,
          usage: converseResponse.metadata.usage,
        },
      });

      debugLog(this.config, 'Success handled, message added to store');

      return converseResponse;
    } catch (error) {
      debugLog(this.config, 'Error in handleSuccess:', error);
      throw createServiceError(
        'SUCCESS_PROCESSING_ERROR',
        extractErrorMessage(error),
        { response },
        error as Error
      );
    }
  }

  /**
   * Handles an error response from the backend
   *
   * @param response - Error response
   * @param conversationId - Conversation ID
   * @returns Processed error response
   */
  private handleErrorResponse(response: any, conversationId: string): ConverseResponse {
    debugLog(this.config, 'handleErrorResponse', { response, conversationId });

    const errorCode = response.error?.code || response.payload?.error?.code || 'UNKNOWN_ERROR';
    const errorMessage = response.error?.message || response.payload?.error?.message || 'An error occurred';
    const errorDetails = response.error?.details || response.payload?.error?.details;

    // Build error response
    const converseResponse: ConverseResponse = {
      success: false,
      mode: 'converse' as AgentTaskMode.CONVERSE,
      content: {
        message: '',
      },
      metadata: {
        provider: 'unknown',
        model: 'unknown',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
      },
    };

    // Update store with error state (Vue reactivity handles UI updates)
    const chatStore = useAgentChatStore();
    chatStore.setError(conversationId, errorMessage);

    return converseResponse;
  }

  /**
   * Handles errors that occur during processing
   *
   * @param error - Error that occurred
   * @param conversationId - Conversation ID
   * @returns Error response
   */
  private handleError(error: any, conversationId: string): ConverseResponse {
    debugLog(this.config, 'handleError', { error, conversationId });

    const errorCode = extractErrorCode(error);
    const errorMessage = extractErrorMessage(error);

    // Build error response
    const converseResponse: ConverseResponse = {
      success: false,
      mode: 'converse' as AgentTaskMode.CONVERSE,
      content: {
        message: '',
      },
      metadata: {
        provider: 'unknown',
        model: 'unknown',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: error,
      },
    };

    // Update store with error state (Vue reactivity handles UI updates)
    const chatStore = useAgentChatStore();
    chatStore.setError(conversationId, errorMessage);

    // Re-throw for caller to handle if needed
    throw createServiceError(errorCode, errorMessage, error);
  }

  /**
   * Creates a new conversation
   *
   * @param agent - Agent configuration
   * @returns Conversation ID
   */
  async createConversation(agent: any): Promise<string> {
    debugLog(this.config, 'createConversation', agent);

    const chatStore = useAgentChatStore();
    const conversationId = crypto.randomUUID();

    // Add conversation to store (Vue reactivity handles UI updates)
    chatStore.addConversation({
      id: conversationId,
      agent,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
      chatMode: 'converse',
      allowedChatModes: ['converse', 'plan', 'build'],
      executionMode: 'immediate',
      supportedExecutionModes: ['immediate'],
      title: `Conversation with ${agent.name}`,
      isLoading: false,
      isSendingMessage: false,
    });

    return conversationId;
  }

  /**
   * Loads an existing conversation
   *
   * @param conversationId - Conversation ID to load
   */
  async loadConversation(conversationId: string): Promise<void> {
    debugLog(this.config, 'loadConversation', conversationId);

    const chatStore = useAgentChatStore();

    // Set active conversation (Vue reactivity handles UI updates)
    chatStore.setActiveConversation(conversationId);
  }

  /**
   * Deletes a conversation
   *
   * @param conversationId - Conversation ID to delete
   */
  async deleteConversation(conversationId: string): Promise<void> {
    debugLog(this.config, 'deleteConversation', conversationId);

    const chatStore = useAgentChatStore();

    // Remove conversation from store (Vue reactivity handles UI updates)
    chatStore.removeConversation(conversationId);
  }
}

// Export singleton instance
export const conversationService = new ConversationService();
