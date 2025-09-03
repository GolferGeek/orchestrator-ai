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
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Test model fallback.',
      {
        provider: 'anthropic',
        modelId: 'claude-nonexistent-model',
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'model-fallback-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.runMetadata.modelId).not.toBe('claude-nonexistent-model');
    console.log(`✅ Model fallback: used ${result.runMetadata.modelId} instead`);
  });
});
