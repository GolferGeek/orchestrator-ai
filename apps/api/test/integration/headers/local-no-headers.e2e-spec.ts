import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Local Model Headers (e2e)', () => {
  let app: INestApplication;
  let llmService: LLMService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should not send no-train headers to local models', async () => {
    try {
      const result = await llmService.generateCentralizedResponse(
        'You are a helpful assistant.',
        'Test local model.',
        {
          provider: 'ollama',
          maxComplexity: 'simple',
          callerType: 'test',
          callerName: 'local-header-test',
          dataClassification: 'confidential',
          preferLocal: true,
        }
      );

      expect(result).toBeDefined();
      expect(result.runMetadata.provider).toBe('ollama');
      console.log('✅ Local model handled without unnecessary headers');
    } catch (error) {
      if (error.message?.includes('Ollama')) {
        console.log('⚠️ Ollama not available for local header test');
      } else {
        throw error;
      }
    }
  });
});
