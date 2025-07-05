import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../../../../llms/llm.service';

interface AvailableAgent {
  name: string;
  description: string;
  path: string;
  url: string;
  type: string;
  capabilities: string[];
  metadata?: {
    name?: string;
    display_name?: string;
    description?: string;
  };
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Analyze user message and determine the best agent to handle it
   * Enhanced version with optional LLM reasoning
   */
  async analyzeRequestForAgentMatch(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    useLLMReasoning: boolean = true,
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: AvailableAgent;
    confidence: number;
    reasoning: string;
  }> {
    // Try LLM-powered reasoning first if enabled
    if (useLLMReasoning) {
      try {
        this.logger.log('Using LLM-powered agent discovery');
        const llmDecision = await this.enhanceWithLLMReasoning(
          userMessage,
          availableAgents,
          conversationHistory,
        );

        if (llmDecision) {
          return llmDecision;
        }
      } catch (error) {
        this.logger.warn(
          'LLM-powered reasoning failed, falling back to rule-based:',
          error,
        );
      }
    }

    // Fallback to rule-based analysis
    return this.analyzeWithRules(
      userMessage,
      availableAgents,
      conversationHistory,
    );
  }

  /**
   * Rule-based agent matching (original logic)
   */
  private analyzeWithRules(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: AvailableAgent;
    confidence: number;
    reasoning: string;
  } {
    const lowerMessage = userMessage.toLowerCase();

    // Check for explicit agent requests ("Can I talk to the X agent?")
    const explicitAgentMatch = this.findExplicitAgentRequest(
      lowerMessage,
      availableAgents,
    );
    if (explicitAgentMatch) {
      return {
        action: 'delegate',
        agent: explicitAgentMatch,
        confidence: 1.0,
        reasoning: 'User explicitly requested this agent',
      };
    }

    // Check for capability/help requests
    if (this.isCapabilityRequest(lowerMessage)) {
      return {
        action: 'respond_directly',
        confidence: 1.0,
        reasoning: 'User asking for capabilities or help',
      };
    }

    // Analyze content for agent matching
    const contentMatch = this.analyzeContentForAgentMatch(
      lowerMessage,
      availableAgents,
    );
    if (contentMatch.confidence > 0.7) {
      return {
        action: 'delegate',
        agent: contentMatch.agent,
        confidence: contentMatch.confidence,
        reasoning: contentMatch.reasoning,
      };
    }

    // Check for follow-up questions with agent continuity
    const continuityMatch = this.checkAgentContinuity(
      conversationHistory,
      availableAgents,
    );
    if (continuityMatch) {
      return {
        action: 'delegate',
        agent: continuityMatch,
        confidence: 0.8,
        reasoning:
          'Following up with previous agent based on conversation context',
      };
    }

    // If no clear match, respond directly or ask for clarification
    if (contentMatch.confidence > 0.3) {
      return {
        action: 'clarify',
        confidence: contentMatch.confidence,
        reasoning: 'Uncertain about best agent, requesting clarification',
      };
    }

    return {
      action: 'respond_directly',
      confidence: 0.5,
      reasoning: 'No specific agent match found, handling directly',
    };
  }

  /**
   * Find agent by name with flexible matching
   */
  findAgentByName(
    agentName: string,
    availableAgents: AvailableAgent[],
  ): AvailableAgent | null {
    return (
      availableAgents.find((agent) => {
        const agentNameLower = agent.name
          .toLowerCase()
          .replace(/[_\s-]+/g, ' ');
        const searchNameLower = agentName
          .toLowerCase()
          .replace(/[_\s-]+/g, ' ');

        return (
          agentNameLower.includes(searchNameLower) ||
          searchNameLower.includes(agentNameLower) ||
          this.checkSpecialCases(searchNameLower, agentNameLower)
        );
      }) || null
    );
  }

  private findExplicitAgentRequest(
    lowerMessage: string,
    availableAgents: AvailableAgent[],
  ): AvailableAgent | null {
    const patterns = [
      /can i talk to (?:the )?(.+?)\s*agent/,
      /connect me (?:to|with) (?:the )?(.+?)\s*agent/,
      /speak (?:to|with) (?:the )?(.+?)\s*agent/,
      /use (?:the )?(.+?)\s*agent/,
    ];

    for (const pattern of patterns) {
      const match = lowerMessage.match(pattern);
      if (match && match[1]) {
        const requestedAgent = match[1].trim();
        const agent = this.findAgentByName(requestedAgent, availableAgents);
        if (agent) {
          this.logger.log(`Explicit agent request found: ${agent.name}`);
          return agent;
        }
      }
    }

    return null;
  }

