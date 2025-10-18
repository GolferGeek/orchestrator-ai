import type { JsonValue } from '@orchestrator-ai/transport-types';

/**
 * Task Type Definitions
 * Domain-specific types for task management
 */

// =====================================
// TASK METADATA
// =====================================

/**
 * Metadata for tasks
 * Extensible structure for task-level information
 */
export interface TaskMetadata {
  /** Source of the task */
  source?: 'user' | 'orchestration' | 'agent' | 'system';

  /** Priority level */
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  /** Estimated duration in milliseconds */
  estimatedDuration?: number;

  /** Actual duration in milliseconds */
  actualDuration?: number;

  /** Tags for categorization */
  tags?: string[];

  /** Related entities */
  relatedTo?: {
    conversationId?: string;
    orchestrationId?: string;
    orchestrationStepId?: string;
    deliverableId?: string;
    projectId?: string;
  };

  /** Agent assignment */
  assignment?: {
    agentId: string;
    agentType: string;
    assignedAt: string;
    assignedBy?: string;
  };

  /** Progress tracking */
  progress?: {
    percentage: number;
    currentPhase?: string;
    phasesCompleted?: string[];
    phasesRemaining?: string[];
  };

  /** Resource usage */
  resources?: {
    tokensUsed?: number;
    cost?: number;
    modelUsed?: string;
    memoryUsage?: number;
  };

  /** Quality metrics */
  quality?: {
    reviewScore?: number;
    validationPassed?: boolean;
    issuesFound?: number;
    issuesResolved?: number;
  };

  /** User feedback */
  feedback?: {
    rating?: number;
    comments?: string;
    helpful?: boolean;
  };

  /** Custom metadata fields */
  custom?: Record<string, string | number | boolean>;
}

// =====================================
// TASK DATA
// =====================================

/**
 * Structured data for tasks
 * Type-safe task payload structure
 */
export interface TaskData {
  /** Input data */
  input?: {
    /** User message or prompt */
    prompt?: string;

    /** Structured parameters */
    parameters?: Record<string, JsonValue>;

    /** File references */
    files?: Array<{
      id: string;
      name: string;
      type: string;
      url?: string;
    }>;

    /** Context from previous tasks */
    context?: Record<string, JsonValue>;
  };

  /** Output data */
  output?: {
    /** Result text */
    text?: string;

    /** Structured result data */
    data?: Record<string, JsonValue>;

    /** Generated artifacts */
    artifacts?: Array<{
      id: string;
      type: string;
      name: string;
      content?: string;
      url?: string;
    }>;

    /** Validation results */
    validation?: {
      isValid: boolean;
      errors?: string[];
      warnings?: string[];
    };
  };

  /** Processing state */
  processing?: {
    startedAt?: string;
    completedAt?: string;
    lastUpdateAt?: string;
    retriesAttempted?: number;
    checkpoints?: Array<{
      phase: string;
      timestamp: string;
      data?: JsonValue;
    }>;
  };

  /** Error information */
  error?: {
    code?: string;
    message?: string;
    details?: JsonValue;
    recoverable?: boolean;
    retryable?: boolean;
  };
}

// =====================================
// STATUS TYPES
// =====================================

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskType =
  | 'chat'
  | 'orchestration_step'
  | 'agent_task'
  | 'evaluation'
  | 'generation'
  | 'analysis'
  | 'custom';

// =====================================
// MAIN INTERFACES
// =====================================

/**
 * Task record
 */
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  conversationId?: string;
  agentId?: string;
  userId?: string;
  prompt?: string;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: TaskMetadata;
  data?: TaskData;
}

// =====================================
// CREATION PAYLOADS
// =====================================

/**
 * Payload for creating a new task
 */
export interface CreateTaskPayload {
  type: TaskType;
  conversationId?: string;
  agentId?: string;
  prompt?: string;
  metadata?: TaskMetadata;
  data?: TaskData;
}

/**
 * Payload for updating a task
 */
export interface UpdateTaskPayload {
  status?: TaskStatus;
  result?: string;
  error?: string;
  completedAt?: string;
  metadata?: Partial<TaskMetadata>;
  data?: Partial<TaskData>;
}

/**
 * Payload for updating task metadata
 */
export type UpdateTaskMetadataPayload = Partial<TaskMetadata>;

// =====================================
// FILTERING & SORTING
// =====================================

/**
 * Filters for querying tasks
 */
export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
  conversationId?: string;
  agentId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  search?: string;
}

/**
 * Sort options for tasks
 */
export interface TaskSortOptions {
  field: 'createdAt' | 'updatedAt' | 'completedAt' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

// =====================================
// AGGREGATIONS
// =====================================

/**
 * Task statistics
 */
export interface TaskStatistics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byType: Record<TaskType, number>;
  averageDuration: number;
  successRate: number;
  failureRate: number;
}

/**
 * Task performance metrics
 */
export interface TaskPerformanceMetrics {
  taskId: string;
  duration: number;
  tokensUsed?: number;
  cost?: number;
  qualityScore?: number;
  efficiency?: number;
}
