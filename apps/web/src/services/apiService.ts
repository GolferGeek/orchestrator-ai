import { apiManager } from './apiManager';
import { TaskResponse, AgentInfo } from '../types/chat';
import axios, { AxiosInstance } from 'axios';

// Legacy interfaces for backward compatibility
export interface OrchestratorRequest { text: string; }
export interface AgentResponseInterface { agent_id: string; agent_name: string; text: string; }
export interface OrchestratorResponseInterface { query: string; responses: AgentResponseInterface[]; }

export interface BackendErrorDetail {
  detail?: string;
  [key: string]: any;
}

// Create a backward-compatible axios-like client
const createBackwardCompatibleClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: apiManager.currentEndpoint.baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  // Update base URL when current endpoint changes
  // This is a simple approach - we could use a reactive pattern here
  const updateBaseURL = () => {
    client.defaults.baseURL = apiManager.currentEndpoint.baseUrl;
  };

  // Update immediately and periodically (in a real app, you'd use reactive patterns)
  updateBaseURL();
  setInterval(updateBaseURL, 1000); // Check every second

  return client;
};

// Create the backward-compatible client
const backwardCompatibleClient = createBackwardCompatibleClient();

/**
 * Posts a task (user message) to the orchestrator using the current API client.
 * @param userInputText The user's input text.
 * @param sessionId Optional session ID
 * @param conversationHistory Optional conversation history
 * @returns A promise that resolves to the TaskResponse.
 */
export const postTaskToOrchestrator = async (
  userInputText: string,
  sessionId?: string | null,
  conversationHistory?: Array<{role: string, content: string, metadata?: any}>
): Promise<TaskResponse> => {
  const client = apiManager.currentClient;
  if (!client) {
    throw new Error('No API client available');
  }

  try {
    return await client.postTaskToOrchestrator(userInputText, sessionId, conversationHistory);
  } catch (error) {
    console.error('Error posting task to orchestrator:', error);
    throw error;
  }
};

/**
 * Fetches the list of available agents from the current API endpoint.
 * @returns A promise that resolves to an array of AgentInfo.
 */
export const getAvailableAgents = async (): Promise<AgentInfo[]> => {
  const client = apiManager.currentClient;
  if (!client) {
    throw new Error('No API client available');
  }

  try {
    return await client.getAvailableAgents();
  } catch (error) {
    console.error('Error fetching available agents:', error);
    throw error;
  }
};

/**
 * Get current API endpoint information
 */
export const getCurrentApiInfo = () => {
  return apiManager.currentEndpoint;
};

/**
 * Check if a feature is supported by the current API
 */
export const isFeatureSupported = (feature: string): boolean => {
  return apiManager.isFeatureSupported(feature);
};

/**
 * Switch to a different API version
 */
export const switchApiVersion = async (version: 'v1' | 'v2') => {
  try {
    await apiManager.switchToVersion(version);
    console.log(`Switched to API version ${version}`);
    // Update the backward-compatible client's base URL
    backwardCompatibleClient.defaults.baseURL = apiManager.currentEndpoint.baseUrl;
  } catch (error) {
    console.error(`Failed to switch to API version ${version}:`, error);
    throw error;
  }
};

/**
 * Get all available API endpoints
 */
export const getAvailableEndpoints = () => {
  return apiManager.availableEndpoints;
};

/**
 * Perform health check on current API
 */
export const performHealthCheck = async (): Promise<boolean> => {
  const client = apiManager.currentClient;
  if (!client) {
    return false;
  }

  try {
    return await client.healthCheck();
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

// Re-export the API manager for direct access if needed
export { apiManager };

// Export the backward-compatible axios-like client as the default
// This maintains compatibility with existing auth services
export default backwardCompatibleClient; 