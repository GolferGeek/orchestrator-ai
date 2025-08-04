import { Injectable, Logger } from '@nestjs/common';
import { 
  IOrchestratorFacadeService,
  OrchestratorA2AMethod,
  OrchestratorInput,
  OrchestratorResponse,
  IIntentRecognitionService,
  IPlanningService,
  IDelegationService,
  IPlanExecutionService
} from '../../../../../orchestration/orchestration.types';

/**
 * Orchestrator Facade Service - Main coordinator
 * 
 * Routes all requests through the single A2A entry point and coordinates
 * the full "Plan-Approve-Act" lifecycle. This is the brain of the orchestrator
 * that maintains the conversation + tasks paradigm while adding project capabilities.
 */
@Injectable()
export class OrchestratorFacadeService implements IOrchestratorFacadeService {
  private readonly logger = new Logger(OrchestratorFacadeService.name);

  constructor(
    private readonly intentRecognitionService: IIntentRecognitionService,
    private readonly planningService: IPlanningService,
    private readonly delegationService: IDelegationService,
    private readonly planExecutionService: IPlanExecutionService,
  ) {}

  /**
   * Process orchestrator request - Single coordination point
   * 
   * This method routes all orchestrator operations while maintaining
   * A2A compliance and the conversation + tasks pattern.
   */
  async processRequest(
    method: OrchestratorA2AMethod, 
    input: OrchestratorInput
  ): Promise<OrchestratorResponse> {
    this.logger.log(`Processing orchestrator request: ${method}`);
    
    try {
      // Route based on A2A method (explicit operations)
      switch (method) {
        case 'create_project':
          return await this.handleCreateProject(input);
          
        case 'update_project_plan':
          return await this.handleUpdateProjectPlan(input);
          
        case 'approve_project_plan':
          return await this.handleApproveProjectPlan(input);
          
        case 'resume_project':
          return await this.handleResumeProject(input);
          
        case 'retry_project_step':
          return await this.handleRetryProjectStep(input);
          
        case 'abort_project':
          return await this.handleAbortProject(input);
          
        case 'delegate_task':
          return await this.handleDelegateTask(input);
          
        case 'converse':
          return await this.handleConverse(input);
          
        default:
          // For unknown methods, use intent recognition (conversation + tasks pattern)
          return await this.handleIntelligentRouting(input);
      }
      
    } catch (error) {
      this.logger.error(`Orchestrator request failed: ${method}`, error);
      
      return {
        success: false,
        message: `Request processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          method,
          error: true,
        }
      };
    }
  }

  /**
   * Handle project creation - Start of "Plan-Approve-Act" lifecycle
   */
  private async handleCreateProject(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log('Handling project creation request');
    
    try {
      // TODO: Implement project creation
      // 1. Create project record in database
      // 2. Start planning phase with PlanningService
      // 3. Return project ID and planning status
      
      throw new Error('Project creation not yet implemented');
      
    } catch (error) {
      throw new Error(`Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle plan updates - Collaborative planning phase
   */
  private async handleUpdateProjectPlan(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Handling plan update for project: ${input.projectId}`);
    
    try {
      // TODO: Implement plan updates
      throw new Error('Plan updates not yet implemented');
      
    } catch (error) {
      throw new Error(`Plan update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle plan approval - Transition to "Act" phase
   */
  private async handleApproveProjectPlan(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Handling plan approval for project: ${input.projectId}`);
    
    try {
      // TODO: Implement plan approval
      // 1. Update project status to 'running'
      // 2. Start plan execution with PlanExecutionService
      // 3. Return execution started confirmation
      
      throw new Error('Plan approval not yet implemented');
      
    } catch (error) {
      throw new Error(`Plan approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle project resumption
   */
  private async handleResumeProject(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Handling project resumption: ${input.projectId}`);
    
    try {
      if (!input.projectId) {
        throw new Error('Project ID required for resumption');
      }
      
      await this.planExecutionService.resumeProject(input.projectId);
      
      return {
        success: true,
        message: 'Project resumed successfully',
        projectId: input.projectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'resume_project',
        }
      };
      
    } catch (error) {
      throw new Error(`Project resumption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle step retry
   */
  private async handleRetryProjectStep(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Handling step retry: ${input.stepId} in project ${input.projectId}`);
    
    try {
      if (!input.projectId || !input.stepId) {
        throw new Error('Project ID and Step ID required for retry');
      }
      
      await this.planExecutionService.retryStep(input.projectId, input.stepId);
      
      return {
        success: true,
        message: 'Step retry initiated successfully',
        projectId: input.projectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'retry_step',
          stepId: input.stepId,
        }
      };
      
    } catch (error) {
      throw new Error(`Step retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle project abortion
   */
  private async handleAbortProject(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Handling project abortion: ${input.projectId}`);
    
    try {
      if (!input.projectId) {
        throw new Error('Project ID required for abortion');
      }
      
      await this.planExecutionService.abortProject(input.projectId);
      
      return {
        success: true,
        message: 'Project aborted successfully',
        projectId: input.projectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'abort_project',
        }
      };
      
    } catch (error) {
      throw new Error(`Project abortion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle direct task delegation
   */
  private async handleDelegateTask(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log('Handling direct task delegation');
    
    try {
      // TODO: Extract agent name from input or metadata
      const agentName = input.metadata?.agentName;
      if (!agentName) {
        throw new Error('Agent name required for delegation');
      }
      
      return await this.delegationService.delegateToAgent(agentName, input.prompt, input);
      
    } catch (error) {
      throw new Error(`Task delegation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle direct conversation
   */
  private async handleConverse(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log('Handling direct conversation');
    
    try {
      // TODO: Implement direct conversation handling
      // This would use LLM to generate orchestrator responses
      
      return {
        success: true,
        message: `I'm the orchestrator. I can help you coordinate complex projects and delegate tasks to specialist agents. What would you like to accomplish?`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'converse',
        }
      };
      
    } catch (error) {
      throw new Error(`Conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle intelligent routing using intent recognition
   * 
   * This follows the conversation + tasks pattern - when method is unclear,
   * use LLM to determine the appropriate action.
   */
  private async handleIntelligentRouting(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log('Using intelligent routing for request');
    
    try {
      // Use intent recognition to determine action
      const intent = await this.intentRecognitionService.classifyIntent(input);
      
      this.logger.log(`Intent classified as: ${intent.action} (confidence: ${intent.confidence})`);
      
      // Route based on classified intent
      switch (intent.action) {
        case 'CREATE_PROJECT':
          return await this.handleCreateProject(input);
          
        case 'RESUME_PROJECT':
          return await this.handleResumeProject(input);
          
        case 'DELEGATE':
          if (intent.agentName) {
            return await this.delegationService.delegateToAgent(intent.agentName, input.prompt, input);
          } else {
            return await this.handleConverse(input);
          }
          
        case 'CONTINUE_DELEGATION':
          // TODO: Implement delegation continuation
          return await this.handleConverse(input);
          
        case 'CONVERSE':
        default:
          return await this.handleConverse(input);
      }
      
    } catch (error) {
      this.logger.error('Intelligent routing failed:', error);
      
      // Fallback to conversation
      return await this.handleConverse(input);
    }
  }
}