/**
 * Strict A2A Protocol - Build Mode
 * Complete request and response types for all build mode actions
 */
import { AgentTaskMode } from '../shared/enums';
import { StrictRequestMetadata, StrictResponseMetadata } from './base.types';
/**
 * Build Mode: CREATE action
 */
export interface BuildCreateRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        userMessage: string;
        payload: {
            action: 'create';
            planId?: string;
            usePlan?: boolean;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: READ action
 */
export interface BuildReadRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        payload: {
            action: 'read';
            deliverableId?: string;
            versionId?: string;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: LIST action
 */
export interface BuildListRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        payload: {
            action: 'list';
            deliverableId?: string;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: EDIT action
 */
export interface BuildEditRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
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
 * Build Mode: SET_CURRENT action
 */
export interface BuildSetCurrentRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        payload: {
            action: 'set_current';
            versionId: string;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: DELETE_VERSION action
 */
export interface BuildDeleteVersionRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        payload: {
            action: 'delete_version';
            versionId: string;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: MERGE_VERSIONS action
 */
export interface BuildMergeVersionsRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
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
 * Build Mode: COPY_VERSION action
 */
export interface BuildCopyVersionRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
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
 * Build Mode: RERUN action (unique to build mode)
 */
export interface BuildRerunRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        userMessage?: string;
        payload: {
            action: 'rerun';
            versionId: string;
            rerunConfig?: {
                usePreviousPlan?: boolean;
                modifyPrompt?: string;
                preserveSettings?: boolean;
            };
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Build Mode: DELETE action
 */
export interface BuildDeleteRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'build';
    params: {
        mode: AgentTaskMode.BUILD;
        conversationId: string;
        payload: {
            action: 'delete';
            deliverableId?: string;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Union of all Build mode requests
 */
export type StrictBuildRequest = BuildCreateRequest | BuildReadRequest | BuildListRequest | BuildEditRequest | BuildSetCurrentRequest | BuildDeleteVersionRequest | BuildMergeVersionsRequest | BuildCopyVersionRequest | BuildRerunRequest | BuildDeleteRequest;
/**
 * Base deliverable data structure
 */
export interface DeliverableData {
    id: string;
    conversationId: string;
    currentVersionId: string | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Deliverable version data structure
 */
export interface DeliverableVersionData {
    id: string;
    deliverableId: string;
    versionNumber: number;
    content: string;
    format: 'text' | 'markdown' | 'json' | 'code';
    createdByType: 'user' | 'agent';
    createdById?: string;
    taskId?: string;
    planVersionId?: string;
    isCurrentVersion: boolean;
    createdAt: string;
    metadata?: Record<string, any>;
}
/**
 * Build Mode: CREATE response
 */
export interface BuildCreateResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                version: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: READ response
 */
export interface BuildReadResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                version: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: LIST response
 */
export interface BuildListResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                versions: DeliverableVersionData[];
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: EDIT response
 */
export interface BuildEditResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                version: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: SET_CURRENT response
 */
export interface BuildSetCurrentResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                version: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: DELETE_VERSION response
 */
export interface BuildDeleteVersionResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deletedVersionId: string;
                deliverable: DeliverableData;
                remainingVersions: DeliverableVersionData[];
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: MERGE_VERSIONS response
 */
export interface BuildMergeVersionsResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                mergedVersion: DeliverableVersionData;
                sourceVersions: DeliverableVersionData[];
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: COPY_VERSION response
 */
export interface BuildCopyVersionResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                sourceDeliverable: DeliverableData;
                sourceVersion: DeliverableVersionData;
                targetDeliverable: DeliverableData;
                copiedVersion: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: RERUN response
 */
export interface BuildRerunResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deliverable: DeliverableData;
                rerunVersion: DeliverableVersionData;
                originalVersion: DeliverableVersionData;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Build Mode: DELETE response
 */
export interface BuildDeleteResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'build';
        payload: {
            content: {
                deletedDeliverableId: string;
                deletedVersionCount: number;
            };
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Union of all Build mode responses
 */
export type StrictBuildResponse = BuildCreateResponse | BuildReadResponse | BuildListResponse | BuildEditResponse | BuildSetCurrentResponse | BuildDeleteVersionResponse | BuildMergeVersionsResponse | BuildCopyVersionResponse | BuildRerunResponse | BuildDeleteResponse;
//# sourceMappingURL=build.strict.d.ts.map