import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Usage Metrics Tracking (e2e)', () => {
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

  it('should track token usage and cost', async () => {
    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Count to five.',
      {
        complexity: 'simple',
        callerType: 'test',
        callerName: 'metrics-test',
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.metadata.runId).toBeDefined();
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);
    expect(result.metadata.cost).toBeGreaterThanOrEqual(0);
    console.log(`✅ Usage tracked: ${result.metadata.tokensUsed} tokens, $${result.metadata.cost} cost`);
  });
});
