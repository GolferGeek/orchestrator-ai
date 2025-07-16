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
      throw new Error(errorMessage);
    }
  },

  async getSessionMessages(sessionId: string, skip: number = 0, limit: number = 50): Promise<MessageListResponse> {
    try {
      const response = await apiService.getSessionMessages(sessionId, { skip, limit });
      // Convert SendMessageResponse[] to Message[] by ensuring required fields
      const messages: Message[] = (response || []).map(msg => ({
        ...msg,
        user_id: msg.user_id || 'unknown-user', // Ensure user_id is never undefined
        session_id: msg.session_id || sessionId // Ensure session_id is never undefined
      }));
      
      return {
        messages,
        session_id: sessionId,
        count: messages.length,
        skip,
        limit
      };
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to get session messages';
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
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to delete session';
      throw new Error(errorMessage);
    }
  },

  async updateSessionName(sessionId: string, name: string): Promise<void> {
    try {
      // Note: This endpoint doesn't exist yet in the backend
      // For now, this is a placeholder - the frontend will handle local updates
      // TODO: Implement backend endpoint for session updates
      // await apiService.updateSession(sessionId, { name });
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to update session name';
      throw new Error(errorMessage);
    }
  },


}; 