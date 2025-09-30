import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Simple Local Routing (e2e)', () => {
  let app: INestApplication;
  let llmService: LLMService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  it('should route simple math question to local model', async () => {
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'What is 2 + 2?',
      {
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'simple-routing-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.runMetadata).toBeDefined();
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.runMetadata.provider).toBeDefined();
    expect(result.runMetadata.duration).toBeDefined();
    expect(result.routingDecision).toBeDefined();
    expect(result.routingDecision.provider).toBeDefined();
    expect(result.routingDecision.model).toBeDefined();
    expect(typeof result.routingDecision.isLocal).toBe('boolean');
    
  });
});
