import { Injectable, Logger } from '@nestjs/common';
import { 
  IDelegationService, 
  OrchestratorInput, 
  OrchestratorResponse,
  ConversationMessage,
  DelegationError
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';

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
    input: OrchestratorInput
  ): Promise<OrchestratorResponse> {
    this.logger.log(`Delegating to agent: ${agentName} with prompt: "${prompt.substring(0, 100)}..."`);
    
    try {
      // Step 1: Discover and validate target agent
      const targetAgent = await this.discoverTargetAgent(agentName);
      if (!targetAgent) {
        throw new DelegationError(
          `Agent '${agentName}' not found in agent pool`,
          agentName,
          { availableAgents: await this.getAvailableAgentNames() }
        );
      }

      // Step 2: Create agent instance
      const agentInstance = await this.createAgentInstance(targetAgent, input);
      
      // Step 3: Prepare A2A task payload
      const taskPayload = this.createA2ATaskPayload(prompt, input, targetAgent);
      
      // Step 4: Execute delegation via A2A protocol
      const delegationResult = await this.executeA2ADelegation(agentInstance, taskPayload);
      
      // Step 5: Process and return orchestrator response
      const orchestratorResponse = this.processDelegationResult(delegationResult, agentName, input);
      
      this.logger.log(`Delegation to ${agentName} completed successfully`);
      return orchestratorResponse;
      
    } catch (error) {
      this.logger.error(`Delegation to ${agentName} failed:`, error);
      
      if (error instanceof DelegationError) {
        throw error;
      }
      
      throw new DelegationError(
        `Delegation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        agentName,
        { prompt: prompt.substring(0, 100) }
      );
    }
  }

  /**
   * Analyze conversation for agent context
   * 
   * Determines if there's a current delegated agent and whether
   * to continue with the same agent (sticky agent behavior).
   */
  async analyzeAgentContext(conversationHistory: ConversationMessage[]): Promise<{
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  }> {
    this.logger.log(`Analyzing agent context from ${conversationHistory.length} messages`);
    
    try {
      if (conversationHistory.length === 0) {
        return {
          shouldContinue: false,
          confidence: 1.0,
          reasoning: 'No conversation history available'
        };
      }

      // First, do quick metadata analysis for efficiency
      const quickAnalysis = this.performQuickContextAnalysis(conversationHistory);
      if (quickAnalysis.confidence >= 0.8) {
        return quickAnalysis;
      }

      // Use LLM for deeper context analysis when quick analysis is uncertain
      return await this.performLLMContextAnalysis(conversationHistory, quickAnalysis);
      
    } catch (error) {
      this.logger.error('Agent context analysis failed:', error);
      
      return {
        shouldContinue: false,
        confidence: 0.1,
        reasoning: `Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    try {
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();
      
      // Try exact name match first
      let targetAgent = agents.find(agent => agent.name === agentName);
      
      // Try case-insensitive match
      if (!targetAgent) {
        targetAgent = agents.find(agent => 
          agent.name.toLowerCase() === agentName.toLowerCase()
        );
      }
      
      // Try partial name match
      if (!targetAgent) {
        targetAgent = agents.find(agent => 
          agent.name.toLowerCase().includes(agentName.toLowerCase()) ||
          agent.metadata?.displayName?.toLowerCase().includes(agentName.toLowerCase())
        );
      }
      
      if (targetAgent) {
        this.logger.log(`Found target agent: ${targetAgent.name} (${targetAgent.type})`);
      }
      
      return targetAgent;
      
    } catch (error) {
      this.logger.error(`Failed to discover target agent ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available agent names
   */
  private async getAvailableAgentNames(): Promise<string[]> {
    try {
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();
      
      return agents.map(agent => agent.name);
      
    } catch (error) {
      this.logger.warn('Failed to get available agent names:', error);
      return [];
    }
  }

  /**
   * Create agent instance using factory service
   */
  private async createAgentInstance(targetAgent: any, input: OrchestratorInput): Promise<any> {
    try {
      const agentInstance = await this.agentFactoryService.createAgent(targetAgent);
      
      this.logger.log(`Created agent instance for ${targetAgent.name}`);
      return agentInstance;
      
    } catch (error) {
      this.logger.error(`Failed to create agent instance for ${targetAgent.name}:`, error);
      throw new DelegationError(
        `Failed to create agent instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        targetAgent.name
      );
    }
  }

  /**
   * Create A2A task payload for delegation
   */
  private createA2ATaskPayload(prompt: string, input: OrchestratorInput, targetAgent: any): any {
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
          ...input.metadata
        }
      }
    };
  }

  /**
   * Execute A2A delegation to target agent
   */
  private async executeA2ADelegation(agentInstance: any, taskPayload: any): Promise<any> {
    try {
      this.logger.log(`Executing A2A delegation with method: ${taskPayload.method}`);
      
      // Call the agent's executeTask method (A2A protocol)
      const result = await agentInstance.executeTask(taskPayload.params);
      
      this.logger.log(`A2A delegation completed successfully`);
      return result;
      
    } catch (error) {
      this.logger.error('A2A delegation execution failed:', error);
      throw error;
    }
  }

  /**
   * Process delegation result into orchestrator response
   */
  private processDelegationResult(
    delegationResult: any, 
    agentName: string, 
    input: OrchestratorInput
  ): OrchestratorResponse {
    try {
      const response: OrchestratorResponse = {
        success: true,
        response: delegationResult.response || delegationResult.message || 'Task completed',
        action: 'DELEGATE',
        agentName,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator',
          processedAt: new Date().toISOString(),
          delegatedAgent: agentName,
          delegatedAt: new Date().toISOString(),
          ...delegationResult.metadata
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId
      };

      // Include any additional context from the delegation result
      if (delegationResult.tasks) {
        response.tasks = delegationResult.tasks;
      }

      if (delegationResult.projectId) {
        response.projectId = delegationResult.projectId;
      }

      return response;
      
    } catch (error) {
      this.logger.error('Failed to process delegation result:', error);
      
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
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        conversationId: input.conversationId,
        userId: input.userId,
        sessionId: input.sessionId
      };
    }
  }

  // ============================================================================
  // CONTEXT ANALYSIS METHODS - Agent context determination
  // ============================================================================

  /**
   * Quick metadata-based context analysis
   */
  private performQuickContextAnalysis(conversationHistory: ConversationMessage[]): {
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
      if (message && message.metadata?.agentName && message.metadata.agentName !== 'orchestrator') {
        currentAgent = message.metadata.agentName;
        lastAgentMessageIndex = i;
        break;
      }
    }

    if (!currentAgent) {
      return {
        shouldContinue: false,
        confidence: 0.9,
        reasoning: 'No recent agent context found in conversation'
      };
    }

    // Check if there are user messages after the last agent message
    const hasUserMessagesAfter = recentMessages.slice(lastAgentMessageIndex + 1)
      .some(msg => msg.role === 'user');

    if (hasUserMessagesAfter) {
      return {
        currentAgent,
        shouldContinue: true,
        confidence: 0.8,
        reasoning: `Recent conversation with ${currentAgent}, continuing context`
      };
    }

    return {
      currentAgent,
      shouldContinue: false,
      confidence: 0.7,
      reasoning: `Found ${currentAgent} in recent history but no clear continuation signal`
    };
  }

  /**
   * LLM-based context analysis for complex scenarios
   */
  private async performLLMContextAnalysis(
    conversationHistory: ConversationMessage[],
    quickAnalysis: any
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

    const recentContext = conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content.substring(0, 200),
      agentName: msg.metadata?.agentName || null,
      timestamp: msg.timestamp
    }));

    const userMessage = `ANALYZE THIS CONVERSATION CONTEXT:

RECENT MESSAGES:
${JSON.stringify(recentContext, null, 2)}

QUICK ANALYSIS RESULT:
${JSON.stringify(quickAnalysis, null, 2)}

Provide your analysis in the required JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.2,
          maxTokens: 400,
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parseContextAnalysis(response, quickAnalysis);
    } catch (error) {
      this.logger.error('LLM context analysis failed:', error);
      return quickAnalysis; // Fallback to quick analysis
    }
  }

  /**
   * Parse LLM context analysis response
   */
  private parseContextAnalysis(response: string, fallback: any): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in LLM context analysis response');
        return fallback;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (typeof parsed.shouldContinue !== 'boolean' || 
          typeof parsed.confidence !== 'number' ||
          !parsed.reasoning) {
        this.logger.warn('Invalid LLM context analysis format');
        return fallback;
      }

      return {
        currentAgent: parsed.currentAgent || undefined,
        shouldContinue: parsed.shouldContinue,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning
      };
      
    } catch (error) {
      this.logger.error('Failed to parse LLM context analysis:', error);
      return fallback;
    }
  }
}