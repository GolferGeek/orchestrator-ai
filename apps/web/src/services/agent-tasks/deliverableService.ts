/**
 * Deliverable Service
 *
 * Handles Build mode operations for creating deliverables from plans.
 * This service manages all build-related business logic, keeping the store
 * as pure state. The frontend updates automatically via Vue reactivity.
 *
 * Key Responsibilities:
 * - Route build actions to appropriate handlers
 * - Send build requests to backend
 * - Process build responses
 * - Update store state via simple mutations
 * - Manage deliverable lifecycle (create, read, edit, versions, etc.)
 */

import type { DeliverableData } from '@orchestrator-ai/transport-types';
import type {
  AgentTaskMode,
  BuildAction,
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
import { useDeliverablesStore } from '@/stores/deliverablesStore';

/**
 * Base parameters for deliverable operations
 */
interface BaseDeliverableParams {
  agentSlug: string;
  namespace?: string;
  conversationId: string;
}

/**
 * Parameters for creating a deliverable
 */
export interface DeliverableCreateParams extends BaseDeliverableParams {
  userMessage: string;
  llmSelection: LLMSelection;
  planId?: string;
  title?: string;
  description?: string;
}

/**
 * Parameters for reading a deliverable
 */
export interface DeliverableReadParams extends BaseDeliverableParams {
  deliverableId: string;
  version?: number;
}

/**
 * Parameters for listing deliverables
 */
export interface DeliverableListParams extends BaseDeliverableParams {
  titleFilter?: string;
  limit?: number;
  offset?: number;
}

/**
 * Deliverable Service
 */
export class DeliverableService {
  private config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Routes a build action to the appropriate handler
   *
   * @param action - Build action to perform
   * @param params - Action-specific parameters
   * @returns Action response
   */
  async handleAction(action: BuildAction, params: any): Promise<any> {
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
      case 'rerun':
        return this.rerun(params);
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
          `Unknown build action: ${action}`,
          { action }
        );
    }
  }

  /**
   * Creates a new deliverable
   *
   * @param params - Deliverable creation parameters
   * @returns Deliverable creation response
   */
  async create(params: DeliverableCreateParams): Promise<any> {
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

      // Build deliverable create payload
      const payload = {
        action: 'create' as const,
        planId: params.planId,
        title: params.title,
        description: params.description,
      };

      debugLog(this.config, 'Sending deliverable create request:', { payload, params });

      // Send request to backend via tasksService
      const response = await tasksService.createAgentTask(
        'agent',
        params.agentSlug,
        {
          method: 'agent.build',
          prompt: params.userMessage,
          conversationId: params.conversationId,
          llmSelection: params.llmSelection,
          params: {
            mode: 'build',
            action: 'create',
            payload,
          },
        },
        {
          namespace: params.namespace || 'demo',
        }
      );

      debugLog(this.config, 'Received deliverable create response:', response);

      // Handle the response
      return await this.handleResponse(response, params.conversationId);
    } catch (error) {
      debugLog(this.config, 'Error in create:', error);
      return this.handleError(error, params.conversationId);
    }
  }

  /**
   * Reads a deliverable
   *
   * @param params - Deliverable read parameters
   * @returns Deliverable read response
   */
  async read(params: DeliverableReadParams): Promise<any> {
    debugLog(this.config, 'read', params);

    try {
      validateRequired(params, ['agentSlug', 'deliverableId', 'conversationId']);

      const authStore = useAuthStore();
      const userId = authStore.user?.id;
      if (!userId) {
        throw createServiceError('AUTH_ERROR', 'User not authenticated');
      }

      // Build request metadata
      const metadata = buildRequestMetadata(userId, params.conversationId);

      // Build deliverable read payload
      const payload = {
        action: 'read' as const,
        deliverableId: params.deliverableId,
        version: params.version,
      };

      const response = await tasksService.createAgentTask(
        'agent',
        params.agentSlug,
        {
          method: 'agent.build',
          prompt: '', // No user message for read
          conversationId: params.conversationId,
          params: {
            mode: 'build',
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
   * Lists deliverables
   *
   * @param params - Deliverable list parameters
   * @returns Deliverable list response
   */
  async list(params: DeliverableListParams): Promise<any> {
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

      // Build deliverable list payload
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
          method: 'agent.build',
          prompt: '', // No user message for list
          conversationId: params.conversationId,
          params: {
            mode: 'build',
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
   * Edits a deliverable
   */
  async edit(params: any): Promise<any> {
    debugLog(this.config, 'edit', params);
    // TODO: Implement edit action
    throw createServiceError('NOT_IMPLEMENTED', 'Edit action not yet implemented');
  }

  /**
   * Reruns a deliverable build
   */
  async rerun(params: any): Promise<any> {
    debugLog(this.config, 'rerun', params);
    // TODO: Implement rerun action
    throw createServiceError('NOT_IMPLEMENTED', 'Rerun action not yet implemented');
  }

  /**
   * Sets current deliverable version
   */
  async setCurrent(params: any): Promise<any> {
    debugLog(this.config, 'setCurrent', params);
    // TODO: Implement set-current action
    throw createServiceError('NOT_IMPLEMENTED', 'Set-current action not yet implemented');
  }

  /**
   * Deletes a deliverable version
   */
  async deleteVersion(params: any): Promise<any> {
    debugLog(this.config, 'deleteVersion', params);
    // TODO: Implement delete-version action
    throw createServiceError('NOT_IMPLEMENTED', 'Delete-version action not yet implemented');
  }

  /**
   * Merges deliverable versions
   */
  async mergeVersions(params: any): Promise<any> {
    debugLog(this.config, 'mergeVersions', params);
    // TODO: Implement merge-versions action
    throw createServiceError('NOT_IMPLEMENTED', 'Merge-versions action not yet implemented');
  }

  /**
   * Copies a deliverable version
   */
  async copyVersion(params: any): Promise<any> {
    debugLog(this.config, 'copyVersion', params);
    // TODO: Implement copy-version action
    throw createServiceError('NOT_IMPLEMENTED', 'Copy-version action not yet implemented');
  }

  /**
   * Deletes a deliverable
   */
  async delete(params: any): Promise<any> {
    debugLog(this.config, 'delete', params);
    // TODO: Implement delete action
    throw createServiceError('NOT_IMPLEMENTED', 'Delete action not yet implemented');
  }

  /**
   * Processes a deliverable response from the backend
   *
   * @param response - Raw backend response
   * @param conversationId - Conversation ID
   * @returns Processed deliverable response
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
   * Handles a successful deliverable response
   *
   * @param response - Successful deliverable response
   * @param conversationId - Conversation ID
   * @returns Processed response
   */
  private handleSuccess(response: any, conversationId: string): any {
    console.log('[deliverableService.handleSuccess] Called with response:', JSON.stringify(response, null, 2));
    debugLog(this.config, 'handleSuccess', { response, conversationId });

    try {
      const chatStore = useAgentChatStore();
      const deliverableStore = useDeliverablesStore();

      // Extract deliverable data from response
      const deliverable = response.content?.deliverable || response.payload?.content?.deliverable;
      // Version can be separate or nested in deliverable.currentVersion
      let version = response.content?.version || response.payload?.content?.version;
      if (!version && deliverable?.currentVersion) {
        version = deliverable.currentVersion;
      }
      const deliverableId = deliverable?.id;

      console.log('[deliverableService.handleSuccess] Extracted:', {
        deliverable: !!deliverable,
        version: !!version,
        deliverableId,
        versionSource: version ? (deliverable?.currentVersion ? 'currentVersion' : 'separate') : 'none'
      });

      // IMPORTANT: Add deliverable to store FIRST, before adding message
      // This ensures Vue reactivity works correctly - the deliverable must exist
      // in the store before the message watcher tries to access it
      if (deliverableId && deliverable) {
        console.log('[deliverableService.handleSuccess] Adding deliverable to store');
        // Add deliverable to the store
        deliverableStore.addDeliverable(deliverable);

        // Add version if present
        if (version) {
          console.log('[deliverableService.handleSuccess] Adding version to store');
          deliverableStore.addVersion(deliverableId, version);
        }

        // Also update chat store for backward compatibility
        chatStore.setDeliverable(conversationId, deliverable);

        console.log('[deliverableService.handleSuccess] Deliverable added to stores, ID:', deliverableId);
      } else {
        console.warn('[deliverableService.handleSuccess] No deliverable or deliverableId found in response');
      }

      // Extract or create assistant message
      let message = response.content?.message || response.payload?.content?.message;
      console.log('[deliverableService.handleSuccess] Message:', message ? message.substring(0, 100) : 'none');

      // If no message provided, create a synthetic message for the callout bubble
      if (!message && deliverable) {
        message = `Deliverable created: ${deliverable.title || 'Untitled Deliverable'}`;
        console.log('[deliverableService.handleSuccess] Creating synthetic message:', message);
      }

      // NOW add the message AFTER the deliverable is in the store
      // This ensures the AgentTaskItem watcher can immediately find the deliverable
      if (message && deliverableId) {
        console.log('[deliverableService.handleSuccess] Adding message to chatStore with deliverableId:', deliverableId);
        chatStore.addMessage(conversationId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          deliverableId, // Set deliverableId on message directly
          metadata: {
            deliverableId, // Also in metadata for backward compatibility
            action: response.action,
            mode: 'build', // Ensure mode is set for callout detection
          },
        });
        console.log('[deliverableService.handleSuccess] Message added to chatStore');
      } else if (message) {
        // Message without deliverable (shouldn't happen for build.create, but handle it)
        console.log('[deliverableService.handleSuccess] Adding message without deliverable');
        chatStore.addMessage(conversationId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          metadata: {
            action: response.action,
            mode: 'build',
          },
        });
      }

      console.log('[deliverableService.handleSuccess] Success handled, deliverable added to stores');
      debugLog(this.config, 'Success handled, deliverable added to stores');

      return response;
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
  private handleErrorResponse(response: any, conversationId: string): any {
    debugLog(this.config, 'handleErrorResponse', { response, conversationId });

    const errorCode = response.error?.code || 'UNKNOWN_ERROR';
    const errorMessage = response.error?.message || 'An error occurred';
    const errorDetails = response.error?.details;

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

    // Update store with error state (Vue reactivity handles UI updates)
    const chatStore = useAgentChatStore();
    chatStore.setError(conversationId, errorMessage);

    // Re-throw for caller to handle
    throw createServiceError(errorCode, errorMessage, error);
  }
}

// Export singleton instance
export const deliverableService = new DeliverableService();
