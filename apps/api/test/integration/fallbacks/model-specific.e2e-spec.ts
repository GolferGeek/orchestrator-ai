import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Model-Specific Fallback (e2e)', () => {
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

  it('should fallback when specific model is unavailable', async () => {
    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Test model fallback.',
      {
        provider: 'anthropic',
        modelId: 'claude-nonexistent-model',
        complexity: 'simple',
        callerType: 'test',
        callerName: 'model-fallback-test',
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(result.metadata.modelId).not.toBe('claude-nonexistent-model');
    console.log(`✅ Model fallback: used ${result.metadata.modelId} instead`);
  });
});
