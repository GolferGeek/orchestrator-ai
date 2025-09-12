import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Complex Complexity Routing (e2e)', () => {
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

  it('should handle complex analysis task', async () => {
    const result = await llmService.generateCentralizedResponse(
      'You are an expert analyst.',
      'Analyze the pros and cons of microservices architecture.',
      {
        maxComplexity: 'complex',
        callerType: 'test',
        callerName: 'complex-analysis-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.runMetadata.runId).toBeDefined();
    console.log(`✅ Complex analysis routed to: ${result.runMetadata.provider}`);
  });
});
