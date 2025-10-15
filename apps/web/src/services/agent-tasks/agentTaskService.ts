/**
 * Agent Task Service (Facade)
 *
 * Main entry point for all agent task operations.
 * Provides a unified interface for components to interact with agent services.
 *
 * This facade:
 * - Routes tasks to appropriate mode services
 * - Extracts LLM configuration from store
 * - Builds proper request payloads
 * - Handles responses via responseHandler
 * - Provides simple API for components
 *
 * Components should ONLY use this service, not individual mode services directly.
 */

import type {
  AgentTaskMode,
  LLMSelection,
  PlanAction,
  BuildAction,
} from '@/types/orchestrate.types';
import type { ServiceConfig } from './types';
import { createServiceError, validateRequired, debugLog } from './types';
import { conversationService } from './conversationService';
import { planService } from './planService';
import { deliverableService } from './deliverableService';
import { responseHandler } from './responseHandler';
import { useLLMStore } from '@/stores/llmStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Parameters for sending a task
 */
export interface SendTaskParams {
  /** Agent slug/identifier */
  agentSlug: string;
  /** Organization/namespace (optional, defaults to 'demo') */
  namespace?: string;
  /** Task mode (converse, plan, build) */
  mode: AgentTaskMode;
  /** Action for modes that use actions (plan, build) */
  action?: string;
  /** User's message/prompt */
  userMessage: string;
  /** Conversation ID for context */
  conversationId: string;
  /** LLM selection (optional, will use store if not provided) */
  llmSelection?: LLMSelection;
  /** Additional parameters specific to mode/action */
  additionalParams?: Record<string, any>;
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Agent Task Service
 */
export class AgentTaskService {
  private config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Sends a task to an agent (main entry point)
   *
   * This method:
   * 1. Validates parameters
   * 2. Extracts LLM configuration from store if not provided
   * 3. Routes to appropriate service based on mode
   * 4. Returns processed response
   *
   * @param params - Task parameters
   * @returns Task response
   */
  async sendTask(params: SendTaskParams): Promise<any> {
    debugLog(this.config, 'sendTask', params);

    try {
      // Validate required parameters
      validateRequired(params, ['agentSlug', 'mode', 'conversationId']);

      // Get LLM selection (from params or store)
      const llmSelection = params.llmSelection || this.getLLMSelection();
      if (!llmSelection.providerName || !llmSelection.modelName) {
        throw createServiceError(
          'LLM_NOT_CONFIGURED',
          'LLM provider and model must be selected before sending a task'
        );
      }

      // Route based on mode
      switch (params.mode) {
        case 'converse':
          return await this.sendConverse(params, llmSelection);

        case 'plan':
          return await this.sendPlan(params, llmSelection);

        case 'build':
          return await this.sendBuild(params, llmSelection);

        default:
          throw createServiceError(
            'UNKNOWN_MODE',
            `Unknown task mode: ${params.mode}`,
            { mode: params.mode }
          );
      }
    } catch (error) {
      debugLog(this.config, 'Error in sendTask:', error);
      throw error;
    }
  }

  /**
   * Sends a converse task
   */
  private async sendConverse(
    params: SendTaskParams,
    llmSelection: LLMSelection
  ): Promise<any> {
    debugLog(this.config, 'sendConverse', params);

    return await conversationService.sendConverse({
      agentSlug: params.agentSlug,
      namespace: params.namespace,
      userMessage: params.userMessage,
      conversationId: params.conversationId,
      llmSelection,
      stream: params.stream,
    });
  }

  /**
   * Sends a plan task
   */
  private async sendPlan(
    params: SendTaskParams,
    llmSelection: LLMSelection
  ): Promise<any> {
    debugLog(this.config, 'sendPlan', params);

    // Validate action for plan mode
    if (!params.action) {
      throw createServiceError(
        'MISSING_ACTION',
        'Plan mode requires an action parameter'
      );
    }

    const action = params.action as PlanAction;

    // Build action-specific parameters
    const actionParams = {
      agentSlug: params.agentSlug,
      namespace: params.namespace,
      conversationId: params.conversationId,
      userMessage: params.userMessage,
      llmSelection,
      ...params.additionalParams,
    };

    // Route to plan service
    return await planService.handleAction(action, actionParams);
  }

  /**
   * Sends a build task
   */
  private async sendBuild(
    params: SendTaskParams,
    llmSelection: LLMSelection
  ): Promise<any> {
    debugLog(this.config, 'sendBuild', params);

    // Validate action for build mode
    if (!params.action) {
      throw createServiceError(
        'MISSING_ACTION',
        'Build mode requires an action parameter'
      );
    }

    const action = params.action as BuildAction;

    // Build action-specific parameters
    const actionParams = {
      agentSlug: params.agentSlug,
      namespace: params.namespace,
      conversationId: params.conversationId,
      userMessage: params.userMessage,
      llmSelection,
      ...params.additionalParams,
    };

    // Route to deliverable service
    return await deliverableService.handleAction(action, actionParams);
  }

  /**
   * Gets LLM selection from store
   *
   * @returns Current LLM selection
   */
  private getLLMSelection(): LLMSelection {
    const llmStore = useLLMStore();

    return {
      providerName: llmStore.selectedProvider?.name || '',
      modelName: llmStore.selectedModel?.name || '',
      temperature: llmStore.temperature,
      maxTokens: llmStore.maxTokens,
    };
  }

  /**
   * Creates a new conversation
   *
   * @param agent - Agent configuration
   * @returns Conversation ID
   */
  async createConversation(agent: any): Promise<string> {
    return await conversationService.createConversation(agent);
  }

  /**
   * Loads an existing conversation
   *
   * @param conversationId - Conversation ID to load
   */
  async loadConversation(conversationId: string): Promise<void> {
    return await conversationService.loadConversation(conversationId);
  }

  /**
   * Deletes a conversation
   *
   * @param conversationId - Conversation ID to delete
   */
  async deleteConversation(conversationId: string): Promise<void> {
    return await conversationService.deleteConversation(conversationId);
  }
}

// Export singleton instance
export const agentTaskService = new AgentTaskService();
