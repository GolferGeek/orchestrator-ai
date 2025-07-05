import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

interface AvailableAgent {
  name: string;
  description: string;
  path: string;
  url: string;
  type: string;
  capabilities: string[];
  metadata?: any;
}

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Delegate a request to a specific agent
   */
  async delegateToAgent(
    agent: AvailableAgent,
    request: string,
    sessionId?: string,
    authToken?: string,
    llmPreferences?: any,
  ): Promise<any> {
    try {
      this.logger.log(`Delegating to agent: ${agent.name} at ${agent.url}`);

      // Check if this is a greeting/introduction request
      const isGreetingRequest = this.isGreetingRequest(request);

      if (isGreetingRequest) {
        return this.createGreetingResponse(agent);
      }

      // Prepare the request payload
      const payload = this.prepareAgentPayload(
        request,
        sessionId,
        authToken,
        llmPreferences,
      );

      this.logger.log(
        `Sending payload to ${agent.name}:`,
        JSON.stringify(payload, null, 2),
      );

      // Make the request to the agent
      const response = await this.httpService.axiosRef.post(
        agent.url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          timeout: 30000,
        },
      );

      this.logger.log(`Response from ${agent.name}:`, response.status);

      // Process the response with delegation context
      return this.processAgentResponse(
        response.data,
        agent,
        llmPreferences?.delegationContext,
      );
    } catch (error) {
      this.logger.error(`Error delegating to ${agent.name}:`, error);
      return this.createErrorResponse(agent, error);
    }
  }

  /**
   * Create a greeting response for agent introduction
   */
  private createGreetingResponse(agent: AvailableAgent): any {
    const capabilities =
      agent.capabilities && agent.capabilities.length > 0
        ? agent.capabilities.join(', ')
        : 'various specialized tasks';

    const greeting = `Hello! I'm the ${agent.name}. I specialize in ${capabilities}. How can I help you today?`;

    return {
      success: true,
      response: greeting,
      metadata: {
        agentType: agent.type || 'specialist',
        agentName: agent.name,
        delegatedTo: agent.name,
        processedAt: new Date().toISOString(),
        isGreeting: true,
      },
    };
  }

  /**
   * Process and normalize agent response
   */
  private processAgentResponse(
    responseData: any,
    agent: AvailableAgent,
    delegationContext?: any,
  ): any {
    // Handle different response formats
    let processedResponse;

    // Extract delegation context from llmPreferences if available
    const delegationInfo = delegationContext || {};

    const baseMetadata = {
      agentType: agent.type || 'specialist',
      agentName: agent.name,
      delegatedTo: agent.name,
      processedAt: new Date().toISOString(),
      // Include delegation context information
      ...(delegationInfo.stickyContext && {
        stickyContext: delegationInfo.stickyContext,
        continuityReason: delegationInfo.continuityReason,
        confidence: delegationInfo.confidence,
        agentContext: delegationInfo.agentContext,
      }),
    };

    if (responseData?.result) {
      // JSON-RPC format
      processedResponse = {
        success: true,
        response: responseData.result.response || responseData.result,
        metadata: {
          ...responseData.result.metadata,
          ...baseMetadata,
        },
      };
    } else if (responseData?.response) {
      // Direct response format
      processedResponse = {
        success: true,
        response: responseData.response,
        metadata: {
          ...responseData.metadata,
          ...baseMetadata,
        },
      };
    } else if (typeof responseData === 'string') {
      // Simple string response
      processedResponse = {
        success: true,
        response: responseData,
        metadata: baseMetadata,
      };
    } else {
      // Fallback for unknown formats
      processedResponse = {
        success: true,
        response: JSON.stringify(responseData),
        metadata: {
          ...baseMetadata,
          originalFormat: 'unknown',
        },
      };
    }

    this.logger.log(
      `Processed response from ${agent.name}:`,
      processedResponse.response?.substring(0, 200) + '...',
    );
    return processedResponse;
  }

  /**
   * Create error response for failed delegation
   */
  private createErrorResponse(agent: AvailableAgent, error: any): any {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      response: `I attempted to connect you with the ${agent.name}, but the service is currently unavailable. Please try again later.`,
      metadata: {
        agentType: agent.type || 'specialist',
        agentName: agent.name,
        delegatedTo: agent.name,
        processedAt: new Date().toISOString(),
        error: errorMessage,
        delegationFailed: true,
      },
    };
  }

  /**
   * Check if the request is a greeting/introduction
   */
  private isGreetingRequest(request: string): boolean {
    const lowerRequest = request.toLowerCase();
    const greetingPatterns = [
      /^(hi|hello|hey)\s*$/,
      /can i talk to .*agent/,
      /introduce yourself/,
      /who are you/,
      /what do you do/,
    ];

    return greetingPatterns.some((pattern) => pattern.test(lowerRequest));
  }

  /**
   * Prepare the payload for agent communication
   */
  private prepareAgentPayload(
    request: string,
    sessionId?: string,
    authToken?: string,
    llmPreferences?: any,
  ): any {
    return {
      jsonrpc: '2.0',
      method: 'processTask',
      params: {
        message: request,
        userMessage: request,
        sessionId: sessionId,
        authToken: authToken,
        ...(llmPreferences && {
          providerId: llmPreferences.providerId,
          modelId: llmPreferences.modelId,
          cidafmOptions: llmPreferences.cidafmOptions,
        }),
      },
      id: `orchestrator-delegation-${Date.now()}`,
    };
  }
}
