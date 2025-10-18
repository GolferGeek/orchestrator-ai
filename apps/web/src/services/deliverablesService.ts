import axios, { AxiosInstance } from 'axios';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { apiService } from './apiService';
// API endpoint configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL;
// Deliverable types and interfaces
export enum DeliverableType {
  DOCUMENT = 'document',
  ANALYSIS = 'analysis',
  REPORT = 'report',
  PLAN = 'plan',
  REQUIREMENTS = 'requirements'
}
export enum DeliverableFormat {
  MARKDOWN = 'markdown',
  TEXT = 'text',
  JSON = 'json',
  HTML = 'html',
  IMAGE_PNG = 'image/png',
  IMAGE_JPEG = 'image/jpeg',
  IMAGE_WEBP = 'image/webp',
  IMAGE_GIF = 'image/gif',
  IMAGE_SVG = 'image/svg+xml'
}
export enum DeliverableVersionCreationType {
  AI_RESPONSE = 'ai_response',
  MANUAL_EDIT = 'manual_edit',
  AI_ENHANCEMENT = 'ai_enhancement',
  USER_REQUEST = 'user_request',
}
export interface Deliverable {
  id: string;
  userId: string;
  conversationId?: string;
  projectStepId?: string;
  agentName?: string;
  title: string;
  description?: string;
  type?: DeliverableType;
  createdAt: string;
  updatedAt: string;
  currentVersion?: DeliverableVersion;
  versions?: DeliverableVersion[];
}
export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  versionNumber: number;
  content?: string;
  format?: DeliverableFormat;
  isCurrentVersion: boolean;
  createdByType: DeliverableVersionCreationType;
  taskId?: string;
  metadata?: JsonObject;
  fileAttachments?: JsonObject;
  createdAt: string;
  updatedAt: string;
}
export interface CreateDeliverableDto {
  title: string;
  description?: string;
  type?: DeliverableType;
  conversationId?: string;
  projectStepId?: string;
  // Initial version data (optional)
  initialContent?: string;
  initialFormat?: DeliverableFormat;
  initialCreationType?: DeliverableVersionCreationType;
  initialTaskId?: string;
  initialMetadata?: JsonObject;
  initialFileAttachments?: JsonObject;
}
export interface CreateVersionDto {
  content: string;
  format?: DeliverableFormat;
  createdByType?: DeliverableVersionCreationType;
  taskId?: string;
  metadata?: JsonObject;
  fileAttachments?: JsonObject;
}
export interface DeliverableFilters {
  type?: DeliverableType;
  format?: DeliverableFormat;
  search?: string;
  limit?: number;
  offset?: number;
  latestOnly?: boolean;
  standalone?: boolean;
}
export interface DeliverableSearchResult {
  id: string;
  userId: string;
  conversationId?: string;
  agentName?: string;
  title: string;
  description?: string;
  type?: DeliverableType;
  createdAt: string;
  updatedAt: string;
  // Current version information
  format?: DeliverableFormat;
  content?: string;
  metadata?: JsonObject;
  versionNumber?: number;
  isCurrentVersion?: boolean;
  versionId?: string;
}
export interface DeliverableSearchResponse {
  items: DeliverableSearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
/**
 * Service for managing deliverables - interfaces with the backend deliverables API
 */
class DeliverablesService {
  private axiosInstance: AxiosInstance;
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '120000', 10),
    });
    // Add auth token to requests
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }
  /**
   * Get all deliverables for the current user with optional filtering
   */
  async getDeliverables(filters?: DeliverableFilters): Promise<DeliverableSearchResponse> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.format) params.append('format', filters.format);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
      if (filters.latestOnly !== undefined) params.append('latestOnly', filters.latestOnly.toString());
      if (filters.standalone !== undefined) params.append('standalone', filters.standalone.toString());
    }
    const response = await this.axiosInstance.get(`/deliverables?${params.toString()}`);
    return response.data;
  }
  /**
   * Get a specific deliverable by ID
   */
  async getDeliverable(id: string): Promise<Deliverable> {
    const response = await this.axiosInstance.get(`/deliverables/${id}`);
    return response.data;
  }
  /**
   * Create a new deliverable
   */
  async createDeliverable(data: CreateDeliverableDto): Promise<Deliverable> {
    const response = await this.axiosInstance.post('/deliverables', data);
    return response.data;
  }
  /**
   * Create a new version of an existing deliverable
   */
  async createVersion(deliverableId: string, data: CreateVersionDto): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.post(`/deliverable-versions/${deliverableId}`, data);
    return response.data;
  }
  /**
   * Update an existing deliverable (metadata only)
   */
  async updateDeliverable(id: string, updates: Partial<Pick<CreateDeliverableDto, 'title' | 'description' | 'type' | 'projectStepId'>>): Promise<Deliverable> {
    const response = await this.axiosInstance.patch(`/deliverables/${id}`, updates);
    return response.data;
  }
  /**
   * Delete a deliverable
   */
  async deleteDeliverable(id: string): Promise<void> {
    await this.axiosInstance.delete(`/deliverables/${id}`);
  }
  /**
   * Get all versions of a deliverable
   */
  async getVersionHistory(deliverableId: string): Promise<DeliverableVersion[]> {
    const response = await this.axiosInstance.get(`/deliverable-versions/${deliverableId}/history`);
    return response.data;
  }
  /**
   * Get the current version of a deliverable
   */
  async getCurrentVersion(deliverableId: string): Promise<DeliverableVersion | null> {
    const response = await this.axiosInstance.get(`/deliverable-versions/${deliverableId}/current`);
    return response.data;
  }
  /**
   * Get a specific version by its ID
   */
  async getVersion(versionId: string): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.get(`/deliverable-versions/version/${versionId}`);
    return response.data;
  }
  /**
   * Set a specific version as the current version
   */
  async setCurrentVersion(versionId: string): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.patch(`/deliverable-versions/version/${versionId}/set-current`);
    return response.data;
  }
  /**
   * Delete a specific version
   */
  async deleteVersion(versionId: string): Promise<void> {
    await this.axiosInstance.delete(`/deliverable-versions/version/${versionId}`);
  }

  /**
   * Rerun a version with a different LLM to create a new version
   */
  async rerunWithDifferentLLM(versionId: string, llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.post(`/deliverable-versions/version/${versionId}/rerun`, llmConfig);
    return response.data;
  }

  /**
   * Copy an existing version (same content/metadata)
   */
  async copyVersion(versionId: string): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.post(`/deliverable-versions/version/${versionId}/copy`);
    return response.data;
  }

  /**
   * Enhance an existing version with an instruction using LLM
   */
  async enhanceVersion(
    versionId: string,
    params: { instruction: string; providerName?: string; modelName?: string; temperature?: number; maxTokens?: number },
  ): Promise<DeliverableVersion> {
    const response = await this.axiosInstance.post(`/deliverable-versions/version/${versionId}/enhance`, params);
    return response.data;
  }

  /**
   * Merge multiple versions using LLM
   */
  async mergeVersions(
    deliverableId: string,
    versionIds: string[],
    mergePrompt: string,
    providerName?: string,
    modelName?: string,
  ): Promise<{ newVersion: DeliverableVersion; conflictSummary?: string }> {
    const response = await this.axiosInstance.post(`/deliverable-versions/${deliverableId}/merge`, {
      versionIds,
      mergePrompt,
      providerName,
      modelName,
    });
    return response.data;
  }

  /**
   * Search deliverables with advanced query options
   */
  async searchDeliverables(query: string, filters?: Omit<DeliverableFilters, 'search'>): Promise<DeliverableSearchResponse> {
    return this.getDeliverables({ ...filters, search: query });
  }
  /**
   * Get deliverables for a specific conversation
   */
  async getConversationDeliverables(conversationId: string): Promise<Deliverable[]> {
    // Use shared apiService to ensure correct base URL and auth headers
    const response = await apiService.get(`/deliverables/conversation/${conversationId}`);
    // apiService.get already returns parsed JSON
    return Array.isArray(response) ? response : (response?.items || response || []);
  }
  /**
   * Get deliverables created by a specific agent (by searching version metadata)
   */
  async getAgentDeliverables(_agentName: string): Promise<DeliverableSearchResult[]> {
    // Note: This would need backend support to filter by version creation metadata
    const result = await this.getDeliverables({});
    // For now, return all deliverables - this could be enhanced with server-side filtering
    return result.items;
  }
  /**
   * Check if a deliverable exists for the current conversation/task context
   * This helps with enhancement workflows
   */
  async findExistingDeliverable(conversationId: string, taskId?: string): Promise<Deliverable | null> {
    try {
      const deliverables = await this.getConversationDeliverables(conversationId);
      if (taskId) {
        // Look for deliverable with matching task ID in any of its versions
        for (const deliverable of deliverables) {
          if (deliverable.currentVersion?.taskId === taskId) {
            return deliverable;
          }
          // Could also check all versions if needed:
          // const versions = await this.getVersionHistory(deliverable.id);
          // if (versions.some(v => v.taskId === taskId)) return deliverable;
        }
        return null;
      }
      // Return the most recent deliverable from this conversation
      return deliverables.length > 0 ? deliverables[0] : null;
    } catch {
      return null;
    }
  }
  /**
   * Create an editing conversation for a standalone deliverable
   */
  async createEditingConversation(
    deliverableId: string, 
    options: {
      agentName?: string;
      initialMessage?: string;
      action?: 'edit' | 'enhance' | 'revise' | 'discuss' | 'new-version';
    } = {}
  ): Promise<{ conversationId: string; message: string }> {
    const response = await this.axiosInstance.post(`/deliverables/${deliverableId}/conversations`, options);
    return response.data;
  }
  // Legacy method aliases for backward compatibility
  async getVersions(deliverableId: string): Promise<DeliverableVersion[]> {
    return this.getVersionHistory(deliverableId);
  }
}
// Export singleton instance
export const deliverablesService = new DeliverablesService();
