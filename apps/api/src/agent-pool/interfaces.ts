// AgentSkill interface
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  inputModes: string[];
  outputModes: string[];
}

export interface AgentRegistration {
  id: string;
  name: string;
  type: 'orchestrator' | 'specialist' | 'manager' | 'external';
  path: string; // e.g., "specialist/blog_post"
  url: string;
  description: string;
  capabilities: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  status: 'online' | 'offline' | 'starting' | 'error';
  registeredAt?: Date;
  lastHeartbeat?: Date;
  metrics?: AgentMetrics;
  metadata?: Record<string, any>;
}

export interface AgentHeartbeat {
  agentId: string;
  timestamp: Date;
  metrics?: AgentMetrics;
  status?: string;
}

export interface AgentMetrics {
  activeTasks: number;
  totalTasksProcessed: number;
  averageResponseTime: number;
  errorCount: number;
  uptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface AgentCapabilitiesDocument {
  generatedAt: Date;
  totalAgents: number;
  agentsByType: {
    orchestrator: number;
    specialist: number;
    manager: number;
    external: number;
  };
  agents: AgentInfo[];
}

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  path: string;
  url: string;
  description: string;
  capabilities: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  status: string;
  lastHeartbeat?: Date;
  metadata?: Record<string, any>;
}

export interface PoolStats {
  total: number;
  online: number;
  offline: number;
  byType: {
    orchestrator: number;
    specialist: number;
    manager: number;
    external: number;
  };
}
