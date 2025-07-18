import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentContextService } from '../a2a-base/agent-context.service';

/**
 * Context Agent Base Service that processes context-based requests using LLM
 * This provides context-aware processing with proper error handling and fallback capabilities
 */
@Injectable()
export class ContextAgentBaseService extends A2AAgentBaseService {
  protected readonly contextLogger = new Logger(ContextAgentBaseService.name);
  private contextData: string | null = null;
  protected readonly agentContextService = new AgentContextService();

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
   * Set context data for this agent (called by AgentDiscoveryService)
   */
  setContextData(contextData: string): void {
    this.contextData = contextData;
    this.contextLogger.debug(
      `Context data set, length: ${contextData?.length || 0}`,
    );
  }

  /**
   * Simple task execution using context and LLM
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    const agentType = this.getAgentType();

    try {
      // Extract user message from params
      const userMessage = this.extractUserMessage(params);

      // Check if this is a simple greeting request
      if (this.isGreeting(userMessage)) {
        const greeting = this.generatePersonalizedGreeting(agentName);
        return {
          success: true,
          response: greeting,
          metadata: {
            agentName: agentName,
            agentType: agentType,
            responseType: 'greeting',
            processedAt: new Date().toISOString(),
          },
        };
      }

      // If no context data available, use fallback
      if (!this.contextData) {
        return this.processWithoutContext(method, params, agentName, agentType);
      }

      // Process with LLM using context
      const systemPrompt = this.buildSystemPrompt(agentName, agentType);

      // Check if conversation history is provided
      const conversationHistory = params.conversationHistory || [];
      let llmResult;

      if (conversationHistory.length > 0) {
        // Use conversation-aware LLM processing
        const formattedHistory = conversationHistory.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }));

        this.contextLogger.debug(
          `Processing with ${conversationHistory.length} conversation history messages`,
        );

        llmResult = await this.llmService.generateResponseWithHistory(
          systemPrompt,
          formattedHistory,
          userMessage,
        );
      } else {
        // Use standard LLM processing for first message
        llmResult = await this.llmService.generateResponse(
          systemPrompt,
          userMessage,
          params, // Pass all params including LLM preferences
        );
      }

      // Extract response content and metadata
      const responseContent =
        typeof llmResult === 'string' ? llmResult : llmResult.content;
      const llmMetadata =
        typeof llmResult === 'object' ? llmResult.llmMetadata : undefined;

      return {
        success: true,
        response: responseContent,
        metadata: {
          agentName: agentName,
          agentType: agentType,
          contextUsed: true,
          contextLength: this.contextData.length,
          processedAt: new Date().toISOString(),
          // Include LLM information used for this response
          ...(llmMetadata && {
            llmUsed: llmMetadata,
            usage: typeof llmResult === 'object' ? llmResult.usage : undefined,
            costCalculation:
              typeof llmResult === 'object'
                ? llmResult.costCalculation
                : undefined,
          }),
        },
      };
    } catch (error) {
      this.contextLogger.error(`Error in executeTask for ${agentName}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response:
          'I apologize, but I encountered an error while processing your request.',
        metadata: {
          agentName: agentName,
          agentType: agentType,
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
        'userMessage',
        'message',
        'prompt',
        'input',
        'request',
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
   * Check if message is a greeting
   */
  private isGreeting(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return (
      lowerMessage === 'hello' ||
      lowerMessage === 'hi' ||
      lowerMessage.includes('can i talk to')
    );
  }

  /**
   * Build system prompt using context data
   */
  private buildSystemPrompt(agentName: string, agentType: string): string {
    let prompt = `You are ${agentName}, a ${agentType} agent. Help the user with their request.`;

    if (this.contextData) {
      prompt += `\n\nHere is your context information:\n${this.contextData}`;
      prompt += `\n\nUse this context to provide accurate and helpful responses. If the user's question is not covered by the context, say so and provide general assistance.`;
    }

    return prompt;
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
   * Fallback processing when no context is available
   */
  private async processWithoutContext(
    method: string,
    params: any,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    this.contextLogger.debug(
      `No context available for ${agentName}, using fallback`,
    );

    return {
      success: true,
      response: `Hello! I'm the ${agentName} agent. I'm ready to help, but my context data isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: agentName,
        agentType: agentType,
        contextUsed: false,
        reason: 'No context data available',
        method,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.contextLogger.debug(`Agent path set to: ${path}`);
  }

  /**
   * Get agent card with context status and skills from YAML
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();

    // Include skills from AgentContextService if available
    const skills = this.agentContextService.isLoaded
      ? this.agentContextService.skills
      : [];
    const name = this.agentContextService.isLoaded
      ? this.agentContextService.name
      : baseCard.name;
    const description = this.agentContextService.isLoaded
      ? this.agentContextService.description
      : baseCard.description || '';

    return {
      ...baseCard,
      name,
      description,
      skills,
      contextStatus: this.contextData ? 'loaded' : 'not_loaded',
      contextLength: this.contextData?.length || 0,
      loadedAt: this.contextData ? new Date().toISOString() : null,
    };
  }

  /**
   * Initialize context from agent directory (called by AgentFactoryService)
   */
  async initializeContext(agentDirectory: string): Promise<void> {
    try {
      await this.agentContextService.initialize(agentDirectory);
      this.contextLogger.debug(
        `Context initialized for ${this.agentContextService.name}, skills: ${this.agentContextService.skills.length}`,
      );
    } catch (error) {
      this.contextLogger.error('Failed to initialize agent context:', error);
    }
  }
}
