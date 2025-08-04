import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { 
  IOrchestratorFacadeService,
  OrchestratorInput,
  OrchestratorResponse 
} from '../../../../orchestration/orchestration.types';

/**
 * CEO Orchestrator Service
 * 
 * Strategic orchestrator for executive-level planning and delegation.
 * Coordinates high-level business initiatives across all departments
 * through sophisticated project management and delegation capabilities.
 */
@Injectable()
export class CEOOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(CEOOrchestratorService.name);
  
  constructor(
    httpService: HttpService,
    @Inject('IOrchestratorFacadeService')
    orchestratorFacadeService: IOrchestratorFacadeService,
  ) {
    super(httpService, orchestratorFacadeService);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'ceo_orchestrator';
  }

  // getAgentType() is inherited from base class and returns 'orchestrator'

  /**
   * Execute CEO-level strategic planning
   * 
   * Extension method for CEO-specific orchestration capabilities.
   */
  async executeCEOTask(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`CEO Orchestrator executing task: "${input.prompt.substring(0, 100)}..."`);
    
    try {
      // Add CEO-specific context to the input
      const ceoInput: OrchestratorInput = {
        ...input,
        metadata: {
          ...input.metadata,
          agentType: 'orchestrator',
          agentName: 'ceo_orchestrator',
          hierarchyLevel: 'executive',
          authorityLevel: 'executive',
          scope: 'enterprise'
        }
      };

      // Route through the orchestrator facade with intelligent handling
      const response = await this.orchestratorFacadeService.processRequest(
        'converse', // Let intent recognition determine the best action
        ceoInput
      );

      // Enhance response with CEO-specific metadata
      return {
        ...response,
        metadata: {
          ...response.metadata,
          agentType: 'orchestrator',
          agentName: 'CEO Orchestrator',
          processedAt: new Date().toISOString(),
          hierarchyLevel: 'executive',
          capabilities: [
            'strategic_planning',
            'cross_functional_coordination', 
            'executive_decision_making',
            'resource_allocation',
            'performance_oversight'
          ]
        }
      };
      
    } catch (error) {
      this.logger.error('CEO Orchestrator task execution failed:', error);
      
      return {
        success: false,
        message: `CEO orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'CEO Orchestrator',
          processedAt: new Date().toISOString(),
          error: true,
          hierarchyLevel: 'executive'
        }
      };
    }
  }

  /**
   * Handle strategic planning requests
   */
  async planStrategicInitiative(input: OrchestratorInput): Promise<OrchestratorResponse> {
    const strategicInput: OrchestratorInput = {
      ...input,
      prompt: `As CEO, plan this strategic initiative with enterprise scope: ${input.prompt}`,
      metadata: {
        ...input.metadata,
        initiativeType: 'strategic',
        scope: 'enterprise',
        authorityLevel: 'executive'
      }
    };

    return await this.orchestratorFacadeService.processRequest('create_project', strategicInput);
  }

  /**
   * Handle cross-departmental delegation
   */
  async delegateToManager(managerName: string, initiative: string, input: OrchestratorInput): Promise<OrchestratorResponse> {
    const delegationInput: OrchestratorInput = {
      ...input,
      prompt: `Executive delegation: ${initiative}`,
      metadata: {
        ...input.metadata,
        agentName: managerName,
        delegationType: 'executive_to_manager',
        initiative,
        authorityLevel: 'executive'
      }
    };

    return await this.orchestratorFacadeService.processRequest('delegate_task', delegationInput);
  }
}