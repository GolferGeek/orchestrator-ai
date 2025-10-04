import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { TaskProgressGateway } from '@/agent-platform/websocket/task-progress.gateway';
import {
  Project,
  ProjectStep,
  PlanDefinition,
  ProjectStatus,
  ProjectWebSocketMessage,
} from '@/agent2agent/orchestration/orchestration.types';
import { getTableName } from '@/supabase/supabase.config';

export interface CreateProjectParams {
  name?: string;
  description?: string;
  conversationId: string;
  userId: string;
  planJson?: PlanDefinition;
  // Hierarchical project support
  parentProjectId?: string;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  planJson?: PlanDefinition;
  currentStepId?: string;
  errorDetails?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ProjectQueryParams {
  status?: ProjectStatus;
  limit: number;
  offset: number;
  sortBy: 'created_at' | 'updated_at' | 'name';
  sortOrder: 'asc' | 'desc';
}

export interface ProjectRecoveryParams {
  reason?: string;
  targetStepId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly taskProgressGateway: TaskProgressGateway,
  ) {}

  /**
   * Create a new project
   */
  async createProject(params: CreateProjectParams): Promise<Project> {
    const client = this.supabaseService.getServiceClient();

    // Calculate hierarchy level if parent project exists
    let hierarchyLevel = 0;
    if (params.parentProjectId) {
      const { data: parentProject, error: parentError } = await client
        .from(getTableName('projects'))
        .select('hierarchy_level')
        .eq('id', params.parentProjectId)
        .single();

      if (parentError) {
        throw new Error(
          `Failed to create subproject: Parent project not found`,
        );
      }

      hierarchyLevel = (parentProject?.hierarchy_level || 0) + 1;
    }

    const projectData: any = {
      name: params.name || `Project ${new Date().toISOString().split('T')[0]}`,
      description: params.description,
      conversation_id: params.conversationId,
      plan_json: params.planJson || null,
      status: 'planning' as ProjectStatus,
      metadata: {
        createdBy: params.userId,
        createdAt: new Date().toISOString(),
      },
    };

    // Add hierarchical fields if parent project is specified
    if (params.parentProjectId) {
      projectData.parent_project_id = params.parentProjectId;
      projectData.hierarchy_level = hierarchyLevel;
      projectData.subproject_count = 0; // Initialize with 0, trigger will maintain count
    }

    const { data, error } = await client
      .from(getTableName('projects'))
      .insert(projectData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    const project = this.mapDatabaseToProject(data);

    // Emit WebSocket event
    this.emitProjectEvent({
      type: 'project.status.changed',
      projectId: project.id,
      status: project.status,
      message: 'Project created',
      timestamp: new Date().toISOString(),
    });

    return project;
  }

  /**
   * Get projects for a user
   */
  async getUserProjects(
    userId: string,
    params: ProjectQueryParams,
  ): Promise<{
    projects: Project[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const client = this.supabaseService.getServiceClient();

    // First, get conversation IDs for this user
    const { data: conversations, error: convError } = await client
      .from(getTableName('conversations'))
      .select('id')
      .eq('user_id', userId);

    if (convError) {
      this.logger.error(
        `Failed to get conversations for user: ${convError.message}`,
      );
      throw new Error(`Failed to get user conversations: ${convError.message}`);
    }

    const conversationIds = (conversations || []).map((c) => c.id);

    // If user has no conversations, return empty result
    if (conversationIds.length === 0) {
      return {
        projects: [],
        total: 0,
        limit: params.limit,
        offset: params.offset,
      };
    }

    // Now get projects for those conversations
    let query = client
      .from(getTableName('projects'))
      .select('*', { count: 'exact' })
      .in('conversation_id', conversationIds);

    // Filter by status if provided
    if (params.status) {
      query = query.eq('status', params.status);
    }

    // Add sorting
    query = query.order(params.sortBy, {
      ascending: params.sortOrder === 'asc',
    });

    // Add pagination
    query = query.range(params.offset, params.offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }

    return {
      projects: (data || []).map(this.mapDatabaseToProject),
      total: count || 0,
      limit: params.limit,
      offset: params.offset,
    };
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data, error } = await client
        .from(getTableName('projects'))
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }

        throw new Error(`Failed to get project: ${error.message}`);
      }

