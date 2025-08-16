import axios, { AxiosInstance } from 'axios';

// API endpoint configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:9000';

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
  HTML = 'html'
}

export interface Deliverable {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: DeliverableType;
  format: DeliverableFormat;
  description?: string;
  conversation_id?: string;
  message_id?: string;
  created_by_agent?: string;
  parent_deliverable_id?: string;
  version: number;
  is_latest_version: boolean;
  metadata: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DeliverableVersion {
  id: string;
  title: string;
  version: number;
  is_latest_version: boolean;
  created_at: string;
  created_by_agent?: string;
  content_preview: string;
}

export interface CreateDeliverableDto {
  title: string;
  content: string;
  type: DeliverableType;
  format: DeliverableFormat;
  description?: string;
  conversation_id?: string;
  message_id?: string;
  created_by_agent?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface CreateVersionDto {
  title: string;
  content: string;
  metadata?: Record<string, any>;
  created_by_agent?: string;
}

export interface DeliverableFilters {
  type?: DeliverableType;
  format?: DeliverableFormat;
  created_by_agent?: string;
  conversation_id?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  latest_only?: boolean;
}

export interface DeliverableSearchItem {
  id: string;
  title: string;
  type: DeliverableType;
  format: DeliverableFormat;
  version: number;
  is_latest_version: boolean;
  created_at: string;
  updated_at: string;
  created_by_agent?: string;
  content_preview: string;
  tags?: string[];
}

export interface DeliverableSearchResult {
  items: DeliverableSearchItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
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
      timeout: 30000,
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
  async getDeliverables(filters?: DeliverableFilters): Promise<DeliverableSearchResult> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.format) params.append('format', filters.format);
      if (filters.created_by_agent) params.append('created_by_agent', filters.created_by_agent);
      if (filters.conversation_id) params.append('conversation_id', filters.conversation_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
      if (filters.latest_only) params.append('latest_only', filters.latest_only.toString());
    }

    const response = await this.axiosInstance.get(`/deliverables?${params.toString()}`);
    return response.data;
  }

  /**
   * Get a specific deliverable by ID
   */
  async getDeliverable(id: string): Promise<Deliverable> {
    console.log('🎭 deliverablesService.getDeliverable called with:', {
      id,
      idType: typeof id,
      idValue: JSON.stringify(id),
      isUndefined: id === undefined,
      isNull: id === null,
      isEmpty: id === '',
      url: `/deliverables/${id}`
    });
    
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
  async createVersion(parentId: string, data: CreateVersionDto): Promise<Deliverable> {
    const response = await this.axiosInstance.post(`/deliverables/${parentId}/versions`, data);
    return response.data;
  }

  /**
   * Update an existing deliverable
   */
  async updateDeliverable(id: string, updates: Partial<CreateDeliverableDto>): Promise<Deliverable> {
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
  async getVersions(parentId: string): Promise<DeliverableVersion[]> {
    const response = await this.axiosInstance.get(`/deliverables/${parentId}/versions`);
    return response.data;
  }

  /**
   * Search deliverables with advanced query options
   */
  async searchDeliverables(query: string, filters?: Omit<DeliverableFilters, 'search'>): Promise<DeliverableSearchResult> {
    return this.getDeliverables({ ...filters, search: query });
  }

  /**
   * Get deliverables for a specific conversation
   */
  async getConversationDeliverables(conversationId: string): Promise<DeliverableSearchItem[]> {
    const response = await this.axiosInstance.get(`/deliverables/conversation/${conversationId}`);
    // Backend returns full Deliverable[]; map to search items shape for callers that expect previews
    const items = (response.data as Deliverable[]).map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      format: d.format,
      version: d.version,
      is_latest_version: d.is_latest_version,
      created_at: d.created_at,
      updated_at: d.updated_at,
      created_by_agent: d.created_by_agent,
      content_preview: (d.content || '').substring(0, 200) + ((d.content || '').length > 200 ? '...' : ''),
      tags: d.tags,
    }));
    return items;
  }

  /**
   * Get deliverables created by a specific agent
   */
  async getAgentDeliverables(agentName: string): Promise<DeliverableSearchItem[]> {
    const result = await this.getDeliverables({ created_by_agent: agentName });
    return result.items;
  }

  /**
   * Check if a deliverable exists for the current conversation/task context
   * This helps with enhancement workflows
   */
  async findExistingDeliverable(conversationId: string, messageId?: string): Promise<Deliverable | null> {
    const filters: DeliverableFilters = { conversation_id: conversationId };
    if (messageId) {
      // We'll need to get full deliverable details to check metadata since search results don't include full metadata
      const result = await this.getDeliverables(filters);
      for (const item of result.items) {
        const fullDeliverable = await this.getDeliverable(item.id);
        if (fullDeliverable.message_id === messageId || 
            fullDeliverable.metadata?.messageId === messageId ||
            fullDeliverable.metadata?.taskId === messageId) {
          return fullDeliverable;
        }
      }
      return null;
    }
    
    const result = await this.getDeliverables(filters);
    if (result.items.length > 0) {
      // Return the full deliverable details for the most recent one
      return this.getDeliverable(result.items[0].id);
    }
    return null;
  }
}

// Export singleton instance
export const deliverablesService = new DeliverablesService();