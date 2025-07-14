import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../../../../llms/llm.service';

interface AvailableAgent {
  name: string;
  description: string;
  type: string;
  capabilities?: string[];
}

@Injectable()
export class ResponseGenerationService {
  private readonly logger = new Logger(ResponseGenerationService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Generate a direct response from the orchestrator using system configuration
   * Note: User LLM preferences are NOT used for orchestrator internal operations
   */
  async generateDirectResponse(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    userContext?: string,
  ): Promise<any> {
    try {
      // Always use system configuration for orchestrator operations
      return await this.generateSystemResponse(
        userMessage,
        availableAgents,
        conversationHistory,
        userContext,
      );
    } catch (error) {
      this.logger.error('Error generating direct response:', error);
      return this.createFallbackResponse(userMessage);
    }
  }

  /**
   * Generate a clarification request
   */
  generateClarificationRequest(
    userMessage: string,
    availableAgents: AvailableAgent[],
    reasoning?: string,
  ): any {
    const agentList = this.formatAgentList(availableAgents);

    const clarificationMessage = `I understand you said: "${userMessage}". 

To help you better, could you be more specific? I can connect you with these specialists:

${agentList}

What specific type of assistance are you looking for?`;

    return {
      success: true,
      response: clarificationMessage,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString(),
        action: 'clarification',
        reasoning: reasoning || 'Request needed clarification',
        // Add note that this is a template response (no LLM used)
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'clarification',
        },
      },
    };
  }

  /**
   * Generate agent list response
   */
  generateAgentListResponse(
    availableAgents: AvailableAgent[],
    userContext?: string,
  ): any {
    const greeting = userContext
      ? `Hello${userContext}! Here's what I can help you with:`
      : 'Hello! Here are the specialists I can connect you with:';

    const agentList = this.formatAgentListWithLinks(availableAgents);

    const response = `${greeting}

${agentList}

Just let me know what you need help with, and I'll connect you with the right specialist!`;

    return {
      success: true,
      response: response,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        contentType: 'agentListFromOrchestrator',
        processedAt: new Date().toISOString(),
        // Add note that this is a template response (no LLM used)
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'agent_list',
        },
      },
    };
  }

  /**
   * Generate capability response for a specific agent
   */
  generateAgentCapabilityResponse(
    agentName: string,
    availableAgents: AvailableAgent[],
  ): any {
    const agent = availableAgents.find(
      (a) =>
        a.name.toLowerCase().includes(agentName.toLowerCase()) ||
        agentName.toLowerCase().includes(a.name.toLowerCase()),
    );

    if (!agent) {
      return {
        success: true,
        response: `I don't have detailed information about the ${agentName} agent available right now.`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator Agent',
          processedAt: new Date().toISOString(),
          // Add note that this is a template response (no LLM used)
          llmOptions: {
            provider: 'none',
            model: 'template',
            isTemplateResponse: true,
            operationType: 'agent_not_found',
          },
        },
      };
    }

    const capabilities =
      agent.capabilities && agent.capabilities.length > 0
        ? agent.capabilities.map((cap) => `• ${cap}`).join('\n')
        : '• General assistance within their specialty area';

    const response = `The ${agent.name} specializes in:

${capabilities}

${agent.description}

Would you like me to connect you with them?`;

    return {
      success: true,
      response: response,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString(),
        targetAgent: agent.name,
        // Add note that this is a template response (no LLM used)
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'agent_capabilities',
        },
      },
    };
  }

  private async generateSystemResponse(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    userContext?: string,
  ): Promise<any> {
    try {
      const systemPrompt = this.buildOrchestratorSystemPrompt(
        availableAgents,
        userContext,
      );

      // Use system configuration for orchestrator operations - specifically 'response_coordination'
      const systemResponse = await this.llmService.generateSystemResponse(
        'response_coordination',
        systemPrompt,
        userMessage,
      );

      // Get the system LLM configuration for transparency
      const systemLLMConfig = this.llmService['systemLLMConfigs']
        ?.response_coordination || {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        maxTokens: 800,
      };

      return {
        success: true,
        response: systemResponse,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator Agent',
          processedAt: new Date().toISOString(),
          systemOperation: 'response_coordination',
          systemLLMUsed: true,
          // Add LLM configuration metadata
          llmOptions: {
            provider: systemLLMConfig.provider,
            model: systemLLMConfig.model,
            temperature: systemLLMConfig.temperature,
            maxTokens: systemLLMConfig.maxTokens,
            isSystemLLM: true,
            operationType: 'response_coordination',
          },
        },
      };
    } catch (error) {
      this.logger.warn(
        'System response failed, falling back to standard:',
        error,
      );
      return await this.generateStandardResponse(
        userMessage,
        availableAgents,
        conversationHistory,
        userContext,
      );
    }
  }

  private async generateStandardResponse(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    userContext?: string,
  ): Promise<any> {
    // Simple template-based response for when LLM is unavailable
    const response = `I received your message: "${userMessage}". ${userContext ? `${userContext}, ` : ''}I'm here to help coordinate with various specialist agents. 

Could you be more specific about what you need help with? I can connect you with:

${this.formatAgentList(availableAgents)}`;

    return {
      success: true,
      response: response,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString(),
        fallback: true,
        // Add LLM options for standard fallback responses
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'standard_fallback',
          reason: 'LLM unavailable',
        },
      },
    };
  }

  private createFallbackResponse(userMessage: string): any {
    return {
      success: true,
      response: `I received your message: "${userMessage}". I'm experiencing some technical difficulties right now, but I'm here to help coordinate with various specialist agents. Could you try rephrasing your request?`,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString(),
        error: true,
        // Add LLM options for error fallback responses
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'error_fallback',
          reason: 'Technical error',
        },
      },
    };
  }

  private buildOrchestratorSystemPrompt(
    availableAgents: AvailableAgent[],
    userContext?: string,
  ): string {
    const agentList = availableAgents
      .map((agent) => `${agent.name}: ${agent.description}`)
      .join('\n');

    return `You are an AI orchestrator assistant. Your role is to help users by either providing direct assistance or connecting them with specialist agents.

Available specialists:
${agentList}

${userContext ? `User context: ${userContext}` : ''}

Guidelines:
- Be helpful, friendly, and professional
- If you can answer directly, do so concisely
- If a specialist would be better, suggest connecting with them
- Always be clear about what you can and cannot do
- Keep responses focused and actionable`;
  }

  private formatAgentList(availableAgents: AvailableAgent[]): string {
    return availableAgents
      .filter((agent) => agent.type !== 'orchestrator')
      .map((agent) => `• ${agent.name}: ${agent.description}`)
      .join('\n');
  }

  private formatAgentListWithLinks(availableAgents: AvailableAgent[]): string {
    // Format the agent list in the way the frontend parser expects
    // Format: "- Agent Name: <name>, Description: <description>"
    return availableAgents
      .filter((agent) => agent.type !== 'orchestrator')
      .map((agent) => {
        // Clean up the agent name - remove underscores, capitalize properly
        const cleanName = agent.name
          .replace(/_/g, ' ')
          .split(' ')
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(' ');

        const description =
          agent.description || `${cleanName} specialist agent`;
        return `- Agent Name: ${cleanName}, Description: ${description}`;
      })
      .join('\n');
  }
}
