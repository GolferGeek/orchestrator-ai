import { AgentFunctionParams, AgentFunctionResponse } from '../a2a-base/interfaces';

/**
 * Example agent function implementation
 * This demonstrates the expected structure for agent-function.ts files
 */
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, conversationHistory, llmService, metadata } = params;

  try {
    // Example: Use the LLM service to process the user message
    const systemPrompt = `You are a helpful example agent. Respond to user messages in a friendly and informative way.`;
    
    let response: string;
    
    if (conversationHistory && conversationHistory.length > 0) {
      // Use conversation history for context-aware responses
      response = await llmService.generateResponseWithHistory(
        systemPrompt,
        conversationHistory,
        userMessage
      );
    } else {
      // Simple response without history
      response = await llmService.generateResponse(systemPrompt, userMessage);
    }

    return {
      response,
      metadata: {
        agentName: 'example-agent',
        processingType: 'llm-powered',
        hasHistory: conversationHistory ? conversationHistory.length > 0 : false,
        sessionId,
        toolsUsed: ['llm-service'],
        responseType: 'conversational'
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Fallback response in case of errors
    return {
      response: `I apologize, but I encountered an error processing your request: ${errorMessage}. Please try again or rephrase your message.`,
      metadata: {
        agentName: 'example-agent',
        processingType: 'error-fallback',
        error: errorMessage,
        sessionId
      }
    };
  }
} 