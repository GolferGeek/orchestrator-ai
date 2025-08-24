import { apiService } from './apiService';
// Types matching the backend API
export interface Project {
  id: string;
  conversationId: string;
  name?: string;
  description?: string;
  planJson?: any;
  status: 'planning' | 'running' | 'paused_for_human' | 'paused_on_error' | 'completed' | 'aborted';
  currentStepId?: string;
  errorDetails?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  // Hierarchical project support
  parentProjectId?: string;
  hierarchyLevel?: number;
  subprojectCount?: number;
}
export interface ProjectStep {
  id: string;
  projectId: string;
  stepId: string;
  stepIndex: number;
  stepType: 'agent_step' | 'human_approval';
  stepName: string;
  agentName?: string;
  prompt?: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  errorDetails?: any;
  startedAt?: string;
  completedAt?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}
export interface CreateProjectDto {
  name?: string;
  description?: string;
  conversationId: string;
  planJson?: any;
  // Hierarchical project support
  parentProjectId?: string;
}
export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: Project['status'];
  planJson?: any;
  currentStepId?: string;
  errorDetails?: any;
  metadata?: any;
}
export interface ProjectQueryDto {
  status?: Project['status'];
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
  // Hierarchical filtering
  parentProjectId?: string;
  hierarchyLevel?: number;
  includeSubprojects?: boolean;
}
export interface ProjectsResponse {
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}
export interface ProjectHierarchyNode {
  id: string;
  name?: string;
  hierarchyLevel: number;
}
export interface ProjectWithHierarchy extends Project {
  hierarchyPath?: ProjectHierarchyNode[];
  subprojects?: Project[];
}
export class ProjectsService {
  private baseUrl = '/projects';
  /**
   * Get all projects for the current user
   */
  async getProjects(query?: ProjectQueryDto): Promise<ProjectsResponse> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);
    // Hierarchical filtering
    if (query?.parentProjectId) params.append('parentProjectId', query.parentProjectId);
    if (query?.hierarchyLevel !== undefined) params.append('hierarchyLevel', query.hierarchyLevel.toString());
    if (query?.includeSubprojects) params.append('includeSubprojects', 'true');
    const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
    const response = await apiService.get(url);
    // TEMPORARY FIX: If apiService.get is returning the projects data directly instead of response.data
    if (response && response.projects && !response.data) {
      return response; // Return the projects data directly
    }
    return response.data;
  }
  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${projectId}`);
      // TEMPORARY FIX: If apiService.get is returning the project directly instead of response.data
      if (response && response.id && !response.data) {
        return response; // Return the project object directly
      }
      if (response.data) {
        return response.data;
      }

      throw new Error('Invalid API response format for getProject');
    } catch (error) {

      throw error;
    }
  }
  /**
   * Create a new project
   */
  async createProject(data: CreateProjectDto): Promise<Project> {
    try {
      const response = await apiService.post(this.baseUrl, data);
      // TEMPORARY FIX: If apiService.post is returning the project directly instead of response.data
      if (response && response.id && !response.data) {
        return response; // Return the project object directly
      }
      if (response.data) {
        return response.data;
      }

      throw new Error('Invalid API response format');
    } catch (error) {

      throw error;
    }
  }
  /**
   * Update a project
   */
  async updateProject(projectId: string, data: UpdateProjectDto): Promise<Project> {
    const response = await apiService.put(`${this.baseUrl}/${projectId}`, data);
    return response.data;
  }
  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete(`${this.baseUrl}/${projectId}`);
    return response.data;
  }
  /**
   * Get project steps
   */
  async getProjectSteps(projectId: string): Promise<ProjectStep[]> {
    const response = await apiService.get(`${this.baseUrl}/${projectId}/steps`);
    return response.data;
  }
  /**
   * Get project history and timeline
   */
  async getProjectHistory(projectId: string): Promise<{
    project: Project;
    steps: ProjectStep[];
    timeline: Array<{
      timestamp: string;
      type: 'project' | 'step';
      event: string;
      details: Record<string, any>;
    }>;
  }> {
    const response = await apiService.get(`${this.baseUrl}/${projectId}/history`);
    return response.data;
  }
  /**
   * Resume a paused project
   */
  async resumeProject(projectId: string, options?: {
    reason?: string;
    targetStepId?: string;
    metadata?: any;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post(`${this.baseUrl}/${projectId}/resume`, options || {});
    return response.data;
  }
  /**
   * Retry a failed project
   */
  async retryProject(projectId: string, options?: {
    reason?: string;
    targetStepId?: string;
    metadata?: any;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post(`${this.baseUrl}/${projectId}/retry`, options || {});
    return response.data;
  }
  /**
   * Fork a project (create a copy from a specific checkpoint)
   */
  async forkProject(projectId: string, options?: {
    newName?: string;
    reason?: string;
    targetStepId?: string;
    metadata?: any;
  }): Promise<Project> {
    const response = await apiService.post(`${this.baseUrl}/${projectId}/fork`, options || {});
    return response.data;
  }
  /**
   * Abort a running project
   */
  async abortProject(projectId: string, options?: {
    reason?: string;
    metadata?: any;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post(`${this.baseUrl}/${projectId}/abort`, options || {});
    return response.data;
  }
  /**
   * Get project analytics and progress metrics
   */
  async getProjectAnalytics(projectId: string): Promise<{
    overallProgress: number;
    stepProgress: Array<{
      stepId: string;
      stepName: string;
      status: string;
      duration?: number;
      startedAt?: string;
      completedAt?: string;
    }>;
    performance: {
      avgStepDuration: number;
      totalDuration: number;
      errorRate: number;
      throughput: number;
    };
    bottlenecks: Array<{
      stepId: string;
      stepName: string;
      issue: string;
      impact: 'low' | 'medium' | 'high';
    }>;
    recommendations: string[];
  }> {
    const response = await apiService.get(`${this.baseUrl}/${projectId}/analytics`);
    return response.data;
  }
  // ============================================================================
  // HIERARCHICAL PROJECT METHODS
  // ============================================================================
  /**
   * Get subprojects of a parent project
   */
  async getSubprojects(parentProjectId: string): Promise<Project[]> {
    const response = await this.getProjects({ parentProjectId });
    return response.projects;
  }
  /**
   * Get root projects (top-level, no parent)
   */
  async getRootProjects(query?: Omit<ProjectQueryDto, 'parentProjectId'>): Promise<ProjectsResponse> {
    return this.getProjects({
      ...query,
      hierarchyLevel: 0,
    });
  }
  /**
   * Get project hierarchy path (breadcrumb trail)
   */
  async getProjectHierarchyPath(projectId: string): Promise<ProjectHierarchyNode[]> {
    const response = await apiService.get(`${this.baseUrl}/${projectId}/hierarchy-path`);
    return response.data;
  }
  /**
   * Get project with full hierarchy context
   */
  async getProjectWithHierarchy(projectId: string): Promise<ProjectWithHierarchy> {
    const response = await apiService.get(`${this.baseUrl}/${projectId}/with-hierarchy`);
    return response.data;
  }
  /**
   * Create a subproject under a parent project
   */
  async createSubproject(parentProjectId: string, data: Omit<CreateProjectDto, 'parentProjectId'>): Promise<Project> {
    return this.createProject({
      ...data,
      parentProjectId,
    });
  }
  /**
   * Get project tree structure starting from a root project
   */
  async getProjectTree(rootProjectId: string): Promise<ProjectWithHierarchy> {
    const response = await apiService.get(`${this.baseUrl}/${rootProjectId}/tree`);
    return response.data;
  }
  /**
   * Move project to different parent (reparent)
   */
  async moveProject(projectId: string, newParentProjectId?: string): Promise<Project> {
    const response = await apiService.put(`${this.baseUrl}/${projectId}/move`, {
      parentProjectId: newParentProjectId,
    });
    return response.data;
  }
  /**
   * Get hierarchical project statistics
   */
  async getHierarchyStats(rootProjectId: string): Promise<{
    totalProjects: number;
    maxDepth: number;
    projectsByLevel: Record<number, number>;
    completionStats: {
      completed: number;
      inProgress: number;
      pending: number;
      failed: number;
    };
  }> {
    const response = await apiService.get(`${this.baseUrl}/${rootProjectId}/hierarchy-stats`);
    return response.data;
  }
}
// Export singleton instance
export const projectsService = new ProjectsService();