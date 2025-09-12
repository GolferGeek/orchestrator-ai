import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import {
  Project,
  ProjectStep,
  PlanDefinition,
  ProjectStatus,
  ProjectWebSocketMessage,
} from '@/orchestration/orchestration.types';

export interface CreateProjectDto {
  name?: string;
  description?: string;
  conversationId: string;
  planJson?: PlanDefinition;
  // Hierarchical project support
  parentProjectId?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  planJson?: PlanDefinition;
  currentStepId?: string;
  errorDetails?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ProjectRecoveryDto {
  reason?: string;
  targetStepId?: string;
  metadata?: Record<string, any>;
}

export interface ProjectQueryDto {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Create a new project
   */
  @Post()
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: any,
  ): Promise<Project> {
    try {

      if (!createProjectDto.conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      return await this.projectsService.createProject({
        ...createProjectDto,
        userId: user.id,
      });
    } catch (error) {

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create project');
    }
  }

  /**
   * Get all projects for the current user
   */
  @Get()
  async getProjects(
    @Query() query: ProjectQueryDto,
    @CurrentUser() user: any,
  ): Promise<{
    projects: Project[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      this.logger.debug(`Getting projects for user: ${user?.id}, query: ${JSON.stringify(query)}`);

      const {
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;

      return await this.projectsService.getUserProjects(user.id, {
        status: query.status,
        limit: Math.min(limit, 100), // Cap at 100
        offset: Math.max(offset, 0),
        sortBy,
        sortOrder,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get projects for user ${user?.id}: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to get projects');
    }
  }

  /**
   * Get a specific project by ID
   */
  @Get(':id')
  async getProject(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<Project> {
    try {

      const project = await this.projectsService.getProject(projectId);

      if (!project) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return project;
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project');
    }
  }

  /**
   * Update a project
   */
  @Put(':id')
  async updateProject(
    @Param('id') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: any,
  ): Promise<Project> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.updateProject(
        projectId,
        updateProjectDto,
      );
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update project');
    }
  }

  /**
   * Delete a project
   */
  @Delete(':id')
  async deleteProject(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      await this.projectsService.deleteProject(projectId);

      return {
        success: true,
        message: `Project ${projectId} deleted successfully`,
      };
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete project');
    }
  }

  /**
   * Get subprojects for a given project
   */
  @Get(':id/subprojects')
  async getSubprojects(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<Project[]> {
    try {
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getSubprojects(projectId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get subprojects');
    }
  }

  /**
   * Get project steps
   */
  @Get(':id/steps')
  async getProjectSteps(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<ProjectStep[]> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectSteps(projectId);
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project steps');
    }
  }

  /**
   * Get project history and timeline
   */
  @Get(':id/history')
  async getProjectHistory(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<{
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

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectHistory(projectId);
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project history');
    }
  }

  /**
   * Resume a paused project
   */
  @Post(':id/resume')
  async resumeProject(
    @Param('id') projectId: string,
    @Body() recoveryDto: ProjectRecoveryDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      await this.projectsService.resumeProject(projectId, recoveryDto);

      return {
        success: true,
        message: `Project ${projectId} resumed successfully`,
      };
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to resume project');
    }
  }

  /**
   * Retry a failed project step
   */
  @Post(':id/retry')
  async retryProject(
    @Param('id') projectId: string,
    @Body() recoveryDto: ProjectRecoveryDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      await this.projectsService.retryProject(projectId, recoveryDto);

      return {
        success: true,
        message: `Project ${projectId} retry initiated successfully`,
      };
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retry project');
    }
  }

  /**
   * Fork a project (create a copy from a specific checkpoint)
   */
  @Post(':id/fork')
  async forkProject(
    @Param('id') projectId: string,
    @Body() forkDto: ProjectRecoveryDto & { newName?: string },
    @CurrentUser() user: any,
  ): Promise<Project> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.forkProject(projectId, forkDto);
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fork project');
    }
  }

  /**
   * Abort a running project
   */
  @Post(':id/abort')
  async abortProject(
    @Param('id') projectId: string,
    @Body() abortDto: ProjectRecoveryDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    try {

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      await this.projectsService.abortProject(projectId, abortDto);

      return {
        success: true,
        message: `Project ${projectId} aborted successfully`,
      };
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to abort project');
    }
  }

  /**
   * Get general project analytics metrics
   */
  @Get('analytics/metrics')
  async getProjectAnalyticsMetrics(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
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
      // Get date range
      const now = new Date();
      const start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : now;

      return await this.projectsService.getProjectMetrics(user.id, start, end);
    } catch (error) {
      this.logger.error('Failed to get project analytics metrics', error);
      throw new InternalServerErrorException('Failed to get project analytics metrics');
    }
  }

  /**
   * Get project hierarchy path for breadcrumb navigation
   */
  @Get(':id/hierarchy-path')
  async getProjectHierarchyPath(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<Array<{
    id: string;
    name: string;
    level: number;
  }>> {
    try {
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectHierarchyPath(projectId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project hierarchy path');
    }
  }

  /**
   * Get project analytics and progress metrics
   */
  @Get(':id/analytics')
  async getProjectAnalytics(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ): Promise<{
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

      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectAnalytics(projectId);
    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project analytics');
    }
  }
}
