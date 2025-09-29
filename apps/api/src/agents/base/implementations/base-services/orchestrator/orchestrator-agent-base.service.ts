import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import {
  OrchestratorA2AMethod,
  OrchestratorInput,
  OrchestratorResponse,
  ConversationMessage,
  IOrchestratorFacadeService,
} from '../../../../../orchestration/orchestration.types';
import { OrchestratorAgentServicesContext } from './orchestrator-agent-services.context';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Orchestrator Agent Base Service
 *
 * CORE PRINCIPLE: Follows the conversation + tasks paradigm that already works
 * - Works exactly like other agents (A2A compliance)
 * - Single executeTask() entry point routes to facade service
 * - Tasks flow through normally, orchestrator adds project capabilities on top
 * - Frontend treats orchestrator like any other agent conversation
 */
@Injectable()
export abstract class OrchestratorAgentBaseService extends A2AAgentBaseService {
  protected readonly orchestratorLogger = new Logger(
    OrchestratorAgentBaseService.name,
  );
  protected delegationContext?: string;

  constructor(private readonly services: OrchestratorAgentServicesContext) {
    // Pass LLM service so A2A short-circuit can handle converse/plan
    super(
      services.httpService,
      undefined,
      undefined,
      undefined,
      undefined,
      services.llmService,
    );
    this.orchestratorFacadeService = services.orchestratorFacadeService;
  }

  // Store orchestrator facade service for use in methods
  protected readonly orchestratorFacadeService: IOrchestratorFacadeService;

