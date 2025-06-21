import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { EvaluationWrapperService } from '@agents/base/sub-services/evaluation-wrapper/evaluation-wrapper.service';

/**
 * Travel Planner External A2A Agent Service
 * 
 * This service acts as a local proxy for the Travel Planner A2A agent.
 * It provides advanced travel planning capabilities including flight search,
 * hotel booking, weather forecasting, and itinerary planning with multi-agent coordination.
 */
@Injectable()
export class TravelPlannerAgentService extends ExternalA2AAgentBaseService {

  constructor(
    httpService: HttpService,
    configurationService: ConfigurationService,
    agentRegistrationService: AgentRegistrationService,
    loggingService?: LoggingService,
    evaluationService?: EvaluationWrapperService,
  ) {
    super(httpService, configurationService, agentRegistrationService, loggingService, evaluationService);
    this.logger.log('🔗 Travel Planner External A2A Agent Service initialized');
  }

  /**
   * Override getAgentName to provide a specific name for this agent
   */
  public getAgentName(): string {
    return 'travel-planner';
  }

  /**
   * Override getAgentType to specify this is an external agent
   */
  public getAgentType(): string {
    return 'external';
  }

  /**
   * Custom initialization logic specific to Travel Planner agent
   */
  async onModuleInit(): Promise<void> {
    try {
      // Call parent initialization first
      await super.onModuleInit();
      
      this.logger.log('✅ Travel Planner Agent proxy ready');
      
      // Optional: Perform Travel Planner-specific initialization
      // For example, validate API keys, check external service availability
      await this.validateTravelServices();
      
    } catch (error) {
      this.logger.error('❌ Failed to initialize Travel Planner Agent:', error);
      throw error;
    }
  }

  /**
   * Optional: Override executeTask for Travel Planner-specific behavior
   * This can add travel-specific logging, validation, or transformation
   */
  async executeTask(method: string, params: any): Promise<any> {
    this.logger.debug(`🎯 Travel Planner executing: ${method}`);
    
    // Add travel-specific context to the request
    const enrichedParams = {
      ...params,
      metadata: {
        ...params.metadata,
        agentType: 'travel-planner',
        timestamp: new Date().toISOString(),
        requestId: `travel-${Date.now()}`
      }
    };

    // Call parent implementation with enriched parameters
    return super.executeTask(method, enrichedParams);
  }

  /**
   * Validate that required travel services are available
   * This is a placeholder for actual service validation
   */
  private async validateTravelServices(): Promise<void> {
    try {
      // Check if required environment variables are set
      const requiredEnvVars = [
        'TRAVEL_PLANNER_ENDPOINT',
        'TRAVEL_PLANNER_API_KEY',
        'OPENWEATHER_API_KEY',
        'BRAVE_SEARCH_API_KEY'
      ];

      const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingEnvVars.length > 0) {
        this.logger.warn(`⚠️ Missing environment variables: ${missingEnvVars.join(', ')}`);
        this.logger.warn('Travel Planner may have limited functionality');
      } else {
        this.logger.debug('✅ All required environment variables are set');
      }

      // Additional service validation can be added here
      // For example, test connectivity to external APIs
      
    } catch (error) {
      this.logger.warn('⚠️ Travel service validation failed:', error);
      // Don't throw here - allow the agent to start even if validation fails
    }
  }
} 