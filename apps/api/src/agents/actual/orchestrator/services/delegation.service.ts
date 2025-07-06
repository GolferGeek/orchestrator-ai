import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '../../../../llms/llm.service';

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

  constructor(
    private readonly httpService: HttpService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Analyze request and determine the best action using hybrid approach
   * This is the core intelligence of the orchestrator system
   * Uses fast rule-based filtering before expensive LLM analysis
   */
  async analyzeAndSelectAgent(
    request: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    selectedAgent?: AvailableAgent;
    reasoning: string;
    confidence: number;
  } | null> {
    try {
      this.logger.log(
        '🧠 Analyzing request with hybrid rule-based + LLM approach...',
      );

      if (availableAgents.length === 0) {
        this.logger.warn('No available agents for delegation');
        return {
          action: 'respond_directly',
          reasoning: 'No specialist agents available',
          confidence: 1.0,
        };
      }

      // PHASE 1: Fast rule-based analysis
      const ruleBasedResult = this.analyzeWithRules(request, availableAgents);
      if (ruleBasedResult.confidence >= 0.8) {
        this.logger.log(
          `🚀 High-confidence rule-based match: ${ruleBasedResult.reasoning}`,
        );
        return ruleBasedResult;
      }

      // PHASE 2: LLM-powered analysis for complex cases
      this.logger.log('🤖 Using LLM analysis for complex request...');
      const llmResult = await this.analyzeWithLLM(
        request,
        availableAgents,
        conversationHistory,
      );
      if (llmResult) {
        return llmResult;
      }

      // PHASE 3: Fallback to rule-based result if LLM fails
      this.logger.warn('LLM analysis failed, using rule-based result');
      return ruleBasedResult;
    } catch (error) {
      this.logger.error('Error in agent analysis:', error);

      // Emergency fallback
      return {
        action: 'clarify',
        reasoning: 'Unable to analyze request due to system error',
        confidence: 0.1,
      };
    }
  }

  /**
   * Fast rule-based analysis for obvious cases
   * Migrated from AgentDiscoveryService for efficiency
   */
  private analyzeWithRules(
    request: string,
    availableAgents: AvailableAgent[],
  ): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    selectedAgent?: AvailableAgent;
    reasoning: string;
    confidence: number;
  } {
    const lowerMessage = request.toLowerCase();

    // 1. Check for explicit agent requests ("Can I talk to the X agent?")
    const explicitAgent = this.findExplicitAgentRequest(
      lowerMessage,
      availableAgents,
    );
    if (explicitAgent) {
      return {
        action: 'delegate',
        selectedAgent: explicitAgent,
        reasoning: 'User explicitly requested this agent',
        confidence: 1.0,
      };
    }

    // 2. Check for capability/help requests
    if (this.isCapabilityRequest(lowerMessage)) {
      return {
        action: 'respond_directly',
        reasoning: 'User asking for capabilities or help',
        confidence: 1.0,
      };
    }

    // 3. Analyze content for domain-specific keyword matches
    const domainMatch = this.analyzeContentForAgentMatch(
      lowerMessage,
      availableAgents,
    );
    if (domainMatch.confidence > 0.7) {
      return {
        action: 'delegate',
        selectedAgent: domainMatch.agent,
        reasoning: domainMatch.reasoning,
        confidence: domainMatch.confidence,
      };
    }

    // 4. Single agent case
    if (availableAgents.length === 1) {
      const singleAgent = availableAgents[0];
      if (singleAgent) {
        return {
          action: 'delegate',
          selectedAgent: singleAgent,
          reasoning: 'Only one agent available',
          confidence: 0.9,
        };
      }
    }

    // 5. Uncertain cases - suggest clarification
    if (domainMatch.confidence > 0.3) {
      return {
        action: 'clarify',
        reasoning: 'Uncertain about best agent, requesting clarification',
        confidence: domainMatch.confidence,
      };
    }

    // 6. Default - respond directly for general queries
    return {
      action: 'respond_directly',
      reasoning: 'No clear agent match, handling as general query',
      confidence: 0.5,
    };
  }

  /**
   * Detect explicit agent requests like "Can I talk to the golf agent?"
   */
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

  /**
   * Check if this is a capability/help request
   */
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

  /**
   * Analyze content for domain-specific keyword matches
   */
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

  /**
   * Find agent by name with flexible matching
   */
  private findAgentByName(
    searchName: string,
    availableAgents: AvailableAgent[],
  ): AvailableAgent | null {
    const searchNameLower = searchName.toLowerCase();

    return (
      availableAgents.find((agent) => {
        const agentNameLower = agent.name.toLowerCase();

        // Exact match
        if (agentNameLower === searchNameLower) return true;

        // Contains match
        if (agentNameLower.includes(searchNameLower)) return true;
        if (searchNameLower.includes(agentNameLower)) return true;

        // Special cases for common abbreviations
        if (this.isSpecialMatch(searchNameLower, agentNameLower)) return true;

        return false;
      }) || null
    );
  }

  /**
   * Handle special matching cases for agent names
   */
  private isSpecialMatch(
    searchNameLower: string,
    agentNameLower: string,
  ): boolean {
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

  /**
   * LLM-powered analysis for complex cases
   */
  private async analyzeWithLLM(
    request: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    selectedAgent?: AvailableAgent;
    reasoning: string;
    confidence: number;
  } | null> {
    try {
      // Build context about available agents
      const agentContext = availableAgents
        .filter((agent) => agent.type !== 'orchestrator')
        .map(
          (agent, index) =>
            `${index + 1}. ${agent.name} (${agent.type}): ${agent.description}
           Capabilities: ${agent.capabilities?.join(', ') || 'General assistance'}`,
        )
        .join('\n\n');

      // Build conversation context if available
      const historyContext =
        conversationHistory && conversationHistory.length > 0
          ? `\n\nConversation History:\n${conversationHistory
              .slice(-3) // Last 3 messages for context
              .map((msg) => `${msg.role}: ${msg.content}`)
              .join('\n')}`
          : '';

      const systemPrompt = `You are an AI orchestrator that routes user requests to the most appropriate specialist agent.

Available specialist agents:
${agentContext}

${historyContext}

Your task: Analyze the user's message and decide whether to:
1. "delegate" - Forward to a specific agent (provide the exact agent number)
2. "respond_directly" - Handle it yourself as orchestrator
3. "clarify" - Ask for clarification

Respond in this exact JSON format:
{
  "action": "delegate|respond_directly|clarify",
  "agentIndex": <1-based index if delegating>,
  "reasoning": "brief explanation of your decision"
}

Guidelines:
- Use "delegate" for specific domain expertise needs
- Use "respond_directly" for general questions, greetings, or capability requests
- Use "clarify" when the request is ambiguous
- Be decisive but conservative - prefer clarification over wrong delegation`;

      const analysisPrompt = `Analyze this user request:

User Request: "${request}"${historyContext}

Select the most appropriate action and provide reasoning.`;

      // Use system LLM configuration for agent selection logic
      const selectionResponse = await this.llmService.generateSystemResponse(
        'agent_selection',
        systemPrompt,
        analysisPrompt,
      );

      // Parse the response
      const decision = JSON.parse(selectionResponse);

      if (
        !decision.action ||
        !['delegate', 'respond_directly', 'clarify'].includes(decision.action)
      ) {
        return null;
      }

      let selectedAgent: AvailableAgent | undefined;
      if (decision.action === 'delegate' && decision.agentIndex) {
        const agentIndex = decision.agentIndex - 1; // Convert to 0-based
        const nonOrchestratorAgents = availableAgents.filter(
          (agent) => agent.type !== 'orchestrator',
        );
        selectedAgent = nonOrchestratorAgents[agentIndex];

        if (!selectedAgent) {
          this.logger.warn(
            `LLM suggested invalid agent index: ${decision.agentIndex}`,
          );
          return null;
        }
      }

      return {
        action: decision.action,
        selectedAgent,
        reasoning: decision.reasoning || 'LLM-powered decision',
        confidence: 0.85, // High confidence for LLM decisions
      };
    } catch (error) {
      this.logger.warn('LLM analysis failed:', error);
      return null;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use analyzeAndSelectAgent instead
   */
  async selectBestAgent(
    request: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
  ): Promise<{ selectedAgent: AvailableAgent; reasoning: string } | null> {
    const result = await this.analyzeAndSelectAgent(
      request,
      availableAgents,
      conversationHistory,
    );

    if (result && result.action === 'delegate' && result.selectedAgent) {
      return {
        selectedAgent: result.selectedAgent,
        reasoning: result.reasoning,
      };
    }

    return null;
  }

  /**
   * Delegate a request to a specific agent (execution only)
   * Note: userLLMPreferences are passed to the content-processing agent
   */
  async delegateToAgent(
    agent: AvailableAgent,
    request: string,
    sessionId?: string,
    authToken?: string,
    userLLMPreferences?: any,
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
        userLLMPreferences,
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
        userLLMPreferences?.delegationContext,
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
   * Note: userLLMPreferences are passed to the content-processing agent
   */
  private prepareAgentPayload(
    request: string,
    sessionId?: string,
    authToken?: string,
    userLLMPreferences?: any,
  ): any {
    return {
      jsonrpc: '2.0',
      method: 'processTask',
      params: {
        message: request,
        userMessage: request,
        sessionId: sessionId,
        authToken: authToken,
        ...(userLLMPreferences && {
          providerId: userLLMPreferences.providerId,
          modelId: userLLMPreferences.modelId,
          cidafmOptions: userLLMPreferences.cidafmOptions,
        }),
      },
      id: `orchestrator-delegation-${Date.now()}`,
    };
  }
}
