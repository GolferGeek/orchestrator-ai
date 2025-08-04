import { Injectable, Logger } from '@nestjs/common';
import { 
  IIntentRecognitionService, 
  OrchestratorInput, 
  IntentDirective 
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';

/**
 * Intent Recognition Service - LLM-based classification
 * 
 * Uses LLM calls to classify user intent and determine orchestrator action.
 * Follows the principle: each service makes LLM calls rather than using logic trees.
 */
@Injectable()
export class IntentRecognitionService implements IIntentRecognitionService {
  private readonly logger = new Logger(IntentRecognitionService.name);

  constructor(
    private readonly llmService: LLMService,
  ) {}

  /**
   * Classify user intent using LLM calls
   * 
   * Analyzes conversation context to determine whether to:
   * - CREATE_PROJECT: Complex, multi-step request requiring coordination
   * - DELEGATE: Simple task for specialist agent
   * - CONVERSE: Direct orchestrator response
   * - CONTINUE_DELEGATION: Continue with previous agent
   * - RESUME_PROJECT: Continue existing project
   */
  async classifyIntent(input: OrchestratorInput, delegationContext?: string): Promise<IntentDirective> {
    this.logger.log(`Classifying intent for prompt: "${input.prompt.substring(0, 100)}..."`);
    
    try {
      // Quick checks for explicit context before LLM call
      if (input.projectId) {
        return {
          action: 'RESUME_PROJECT',
          projectId: input.projectId,
          reasoning: 'User message includes project ID, continuing existing project',
          confidence: 0.95
        };
      }

      // Check for clarification response first
      const clarificationResponse = await this.checkForClarificationResponse(input);
      if (clarificationResponse) {
        return clarificationResponse;
      }

      // Analyze conversation history for context
      const conversationContext = await this.analyzeConversationContext(input);
      
      // Use LLM to classify the intent with full context
      const classification = await this.performLLMIntentClassification(input, conversationContext, delegationContext);
      
      this.logger.log(`Intent classified as: ${classification.action} (confidence: ${classification.confidence})`);
      return classification;
      
    } catch (error) {
      this.logger.error('Intent classification failed:', error);
      
      // Fallback to safe conversation mode
      return {
        action: 'CONVERSE',
        reasoning: `Intent classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.1
      };
    }
  }

  /**
   * Check if user is responding to a clarification request
   */
  private async checkForClarificationResponse(input: OrchestratorInput): Promise<IntentDirective | null> {
    const history = input.conversationHistory || [];
    if (history.length === 0) return null;

    // Look for recent clarification from orchestrator
    const lastMessage = history[history.length - 1];
    if (lastMessage?.metadata?.action === 'CLARIFY' && lastMessage?.metadata?.requiresUserChoice) {
      const userChoice = input.prompt.trim().toLowerCase();
      
      if (userChoice === 'a' || userChoice.includes('option a') || userChoice.includes('delegation')) {
        // User chose delegation - extract suggested agent from the clarification
        const suggestedAgent = this.extractSuggestedAgent(history);
        return {
          action: 'DELEGATE',
          agentName: suggestedAgent,
          reasoning: 'User chose delegation option from clarification',
          confidence: 0.95
        };
      }
      
      if (userChoice === 'b' || userChoice.includes('option b') || userChoice.includes('project')) {
        // User chose project creation
        return {
          action: 'CREATE_PROJECT',
          reasoning: 'User chose project creation option from clarification',
          confidence: 0.95
        };
      }
    }
    
    return null;
  }

  /**
   * Extract suggested agent from clarification conversation history
   */
  private extractSuggestedAgent(history: any[]): string {
    // Look through recent messages for clarification metadata
    for (let i = history.length - 1; i >= Math.max(0, history.length - 3); i--) {
      const message = history[i];
      if (message?.metadata?.action === 'CLARIFY') {
        // Try to extract agent name from the clarification message content
        const content = message.content || '';
        const agentMatch = content.match(/delegate.*?to.*?the.*?\*\*([^*]+)\*\*.*?agent/i);
        if (agentMatch && agentMatch[1]) {
          return agentMatch[1].toLowerCase().trim();
        }
      }
    }
    
    // Default fallback - could be improved by storing clarification choices in metadata
    return 'content'; // Safe default that should exist
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
      if (message.metadata?.agentName && message.metadata.agentName !== 'orchestrator') {
        currentAgent = message.metadata.agentName;
        break;
      }
      if (message.content.toLowerCase().includes('project') || message.metadata?.projectId) {
        recentProjectActivity = true;
      }
    }
    
    const contextSummary = `Recent conversation with ${recentMessages.length} messages. ` +
      `${currentAgent ? `Currently working with ${currentAgent}. ` : 'No active agent context. '}` +
      `${recentProjectActivity ? 'Recent project activity detected.' : 'No recent project activity.'}`;
    
    return {
      currentAgent,
      shouldContinueWithAgent: !!currentAgent,
      recentProjectActivity,
      contextSummary
    };
  }

  /**
   * Perform LLM-based intent classification with full context analysis
   */
  private async performLLMIntentClassification(
    input: OrchestratorInput, 
    context: any,
    delegationContext?: string
  ): Promise<IntentDirective> {
    const systemPrompt = await this.buildIntentClassificationPrompt(context, delegationContext);
    const userMessage = this.buildUserAnalysisMessage(input, context);
    
    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 500,
          provider: 'anthropic' // Use direct path for now - will move to enhanced when local DB is ready
        }
      );
      
      return this.parseIntentResponse(response);
      
    } catch (error) {
      this.logger.error('LLM intent classification failed:', error);
      throw new Error(`LLM classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build system prompt for intent classification
   */
  private async buildIntentClassificationPrompt(context: any, delegationContext?: string): Promise<string> {
    // Extract available agents from delegation context
    let availableAgents: string[] = [];
    if (delegationContext) {
      this.logger.log(`🔍 Delegation context received: ${delegationContext.substring(0, 200)}...`);
      // Parse delegation context to extract agent names
      const agentMatches = delegationContext.match(/\*\*([^*]+)\*\*:/g);
      if (agentMatches) {
        availableAgents = agentMatches
          .map(match => match.replace(/\*\*/g, '').replace(':', ''))
          .filter(name => !name.includes(' ') && name.toLowerCase() !== name.toUpperCase());
      }
      this.logger.log(`🔍 Extracted agents: ${availableAgents.join(', ')}`);
    } else {
      this.logger.warn('🔍 No delegation context provided to intent recognition');
    }

    return `You are an orchestrator intent classifier. Your job is to analyze user requests and classify them into one of these actions:

1. CREATE_PROJECT - ONLY when user explicitly requests project creation
   Examples: "I'd like to create a project to...", "Please start a new project for...", "Create a structured project that..."
   MUST contain explicit project language - never assume user wants a project

2. DELEGATE - Simple, focused tasks that can be handled by a specialist agent
   Examples: "Write a blog post", "Analyze financial data", "Schedule a meeting"

3. CLARIFY - Complex requests that could benefit from multi-step coordination OR simple delegation
   Use this when you think a project approach might be valuable but user didn't explicitly request one
   Examples: "Help with competitive analysis strategy", "Create content for product launch", "Launch marketing campaign"

4. CONVERSE - Direct questions to the orchestrator or general conversation
   Examples: "What can you do?", "How does this work?", "Tell me about the team"

5. CONTINUE_DELEGATION - Continue working with a previously active agent
   Only use this when there's clear context of an ongoing conversation with a specific agent

6. RESUME_PROJECT - Continue an existing project (handled automatically when projectId is present)

AVAILABLE AGENTS FOR DELEGATION:
${availableAgents.length > 0 ? availableAgents.map(agent => `- ${agent}`).join('\n') : 'No delegation context available'}

CONTEXT INFORMATION:
${context.contextSummary}
${context.shouldContinueWithAgent ? `Active agent: ${context.currentAgent}` : 'No active agent'}

RESPONSE FORMAT:
You must respond with a JSON object containing:
- action: One of the 6 actions above
- agentName: (only for DELEGATE/CONTINUE_DELEGATION actions) MUST be one of the available agents listed above
- reasoning: Clear explanation of your classification decision
- confidence: Number between 0.0 and 1.0
- suggestedAgent: (only for CLARIFY actions) Which agent would handle the delegation option
- projectOutline: (only for CLARIFY actions) Brief description of what a project approach would involve

IMPORTANT GUIDELINES:
- DEFAULT to DELEGATE for most requests - let specialists handle tasks
- Only use CREATE_PROJECT if user explicitly asks for project creation with clear project language
- Use CLARIFY when complex requests could benefit from project coordination but user didn't explicitly request it
- When in doubt, choose DELEGATE over CREATE_PROJECT
- Never assume user wants a project unless they explicitly say so`;
  }

  /**
   * Build user message for analysis
   */
  private buildUserAnalysisMessage(input: OrchestratorInput, context: any): string {
    let message = `ANALYZE THIS USER REQUEST:
"${input.prompt}"

CONVERSATION CONTEXT:`;

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      message += `\nRecent conversation (last ${Math.min(3, input.conversationHistory.length)} messages):`;
      const recent = input.conversationHistory.slice(-3);
      recent.forEach((msg, i) => {
        const speaker = msg.role === 'user' ? 'User' : (msg.metadata?.agentName || 'Assistant');
        message += `\n${i + 1}. ${speaker}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`;
      });
    } else {
      message += '\nNo conversation history available.';
    }

    if (input.delegationContext) {
      message += `\n\nDELEGATION CONTEXT:
${input.delegationContext.substring(0, 300)}${input.delegationContext.length > 300 ? '...' : ''}`;
    }

    message += '\n\nClassify this request and provide your analysis in the required JSON format.';
    
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
        this.logger.warn('No JSON found in LLM response, trying full response as JSON');
        this.logger.debug(`Response content: ${response.substring(0, 500)}...`);
        throw new Error('No JSON found in response');
      }
      
      let jsonString = jsonMatch[0];
      // Additional cleaning for common JSON issues
      jsonString = jsonString.replace(/[\n\r\t]/g, ' '); // Replace newlines/tabs with spaces
      jsonString = jsonString.replace(/\s+/g, ' '); // Normalize whitespace
      
      const parsed = JSON.parse(jsonString);
      
      // Validate required fields
      if (!parsed.action || !parsed.reasoning || typeof parsed.confidence !== 'number') {
        throw new Error('Missing required fields in response');
      }
      
      // Validate action type
      const validActions = ['CREATE_PROJECT', 'DELEGATE', 'CONVERSE', 'CONTINUE_DELEGATION', 'RESUME_PROJECT', 'CLARIFY'];
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
        projectOutline: parsed.projectOutline
      };
      
    } catch (error) {
      this.logger.error('Failed to parse intent response:', error);
      this.logger.debug('Raw response:', response);
      
      // Return safe fallback
      return {
        action: 'CONVERSE',
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`,
        confidence: 0.2
      };
    }
  }
}