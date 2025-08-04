import { Injectable, Logger } from '@nestjs/common';
import { 
  IIntentRecognitionService, 
  OrchestratorInput, 
  IntentDirective 
} from '../../../../../orchestration/orchestration.types';

/**
 * Intent Recognition Service - LLM-based classification
 * 
 * Uses LLM calls to classify user intent and determine orchestrator action.
 * Follows the principle: each service makes LLM calls rather than using logic trees.
 */
@Injectable()
export class IntentRecognitionService implements IIntentRecognitionService {
  private readonly logger = new Logger(IntentRecognitionService.name);

  /**
   * Classify user intent using LLM calls
   * 
   * Analyzes conversation context to determine whether to:
   * - CREATE_PROJECT: Complex, multi-step request
   * - DELEGATE: Simple task for specialist agent
   * - CONVERSE: Direct orchestrator response
   * - CONTINUE_DELEGATION: Continue with previous agent
   * - RESUME_PROJECT: Continue existing project
   */
  async classifyIntent(input: OrchestratorInput): Promise<IntentDirective> {
    this.logger.log(`Classifying intent for prompt: "${input.prompt.substring(0, 100)}..."`);
    
    try {
      // TODO: Implement LangGraph-based intent classification
      // This will use a StateGraph with DecisionState to track conversational context
      
      // Placeholder implementation - will be replaced with LLM-based classification
      const lowerPrompt = input.prompt.toLowerCase();
      
      // Check for project continuation
      if (input.projectId) {
        return {
          action: 'RESUME_PROJECT',
          projectId: input.projectId,
          reasoning: 'User message includes project ID, continuing existing project',
          confidence: 0.9
        };
      }
      
      // Check for complex multi-step requests (placeholder logic)
      if (this.isComplexRequest(lowerPrompt)) {
        return {
          action: 'CREATE_PROJECT',
          reasoning: 'Request appears to require multiple steps and coordination',
          confidence: 0.8
        };
      }
      
      // Check for delegation patterns (placeholder logic)
      if (this.isDelegationRequest(lowerPrompt)) {
        return {
          action: 'DELEGATE',
          agentName: this.extractAgentName(lowerPrompt),
          reasoning: 'Request can be handled by a specialist agent',
          confidence: 0.7
        };
      }
      
      // Default to conversation
      return {
        action: 'CONVERSE',
        reasoning: 'General conversation or orchestrator information request',
        confidence: 0.6
      };
      
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
   * Placeholder: Check if request is complex enough for project creation
   * TODO: Replace with LLM-based analysis
   */
  private isComplexRequest(prompt: string): boolean {
    const complexKeywords = [
      'plan', 'strategy', 'campaign', 'launch', 'implement',
      'coordinate', 'manage', 'organize', 'execute', 'develop'
    ];
    return complexKeywords.some(keyword => prompt.includes(keyword));
  }

  /**
   * Placeholder: Check if request should be delegated
   * TODO: Replace with LLM-based analysis
   */
  private isDelegationRequest(prompt: string): boolean {
    return prompt.includes('talk to') || prompt.includes('delegate to') || prompt.includes('ask');
  }

  /**
   * Placeholder: Extract agent name from prompt
   * TODO: Replace with LLM-based extraction
   */
  private extractAgentName(prompt: string): string | undefined {
    // Very simple extraction - will be replaced with LLM
    const match = prompt.match(/talk to (\w+)/);
    return match ? match[1] : undefined;
  }
}