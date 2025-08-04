import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { 
  IOrchestratorFacadeService,
  OrchestratorInput,
  OrchestratorResponse 
} from '../../../../orchestration/orchestration.types';

/**
 * Marketing Manager Orchestrator Service
 * 
 * Strategic marketing orchestrator for coordinating campaigns, content, and brand initiatives.
 * Reports to CEO and manages all marketing specialist agents with sophisticated 
 * project planning and execution capabilities.
 */
@Injectable()
export class MarketingManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(MarketingManagerOrchestratorService.name);
  
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
    return 'marketing_manager_orchestrator';
  }

  // getAgentType() is inherited from base class and returns 'orchestrator'

  /**
   * Execute marketing orchestration planning
   * 
   * Extension method for marketing-specific orchestration capabilities.
   */
  async executeMarketingTask(input: OrchestratorInput): Promise<OrchestratorResponse> {
    this.logger.log(`Marketing Manager Orchestrator executing task: "${input.prompt.substring(0, 100)}..."`);
    
    try {
      // Add marketing manager-specific context to the input
      const marketingInput: OrchestratorInput = {
        ...input,
        metadata: {
          ...input.metadata,
          agentType: 'orchestrator',
          agentName: 'marketing_manager_orchestrator',
          hierarchyLevel: 'manager',
          department: 'marketing',
          reportsTo: 'ceo_orchestrator',
          scope: 'marketing'
        }
      };

      // Route through the orchestrator facade with intelligent handling
      const response = await this.orchestratorFacadeService.processRequest(
        'converse', // Let intent recognition determine the best action
        marketingInput
      );

      // Enhance response with marketing manager-specific metadata
      return {
        ...response,
        metadata: {
          ...response.metadata,
          agentType: 'orchestrator',
          agentName: 'Marketing Manager Orchestrator',
          processedAt: new Date().toISOString(),
          hierarchyLevel: 'manager',
          department: 'marketing',
          reportsTo: 'ceo_orchestrator',
          capabilities: [
            'marketing_strategy',
            'campaign_planning',
            'content_coordination',
            'brand_management',
            'customer_engagement',
            'market_research',
            'performance_analytics'
          ],
          managedAgents: [
            'marketing_swarm',
            'blog_post_writer', 
            'content_writer',
            'research_agent'
          ]
        }
      };
      
    } catch (error) {
      this.logger.error('Marketing Manager Orchestrator task execution failed:', error);
      
      return {
        success: false,
        message: `Marketing orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Marketing Manager Orchestrator',
          processedAt: new Date().toISOString(),
          error: true,
          department: 'marketing',
          hierarchyLevel: 'manager'
        }
      };
    }
  }

  /**
   * Handle marketing campaign planning
   */
  async planMarketingCampaign(input: OrchestratorInput): Promise<OrchestratorResponse> {
    const campaignInput: OrchestratorInput = {
      ...input,
      prompt: `As Marketing Manager, plan this integrated marketing campaign: ${input.prompt}`,
      metadata: {
        ...input.metadata,
        campaignType: 'integrated',
        scope: 'marketing',
        department: 'marketing'
      }
    };

    return await this.orchestratorFacadeService.processRequest('create_project', campaignInput);
  }

  /**
   * Handle delegation to marketing specialists
   */
  async delegateToSpecialist(specialistName: string, task: string, input: OrchestratorInput): Promise<OrchestratorResponse> {
    const delegationInput: OrchestratorInput = {
      ...input,
      prompt: `Marketing delegation: ${task}`,
      metadata: {
        ...input.metadata,
        agentName: specialistName,
        delegationType: 'manager_to_specialist',
        department: 'marketing',
        task
      }
    };

    return await this.orchestratorFacadeService.processRequest('delegate_task', delegationInput);
  }

  /**
   * Handle content coordination across multiple agents
   */
  async coordinateContentCreation(contentPlan: string, input: OrchestratorInput): Promise<OrchestratorResponse> {
    const contentInput: OrchestratorInput = {
      ...input,
      prompt: `Coordinate content creation across marketing team: ${contentPlan}`,
      metadata: {
        ...input.metadata,
        projectType: 'content_coordination',
        scope: 'marketing',
        coordinationType: 'multi_agent'
      }
    };

    return await this.orchestratorFacadeService.processRequest('create_project', contentInput);
  }

  /**
   * Report to CEO with marketing insights and recommendations
   */
  async reportToCEO(findings: string, recommendations: string, input: OrchestratorInput): Promise<OrchestratorResponse> {
    const reportInput: OrchestratorInput = {
      ...input,
      prompt: `Marketing report to CEO: ${findings}. Recommendations: ${recommendations}`,
      metadata: {
        ...input.metadata,
        agentName: 'ceo_orchestrator',
        delegationType: 'manager_to_executive',
        reportType: 'marketing_insights',
        escalation: true
      }
    };

    return await this.orchestratorFacadeService.processRequest('delegate_task', reportInput);
  }
}