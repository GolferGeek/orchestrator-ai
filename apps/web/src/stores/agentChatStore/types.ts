export const PRIMARY_CHAT_MODES = ['converse', 'plan', 'build'] as const;
export type PrimaryChatMode = typeof PRIMARY_CHAT_MODES[number];

export type AgentChatMode =
  | PrimaryChatMode
  | 'orchestrate_create'
  | 'orchestrate_execute'
  | 'orchestrate_continue'
  | 'orchestrate_save_recipe';

export const DEFAULT_CHAT_MODES: AgentChatMode[] = [...PRIMARY_CHAT_MODES];

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
  namespace?: string | null;
  execution_modes?: string[];
  execution_profile?: AgentExecutionProfile;
  execution_capabilities?: AgentExecutionCapabilities;
}

export interface ConversationPlanRecord {
  id: string;
  conversation_id: string;
  organization_slug: string | null;
  agent_slug: string;
  status: string;
  summary: string | null;
  plan_json: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationRunRecord {
  id: string;
  plan_id: string | null;
  origin_type: string;
  origin_id: string | null;
  orchestration_slug: string | null;
  organization_slug: string | null;
  status: string;
  prompt_inputs?: Record<string, any>;
  current_step_index?: number | null;
  completed_steps?: any[];
  step_state?: Record<string, any>;
  human_checkpoint_id?: string | null;
  metadata?: Record<string, any>;
  started_at: string;
  completed_at: string | null;
}

export interface AgentOrchestrationRecord {
  id: string;
  organization_slug: string | null;
  agent_slug: string;
  slug: string;
  display_name: string;
  description: string | null;
  status: string;
  orchestration_json: Record<string, any>;
  prompt_templates?: any[];
  tags?: string[];
  version?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTaskResponse {
  success: boolean;
  mode: string;
  payload?: {
    content?: any;
    metadata?: Record<string, any>;
  };
  humanResponse?: {
    message: string;
    reason?: string;
  };
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
  chatMode: AgentChatMode;
  allowedChatModes: AgentChatMode[];
  executionMode: 'immediate' | 'polling' | 'websocket';
  supportedExecutionModes: ('immediate' | 'polling' | 'websocket')[];
  isExecutionModeOverride?: boolean;
  executionProfile?: AgentExecutionProfile;
  executionCapabilities?: AgentExecutionCapabilities;
  error?: string;
  plans?: ConversationPlanRecord[];
  orchestrationRuns?: OrchestrationRunRecord[];
  savedOrchestrations?: AgentOrchestrationRecord[];
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
  mode?: AgentChatMode;
  timeoutSeconds?: number;
  metadata?: any; // Context metadata for version operations
  agentNamespace?: string | null;
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
