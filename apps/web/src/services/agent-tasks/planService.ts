/**
 * Plan Service
 *
 * Handles Plan mode operations for agent task planning.
 * This service manages all plan-related business logic, keeping the store
 * as pure state. The frontend updates automatically via Vue reactivity.
 *
 * Key Responsibilities:
 * - Route plan actions to appropriate handlers
 * - Send plan requests to backend
 * - Process plan responses
 * - Update store state via simple mutations
 * - Manage plan lifecycle (create, read, edit, versions, etc.)
 */

import type { PlanData } from '@orchestrator-ai/transport-types';
import type {
  AgentTaskMode,
  PlanAction,
  LLMSelection,
  ServiceConfig,
  ServiceError,
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
 * Base parameters for plan operations
 */
interface BasePlanParams {
  agentSlug: string;
  namespace?: string;
  conversationId: string;
}

/**
 * Parameters for creating a plan
 */
export interface PlanCreateParams extends BasePlanParams {
  userMessage: string;
  llmSelection: LLMSelection;
  title?: string;
  description?: string;
}

/**
 * Parameters for reading a plan
 */
export interface PlanReadParams extends BasePlanParams {
  planId: string;
  version?: number;
}

/**
 * Parameters for listing plans
 */
export interface PlanListParams extends BasePlanParams {
  titleFilter?: string;
  limit?: number;
  offset?: number;
}

/**
 * Plan Service
 */
export class PlanService {
  private config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Routes a plan action to the appropriate handler
   *
   * @param action - Plan action to perform
   * @param params - Action-specific parameters
   * @returns Action response
   */
  async handleAction(action: PlanAction, params: any): Promise<any> {
    debugLog(this.config, 'handleAction', { action, params });

    switch (action) {
      case 'create':
        return this.create(params);
      case 'read':
        return this.read(params);
      case 'list':
        return this.list(params);
      case 'edit':
        return this.edit(params);
      case 'set-current':
        return this.setCurrent(params);
      case 'delete-version':
        return this.deleteVersion(params);
      case 'merge-versions':
        return this.mergeVersions(params);
      case 'copy-version':
        return this.copyVersion(params);
      case 'delete':
        return this.delete(params);
      default:
        throw createServiceError(
          'UNKNOWN_ACTION',
          `Unknown plan action: ${action}`,
          { action }
        );
    }
  }

  /**
   * Creates a new plan
   *
   * @param params - Plan creation parameters
   * @returns Plan creation response
   */
  async create(params: PlanCreateParams): Promise<any> {
    debugLog(this.config, 'create', params);

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
      const metadata = buildRequestMetadata(userId, params.conversationId);

      // Build plan create payload
      const payload = {
        action: 'create' as const,
        title: params.title,
        description: params.description,
      };

      debugLog(this.config, 'Sending plan create request:', { payload, params });

      // Send request to backend via tasksService
      const response = await tasksService.createAgentTask(
        'agent',
        params.agentSlug,
        {
          method: 'agent.plan',
          prompt: params.userMessage,
          conversationId: params.conversationId,
          llmSelection: params.llmSelection,
          params: {
            mode: 'plan',
            action: 'create',
            payload,
          },
        },
        {
          namespace: params.namespace || 'demo',
        }
      );

      debugLog(this.config, 'Received plan create response:', response);

      // Handle the response
      return await this.handleResponse(response, params.conversationId);
    } catch (error) {
      debugLog(this.config, 'Error in create:', error);
      return this.handleError(error, params.conversationId);
    }
  }

  /**
   * Reads a plan
   *
   * @param params - Plan read parameters
   * @returns Plan read response
   */
  async read(params: PlanReadParams): Promise<any> {
    debugLog(this.config, 'read', params);

    try {
      validateRequired(params, ['agentSlug', 'planId', 'conversationId']);

      const authStore = useAuthStore();
      const userId = authStore.user?.id;
      if (!userId) {
        throw createServiceError('AUTH_ERROR', 'User not authenticated');
      }

      // Build request metadata
      const metadata = buildRequestMetadata(userId, params.conversationId);

      // Build plan read payload
      const payload = {
        action: 'read' as const,
        planId: params.planId,
        version: params.version,
      };

      const response = await tasksService.createAgentTask(
        'agent',
        params.agentSlug,
        {
          method: 'agent.plan',
          prompt: '', // No user message for read
          conversationId: params.conversationId,
          params: {
            mode: 'plan',
            action: 'read',
            payload,
          },
        },
        {
          namespace: params.namespace || 'demo',
        }
      );

      return await this.handleResponse(response, params.conversationId);
    } catch (error) {
      return this.handleError(error, params.conversationId);
    }
  }

  /**
   * Lists plans
   *
   * @param params - Plan list parameters
   * @returns Plan list response
   */
  async list(params: PlanListParams): Promise<any> {
    debugLog(this.config, 'list', params);

    try {
      validateRequired(params, ['agentSlug', 'conversationId']);

      const authStore = useAuthStore();
      const userId = authStore.user?.id;
      if (!userId) {
        throw createServiceError('AUTH_ERROR', 'User not authenticated');
      }

      // Build request metadata
      const metadata = buildRequestMetadata(userId, params.conversationId);

      // Build plan list payload
      const payload = {
        action: 'list' as const,
        titleFilter: params.titleFilter,
        limit: params.limit,
        offset: params.offset,
      };

      const response = await tasksService.createAgentTask(
        'agent',
        params.agentSlug,
        {
          method: 'agent.plan',
          prompt: '', // No user message for list
          conversationId: params.conversationId,
          params: {
            mode: 'plan',
            action: 'list',
            payload,
          },
        },
        {
          namespace: params.namespace || 'demo',
        }
      );

      return await this.handleResponse(response, params.conversationId);
    } catch (error) {
      return this.handleError(error, params.conversationId);
    }
  }

  /**
   * Edits a plan
   */
  async edit(params: any): Promise<any> {
    debugLog(this.config, 'edit', params);
    // TODO: Implement edit action
    throw createServiceError('NOT_IMPLEMENTED', 'Edit action not yet implemented');
  }

  /**
   * Sets current plan version
   */
  async setCurrent(params: any): Promise<any> {
    debugLog(this.config, 'setCurrent', params);
    // TODO: Implement set-current action
    throw createServiceError('NOT_IMPLEMENTED', 'Set-current action not yet implemented');
  }

  /**
   * Deletes a plan version
   */
  async deleteVersion(params: any): Promise<any> {
    debugLog(this.config, 'deleteVersion', params);
    // TODO: Implement delete-version action
    throw createServiceError('NOT_IMPLEMENTED', 'Delete-version action not yet implemented');
  }

  /**
   * Merges plan versions
   */
  async mergeVersions(params: any): Promise<any> {
    debugLog(this.config, 'mergeVersions', params);
    // TODO: Implement merge-versions action
    throw createServiceError('NOT_IMPLEMENTED', 'Merge-versions action not yet implemented');
  }

  /**
   * Copies a plan version
   */
  async copyVersion(params: any): Promise<any> {
    debugLog(this.config, 'copyVersion', params);
    // TODO: Implement copy-version action
    throw createServiceError('NOT_IMPLEMENTED', 'Copy-version action not yet implemented');
  }

  /**
   * Deletes a plan
   */
  async delete(params: any): Promise<any> {
    debugLog(this.config, 'delete', params);
    // TODO: Implement delete action
    throw createServiceError('NOT_IMPLEMENTED', 'Delete action not yet implemented');
  }

  /**
   * Processes a plan response from the backend
   *
   * @param response - Raw backend response
   * @param conversationId - Conversation ID
   * @returns Processed plan response
   */
  async handleResponse(response: any, conversationId: string): Promise<any> {
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
   * Handles a successful plan response
   *
   * @param response - Successful plan response
   * @param conversationId - Conversation ID
   * @returns Processed response
   */
  private handleSuccess(response: any, conversationId: string): any {
    console.log('[planService.handleSuccess] Called with response:', JSON.stringify(response, null, 2));
    debugLog(this.config, 'handleSuccess', { response, conversationId });

    try {
      const chatStore = useAgentChatStore();
      const planStore = usePlanStore();

      // Extract plan data from response
      const plan = response.content?.plan || response.payload?.content?.plan;
      const version = response.content?.version || response.payload?.content?.version;
      const planId = plan?.id;

      console.log('[planService.handleSuccess] Extracted:', { plan: !!plan, version: !!version, planId });

      // Update both stores with plan data (Vue reactivity handles UI updates)
      if (planId && plan) {
        console.log('[planService.handleSuccess] Adding plan to planStore');
        // Add to plan store so AgentTaskItem can find it
        planStore.addPlan(plan, version);

        // Associate plan with conversation
        console.log('[planService.handleSuccess] Associating plan with conversation');
        planStore.associatePlanWithConversation(planId, conversationId);

        console.log('[planService.handleSuccess] Adding plan to chatStore');
        // Also update chat store for backward compatibility
        chatStore.setPlan(conversationId, plan);
      } else {
        console.warn('[planService.handleSuccess] No plan or planId found in response');
      }

      // Extract or create assistant message
      let message = response.content?.message || response.payload?.content?.message;
      console.log('[planService.handleSuccess] Message:', message ? message.substring(0, 100) : 'none');

      // If no message provided, create a synthetic message for the callout bubble
      if (!message && plan) {
        message = `Plan created: ${plan.title || 'Untitled Plan'}`;
        console.log('[planService.handleSuccess] Creating synthetic message:', message);
      }

      if (message) {
        console.log('[planService.handleSuccess] Adding message to chatStore');

        // Extract LLM metadata from response
        const llmMetadata = response.metadata || response.payload?.metadata;

        chatStore.addMessage(conversationId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          metadata: {
            planId,
            action: response.action,
            mode: 'plan', // Ensure mode is set for callout detection
            llmMetadata: llmMetadata ? {
              provider: llmMetadata.provider,
              model: llmMetadata.model,
              usage: llmMetadata.usage,
            } : undefined,
          },
        });
      }

      console.log('[planService.handleSuccess] Success handled, plan added to stores');
      debugLog(this.config, 'Success handled, plan added to stores');

      return response;
    } catch (error) {
      console.error('[planService.handleSuccess] Error:', error);
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
  private handleErrorResponse(response: any, conversationId: string): any {
    debugLog(this.config, 'handleErrorResponse', { response, conversationId });

    const errorCode = response.error?.code || response.payload?.error?.code || 'UNKNOWN_ERROR';
    const errorMessage = response.error?.message || response.payload?.error?.message || 'An error occurred';
    const errorDetails = response.error?.details || response.payload?.error?.details;

    // Log full error for debugging
    console.error('Plan service error response:', {
      errorCode,
      errorMessage,
      errorDetails,
      fullResponse: response
    });

    // Update store with error state (Vue reactivity handles UI updates)
    const chatStore = useAgentChatStore();
    chatStore.setError(conversationId, errorMessage);

    throw createServiceError(errorCode, errorMessage, errorDetails);
  }

  /**
   * Handles errors that occur during processing
   *
   * @param error - Error that occurred
   * @param conversationId - Conversation ID
   * @returns Error response
   */
  private handleError(error: any, conversationId: string): never {
    debugLog(this.config, 'handleError', { error, conversationId });

    const errorCode = extractErrorCode(error);
    const errorMessage = extractErrorMessage(error);

    // Log full error details for debugging
    console.error('Plan service error:', {
      errorCode,
      errorMessage,
      fullError: error,
      errorStack: error?.stack
    });

    // Update store with error state (Vue reactivity handles UI updates)
    const chatStore = useAgentChatStore();
    chatStore.setError(conversationId, errorMessage);

    // Re-throw for caller to handle
    throw createServiceError(errorCode, errorMessage, error);
  }
}

// Export singleton instance
export const planService = new PlanService();
