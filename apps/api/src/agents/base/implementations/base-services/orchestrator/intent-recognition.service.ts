import { Injectable, Logger } from '@nestjs/common';
import {
  IIntentRecognitionService,
  OrchestratorInput,
  IntentDirective,
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';

/**
 * Enhanced Intent Recognition Service - Enterprise workforce development
 *
 * Uses LLM calls to classify user intent and determine orchestrator action.
 * Enhanced with agent capability gap detection and enterprise timeline classification.
 * Follows the principle: each service makes LLM calls rather than using logic trees.
 */
@Injectable()
export class IntentRecognitionService implements IIntentRecognitionService {
  private readonly logger = new Logger(IntentRecognitionService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Classify user intent using LLM calls - Simplified for reliable delegation
   *
   * Analyzes conversation context to determine whether to:
   * - DELEGATE: Task for specialist agent (PRIMARY PATH - 95% of requests)
   * - CONVERSE: Direct orchestrator response (questions about orchestrator)
   * - CONTINUE_DELEGATION: Continue with previous agent
   * - RESUME_PROJECT: Continue existing project (when projectId present)
   * - BUILD_AGENT: Create new permanent agent for capability gap
   * - IMPROVE_AGENT: Enhance existing agent performance
   * - CREATE_SUBPROJECT: Cross-departmental coordination needed
   *
   * NOTE: CREATE_PROJECT removed from classification - now explicit UI action
   */
  async classifyIntent(
    input: OrchestratorInput,
    delegationContext?: string,
  ): Promise<IntentDirective> {
    if (delegationContext) {
    }

    try {
      // NOTE: projectId handling moved to explicit UI actions - no longer inferred from conversation

      // Check for clarification response first
      const clarificationResponse =
        await this.checkForClarificationResponse(input);
      if (clarificationResponse) {
        return clarificationResponse;
      }

      // Analyze conversation history for context
      const conversationContext = await this.analyzeConversationContext(input);

      // NOTE: BUILD_AGENT is now explicit UI action only - removed from natural language classification

      // Use LLM to classify the intent with full context
      const classification = await this.performLLMIntentClassification(
        input,
        conversationContext,
        delegationContext,
      );

      return classification;
    } catch (error) {
      // Fallback to safe conversation mode
      return {
        action: 'CONVERSE',
        reasoning: `Intent classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.1,
      };
    }
  }

  /**
   * Check if user is responding to a clarification request
   */
  private async checkForClarificationResponse(
    input: OrchestratorInput,
  ): Promise<IntentDirective | null> {
    const history = input.conversationHistory || [];
    if (history.length === 0) return null;

    // Look for recent clarification from orchestrator (legacy support)
    const lastMessage = history[history.length - 1];
    if (
      lastMessage?.metadata?.action === 'CLARIFY' &&
      lastMessage?.metadata?.requiresUserChoice
    ) {
      const userChoice = input.prompt.trim().toLowerCase();

      if (
        userChoice === 'a' ||
        userChoice.includes('option a') ||
        userChoice.includes('delegation')
      ) {
        // User chose delegation - extract suggested agent from the clarification
        const suggestedAgent = this.extractSuggestedAgent(history);
        if (suggestedAgent) {
          return {
            action: 'DELEGATE',
            agentName: suggestedAgent,
            reasoning: 'User chose delegation option from clarification',
            confidence: 0.95,
          };
        } else {
          return {
            action: 'CONVERSE',
            reasoning:
              'No specific agent found in clarification history, falling back to conversation',
            confidence: 0.5,
          };
        }
      }

      if (
        userChoice === 'b' ||
        userChoice.includes('option b') ||
        userChoice.includes('project')
      ) {
        // User chose project creation - redirect to UI
        return {
          action: 'CONVERSE',
          reasoning:
            'Project creation now requires explicit UI action - redirecting user',
          confidence: 0.95,
        };
      }
    }

    return null;
  }

  /**
   * Extract suggested agent from clarification conversation history
   */
  private extractSuggestedAgent(history: any[]): string | null {
    // Look through recent messages for clarification metadata
    for (
      let i = history.length - 1;
      i >= Math.max(0, history.length - 3);
      i--
    ) {
      const message = history[i];
      if (message?.metadata?.action === 'CLARIFY') {
        // Try to extract agent name from the clarification message content
        const content = message.content || '';
        const agentMatch = content.match(
          /delegate.*?to.*?the.*?\*\*([^*]+)\*\*.*?agent/i,
        );
        if (agentMatch && agentMatch[1]) {
          return agentMatch[1].toLowerCase().trim();
        }
      }
    }

    // Default fallback - return null to indicate no specific agent preference
    return null; // No hardcoded agent assumptions
  }

  /**
   * Analyze conversation history for delegation context
   * Determines if user is currently working with a specific agent
   */
  private async analyzeConversationContext(input: OrchestratorInput): Promise<{
    currentAgent?: string;
    shouldContinueWithAgent: boolean;
    recentProjectActivity: boolean;
    contextSummary: string;
  }> {
    const history = input.conversationHistory || [];

    // Quick analysis without LLM for performance
    let currentAgent: string | undefined;
    let recentProjectActivity = false;

    // Look through recent messages for agent context
    const recentMessages = history.slice(-5);
    for (const message of recentMessages.reverse()) {
      if (
        message.metadata?.agentName &&
        message.metadata.agentName !== 'orchestrator'
      ) {
        currentAgent = message.metadata.agentName;
        break;
      }
      if (
        message.content.toLowerCase().includes('project') ||
        message.metadata?.projectId
      ) {
        recentProjectActivity = true;
      }
    }

    const contextSummary =
      `Recent conversation with ${recentMessages.length} messages. ` +
      `${currentAgent ? `Currently working with ${currentAgent}. ` : 'No active agent context. '}` +
      `${recentProjectActivity ? 'Recent project activity detected.' : 'No recent project activity.'}`;

    return {
      currentAgent,
      shouldContinueWithAgent: !!currentAgent,
      recentProjectActivity,
      contextSummary,
    };
  }

  /**
   * Perform LLM-based intent classification with full context analysis
   */
  private async performLLMIntentClassification(
    input: OrchestratorInput,
    context: any,
    delegationContext?: string,
  ): Promise<IntentDirective> {
    const systemPrompt = await this.buildIntentClassificationPrompt(
      context,
      delegationContext,
    );
    const userMessage = this.buildUserAnalysisMessage(input, context);

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 500,
          complexity: 'simple', // Intent classification is a simple task - can use fast local models
          callerType: 'service',
          callerName: 'intent-recognition-service',
          dataClassification: 'internal',
        },
      );

      return this.parseIntentResponse(response);
    } catch (error) {
      throw new Error(
        `LLM classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Build system prompt for intent classification
   */
  private async buildIntentClassificationPrompt(
    context: any,
    delegationContext?: string,
  ): Promise<string> {
    // Extract available agents from delegation context
    let availableAgents: string[] = [];
    if (delegationContext) {
      // Parse delegation context to extract agent names
      // Look for lines starting with agent_name: (new simple format)
      const lines = delegationContext.split('\n');
      const agentLines = lines.filter(
        (line) =>
          line.match(/^[a-z_]+:\s+/) &&
          !line.includes('##') &&
          !line.includes('Authority') &&
          !line.includes('Role'),
      );

      if (agentLines.length > 0) {
        availableAgents = agentLines
          .map((line) => {
            const match = line.match(/^([a-z_]+):/);
            return match ? match[1] : null;
          })
          .filter((name): name is string => name !== null);
      }
    } else {
    }

    return `You are an enterprise orchestrator intent classifier. Your PRIMARY job is to identify task requests and DELEGATE them to specialist agents.

CRITICAL INSTRUCTION: 95% of requests should be classified as DELEGATE. This is the primary path for user requests.

Classify user requests into one of these actions:

1. DELEGATE - DEFAULT choice for ALL task requests, content creation, analysis, or deliverables
   Examples: "Write a blog post", "Create an email campaign", "Analyze financial data", "Research market trends", "Write marketing copy", "Conduct research", "Analyze competitors", "Create content", "Generate reports", "Develop strategies"
   ALWAYS DELEGATE if request contains:
   - Action verbs (Write, Create, Analyze, Research, Conduct, Generate, Develop, Build, Design, Make, Produce)
   - Deliverable requests (blog post, analysis, report, copy, content, strategy, plan, research)
   - Task descriptions (help with X, need Y, want Z)
   - ANY specific work request - users want results delivered by specialists
   RULE: When in doubt, choose DELEGATE - users want specialists to do the work

2. CONVERSE - ONLY for direct questions about the orchestrator itself, capabilities, or pure conversation with NO deliverable requested
   Examples: "What can you do?", "How does this work?", "Tell me about the team", "Hello", "Help me understand your role"
   NEVER USE for any content creation, analysis, or task requests - those are ALWAYS DELEGATE

3. CONTINUE_DELEGATION - Continue working with a previously active agent
   Only use this when there's clear context of an ongoing conversation with a specific agent

NOTE: All project and management actions (CREATE_PROJECT, RESUME_PROJECT, BUILD_AGENT, IMPROVE_AGENT, CREATE_SUBPROJECT, UPDATE_PROJECT_PLAN, APPROVE_PROJECT_PLAN) have been removed from natural language classification. 
These are now handled through explicit UI actions, not language inference.

AVAILABLE AGENTS FOR DELEGATION:
${availableAgents.length > 0 ? availableAgents.map((agent) => `- ${agent}`).join('\n') : 'No delegation context available'}

CONTEXT INFORMATION:
${context.contextSummary}
${context.shouldContinueWithAgent ? `Active agent: ${context.currentAgent}` : 'No active agent'}

RESPONSE FORMAT:
You must respond with a JSON object containing:
- action: One of the 3 actions above
- agentName: (only for DELEGATE/CONTINUE_DELEGATION actions) MUST be one of the available agents listed above
- reasoning: Clear explanation of your classification decision
- confidence: Number between 0.0 and 1.0

CRITICAL GUIDELINES - READ CAREFULLY:
- START with DELEGATE as your default assumption
- 95% of user requests want tasks completed → DELEGATE
- Action verbs (Write, Create, Analyze, Research, Conduct, Generate, etc.) → ALWAYS DELEGATE
- Deliverable requests (content, analysis, reports, copy, etc.) → ALWAYS DELEGATE  
- Task descriptions (help with, need, want) → ALWAYS DELEGATE
- NEVER choose CONVERSE for task requests - users want results, not conversation
- When uncertain between DELEGATE and anything else → choose DELEGATE
- Only use non-DELEGATE actions in very specific, obvious cases

DECISION TREE:
1. Does user want something created, analyzed, researched, or written? → DELEGATE
2. Does user ask for help with a task? → DELEGATE  
3. Does user want a deliverable? → DELEGATE
4. Is it a question about orchestrator capabilities? → CONVERSE
5. When in doubt? → DELEGATE

CRITICAL RULE: If you're not 100% certain it's something else, choose DELEGATE

NOTE: All management actions have been removed from natural language classification - they are now explicit UI actions`;
  }

  /**
   * Build user message for analysis
   */
  private buildUserAnalysisMessage(
    input: OrchestratorInput,
    context: any,
  ): string {
    let message = `ANALYZE THIS USER REQUEST:
"${input.prompt}"

CONVERSATION CONTEXT:`;

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      message += `\nRecent conversation (last ${Math.min(3, input.conversationHistory.length)} messages):`;
      const recent = input.conversationHistory.slice(-3);
      recent.forEach((msg, i) => {
        const speaker =
          msg.role === 'user' ? 'User' : msg.metadata?.agentName || 'Assistant';
        message += `\n${i + 1}. ${speaker}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`;
      });
    } else {
      message += '\nNo conversation history available.';
    }

    if (input.delegationContext) {
      message += `\n\nDELEGATION CONTEXT:
${input.delegationContext.substring(0, 300)}${input.delegationContext.length > 300 ? '...' : ''}`;
    }

    message +=
      '\n\nClassify this request and provide your analysis in the required JSON format.';

    return message;
  }

  /**
   * Parse LLM response into IntentDirective
   */
  private parseIntentResponse(response: string): IntentDirective {
    try {
      // Clean the response and try to extract JSON
      const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      let jsonString = jsonMatch[0];
      // Additional cleaning for common JSON issues
      jsonString = jsonString.replace(/[\n\r\t]/g, ' '); // Replace newlines/tabs with spaces
      jsonString = jsonString.replace(/\s+/g, ' '); // Normalize whitespace

      const parsed = JSON.parse(jsonString);

      // Validate required fields
      if (
        !parsed.action ||
        !parsed.reasoning ||
        typeof parsed.confidence !== 'number'
      ) {
        throw new Error('Missing required fields in response');
      }

      // Validate action type
      const validActions = ['DELEGATE', 'CONVERSE', 'CONTINUE_DELEGATION'];
      if (!validActions.includes(parsed.action)) {
        throw new Error(`Invalid action: ${parsed.action}`);
      }

      return {
        action: parsed.action,
        agentName: parsed.agentName,
        projectId: parsed.projectId,
        reasoning: parsed.reasoning,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // Clamp between 0 and 1
        suggestedAgent: parsed.suggestedAgent,
        projectOutline: parsed.projectOutline,
        capabilityGap: parsed.capabilityGap,
        subprojectScope: parsed.subprojectScope,
      };
    } catch (error) {
      // Return safe fallback
      return {
        action: 'CONVERSE',
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`,
        confidence: 0.2,
      };
    }
  }
}
