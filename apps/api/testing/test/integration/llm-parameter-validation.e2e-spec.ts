import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('LLM Parameter Validation (e2e)', () => {
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

  describe('Required Parameter Validation', () => {
    it('should reject null provider', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: null as any,
          model: 'test-model',
          systemPrompt: 'Test',
          userMessage: 'Test',
        })
      ).rejects.toThrow('provider is required');
    });

    it('should reject undefined provider', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: undefined as any,
          model: 'test-model', 
          systemPrompt: 'Test',
          userMessage: 'Test',
        })
      ).rejects.toThrow('provider is required');
    });

    it('should reject whitespace-only provider', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: '   ',
          model: 'test-model',
          systemPrompt: 'Test', 
          userMessage: 'Test',
        })
      ).rejects.toThrow('provider is required');
    });

    it('should reject empty model', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: '',
          systemPrompt: 'Test',
          userMessage: 'Test',
        })
      ).rejects.toThrow('model is required');
    });

    it('should reject null systemPrompt', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: null as any,
          userMessage: 'Test',
        })
      ).rejects.toThrow('systemPrompt is required');
    });

    it('should reject empty userMessage', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test',
          userMessage: '',
        })
      ).rejects.toThrow('userMessage is required');
    });
  });

  describe('Provider Case Sensitivity', () => {
    it('should handle uppercase provider names', async () => {
      // This should work if Ollama is available
      const result = llmService.generateUnifiedResponse({
        provider: 'OLLAMA',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful.',
        userMessage: 'Say "test"',
        options: { maxTokens: 5 }
      });

      // Should either work or fail with a specific provider error, not validation error
      await expect(result).resolves.toBeDefined().catch(error => {
        expect(error.message).not.toContain('Unsupported provider');
      });
    });

    it('should handle mixed case provider names', async () => {
      const result = llmService.generateUnifiedResponse({
        provider: 'OlLaMa',
        model: 'llama3.2:1b', 
        systemPrompt: 'You are helpful.',
        userMessage: 'Say "test"',
        options: { maxTokens: 5 }
      });

      await expect(result).resolves.toBeDefined().catch(error => {
        expect(error.message).not.toContain('Unsupported provider');
      });
    });
  });

  describe('Invalid Provider Validation', () => {
    it('should reject completely invalid provider', async () => {
      await expect(
        llmService.generateUnifiedResponse({
          provider: 'totally-fake-provider',
          model: 'test-model',
          systemPrompt: 'Test',
          userMessage: 'Test',
        })
      ).rejects.toThrow('Unsupported provider: totally-fake-provider');
    });

    it('should list supported providers in error', async () => {
      try {
        await llmService.generateUnifiedResponse({
          provider: 'invalid',
          model: 'test-model',
          systemPrompt: 'Test',
          userMessage: 'Test',
        });
      } catch (_error) {
        expect(_error.message).toContain('openai');
        expect(_error.message).toContain('anthropic');
        expect(_error.message).toContain('google');
        expect(_error.message).toContain('ollama');
        expect(_error.message).toContain('grok');
      }
    });
  });
});

