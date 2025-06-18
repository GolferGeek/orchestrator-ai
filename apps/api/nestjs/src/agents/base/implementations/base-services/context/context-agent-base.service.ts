import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import OpenAI from 'openai';

@Injectable()
export class ContextAgentBaseService extends A2AAgentBaseService {
  private readonly contextLogger = new Logger(ContextAgentBaseService.name);
  private readonly openai: OpenAI;

  constructor(
    protected readonly httpService: HttpService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService
  ) {
    super(
      httpService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService
    );
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Simple execution: take user prompt and process with LLM
   */
  public async executeTask(method: string, params: any): Promise<any> {
    try {
      // Check if OpenAI API key is available
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.contextLogger.error('OpenAI API key not found');
        return {
          success: false,
          error: 'OpenAI API key not configured',
          response: 'I apologize, but the OpenAI API key is not properly configured.'
        };
      }

      // Get agent info from context service or fallback to defaults
      const agentName = this.getAgentName();
      const agentType = this.getAgentType();
      
      // Debug logging
      this.contextLogger.debug(`executeTask - agentName: ${agentName}, agentType: ${agentType}`);
      
      // Extract user message from params
      const userMessage = params.userMessage || params.prompt || params.input || params.request || JSON.stringify(params);
      
      // Check if this is a simple greeting request
      const isGreeting = userMessage.toLowerCase().trim() === 'hello' || 
                        userMessage.toLowerCase().trim() === 'hi' || 
                        userMessage.toLowerCase().includes('can i talk to');
      
      if (isGreeting) {
        // For greeting requests, provide a personalized response
        const greeting = this.generatePersonalizedGreeting(agentName);
        return {
          success: true,
          response: greeting,
          metadata: {
            agentName: agentName,
            agentType: agentType,
            responseType: 'greeting',
            processedAt: new Date().toISOString()
          }
        };
      }
      
      // Build the request for OpenAI
      const requestData = {
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system' as const,
            content: `You are ${agentName}, a ${agentType} agent. Help the user with their request.`
          },
          {
            role: 'user' as const,
            content: userMessage
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      };

      // Call OpenAI
      const completion = await this.openai.chat.completions.create(requestData);
      const response = completion.choices[0]?.message?.content || 'I was unable to generate a response.';
      
      return {
        success: true,
        response,
        metadata: {
          model: completion.model,
          usage: completion.usage,
          agentName: agentName,
          agentType: agentType,
          contextFiles: [],
          processedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.contextLogger.error(`Error in executeTask: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        response: 'I apologize, but I encountered an error while processing your request.'
      };
    }
  }

  /**
   * Generate a personalized greeting based on the agent name
   */
  private generatePersonalizedGreeting(agentName: string): string {
    // For now, use a placeholder name - in a real system this would come from user session data
    const userName = 'Golfer Geek'; // This could be extracted from session/auth context in the future
    
    switch (agentName.toLowerCase()) {
      case 'blog post writer':
      case 'blog_post':
        return `Hi ${userName}! I'm your Blog Post Writer. I'm here to help you create engaging, professional blog posts on any topic you'd like. What can I write for you today?`;
      
      case 'metrics agent':
      case 'metrics':
        return `Hello ${userName}! I'm your Metrics Agent. I can help you analyze business data, create reports, and provide insights. What metrics would you like to explore?`;
      
      case 'chat support':
        return `Hi ${userName}! I'm your Chat Support specialist. I'm here to help resolve any issues or answer questions you might have. How can I assist you today?`;
      
      default:
        return `Hello ${userName}! I'm your ${agentName} agent. I'm ready to help you with whatever you need. What can I do for you today?`;
    }
  }

  /**
   * Handle A2A task requests
   */
  async processTask(taskRequest: any): Promise<any> {
    return this.executeTask('processTask', taskRequest);
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   * Delegates to appropriate sub-services as needed
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.contextLogger.debug(`Agent path set to: ${path}`);
    
    // If we need to notify sub-services about the path change, we could do it here
    // For now, just setting the path is sufficient
  }
} 