import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

// Explicitly set LangSmith environment variables for automatic tracing
// Support both the official LangSmith env vars and our custom ones for backward compatibility
const langsmithEnabled = process.env.LANGSMITH_TRACING === 'true' || process.env.LANGSMITH_ENABLED === 'true';
const langsmithApiKey = process.env.LANGSMITH_API_KEY;
const langsmithProject = process.env.LANGSMITH_PROJECT || process.env.LANGSMITH_PROJECT_NAME || 'orchestrator-ai';

if (langsmithEnabled && langsmithApiKey) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = langsmithApiKey;
  process.env.LANGCHAIN_PROJECT = langsmithProject;
  if (process.env.LANGSMITH_ENDPOINT) {
    process.env.LANGCHAIN_ENDPOINT = process.env.LANGSMITH_ENDPOINT;
  }
  console.log('🔧 LangSmith environment variables set for automatic tracing:');
  console.log(`- LANGCHAIN_TRACING_V2: ${process.env.LANGCHAIN_TRACING_V2}`);
  console.log(`- LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT}`);
  console.log(`- LANGCHAIN_API_KEY: ${process.env.LANGCHAIN_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`- LANGCHAIN_ENDPOINT: ${process.env.LANGCHAIN_ENDPOINT || 'DEFAULT'}`);
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.logger.log('🔄 LLMService constructor starting...');
    this.logger.log(`- OpenAI API Key available: ${!!process.env.OPENAI_API_KEY}`);
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.logger.log('✅ OpenAI client created');
    this.logger.log('✅ LLMService initialized - LangChain LLMs will automatically trace to LangSmith');
  }

  /**
   * Simple LLM call with system and user messages - using LangChain for automatic LangSmith tracing
   */
  async generateResponse(systemPrompt: string, userMessage: string, options?: {
    temperature?: number;
    maxTokens?: number;
    provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
  }): Promise<string> {
    try {
      this.logger.log(`🔄 generateResponse called - using LangChain LLM for automatic LangSmith tracing`);
      this.logger.debug(`Generating LLM response for message: ${userMessage.substring(0, 100)}...`);

      // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
      const llm = options?.temperature || options?.maxTokens || options?.provider 
        ? this.createCustomLangGraphLLM({
            provider: options?.provider || 'openai',
            temperature: options?.temperature,
            maxTokens: options?.maxTokens
          })
        : this.getLangGraphLLM(options?.provider || 'openai');
      
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage }
      ];

      this.logger.log(`✅ Using LangChain ChatOpenAI for automatic LangSmith tracing`);
      
      const response = await llm.invoke(messages);
      const content = response.content as string || 'I apologize, but I was unable to generate a response.';
      
      this.logger.debug(`LLM response generated successfully (${content.length} characters)`);
      return content;

    } catch (error) {
      this.logger.error('Error generating LLM response:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Enhanced LLM call with conversation history support - using LangChain for automatic LangSmith tracing
   */
  async generateResponseWithHistory(
    systemPrompt: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}>, 
    currentMessage: string
  ): Promise<string> {
    try {
      this.logger.log(`🔄 generateResponseWithHistory called - using LangChain LLM for automatic LangSmith tracing`);
      this.logger.debug(`Generating LLM response with history (${conversationHistory.length} messages) for: ${currentMessage.substring(0, 100)}...`);

      // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
      const llm = this.getLangGraphLLM('openai');

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

      this.logger.log(`✅ Using LangChain ChatOpenAI with history for automatic LangSmith tracing`);
      
      const response = await llm.invoke(messages);
      const content = response.content as string || 'I apologize, but I was unable to generate a response.';
      
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
   * Get a LangGraph-compatible LLM instance for the specified provider with automatic LangSmith tracing
   */
  getLangGraphLLM(provider: 'openai' | 'anthropic' | 'ollama' | 'google' = 'openai'): BaseChatModel {
    try {
      let llm: BaseChatModel;

      switch (provider) {
        case 'openai':
          llm = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          });
          break;

        case 'anthropic':
          llm = new ChatAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
          });
          break;

        case 'ollama':
          llm = new ChatOllama({
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'llama2',
            temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
          });
          break;

        case 'google':
          llm = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY,
            model: process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature: parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxOutputTokens: parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
          });
          break;

        default:
          this.logger.warn(`Unknown provider: ${provider}, falling back to OpenAI`);
          llm = this.getLangGraphLLM('openai');
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;

    } catch (error) {
      this.logger.error(`Error creating LangGraph LLM for provider ${provider}:`, error);
      throw new Error(`Failed to create LangGraph LLM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a LangGraph LLM instance with custom configuration and automatic LangSmith tracing
   */
  createCustomLangGraphLLM(config: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'google';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    baseUrl?: string;
  }): BaseChatModel {
    try {
      let llm: BaseChatModel;

      switch (config.provider) {
        case 'openai':
          llm = new ChatOpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            model: config.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: config.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: config.maxTokens ?? parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          });
          break;

        case 'anthropic':
          llm = new ChatAnthropic({
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            model: config.model || process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
            temperature: config.temperature ?? parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens: config.maxTokens ?? parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
          });
          break;

        case 'ollama':
          llm = new ChatOllama({
            baseUrl: config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: config.model || process.env.OLLAMA_MODEL || 'llama2',
            temperature: config.temperature ?? parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
          });
          break;

        case 'google':
          llm = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
            model: config.model || process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature: config.temperature ?? parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxOutputTokens: config.maxTokens ?? parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
          });
          break;

        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;

    } catch (error) {
      this.logger.error(`Error creating custom LangGraph LLM:`, error);
      throw new Error(`Failed to create custom LangGraph LLM: ${error instanceof Error ? error.message : String(error)}`);
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
        agent: 'blog_post', // Fixed: use actual agent name, not path
        reasoning: 'Content creation request identified'
      };
    }

    if (message.includes('hr') || message.includes('human resources') || message.includes('employee')) {
      return {
        action: 'delegate',
        agent: 'hr_assistant',
        reasoning: 'HR-related request identified'
      };
    }

    if (message.includes('marketing') || message.includes('campaign') || message.includes('promotion')) {
      return {
        action: 'delegate',
        agent: 'marketing_swarm',
        reasoning: 'Marketing-related request identified'
      };
    }

    if (message.includes('requirement') || message.includes('specification') || message.includes('document')) {
      return {
        action: 'delegate',
        agent: 'requirements_writer',
        reasoning: 'Requirements writing request identified'
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