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
  async classifyIntent(input: OrchestratorInput): Promise<IntentDirective> {
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

      // Analyze conversation history for context
      const conversationContext = await this.analyzeConversationContext(input);
      
      // Use LLM to classify the intent with full context
      const classification = await this.performLLMIntentClassification(input, conversationContext);
      
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
    context: any
  ): Promise<IntentDirective> {
    const systemPrompt = this.buildIntentClassificationPrompt(context);
    const userMessage = this.buildUserAnalysisMessage(input, context);
    
    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 500,
          provider: 'anthropic' // Use Claude for better reasoning - avoid enhanced path
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
  private buildIntentClassificationPrompt(context: any): string {
    return `You are an orchestrator intent classifier. Your job is to analyze user requests and classify them into one of these actions:

1. CREATE_PROJECT - Complex requests requiring multiple steps, coordination, or long-term planning
   Examples: "Create a marketing campaign", "Launch a new product", "Develop a business strategy"

2. DELEGATE - Simple, focused tasks that can be handled by a specialist agent
   Examples: "Write a blog post", "Analyze financial data", "Schedule a meeting"

3. CONVERSE - Direct questions to the orchestrator or general conversation
   Examples: "What can you do?", "How does this work?", "Tell me about the team"

4. CONTINUE_DELEGATION - Continue working with a previously active agent
   Only use this when there's clear context of an ongoing conversation with a specific agent

5. RESUME_PROJECT - Continue an existing project (handled automatically when projectId is present)

CONTEXT INFORMATION:
${context.contextSummary}
${context.shouldContinueWithAgent ? `Active agent: ${context.currentAgent}` : 'No active agent'}

RESPONSE FORMAT:
You must respond with a JSON object containing:
- action: One of the 5 actions above
- agentName: (only for DELEGATE/CONTINUE_DELEGATION actions) the specific agent name
- reasoning: Clear explanation of your classification decision
- confidence: Number between 0.0 and 1.0

Be decisive but honest about confidence. Consider:
- Complexity and scope of the request
- Conversation context and history
- Whether this requires coordination vs. specialist expertise
- User's apparent intent and goals`;
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
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.action || !parsed.reasoning || typeof parsed.confidence !== 'number') {
        throw new Error('Missing required fields in response');
      }
      
      // Validate action type
      const validActions = ['CREATE_PROJECT', 'DELEGATE', 'CONVERSE', 'CONTINUE_DELEGATION', 'RESUME_PROJECT'];
      if (!validActions.includes(parsed.action)) {
        throw new Error(`Invalid action: ${parsed.action}`);
      }
      
      return {
        action: parsed.action,
        agentName: parsed.agentName,
        projectId: parsed.projectId,
        reasoning: parsed.reasoning,
        confidence: Math.max(0, Math.min(1, parsed.confidence)) // Clamp between 0 and 1
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