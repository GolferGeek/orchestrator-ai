import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { AgentFunctionParams, AgentFunctionResponse } from '../a2a-base/interfaces';
import { LLMService } from '../../llm/llm.service';

/**
 * Function Agent Base Service that uses pre-loaded functions from AgentDiscoveryService
 * This provides clean function execution with proper error handling and fallback capabilities
 */
@Injectable()
export class FunctionAgentBaseService extends A2AAgentBaseService {
  protected readonly functionLogger = new Logger(FunctionAgentBaseService.name);
  private agentFunction: any = null;

  constructor(
    protected readonly llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(httpService, contextService);
  }

  /**
   * Set the pre-loaded agent function from AgentDiscoveryService
   */
  setAgentFunction(agentFunction: any): void {
    this.agentFunction = agentFunction;
    this.functionLogger.debug(`Pre-loaded function set for ${this.getAgentName()}`);
  }

  /**
   * Simple task execution using pre-loaded agent function
   */
  protected async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    
    try {
      // If no pre-loaded function, fall back to context processing
      if (!this.agentFunction || typeof this.agentFunction !== 'function') {
        this.functionLogger.debug(`No pre-loaded function for ${agentName}, using context fallback`);
        return this.processWithContext(method, params);
      }

      // Prepare standardized parameters for the agent function
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: this.llmService,
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString()
        }
      };

      // Execute the pre-loaded agent function
      const result = await this.agentFunction(functionParams);
      
      this.functionLogger.debug(`Function executed successfully for ${agentName}`);
      
      // Return structured response format to match ContextAgentBaseService
      return {
        success: true,
        response: result.response || result,
        metadata: {
          agentName: agentName,
          agentType: this.getAgentType(),
          functionStatus: 'executed',
          processedAt: new Date().toISOString(),
          ...functionParams.metadata
        }
      };
      
    } catch (error) {
      this.functionLogger.error(`Function execution error for ${agentName}:`, error);
      
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
          processedAt: new Date().toISOString()
        }
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
      const messageProps = ['message', 'userMessage', 'prompt', 'input', 'content', 'text'];
      
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
  private async processWithContext(method: string, params: any): Promise<any> {
    this.functionLogger.debug(`Using context fallback for ${this.getAgentName()}`);
    
    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} agent. I'm ready to help, but my function isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        functionStatus: 'fallback',
        reason: 'No pre-loaded function available',
        method,
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get agent card with function status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      functionStatus: this.agentFunction ? 'loaded' : 'not_loaded',
      loadedAt: this.agentFunction ? new Date().toISOString() : null
    };
  }
} 