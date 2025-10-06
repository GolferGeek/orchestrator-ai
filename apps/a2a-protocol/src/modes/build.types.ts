/**
 * Build Mode Types
 * Defines mode-specific payloads and metadata for build operations
 */

/**
 * Build Actions
 */
export type BuildAction =
  | 'create'
  | 'read'
  | 'list'
  | 'edit'
  | 'rerun'
  | 'set_current'
  | 'delete_version'
  | 'merge_versions'
  | 'copy_version'
  | 'delete';

/**
 * Build Create Action Payload
 */
export interface BuildCreatePayload {
  action: 'create';
  /** Title for the deliverable (optional - can be inferred) */
  title?: string;
  /** Type of deliverable */
  type?: string;
  /** Initial deliverable content (optional - will be generated if not provided) */
  content?: string;
  /** Plan version ID to build from */
  planVersionId?: string;
}

/**
 * Build Read Action Payload
 */
export interface BuildReadPayload {
  action: 'read';
  /** Optional version ID to read specific version */
  versionId?: string;
}

/**
 * Build List Action Payload
 */
export interface BuildListPayload {
  action: 'list';
  /** Include archived versions */
  includeArchived?: boolean;
}

/**
 * Build Edit Action Payload
 */
export interface BuildEditPayload {
  action: 'edit';
  /** New content for the deliverable */
  editedContent: string;
  /** Optional comment about the edit */
  comment?: string;
}

/**
 * Build Rerun Action Payload
 */
export interface BuildRerunPayload {
  action: 'rerun';
  /** Version ID to rerun */
  versionId: string;
  /** LLM configuration for rerun */
  rerunConfig: {
    provider?: string;
    model?: string;
    temperature?: number;
    [key: string]: any;
  };
}

/**
 * Build Set Current Action Payload
 */
export interface BuildSetCurrentPayload {
  action: 'set_current';
  /** Version ID to set as current */
  versionId: string;
}

/**
 * Build Delete Version Action Payload
 */
export interface BuildDeleteVersionPayload {
  action: 'delete_version';
  /** Version ID to delete */
  versionId: string;
}

/**
 * Build Merge Versions Action Payload
 */
export interface BuildMergeVersionsPayload {
  action: 'merge_versions';
  /** Array of version IDs to merge */
  versionIds: string[];
  /** Instructions for how to merge */
  mergePrompt: string;
}

/**
 * Build Copy Version Action Payload
 */
export interface BuildCopyVersionPayload {
  action: 'copy_version';
  /** Version ID to copy */
  versionId: string;
}

/**
 * Build Delete Action Payload
 */
export interface BuildDeletePayload {
  action: 'delete';
}

/**
 * Build Mode Payload (union of all build actions)
 */
export type BuildModePayload =
  | BuildCreatePayload
  | BuildReadPayload
  | BuildListPayload
  | BuildEditPayload
  | BuildRerunPayload
  | BuildSetCurrentPayload
  | BuildDeleteVersionPayload
  | BuildMergeVersionsPayload
  | BuildCopyVersionPayload
  | BuildDeletePayload;

/**
 * Build Request Metadata
 */
export interface BuildRequestMetadata {
  /** Source of the request (e.g., 'web-ui', 'api', 'cli') */
  source?: string;
  /** User ID making the request */
  userId?: string;
  /** Deliverable type context */
  deliverableType?: string;
  /** Output format preference */
  format?: string;
  /** Custom application data */
  [key: string]: any;
}

/**
 * Build Response Metadata
 */
export interface BuildResponseMetadata {
  /** LLM provider used (for create/rerun actions) */
  provider?: string;
  /** LLM model used (for create/rerun actions) */
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
  /** Whether plan context was used */
  usedPlanContext?: boolean;
}

/**
 * Build Create Response Content
 */
export interface BuildCreateResponseContent {
  deliverable: {
    id: string;
    conversationId: string;
    userId: string;
    agentName: string;
    namespace: string;
    title: string;
    type: string;
    currentVersionId: string;
    createdAt: string;
    updatedAt: string;
  };
  version: {
    id: string;
    deliverableId: string;
    versionNumber: number;
    content: string;
    format: 'markdown' | 'json' | 'html';
    createdByType: 'agent' | 'user';
    createdById: string | null;
    metadata?: Record<string, any>;
    isCurrentVersion: boolean;
    createdAt: string;
  };
  isNew: boolean;
}
