import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Caller Type Tracking (e2e)', () => {
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

  it('should track agent caller type', async () => {
    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Test agent call.',
      {
        complexity: 'simple',
        callerType: 'agent',
        callerName: 'test-agent',
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.metadata.runId).toBeDefined();
    console.log(`✅ Agent call tracked with runId: ${result.metadata.runId}`);
  });
});
