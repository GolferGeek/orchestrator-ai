/**
 * Strict A2A Protocol - Plan Mode
 * Complete request and response types for all plan mode actions
 */

import { AgentTaskMode } from '../shared/enums';
import { StrictRequestMetadata, StrictResponseMetadata } from './base.types';

// ============================================================================
// PLAN MODE - REQUEST TYPES (9 actions)
// ============================================================================

/**
 * Plan Mode: CREATE action
 */
export interface PlanCreateRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    userMessage: string;
    payload: {
      action: 'create';
      title?: string;
      content?: string;
      forceNew?: boolean;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: READ action
 */
export interface PlanReadRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'read';
      planId?: string;
      versionId?: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: LIST action
 */
export interface PlanListRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'list';
      planId?: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: EDIT action
 */
export interface PlanEditRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    userMessage: string;
    payload: {
      action: 'edit';
      content: string;
      versionId?: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: SET_CURRENT action
 */
export interface PlanSetCurrentRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'set_current';
      versionId: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: DELETE_VERSION action
 */
export interface PlanDeleteVersionRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'delete_version';
      versionId: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: MERGE_VERSIONS action
 */
export interface PlanMergeVersionsRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    userMessage: string;
    payload: {
      action: 'merge_versions';
      sourceVersionIds: string[];
      mergeStrategy?: 'sequential' | 'prioritized' | 'ai_guided';
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: COPY_VERSION action
 */
export interface PlanCopyVersionRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'copy_version';
      versionId: string;
      targetConversationId?: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Plan Mode: DELETE action
 */
export interface PlanDeleteRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'plan';
  params: {
    mode: AgentTaskMode.PLAN;
    conversationId: string;
    payload: {
      action: 'delete';
      planId?: string;
    };
    metadata?: StrictRequestMetadata;
  };
}

/**
 * Union of all Plan mode requests
 */
export type StrictPlanRequest =
  | PlanCreateRequest
  | PlanReadRequest
  | PlanListRequest
  | PlanEditRequest
  | PlanSetCurrentRequest
  | PlanDeleteVersionRequest
  | PlanMergeVersionsRequest
  | PlanCopyVersionRequest
  | PlanDeleteRequest;

// ============================================================================
// PLAN MODE - DATA STRUCTURES
// ============================================================================

/**
 * Base plan data structure
 */
export interface PlanData {
  id: string;
  conversationId: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Plan version data structure
 */
export interface PlanVersionData {
  id: string;
  planId: string;
  versionNumber: number;
  content: string;
  format: 'text' | 'markdown' | 'json';
  createdByType: 'user' | 'agent';
  createdById?: string;
  taskId?: string;
  isCurrentVersion: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// PLAN MODE - RESPONSE TYPES (9 actions)
// ============================================================================

/**
 * Plan Mode: CREATE response
 */
export interface PlanCreateResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        version: PlanVersionData;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: READ response
 */
export interface PlanReadResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        version: PlanVersionData;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: LIST response
 */
export interface PlanListResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        versions: PlanVersionData[];
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: EDIT response
 */
export interface PlanEditResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        version: PlanVersionData;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: SET_CURRENT response
 */
export interface PlanSetCurrentResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        version: PlanVersionData;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: DELETE_VERSION response
 */
export interface PlanDeleteVersionResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        deletedVersionId: string;
        plan: PlanData;
        remainingVersions: PlanVersionData[];
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: MERGE_VERSIONS response
 */
export interface PlanMergeVersionsResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        plan: PlanData;
        mergedVersion: PlanVersionData;
        sourceVersions: PlanVersionData[];
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: COPY_VERSION response
 */
export interface PlanCopyVersionResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        sourcePlan: PlanData;
        sourceVersion: PlanVersionData;
        targetPlan: PlanData;
        copiedVersion: PlanVersionData;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Plan Mode: DELETE response
 */
export interface PlanDeleteResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    success: true;
    mode: 'plan';
    payload: {
      content: {
        deletedPlanId: string;
        deletedVersionCount: number;
      };
      metadata: StrictResponseMetadata;
    };
  };
}

/**
 * Union of all Plan mode responses
 */
export type StrictPlanResponse =
  | PlanCreateResponse
  | PlanReadResponse
  | PlanListResponse
  | PlanEditResponse
  | PlanSetCurrentResponse
  | PlanDeleteVersionResponse
  | PlanMergeVersionsResponse
  | PlanCopyVersionResponse
  | PlanDeleteResponse;
