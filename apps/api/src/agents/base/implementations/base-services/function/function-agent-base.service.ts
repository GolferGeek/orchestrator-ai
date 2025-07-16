import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentRegistrationService } from '../../../sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '../../../sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '../../../sub-services/logging/logging.service';
import { AuthService } from '../../../sub-services/auth/auth.service';
import { ConfigurationService } from '../../../sub-services/configuration/configuration.service';
import { AgentFunctionParams } from '../a2a-base/interfaces';

export interface AgentFunctionResponse {
  response: string;
  metadata?: any;
}

/**
 * Function Agent Base Service that uses pre-loaded functions from AgentDiscoveryService
 * This provides clean function execution with proper error handling and fallback capabilities
 */
@Injectable()
export class FunctionAgentBaseService extends A2AAgentBaseService {
  protected readonly functionLogger = new Logger(FunctionAgentBaseService.name);
  private agentFunction: any = null;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly llmService: LLMService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    super(
      httpService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );
  }

  /**
   * Set the pre-loaded agent function from AgentDiscoveryService
   */
  setAgentFunction(agentFunction: any): void {
    this.agentFunction = agentFunction;
    this.functionLogger.debug(
      `Pre-loaded function set for ${this.getAgentName()}`,
    );
  }

  /**
   * Simple task execution using pre-loaded agent function
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();

    try {
      // If no pre-loaded function, fall back to context processing
      if (!this.agentFunction || typeof this.agentFunction !== 'function') {
        this.functionLogger.debug(
          `No pre-loaded function for ${agentName}, using context fallback`,
        );
        return this.processWithContext(method, params);
      }

      // Create a wrapper LLM service that tracks metadata and applies user preferences
      const llmMetadataTracker = {
        calls: [] as any[],
        totalCost: 0,
        totalTokens: { input: 0, output: 0 },
      };

      const wrappedLLMService = {
        ...this.llmService,
        generateResponse: async (
          systemPrompt: string,
          userMessage: string,
          options?: any,
        ) => {
          // Merge user preferences with function options
          const mergedOptions = {
            ...options,
            providerId: params.providerId || options?.providerId,
            modelId: params.modelId || options?.modelId,
            temperature: params.temperature ?? options?.temperature,
            maxTokens: params.maxTokens || options?.maxTokens,
            cidafmOptions: params.cidafmOptions || options?.cidafmOptions,
            authToken: params.authToken || options?.authToken,
            sessionId: params.sessionId || options?.sessionId,
          };

          const result = await this.llmService.generateResponse(
            systemPrompt,
            userMessage,
            mergedOptions,
          );

          // Track metadata if this was an enhanced response
          if (typeof result === 'object' && result.llmMetadata) {
            llmMetadataTracker.calls.push(result.llmMetadata);
            if (result.costCalculation) {
              llmMetadataTracker.totalCost += result.costCalculation.totalCost;
            }
            if (result.usage) {
              llmMetadataTracker.totalTokens.input +=
                result.usage.inputTokens || 0;
              llmMetadataTracker.totalTokens.output +=
                result.usage.outputTokens || 0;
            }
          }

          return result;
        },
      };

      // Prepare standardized parameters for the agent function
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: wrappedLLMService,
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString(),
        },
      };

      // Execute the pre-loaded agent function
      const result = await this.agentFunction(functionParams);

      this.functionLogger.debug(
        `Function executed successfully for ${agentName}`,
      );

      // Aggregate LLM metadata from all calls
      const aggregatedLLMMetadata =
        llmMetadataTracker.calls.length > 0
          ? {
              primaryLLM: llmMetadataTracker.calls[0], // First/main LLM call
              totalCalls: llmMetadataTracker.calls.length,
              totalCost: llmMetadataTracker.totalCost,
              totalTokens: llmMetadataTracker.totalTokens,
              allCalls: llmMetadataTracker.calls,
            }
          : undefined;

      // Return structured response format to match ContextAgentBaseService
      return {
        success: true,
        response: result.response || result,
        metadata: {
          agentType: this.getAgentType(),
          functionStatus: 'executed',
          processedAt: new Date().toISOString(),
          ...functionParams.metadata,
          ...(result.metadata || {}),
          // Include aggregated LLM metadata
          ...(aggregatedLLMMetadata && {
            llmUsed: aggregatedLLMMetadata.primaryLLM,
            usage: {
              inputTokens: aggregatedLLMMetadata.totalTokens.input,
              outputTokens: aggregatedLLMMetadata.totalTokens.output,
              totalCost: aggregatedLLMMetadata.totalCost,
            },
            llmCallsSummary: {
              totalCalls: aggregatedLLMMetadata.totalCalls,
              totalCost: aggregatedLLMMetadata.totalCost,
              allModelsUsed: aggregatedLLMMetadata.allCalls.map(
                (call) => call.modelName,
              ),
            },
          }),
        },
      };
    } catch (error) {
      this.functionLogger.error(
        `Function execution error for ${agentName}:`,
        error,
      );

      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `I apologize, but I encountered an error while processing your request. Falling back to basic processing.`,
        metadata: {
          agentName: agentName,
          agentType: this.getAgentType(),
          functionStatus: 'error',
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Extract user message from parameters
   */
  private extractUserMessage(params: any): string {
    if (typeof params === 'string') {
      return params;
    }

    if (params && typeof params === 'object') {
      const messageProps = [
        'message',
        'userMessage',
        'prompt',
        'input',
        'content',
        'text',
      ];

      for (const prop of messageProps) {
        if (params[prop] && typeof params[prop] === 'string') {
          return params[prop];
        }
      }

      return JSON.stringify(params);
    }

    return String(params || '');
  }

  /**
   * Simple context-based fallback processing
   */
  private async processWithContext(method: string, _params: any): Promise<any> {
    this.functionLogger.debug(
      `Using context fallback for ${this.getAgentName()}`,
    );

    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} agent. I'm ready to help, but my function isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        functionStatus: 'fallback',
        reason: 'No pre-loaded function available',
        method,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   * Delegates to appropriate sub-services as needed
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.functionLogger.debug(`Agent path set to: ${path}`);

    // If we need to notify sub-services about the path change, we could do it here
    // For now, just setting the path is sufficient
  }

  /**
   * Get agent card with function status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      functionStatus: this.agentFunction ? 'loaded' : 'not_loaded',
      loadedAt: this.agentFunction ? new Date().toISOString() : null,
    };
  }
}
