import { apiService } from './apiService';
import { AxiosError } from 'axios';

interface BackendErrorDetail {
  message: string;
  detail?: string;
}

// Interfaces should align with backend Pydantic schemas (apps/api/sessions/schemas.py)
export interface Session {
  id: string; // UUID
  user_id: string; // UUID
  name?: string | null;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: Session[];
  count: number;
}

export interface Message {
  id: string; // UUID
  session_id: string; // UUID
  user_id: string; // UUID
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string | null;
  timestamp: string; // ISO datetime string
  order: number;
  metadata?: Record<string, any> | null;
}

export interface MessageListResponse {
  messages: Message[];
  session_id: string; // UUID
  count: number;
  skip: number;
  limit: number;
}

export interface SessionCreatePayload {
  name?: string | null;
}

export const sessionService = {
  async listSessions(): Promise<SessionListResponse> {
    try {
      const response = await apiService.getUserSessions();
      // The response should be an array of sessions directly from the backend
      const sessions = Array.isArray(response) ? response : (response?.sessions || []);
      return {
        sessions: sessions,
        count: sessions.length
      };
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to list sessions';
      console.error('Error listing sessions:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  async createSession(payload: SessionCreatePayload): Promise<Session> {
    try {
      const response = await apiService.createSession(payload.name || 'New Session');
      return response;
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to create session';
      console.error('Error creating session:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  async getSessionMessages(sessionId: string, skip: number = 0, limit: number = 50): Promise<MessageListResponse> {
    try {
      const response = await apiService.getSessionMessages(sessionId, { skip, limit });
      return {
        messages: response || [],
        session_id: sessionId,
        count: response?.length || 0,
        skip,
        limit
      };
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to get session messages';
      console.error('Error getting session messages:', errorMessage);
      throw new Error(errorMessage);
    }
  },
  
  // Placeholder for get single session details if needed, based on Task #5 description.
  // async getSessionDetails(sessionId: string): Promise<Session> {
  //   try {
  //     const response = await apiClient.get<Session>(`/sessions/${sessionId}`);
  //     return response.data;
  //   } catch (error) {
  //     const axiosError = error as AxiosError<BackendErrorDetail>; 
  //     const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to get session details';
  //     console.error('Error getting session details:', errorMessage);
  //     throw new Error(errorMessage);
  //   }
  // },
  
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await apiService.deleteSession(sessionId);
      console.log(`Session ${sessionId} deleted successfully`);
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to delete session';
      console.error('Error deleting session:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  async updateSessionName(sessionId: string, name: string): Promise<void> {
    try {
      // Note: This endpoint doesn't exist yet in the backend
      // For now, this is a placeholder - the frontend will handle local updates
      console.log(`Would update session ${sessionId} name to: ${name}`);
      // TODO: Implement backend endpoint for session updates
      // await apiService.updateSession(sessionId, { name });
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to update session name';
      console.error('Error updating session name:', errorMessage);
      throw new Error(errorMessage);
    }
  },


}; 