import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { LLMService } from '../../src/llms/llm.service';
import { LLMServiceFactory } from '../../src/llms/services/llm-service-factory';

/**
 * End-to-End Tests for Unified LLM Architecture
 *
 * These tests validate the complete flow from request to response
 * using real provider services (when available) to ensure the
 * entire architecture works correctly in realistic scenarios.
 */
describe('Unified LLM Architecture (E2E)', () => {
  let app: INestApplication;
  let llmService: LLMService;
  let llmServiceFactory: LLMServiceFactory;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    llmServiceFactory = moduleFixture.get<LLMServiceFactory>(LLMServiceFactory);

    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Unified Response Method E2E', () => {
    it('should handle Ollama requests end-to-end', async () => {
      const _result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are a helpful assistant. Be concise.',
        userMessage: 'Say "Hello World" and nothing else.',
        options: {
          maxTokens: 10,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'unified-architecture-test',
        },
      });

      // Validate response structure
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      const _response = result as any;
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);

      // Validate unified metadata structure
      expect(response.metadata).toBeDefined();
      expect(response.metadata.provider).toBe('ollama');
      expect(response.metadata.model).toBe('llama3.2:1b');
      expect(response.metadata.requestId).toBeDefined();
      expect(response.metadata.timestamp).toBeDefined();

      // Validate usage tracking
      expect(response.metadata.usage).toBeDefined();
      expect(typeof response.metadata.usage.inputTokens).toBe('number');
      expect(typeof response.metadata.usage.outputTokens).toBe('number');
      expect(typeof response.metadata.usage.totalTokens).toBe('number');

      // Validate timing
      expect(response.metadata.timing).toBeDefined();
      expect(typeof response.metadata.timing.duration).toBe('number');
      expect(response.metadata.timing.duration).toBeGreaterThan(0);

      console.log('✅ Ollama E2E Test Result:', {
        provider: response.metadata.provider,
        model: response.metadata.model,
        contentLength: response.content.length,
        duration: response.metadata.timing.duration,
        tokens: response.metadata.usage.totalTokens,
      });
    }, 30000);

    it('should handle OpenAI requests end-to-end (if API key available)', async () => {
      // Skip if no OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️ Skipping OpenAI E2E test - no API key');
        return;
      }

      const _result = await llmService.generateUnifiedResponse({
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a helpful assistant. Be very concise.',
        userMessage: 'Say "Hello from OpenAI" and nothing else.',
        options: {
          maxTokens: 15,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'openai-test',
        },
      });

      // Validate response structure
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      const _response = result as any;
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);

      // Validate unified metadata structure
      expect(response.metadata).toBeDefined();
      expect(response.metadata.provider).toBe('openai');
      expect(response.metadata.model).toContain('gpt-4o-mini'); // OpenAI returns versioned model names
      expect(response.metadata.requestId).toBeDefined();

      // Validate OpenAI-specific metadata
      expect(response.metadata.usage.inputTokens).toBeGreaterThan(0);
      expect(response.metadata.usage.outputTokens).toBeGreaterThan(0);
      expect(response.metadata.timing.duration).toBeGreaterThan(0);

      // Check for provider-specific fields
      if (response.metadata.providerSpecific) {
        expect(response.metadata.providerSpecific.finish_reason).toBeDefined();
      }

      console.log('✅ OpenAI E2E Test Result:', {
        provider: response.metadata.provider,
        model: response.metadata.model,
        contentLength: response.content.length,
        duration: response.metadata.timing.duration,
        tokens: response.metadata.usage.totalTokens,
        cost: response.metadata.usage.cost,
      });
    }, 30000);

    it('should handle Anthropic requests end-to-end (if API key available)', async () => {
      // Skip if no Anthropic API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('⏭️ Skipping Anthropic E2E test - no API key');
        return;
      }

      const _result = await llmService.generateUnifiedResponse({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        systemPrompt: 'You are a helpful assistant. Be very concise.',
        userMessage: 'Say "Hello from Claude" and nothing else.',
        options: {
          maxTokens: 15,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'anthropic-test',
        },
      });

      // Validate response structure
      const _response = result as any;
      expect(response.content).toBeDefined();
      expect(response.metadata.provider).toBe('anthropic');
      expect(response.metadata.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.metadata.usage.totalTokens).toBeGreaterThan(0);

      console.log('✅ Anthropic E2E Test Result:', {
        provider: response.metadata.provider,
        model: response.metadata.model,
        contentLength: response.content.length,
        duration: response.metadata.timing.duration,
        tokens: response.metadata.usage.totalTokens,
      });
    }, 30000);
  });

  describe('Error Handling E2E', () => {
    it('should handle invalid provider with standardized error', async () => {
      try {
        await llmService.generateUnifiedResponse({
          provider: 'invalid-provider',
          model: 'some-model',
          systemPrompt: 'Test',
          userMessage: 'Test',
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (_error) {
        // Should be a standardized LLM _error
        const llmError = _error as any;
        expect(llmError.name).toBe('LLMError');
        expect(llmError.type).toBeDefined();
        expect(llmError.code).toBeDefined();
        expect(llmError.provider).toBe('invalid-provider');
        expect(llmError.getUserFriendlyMessage).toBeDefined();

        const userMessage = llmError.getUserFriendlyMessage();
        expect(typeof userMessage).toBe('string');
        expect(userMessage.length).toBeGreaterThan(0);

        console.log('✅ Invalid Provider Error:', {
          type: llmError.type,
          code: llmError.code,
          userMessage,
          retryable: llmError.retryable,
        });
      }
    });

    it('should handle missing parameters with standardized error', async () => {
      try {
        await llmService.generateUnifiedResponse({
          provider: '',
          model: 'test-model',
          systemPrompt: 'Test',
          userMessage: 'Test',
        });

        expect(true).toBe(false);
      } catch (_error) {
        expect((_error as any).message).toContain('provider is required');
        console.log('✅ Missing Parameter Error:', (_error as any).message);
      }
    });

    it('should handle model not found with appropriate error', async () => {
      try {
        await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'nonexistent-model-xyz-123',
          systemPrompt: 'Test',
          userMessage: 'Test',
          options: { maxTokens: 5 },
        });

        expect(true).toBe(false);
      } catch (_error) {
        // Should get a model-related _error
        expect((_error as any).message).toBeDefined();
        console.log('✅ Model Not Found Error:', (_error as any).message);
      }
    }, 15000);
  });

  describe('Factory Integration E2E', () => {
    it('should create and cache provider services correctly', async () => {
      const config1 = {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.7,
      };

      const config2 = {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.7,
      };

      // Create services with same config
      const service1 = await llmServiceFactory.createService(config1);
      const service2 = await llmServiceFactory.createService(config2);

      // Should return the same cached instance
      expect(service1).toBe(service2);

      // Check cache stats
      const stats = llmServiceFactory.getCacheStats();
      expect(stats.totalCached).toBeGreaterThan(0);
      expect(stats.providerBreakdown.ollama).toBeGreaterThan(0);

      console.log('✅ Factory Caching:', stats);
    });

    it('should handle different configurations separately', async () => {
      const config1 = {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.5,
      };

      const config2 = {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.9,
      };

      // Create services with different configs
      const service1 = await llmServiceFactory.createService(config1);
      const service2 = await llmServiceFactory.createService(config2);

      // Should be different instances due to different temperature
      expect(service1).not.toBe(service2);

      console.log('✅ Factory Different Configs: Created separate instances');
    });
  });

  describe('Complete Flow E2E', () => {
    it('should handle complete request flow with metadata', async () => {
      const startTime = Date.now();

      const _result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'What is 2+2? Answer with just the number.',
        options: {
          maxTokens: 5,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'complete-flow-test',
          conversationId: 'test-conv-123',
          sessionId: 'test-session-456',
          userId: 'test-user-789',
          dataClassification: 'public',
        },
      });

      const endTime = Date.now();
      const _response = result as any;

      // Validate complete response
      expect(response.content).toBeDefined();
      expect(response.metadata).toBeDefined();

      // Validate metadata completeness
      expect(response.metadata.provider).toBe('ollama');
      expect(response.metadata.model).toBe('llama3.2:1b');
      expect(response.metadata.requestId).toBeDefined();
      expect(response.metadata.timestamp).toBeDefined();
      expect(response.metadata.status).toBe('completed');

      // Validate timing is reasonable
      expect(response.metadata.timing.duration).toBeGreaterThan(0);
      expect(response.metadata.timing.duration).toBeLessThan(30000); // Less than 30 seconds

      // Validate usage tracking
      expect(response.metadata.usage.inputTokens).toBeGreaterThan(0);
      expect(response.metadata.usage.outputTokens).toBeGreaterThan(0);
      expect(response.metadata.usage.totalTokens).toBeGreaterThan(0);

      // Local model should have zero cost
      expect(response.metadata.usage.cost).toBe(0);

      console.log('✅ Complete Flow E2E Test:', {
        provider: response.metadata.provider,
        model: response.metadata.model,
        content: response.content,
        duration: response.metadata.timing.duration,
        tokens: response.metadata.usage.totalTokens,
        requestId: response.metadata.requestId,
        frontendDuration: endTime - startTime,
      });
    }, 30000);

    it('should handle concurrent requests correctly', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: `Count to ${i + 1}`,
          options: {
            maxTokens: 20,
            temperature: 0.1,
            includeMetadata: true,
            callerName: `concurrent-test-${i + 1}`,
          },
        }),
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      expect(results).toHaveLength(5);

      results.forEach((result, i) => {
        const _response = result as any;
        expect(response.content).toBeDefined();
        expect(response.metadata.provider).toBe('ollama');
        expect(response.metadata.model).toBe('llama3.2:1b');
        expect(response.metadata.requestId).toBeDefined();

        // Each should have unique request ID
        const otherIds = results
          .filter((_, j) => j !== i)
          .map((r) => (r as any).metadata.requestId);
        expect(otherIds).not.toContain(response.metadata.requestId);
      });

      console.log('✅ Concurrent Requests E2E:', {
        totalRequests: results.length,
        allSucceeded: results.every((r) => (r as any).content),
        uniqueRequestIds: new Set(
          results.map((r) => (r as any).metadata.requestId),
        ).size,
      });
    }, 45000);
  });

  describe('Error Recovery E2E', () => {
    it('should recover gracefully from invalid model requests', async () => {
      const validRequest = {
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say hello.',
        options: {
          maxTokens: 10,
          includeMetadata: true, // Need metadata to get object response
        },
      };

      const invalidRequest = {
        provider: 'ollama',
        model: 'nonexistent-model',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say hello.',
        options: { maxTokens: 10 },
      };

      // Valid request should work
      const validResult =
        await llmService.generateUnifiedResponse(validRequest);
      expect((validResult as any).content).toBeDefined();

      // Invalid request should throw standardized error
      try {
        await llmService.generateUnifiedResponse(invalidRequest);
        expect(true).toBe(false);
      } catch (_error) {
        expect((_error as any).name).toBe('LLMError');
      }

      // Valid request should still work after error
      const validResult2 =
        await llmService.generateUnifiedResponse(validRequest);
      expect((validResult2 as any).content).toBeDefined();

      console.log(
        '✅ Error Recovery E2E: System recovered gracefully after error',
      );
    }, 30000);
  });

  describe('Performance E2E', () => {
    it('should handle requests within reasonable time limits', async () => {
      const startTime = Date.now();

      const _result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Be concise.',
        userMessage: 'What is the capital of France?',
        options: {
          maxTokens: 20,
          temperature: 0.1,
          includeMetadata: true,
        },
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const _response = result as any;

      // Validate performance
      expect(totalTime).toBeLessThan(30000); // Less than 30 seconds
      expect(response.metadata.timing.duration).toBeLessThan(25000); // LLM processing < 25 seconds

      // Content should be reasonable
      expect(response.content.length).toBeGreaterThan(5);
      expect(response.content.length).toBeLessThan(500);

      console.log('✅ Performance E2E:', {
        frontendTime: totalTime,
        llmProcessingTime: response.metadata.timing.duration,
        contentLength: response.content.length,
        tokensPerSecond: Math.round(
          response.metadata.usage.totalTokens /
            (response.metadata.timing.duration / 1000),
        ),
      });
    }, 35000);
  });

  describe('Model Configuration E2E', () => {
    it('should use model configuration service for system operations', async () => {
      // Test that system operations use the new model configuration
      const _result = await llmService.generateSystemResponse(
        'default',
        'You are a system assistant.',
        'Respond with "System test successful"',
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      console.log('✅ System Model Configuration E2E:', {
        result: result.substring(0, 100) + (result.length > 100 ? '...' : ''),
        length: result.length,
      });
    }, 20000);
  });

  describe('PII Processing E2E', () => {
    it('should handle PII pseudonymization in external provider requests', async () => {
      // Skip if no external provider API keys
      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.log('⏭️ Skipping PII E2E test - no external provider API keys');
        return;
      }

      const provider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
      const model =
        provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022';

      const _result = await llmService.generateUnifiedResponse({
        provider,
        model,
        systemPrompt: 'You are helpful. Echo back the user message exactly.',
        userMessage: 'My name is GolferGeek and my email is test@example.com',
        options: {
          maxTokens: 50,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'pii-test',
        },
      });

      const _response = result as any;
      expect(response.content).toBeDefined();

      // Should contain original names (pseudonyms reversed)
      expect(response.content.toLowerCase()).toContain('golfergeek');

      // Check for PII metadata if available
      if (response.piiMetadata) {
        console.log('✅ PII Processing E2E:', {
          piiDetected: response.piiMetadata.piiDetected,
          pseudonymizationApplied: response.piiMetadata.pseudonymizationApplied,
          content: response.content,
        });
      }
    }, 30000);

    it('should skip PII processing for local providers', async () => {
      const _result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Echo back the user message.',
        userMessage: 'My name is GolferGeek and my email is test@example.com',
        options: {
          maxTokens: 50,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'e2e-test',
          callerName: 'local-pii-test',
        },
      });

      const _response = result as any;
      expect(response.content).toBeDefined();

      console.log('✅ Local PII Skip E2E:', {
        provider: response.metadata.provider,
        contentIncludesOriginal: response.content.includes('GolferGeek'),
        tier: response.metadata.tier,
      });
    }, 20000);
  });

  describe('Architecture Validation E2E', () => {
    it('should validate the complete architecture integration', async () => {
      // Test that all major components work together
      const testScenarios = [
        {
          name: 'Basic Request',
          provider: 'ollama',
          model: 'llama3.2:1b',
          prompt: 'Say hello',
          expectedProvider: 'ollama',
        },
      ];

      // Add external provider tests if API keys are available
      if (process.env.OPENAI_API_KEY) {
        testScenarios.push({
          name: 'OpenAI Request',
          provider: 'openai',
          model: 'gpt-4o-mini',
          prompt: 'Say hello from OpenAI',
          expectedProvider: 'openai',
        });
      }

      if (process.env.ANTHROPIC_API_KEY) {
        testScenarios.push({
          name: 'Anthropic Request',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          prompt: 'Say hello from Claude',
          expectedProvider: 'anthropic',
        });
      }

      const results = [];

      for (const scenario of testScenarios) {
        try {
          const _result = await llmService.generateUnifiedResponse({
            provider: scenario.provider,
            model: scenario.model,
            systemPrompt: 'You are helpful.',
            userMessage: scenario.prompt,
            options: {
              maxTokens: 20,
              temperature: 0.1,
              includeMetadata: true,
              callerName: `architecture-validation-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`,
            },
          });

          const _response = result as any;

          results.push({
            scenario: scenario.name,
            success: true,
            provider: response.metadata.provider,
            model: response.metadata.model,
            contentLength: response.content.length,
            duration: response.metadata.timing.duration,
            tokens: response.metadata.usage.totalTokens,
          });
        } catch (_error) {
          results.push({
            scenario: scenario.name,
            success: false,
            _error: (_error as any).message,
          });
        }
      }

      // At least one scenario should succeed (Ollama should always work)
      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      console.log('✅ Architecture Validation E2E Results:', results);

      // Validate that successful results have proper structure
      successfulResults.forEach((result) => {
        expect(result.provider).toBeDefined();
        expect(result.model).toBeDefined();
        expect(result.contentLength).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.tokens).toBeGreaterThan(0);
      });
    }, 60000);
  });
});
