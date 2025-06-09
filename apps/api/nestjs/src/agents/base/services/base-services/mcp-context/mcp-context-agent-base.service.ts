import { Injectable, Logger } from '@nestjs/common';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import OpenAI from 'openai';

@Injectable()
export class MCPContextAgentBaseService extends A2AAgentBaseService {
  private readonly mcpLogger = new Logger(MCPContextAgentBaseService.name);
  private readonly openai: OpenAI;

  constructor(httpService?: any, contextService?: AgentContextService) {
    super(httpService, contextService);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Simple execution: take user prompt and process with LLM
   */
  protected async executeTask(method: string, params: any): Promise<any> {
    try {
      // Check if OpenAI API key is available
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.mcpLogger.error('OpenAI API key not found');
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
      this.mcpLogger.debug(`executeTask - agentName: ${agentName}, agentType: ${agentType}`);
      
      // Extract user message from params
      const userMessage = params.userMessage || params.prompt || params.input || params.request || JSON.stringify(params);
      
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
      this.mcpLogger.error(`Error in executeTask: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        response: 'I apologize, but I encountered an error while processing your request.'
      };
    }
  }

  /**
   * Handle A2A task requests
   */
  async processTask(taskRequest: any): Promise<any> {
    return this.executeTask('processTask', taskRequest);
  }
} 