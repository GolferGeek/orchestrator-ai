import { AgentRegistration } from '@agent-pool/interfaces';

/**
 * Interface for agent pool configuration
 */
export interface AgentPoolInterface {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Re-export AgentRegistrationData from agent-pool interfaces
 * This provides a clean abstraction for sub-services
 */
export type AgentRegistrationData = AgentRegistration;

/**
 * Additional interfaces for agent pool operations
 */
export interface AgentPoolResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AgentPoolStats {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  agentsByType: Record<string, number>;
}
