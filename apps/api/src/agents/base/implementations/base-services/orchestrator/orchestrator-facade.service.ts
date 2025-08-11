import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  IOrchestratorFacadeService,
  OrchestratorA2AMethod,
  OrchestratorInput,
  OrchestratorResponse,
  IIntentRecognitionService,
  IPlanningService,
  IDelegationService,
  IPlanExecutionService,
  Project,
  PlanDefinition,
} from '../../../../../orchestration/orchestration.types';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentNameFormatter } from '../../../../../common/formatters/agent-name.formatter';

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
    @Inject('IIntentRecognitionService')
    private readonly intentRecognitionService: IIntentRecognitionService,
    @Inject('IPlanningService')
    private readonly planningService: IPlanningService,
    @Inject('IDelegationService')
    private readonly delegationService: IDelegationService,
    @Inject('IPlanExecutionService')
    private readonly planExecutionService: IPlanExecutionService,
    private readonly supabaseService: SupabaseService,
    private readonly llmService: LLMService,
    private readonly agentNameFormatter: AgentNameFormatter,
  ) {}

  /**
   * Process orchestrator request - Single coordination point
   *
   * This method routes all orchestrator operations while maintaining
   * A2A compliance and the conversation + tasks pattern.
   *
   * ARCHITECTURAL NOTE: Project creation is now primarily explicit (UI-driven)
   * rather than inferred from natural language to eliminate classification errors.
   */
  async processRequest(
    method: OrchestratorA2AMethod,
    input: OrchestratorInput,
    delegationContext?: string,
  ): Promise<OrchestratorResponse> {
    this.logger.log(`Processing orchestrator request: ${method}`);

    try {
      // Route based on A2A method (explicit operations)
      switch (method) {
        case 'explicit_create_project': // UI-driven project creation
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
          return await this.handleIntelligentRouting(input, delegationContext);
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
        },
      };
    }
  }

  /**
   * Handle project creation - Start of "Plan-Approve-Act" lifecycle
   */
  private async handleCreateProject(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log(
      `Handling project creation request: "${input.prompt.substring(0, 100)}..."`,
    );

    try {
      // Step 1: Create project plan using PlanningService
      const plan = await this.planningService.createPlan(input);

      // Step 2: Create project record in database
      const projectId = await this.createProjectRecord(plan, input);

      // Step 3: Create project steps in database
      await this.createProjectSteps(projectId, plan);

      // Step 4: Format plan for human review
      const humanReadablePlan =
        await this.planningService.formatPlanForHuman(plan);

      this.logger.log(`Project created successfully: ${projectId}`);

      return {
        success: true,
        message: `Project "${plan.projectName}" created successfully! Please review the plan below and approve it to begin execution.`,
        response: humanReadablePlan,
        action: 'CREATE_PROJECT',
        projectId,
        planId: projectId, // Same as project ID for now
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          projectName: plan.projectName,
          stepsCount: plan.steps.length,
          status: 'pending_approval',
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };
    } catch (error) {
      this.logger.error('Project creation failed:', error);
      throw new Error(
        `Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle plan updates - Collaborative planning phase
   */
  private async handleUpdateProjectPlan(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log(`Handling plan update for project: ${input.projectId}`);

    try {
      if (!input.projectId) {
        throw new Error('Project ID required for plan updates');
      }

      // Load existing project
      const project = await this.loadProject(input.projectId);
      if (!project) {
        throw new Error(`Project ${input.projectId} not found`);
      }

      // Use feedback from input.prompt to refine the plan
      const refinedPlan = await this.planningService.refinePlan(
        input.projectId,
        input.prompt,
        input,
      );

      // Update project record with new plan
      await this.updateProjectPlan(input.projectId, refinedPlan);

      // Update project steps
      await this.updateProjectSteps(input.projectId, refinedPlan);

      // Format updated plan for review
      const humanReadablePlan =
        await this.planningService.formatPlanForHuman(refinedPlan);

      return {
        success: true,
        message: `Project plan updated successfully! Please review the revised plan below.`,
        response: humanReadablePlan,
        action: 'UPDATE_PLAN',
        projectId: input.projectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          projectName: refinedPlan.projectName,
          stepsCount: refinedPlan.steps.length,
          status: 'pending_approval',
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };
    } catch (error) {
      this.logger.error('Plan update failed:', error);
      throw new Error(
        `Plan update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle plan approval - Transition to "Act" phase
   */
  private async handleApproveProjectPlan(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log(`Handling plan approval for project: ${input.projectId}`);

    try {
      if (!input.projectId) {
        throw new Error('Project ID required for plan approval');
      }

      // Load project to ensure it exists
      const project = await this.loadProject(input.projectId);
      if (!project) {
        throw new Error(`Project ${input.projectId} not found`);
      }

      if (project.status !== 'pending_approval') {
        throw new Error(
          `Project ${input.projectId} is not pending approval (current status: ${project.status})`,
        );
      }

      // Update project status to approved and start execution
      await this.updateProjectStatus(input.projectId, 'running', {
        approvedAt: new Date().toISOString(),
        approvedBy: input.userId,
      });

      // Start plan execution
      await this.planExecutionService.startProject(project);

      return {
        success: true,
        message: `Project "${project.metadata?.projectName || 'Unnamed Project'}" approved and execution started! I'll keep you updated on progress.`,
        action: 'APPROVE_PLAN',
        projectId: input.projectId,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          projectName: project.metadata?.projectName,
          status: 'running',
          approvedAt: new Date().toISOString(),
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };
    } catch (error) {
      this.logger.error('Plan approval failed:', error);
      throw new Error(
        `Plan approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle project resumption
   */
  private async handleResumeProject(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
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
        },
      };
    } catch (error) {
      throw new Error(
        `Project resumption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle step retry
   */
  private async handleRetryProjectStep(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log(
      `Handling step retry: ${input.stepId} in project ${input.projectId}`,
    );

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
        },
      };
    } catch (error) {
      throw new Error(
        `Step retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle project abortion
   */
  private async handleAbortProject(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
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
        },
      };
    } catch (error) {
      throw new Error(
        `Project abortion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle direct task delegation
   */
  private async handleDelegateTask(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log('Handling direct task delegation');

    try {
      // TODO: Extract agent name from input or metadata
      const agentName = input.metadata?.agentName;
      if (!agentName) {
        throw new Error('Agent name required for delegation');
      }

      return await this.delegationService.delegateToAgent(
        agentName,
        input.prompt,
        input,
      );
    } catch (error) {
      throw new Error(
        `Task delegation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // NOTE: handleClarifyRequest method removed - orchestrator now delegates directly instead of asking for permission

  /**
   * Handle direct conversation
   */
  private async handleConverse(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.logger.log('Handling direct conversation');

    try {
      // Use LLM to generate orchestrator responses based on the user's message
      const systemPrompt = `You are an intelligent orchestrator agent that helps coordinate complex projects and delegate tasks to specialist agents. 

You have access to multiple specialist agents and can:
- Coordinate multi-step projects with planning and execution
- Delegate specific tasks to specialist agents
- Provide strategic guidance and oversight
- Help break down complex requests into manageable steps

Respond naturally to the user's message, offering helpful suggestions about how you can assist them. Be concise but helpful.

Available delegation context:
${input.delegationContext || 'No specific agents listed - you can work with various specialist agents as needed.'}`;

      const userMessage = input.prompt;

      // Generate response using LLM with conversation history
      const conversationHistory = (input.conversationHistory || []).map(
        (msg) => ({
          role:
            msg.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: msg.content || '',
        }),
      );

      const llmResponse = await this.llmService.generateResponseWithHistory(
        systemPrompt,
        conversationHistory,
        userMessage,
      );

      const response = {
        success: true,
        message: llmResponse.trim(),
        metadata: {
          agentType: 'orchestrator' as const,
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'converse',
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };

      this.logger.log(
        `🔍 DEBUG - handleConverse response: ${JSON.stringify(response, null, 2)}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Conversation failed:', error);

      // Fallback to a helpful static message if LLM fails
      return {
        success: true,
        message: `I'm the orchestrator. I can help you coordinate complex projects and delegate tasks to specialist agents. What would you like to accomplish?

(Note: I'm currently experiencing some technical difficulties with my response generation, but I'm still here to help!)`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          action: 'converse',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };
    }
  }

  /**
   * Handle intelligent routing using intent recognition
   *
   * This follows the conversation + tasks pattern - when method is unclear,
   * use LLM to determine the appropriate action.
   */
  private async handleIntelligentRouting(
    input: OrchestratorInput,
    delegationContext?: string,
  ): Promise<OrchestratorResponse> {
    this.logger.log('🔍 DEBUG - Using intelligent routing for request');
    this.logger.log(
      `🔍 DEBUG - Delegation context received in facade: ${delegationContext ? 'YES' : 'NO'}`,
    );
    if (delegationContext) {
      this.logger.debug(
        `🔍 Delegation context preview: ${delegationContext.substring(0, 200)}...`,
      );
    }

    try {
      this.logger.log('🔍 DEBUG - About to call intent recognition service...');
      this.logger.log(
        `🔍 DEBUG - Intent recognition service available: ${!!this.intentRecognitionService}`,
      );
      // Use intent recognition to determine action
      const intent = await this.intentRecognitionService.classifyIntent(
        input,
        delegationContext,
      );

      this.logger.log(
        `Intent classified as: ${intent.action} (confidence: ${intent.confidence})`,
      );
      this.logger.log(
        `🔍 Full intent result: ${JSON.stringify(intent, null, 2)}`,
      );

      // Route based on classified intent
      switch (intent.action) {
        // NOTE: CREATE_PROJECT removed - now handled only through explicit UI actions

        case 'CREATE_SUBPROJECT':
          // For subprojects, determine if we can delegate to a single agent instead
          // This handles LLM over-thinking simple requests
          const subprojectScope = intent as any; // Handle dynamic LLM response structure
          if (subprojectScope.subprojectScope?.involvedAgents?.length > 0) {
            const involvedAgents =
              subprojectScope.subprojectScope.involvedAgents;

            // Use the first suggested agent (no hardcoded preferences)
            const firstAgent = involvedAgents[0];
            const agentMatch = firstAgent.match(/^(\w+):/);
            if (agentMatch) {
              const primaryAgent = agentMatch[1];
              this.logger.debug(
                `Subproject requested, delegating to primary agent: ${primaryAgent}`,
              );
              return await this.delegationService.delegateToAgent(
                primaryAgent,
                input.prompt,
                input,
              );
            }
          }
          // Fallback to project creation if no clear primary agent
          return await this.handleCreateProject(input);

        case 'RESUME_PROJECT':
          return await this.handleResumeProject(input);

        case 'DELEGATE':
          this.logger.log(
            `🔍 DELEGATE case triggered with agentName: ${intent.agentName}`,
          );
          this.logger.log(
            `🔍 DelegationService available: ${!!this.delegationService}`,
          );
          if (intent.agentName) {
            this.logger.log(
              `🔍 About to call delegationService.delegateToAgent with agent: ${intent.agentName}`,
            );
            try {
              const delegationResult =
                await this.delegationService.delegateToAgent(
                  intent.agentName,
                  input.prompt,
                  input,
                );
              this.logger.log(
                `🔍 Delegation succeeded: ${JSON.stringify(delegationResult, null, 2)}`,
              );
              return delegationResult;
            } catch (delegationError) {
              this.logger.error(`🔍 Delegation failed: ${delegationError}`);
              throw delegationError;
            }
          } else {
            this.logger.log(
              `🔍 No agentName provided, falling back to conversation`,
            );
            return await this.handleConverse(input);
          }

        case 'CLARIFY':
          // CLARIFY removed - treat as delegation request instead
          this.logger.log(
            'CLARIFY action detected but removed - converting to DELEGATE',
          );
          if (intent.agentName || intent.suggestedAgent) {
            const targetAgent = intent.agentName || intent.suggestedAgent;
            if (targetAgent) {
              return await this.delegationService.delegateToAgent(
                targetAgent,
                input.prompt,
                input,
              );
            }
          }
          // No specific agent suggested, fall back to conversation
          return await this.handleConverse(input);

        case 'CONTINUE_DELEGATION':
          // TODO: Implement delegation continuation
          return await this.handleConverse(input);

        case 'CONVERSE':
        default:
          return await this.handleConverse(input);
      }
    } catch (error) {
      this.logger.error('Intelligent routing failed:', error);
      this.logger.error('Error type:', typeof error);
      this.logger.error(
        'Error message:',
        error instanceof Error ? error.message : String(error),
      );
      this.logger.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );

      // If it's a delegation error, provide a more specific response instead of generic conversation fallback
      if (
        error instanceof Error &&
        (error.message.includes('delegation') ||
          error.message.includes('DelegationError') ||
          error.message.includes('agent'))
      ) {
        return {
          success: false,
          message: `I encountered an error while trying to delegate your request: ${error.message}. Please try again or contact support if the issue persists.`,
          metadata: {
            agentType: 'orchestrator' as const,
            agentName: 'Orchestrator',
            processedAt: new Date().toISOString(),
            error: true,
            errorType: 'delegation_failed',
            originalError: error.message,
          },
          conversationId: input.conversationId,
          userId: input.userId,
          sessionId: input.sessionId,
        };
      }

      // Fallback to conversation for other types of errors
      return await this.handleConverse(input);
    }
  }

  // ============================================================================
  // DATABASE HELPER METHODS - Project persistence and management
  // ============================================================================

  /**
   * Create project record in database
   */
  private async createProjectRecord(
    plan: PlanDefinition,
    input: OrchestratorInput,
  ): Promise<string> {
    try {
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { error } = await this.supabaseService
        .getServiceClient()
        .from('projects')
        .insert([
          {
            id: projectId,
            conversation_id: input.conversationId,
            user_id: input.userId,
            project_name: plan.projectName,
            description: plan.description,
            status: 'pending_approval',
            plan_json: plan,
            metadata: {
              ...plan.metadata,
              createdAt: new Date().toISOString(),
              createdBy: input.userId,
              stepsCount: plan.steps.length,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      return projectId;
    } catch (error) {
      this.logger.error('Failed to create project record:', error);
      throw error;
    }
  }

  /**
   * Create project steps in database
   */
  private async createProjectSteps(
    projectId: string,
    plan: PlanDefinition,
  ): Promise<void> {
    try {
      const stepRecords = plan.steps.map((step) => ({
        project_id: projectId,
        step_id: step.stepId,
        step_name: step.stepName,
        step_type: step.stepType,
        agent_name: step.agentName || null,
        prompt: step.prompt,
        dependencies: step.dependencies || [],
        status: 'pending',
        metadata: step.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.supabaseService
        .getServiceClient()
        .from('project_steps')
        .insert(stepRecords);

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to create project steps:', error);
      throw error;
    }
  }

  /**
   * Load project from database
   */
  private async loadProject(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Project not found
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to load project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Update project plan in database
   */
  private async updateProjectPlan(
    projectId: string,
    plan: PlanDefinition,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getServiceClient()
        .from('projects')
        .update({
          project_name: plan.projectName,
          description: plan.description,
          plan_json: plan,
          metadata: {
            ...plan.metadata,
            updatedAt: new Date().toISOString(),
            stepsCount: plan.steps.length,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update project plan for ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update project steps in database (replace existing steps)
   */
  private async updateProjectSteps(
    projectId: string,
    plan: PlanDefinition,
  ): Promise<void> {
    try {
      // Delete existing steps
      const { error: deleteError } = await this.supabaseService
        .getServiceClient()
        .from('project_steps')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) {
        throw new Error(
          `Failed to delete existing steps: ${deleteError.message}`,
        );
      }

      // Create new steps
      await this.createProjectSteps(projectId, plan);
    } catch (error) {
      this.logger.error(
        `Failed to update project steps for ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update project status in database
   */
  private async updateProjectStatus(
    projectId: string,
    status: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (metadata) {
        // Load existing metadata and merge
        const existingProject = await this.loadProject(projectId);
        updateData.metadata = {
          ...existingProject?.metadata,
          ...metadata,
        };
      }

      const { error } = await this.supabaseService
        .getServiceClient()
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update project status for ${projectId}:`,
        error,
      );
      throw error;
    }
  }
}
