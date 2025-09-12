import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('LLM Metadata Propagation (e2e)', () => {
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

  describe('Request Metadata Propagation', () => {
    it('should propagate caller information through the entire stack', async () => {
      const callerType = 'integration-test';
      const callerName = 'metadata-propagation-test';
      const dataClassification = 'confidential';
      const conversationId = 'test-conv-123';
      const sessionId = 'test-session-456';
      const userId = 'test-user-789';

      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say hello.',
        options: {
          includeMetadata: true,
          callerType,
          callerName,
          dataClassification,
          conversationId,
          sessionId,
          userId,
          maxTokens: 20,
        }
      });

      const response = result as any;
      expect(response.metadata).toBeDefined();
      
      // Should propagate all caller metadata
      expect(response.metadata.callerType).toBe(callerType);
      expect(response.metadata.callerName).toBe(callerName);
      expect(response.metadata.dataClassification).toBe(dataClassification);
      expect(response.metadata.conversationId).toBe(conversationId);
      expect(response.metadata.sessionId).toBe(sessionId);
      expect(response.metadata.userId).toBe(userId);
      
      console.log('📋 Caller Metadata Propagation:', {
        callerType: response.metadata.callerType,
        callerName: response.metadata.callerName,
        dataClassification: response.metadata.dataClassification,
        conversationId: response.metadata.conversationId,
        sessionId: response.metadata.sessionId,
        userId: response.metadata.userId,
      });
    }, 30000);

    it('should include request timing metadata', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Count to 3.',
        options: {
          includeMetadata: true,
          maxTokens: 30,
        }
      });

      const response = result as any;
      expect(response.metadata.timing).toBeDefined();
      expect(response.metadata.timing.startTime).toBeDefined();
      expect(response.metadata.timing.endTime).toBeDefined();
      expect(response.metadata.timing.duration).toBeGreaterThan(0);
      
      // Timing should be reasonable (not negative, not impossibly fast)
      expect(response.metadata.timing.duration).toBeGreaterThan(10); // At least 10ms
      expect(response.metadata.timing.duration).toBeLessThan(60000); // Less than 60 seconds
      
      console.log('⏱️ Timing Metadata:', response.metadata.timing);
    }, 30000);

    it('should include token usage metadata', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'Write exactly 5 words.',
        options: {
          includeMetadata: true,
          maxTokens: 20,
        }
      });

      const response = result as any;
      expect(response.metadata.usage).toBeDefined();
      expect(response.metadata.usage.inputTokens).toBeGreaterThan(0);
      expect(response.metadata.usage.outputTokens).toBeGreaterThan(0);
      expect(response.metadata.usage.totalTokens).toBe(
        response.metadata.usage.inputTokens + response.metadata.usage.outputTokens
      );
      
      console.log('🔢 Token Usage:', response.metadata.usage);
    }, 30000);
  });

  describe('Provider-Specific Metadata', () => {
    it('should include provider-specific metadata from Ollama', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say "test".',
        options: {
          includeMetadata: true,
          temperature: 0.7,
          maxTokens: 10,
        }
      });

      const response = result as any;
      expect(response.metadata.provider).toBe('ollama');
      expect(response.metadata.model).toBe('llama3.2:1b');
      
      // Should have provider-specific metadata
      if (response.metadata.providerSpecific) {
        expect(response.metadata.providerSpecific.modelInfo).toBeDefined();
        console.log('🦙 Ollama-Specific Metadata:', response.metadata.providerSpecific);
      }
    }, 30000);
  });

  describe('Configuration Metadata', () => {
    it('should include model configuration in metadata', async () => {
      const temperature = 0.3;
      const maxTokens = 25;

      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say hello briefly.',
        options: {
          includeMetadata: true,
          temperature,
          maxTokens,
        }
      });

      const response = result as any;
      expect(response.metadata.config).toBeDefined();
      expect(response.metadata.config.temperature).toBe(temperature);
      expect(response.metadata.config.maxTokens).toBe(maxTokens);
      
      console.log('⚙️ Configuration Metadata:', response.metadata.config);
    }, 30000);
  });

  describe('Error Metadata Propagation', () => {
    it('should include error metadata when model fails', async () => {
      try {
        await llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'nonexistent-model-xyz',
          systemPrompt: 'Test',
          userMessage: 'Test',
          options: {
            includeMetadata: true,
            maxTokens: 10,
          }
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Error should contain useful metadata
        expect(error.message).toContain('nonexistent-model-xyz');
        expect(error.message).toContain('not found');
        
        console.log('❌ Error with Metadata:', error.message);
      }
    }, 30000);
  });

  describe('Metadata Consistency', () => {
    it('should maintain consistent metadata structure across multiple calls', async () => {
      const calls = Array.from({ length: 3 }, (_, i) =>
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'llama3.2:1b',
          systemPrompt: 'You are helpful.',
          userMessage: `Test message ${i + 1}`,
          options: {
            includeMetadata: true,
            maxTokens: 15,
            callerName: `consistency-test-${i + 1}`,
          }
        })
      );

      const results = await Promise.all(calls);
      
      // All results should have same metadata structure
      results.forEach((result, i) => {
        const response = result as any;
        expect(response.metadata).toBeDefined();
        expect(response.metadata.provider).toBe('ollama');
        expect(response.metadata.model).toBe('llama3.2:1b');
        expect(response.metadata.callerName).toBe(`consistency-test-${i + 1}`);
        expect(response.metadata.usage).toBeDefined();
        expect(response.metadata.timing).toBeDefined();
      });
      
      console.log('🔄 Metadata Consistency Check: All calls have consistent structure');
    }, 45000);
  });
});

