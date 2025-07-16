export interface AgentConversation {
  id: string;
  userId: string;
  agentName: string;
  agentType: 'specialist' | 'orchestrator' | 'external' | 'api';
  startedAt: Date;
  endedAt?: Date;
  lastActiveAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  agentConversationId: string | null; // Nullable to support lazy conversation creation
  userId: string;
  // Request fields
  method: string;
  prompt: string;
  params?: Record<string, any>;
  // Response fields
  response?: string;
  responseMetadata?: Record<string, any>;
  // Status tracking
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string;
  // Evaluation fields
  evaluation?: Record<string, any>;
  llmMetadata?: Record<string, any>;
  // Error tracking
  errorCode?: string;
  errorMessage?: string;
  errorData?: Record<string, any>;
  // Timing
  startedAt?: Date;
  completedAt?: Date;
  timeoutSeconds: number;
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConversationWithStats extends AgentConversation {
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
}

export interface CreateAgentConversationDto {
  agentName: string;
  agentType: 'specialist' | 'orchestrator' | 'external' | 'api';
  metadata?: Record<string, any>;
}

export interface LLMSelection {
  providerId?: string;
  modelId?: string;
  cidafmOptions?: {
    activeStateModifiers?: string[];
    responseModifiers?: string[];
    executedCommands?: string[];
    customOptions?: Record<string, any>;
  };
  temperature?: number;
  maxTokens?: number;
}

export interface CreateTaskDto {
  method: string;
  prompt: string;
  params?: Record<string, any>;
  conversationId?: string; // Optional, creates new conversation if not provided
  timeoutSeconds?: number;
  llmSelection?: LLMSelection; // LLM and CIDAFM configuration
  conversationHistory?: Array<{
    role: string;
    content: string;
    timestamp: string;
    taskId?: string;
    metadata?: Record<string, any>;
  }>; // Conversation history array passed from frontend
}

export interface UpdateTaskDto {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  progressMessage?: string;
  response?: string;
  responseMetadata?: Record<string, any>;
  evaluation?: Record<string, any>;
  llmMetadata?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  errorData?: Record<string, any>;
}

export interface TaskProgressEvent {
  taskId: string;
  progress: number;
  message?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  metadata?: Record<string, any>;
}

export interface AgentConversationQueryParams {
  userId?: string;
  agentName?: string;
  agentType?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskQueryParams {
  conversationId?: string;
  userId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}