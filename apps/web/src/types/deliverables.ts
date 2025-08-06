// Re-export types from the service for consistent usage across the app
export {
  DeliverableType,
  DeliverableFormat,
  type Deliverable,
  type DeliverableVersion,
  type CreateDeliverableDto,
  type CreateVersionDto,
  type DeliverableFilters,
  type DeliverableSearchResult
} from '@/services/deliverablesService';

// Import types for use in interfaces
import type { Deliverable, DeliverableVersion } from '@/services/deliverablesService';

// Additional frontend-specific types
export interface DeliverableUIState {
  isViewing: boolean;
  isEditing: boolean;
  isCreating: boolean;
  showVersions: boolean;
  selectedVersion?: DeliverableVersion;
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
  messageId?: string;
  deliverables: Deliverable[];
  canEnhance: boolean;
  enhancementSource?: string;
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
    [key: string]: any;
  };
  conversationId?: string;
  conversationHistory?: any[];
  [key: string]: any;
}