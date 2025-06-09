import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../../base/services/base-services/a2a-base/a2a-agent-base.service';
import { LLMService } from '../../base/services/llm/llm.service';

interface AvailableAgent {
  name: string;
  description: string;
  path: string;
  url: string;
  type: string;
  capabilities: string[];
}

@Injectable()
export class OrchestratorService extends A2AAgentBaseService {
  private readonly orchestratorLogger = new Logger(OrchestratorService.name);
  private readonly baseApiUrl: string;
  private availableAgents: AvailableAgent[] = [];

  constructor(httpService: HttpService, private readonly llmService: LLMService) {
    super(httpService);
    // Get base API URL from environment variables
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '4000';
    this.baseApiUrl = `http://${apiHost}:${apiPort}`;
  }

  /**
   * Initialize the orchestrator after module initialization
   */
  async onModuleInit() {
    await super.onModuleInit();
    // Initialize available agents from the agent pool
    await this.initializeAvailableAgents();
  }

  /**
   * Execute task using the centralized LLM service
   * The orchestrator determines whether to delegate to specialists or respond conversationally
   */
  protected async executeTask(method: string, params: any): Promise<any> {
    this.orchestratorLogger.log(`Orchestrator processing request with method: ${method}`);

    try {
      // Extract the request content from various possible parameter structures
      const request = params.request || params.message || params.input || params.task || 
                     params.prompt || JSON.stringify(params) || '';
      
      // Special handling for getAvailableAgents requests
      if (method === 'getAvailableAgents' || request.toLowerCase().includes('available agents')) {
        return this.availableAgents;
      }
      
      // For all other requests, orchestrate (delegate or respond)
      return await this.orchestrateRequest(request);
      
    } catch (error) {
      this.orchestratorLogger.error(`Error processing request:`, error);
      throw error;
    }
  }

  /**
   * Orchestrate a request - decide whether to delegate or respond directly
   */
  private async orchestrateRequest(request: string): Promise<any> {
    try {
      this.orchestratorLogger.log(`Orchestrating request: "${request}"`);

      // Get orchestration decision from LLM
      const agentNames = this.availableAgents.map(a => a.name);
      const decision = await this.llmService.generateOrchestrationDecision(request, agentNames);
      
      this.orchestratorLogger.log(`Orchestration decision: ${decision.action} - ${decision.reasoning || 'No reasoning provided'}`);

      switch (decision.action) {
        case 'delegate':
          if (decision.agent) {
            return await this.delegateToAgent(decision.agent, request);
          } else {
            return this.createResponse('I wanted to delegate your request, but could not determine the appropriate agent. Let me help you directly instead.');
          }

        case 'respond_directly':
          return this.createResponse(decision.response || 'Hello! I\'m your AI orchestrator. How can I assist you today?');

        case 'clarify':
          return this.createResponse(decision.response || 'Could you provide more details about what you need help with?');

        default:
          return this.createResponse('I\'m here to help! Could you tell me more about what you need?');
      }

    } catch (error) {
      this.orchestratorLogger.error('Error orchestrating request:', error);
      return this.createResponse('I apologize, but I encountered an error while processing your request. Please try again.');
    }
  }

  /**
   * Delegate request to a specific agent
   */
  private async delegateToAgent(agentName: string, request: string): Promise<any> {
    try {
      // Find the agent in the available agents list
      const agent = this.availableAgents.find(a => 
        a.name.toLowerCase().includes(agentName.toLowerCase()) ||
        agentName.toLowerCase().includes(a.name.toLowerCase()) ||
        (agentName.toLowerCase().includes('blog') && a.name.toLowerCase().includes('blog'))
      );
      
      if (!agent) {
        this.orchestratorLogger.warn(`Agent not found: ${agentName}`);
        return this.createResponse('I could not find the appropriate specialist agent for your request.');
      }

      const agentUrl = agent.url;
      
      // Just pass the raw request without imposing any method structure
      // Let the specialist agent decide how to handle it
      const payload = {
        jsonrpc: '2.0',
        method: 'handle_request', // Generic method that all agents understand
        params: { prompt: request }, // Send as a prompt for the agent to process
        id: 1
      };

      this.orchestratorLogger.log(`Delegating to agent at: ${agentUrl}`);
      
      const response = await this.httpService!.axiosRef!.post(agentUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      // Handle JSON-RPC response format where actual response is in 'result' field
      const agentResponse = response.data?.result || response.data;

      if (agentResponse?.success) {
        return {
          success: true,
          response: `**Delegated to ${agent.name} Agent:**\n\n${agentResponse.response}`,
          metadata: {
            delegatedTo: agent.name,
            originalAgent: agentResponse.metadata || {},
            processedAt: new Date().toISOString()
          }
        };
      } else if (response.data?.error || agentResponse?.error) {
        this.orchestratorLogger.error('Delegated agent error:', response.data?.error || agentResponse?.error);
        return this.createResponse('I attempted to delegate your request to a specialist, but encountered an error. Let me try to help you directly instead.');
      }

      return this.createResponse('I successfully delegated your request, but received an unexpected response format.');
      
    } catch (error) {
      this.orchestratorLogger.error('Error delegating to agent:', error);
      return this.createResponse('I attempted to delegate your request to a specialist, but the service is currently unavailable. Let me try to help you directly instead.');
    }
  }

  /**
   * Create a standard response format
   */
  private createResponse(responseText: string): any {
    return {
      success: true,
      response: responseText,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Initialize available agents from agent pool
   */
  async initializeAvailableAgents(): Promise<void> {
    try {
      const response = await this.httpService!.axiosRef!.get(`${this.baseApiUrl}/agent-pool/agents`);
      if (response?.data && Array.isArray(response.data)) {
        this.availableAgents = response.data;
        this.orchestratorLogger.log(`Initialized with ${this.availableAgents.length} available agents from pool`);
      }
      
      // Add known working agents with correct URLs
      this.availableAgents.push({
        name: 'blog_post',
        description: 'Blog Post Writer',
        path: 'specialists/blog_post',
        url: `${this.baseApiUrl}/agents/specialists/blog_post/tasks`,
        type: 'specialists',
        capabilities: ['blog_writing', 'content_creation']
      });
      
      this.orchestratorLogger.log(`Total available agents: ${this.availableAgents.length}`);
    } catch (error) {
      this.orchestratorLogger.error('Error initializing available agents:', error);
    }
  }
}