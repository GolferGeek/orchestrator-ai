/**
 * Agent2Agent API Client
 * Unified client for all mode × action operations
 */

import {
  PlanRequest,
  PlanResponse,
  DeliverableRequest,
  DeliverableResponse,
  TaskMode,
} from '../types';

/**
 * Base API client configuration
 */
interface ApiConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * Agent2Agent API Client
 * Handles all plan and deliverable operations through mode × action architecture
 */
export class Agent2AgentApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/agent2agent';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  // ============================================================================
  // PLAN OPERATIONS
  // ============================================================================

  /**
   * Execute a plan operation
   */
  async executePlanAction(request: PlanRequest): Promise<PlanResponse> {
    return this.executeAction(request.mode, request);
  }

  /**
   * Convenience methods for plan operations
   */
  plans = {
    create: async (conversationId: string, title: string, content: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'create',
        conversationId,
        params: { title, content },
      });
    },

    read: async (conversationId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'read',
        conversationId,
      });
    },

    list: async (conversationId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'list',
        conversationId,
      });
    },

    edit: async (conversationId: string, content: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'edit',
        conversationId,
        params: { content },
      });
    },

    setCurrent: async (conversationId: string, versionId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'set_current',
        conversationId,
        params: { versionId },
      });
    },

    deleteVersion: async (conversationId: string, versionId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'delete_version',
        conversationId,
        params: { versionId },
      });
    },

    mergeVersions: async (
      conversationId: string,
      versionIds: string[],
      mergePrompt: string,
    ) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'merge_versions',
        conversationId,
        params: { versionIds, mergePrompt },
      });
    },

    copyVersion: async (conversationId: string, versionId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'copy_version',
        conversationId,
        params: { versionId },
      });
    },

    delete: async (conversationId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'delete',
        conversationId,
      });
    },
  };

  // ============================================================================
  // DELIVERABLE OPERATIONS
  // ============================================================================

  /**
   * Execute a deliverable operation
   */
  async executeDeliverableAction(
    request: DeliverableRequest,
  ): Promise<DeliverableResponse> {
    return this.executeAction(request.mode, request);
  }

  /**
   * Convenience methods for deliverable operations
   */
  deliverables = {
    create: async (
      conversationId: string,
      title: string,
      content: string,
    ) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'create',
        conversationId,
        params: { title, content },
      });
    },

    read: async (conversationId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'read',
        conversationId,
      });
    },

    list: async (conversationId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'list',
        conversationId,
      });
    },

    edit: async (conversationId: string, content: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'edit',
        conversationId,
        params: { content },
      });
    },

    rerun: async (
      conversationId: string,
      versionId: string,
      provider: string,
      model: string,
    ) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'rerun',
        conversationId,
        params: { versionId, provider, model },
      });
    },

    setCurrent: async (conversationId: string, versionId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'set_current',
        conversationId,
        params: { versionId },
      });
    },

    deleteVersion: async (conversationId: string, versionId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'delete_version',
        conversationId,
        params: { versionId },
      });
    },

    mergeVersions: async (
      conversationId: string,
      versionIds: string[],
      mergePrompt: string,
    ) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'merge_versions',
        conversationId,
        params: { versionIds, mergePrompt },
      });
    },

    copyVersion: async (conversationId: string, versionId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'copy_version',
        conversationId,
        params: { versionId },
      });
    },

    delete: async (conversationId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'delete',
        conversationId,
      });
    },
  };

  // ============================================================================
  // CORE EXECUTION METHOD
  // ============================================================================

  /**
   * Core method to execute any mode × action request
   */
  private async executeAction<T = any>(
    mode: TaskMode,
    request: any,
  ): Promise<T> {
    const endpoint = `${this.baseUrl}/execute`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          mode,
          action: request.action,
          conversationId: request.conversationId,
          params: request.params || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `API request failed: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Agent2Agent API error (${mode}/${request.action}):`, error);
      throw error;
    }
  }

  /**
   * Set custom headers (e.g., auth token)
   */
  setHeaders(headers: Record<string, string>) {
    this.headers = {
      ...this.headers,
      ...headers,
    };
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }
}

/**
 * Default export - singleton instance
 */
export const agent2agentApi = new Agent2AgentApi();

/**
 * Named exports for convenience
 */
export const planApi = agent2agentApi.plans;
export const deliverableApi = agent2agentApi.deliverables;