  private isCapabilityRequest(lowerMessage: string): boolean {
    const capabilityKeywords = [
      'what can you do',
      'what can',
      'capabilities',
      'what you specialize in',
      'introduce yourself',
      'available agents',
      'list agents',
      'show me agents',
      'view agents',
      'tell me what agents',
      'help',
      'what are you capable of',
    ];

    return capabilityKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private analyzeContentForAgentMatch(
    lowerMessage: string,
    availableAgents: AvailableAgent[],
  ): { agent?: AvailableAgent; confidence: number; reasoning: string } {
    // Domain-specific keyword mappings
    const domainMappings = [
      {
        keywords: [
          'golf',
          'rules of golf',
          'penalty',
          'usga',
          'r&a',
          'handicap',
          'water hazard',
          'unplayable',
          'relief',
          'bunker',
          'green',
          'fairway',
          'tee box',
        ],
        agentNames: ['golf', 'rules'],
        confidence: 0.9,
      },
      {
        keywords: [
          'blog',
          'write',
          'article',
          'content',
          'post',
          'copywriting',
          'creative writing',
        ],
        agentNames: ['blog', 'content', 'writer'],
        confidence: 0.85,
      },
      {
        keywords: [
          'calendar',
          'schedule',
          'meeting',
          'appointment',
          'time',
          'date',
        ],
        agentNames: ['calendar', 'schedule'],
        confidence: 0.8,
      },
      {
        keywords: ['email', 'message', 'correspondence', 'mail'],
        agentNames: ['email', 'triage'],
        confidence: 0.8,
      },
      {
        keywords: ['hr', 'human resources', 'employee', 'policy', 'benefits'],
        agentNames: ['hr', 'human'],
        confidence: 0.8,
      },
    ];

    for (const mapping of domainMappings) {
      const hasKeyword = mapping.keywords.some((keyword) =>
        lowerMessage.includes(keyword),
      );
      if (hasKeyword) {
        const agent = availableAgents.find((a) =>
          mapping.agentNames.some((name) =>
            a.name.toLowerCase().includes(name),
          ),
        );

        if (agent) {
          return {
            agent,
            confidence: mapping.confidence,
            reasoning: `Message contains domain keywords for ${agent.name}`,
          };
        }
      }
    }

    return { confidence: 0, reasoning: 'No domain match found' };
  }

  private checkAgentContinuity(
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    availableAgents?: AvailableAgent[],
  ): AvailableAgent | null {
    if (!conversationHistory || !availableAgents) return null;

    const lastAssistantMessage = [...conversationHistory]
      .reverse()
      .find((msg) => msg.role === 'assistant');

    if (lastAssistantMessage?.metadata?.agentName) {
      const agentName = lastAssistantMessage.metadata.agentName;
      // Only continue with non-orchestrator agents
      const isOrchestratorAgent =
        agentName.toLowerCase().includes('orchestrator') ||
        lastAssistantMessage.metadata?.agentType === 'orchestrator';

      if (!isOrchestratorAgent) {
        return this.findAgentByName(agentName, availableAgents);
      }
    }

    return null;
  }

  /**
   * Enhanced LLM-powered agent discovery (moved from LLM service)
   */
  private async enhanceWithLLMReasoning(
    userMessage: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: AvailableAgent;
    confidence: number;
    reasoning: string;
  } | null> {
    try {
      // Format available agents for LLM
      const agentList = availableAgents
        .filter((agent) => agent.type !== 'orchestrator')
        .map((agent) => `${agent.name}: ${agent.description}`)
        .join('\n');

      // Build conversation context if available
      const historyContext =
        conversationHistory && conversationHistory.length > 0
          ? this.buildConversationContext(conversationHistory)
          : '';

      // Build system prompt for LLM-powered orchestration
      const systemPrompt = this.buildLLMOrchestrationPrompt(
        agentList,
        historyContext,
      );

      // Use LLM service for reasoning
      const llmResponse = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        { temperature: 0.3, maxTokens: 300 },
      );

      // Parse LLM response
      const decision = this.parseLLMDecision(llmResponse, availableAgents);
      if (decision) {
        this.logger.log(
          `LLM decision: ${decision.action} (confidence: ${decision.confidence})`,
        );
        return decision;
      }
    } catch (error) {
      this.logger.warn('LLM reasoning failed:', error);
      throw error;
    }

    return null;
  }

