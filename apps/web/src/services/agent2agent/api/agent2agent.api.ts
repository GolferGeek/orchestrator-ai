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
import { useAuthStore } from '@/stores/authStore';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:7100';

/**
 * Base API client configuration
 */
interface ApiConfig {
  agentSlug: string;
  headers?: Record<string, string>;
}

/**
 * Agent2Agent API Client
 * Handles all plan and deliverable operations through mode × action architecture
 */
export class Agent2AgentApi {
  private agentSlug: string;
  private headers: Record<string, string>;
  private authStore: ReturnType<typeof useAuthStore>;

  constructor(config: ApiConfig) {
    this.agentSlug = config.agentSlug;
    this.authStore = useAuthStore();
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Get current organization slug from authStore
   */
  private getOrgSlug(): string {
    const org = this.authStore.currentNamespace;
    if (!org) {
      throw new Error('No organization context available');
    }
    return org;
  }

  /**
   * Get auth headers with current access token
   */
  private getAuthHeaders(): Record<string, string> {
    const token = this.authStore.token;
    return {
      ...this.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
   * Match backend contract exactly: {mode, action, conversationId, ...actionParams}
   */
  plans = {
    create: async (conversationId: string, message: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'create',
        conversationId,
        params: { message },
      });
    },

    read: async (conversationId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'read',
        conversationId,
        params: {},
      });
    },

    list: async (conversationId: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'list',
        conversationId,
        params: {},
      });
    },

    edit: async (conversationId: string, editedContent: string) => {
      return this.executePlanAction({
        mode: TaskMode.PLAN,
        action: 'edit',
        conversationId,
        params: { editedContent },
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
        params: {},
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
   * Match backend contract exactly: {mode, action, conversationId, ...actionParams}
   */
  deliverables = {
    create: async (conversationId: string, message: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'create',
        conversationId,
        params: { message },
      });
    },

    read: async (conversationId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'read',
        conversationId,
        params: {},
      });
    },

    list: async (conversationId: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'list',
        conversationId,
        params: {},
      });
    },

    edit: async (conversationId: string, editedContent: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'edit',
        conversationId,
        params: { editedContent },
      });
    },

    rerun: async (conversationId: string, versionId: string, rerunConfig: object) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'rerun',
        conversationId,
        params: { versionId, rerunConfig },
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
        params: {},
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
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.agentSlug)}/tasks`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mode,
          action: request.action,
          conversationId: request.conversationId,
          ...request.params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `API request failed: ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Transform API response to match expected format
      // API returns: { success, mode, payload: { content: {...} } }
      // Frontend expects: { success, data: {...} }
      if (data.success && data.payload?.content) {
        return {
          success: true,
          data: data.payload.content,
        };
      }

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
 * Factory function to create an Agent2AgentApi instance for a specific agent
 */
export function createAgent2AgentApi(agentSlug: string): Agent2AgentApi {
  return new Agent2AgentApi({ agentSlug });
}
