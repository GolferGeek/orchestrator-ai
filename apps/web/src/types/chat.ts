export type MessageSender = 'user' | 'agent' | 'system';

export type MessageDisplayType = 'text' | 'agentList';

export interface ChatMessage {
  id: string;
  text?: string;
  sender: MessageSender;
  agentName?: string;
  timestamp: Date;
  messageType?: MessageDisplayType;
  data?: any;
  // Potentially add more fields later, e.g., message status (sending, sent, error)
}

// Interface for an agent (relevant for agent store later, but good to think about types together)
export interface AgentInfo {
  id: string;
  name: string;
  description: string;
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
} 