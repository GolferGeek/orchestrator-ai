import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Simple LLM call with system and user messages
   */
  async generateResponse(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      this.logger.debug(`Generating LLM response for message: ${userMessage.substring(0, 100)}...`);

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      });

      const content = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
      
      this.logger.debug(`LLM response generated successfully (${content.length} characters)`);
      return content;

    } catch (error) {
      this.logger.error('Error generating LLM response:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Enhanced LLM call with conversation history support
   */
  async generateResponseWithHistory(
    systemPrompt: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}>, 
    currentMessage: string
  ): Promise<string> {
    try {
      this.logger.debug(`Generating LLM response with history (${conversationHistory.length} messages) for: ${currentMessage.substring(0, 100)}...`);

      // Build messages array with system prompt, conversation history, and current message
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add conversation history
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // Add current message
      messages.push({
        role: 'user',
        content: currentMessage
      });

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      });

      const content = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
      
      this.logger.debug(`LLM response with history generated successfully (${content.length} characters)`);
      return content;

    } catch (error) {
      this.logger.error('Error generating LLM response with history:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Simple orchestration-specific LLM call that returns structured responses
   */
  async generateOrchestrationDecision(userMessage: string, availableAgents: string[]): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: string;
    response?: string;
    reasoning?: string;
  }> {
    try {
      const systemPrompt = `You are an AI orchestrator that decides how to handle user requests. You have these agents available: ${availableAgents.join(', ')}.

For each request, decide whether to:
1. "delegate" - send to a specialist agent (specify which one)
2. "respond_directly" - handle the request yourself 
3. "clarify" - ask for more information

**Important**: 
- If the user asks "Can I talk to the [agent name] agent?" - always use "delegate" action and specify that agent
- If the user asks you to list your available agents, describe your capabilities, or asks "what can you do", use "respond_directly" action. Format the agent list like this for each agent:
- Agent Name: agent_name, Description: agent_description

This allows the frontend to create clickable links for each agent.

Respond ONLY with a JSON object in this format:
{
  "action": "delegate|respond_directly|clarify",
  "agent": "agent_name_if_delegating", 
  "response": "your_direct_response_if_responding_directly",
  "reasoning": "brief_explanation_of_decision"
}`;

      const response = await this.generateResponse(systemPrompt, userMessage);
      
      try {
        const decision = JSON.parse(response);
        return decision;
      } catch (parseError) {
        this.logger.warn('Failed to parse LLM orchestration response as JSON, falling back to rule-based');
        return this.getFallbackOrchestrationDecision(userMessage, availableAgents);
      }

    } catch (error) {
      this.logger.error('Error in orchestration decision:', error);
      return this.getFallbackOrchestrationDecision(userMessage, availableAgents);
    }
  }

  /**
   * Enhanced orchestration decision with conversation history
   */
  async generateOrchestrationDecisionWithHistory(
    userMessage: string, 
    availableAgents: string[], 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string, metadata?: any}>,
    agentContinuityContext?: string
  ): Promise<{
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: string;
    response?: string;
    reasoning?: string;
  }> {
    try {
      const systemPrompt = `You are an AI orchestrator that decides how to handle user requests. You have these agents available: ${availableAgents.join(', ')}.

For each request, decide whether to:
1. "delegate" - send to a specialist agent (specify which one)
2. "respond_directly" - handle the request yourself 
3. "clarify" - ask for more information

**Important**: 
- If the user asks "Can I talk to the [agent name] agent?" - always use "delegate" action and specify that agent
- If the user asks you to list your available agents, describe your capabilities, or asks "what can you do", use "respond_directly" action. Format the agent list like this for each agent:
- Agent Name: agent_name, Description: agent_description
- Pay attention to conversation history to maintain context and remember user information like their name
- If user is asking about something mentioned earlier in conversation, use that context for better responses

${agentContinuityContext || ''}

This allows the frontend to create clickable links for each agent.

**CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON. Do NOT use markdown formatting. The response must be parseable by JSON.parse().**

Required JSON format:
{
  "action": "delegate|respond_directly|clarify",
  "agent": "agent_name_if_delegating", 
  "response": "your_direct_response_if_responding_directly",
  "reasoning": "brief_explanation_of_decision"
}`;

      const response = await this.generateResponseWithHistory(systemPrompt, conversationHistory, userMessage);
      
      try {
        const decision = JSON.parse(response);
        return decision;
      } catch (parseError) {
        this.logger.warn('Failed to parse LLM orchestration response as JSON, falling back to rule-based');
        this.logger.warn(`Raw LLM response that failed to parse: "${response}"`);
        this.logger.warn(`Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        return this.getFallbackOrchestrationDecision(userMessage, availableAgents);
      }

    } catch (error) {
      this.logger.error('Error in orchestration decision with history:', error);
      return this.getFallbackOrchestrationDecision(userMessage, availableAgents);
    }
  }

  /**
   * Fallback rule-based orchestration when LLM fails
   */
  private getFallbackOrchestrationDecision(userMessage: string, availableAgents: string[]): {
    action: 'delegate' | 'respond_directly' | 'clarify';
    agent?: string;
    response?: string;
    reasoning?: string;
  } {
    const message = userMessage.toLowerCase();

    if (message.includes('blog') || message.includes('write') || message.includes('article')) {
      return {
        action: 'delegate',
        agent: 'specialists/blog_post',
        reasoning: 'Content creation request identified'
      };
    }

    if (message.includes('hello') || message.includes('hi') || message.includes('help')) {
      return {
        action: 'respond_directly',
        response: `Hello! I'm your AI orchestrator. I can help you directly or connect you with our specialist agents. Available agents: ${availableAgents.join(', ')}. What can I assist you with today?`,
        reasoning: 'Greeting detected'
      };
    }

    return {
      action: 'clarify',
      response: 'I understand you need assistance. Could you provide more specific details about what you\'re looking for? I can connect you with our specialists or help you directly.',
      reasoning: 'Request needs clarification'
    };
  }
} 