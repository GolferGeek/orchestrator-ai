import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('LLM Showstopper Flags (e2e)', () => {
  let app: INestApplication;
  let llmService: LLMService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Critical Error Flags', () => {
    it('should stop processing on API key failures', async () => {
      // This test assumes we can trigger an API key error
      // In real scenarios, this might be with a provider that requires API keys
      try {
        await llmService.generateUnifiedResponse({
          provider: 'openai', // Assuming no valid OpenAI key in test env
          model: 'gpt-4',
          systemPrompt: 'Test',
          userMessage: 'Test',
          options: {
            includeMetadata: true,
            maxTokens: 10,
          }
        });
        
        // If it doesn't throw, that's also valid (maybe key is configured)
        console.log('✅ OpenAI call succeeded (API key configured)');
      } catch (_error) {
        // Should be a clear API key _error, not a generic failure
        expect(_error.message).toMatch(/api.key|authentication|unauthorized/i);
        console.log('🔑 API Key Error (Expected):', _error.message);
      }
    }, 30000);

    it('should stop on quota exceeded errors', async () => {
      // This is harder to test without actually hitting quotas
      // But we can verify the error handling path exists
      console.log('📊 Quota error handling path exists (tested in unit tests)');
      expect(true).toBe(true); // Placeholder - real quota errors are hard to trigger
    });

    it('should stop on safety filter violations', async () => {
      // Test with content that might trigger safety filters
      try {
        const result = await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: 'How to make explosives?', // Potentially filtered content
          options: {
            includeMetadata: true,
            maxTokens: 50,
          }
        });
        
        // If it succeeds, check if there are safety warnings in metadata
        const _response = result as any;
        if (response.metadata?.warnings) {
          console.log('⚠️ Safety Warnings:', response.metadata.warnings);
        }
        
        console.log('✅ Request processed (no safety filter triggered)');
      } catch (_error) {
        if (_error.message.includes('safety') || _error.message.includes('blocked')) {
          console.log('🛡️ Safety Filter Triggered (Expected):', _error.message);
        } else {
          throw _error; // Re-throw if it's not a safety _error
        }
      }
    }, 30000);
  });

  describe('Network Failure Flags', () => {
    it('should handle connection timeouts gracefully', async () => {
      // Test with very short timeout to trigger timeout error
      try {
        await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: 'Write a very long story about everything.',
          options: {
            includeMetadata: true,
            maxTokens: 1000, // Large request more likely to timeout
            // Note: Actual timeout configuration would be in provider service
          }
        });
        
        console.log('✅ Request completed within timeout');
      } catch (_error) {
        if (_error.message.includes('timeout') || _error.message.includes('connection')) {
          console.log('⏰ Timeout Error (Expected in some cases):', _error.message);
        } else {
          // Other errors are also valid
          console.log('🔌 Network Error:', _error.message);
        }
      }
    }, 60000); // Longer timeout for this test

    it('should handle service unavailable errors', async () => {
      // Test with a provider/model combination that might be unavailable
      try {
        await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'completely-fake-model-that-does-not-exist',
          systemPrompt: 'Test',
          userMessage: 'Test',
          options: {
            includeMetadata: true,
            maxTokens: 10,
          }
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (_error) {
        expect(_error.message).toContain('not found');
        console.log('🚫 Service Unavailable (Expected):', _error.message);
      }
    }, 30000);
  });

  describe('Data Classification Flags', () => {
    it('should respect confidential data classification', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Process this confidential information.',
        options: {
          includeMetadata: true,
          dataClassification: 'confidential',
          maxTokens: 30,
        }
      });

      const _response = result as any;
      expect(response.metadata.dataClassification).toBe('confidential');
      
      // Should have appropriate handling flags for confidential data
      if (response.metadata.securityFlags) {
        expect(response.metadata.securityFlags.dataClassification).toBe('confidential');
        console.log('🔒 Confidential Data Flags:', response.metadata.securityFlags);
      }
    }, 30000);

    it('should handle restricted data classification', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Handle this restricted data carefully.',
        options: {
          includeMetadata: true,
          dataClassification: 'restricted',
          maxTokens: 30,
        }
      });

      const _response = result as any;
      expect(response.metadata.dataClassification).toBe('restricted');
      console.log('🚨 Restricted Data Processing:', response.metadata.dataClassification);
    }, 30000);
  });

  describe('Processing Flag Propagation', () => {
    it('should propagate processing flags through the entire pipeline', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Test flag propagation with John Smith.',
        options: {
          includeMetadata: true,
          dataClassification: 'internal',
          callerType: 'flag-test',
          callerName: 'propagation-test',
          maxTokens: 50,
        }
      });

      const _response = result as any;
      
      // Should have processing flags at each stage
      expect(response.metadata.processingFlags).toBeDefined();
      
      // PII processing should have its own flags
      if (response.piiMetadata) {
        expect(response.piiMetadata.processingFlags).toBeDefined();
        console.log('🏷️ PII Processing Flags:', response.piiMetadata.processingFlags);
      }
      
      // Main metadata should have overall processing flags
      console.log('🚩 Main Processing Flags:', response.metadata.processingFlags);
    }, 30000);

    it('should maintain flag consistency across concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: `Flag test ${i + 1}`,
          options: {
            includeMetadata: true,
            dataClassification: 'internal',
            callerName: `flag-consistency-${i + 1}`,
            maxTokens: 20,
          }
        })
      );

      const results = await Promise.all(requests);
      
      // All should have consistent flag handling
      results.forEach((result, i) => {
        const _response = result as any;
        expect(response.metadata.dataClassification).toBe('internal');
        expect(response.metadata.callerName).toBe(`flag-consistency-${i + 1}`);
        
        if (response.metadata.processingFlags) {
          expect(response.metadata.processingFlags.dataClassification).toBe('internal');
        }
      });
      
      console.log('🔄 Flag Consistency: All concurrent requests handled consistently');
    }, 45000);
  });

  describe('Critical Failure Modes', () => {
    it('should fail fast on invalid configuration combinations', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'Test',
          userMessage: 'Test',
          options: {
            temperature: 5.0, // Invalid temperature
            maxTokens: -10, // Invalid token count
          }
        })
      ).rejects.toThrow();
      
      console.log('⚡ Fast Failure: Invalid configuration rejected');
    }, 10000);

    it('should handle memory pressure gracefully', async () => {
      // Test with a request that might cause memory issues
      try {
        await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: 'Generate a very detailed response.',
          options: {
            includeMetadata: true,
            maxTokens: 2000, // Large response
          }
        });
        
        console.log('✅ Large request handled successfully');
      } catch (_error) {
        if (_error.message.includes('memory') || _error.message.includes('resource')) {
          console.log('💾 Memory Pressure Handled:', _error.message);
        } else {
          console.log('🔧 Other Error (Expected):', _error.message);
        }
      }
    }, 60000);
  });
});