  private buildConversationContext(
    conversationHistory: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): string {
    const recentMessages = conversationHistory.slice(-4); // Last 4 messages for context
    return recentMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private buildLLMOrchestrationPrompt(
    agentList: string,
    historyContext: string,
  ): string {
    return `You are an AI orchestrator that routes user requests to the most appropriate specialist agent.

Available specialist agents:
${agentList}

${historyContext ? `Recent conversation:\n${historyContext}\n` : ''}

Your task: Analyze the user's message and decide whether to:
1. "delegate" - Forward to a specific agent (provide the exact agent name)
2. "respond_directly" - Handle it yourself as orchestrator
3. "clarify" - Ask for clarification

Respond in this exact JSON format:
{
  "action": "delegate|respond_directly|clarify",
  "agent": "exact_agent_name_if_delegating",
  "reasoning": "brief explanation of your decision"
}

Guidelines:
- Use "delegate" for specific domain expertise needs
- Use "respond_directly" for general questions, greetings, or capability requests
- Use "clarify" when the request is ambiguous
- Agent names must match exactly from the available list
- Be decisive but conservative - prefer clarification over wrong delegation`;
  }

  private parseLLMDecision(
    llmResponse: string,
    availableAgents: AvailableAgent[],
  ): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: AvailableAgent;
    confidence: number;
    reasoning: string;
  } | null {
    try {
      // Try to parse JSON response
      const cleanResponse = llmResponse.trim();
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        // Fallback: look for structured response patterns
        return this.parseStructuredResponse(cleanResponse, availableAgents);
      }

      const decision = JSON.parse(jsonMatch[0]);

      if (
        !decision.action ||
        !['delegate', 'respond_directly', 'clarify'].includes(decision.action)
      ) {
        return null;
      }

      let agent: AvailableAgent | undefined;
      if (decision.action === 'delegate' && decision.agent) {
        const foundAgent = this.findAgentByName(
          decision.agent,
          availableAgents,
        );
        if (!foundAgent) {
          this.logger.warn(`LLM suggested unknown agent: ${decision.agent}`);
          return null;
        }
        agent = foundAgent;
      }

      return {
        action: decision.action,
        agent,
        confidence: 0.85, // High confidence for LLM decisions
        reasoning: decision.reasoning || 'LLM-powered decision',
      };
    } catch (error) {
      this.logger.warn('Failed to parse LLM decision:', error);
      return null;
    }
  }

  private parseStructuredResponse(
    response: string,
    availableAgents: AvailableAgent[],
  ): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: AvailableAgent;
    confidence: number;
    reasoning: string;
  } | null {
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('delegate')) {
      // Try to extract agent name
      for (const agent of availableAgents) {
        if (lowerResponse.includes(agent.name.toLowerCase())) {
          return {
            action: 'delegate',
            agent,
            confidence: 0.75,
            reasoning: 'LLM suggested delegation (parsed from text)',
          };
        }
      }
      return {
        action: 'clarify',
        confidence: 0.6,
        reasoning: 'LLM suggested delegation but agent unclear',
      };
    } else if (
      lowerResponse.includes('respond_directly') ||
      lowerResponse.includes('respond directly')
    ) {
      return {
        action: 'respond_directly',
        confidence: 0.8,
        reasoning: 'LLM suggested direct response (parsed from text)',
      };
    } else if (lowerResponse.includes('clarify')) {
      return {
        action: 'clarify',
        confidence: 0.8,
        reasoning: 'LLM suggested clarification (parsed from text)',
      };
    }

    return null;
  }

  private checkSpecialCases(
    searchNameLower: string,
    agentNameLower: string,
  ): boolean {
    // Add special matching cases
    const specialCases = [
      { search: 'blog', agent: 'blog' },
      { search: 'golf', agent: 'golf' },
      { search: 'calendar', agent: 'calendar' },
      { search: 'email', agent: 'email' },
      { search: 'hr', agent: 'hr' },
    ];

    return specialCases.some(
      (sc) =>
        searchNameLower.includes(sc.search) &&
        agentNameLower.includes(sc.agent),
    );
  }
}
