import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Simple Complexity Routing (e2e)', () => {
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

  it('should handle simple math question', async () => {
    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'What is 2 + 2?',
      {
        complexity: 'simple',
        callerType: 'test',
        callerName: 'simple-math-test',
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(result.metadata.runId).toBeDefined();
    console.log(`✅ Simple math routed to: ${result.metadata.provider}`);
  });
});
