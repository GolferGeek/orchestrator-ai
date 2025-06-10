import { AgentFunctionParams, AgentFunctionResponse } from '../../a2a-base/interfaces';

/**
 * Simple Conversational Agent Template
 * 
 * Perfect for: Customer service, general Q&A, casual conversation
 * 
 * To use this template:
 * 1. Copy this file to your agent directory as `agent-function.ts`
 * 2. Modify the systemPrompt to match your agent's personality
 * 3. Adjust temperature and other settings as needed
 * 
 * @example
 * ```typescript
 * // Copy this entire function to your agent-function.ts
 * export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
 *   // ... (this code)
 * }
 * ```
 */
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, conversationHistory, llmService } = params;

  // 🎯 CUSTOMIZE THIS: Change the system prompt to match your agent's role
  const systemPrompt = `You are a helpful and friendly customer service assistant. 
  You are professional but warm, always aiming to solve customer problems efficiently. 
  Be concise but thorough in your responses.`;

  // 🎯 CUSTOMIZE THIS: Adjust these settings for your use case
  const llmConfig = {
    temperature: 0.7,    // Higher = more creative, Lower = more consistent
    maxTokens: 1000,     // Maximum response length
  };

  try {
    let response: string;

    // Use conversation history if available for better context
    if (conversationHistory && conversationHistory.length > 0) {
      response = await llmService.generateResponseWithHistory(
        systemPrompt,
        conversationHistory,
        userMessage,
        llmConfig
      );
    } else {
      response = await llmService.generateResponse(
        systemPrompt,
        userMessage,
        llmConfig
      );
    }

    return {
      response,
      metadata: {
        agentName: 'conversational-agent', // 🎯 CUSTOMIZE THIS
        processingType: 'llm-conversational',
        hasHistory: conversationHistory ? conversationHistory.length > 0 : false,
        sessionId,
        toolsUsed: ['llm-service'],
        responseType: 'conversational',
        // Add any custom metadata here
        conversationLength: conversationHistory?.length || 0,
        llmSettings: llmConfig
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Friendly error response that matches your agent's tone
    return {
      response: `I apologize, but I'm having trouble processing your request right now. ${
        errorMessage.includes('rate limit') ? 'Please try again in a moment.' :
        errorMessage.includes('timeout') ? 'That request was a bit complex - could you try rephrasing it?' :
        'Please try again or contact support if the issue continues.'
      }`,
      metadata: {
        agentName: 'conversational-agent', // 🎯 CUSTOMIZE THIS
        processingType: 'error-fallback',
        error: errorMessage,
        sessionId,
        hasHistory: conversationHistory ? conversationHistory.length > 0 : false
      }
    };
  }
}

/* 
🎯 CUSTOMIZATION GUIDE:

1. SYSTEM PROMPT (Line 21):
   - Customer Service: "You are a professional customer service representative..."
   - Tech Support: "You are a technical support specialist who helps users..."
   - Sales: "You are a friendly sales assistant who helps customers find..."

2. TEMPERATURE (Line 28):
   - 0.1-0.3: Very consistent, factual responses (tech support, data analysis)
   - 0.5-0.7: Balanced creativity and consistency (customer service, general Q&A)
   - 0.8-1.0: More creative and varied responses (creative writing, brainstorming)

3. MAX TOKENS (Line 29):
   - 500-1000: Concise responses (quick Q&A, status updates)
   - 1000-2000: Detailed explanations (tutorials, complex answers)
   - 2000+: Long-form content (articles, detailed analysis)

4. ERROR MESSAGES (Line 56-60):
   - Customize these to match your agent's personality and use case
   - Consider your audience (technical vs non-technical users)

5. METADATA (Line 40-49):
   - Add custom fields relevant to your agent (user preferences, interaction type, etc.)
   - Use this for analytics and debugging
*/ 