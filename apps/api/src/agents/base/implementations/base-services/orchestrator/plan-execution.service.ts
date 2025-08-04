import { Injectable, Logger } from '@nestjs/common';
import { 
  IPlanExecutionService,
  Project,
  PlanDefinition,
  PlanStep,
  ProjectStatus,
  ProjectStepStatus
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { SupabaseService } from '../../../../../supabase/supabase.service';

/**
 * Plan Execution Service - LangGraph-based execution engine
 * 
 * Executes approved project plans using LangGraph's state management
 * and persistence features, with ReAct patterns for reasoning and action-taking.
 */
/**
 * Execution state for tracking project progress
 */
interface ExecutionState {
  projectId: string;
  currentStepId: string;
  status: ProjectStatus;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Record<string, any>;
  metadata: Record<string, any>;
}

@Injectable()
export class PlanExecutionService implements IPlanExecutionService {
  private readonly logger = new Logger(PlanExecutionService.name);
  private activeExecutions = new Map<string, ExecutionState>();

  constructor(
    private readonly llmService: LLMService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Start project execution
   * 
   * Sets up execution state management and begins sequential step processing.
   * Uses database persistence for checkpointing and state recovery.
   */
  async startProject(project: Project): Promise<void> {
    this.logger.log(`Starting project execution: ${project.id}`);
    
    try {
      if (!project.planJson) {
        throw new Error('Project has no plan to execute');
      }

      // Initialize execution state
      const executionState: ExecutionState = {
        projectId: project.id,
        currentStepId: '',
        status: 'running',
        completedSteps: [],
        failedSteps: [],
        stepResults: {},
        metadata: {
          startedAt: new Date().toISOString(),
          plan: project.planJson
        }
      };

      this.activeExecutions.set(project.id, executionState);

      // Update project status in database
      await this.updateProjectStatus(project.id, 'running');

      // Start execution loop
      await this.executeProjectSteps(project.planJson, executionState);
      
    } catch (error) {
      this.logger.error(`Failed to start project ${project.id}:`, error);
      await this.updateProjectStatus(project.id, 'paused_on_error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Project execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume paused project
   * 
   * Continues execution from last checkpoint, handling human input or error recovery.
   */
  async resumeProject(projectId: string): Promise<void> {
    this.logger.log(`Resuming project: ${projectId}`);
    
    try {
      // Load project and execution state
      const project = await this.loadProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Check if execution state exists in memory, otherwise reconstruct from database
      let executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        executionState = await this.reconstructExecutionState(project);
        this.activeExecutions.set(projectId, executionState);
      }

      // Update status to running
      executionState.status = 'running';
      await this.updateProjectStatus(projectId, 'running');

      // Continue execution from current step
      if (project.planJson) {
        await this.executeProjectSteps(project.planJson, executionState);
      }
      
    } catch (error) {
      this.logger.error(`Failed to resume project ${projectId}:`, error);
      await this.updateProjectStatus(projectId, 'paused_on_error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Project resumption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry failed step
   * 
   * Implements "time travel" functionality by reverting step state and re-executing.
   */
  async retryStep(projectId: string, stepId: string): Promise<void> {
    this.logger.log(`Retrying step ${stepId} in project ${projectId}`);
    
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        throw new Error(`No active execution found for project ${projectId}`);
      }

      // Remove step from failed and completed lists (time travel reset)
      executionState.failedSteps = executionState.failedSteps.filter(id => id !== stepId);
      executionState.completedSteps = executionState.completedSteps.filter(id => id !== stepId);
      
      // Clear step result
      delete executionState.stepResults[stepId];

      // Update step status in database
      await this.updateStepStatus(projectId, stepId, 'pending');

      // Load project plan
      const project = await this.loadProject(projectId);
      if (!project?.planJson) {
        throw new Error(`Project plan not found for ${projectId}`);
      }

      // Find and retry the specific step
      const step = project.planJson.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found in project plan`);
      }

      // Execute the step
      await this.executeStep(step, executionState);
      
    } catch (error) {
      this.logger.error(`Failed to retry step ${stepId} in project ${projectId}:`, error);
      throw new Error(`Step retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Abort project execution
   * 
   * Terminates the project and cleans up resources.
   */
  async abortProject(projectId: string): Promise<void> {
    this.logger.log(`Aborting project: ${projectId}`);
    
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (executionState) {
        executionState.status = 'aborted';
        this.activeExecutions.delete(projectId);
      }

      await this.updateProjectStatus(projectId, 'aborted', { 
        abortedAt: new Date().toISOString(),
        reason: 'User requested abortion'
      });
      
      this.logger.log(`Project ${projectId} aborted successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to abort project ${projectId}:`, error);
      throw new Error(`Project abortion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // CORE EXECUTION METHODS - Step sequencing and execution logic
  // ============================================================================

  /**
   * Execute project steps sequentially with dependency management
   */
  private async executeProjectSteps(plan: PlanDefinition, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Executing ${plan.steps.length} steps for project ${executionState.projectId}`);
    
    try {
      const steps = plan.steps;
      const pendingSteps = steps.filter(step => 
        !executionState.completedSteps.includes(step.stepId) && 
        !executionState.failedSteps.includes(step.stepId)
      );

      for (const step of pendingSteps) {
        // Check if execution was aborted
        if (executionState.status === 'aborted') {
          this.logger.log(`Project ${executionState.projectId} execution aborted`);
          return;
        }

        // Check dependencies before executing step
        const dependenciesMet = this.checkStepDependencies(step, executionState);
        if (!dependenciesMet) {
          this.logger.warn(`Step ${step.stepId} dependencies not met, skipping for now`);
          continue;
        }

        // Execute the step
        executionState.currentStepId = step.stepId;
        
        try {
          await this.executeStep(step, executionState);
          
          // Mark step as completed
          executionState.completedSteps.push(step.stepId);
          await this.updateStepStatus(executionState.projectId, step.stepId, 'completed');
          
          this.logger.log(`Step ${step.stepId} completed successfully`);
          
        } catch (stepError) {
          // Mark step as failed
          executionState.failedSteps.push(step.stepId);
          await this.updateStepStatus(executionState.projectId, step.stepId, 'failed', {
            error: stepError instanceof Error ? stepError.message : 'Unknown error'
          });
          
          // For human approval steps, pause the project
          if (step.stepType === 'human_approval') {
            executionState.status = 'paused_for_approval';
            await this.updateProjectStatus(executionState.projectId, 'paused_for_approval', {
              pendingApprovalStep: step.stepId,
              error: stepError instanceof Error ? stepError.message : 'Unknown error'
            });
            return;
          }
          
          // For agent steps, continue to next step but log the error
          this.logger.error(`Step ${step.stepId} failed, continuing with remaining steps:`, stepError);
        }
      }

      // Check if all steps are completed
      const allStepsCompleted = steps.every(step => 
        executionState.completedSteps.includes(step.stepId)
      );

      if (allStepsCompleted) {
        executionState.status = 'completed';
        await this.updateProjectStatus(executionState.projectId, 'completed', {
          completedAt: new Date().toISOString(),
          totalSteps: steps.length,
          completedSteps: executionState.completedSteps.length,
          failedSteps: executionState.failedSteps.length
        });
        
        // Clean up execution state
        this.activeExecutions.delete(executionState.projectId);
        
        this.logger.log(`Project ${executionState.projectId} completed successfully`);
      } else {
        // Project has remaining steps - might be waiting for dependencies or human approval
        const hasFailedSteps = executionState.failedSteps.length > 0;
        const newStatus = hasFailedSteps ? 'paused_on_error' : 'paused_for_approval';
        
        executionState.status = newStatus;
        await this.updateProjectStatus(executionState.projectId, newStatus, {
          remainingSteps: steps.filter(s => !executionState.completedSteps.includes(s.stepId)).length,
          failedSteps: executionState.failedSteps.length
        });
      }
      
    } catch (error) {
      this.logger.error(`Project execution failed for ${executionState.projectId}:`, error);
      executionState.status = 'paused_on_error';
      await this.updateProjectStatus(executionState.projectId, 'paused_on_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute individual step based on step type
   */
  private async executeStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Executing step ${step.stepId}: ${step.stepName}`);
    
    try {
      await this.updateStepStatus(executionState.projectId, step.stepId, 'running');

      if (step.stepType === 'agent_step') {
        await this.executeAgentStep(step, executionState);
      } else if (step.stepType === 'human_approval') {
        await this.executeHumanApprovalStep(step, executionState);
      } else {
        throw new Error(`Unknown step type: ${step.stepType}`);
      }
      
    } catch (error) {
      this.logger.error(`Step ${step.stepId} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute agent step by delegating to specific agent
   */
  private async executeAgentStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    if (!step.agentName) {
      throw new Error(`Agent step ${step.stepId} missing agent assignment`);
    }

    this.logger.log(`Delegating step ${step.stepId} to agent: ${step.agentName}`);
    
    try {
      // TODO: Integrate with DelegationService when available
      // For now, simulate agent execution with LLM call
      
      const stepResult = await this.simulateAgentExecution(step, executionState);
      
      // Store step result
      executionState.stepResults[step.stepId] = stepResult;
      
      // Update step with result
      await this.updateStepStatus(executionState.projectId, step.stepId, 'completed', {
        result: stepResult,
        agentName: step.agentName,
        executedAt: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error(`Agent step execution failed for ${step.stepId}:`, error);
      throw error;
    }
  }

  /**
   * Execute human approval step
   */
  private async executeHumanApprovalStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Pausing for human approval: ${step.stepId}`);
    
    try {
      // Human approval steps pause execution and wait for user input
      executionState.status = 'paused_for_approval';
      
      await this.updateStepStatus(executionState.projectId, step.stepId, 'pending_approval', {
        approvalRequested: new Date().toISOString(),
        prompt: step.prompt
      });
      
      await this.updateProjectStatus(executionState.projectId, 'paused_for_approval', {
        pendingApprovalStep: step.stepId,
        approvalPrompt: step.prompt
      });
      
      // Send WebSocket notification for approval needed
      await this.sendWebSocketUpdate(executionState.projectId, {
        type: 'approval_required',
        stepId: step.stepId,
        stepName: step.stepName,
        prompt: step.prompt
      });
      
      // Execution will pause here until resumeProject is called with approval
      throw new Error('Human approval required - execution paused');
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Human approval required')) {
        throw error; // Expected pause for approval
      }
      
      this.logger.error(`Human approval step failed for ${step.stepId}:`, error);
      throw error;
    }
  }

  /**
   * Simulate agent execution with LLM (temporary until DelegationService is ready)
   */
  private async simulateAgentExecution(step: PlanStep, executionState: ExecutionState): Promise<any> {
    const systemPrompt = `You are simulating the execution of an agent task. 
Provide a realistic result that an AI agent would produce for this type of task.

Agent: ${step.agentName}
Task Type: ${step.stepType}
Context: This is step ${step.stepId} in a larger project workflow.`;

    const userMessage = `Execute this task:
"${step.prompt}"

Previous step results available:
${Object.keys(executionState.stepResults).length > 0 ? 
  JSON.stringify(executionState.stepResults, null, 2) : 
  'None - this is an early step in the project'
}

Provide a realistic result that moves the project forward.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 500,
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return {
        success: true,
        result: response,
        executedBy: step.agentName,
        executedAt: new Date().toISOString(),
        stepId: step.stepId
      };
      
    } catch (error) {
      this.logger.error(`Simulated agent execution failed:`, error);
      throw new Error(`Agent execution simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // DATABASE HELPER METHODS - Project and step persistence
  // ============================================================================

  /**
   * Update project status in database
   */
  private async updateProjectStatus(
    projectId: string, 
    status: ProjectStatus, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await this.supabaseService.getServiceClient()
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // Send WebSocket update
      await this.sendWebSocketUpdate(projectId, {
        type: 'project_status_changed',
        status,
        metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to update project status for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Update step status in database
   */
  private async updateStepStatus(
    projectId: string,
    stepId: string,
    status: ProjectStepStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await this.supabaseService.getServiceClient()
        .from('project_steps')
        .update(updateData)
        .eq('project_id', projectId)
        .eq('step_id', stepId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // Send WebSocket update
      await this.sendWebSocketUpdate(projectId, {
        type: 'step_status_changed',
        stepId,
        status,
        metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to update step status for ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Load project from database
   */
  private async loadProject(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabaseService.getServiceClient()
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return data;
      
    } catch (error) {
      this.logger.error(`Failed to load project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Reconstruct execution state from database
   */
  private async reconstructExecutionState(project: Project): Promise<ExecutionState> {
    try {
      // Load project steps from database
      const { data: steps, error } = await this.supabaseService.getServiceClient()
        .from('project_steps')
        .select('*')
        .eq('project_id', project.id);

      if (error) {
        throw new Error(`Failed to load project steps: ${error.message}`);
      }

      const completedSteps = steps?.filter((s: any) => s.status === 'completed').map((s: any) => s.step_id) || [];
      const failedSteps = steps?.filter((s: any) => s.status === 'failed').map((s: any) => s.step_id) || [];
      const stepResults: Record<string, any> = {};
      
      // Reconstruct step results
      steps?.forEach((step: any) => {
        if (step.metadata?.result) {
          stepResults[step.step_id] = step.metadata.result;
        }
      });

      const executionState: ExecutionState = {
        projectId: project.id,
        currentStepId: project.metadata?.currentStepId || '',
        status: project.status,
        completedSteps,
        failedSteps,
        stepResults,
        metadata: project.metadata || {}
      };

      this.logger.log(`Reconstructed execution state for project ${project.id}: ${completedSteps.length} completed, ${failedSteps.length} failed`);
      return executionState;
      
    } catch (error) {
      this.logger.error(`Failed to reconstruct execution state for project ${project.id}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS - Dependencies and WebSocket integration
  // ============================================================================

  /**
   * Check if step dependencies are satisfied
   */
  private checkStepDependencies(step: PlanStep, executionState: ExecutionState): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true; // No dependencies
    }

    return step.dependencies.every(depId => 
      executionState.completedSteps.includes(depId)
    );
  }

  /**
   * Send WebSocket update for real-time project monitoring
   */
  private async sendWebSocketUpdate(projectId: string, update: any): Promise<void> {
    try {
      // TODO: Integrate with WebSocketGateway when available
      // For now, just log the update
      this.logger.debug(`WebSocket update for project ${projectId}:`, update);
      
    } catch (error) {
      this.logger.warn(`Failed to send WebSocket update for project ${projectId}:`, error);
      // Don't throw - WebSocket failures shouldn't stop execution
    }
  }
}