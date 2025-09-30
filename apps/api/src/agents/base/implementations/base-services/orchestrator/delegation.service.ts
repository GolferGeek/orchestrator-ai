import { Injectable, Logger } from '@nestjs/common';
import {
  IDelegationService,
  OrchestratorInput,
  OrchestratorResponse,
  ConversationMessage,
  DelegationError,
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';
import { AgentNameFormatter } from '../../../../../common/formatters/agent-name.formatter';

/**
 * Delegation Service - Enhanced agent delegation with context awareness
 *
 * Manages delegation to specialist agents while understanding existing
 * delegated agents and providing real-time message proxying.
 */
@Injectable()
export class DelegationService implements IDelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly agentDiscoveryService: AgentDiscoveryService,
    private readonly agentFactoryService: AgentFactoryService,
    private readonly agentNameFormatter: AgentNameFormatter,
  ) {}

  /**
   * Delegate task to specialist agent
   *
   * Follows the conversation + tasks pattern:
   * - Creates A2A task for target agent
   * - Provides real-time WebSocket proxying
   * - Maintains conversation context
   */
  async delegateToAgent(
    agentName: string,
    prompt: string,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse> {
    try {
      // Step 1: Discover and validate target agent
      const targetAgent = await this.discoverTargetAgent(agentName);
      if (!targetAgent) {
        throw new DelegationError(
          `Agent '${agentName}' not found in agent pool`,
          agentName,
          { availableAgents: await this.getAvailableAgentNames() },
        );
      }

      // Step 2: Create agent instance
      const agentInstance = await this.createAgentInstance(targetAgent, input);

      // Step 3: Prepare A2A task payload
      const taskPayload = this.createA2ATaskPayload(prompt, input, targetAgent);

      // Step 4: Execute delegation via A2A protocol
      const delegationResult = await this.executeA2ADelegation(
        agentInstance,
        taskPayload,
      );

      // Step 5: Process and return orchestrator response
      const orchestratorResponse = this.processDelegationResult(
        delegationResult,
        agentName,
        input,
      );

      return orchestratorResponse;
    } catch (_error) {
      if (_error instanceof DelegationError) {
        throw _error;
      }

      throw new DelegationError(
        `Delegation failed: ${_error instanceof Error ? _error.message : 'Unknown _error'}`,
        agentName,
        { prompt: prompt.substring(0, 100) },
      );
    }
  }

  /**
   * Analyze conversation for agent context
   *
   * Determines if there's a current delegated agent and whether
   * to continue with the same agent (sticky agent behavior).
   */
  async analyzeAgentContext(
    conversationHistory: ConversationMessage[],
    currentPrompt?: string,
  ): Promise<{
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      if (conversationHistory.length === 0) {
        return {
          shouldContinue: false,
          confidence: 1.0,
          reasoning: 'No conversation history available',
        };
      }

      // First, identify the sticky agent from last message
      const lastAgentName = this.getLastAgentFromHistory(conversationHistory);
      if (lastAgentName && currentPrompt) {
        // Ask the sticky agent if it can handle the new request
        const capabilityResult = await this.queryAgentCapability(
          lastAgentName,
          currentPrompt,
        );
        if (capabilityResult.canHandle && capabilityResult.confidence > 0.6) {
          return {
            currentAgent: lastAgentName,
            shouldContinue: true,
            confidence: capabilityResult.confidence,
            reasoning: `${lastAgentName} confirmed: ${capabilityResult.reasoning}`,
          };
        } else {
          return {
            currentAgent: lastAgentName,
            shouldContinue: false,
            confidence: capabilityResult.confidence,
            reasoning: `${lastAgentName} declined: ${capabilityResult.reasoning}`,
          };
        }
      }

      // Fall back to existing logic if no sticky agent or no current prompt
      const quickAnalysis =
        this.performQuickContextAnalysis(conversationHistory);
      if (quickAnalysis.confidence >= 0.7) {
        return quickAnalysis;
      }

      // Use LLM for deeper context analysis when quick analysis is uncertain
      return await this.performLLMContextAnalysis(
        conversationHistory,
        quickAnalysis,
      );
    } catch (_error) {
      return {
        shouldContinue: false,
        confidence: 0.1,
        reasoning: `Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ============================================================================
  // AGENT DELEGATION IMPLEMENTATION - Core delegation logic
  // ============================================================================

  /**
   * Discover target agent from agent pool
   */
  private async discoverTargetAgent(agentName: string): Promise<any> {
    await this.agentDiscoveryService.discoverAgents();
    const agents = this.agentDiscoveryService.getDiscoveredAgents();

    // Try exact name match first
    let targetAgent = agents.find((agent) => agent.name === agentName);

    // Try case-insensitive match
    if (!targetAgent) {
      targetAgent = agents.find(
        (agent) => agent.name.toLowerCase() === agentName.toLowerCase(),
      );
    }

    // Try partial name match
    if (!targetAgent) {
      targetAgent = agents.find(
        (agent) =>
          agent.name.toLowerCase().includes(agentName.toLowerCase()) ||
          agent.metadata?.displayName
            ?.toLowerCase()
            .includes(agentName.toLowerCase()),
      );
    }

    if (targetAgent) {
    }

    return targetAgent;
  }

  /**
   * Get list of available agent names
   */
  private async getAvailableAgentNames(): Promise<string[]> {
    try {
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();

      return agents.map((agent) => agent.name);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Create agent instance using factory service
   */
  private async createAgentInstance(
    targetAgent: any,
    input: OrchestratorInput,
  ): Promise<any> {
    const agentInstance =
      await this.agentFactoryService.createAgent(targetAgent);

    return agentInstance;
  }

  /**
   * Create A2A task payload for delegation
   */
  private createA2ATaskPayload(
    prompt: string,
    input: OrchestratorInput,
    targetAgent: any,
  ): any {
    return {
      method: 'executeTask',
      params: {
        prompt,
        userId: input.userId,
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        conversationHistory: input.conversationHistory || [],
        metadata: {
          delegatedBy: 'orchestrator',
          delegatedAt: new Date().toISOString(),
          targetAgent: targetAgent.name,
          agentType: targetAgent.type,
          ...input.metadata,
        },
      },
    };
  }

  /**
   * Execute A2A delegation to target agent
   */
  private async executeA2ADelegation(
    agentInstance: any,
    taskPayload: any,
  ): Promise<any> {
    // Call the agent's executeTask method (A2A protocol)
    const _result = await agentInstance.executeTask(
      taskPayload.method,
      taskPayload.params,
    );

    return result;
  }

  /**
   * Process delegation result into orchestrator response
   */
  private processDelegationResult(
    delegationResult: any,
    agentName: string,
    input: OrchestratorInput,
  ): OrchestratorResponse {
    try {
      // Extract content from the delegation result
      const content =
        delegationResult.response ||
        delegationResult.message ||
        'Task completed';

      // Format agent name for display using the formatter service
      const displayName = this.agentNameFormatter.formatDisplayName(agentName);

      // Add agent name at the top of the response
      const formattedMessage = `**${displayName}**\n\n${content}`;

      const response: OrchestratorResponse = {
        success: true,
        message: formattedMessage, // Include agent name at the top
        action: 'DELEGATE',
        agentName,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          delegatedAgent: agentName,
          delegatedAt: new Date().toISOString(),
          ...delegationResult.metadata,
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };

      // Include any additional context from the delegation result
      if (delegationResult.tasks) {
        response.tasks = delegationResult.tasks;
      }

      if (delegationResult.projectId) {
        response.projectId = delegationResult.projectId;
      }

      return response;
    } catch (_error) {
      // Return error response
      return {
        success: false,
        response: `Delegation completed but result processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        action: 'DELEGATE',
        agentName,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          delegatedAgent: agentName,
          delegatedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId,
      };
    }
  }

  // ============================================================================
  // CONTEXT ANALYSIS METHODS - Agent context determination
  // ============================================================================

  /**
   * Quick metadata-based context analysis
   */
  private performQuickContextAnalysis(
    conversationHistory: ConversationMessage[],
  ): {
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  } {
    const recentMessages = conversationHistory.slice(-5);
    let currentAgent: string | undefined;
    let lastAgentMessageIndex = -1;

    // Look for recent agent responses
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const message = recentMessages[i];
      if (
        message &&
        message.metadata?.agentName &&
        message.metadata.agentName !== 'orchestrator'
      ) {
        currentAgent = message.metadata.agentName;
        lastAgentMessageIndex = i;
        break;
      }
    }

    if (!currentAgent) {
      return {
        shouldContinue: false,
        confidence: 0.9,
        reasoning: 'No recent agent context found in conversation',
      };
    }

    // Check if there are user messages after the last agent message
    const hasUserMessagesAfter = recentMessages
      .slice(lastAgentMessageIndex + 1)
      .some((msg) => msg.role === 'user');

    if (hasUserMessagesAfter) {
      return {
        currentAgent,
        shouldContinue: true,
        confidence: 0.8,
        reasoning: `Recent conversation with ${currentAgent}, continuing context`,
      };
    }

    return {
      currentAgent,
      shouldContinue: false,
      confidence: 0.7,
      reasoning: `Found ${currentAgent} in recent history but no clear continuation signal`,
    };
  }

  /**
   * LLM-based context analysis for complex scenarios
   */
  private async performLLMContextAnalysis(
    conversationHistory: ConversationMessage[],
    quickAnalysis: any,
  ): Promise<{
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  }> {
    const systemPrompt = `You are a conversation context analyzer. Analyze conversation history to determine if there's an active agent context and whether the conversation should continue with the same agent.

ANALYSIS CRITERIA:
1. Look for recent agent responses (metadata.agentName)
2. Determine if the user's current message relates to the previous agent's work
3. Check for context switches or new topics
4. Consider "sticky agent" behavior for related tasks

RESPONSE FORMAT: JSON object with:
- currentAgent: Agent name if found (string or null)
- shouldContinue: Whether to continue with same agent (boolean)
- confidence: Confidence level 0.0-1.0 (number)
- reasoning: Explanation of the decision (string)`;

    const recentContext = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content.substring(0, 200),
      agentName: msg.metadata?.agentName || null,
      timestamp: msg.timestamp,
    }));

    const userMessage = `ANALYZE THIS CONVERSATION CONTEXT:

RECENT MESSAGES:
${JSON.stringify(recentContext, null, 2)}

QUICK ANALYSIS RESULT:
${JSON.stringify(quickAnalysis, null, 2)}

Provide your analysis in the required JSON format.`;

    const _response = await this.llmService.generateResponse(
      systemPrompt,
      userMessage,
      {
        temperature: 0.2,
        maxTokens: 400,
        complexity: 'simple', // Agent capability analysis is a simple classification task
        callerType: 'service',
        callerName: 'delegation-service',
        dataClassification: 'internal',
      },
    );

    return this.parseContextAnalysis(response);
  }

  /**
   * Parse LLM context analysis response
   */
  private parseContextAnalysis(response: string): any {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM context analysis returned no JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      typeof parsed.shouldContinue !== 'boolean' ||
      typeof parsed.confidence !== 'number' ||
      !parsed.reasoning
    ) {
      throw new Error(
        'LLM context analysis missing required fields: shouldContinue (boolean), confidence (number), reasoning (string)',
      );
    }

    return {
      currentAgent: parsed.currentAgent || undefined,
      shouldContinue: parsed.shouldContinue,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reasoning: parsed.reasoning,
    };
  }

  // ============================================================================
  // AGENT CAPABILITY QUERY - For stickiness decisions
  // ============================================================================

  /**
   * Get the last agent name from conversation history
   */
  private getLastAgentFromHistory(
    conversationHistory: ConversationMessage[],
  ): string | null {
    // Look through recent messages for the last agent response
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const message = conversationHistory[i];
      if (
        message &&
        message.metadata?.agentName &&
        message.metadata.agentName !== 'orchestrator'
      ) {
        return message.metadata.agentName;
      }
    }
    return null;
  }

  /**
   * Query an agent's capability to handle a specific request
   * This is internal orchestrator logic - not part of A2A protocol
   */
  private async queryAgentCapability(
    agentName: string,
    prompt: string,
  ): Promise<{
    canHandle: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // Get agent info for capability assessment
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();
      const agentInfo = agents.find(
        (agent) =>
          agent.name === agentName ||
          agent.name.toLowerCase() === agentName.toLowerCase(),
      );

      if (!agentInfo) {
        return {
          canHandle: false,
          confidence: 0.9,
          reasoning: 'Agent not found in discovery service',
        };
      }

      // Use intelligent routing for agent capability queries (fast local models preferred)

      const systemPrompt = `You are evaluating if the "${agentName}" agent can handle a user request.
      
Agent Name: ${agentInfo.name}
Agent Type: ${agentInfo.type}
Agent Description: ${agentInfo.metadata?.description || 'General purpose agent'}

Your job is to quickly determine if this agent can handle the given user request.

Response with JSON:
{
  "canHandle": boolean,
  "confidence": number (0.0-1.0),
  "reasoning": "brief explanation"
}

Guidelines:
- Answer "true" if the request is clearly within the agent's domain/capabilities
- Answer "false" if it's outside their expertise or requires different skills
- Be conservative - when in doubt, say "false" to allow proper delegation
- Keep reasoning brief and specific`;

      const userMessage = `USER REQUEST: "${prompt}"

Can the ${agentName} agent handle this request?`;

      const _response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.1, // Low temperature for consistent assessment
          maxTokens: 200, // Keep responses brief
          complexity: 'simple', // Agent capability assessment is a simple classification task
          callerType: 'service',
          callerName: 'delegation-service',
          dataClassification: 'internal',
        },
      );

      return this.parseCapabilityResponse(response);
    } catch (_error) {
      // Conservative fallback - let delegation service handle it
      return {
        canHandle: false,
        confidence: 0.1,
        reasoning: `Capability assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse LLM capability query response
   */
  private parseCapabilityResponse(response: string): {
    canHandle: boolean;
    confidence: number;
    reasoning: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in capability query response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        typeof parsed.canHandle !== 'boolean' ||
        typeof parsed.confidence !== 'number' ||
        !parsed.reasoning
      ) {
        throw new Error('Invalid capability query response format');
      }

      return {
        canHandle: parsed.canHandle,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning,
      };
    } catch (_error) {
      // Conservative fallback
      return {
        canHandle: false,
        confidence: 0.1,
        reasoning: 'Failed to parse capability assessment',
      };
    }
  }
}
