// Re-export types from the service for consistent usage across the app
export {
  DeliverableType,
  DeliverableFormat,
  DeliverableVersionCreationType,
  type Deliverable,
  type DeliverableVersion,
  type CreateDeliverableDto,
  type CreateVersionDto,
  type DeliverableFilters,
  type DeliverableSearchResult,
  type DeliverableSearchResponse
} from '@/services/deliverablesService';

// Import types for use in interfaces
import type { Deliverable, DeliverableVersion } from '@/services/deliverablesService';

// Additional frontend-specific types
export interface DeliverableUIState {
  isViewing: boolean;
  isEditing: boolean;
  isCreating: boolean;
  showVersionHistory: boolean;
  showVersionComparison: boolean;
  selectedVersion?: DeliverableVersion;
  compareVersion?: DeliverableVersion;
  isCreatingVersion: boolean;
}

export interface DeliverableAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ConversationDeliverableContext {
  conversationId: string;
  taskId?: string;
  deliverables: Deliverable[];
  canEnhance: boolean;
  enhancementSource?: string;
}

export interface VersionHistoryItem {
  version: DeliverableVersion;
  isActive: boolean;
  isCurrent: boolean;
  canRevert: boolean;
  canDelete: boolean;
}

// Agent response interfaces that include deliverable information
export interface AgentResponseWithDeliverable {
  success: boolean;
  message?: string;
  response?: string;
  deliverableId?: string;
  enhancedFrom?: string;
  metadata?: {
    agentName?: string;
    agentType?: string;
    [key: string]: any;
  };
}

// Task request interfaces that include deliverable context
export interface TaskRequestWithDeliverable {
  method: string;
  prompt: string;
  params?: {
    deliverableId?: string;
    enhanceDeliverableId?: string;
    versionId?: string;
    [key: string]: any;
  };
  conversationId?: string;
  conversationHistory?: any[];
  [key: string]: any;
}

// Legacy type aliases for backward compatibility
export type DeliverableSearchItem = DeliverableSearchResult;