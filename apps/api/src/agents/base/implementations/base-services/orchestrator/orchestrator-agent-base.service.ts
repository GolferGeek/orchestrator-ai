import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { 
  OrchestratorA2AMethod, 
  OrchestratorInput, 
  OrchestratorResponse,
  ConversationMessage,
  IOrchestratorFacadeService
} from '../../../../../orchestration/orchestration.types';
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
  protected readonly orchestratorLogger = new Logger(OrchestratorAgentBaseService.name);
  protected delegationContext?: string;

  constructor(
    httpService: HttpService,
    protected readonly orchestratorFacadeService: IOrchestratorFacadeService,
  ) {
    super(httpService);
  }

  /**
   * A2A Entry Point - Single method that routes all orchestrator operations
   * 
   * This is the ONLY entry point for orchestrator functionality, maintaining
   * A2A compliance while enabling rich project orchestration capabilities.
   */
  public async executeTask(method: string, params: any): Promise<any> {
    this.orchestratorLogger.log(`Orchestrator processing A2A task: ${method}`);
    
    try {
      // Adapt A2A request to OrchestratorInput (conversation + tasks pattern)
      const input = await this.adaptA2AToOrchestratorInput(method, params);
      
      // Route through facade service (maintains single entry point principle)
      const response = await this.orchestratorFacadeService.processRequest(
        method as OrchestratorA2AMethod, 
        input
      );

      this.orchestratorLogger.log(`Orchestrator completed task: ${method}`);
      return response;

    } catch (error) {
      this.orchestratorLogger.error(`Orchestrator task failed: ${method}`, error);
      
      // Return A2A-compliant error response
      return {
        success: false,
        message: `Orchestrator failed to process task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator',
          agentName: this.getAgentName(),
          processedAt: new Date().toISOString(),
          error: true,
        }
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
      this.orchestratorLogger.log(`Orchestrator ${this.getAgentName()} initialized with delegation context`);
    } catch (error) {
      this.orchestratorLogger.warn(`Failed to load delegation context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load delegation context from file
   */
  private async loadDelegationContext(): Promise<void> {
    if (!this.agentPath || this.agentPath === 'unknown') {
      this.orchestratorLogger.warn('Agent path not available for delegation context loading');
      return;
    }

    const contextPath = path.join(
      process.cwd(), 
      'src', 
      'agents', 
      'actual', 
      this.agentPath, 
      'delegation.context.md'
    );

    if (fs.existsSync(contextPath)) {
      this.delegationContext = fs.readFileSync(contextPath, 'utf8');
      this.orchestratorLogger.log(`Loaded delegation context from: ${contextPath}`);
    } else {
      this.orchestratorLogger.warn(`Delegation context file not found: ${contextPath}`);
    }
  }

  /**
   * Adapt A2A request to OrchestratorInput (following conversation + tasks pattern)
   */
  private async adaptA2AToOrchestratorInput(method: string, params: any): Promise<OrchestratorInput> {
    // Extract standard fields that match conversation + tasks pattern
    const prompt = params.prompt || params.message || params.userMessage || '';
    const userId = params.currentUser?.id || params.userId || '';
    const conversationId = params.conversationId || '';
    
    // Extract conversation history (same as other agents)
    const conversationHistory: ConversationMessage[] = params.conversationHistory || [];
    
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
      }
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
}