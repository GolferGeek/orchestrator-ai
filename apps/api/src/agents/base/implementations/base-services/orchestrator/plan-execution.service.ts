import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  IPlanExecutionService,
  Project,
  PlanDefinition,
  PlanStep,
  ProjectStatus,
  ProjectStepStatus,
  IDelegationService,
  OrchestratorInput,
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { SupabaseService } from '../../../../../supabase/supabase.service';

/**
 * Plan Execution Service - Real Implementation
 * 
 * Executes project plans by orchestrating step-by-step execution.
 * Handles agent delegation, dependency resolution, and state management.
 * 
 * Instead of complex LangGraph integration, uses direct orchestration approach:
 * 1. Load project steps from database
 * 2. Resolve dependencies and execute steps in order
 * 3. Delegate agent_step types to appropriate agents
 * 4. Handle human_approval interrupts
 * 5. Update project and step statuses in database
 */
@Injectable()
export class PlanExecutionService implements IPlanExecutionService {
  private readonly logger = new Logger(PlanExecutionService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly supabaseService: SupabaseService,
    @Inject('IDelegationService')
    private readonly delegationService: IDelegationService,
  ) {
    this.logger.log('PlanExecutionService initialized with real orchestration engine');
  }

  async startProject(project: Project): Promise<void> {
    this.logger.log(`Starting project execution: ${project.id}`);

    try {
      // Validate project has a plan
      if (!project.planJson) {
        throw new Error(`Project ${project.id} missing planJson - cannot execute without plan`);
      }

      // Load project steps from database
      const steps = await this.loadProjectSteps(project.id);
      if (steps.length === 0) {
        throw new Error(`Project ${project.id} has no steps - cannot execute empty project`);
      }

      // Update project status to running
      await this.updateProjectStatus(project.id, 'running');

      // Start executing steps
      await this.executeNextReadySteps(project.id, steps);

      this.logger.log(`Project ${project.id} execution started successfully`);
    } catch (error) {
      this.logger.error(`Failed to start project ${project.id}:`, error);
      
      // Update project status to error
      await this.updateProjectStatus(project.id, 'paused_on_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorOccurredAt: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  async resumeProject(projectId: string): Promise<void> {
    this.logger.log(`Resuming project execution: ${projectId}`);

    try {
      // Load project and steps
      const project = await this.loadProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const steps = await this.loadProjectSteps(projectId);
      
      // Update project status to running if paused
      if (project.status === 'paused_for_approval' || project.status === 'paused_on_error') {
        await this.updateProjectStatus(projectId, 'running');
      }

      // Continue executing ready steps
      await this.executeNextReadySteps(projectId, steps);

      this.logger.log(`Project ${projectId} resumed successfully`);
    } catch (error) {
      this.logger.error(`Failed to resume project ${projectId}:`, error);
      throw error;
    }
  }

  async retryStep(projectId: string, stepId: string): Promise<void> {
    this.logger.log(`Retrying step ${stepId} in project ${projectId}`);

    try {
      // Reset step status to pending
      await this.updateStepStatus(projectId, stepId, 'pending');
      
      // Load all steps and try to execute this one
      const steps = await this.loadProjectSteps(projectId);
      const step = steps.find(s => s.stepId === stepId);
      
      if (!step) {
        throw new Error(`Step ${stepId} not found in project ${projectId}`);
      }

      // Execute the specific step
      await this.executeStep(projectId, step);

      this.logger.log(`Step ${stepId} retry completed`);
    } catch (error) {
      this.logger.error(`Failed to retry step ${stepId}:`, error);
      throw error;
    }
  }

  async abortProject(projectId: string): Promise<void> {
    this.logger.log(`Aborting project: ${projectId}`);

    try {
      // Update project status to aborted
      await this.updateProjectStatus(projectId, 'aborted', {
        abortedAt: new Date().toISOString(),
        abortReason: 'User requested project termination',
      });

      // Mark any running/pending steps as skipped
      await this.abortAllProjectSteps(projectId);

      this.logger.log(`Project ${projectId} aborted successfully`);
    } catch (error) {
      this.logger.error(`Failed to abort project ${projectId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS - Real project execution logic
  // ============================================================================

  private async loadProject(projectId: string): Promise<any> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      throw new Error(`Failed to load project ${projectId}: ${error.message}`);
    }

    return data;
  }

  private async loadProjectSteps(projectId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to load project steps: ${error.message}`);
    }

    return data || [];
  }

  private async executeNextReadySteps(projectId: string, steps: any[]): Promise<void> {
    // Find steps that are ready to execute (dependencies completed, status pending)
    const readySteps = steps.filter(step => 
      step.status === 'pending' && this.areDependenciesCompleted(step, steps)
    );

    this.logger.log(`Found ${readySteps.length} ready steps to execute`);

    // Execute ready steps (could be done in parallel for independent steps)
    for (const step of readySteps) {
      try {
        await this.executeStep(projectId, step);
      } catch (error) {
        this.logger.error(`Step ${step.stepId} execution failed:`, error);
        // Continue with other steps, handle error appropriately
        await this.updateStepStatus(projectId, step.stepId, 'failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        });
      }
    }

    // Check if project is complete
    await this.checkProjectCompletion(projectId, steps);
  }

  private areDependenciesCompleted(step: any, allSteps: any[]): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true; // No dependencies
    }

    // Check all dependencies are completed
    return step.dependencies.every((depStepId: string) => {
      const depStep = allSteps.find(s => s.stepId === depStepId);
      return depStep && depStep.status === 'completed';
    });
  }

  private async executeStep(projectId: string, step: any): Promise<void> {
    this.logger.log(`Executing step ${step.stepId}: ${step.stepName}`);

    // Update step status to running
    await this.updateStepStatus(projectId, step.stepId, 'running', {
      startedAt: new Date().toISOString(),
    });

    try {
      let result: any = null;

      if (step.stepType === 'agent_step') {
        // Delegate to agent
        if (!step.agentName) {
          throw new Error(`Agent step ${step.stepId} missing agentName`);
        }

        const orchestratorInput: OrchestratorInput = {
          prompt: step.prompt,
          userId: 'system', // Project execution
          conversationId: `project-${projectId}`,
          projectId,
          stepId: step.stepId,
          metadata: {
            stepName: step.stepName,
            stepType: step.stepType,
          },
        };

        result = await this.delegationService.delegateToAgent(
          step.agentName,
          step.prompt,
          orchestratorInput,
        );

      } else if (step.stepType === 'human_approval') {
        // Human approval step - pause project and wait
        await this.updateProjectStatus(projectId, 'paused_for_approval', {
          currentStepId: step.stepId,
          awaitingApprovalFor: step.stepName,
          pausedAt: new Date().toISOString(),
        });

        await this.updateStepStatus(projectId, step.stepId, 'pending_approval', {
          awaitingApprovalSince: new Date().toISOString(),
        });

        this.logger.log(`Project ${projectId} paused for human approval on step ${step.stepId}`);
        return; // Don't mark as completed, wait for approval
      }

      // Mark step as completed
      await this.updateStepStatus(projectId, step.stepId, 'completed', {
        completedAt: new Date().toISOString(),
        result: result,
      });

      this.logger.log(`Step ${step.stepId} completed successfully`);

    } catch (error) {
      await this.updateStepStatus(projectId, step.stepId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async checkProjectCompletion(projectId: string, steps: any[]): Promise<void> {
    const pendingSteps = steps.filter(s => 
      s.status === 'pending' || s.status === 'running' || s.status === 'pending_approval'
    );

    if (pendingSteps.length === 0) {
      // All steps completed
      await this.updateProjectStatus(projectId, 'completed', {
        completedAt: new Date().toISOString(),
      });
      this.logger.log(`Project ${projectId} completed successfully`);
    }
  }

  private async updateProjectStatus(projectId: string, status: ProjectStatus, metadata?: any): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (metadata) {
      // Merge with existing metadata
      const project = await this.loadProject(projectId);
      updateData.metadata = {
        ...project.metadata,
        ...metadata,
      };
    }

    const { error } = await this.supabaseService
      .getServiceClient()
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to update project status: ${error.message}`);
    }
  }

  private async updateStepStatus(projectId: string, stepId: string, status: ProjectStepStatus, metadata?: any): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (metadata) {
      updateData.metadata = metadata;
      if (metadata.result) {
        updateData.result = metadata.result;
      }
      if (metadata.error) {
        updateData.error_details = { error: metadata.error };
      }
    }

    const { error } = await this.supabaseService
      .getServiceClient()
      .from('project_steps')
      .update(updateData)
      .eq('project_id', projectId)
      .eq('step_id', stepId);

    if (error) {
      throw new Error(`Failed to update step status: ${error.message}`);
    }
  }

  private async abortAllProjectSteps(projectId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from('project_steps')
      .update({
        status: 'skipped',
        updated_at: new Date().toISOString(),
        metadata: {
          skippedReason: 'Project aborted',
          skippedAt: new Date().toISOString(),
        },
      })
      .eq('project_id', projectId)
      .in('status', ['pending', 'running']);

    if (error) {
      throw new Error(`Failed to abort project steps: ${error.message}`);
    }
  }
}