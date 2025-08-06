import { Injectable, Logger } from '@nestjs/common';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { AgentServicesContext } from '../../services/agent-services-context';

/**
 * REFACTORED Context Agent Base Service using AgentServicesContext
 * 
 * Compare this to the original - instead of 10+ constructor parameters,
 * we now have just one service container parameter!
 */
@Injectable()
export class ContextAgentBaseServiceRefactored extends A2AAgentBaseService {
  protected readonly contextLogger = new Logger(ContextAgentBaseServiceRefactored.name);
  private contextData: string | null = null;
  protected readonly agentContextService = new AgentContextService();

  constructor(
    // Just ONE parameter instead of 10+!
    protected readonly services: AgentServicesContext,
  ) {
    super(
      services.httpService,
      services.taskStatusService,
      services.deliverablesService,
      services.agentRegistrationService,
      services.jsonRpcProtocolService,
      services.loggingService,
      services.authService,
      services.configurationService,
    );
  }

  // Access services through the container
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    const agentType = this.getAgentType();

    try {
      const userMessage = this.extractUserMessage(params);

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

      if (!this.contextData) {
        return this.processWithoutContext(method, params, agentName, agentType);
      }

      // Use services through the container
      const systemPrompt = this.buildSystemPrompt(agentName, agentType);
      const conversationHistory = params.conversationHistory || [];
      let llmResult;

      if (conversationHistory.length > 0) {
        const formattedHistory = conversationHistory.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }));

        llmResult = await this.services.llmService.generateResponseWithHistory(
          systemPrompt,
          formattedHistory,
          userMessage,
        );
      } else {
        llmResult = await this.services.llmService.generateResponse(
          systemPrompt,
          userMessage,
          params,
        );
      }

      const responseContent = typeof llmResult === 'string' ? llmResult : llmResult.content;
      const llmMetadata = typeof llmResult === 'object' ? llmResult.llmMetadata : undefined;

      const result = {
        success: true,
        response: responseContent,
        metadata: {
          agentName: agentName,
          agentType: agentType,
          contextUsed: true,
          contextLength: this.contextData.length,
          processedAt: new Date().toISOString(),
          ...(llmMetadata && {
            llmUsed: llmMetadata,
            usage: typeof llmResult === 'object' ? llmResult.usage : undefined,
            costCalculation: typeof llmResult === 'object' ? llmResult.costCalculation : undefined,
          }),
        },
      };

      if (params.taskId && params.currentUser?.id) {
        try {
          await this.saveContextTaskResult(params.taskId, params.currentUser.id, result);
        } catch (error) {
          this.contextLogger.error(`Error reporting task completion for ${params.taskId}:`, error);
        }
      }

      return result;
    } catch (error) {
      this.contextLogger.error(`Error in executeTask for ${agentName}:`, error);

      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: 'I apologize, but I encountered an error while processing your request.',
        metadata: {
          agentName: agentName,
          agentType: agentType,
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
        },
      };

      if (params.taskId && params.currentUser?.id) {
        try {
          await this.failTask(
            params.taskId,
            params.currentUser.id,
            error instanceof Error ? error.message : String(error),
          );
        } catch (reportError) {
          this.contextLogger.error(`Error reporting task failure for ${params.taskId}:`, reportError);
        }
      }

      return errorResult;
    }
  }

  // Rest of the methods remain the same...
  private extractUserMessage(params: any): string {
    // Implementation stays the same
    if (typeof params === 'string') return params;
    if (params?.message?.parts?.[0]?.text) return params.message.parts[0].text;
    if (params?.message?.text) return params.message.text;
    
    const messageProps = ['userMessage', 'message', 'prompt', 'input', 'request', 'content', 'text'];
    for (const prop of messageProps) {
      if (params[prop] && typeof params[prop] === 'string') {
        return params[prop];
      }
    }
    
    return typeof params === 'object' ? JSON.stringify(params) : String(params || '');
  }

  private isGreeting(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return (
      lowerMessage === 'hello' ||
      lowerMessage === 'hi' ||
      lowerMessage.includes('can i talk to')
    );
  }

  private buildSystemPrompt(agentName: string, agentType: string): string {
    let prompt = `You are ${agentName}, a ${agentType} agent. Help the user with their request.`;
    if (this.contextData) {
      prompt += `\n\nHere is your context information:\n${this.contextData}`;
      prompt += `\n\nUse this context to provide accurate and helpful responses. If the user's question is not covered by the context, say so and provide general assistance.`;
    }
    return prompt;
  }

  private generatePersonalizedGreeting(agentName: string): string {
    const userName = 'Golfer Geek';
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

  private async processWithoutContext(method: string, params: any, agentName: string, agentType: string): Promise<any> {
    this.contextLogger.debug(`No context available for ${agentName}, using fallback`);
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

  protected async saveContextTaskResult(taskId: string, userId: string, result: any): Promise<void> {
    if (!this.services.tasksService) {
      this.contextLogger.debug(`Cannot save result - TasksService not available`);
      return;
    }

    try {
      const updateData = {
        status: 'completed' as const,
        progress: 100,
        response: typeof result === 'string' ? result : JSON.stringify(result),
        responseMetadata: result.metadata || {},
      };

      await this.services.tasksService.updateTask(taskId, userId, updateData);
      this.contextLogger.debug(`Task ${taskId} marked as completed in database`);
    } catch (error) {
      this.contextLogger.error(`Error saving task result for ${taskId}:`, error);
      throw error;
    }
  }

  // Context-specific methods
  setContextData(contextData: string): void {
    this.contextData = contextData;
    this.contextLogger.debug(`Context data set, length: ${contextData?.length || 0}`);
  }

  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.contextLogger.debug(`Agent path set to: ${path}`);
  }

  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    const skills = this.agentContextService.isLoaded ? this.agentContextService.skills : [];
    const name = this.agentContextService.isLoaded ? this.agentContextService.name : baseCard.name;
    const description = this.agentContextService.isLoaded ? this.agentContextService.description : baseCard.description || '';

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

  async initializeContext(agentDirectory: string): Promise<void> {
    try {
      await this.agentContextService.initialize(agentDirectory);
      this.contextLogger.debug(`Context initialized for ${this.agentContextService.name}, skills: ${this.agentContextService.skills.length}`);
    } catch (error) {
      this.contextLogger.error('Failed to initialize agent context:', error);
    }
  }
}