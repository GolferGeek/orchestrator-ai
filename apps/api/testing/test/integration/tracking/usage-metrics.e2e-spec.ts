import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

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
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Count to five.',
      {
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'metrics-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.runMetadata.inputTokens).toBeGreaterThan(0);
    expect(result.runMetadata.cost).toBeGreaterThanOrEqual(0);
    const totalTokens = (result.runMetadata.inputTokens || 0) + (result.runMetadata.outputTokens || 0);
    console.log(`✅ Usage tracked: ${totalTokens} tokens (${result.runMetadata.inputTokens} in, ${result.runMetadata.outputTokens} out), $${result.runMetadata.cost} cost`);
  });
});
