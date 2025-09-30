import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Provider Preference Routing (e2e)', () => {
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

  it('should respect explicit provider preference', async () => {
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say hello.',
      {
        provider: 'ollama',
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'provider-preference-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.runMetadata.provider).toBe('ollama');
    console.log(`✅ Explicit provider preference respected: ${result.runMetadata.provider}`);
  });
});
