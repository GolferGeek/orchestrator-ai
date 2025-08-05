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
import { CurrentUser } from '@/auth/current-user.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
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
      this.logger.log(`Creating project for user ${user.id}`);
      
      if (!createProjectDto.conversationId) {
        throw new BadRequestException('conversationId is required');
      }

      return await this.projectsService.createProject({
        ...createProjectDto,
        userId: user.id,
      });
    } catch (error) {
      this.logger.error('Failed to create project:', error);
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
      this.logger.debug(`Getting projects for user ${user.id}`);
      
      const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = query;
      
      return await this.projectsService.getUserProjects(user.id, {
        status: query.status,
        limit: Math.min(limit, 100), // Cap at 100
        offset: Math.max(offset, 0),
        sortBy,
        sortOrder,
      });
    } catch (error) {
      this.logger.error('Failed to get projects:', error);
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
      this.logger.debug(`Getting project ${projectId} for user ${user.id}`);
      
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
      this.logger.error(`Failed to get project ${projectId}:`, error);
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
      this.logger.log(`Updating project ${projectId} for user ${user.id}`);
      
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.updateProject(projectId, updateProjectDto);
    } catch (error) {
      this.logger.error(`Failed to update project ${projectId}:`, error);
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
      this.logger.log(`Deleting project ${projectId} for user ${user.id}`);
      
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
      this.logger.error(`Failed to delete project ${projectId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete project');
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
      this.logger.debug(`Getting steps for project ${projectId}`);
      
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectSteps(projectId);
    } catch (error) {
      this.logger.error(`Failed to get project steps for ${projectId}:`, error);
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
      this.logger.debug(`Getting history for project ${projectId}`);
      
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectHistory(projectId);
    } catch (error) {
      this.logger.error(`Failed to get project history for ${projectId}:`, error);
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
      this.logger.log(`Resuming project ${projectId} for user ${user.id}`);
      
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
      this.logger.error(`Failed to resume project ${projectId}:`, error);
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
      this.logger.log(`Retrying project ${projectId} for user ${user.id}`);
      
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
      this.logger.error(`Failed to retry project ${projectId}:`, error);
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
      this.logger.log(`Forking project ${projectId} for user ${user.id}`);
      
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.forkProject(projectId, forkDto);
    } catch (error) {
      this.logger.error(`Failed to fork project ${projectId}:`, error);
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
      this.logger.log(`Aborting project ${projectId} for user ${user.id}`);
      
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
      this.logger.error(`Failed to abort project ${projectId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to abort project');
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
      this.logger.debug(`Getting analytics for project ${projectId}`);
      
      // Check if user has access to this project
      if (!(await this.projectsService.hasProjectAccess(projectId, user.id))) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }

      return await this.projectsService.getProjectAnalytics(projectId);
    } catch (error) {
      this.logger.error(`Failed to get project analytics for ${projectId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get project analytics');
    }
  }
}