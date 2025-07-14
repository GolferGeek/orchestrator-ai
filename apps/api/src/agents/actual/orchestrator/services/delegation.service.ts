import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '../../../../llms/llm.service';
import { SystemOperationType } from '../../../../types/llm-evaluation';

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
      this.logger.log('🧠 Analyzing request with optimized hybrid approach...');

      if (availableAgents.length === 0) {
        this.logger.warn('No available agents for delegation');
        return {
          action: 'respond_directly',
          reasoning: 'No specialist agents available',
          confidence: 1.0,
        };
      }

      // PHASE 1: Only check truly obvious cases (explicit requests, greetings)
      const obviousCases = this.checkObviousCases(request, availableAgents);
      if (obviousCases) {
        this.logger.log(`🚀 Obvious case: ${obviousCases.reasoning}`);
        return obviousCases;
      }

      // PHASE 2: LLM-first approach with cost optimization
      this.logger.log('🤖 Using LLM semantic analysis...');

      // Try fast model first for cost efficiency
      let llmResult = await this.analyzeWithLLM(
        request,
        availableAgents,
        conversationHistory,
        'fast',
      );

      // Upgrade to premium model if fast model is uncertain
      if (llmResult && llmResult.confidence < 0.75) {
        this.logger.log('🔄 Upgrading to premium model for better accuracy...');
        const premiumResult = await this.analyzeWithLLM(
          request,
          availableAgents,
          conversationHistory,
          'premium',
        );
        if (premiumResult && premiumResult.confidence > llmResult.confidence) {
          llmResult = premiumResult;
        }
      }

      // Return LLM result or fallback
      return (
        llmResult || {
          action: 'clarify',
          reasoning: 'Unable to determine best agent match',
          confidence: 0.3,
        }
      );
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
   * Check for obvious cases that don't need LLM analysis
   * This saves costs on clear-cut decisions
   */
  private checkObviousCases(
    request: string,
    availableAgents: AvailableAgent[],
  ): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    selectedAgent?: AvailableAgent;
    reasoning: string;
    confidence: number;
  } | null {
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

    // 3. Clear greeting/conversational patterns
    const greetingPatterns = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'thanks',
    ];
    if (
      greetingPatterns.some((greeting) => lowerMessage.startsWith(greeting))
    ) {
      return {
        action: 'respond_directly',
        reasoning: 'Greeting or conversational message',
        confidence: 0.9,
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

    return null; // No obvious cases detected
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
    // Check for writing/content creation intent first (higher priority)
    const writingIndicators = [
      'write',
      'article',
      'blog',
      'post',
      'content',
      'copywriting',
      'creative writing',
      'help me write',
      'create an article',
      'write about',
      'tips for',
      'guide to',
      'how to',
      'draft',
      'compose',
      'create content',
    ];

    const hasWritingIntent = writingIndicators.some((indicator) =>
      lowerMessage.includes(indicator),
    );

    if (hasWritingIntent) {
      const matchedIndicators = writingIndicators.filter((indicator) =>
        lowerMessage.includes(indicator),
      );
      this.logger.log(
        `[Delegation] Detected writing intent with indicators: ${matchedIndicators.join(', ')}`,
      );

      const writingAgent = availableAgents.find((a) =>
        ['blog', 'content', 'writer'].some((name) =>
          a.name.toLowerCase().includes(name),
        ),
      );
      if (writingAgent) {
        this.logger.log(
          `[Delegation] Selecting writing agent: ${writingAgent.name}`,
        );
        return {
          agent: writingAgent,
          confidence: 0.95,
          reasoning: `Detected content writing/creation intent: ${matchedIndicators.join(', ')}`,
        };
      } else {
        this.logger.log(
          `[Delegation] Writing intent detected but no writing agent available`,
        );
      }
    }

    // Domain-specific keyword mappings (processed after writing intent check)
    const domainMappings = [
      {
        keywords: [
          'rules of golf', // More specific golf rules keywords first
          'penalty',
          'usga',
          'r&a',
          'handicap',
          'water hazard',
          'unplayable',
          'relief',
          'golf rule', // More specific
          'golf penalty', // More specific
        ],
        agentNames: ['golf', 'rules'],
        confidence: 0.9,
        requiresSpecific: true, // Requires specific golf rules context
      },
      {
        keywords: [
          'golf course', // General golf playing
          'golf tips',
          'golf equipment',
          'golf swing',
          'bunker',
          'green',
          'fairway',
          'tee box',
          'golf',
        ],
        agentNames: ['golf', 'rules'],
        confidence: 0.7, // Lower confidence for general golf terms
        requiresSpecific: false,
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
        requiresSpecific: false,
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
        requiresSpecific: false,
      },
      {
        keywords: ['email', 'message', 'correspondence', 'mail'],
        agentNames: ['email', 'triage'],
        confidence: 0.8,
        requiresSpecific: false,
      },
      {
        keywords: ['hr', 'human resources', 'employee', 'policy', 'benefits'],
        agentNames: ['hr', 'human'],
        confidence: 0.8,
        requiresSpecific: false,
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
          this.logger.log(
            `[Delegation] Found domain match: ${agent.name} (confidence: ${mapping.confidence}) for keywords: ${mapping.keywords.filter((k) => lowerMessage.includes(k)).join(', ')}`,
          );
          return {
            agent,
            confidence: mapping.confidence,
            reasoning: `Message contains domain keywords for ${agent.name}: ${mapping.keywords.filter((k) => lowerMessage.includes(k)).join(', ')}`,
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
   * LLM-powered analysis with cost optimization
   */
  private async analyzeWithLLM(
    request: string,
    availableAgents: AvailableAgent[],
    conversationHistory?: Array<{
      role: string;
      content: string;
      metadata?: any;
    }>,
    modelTier: 'fast' | 'premium' = 'fast',
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    selectedAgent?: AvailableAgent;
    reasoning: string;
    confidence: number;
  } | null> {
    try {
      // Build detailed context about available agents
      const agentContext = availableAgents
        .filter((agent) => agent.type !== 'orchestrator')
        .map((agent, index) => {
          const capabilities = agent.capabilities?.length
            ? agent.capabilities.join(', ')
            : 'General assistance';

          // Extract additional metadata if available
          const specialties = agent.metadata?.specialties
            ? `\n           Specialties: ${agent.metadata.specialties.join(', ')}`
            : '';

          const tags = agent.metadata?.tags
            ? `\n           Tags: ${agent.metadata.tags.join(', ')}`
            : '';

          return `${index + 1}. **${agent.name}** (${agent.type})
           Description: ${agent.description}
           Capabilities: ${capabilities}${specialties}${tags}`;
        })
        .join('\n\n');

      // Build conversation context if available
      const historyContext =
        conversationHistory && conversationHistory.length > 0
          ? `\n\nConversation History:\n${conversationHistory
              .slice(-3) // Last 3 messages for context
              .map((msg) => `${msg.role}: ${msg.content}`)
              .join('\n')}`
          : '';

      const systemPrompt = `You are an intelligent AI orchestrator that routes user requests to the most appropriate specialist agent based on semantic understanding of user intent and agent capabilities.

Available specialist agents:
${agentContext}

${historyContext}

CRITICAL ROUTING RULES:
1. **Content Creation Intent**: If user wants to "write", "create content", "draft", "compose", or asks for "tips/guides" about ANY topic → delegate to content/blog writer
2. **Domain Rules/Compliance**: If user asks about specific rules, regulations, penalties, or compliance → delegate to domain specialist
3. **General Domain Discussion**: If user discusses domain topics generally → consider context and intent

Your task: Analyze the user's message and decide whether to:
1. "delegate" - Forward to a specific agent (provide the exact agent number)
2. "respond_directly" - Handle it yourself as orchestrator  
3. "clarify" - Ask for clarification

Respond in this exact JSON format:
{
  "action": "delegate|respond_directly|clarify",
  "agentIndex": <1-based index if delegating>,
  "reasoning": "explain your decision with intent analysis",
  "confidence": <0.0-1.0>
}

Decision Framework:
- **High Priority**: User's intent (writing vs asking vs doing)
- **Medium Priority**: Domain expertise needed
- **Low Priority**: Simple keyword presence

Examples:
- "write about golf" → content writer (intent: creation)
- "golf rules for water hazard" → golf specialist (intent: rules inquiry)  
- "help me draft an email about scheduling" → content writer (intent: writing)
- "what's the company HR policy" → HR specialist (intent: policy inquiry)

Be semantic and context-aware, not just keyword-based.`;

      const analysisPrompt = `Analyze this user request:

User Request: "${request}"${historyContext}

Select the most appropriate action and provide reasoning.`;

      // Use agent_selection operation type
      const operationType: SystemOperationType = 'agent_selection';
      this.logger.log(`🔧 Using ${operationType} with ${modelTier} model for delegation analysis`);

      const selectionResponse = await this.llmService.generateSystemResponse(
        operationType,
        systemPrompt,
        analysisPrompt,
      );

      // Parse the response
      const decision = JSON.parse(selectionResponse);

      if (
        !decision.action ||
        !['delegate', 'respond_directly', 'clarify'].includes(decision.action)
      ) {
        this.logger.warn('LLM returned invalid action:', decision);
        return null;
      }

      // Validate confidence score
      const confidence =
        decision.confidence && typeof decision.confidence === 'number'
          ? Math.max(0, Math.min(1, decision.confidence)) // Clamp to 0-1
          : 0.85; // Default high confidence for valid LLM decisions

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

      this.logger.log(
        `🤖 LLM Decision: ${decision.action} | Agent: ${selectedAgent?.name || 'none'} | Confidence: ${confidence} | Reasoning: ${decision.reasoning}`,
      );

      return {
        action: decision.action,
        selectedAgent,
        reasoning: decision.reasoning || 'LLM-powered semantic analysis',
        confidence: confidence,
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
        // Add note that this is a template greeting (no LLM used)
        llmOptions: {
          provider: 'none',
          model: 'template',
          isTemplateResponse: true,
          operationType: 'agent_greeting',
          isDelegatedAgent: true,
        },
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

    // Extract LLM options/metadata from the delegated agent's response
    let llmOptions = null;

    if (responseData?.result) {
      // JSON-RPC format
      // Check for LLM metadata in various possible locations
      llmOptions =
        responseData.result.metadata?.llmOptions ||
        responseData.result.metadata?.llmMetadata ||
        responseData.result.llmOptions ||
        responseData.result.llmMetadata;

      processedResponse = {
        success: true,
        response: responseData.result.response || responseData.result,
        metadata: {
          ...responseData.result.metadata,
          ...baseMetadata,
          // Include LLM options if found
          ...(llmOptions && { llmOptions }),
        },
      };
    } else if (responseData?.response) {
      // Direct response format
      // Check for LLM metadata in various possible locations
      llmOptions =
        responseData.metadata?.llmOptions ||
        responseData.metadata?.llmMetadata ||
        responseData.llmOptions ||
        responseData.llmMetadata;

      processedResponse = {
        success: true,
        response: responseData.response,
        metadata: {
          ...responseData.metadata,
          ...baseMetadata,
          // Include LLM options if found
          ...(llmOptions && { llmOptions }),
        },
      };
    } else if (typeof responseData === 'string') {
      // Simple string response
      processedResponse = {
        success: true,
        response: responseData,
        metadata: {
          ...baseMetadata,
          // Note that no LLM metadata is available for string responses
          llmOptions: {
            provider: 'unknown',
            model: 'unknown',
            isDelegatedAgent: true,
            responseFormat: 'string',
          },
        },
      };
    } else {
      // Fallback for unknown formats
      processedResponse = {
        success: true,
        response: JSON.stringify(responseData),
        metadata: {
          ...baseMetadata,
          originalFormat: 'unknown',
          // Note that no LLM metadata is available for unknown formats
          llmOptions: {
            provider: 'unknown',
            model: 'unknown',
            isDelegatedAgent: true,
            responseFormat: 'unknown',
          },
        },
      };
    }

    // Log if we found LLM options
    if (llmOptions) {
      this.logger.log(
        `LLM options from ${agent.name}: provider=${llmOptions.provider || 'unknown'}, model=${llmOptions.model || 'unknown'}`,
      );
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