      return this.mapDatabaseToProject(data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: string,
    params: UpdateProjectParams,
  ): Promise<Project> {
    const client = this.supabaseService.getServiceClient();

    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updateData.name = params.name;
      if (params.description !== undefined)
        updateData.description = params.description;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.planJson !== undefined) updateData.plan_json = params.planJson;
      if (params.currentStepId !== undefined)
        updateData.current_step_id = params.currentStepId;
      if (params.errorDetails !== undefined)
        updateData.error_details = params.errorDetails;
      if (params.metadata !== undefined) updateData.metadata = params.metadata;

      const { data, error } = await client
        .from(getTableName('projects'))
        .update(updateData)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update project: ${error.message}`);
      }

      const project = this.mapDatabaseToProject(data);

      // Emit WebSocket event if status changed
      if (params.status) {
        this.emitProjectEvent({
          type: 'project.status.changed',
          projectId: project.id,
          status: project.status,
          message: `Project status changed to ${params.status}`,
          timestamp: new Date().toISOString(),
        });
      }

      return project;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { error } = await client
        .from(getTableName('projects'))
        .delete()
        .eq('id', projectId);

      if (error) {
        throw new Error(`Failed to delete project: ${error.message}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user has access to a project
   */
  async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data, error } = await client
        .from(getTableName('projects'))
        .select('id, conversations!inner(user_id)')
        .eq('id', projectId)
        .eq('conversations.user_id', userId)
        .single();

      if (error) {
        return false;
      }

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Get project steps
   */
  async getProjectSteps(projectId: string): Promise<ProjectStep[]> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data, error } = await client
        .from(getTableName('project_steps'))
        .select('*')
        .eq('project_id', projectId)
        .order('step_index', { ascending: true });

      if (error) {
        throw new Error(`Failed to get project steps: ${error.message}`);
      }

      return (data || []).map(this.mapDatabaseToProjectStep);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subprojects for a given project
   */
  async getSubprojects(projectId: string): Promise<Project[]> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data, error } = await client
        .from(getTableName('projects'))
        .select('*')
        .eq('parent_project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(`Failed to get subprojects: ${error.message}`);
        return [];
      }

      return (data || []).map((row) => this.mapDatabaseToProject(row));
    } catch (error) {
      this.logger.error('Failed to get subprojects', error);
      return [];
    }
  }

  /**
   * Get project history
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
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      const steps = await this.getProjectSteps(projectId);

      // Build timeline from project and step events
      const timeline: Array<{
        timestamp: string;
        type: 'project' | 'step';
        event: string;
        details: Record<string, any>;
      }> = [];

      // Add project events
      timeline.push({
        timestamp: project.createdAt.toISOString(),
        type: 'project',
        event: 'Project created',
        details: {
          name: project.name,
          status: 'planning',
        },
      });

      if (project.planJson) {
        timeline.push({
          timestamp: project.updatedAt.toISOString(),
          type: 'project',
          event: 'Plan created',
          details: {
            stepCount: project.planJson.steps.length,
          },
        });
      }

      // Add step events
      steps.forEach((step) => {
        if (step.startedAt) {
          timeline.push({
            timestamp: step.startedAt.toISOString(),
            type: 'step',
            event: 'Step started',
            details: {
              stepId: step.stepId,
              stepName: step.stepName,
              agentName: step.agentName,
            },
          });
        }

        if (step.completedAt) {
          timeline.push({
            timestamp: step.completedAt.toISOString(),
            type: 'step',
            event:
              step.status === 'completed' ? 'Step completed' : 'Step failed',
            details: {
              stepId: step.stepId,
              stepName: step.stepName,
              status: step.status,
            },
          });
        }
      });

      // Sort timeline by timestamp
      timeline.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      return { project, steps, timeline };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resume a paused project
   */
  async resumeProject(
    projectId: string,
    params: ProjectRecoveryParams,
  ): Promise<void> {
    try {
      await this.updateProject(projectId, {
        status: 'running',
        errorDetails: undefined,
        metadata: {
          resumedAt: new Date().toISOString(),
          resumeReason: params.reason || 'Manual resume',
          ...params.metadata,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retry a failed project
   */
  async retryProject(
    projectId: string,
    params: ProjectRecoveryParams,
  ): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      // Reset to the target step or current step
      const targetStepId = params.targetStepId || project.currentStepId;

      await this.updateProject(projectId, {
        status: 'running',
        currentStepId: targetStepId,
        errorDetails: undefined,
        metadata: {
          retriedAt: new Date().toISOString(),
          retryReason: params.reason || 'Manual retry',
          ...params.metadata,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fork a project (create a copy from a specific checkpoint)
   */
  async forkProject(
    projectId: string,
    params: ProjectRecoveryParams & { newName?: string },
  ): Promise<Project> {
    try {
      const originalProject = await this.getProject(projectId);
      if (!originalProject) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      // Create new project as a fork
      const forkedProject = await this.createProject({
        name: params.newName || `${originalProject.name} (Fork)`,
        description: `Fork of ${originalProject.name}${params.reason ? ` - ${params.reason}` : ''}`,
        conversationId: originalProject.conversationId,
        userId: originalProject.metadata.createdBy,
        planJson: originalProject.planJson,
      });

      return forkedProject;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Abort a running project
   */
  async abortProject(
    projectId: string,
    params: ProjectRecoveryParams,
  ): Promise<void> {
    try {
      await this.updateProject(projectId, {
        status: 'aborted',
        metadata: {
          abortedAt: new Date().toISOString(),
          abortReason: params.reason || 'Manual abort',
          ...params.metadata,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get project metrics for analytics
   */
  async getProjectMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    failedProjects: number;
    averageCompletionTime: number;
    successRate: number;
    projectsByStatus: Record<string, number>;
    recentActivity: Array<{
      projectId: string;
      name: string;
      status: string;
      lastActivity: string;
    }>;
  }> {
    try {
      // Get user projects within date range - use service client for admin analytics
      const { data: projects, error } = await this.supabaseService
        .getServiceClient()
        .from('projects')
        .select('*, conversations!inner(user_id)')
        .eq('conversations.user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        this.logger.error('Failed to fetch projects for metrics:', error);
        // Return empty metrics instead of throwing error
        return {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          failedProjects: 0,
          averageCompletionTime: 0,
          successRate: 100,
          projectsByStatus: {},
          recentActivity: [],
        };
      }

      const projectList = projects || [];

      // Calculate metrics
      const totalProjects = projectList.length;
      const activeProjects = projectList.filter((p) =>
        ['active', 'in_progress', 'running'].includes(p.status),
      ).length;
      const completedProjects = projectList.filter(
        (p) => p.status === 'completed',
      ).length;
      const failedProjects = projectList.filter((p) =>
        ['failed', 'aborted', 'error'].includes(p.status),
      ).length;

      const successRate =
        totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 100;

      // Calculate average completion time for completed projects
      const completedProjectsWithTimes = projectList.filter(
        (p) => p.status === 'completed' && p.created_at && p.updated_at,
      );

      const averageCompletionTime =
        completedProjectsWithTimes.length > 0
          ? completedProjectsWithTimes.reduce((sum, project) => {
              const created = new Date(project.created_at).getTime();
              const updated = new Date(project.updated_at).getTime();
              return sum + (updated - created);
            }, 0) / completedProjectsWithTimes.length
          : 0;

      // Group projects by status
      const projectsByStatus = projectList.reduce(
        (acc, project) => {
          acc[project.status] = (acc[project.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Get recent activity (last 5 projects)
      const recentActivity = projectList
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 5)
        .map((project) => ({
          projectId: project.id,
          name: project.name || 'Unnamed Project',
          status: project.status,
          lastActivity: project.updated_at,
        }));

      return {
        totalProjects,
        activeProjects,
        completedProjects,
        failedProjects,
        averageCompletionTime: Math.round(averageCompletionTime),
        successRate: Math.round(successRate * 100) / 100,
        projectsByStatus,
        recentActivity,
      };
    } catch (error) {
      this.logger.error('Error calculating project metrics:', error);
      throw error;
    }
  }

  /**
   * Get project analytics
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
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      const steps = await this.getProjectSteps(projectId);

      // Calculate step progress
      const stepProgress = steps.map((step) => ({
        stepId: step.stepId,
        stepName: step.stepName,
        status: step.status,
        duration:
          step.startedAt && step.completedAt
            ? new Date(step.completedAt).getTime() -
              new Date(step.startedAt).getTime()
            : undefined,
        startedAt: step.startedAt?.toISOString(),
        completedAt: step.completedAt?.toISOString(),
      }));

      // Calculate overall progress
      const completedSteps = steps.filter(
        (s) => s.status === 'completed',
      ).length;
      const overallProgress =
        steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

      // Calculate performance metrics
      const durations = stepProgress
        .filter((s) => s.duration !== undefined)
        .map((s) => s.duration!);

      const avgStepDuration =
        durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0;

      const totalDuration =
        project.createdAt && project.updatedAt
          ? new Date(project.updatedAt).getTime() -
            new Date(project.createdAt).getTime()
          : 0;

      const failedSteps = steps.filter((s) => s.status === 'failed').length;
      const errorRate =
        steps.length > 0 ? (failedSteps / steps.length) * 100 : 0;

      const throughput =
        totalDuration > 0
          ? completedSteps / (totalDuration / (1000 * 60 * 60))
          : 0; // steps per hour

      // Identify bottlenecks
      const bottlenecks: Array<{
        stepId: string;
        stepName: string;
        issue: string;
        impact: 'low' | 'medium' | 'high';
      }> = [];

      steps.forEach((step) => {
        if (step.status === 'failed') {
          bottlenecks.push({
            stepId: step.stepId,
            stepName: step.stepName,
            issue: 'Step failed',
            impact: 'high',
          });
        }
      });

      // Generate recommendations
      const recommendations: string[] = [];

      if (errorRate > 20) {
        recommendations.push(
          'High error rate detected. Review step configurations and agent capabilities.',
        );
      }

      if (avgStepDuration > 300000) {
        // 5 minutes
        recommendations.push(
          'Steps are taking longer than expected. Consider optimizing agent prompts.',
        );
      }

      if (bottlenecks.length > 2) {
        recommendations.push(
          'Multiple bottlenecks identified. Review project plan and dependencies.',
        );
      }

      return {
        overallProgress,
        stepProgress,
        performance: {
          avgStepDuration,
          totalDuration,
          errorRate,
          throughput,
        },
        bottlenecks,
        recommendations,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Emit project WebSocket event
   */
  private emitProjectEvent(message: ProjectWebSocketMessage): void {
    try {
      // Emit to project-specific room
      this.taskProgressGateway.server
        .to(`project:${message.projectId}`)
        .emit('project_event', message);

      // Also emit to general project updates room
      this.taskProgressGateway.server
        .to('projects')
        .emit('project_event', message);
    } catch {
      // Silently ignore errors in websocket emission
    }
  }

  /**
   * Map database row to Project entity
   */
  private mapDatabaseToProject(data: any): Project {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      name: data.name,
      description: data.description,
      planJson: data.plan_json,
      status: data.status,
      currentStepId: data.current_step_id,
      errorDetails: data.error_details,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      // Hierarchical project support
      parentProjectId: data.parent_project_id || undefined,
      hierarchyLevel: data.hierarchy_level || 0,
      subprojectCount: data.subproject_count || 0,
    };
  }

  /**
   * Get project hierarchy path for breadcrumb navigation
   */
  async getProjectHierarchyPath(
    projectId: string,
  ): Promise<Array<{ id: string; name: string; level: number }>> {
    const client = this.supabaseService.getServiceClient();
    const path: Array<{ id: string; name: string; level: number }> = [];

    let currentProjectId: string | null = projectId;
    let level = 0;

    // Walk up the hierarchy
    while (currentProjectId) {
      const result: any = await client
        .from(getTableName('projects'))
        .select('id, name, parent_project_id')
        .eq('id', currentProjectId)
        .single();

      if (result.error || !result.data) {
        break;
      }

      // Add to beginning of path (since we're walking up)
      path.unshift({
        id: result.data.id,
        name: result.data.name || `Project ${level + 1}`,
        level,
      });

      currentProjectId = result.data.parent_project_id;
      level++;
    }

    return path;
  }

  /**
   * Map database row to ProjectStep entity
   */
  private mapDatabaseToProjectStep(data: any): ProjectStep {
    return {
      id: data.id,
      projectId: data.project_id,
      stepId: data.step_id,
      stepIndex: data.step_index,
      stepType: data.step_type,
      stepName: data.step_name,
      agentName: data.agent_name,
      prompt: data.prompt,
      dependencies: data.dependencies || [],
      status: data.status,
      result: data.result,
      errorDetails: data.error_details,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
