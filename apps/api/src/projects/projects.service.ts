import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import {
  Project,
  ProjectStep,
  PlanDefinition,
  ProjectStatus,
  ProjectStepStatus,
  ProjectWebSocketMessage,
} from '@/orchestration/orchestration.types';

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
    
    try {
      // Calculate hierarchy level if parent project exists
      let hierarchyLevel = 0;
      if (params.parentProjectId) {
        const { data: parentProject, error: parentError } = await client
          .from('projects')
          .select('hierarchy_level')
          .eq('id', params.parentProjectId)
          .single();
          
        if (parentError) {
          this.logger.error('Failed to fetch parent project for hierarchy calculation:', parentError);
          throw new Error(`Failed to create subproject: Parent project not found`);
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
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create project:', error);
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

      this.logger.log(`Created project ${project.id} for user ${params.userId}`);
      return project;
    } catch (error) {
      this.logger.error('Failed to create project:', error);
      throw error;
    }
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
    
    try {
      let query = client
        .from('projects')
        .select('*, agent_conversations!inner(user_id)', { count: 'exact' })
        .eq('agent_conversations.user_id', userId);

      // Filter by status if provided
      if (params.status) {
        query = query.eq('status', params.status);
      }

      // Add sorting
      query = query.order(params.sortBy, { ascending: params.sortOrder === 'asc' });

      // Add pagination
      query = query.range(params.offset, params.offset + params.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Failed to get user projects:', error);
        throw new Error(`Failed to get projects: ${error.message}`);
      }

      return {
        projects: (data || []).map(this.mapDatabaseToProject),
        total: count || 0,
        limit: params.limit,
        offset: params.offset,
      };
    } catch (error) {
      this.logger.error('Failed to get user projects:', error);
      throw error;
    }
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const client = this.supabaseService.getServiceClient();
    
    try {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        this.logger.error(`Failed to get project ${projectId}:`, error);
        throw new Error(`Failed to get project: ${error.message}`);
      }

      return this.mapDatabaseToProject(data);
    } catch (error) {
      this.logger.error(`Failed to get project ${projectId}:`, error);
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
      if (params.description !== undefined) updateData.description = params.description;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.planJson !== undefined) updateData.plan_json = params.planJson;
      if (params.currentStepId !== undefined) updateData.current_step_id = params.currentStepId;
      if (params.errorDetails !== undefined) updateData.error_details = params.errorDetails;
      if (params.metadata !== undefined) updateData.metadata = params.metadata;

      const { data, error } = await client
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to update project ${projectId}:`, error);
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

      this.logger.log(`Updated project ${projectId}`);
      return project;
    } catch (error) {
      this.logger.error(`Failed to update project ${projectId}:`, error);
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
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        this.logger.error(`Failed to delete project ${projectId}:`, error);
        throw new Error(`Failed to delete project: ${error.message}`);
      }

      this.logger.log(`Deleted project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to delete project ${projectId}:`, error);
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
        .from('projects')
        .select('id, agent_conversations!inner(user_id)')
        .eq('id', projectId)
        .eq('agent_conversations.user_id', userId)
        .single();

      if (error) {
        return false;
      }

      return !!data;
    } catch (error) {
      this.logger.error(`Failed to check project access for ${projectId}:`, error);
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
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .order('step_index', { ascending: true });

      if (error) {
        this.logger.error(`Failed to get project steps for ${projectId}:`, error);
        throw new Error(`Failed to get project steps: ${error.message}`);
      }

      return (data || []).map(this.mapDatabaseToProjectStep);
    } catch (error) {
      this.logger.error(`Failed to get project steps for ${projectId}:`, error);
      throw error;
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
            event: step.status === 'completed' ? 'Step completed' : 'Step failed',
            details: {
              stepId: step.stepId,
              stepName: step.stepName,
              status: step.status,
            },
          });
        }
      });

      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return { project, steps, timeline };
    } catch (error) {
      this.logger.error(`Failed to get project history for ${projectId}:`, error);
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

      this.logger.log(`Resumed project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to resume project ${projectId}:`, error);
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

      this.logger.log(`Retrying project ${projectId} from step ${targetStepId}`);
    } catch (error) {
      this.logger.error(`Failed to retry project ${projectId}:`, error);
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

      this.logger.log(`Forked project ${projectId} to ${forkedProject.id}`);
      return forkedProject;
    } catch (error) {
      this.logger.error(`Failed to fork project ${projectId}:`, error);
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

      this.logger.log(`Aborted project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to abort project ${projectId}:`, error);
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
        duration: step.startedAt && step.completedAt
          ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
          : undefined,
        startedAt: step.startedAt?.toISOString(),
        completedAt: step.completedAt?.toISOString(),
      }));

      // Calculate overall progress
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const overallProgress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

      // Calculate performance metrics
      const durations = stepProgress
        .filter(s => s.duration !== undefined)
        .map(s => s.duration!);
      
      const avgStepDuration = durations.length > 0 
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
        : 0;
      
      const totalDuration = project.createdAt && project.updatedAt
        ? new Date(project.updatedAt).getTime() - new Date(project.createdAt).getTime()
        : 0;

      const failedSteps = steps.filter(s => s.status === 'failed').length;
      const errorRate = steps.length > 0 ? (failedSteps / steps.length) * 100 : 0;
      
      const throughput = totalDuration > 0 ? completedSteps / (totalDuration / (1000 * 60 * 60)) : 0; // steps per hour

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
        recommendations.push('High error rate detected. Review step configurations and agent capabilities.');
      }
      
      if (avgStepDuration > 300000) { // 5 minutes
        recommendations.push('Steps are taking longer than expected. Consider optimizing agent prompts.');
      }
      
      if (bottlenecks.length > 2) {
        recommendations.push('Multiple bottlenecks identified. Review project plan and dependencies.');
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
      this.logger.error(`Failed to get project analytics for ${projectId}:`, error);
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
    } catch (error) {
      this.logger.error('Failed to emit project event:', error);
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