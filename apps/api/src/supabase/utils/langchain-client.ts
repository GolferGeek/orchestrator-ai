import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Global LangChain client state
let langchainInitialized = false;

/**
 * Standalone LangChain client utilities without NestJS dependency injection
 */

/**
 * Get OpenAI API key from environment
 */
function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required for LangChain functionality',
    );
  }
  return apiKey;
}

/**
 * Initialize LangChain client (lazy initialization)
 */
export function initializeLangChain(): void {
  if (langchainInitialized) {
    return;
  }

  // Validate required environment variables
  getOpenAIApiKey();

  langchainInitialized = true;
}

/**
 * Get a configured LangChain LLM instance
 */
export function getLLM(options?: {
  provider?: string;
  model?: string;
  temperature?: number;
  timeout?: number;
}): ChatOpenAI {
  // Ensure LangChain is initialized
  initializeLangChain();

  const provider = options?.provider;
  const model = options?.model;
  const temperature = options?.temperature ?? 0;
  const timeout = options?.timeout ?? 60000; // Default to 60 seconds

  // Require explicit provider - no defaults or fallbacks
  if (!provider || !model) {
    throw new Error(
      'Provider and model must be explicitly specified - no defaults allowed',
    );
  }

  if (provider === 'openai') {
    return new ChatOpenAI({
      modelName: model,
      temperature,
      timeout,
      maxRetries: 3, // Enable retries for rate limits
      openAIApiKey: getOpenAIApiKey(),
      configuration: {
        timeout: timeout, // Axios timeout configuration
        maxRetries: 3, // Enable retries for rate limits
      },
    });
  }

  // No fallback - throw error for unsupported providers
  throw new Error(
    `Unsupported provider: ${provider}. Please use a supported provider.`,
  );
}

/**
 * Execute a simple LLM call with system and user messages
 */
export async function executeSimpleCall(
  systemPrompt: string,
  userMessage: string,
  options?: {
    provider?: string;
    model?: string;
    temperature?: number;
    timeout?: number;
  },
): Promise<string> {
  const llm = getLLM(options);

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessage),
  ];

  const response = await llm.invoke(messages);
  return response.content as string;
}

/**
 * Check if LangChain is properly configured
 */
export function isLangChainConfigured(): boolean {
  try {
    getOpenAIApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available LLM providers
 */
export function getAvailableProviders(): string[] {
  const providers = ['openai'];

  // Could add more providers based on available API keys
  // if (process.env.ANTHROPIC_API_KEY) {
  //   providers.push('anthropic');
  // }

  return providers;
}
