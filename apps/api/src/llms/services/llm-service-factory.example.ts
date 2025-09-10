/**
 * Example usage of LLMServiceFactory with full metadata preservation
 * 
 * This example demonstrates how to use the factory to create LLM services
 * while ensuring all metadata (usage, timing, costs, provider-specific data)
 * flows through properly.
 */

import { LLMServiceFactory } from './llm-service-factory';
import { LLMServiceConfig, GenerateResponseParams } from './llm-interfaces';

export class LLMServiceFactoryExample {
  constructor(private readonly factory: LLMServiceFactory) {}

  /**
   * Example 1: Direct service creation and usage
   */
  async example1_DirectServiceUsage() {
    const config: LLMServiceConfig = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
    };

    // Create service (cached by default)
    const service = await this.factory.createService(config);

    // Use service directly - all metadata is preserved
    const params: GenerateResponseParams = {
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'What is the capital of France?',
      config,
      options: {
        temperature: 0.5, // Override config temperature
      },
    };

    const response = await service.generateResponse(params);

    console.log('Response content:', response.content);
    console.log('Metadata:', {
      provider: response.metadata.provider,
      model: response.metadata.model,
      usage: response.metadata.usage,
      timing: response.metadata.timing,
      cost: response.metadata.usage.cost,
      providerSpecific: response.metadata.providerSpecific,
    });
    console.log('PII Metadata:', response.piiMetadata);

    return response;
  }

  /**
   * Example 2: Using the convenience method
   */
  async example2_ConvenienceMethod() {
    const config: LLMServiceConfig = {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.8,
    };

    const params: GenerateResponseParams = {
      systemPrompt: 'You are a creative writing assistant.',
      userMessage: 'Write a short poem about technology.',
      config,
    };

    // One-liner that creates service and generates response
    const response = await this.factory.generateResponse(config, params);

    console.log('Anthropic Response:', response.content);
    console.log('Full metadata preserved:', response.metadata);

    return response;
  }

  /**
   * Example 3: Multiple providers with caching
   */
  async example3_MultipleProviders() {
    const providers = [
      { provider: 'openai', model: 'gpt-3.5-turbo' },
      { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
      { provider: 'google', model: 'gemini-pro' },
    ] as const;

    const results = [];

    for (const { provider, model } of providers) {
      const config: LLMServiceConfig = {
        provider,
        model,
        temperature: 0.7,
      };

      const params: GenerateResponseParams = {
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'Explain quantum computing in one sentence.',
        config,
      };

      try {
        const response = await this.factory.generateResponse(config, params);
        
        results.push({
          provider,
          model,
          content: response.content,
          usage: response.metadata.usage,
          timing: response.metadata.timing,
          providerSpecific: response.metadata.providerSpecific,
        });
      } catch (error) {
        console.error(`Error with ${provider}:`, error);
      }
    }

    // Show cache statistics
    const cacheStats = this.factory.getCacheStats();
    console.log('Cache statistics:', cacheStats);

    return results;
  }

  /**
   * Example 4: Provider-specific metadata handling
   */
  async example4_ProviderSpecificMetadata() {
    // OpenAI with specific metadata
    const openaiConfig: LLMServiceConfig = {
      provider: 'openai',
      model: 'gpt-4',
    };

    const openaiParams: GenerateResponseParams = {
      systemPrompt: 'You are an expert programmer.',
      userMessage: 'Write a Python function to calculate fibonacci numbers.',
      config: openaiConfig,
    };

    const openaiResponse = await this.factory.generateResponse(openaiConfig, openaiParams);
    
    console.log('OpenAI Provider-Specific Metadata:', {
      finishReason: openaiResponse.metadata.providerSpecific?.finish_reason,
      systemFingerprint: openaiResponse.metadata.providerSpecific?.system_fingerprint,
    });

    // Google with safety ratings
    const googleConfig: LLMServiceConfig = {
      provider: 'google',
      model: 'gemini-pro',
    };

    const googleParams: GenerateResponseParams = {
      systemPrompt: 'You are a safety-conscious assistant.',
      userMessage: 'Explain how to safely handle chemicals in a lab.',
      config: googleConfig,
    };

    const googleResponse = await this.factory.generateResponse(googleConfig, googleParams);
    
    console.log('Google Provider-Specific Metadata:', {
      safetyRatings: googleResponse.metadata.providerSpecific?.safety_ratings,
      citationMetadata: googleResponse.metadata.providerSpecific?.citation_metadata,
    });

    return { openaiResponse, googleResponse };
  }

  /**
   * Example 5: Error handling with metadata
   */
  async example5_ErrorHandling() {
    try {
      // This will fail validation
      const invalidConfig: LLMServiceConfig = {
        provider: 'invalid-provider' as any,
        model: 'some-model',
      };

      await this.factory.createService(invalidConfig);
    } catch (error) {
      console.log('Expected validation error:', error instanceof Error ? error.message : String(error));
    }

    try {
      // This will fail with invalid temperature
      const badConfig: LLMServiceConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 5, // Invalid temperature
      };

      await this.factory.createService(badConfig);
    } catch (error) {
      console.log('Expected temperature validation error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Example 6: Cache management
   */
  async example6_CacheManagement() {
    // Create several services
    const configs = [
      { provider: 'openai', model: 'gpt-4' },
      { provider: 'openai', model: 'gpt-3.5-turbo' },
      { provider: 'anthropic', model: 'claude-3-sonnet' },
    ] as const;

    for (const config of configs) {
      await this.factory.createService(config as LLMServiceConfig);
    }

    console.log('Initial cache stats:', this.factory.getCacheStats());

    // Clear OpenAI cache only
    this.factory.clearCache('openai');
    console.log('After clearing OpenAI cache:', this.factory.getCacheStats());

    // Clear all cache
    this.factory.clearCache();
    console.log('After clearing all cache:', this.factory.getCacheStats());
  }
}

/**
 * Usage example in a service or controller
 */
export async function demonstrateFactoryUsage(factory: LLMServiceFactory) {
  const example = new LLMServiceFactoryExample(factory);

  console.log('=== Example 1: Direct Service Usage ===');
  await example.example1_DirectServiceUsage();

  console.log('\n=== Example 2: Convenience Method ===');
  await example.example2_ConvenienceMethod();

  console.log('\n=== Example 3: Multiple Providers ===');
  await example.example3_MultipleProviders();

  console.log('\n=== Example 4: Provider-Specific Metadata ===');
  await example.example4_ProviderSpecificMetadata();

  console.log('\n=== Example 5: Error Handling ===');
  await example.example5_ErrorHandling();

  console.log('\n=== Example 6: Cache Management ===');
  await example.example6_CacheManagement();
}