  /**
   * A2A Entry Point - Single method that routes all orchestrator operations
   *
   * This is the ONLY entry point for orchestrator functionality, maintaining
   * A2A compliance while enabling rich project orchestration capabilities.
   */
  public async executeTask(method: string, params: any): Promise<any> {
    try {
      // Determine effective orchestrator method based on params.mode and context
      const requestedMode = (params && params.mode) as
        | 'converse'
        | 'plan'
        | 'build'
        | undefined;
      let effectiveMethod: OrchestratorA2AMethod;
      if (requestedMode === 'converse' || !requestedMode) {
        effectiveMethod = 'converse';
      } else if (requestedMode === 'plan') {
        effectiveMethod = 'explicit_create_project';
      } else if (requestedMode === 'build') {
        // For now, treat build as approve/start if a project exists; otherwise fall back to converse
        effectiveMethod = params?.projectId
          ? 'approve_project_plan'
          : 'converse';
      } else {
        effectiveMethod = 'converse';
      }

      // Adapt A2A request to OrchestratorInput (conversation + tasks pattern)
      const input = await this.adaptA2AToOrchestratorInput(
        effectiveMethod,
        params,
      );

      // Route through facade service (maintains single entry point principle)
      const response = await this.orchestratorFacadeService.processRequest(
        effectiveMethod,
        input,
        this.delegationContext,
      );

      // Enhance response metadata if object and normalize content field
      if (response && typeof response === 'object') {
        (response as any).metadata = {
          ...(response as any).metadata,
          agentType: 'orchestrator' as const,
          agentName: this.getAgentName(),
          processedAt: new Date().toISOString(),
          mode: requestedMode || 'converse',
          effectiveMethod,
        };
        // A2A convention uses `response` for main text; ensure it's populated
        const r: any = response as any;
        if (
          typeof r.message === 'string' &&
          (r.response === undefined || r.response === null)
        ) {
          r.response = r.message;
        }
      }

      return response;
    } catch (error) {
      this.orchestratorLogger.error(
        `Orchestrator task failed: ${method}`,
        error,
      );

      // Return A2A-compliant error response
      return {
        success: false,
        message: `Orchestrator failed to process task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator' as const,
          agentName: this.getAgentName(),
          processedAt: new Date().toISOString(),
          error: true,
        },
      };
    }
  }

  /**
   * Load delegation context from delegation.context.md file
   * This defines which agents this orchestrator can command
   */
  async onModuleInit() {
    await super.onModuleInit();

    try {
      await this.loadDelegationContext();
      this.orchestratorLogger.log(
        `🔍 Orchestrator ${this.getAgentName()} initialized with delegation context: ${this.delegationContext ? 'LOADED' : 'NOT LOADED'}`,
      );
    } catch (error) {
      this.orchestratorLogger.warn(
        `Failed to load delegation context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load delegation context from file
   */
  private async loadDelegationContext(): Promise<void> {
    // Special handling for orchestrators during testing
    let agentPath = this.agentPath;
    if (
      !agentPath ||
      agentPath === 'unknown' ||
      agentPath.includes('.spec.ts')
    ) {
      // Try to infer from agent name for orchestrators
      const agentName = this.getAgentName();
      if (agentName.includes('orchestrator')) {
        // Map department manager orchestrators to their proper departments
        if (agentName.includes('marketing_manager')) {
          agentPath = `marketing/${agentName}`;
        } else if (agentName.includes('engineering_manager')) {
          agentPath = `engineering/${agentName}`;
        } else if (agentName.includes('operations_manager')) {
          agentPath = `operations/${agentName}`;
        } else if (agentName.includes('finance_manager')) {
          agentPath = `finance/${agentName}`;
        } else if (agentName.includes('hr_manager')) {
          agentPath = `hr/${agentName}`;
        } else if (agentName.includes('sales_manager')) {
          agentPath = `sales/${agentName}`;
        } else if (agentName.includes('product_manager')) {
          agentPath = `product/${agentName}`;
        } else if (agentName.includes('research_manager')) {
          agentPath = `research/${agentName}`;
        } else if (agentName.includes('legal_manager')) {
          agentPath = `legal/${agentName}`;
        } else if (agentName.includes('productivity_manager')) {
          agentPath = `productivity/${agentName}`;
        } else if (agentName.includes('specialists_manager')) {
          agentPath = `specialists/${agentName}`;
        } else {
          // Default to orchestrator for CEO and other top-level orchestrators
          agentPath = `orchestrator/${agentName}`;
        }
        this.orchestratorLogger.log(
          `🔍 Inferred agent path for testing: ${agentPath}`,
        );
      }
    }

    if (!agentPath || agentPath === 'unknown') {
      this.orchestratorLogger.warn(
        'Agent path not available for delegation context loading',
      );
      return;
    }

    const contextPath = path.join(
      process.cwd(),
      'src',
      'agents',
      'demo',
      agentPath,
      'delegation.context.md',
    );

    this.orchestratorLogger.log(
      `🔍 Attempting to load delegation context from: ${contextPath}`,
    );

    if (fs.existsSync(contextPath)) {
      this.delegationContext = fs.readFileSync(contextPath, 'utf8');
      this.orchestratorLogger.log(
        `Loaded delegation context from: ${contextPath}`,
      );
    } else {
      this.orchestratorLogger.warn(
        `Delegation context file not found: ${contextPath}`,
      );
    }
  }

  /**
   * Adapt A2A request to OrchestratorInput (following conversation + tasks pattern)
   */
  private async adaptA2AToOrchestratorInput(
    method: string,
    params: any,
  ): Promise<OrchestratorInput> {
    // Extract standard fields that match conversation + tasks pattern
    const prompt = params.prompt || params.message || params.userMessage || '';
    const userId = params.currentUser?.id || params.userId || '';
    const conversationId = params.conversationId || '';

    // Extract conversation history (same as other agents)
    const conversationHistory: ConversationMessage[] =
      params.conversationHistory || [];

    // Extract project-specific fields (orchestrator enhancement)
    const projectId = params.projectId;
    const stepId = params.stepId;

    // Create orchestrator input following proven patterns
    return {
      prompt,
      userId,
      conversationId,
      delegationContext: this.delegationContext,
      conversationHistory,
      projectId,
      stepId,
      metadata: {
        method,
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        ...params.metadata,
      },
    };
  }

  /**
   * Override agent type to return orchestrator
   */
  getAgentType(): 'orchestrator' {
    return 'orchestrator';
  }

  /**
   * Get the orchestrator's delegation context
   */
  protected getDelegationContext(): string | undefined {
    return this.delegationContext;
  }

  /**
   * Execute orchestrator task with hierarchical context
   *
   * Main execution method for orchestrator capabilities.
   * Handles strategic planning, delegation, and project management.
   */
  async executeOrchestratorTask(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    this.orchestratorLogger.log(
      `🔍 DEBUG - ${this.getAgentName()} executing task: "${input.prompt.substring(0, 100)}..."`,
    );
    this.orchestratorLogger.log(
      `🔍 DEBUG - Orchestrator facade service available: ${!!this.orchestratorFacadeService}`,
    );

    try {
      // Add orchestrator-specific context to the input
      const orchestratorInput: OrchestratorInput = {
        ...input,
        metadata: {
          ...input.metadata,
          agentType: 'orchestrator',
          agentName: this.getAgentName(),
          hierarchyLevel: this.getHierarchyLevel(),
          authorityLevel: this.getAuthorityLevel(),
          scope: this.getScope(),
        },
      };

      // Route through the orchestrator facade with intelligent handling
      // Use an invalid method to trigger handleIntelligentRouting (default case)
      this.orchestratorLogger.log(
        `🔍 DEBUG - About to call facade processRequest with delegation context: ${!!this.delegationContext}`,
      );
      if (this.delegationContext) {
        this.orchestratorLogger.log(
          `🔍 DEBUG - Delegation context length: ${this.delegationContext.length}`,
        );
      }

      const response = await this.orchestratorFacadeService.processRequest(
        'intelligent_routing' as OrchestratorA2AMethod, // This will trigger handleIntelligentRouting via default case
        orchestratorInput,
        this.delegationContext, // Pass the delegation context so LLM knows available agents
      );

      this.orchestratorLogger.log(
        `🔍 DEBUG - Facade processRequest completed, response received`,
      );

      // Debug: Log the raw response before enhancement
      this.orchestratorLogger.log(
        `🔍 DEBUG - Raw facade response: ${JSON.stringify(response, null, 2)}`,
      );

      // Enhance response with orchestrator-specific metadata
      const enhancedResponse: OrchestratorResponse = {
        ...response,
        metadata: {
          ...response.metadata,
          agentType: 'orchestrator' as const,
          agentName: this.getAgentDisplayName(),
          processedAt: new Date().toISOString(),
          hierarchyLevel: this.getHierarchyLevel(),
          capabilities: this.getCapabilities(),
        },
      };

      this.orchestratorLogger.log(
        `🔍 DEBUG - Enhanced response: ${JSON.stringify(enhancedResponse, null, 2)}`,
      );
      return enhancedResponse;
    } catch (error) {
      this.orchestratorLogger.error(
        'Orchestrator task execution failed:',
        error,
      );

      return {
        success: false,
        message: `Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator' as const,
          agentName: this.getAgentDisplayName(),
          processedAt: new Date().toISOString(),
          error: true,
          hierarchyLevel: this.getHierarchyLevel(),
        },
      };
    }
  }

  /**
   * Handle strategic planning requests
   */
  async planStrategicInitiative(
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    const strategicInput: OrchestratorInput = {
      ...input,
      prompt: `As ${this.getAgentName()}, plan this strategic initiative: ${input.prompt}`,
      metadata: {
        ...input.metadata,
        initiativeType: 'strategic',
        scope: this.getScope(),
        authorityLevel: this.getAuthorityLevel(),
      },
    };

    return await this.orchestratorFacadeService.processRequest(
      'explicit_create_project',
      strategicInput,
    );
  }

  /**
   * Handle delegation to subordinate agents/orchestrators
   */
  async delegateToAgent(
    agentName: string,
    task: string,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    const delegationInput: OrchestratorInput = {
      ...input,
      prompt: `Delegation from ${this.getAgentName()}: ${task}`,
      metadata: {
        ...input.metadata,
        targetAgent: agentName,
        delegationType: `${this.getHierarchyLevel()}_delegation`,
        task,
        authorityLevel: this.getAuthorityLevel(),
      },
    };

    return await this.orchestratorFacadeService.processRequest(
      'delegate_task',
      delegationInput,
    );
  }

  // ============================================================================
  // ABSTRACT METHODS - Implemented by specific orchestrator agents
  // ============================================================================

  /**
   * Get hierarchy level (executive, manager, specialist)
   */
  protected getHierarchyLevel(): string {
    // Can be overridden by specific orchestrators, default based on agent name
    if (this.getAgentName().includes('ceo')) return 'executive';
    if (
      this.getAgentName().includes('cto') ||
      this.getAgentName().includes('cmo') ||
      this.getAgentName().includes('cfo')
    )
      return 'executive';
    if (this.getAgentName().includes('manager')) return 'manager';
    return 'specialist';
  }

  /**
   * Get authority level for delegation
   */
  protected getAuthorityLevel(): string {
    return this.getHierarchyLevel();
  }

  /**
   * Get orchestrator scope
   */
  protected getScope(): string {
    const level = this.getHierarchyLevel();
    if (level === 'executive') return 'enterprise';
    if (level === 'manager') return 'department';
    return 'team';
  }

  /**
   * Get display name for responses
   */
  protected getAgentDisplayName(): string {
    return this.getAgentName()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Get orchestrator capabilities
   */
  protected getCapabilities(): string[] {
    const level = this.getHierarchyLevel();
    const baseCapabilities = [
      'delegation',
      'project_management',
      'conversation',
    ];

    if (level === 'executive') {
      return [
        ...baseCapabilities,
        'strategic_planning',
        'cross_functional_coordination',
        'resource_allocation',
        'performance_oversight',
      ];
    }
    if (level === 'manager') {
      return [
        ...baseCapabilities,
        'team_coordination',
        'tactical_planning',
        'performance_monitoring',
      ];
    }
    return baseCapabilities;
  }
}
