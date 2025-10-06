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
  CreatePlanRequest,
  EditPlanRequest,
  ReadPlanRequest,
} from '../types';
import { useAuthStore } from '@/stores/authStore';
import type {
  A2ATaskRequest,
  A2ATaskResponse,
  AgentTaskMode,
  isJsonRpcSuccessResponse,
  isJsonRpcErrorResponse,
  StrictA2ARequest,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
} from '@transport-types';
import {
  buildRequest,
  validateStrictRequest,
  StrictRequestValidationError,
} from '../utils/builders';
import {
  handleResponse,
  validateJsonRpcEnvelope,
  isStrictError,
  extractErrorDetails,
  StrictResponseValidationError,
} from '../utils/handlers';

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
   * Uses strict type builders to guarantee all required fields are set
   */
  plans = {
    create: async (conversationId: string, message: string) => {
      const strictRequest = buildRequest.plan.create(
        { conversationId, userMessage: message },
        { title: '', content: message }
      );
      return this.executeStrictRequest(strictRequest);
    },

    read: async (conversationId: string) => {
      const strictRequest = buildRequest.plan.read({ conversationId });
      return this.executeStrictRequest(strictRequest);
    },

    list: async (conversationId: string) => {
      const strictRequest = buildRequest.plan.list({ conversationId });
      return this.executeStrictRequest(strictRequest);
    },

    edit: async (conversationId: string, editedContent: string) => {
      const strictRequest = buildRequest.plan.edit(
        { conversationId, userMessage: 'Edit plan' },
        { content: editedContent }
      );
      return this.executeStrictRequest(strictRequest);
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
   * Uses strict type builders to guarantee all required fields are set
   */
  deliverables = {
    create: async (conversationId: string, message: string) => {
      const strictRequest = buildRequest.build.execute(
        { conversationId, userMessage: message },
        { message }
      );
      return this.executeStrictRequest(strictRequest);
    },

    read: async (conversationId: string) => {
      const strictRequest = buildRequest.build.read({ conversationId });
      return this.executeStrictRequest(strictRequest);
    },

    list: async (conversationId: string) => {
      const strictRequest = buildRequest.build.list({ conversationId });
      return this.executeStrictRequest(strictRequest);
    },

    edit: async (conversationId: string, editedContent: string) => {
      return this.executeDeliverableAction({
        mode: TaskMode.BUILD,
        action: 'edit',
        conversationId,
        params: { editedContent },
      } as unknown as DeliverableRequest);
    },

    rerun: async (conversationId: string, versionId: string, rerunConfig: object) => {
      const strictRequest = buildRequest.build.rerun(
        { conversationId, userMessage: 'Rerun build' },
        { versionId, config: rerunConfig }
      );
      return this.executeStrictRequest(strictRequest);
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
  // CORE EXECUTION METHODS
  // ============================================================================

  /**
   * Execute a strict A2A request with full validation
   * This is the preferred method that guarantees all required fields are set
   */
  private async executeStrictRequest<T = any>(
    request: StrictA2ARequest,
  ): Promise<T> {
    // Validate request before sending
    const validation = validateStrictRequest(request);
    if (!validation.valid) {
      throw new StrictRequestValidationError(
        'request',
        `Request validation failed: ${validation.errors.join(', ')}`
      );
    }

    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.agentSlug)}/tasks`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle JSON-RPC error response
        if (errorData.jsonrpc === '2.0' && errorData.error) {
          throw new Error(
            errorData.error.message || `API request failed: ${response.statusText}`,
          );
        }

        throw new Error(
          errorData.message || `API request failed: ${response.statusText}`,
        );
      }

      const data: StrictA2ASuccessResponse | StrictA2AErrorResponse = await response.json();

      // Validate JSON-RPC envelope
      const envelopeValidation = validateJsonRpcEnvelope(data);
      if (!envelopeValidation.valid) {
        throw new StrictResponseValidationError(
          `Invalid JSON-RPC envelope: ${envelopeValidation.errors.join(', ')}`,
          data,
        );
      }

      // Handle error response
      if (isStrictError(data)) {
        const errorDetails = extractErrorDetails(data);
        throw new Error(errorDetails.message);
      }

      // Handle success response with mode-specific handler
      const mode = request.method.split('.')[0]; // Extract mode from method (e.g., 'plan.create' -> 'plan')

      let content;
      if (mode === 'plan') {
        content = handleResponse.plan.handle(data);
      } else if (mode === 'build') {
        content = handleResponse.build.handle(data);
      } else if (mode === 'converse') {
        content = handleResponse.converse.handle(data);
      } else {
        // Fallback for other modes
        const taskResponse = data.result;
        content = taskResponse.payload?.content || taskResponse;
      }

      // Return in frontend format
      return {
        success: true,
        data: content,
      } as T;
    } catch (error) {
      console.error(`Agent2Agent strict request error (${request.method}):`, error);
      throw error;
    }
  }

  /**
   * Core method to execute any mode × action request (legacy)
   * @deprecated Use executeStrictRequest instead
   */
  private async executeAction<T = any>(
    mode: TaskMode,
    request: any,
  ): Promise<T> {
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.agentSlug)}/tasks`;

    try {
      // Extract message and other params
      const { message, userMessage, ...otherParams } = request.params || {};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: mode,
          params: {
            userMessage: userMessage || message,
            conversationId: request.conversationId,
            payload: {
              action: request.action,
              ...otherParams,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle JSON-RPC error response
        if (errorData.jsonrpc === '2.0' && errorData.error) {
          throw new Error(
            errorData.error.message || `API request failed: ${response.statusText}`,
          );
        }

        throw new Error(
          errorData.message || `API request failed: ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Handle JSON-RPC 2.0 response format
      // Backend returns: { jsonrpc: "2.0", id: "...", result: TaskResponseDto }
      let taskResponse;

      if (data.jsonrpc === '2.0') {
        // JSON-RPC success response
        if (data.result) {
          taskResponse = data.result;
        } else if (data.error) {
          // JSON-RPC error response (shouldn't reach here if !response.ok worked)
          throw new Error(data.error.message || 'JSON-RPC error');
        } else {
          throw new Error('Invalid JSON-RPC response');
        }
      } else {
        // Direct TaskResponseDto (legacy format)
        taskResponse = data;
      }

      // Transform TaskResponseDto to frontend format
      // TaskResponseDto: { success, mode, payload: { content: {...} } }
      // Frontend expects: { success, data: {...} }
      if (taskResponse.success && taskResponse.payload?.content) {
        return {
          success: true,
          data: taskResponse.payload.content,
        } as T;
      }

      return taskResponse as T;
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
