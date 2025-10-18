/**
 * Orchestration Type Definitions
 * Domain-specific types for orchestration workflow management
 */

import type { AgentTaskMode, JsonValue } from '@orchestrator-ai/transport-types';

// =====================================
// ORCHESTRATION METADATA
// =====================================

/**
 * Metadata for orchestration runs
 * Extensible structure for orchestration-level information
 */
export interface OrchestrationMetadata {
  /** Source of the orchestration request */
  source?: 'user' | 'system' | 'agent';

  /** Priority level */
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  /** Tags for categorization */
  tags?: string[];

  /** User notes or description */
  notes?: string;

  /** Related entity IDs */
  relatedTo?: {
    conversationId?: string;
    projectId?: string;
    deliverableId?: string;
  };

  /** Retry configuration */
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };

  /** Timeout configuration */
  timeout?: {
    stepTimeout: number;
    totalTimeout: number;
  };

  /** Custom metadata fields */
  custom?: Record<string, JsonValue>;
}

// =====================================
// ORCHESTRATION STEP I/O
// =====================================

/**
 * Input data for orchestration steps
 * Structured input passed to agents/tasks
 */
export interface OrchestrationStepInput {
  /** User prompt or instruction */
  prompt?: string;

  /** Structured data from previous steps */
  context?: {
    previousStepOutput?: JsonValue;
    sharedData?: Record<string, JsonValue>;
  };

  /** Files or resources to process */
  resources?: {
    fileIds?: string[];
    urls?: string[];
    references?: Array<{
      type: string;
      id: string;
    }>;
  };

  /** Agent-specific configuration */
  agentConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
  };

  /** Step-specific parameters */
  parameters?: Record<string, JsonValue>;
}

/**
 * Output data from orchestration steps
 * Structured result from agent/task execution
 */
export interface OrchestrationStepOutput {
  /** Success flag */
  success: boolean;

  /** Result data */
  result?: {
    /** Text response */
    text?: string;

    /** Structured data */
    data?: Record<string, JsonValue>;

    /** Generated artifacts */
    artifacts?: Array<{
      type: string;
      id: string;
      name: string;
      url?: string;
    }>;
  };

  /** Metrics and performance data */
  metrics?: {
    executionTime?: number;
    tokensUsed?: number;
    cost?: number;
    modelUsed?: string;
  };

  /** Validation results */
  validation?: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  };

  /** Next step suggestions */
  nextSteps?: Array<{
    action: string;
    reason: string;
    priority: number;
  }>;

  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    details?: JsonValue;
    recoverable: boolean;
  };
}

// =====================================
// STATUS TYPES
// =====================================

export type OrchestrationStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OrchestrationStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// =====================================
// MAIN INTERFACES
// =====================================

/**
 * Orchestration run record
 */
export interface Orchestration {
  id: string;
  conversationId: string;
  type: string;
  status: OrchestrationStatus;
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata?: OrchestrationMetadata;
}

/**
 * Orchestration step record
 */
export interface OrchestrationStep {
  id: string;
  orchestrationId: string;
  stepNumber: number;
  mode: AgentTaskMode;
  action: string;
  agentId?: string;
  taskId?: string;
  status: OrchestrationStepStatus;
  input?: OrchestrationStepInput;
  output?: OrchestrationStepOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Orchestration progress summary
 */
export interface OrchestrationProgress {
  current: number;
  total: number;
  percentage: number;
  completedSteps: number;
  failedSteps: number;
  pendingSteps: number;
}

// =====================================
// STEP CREATION PAYLOADS
// =====================================

/**
 * Payload for creating a new orchestration step
 */
export type CreateOrchestrationStepPayload = Omit<
  OrchestrationStep,
  'id' | 'orchestrationId' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * Payload for starting a new orchestration
 */
export interface StartOrchestrationPayload {
  id: string;
  conversationId: string;
  type: string;
  steps: CreateOrchestrationStepPayload[];
  metadata?: OrchestrationMetadata;
}
