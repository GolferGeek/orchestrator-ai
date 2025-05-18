import axios, { AxiosInstance, AxiosError } from 'axios';
import { AgentInfo, TaskCreationRequest, TaskResponse } from '../types/chat'; // Import new Task types

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'; // Allow override via .env

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Legacy interfaces for reference, not used by postTaskToOrchestrator anymore
export interface OrchestratorRequest { text: string; }
export interface AgentResponseInterface { agent_id: string; agent_name: string; text: string; } // Renamed to avoid conflict if AgentResponse is imported from types
export interface OrchestratorResponseInterface { query: string; responses: AgentResponseInterface[]; } // Renamed

// More specific type for expected error data from backend if it has a 'detail' field
export interface BackendErrorDetail {
  detail?: string;
  [key: string]: any; // Allow other properties
}

/**
 * Posts a task (user message) to the orchestrator.
 * @param userInputText The user's input text.
 * @param sessionId Optional session ID
 * @returns A promise that resolves to the TaskResponse.
 */
export const postTaskToOrchestrator = async (
  userInputText: string,
  sessionId?: string | null
): Promise<TaskResponse> => {
  try {
    const requestPayload: TaskCreationRequest = {
      message: {
        role: 'user',
        parts: [{ text: userInputText }]
      }
    };
    if (sessionId) {
      requestPayload.session_id = sessionId;
    }
    const response = await apiClient.post<TaskResponse>('/agents/orchestrator/tasks', requestPayload);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<BackendErrorDetail>; 
    let errorMessage = 'Failed to post task to orchestrator';
    if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
      errorMessage = axiosError.response.data.detail;
    } else if (axiosError.message) {
      errorMessage = axiosError.message;
    }
    console.error('Error posting task to orchestrator:', axiosError.response?.data || axiosError.message);
    throw new Error(errorMessage);
  }
};

/**
 * Fetches the list of available agents from the backend.
 * @returns A promise that resolves to an array of AgentInfo.
 */
export const getAvailableAgents = async (): Promise<AgentInfo[]> => {
  try {
    // Updated endpoint to /agents (removed trailing slash)
    const response = await apiClient.get<{ agents: AgentInfo[] }>('/agents'); 
    return response.data.agents || []; 
  } catch (error) {
    const axiosError = error as AxiosError<BackendErrorDetail>; 
    let errorMessage = 'Failed to fetch available agents';
    if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
      errorMessage = axiosError.response.data.detail;
    } else if (axiosError.message) {
      errorMessage = axiosError.message;
    }
    console.error('Error fetching available agents:', axiosError.response?.data || axiosError.message);
    throw new Error(errorMessage);
  }
};

// You can add other API service functions here as needed, e.g.:
// export const getAgentList = async (): Promise<AgentInfo[]> => { ... };

export default apiClient; // Exporting the instance can be useful for direct use or testing 