// Agent interface based on the original implementation
export type AgentExecutionProfile =
  | 'conversation_only'
  | 'autonomous_build'
  | 'human_gate'
  | 'conversation_with_gate';

export interface AgentExecutionCapabilities {
  can_converse: boolean;
  can_plan: boolean;
  can_build: boolean;
  requires_human_gate: boolean;
}

export interface Agent {
  name: string;
  type: string;
  description?: string;
  execution_modes?: string[];
  execution_profile?: AgentExecutionProfile;
  execution_capabilities?: AgentExecutionCapabilities;
}
export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: {
    isPlaceholder?: boolean;
    isCompleted?: boolean;
    processingCompletion?: boolean;
    completedAt?: string;
    completedSteps?: Array<{
      name: string;
      message: string;
      index: number;
      total: number;
    }>;
    workflow_steps_realtime?: Array<{
      stepName: string;
      stepIndex: number;
      totalSteps: number;
      status: string;
      message?: string;
      timestamp: string;
    }>;
    processing_type?: string;
    lastUpdated?: string;
    messageCount?: number;
    allMessages?: any[];
    [key: string]: any;
  };
}
export interface AgentConversation {
  id: string;
  agent: Agent;
  messages: AgentChatMessage[];
  createdAt: Date;
  lastActiveAt: Date;
  // Conversation mode controls high-level intent
  chatMode: 'converse' | 'plan' | 'build';
  allowedChatModes: ('converse' | 'plan' | 'build')[];
  executionMode: 'immediate' | 'polling' | 'websocket';
  supportedExecutionModes: ('immediate' | 'polling' | 'websocket')[];
  isExecutionModeOverride?: boolean;
  executionProfile?: AgentExecutionProfile;
  executionCapabilities?: AgentExecutionCapabilities;
  error?: string;
  // Additional properties from original interface
  title: string;
  isLoading: boolean;
  isSendingMessage: boolean;
}
export type ExecutionMode = 'immediate' | 'polling' | 'websocket';
export interface TaskExecutionOptions {
  method: string;
  prompt: string;
  conversationId: string;
  conversationHistory: any[];
  llmSelection: any;
  executionMode: ExecutionMode;
  agentType: string;
  agentName: string;
  taskId?: string;
  mode?: 'converse' | 'plan' | 'build';
  timeoutSeconds?: number;
  metadata?: any; // Context metadata for version operations
}

export interface PendingAction {
  type: 'plan' | 'build';
  expiresAt: number; // epoch ms
  sourceTaskId?: string;
}
export interface DeliverableOptions {
  taskId: string;
  content: string;
  existingContent: string;
  messageMetadata?: any;
}
export interface ProgressUpdate {
  taskId: string;
  status: string;
  progress: number;
  progressMessage?: string;
  data?: any;
}
export interface TaskCompletionEvent {
  taskId: string;
  conversationId: string;
  status: 'completed' | 'failed';
}
export interface WorkflowStepEvent {
  taskId: string;
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  metadata?: Record<string, any>;
}
