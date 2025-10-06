/**
 * Plan Mode Types
 * Defines mode-specific payloads and metadata for plan operations
 */

/**
 * Plan Actions
 */
export type PlanAction =
  | 'create'
  | 'read'
  | 'list'
  | 'edit'
  | 'set_current'
  | 'delete_version'
  | 'merge_versions'
  | 'copy_version'
  | 'delete';

/**
 * Plan Create Action Payload
 */
export interface PlanCreatePayload {
  action: 'create';
  /** Title for the plan (optional - can be inferred) */
  title?: string;
  /** Initial plan content (optional - will be generated if not provided) */
  content?: string;
  /** Force creation of new plan even if one exists */
  forceNew?: boolean;
}

/**
 * Plan Read Action Payload
 */
export interface PlanReadPayload {
  action: 'read';
  /** Optional version ID to read specific version */
  versionId?: string;
}

/**
 * Plan List Action Payload
 */
export interface PlanListPayload {
  action: 'list';
  /** Include archived versions */
  includeArchived?: boolean;
}

/**
 * Plan Edit Action Payload
 */
export interface PlanEditPayload {
  action: 'edit';
  /** New content for the plan */
  editedContent: string;
  /** Optional comment about the edit */
  comment?: string;
}

/**
 * Plan Set Current Action Payload
 */
export interface PlanSetCurrentPayload {
  action: 'set_current';
  /** Version ID to set as current */
  versionId: string;
}

/**
 * Plan Delete Version Action Payload
 */
export interface PlanDeleteVersionPayload {
  action: 'delete_version';
  /** Version ID to delete */
  versionId: string;
}

/**
 * Plan Merge Versions Action Payload
 */
export interface PlanMergeVersionsPayload {
  action: 'merge_versions';
  /** Array of version IDs to merge */
  versionIds: string[];
  /** Instructions for how to merge */
  mergePrompt: string;
}

/**
 * Plan Copy Version Action Payload
 */
export interface PlanCopyVersionPayload {
  action: 'copy_version';
  /** Version ID to copy */
  versionId: string;
}

/**
 * Plan Delete Action Payload
 */
export interface PlanDeletePayload {
  action: 'delete';
}

/**
 * Plan Mode Payload (union of all plan actions)
 */
export type PlanModePayload =
  | PlanCreatePayload
  | PlanReadPayload
  | PlanListPayload
  | PlanEditPayload
  | PlanSetCurrentPayload
  | PlanDeleteVersionPayload
  | PlanMergeVersionsPayload
  | PlanCopyVersionPayload
  | PlanDeletePayload;

/**
 * Plan Request Metadata
 */
export interface PlanRequestMetadata {
  /** Source of the request (e.g., 'web-ui', 'api', 'cli') */
  source?: string;
  /** User ID making the request */
  userId?: string;
  /** Custom application data */
  [key: string]: any;
}

/**
 * Plan Response Metadata
 */
export interface PlanResponseMetadata {
  /** LLM provider used (for create action) */
  provider?: string;
  /** LLM model used (for create action) */
  model?: string;
  /** Token usage statistics */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  /** Routing decision information */
  routingDecision?: Record<string, any>;
}

/**
 * Plan Create Response Content
 */
export interface PlanCreateResponseContent {
  plan: {
    id: string;
    conversationId: string;
    userId: string;
    agentName: string;
    namespace: string;
    title: string;
    currentVersionId: string;
    createdAt: string;
    updatedAt: string;
  };
  version: {
    id: string;
    planId: string;
    versionNumber: number;
    content: string;
    format: 'markdown' | 'json';
    createdByType: 'agent' | 'user';
    createdById: string | null;
    metadata?: Record<string, any>;
    isCurrentVersion: boolean;
    createdAt: string;
  };
  isNew: boolean;
}

/**
 * Plan Read Response Content
 */
export interface PlanReadResponseContent {
  plan: {
    id: string;
    conversationId: string;
    userId: string;
    agentName: string;
    namespace: string;
    title: string;
    currentVersionId: string;
    createdAt: string;
    updatedAt: string;
    currentVersion?: {
      id: string;
      planId: string;
      versionNumber: number;
      content: string;
      format: 'markdown' | 'json';
      createdByType: 'agent' | 'user';
      createdById: string | null;
      metadata?: Record<string, any>;
      isCurrentVersion: boolean;
      createdAt: string;
    };
  };
}

/**
 * Plan List Response Content
 */
export interface PlanListResponseContent {
  plan: {
    id: string;
    conversationId: string;
    userId: string;
    agentName: string;
    namespace: string;
    title: string;
    currentVersionId: string;
    createdAt: string;
    updatedAt: string;
  };
  versions: Array<{
    id: string;
    planId: string;
    versionNumber: number;
    content: string;
    format: 'markdown' | 'json';
    createdByType: 'agent' | 'user';
    createdById: string | null;
    metadata?: Record<string, any>;
    isCurrentVersion: boolean;
    createdAt: string;
  }>;
}
