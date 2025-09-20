export type MessageSender = 'user' | 'agent' | 'system';
export type MessageDisplayType = 'text' | 'agentList' | 'workflow_progress' | 'deliverable';
export interface ChatMessage {
  id: string;
  text?: string;
  sender: MessageSender;
  agentName?: string;
  timestamp: Date;
  messageType?: MessageDisplayType;
  data?: any;
  // Workflow-specific fields
  workflowStep?: string;
  stepIndex?: number;
  totalSteps?: number;
  deliverableType?: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  // Potentially add more fields later, e.g., message status (sending, sent, error)
}
// Interface for workflow progress messages
export interface WorkflowProgressMessage {
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}
// Interface for deliverable messages
export interface DeliverableMessage {
  title: string;
  content: string;
  deliverableType: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  format: 'markdown' | 'text' | 'json' | 'html';
  metadata?: Record<string, any>;
  downloadable?: boolean;
  timestamp: Date;
}
// Interface for workflow state
export interface WorkflowState {
  workflowId: string;
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowProgressMessage[];
  deliverables: DeliverableMessage[];
  metadata?: Record<string, any>;
}
// Interface for an agent (relevant for agent store later, but good to think about types together)
export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  type?: string;
  execution_modes?: ('immediate' | 'polling' | 'real-time')[];
  execution_profile?: 'conversation_only' | 'autonomous_build' | 'human_gate' | 'conversation_with_gate';
  execution_capabilities?: {
    can_converse: boolean;
    can_plan: boolean;
    can_build: boolean;
    requires_human_gate: boolean;
  };
  // capabilities?: string[]; // Example
}
// Corrected TaskCreationRequest for /agents/orchestrator/tasks
// based on user confirmation that only the message object is sent.
export interface TaskCreationRequest {
  message: {
    role: 'user'; 
    parts: Array<{
      text: string;
    }>;
  };
  session_id?: string | null; // Added optional session_id for context continuity
  // skill and agent_id are removed as per user clarification
}
// Represents a part of a message (e.g., text, image)
interface MessagePart {
  type: string; // e.g., 'text', 'image'
  text?: string; // For text parts
  url?: string;  // For image parts
  alt_text?: string;
  content?: any; // For generic artifact parts
  encoding?: string;
  // Allow other properties from backend
  [key: string]: any; 
}
// Represents a message within a task (request or response)
interface TaskMessage {
  role: string; // "user", "agent", "system"
  parts: MessagePart[];
  artifacts?: any[]; // Define more strictly if needed
  timestamp?: string; // ISO 8601
  metadata?: Record<string, any> | null; // For agent_name or other info
  // Allow other properties from backend
  [key: string]: any; 
}
// Updated TaskResponse to closely match backend Pydantic Task model
export interface TaskResponse {
  id: string; 
  status: {
    state: string; 
    timestamp: string;
    message?: string; 
  };
  request_message?: TaskMessage;
  response_message?: TaskMessage | null;
  history?: TaskMessage[]; 
  artifacts?: any[]; 
  session_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string; 
  updated_at: string; 
  // A2A Protocol V2 fields
  output_artifacts?: Array<{
    type: string;
    artifact_id: string;
    artifact_type: string;
    format?: string;
    data: string;
    encoding?: string;
    metadata?: Record<string, any>;
    size?: number;
    checksum?: string;
  }>;
  input_artifacts?: Array<{
    type: string;
    artifact_id: string;
    artifact_type: string;
    format?: string;
    data: any;
    encoding?: string;
    metadata?: Record<string, any>;
    size?: number;
    checksum?: string;
  }>;
  error_details?: {
    code?: string;
    message?: string;
    details?: Record<string, any>;
  };
  progress?: {
    percentage?: number;
    current_step?: string;
    total_steps?: number;
    estimated_remaining?: number;
  };
  // Additional fallback fields for backward compatibility
  result?: string;
  title?: string;
  description?: string;
  instructions?: string;
  priority?: string;
  due_date?: string;
  created_by?: string;
  assigned_to?: string;
  estimated_duration?: number;
  actual_duration?: number;
  dependencies?: string[];
  tags?: string[];
  context?: Record<string, any>;
  // Legacy fields for V1 compatibility
  task_id?: string;
  respondingAgentName?: string;
} 
