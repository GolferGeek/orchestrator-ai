import { AgentFunctionParams, AgentFunctionResponse } from '../../a2a-base/interfaces';

/**
 * Simple LLM Agent Function Template
 * 
 * Perfect for conversational agents that need basic AI capabilities.
 * Copy this file to your agent directory as agent-function.ts and customize.
 * 
 * @example Copy to: agents/actual/specialists/your_agent/agent-function.ts
 */

/**
 * Configuration for your agent - customize these values
 */
const AGENT_CONFIG = {
  // Your agent's identity and behavior
  systemPrompt: `You are a helpful assistant. Be professional, accurate, and concise in your responses.`,
  
  // LLM parameters
  temperature: 0.7,        // 0.0 = deterministic, 1.0 = creative
  maxTokens: 1000,         // Maximum response length
  useHistory: true,        // Whether to use conversation history
  
  // Response formatting
  responseFormat: 'text'   // 'text', 'markdown', or 'json'
};

/**
 * Main agent function - processes user messages and returns responses
 */
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, conversationHistory, llmService } = params;
  const startTime = Date.now();

  try {
    // Prepare LLM parameters
    const llmParams = {
      temperature: AGENT_CONFIG.temperature,
      maxTokens: AGENT_CONFIG.maxTokens,
    };

    let response: string;

    // Choose between history-aware or simple response
    if (AGENT_CONFIG.useHistory && conversationHistory && conversationHistory.length > 0) {
      // Context-aware response using conversation history
      response = await llmService.generateResponseWithHistory(
        AGENT_CONFIG.systemPrompt,
        conversationHistory,
        userMessage,
        llmParams
      );
    } else {
      // Simple single-turn response
      response = await llmService.generateResponse(
        AGENT_CONFIG.systemPrompt,
        userMessage,
        llmParams
      );
    }

    // Format response if needed
    const formattedResponse = formatResponse(response, AGENT_CONFIG.responseFormat);
    const processingTime = Date.now() - startTime;

    return {
      response: formattedResponse,
      metadata: {
        agentName: 'your-agent-name', // TODO: Update this
        processingType: 'simple-llm',
        processingTime,
        sessionId,
        toolsUsed: ['llm-service'],
        responseType: 'conversational',
        success: true,
        llmConfig: {
          temperature: AGENT_CONFIG.temperature,
          maxTokens: AGENT_CONFIG.maxTokens,
          useHistory: AGENT_CONFIG.useHistory
        }
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      response: generateFallbackResponse(errorMessage),
      metadata: {
        agentName: 'your-agent-name', // TODO: Update this
        processingType: 'error-fallback',
        processingTime,
        sessionId,
        success: false,
        error: errorMessage,
        toolsUsed: ['llm-service']
      }
    };
  }
}

/**
 * Format response based on the configured format
 */
function formatResponse(response: string, format: string): string {
  switch (format) {
    case 'json':
      try {
        JSON.parse(response);
        return response;
      } catch {
        return JSON.stringify({ content: response });
      }
    
    case 'markdown':
      // Add basic markdown formatting if not present
      return response.includes('#') || response.includes('**') ? response : response;
    
    case 'text':
    default:
      return response;
  }
}

/**
 * Generate helpful fallback response for errors
 */
function generateFallbackResponse(errorMessage: string): string {
  if (errorMessage.includes('rate limit')) {
    return 'I apologize, but I need to slow down a bit. Please try again in a moment.';
  }
  
  if (errorMessage.includes('timeout')) {
    return 'That request took too long to process. Please try asking in a simpler way.';
  }
  
  return 'I apologize, but I encountered an issue processing your request. Please try rephrasing your message or try again later.';
}

/*
USAGE INSTRUCTIONS:

1. Copy this file to your agent directory as agent-function.ts
2. Update AGENT_CONFIG with your agent's specific settings:
   - systemPrompt: Define your agent's personality and role
   - temperature: Adjust creativity (0.0-1.0)
   - maxTokens: Set response length limit
   - useHistory: Enable/disable conversation memory
   - responseFormat: Choose output format

3. Update the agentName in both success and error metadata

4. Customize the systemPrompt examples:
   - Customer service: "You are a friendly customer service representative..."
   - Technical expert: "You are a technical expert who provides precise information..."
   - Creative assistant: "You are a creative writing assistant who helps with..."

5. Optional customizations:
   - Modify formatResponse() for custom output formatting
   - Update generateFallbackResponse() for better error handling
   - Add input validation if needed

Example configurations:

// Customer Service Agent
systemPrompt: "You are a professional customer service assistant. Be helpful, friendly, and always aim to resolve issues efficiently.",
temperature: 0.7,
useHistory: true

// Technical Documentation Agent  
systemPrompt: "You are a technical expert who provides accurate, detailed information with examples.",
temperature: 0.3,
maxTokens: 2000,
responseFormat: 'markdown'

// Creative Writing Assistant
systemPrompt: "You are a creative writing assistant. Help with storytelling and creative content.",
temperature: 0.9,
maxTokens: 1500
*/ 