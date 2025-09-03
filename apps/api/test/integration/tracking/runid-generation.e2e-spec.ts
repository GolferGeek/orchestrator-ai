import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('RunId Generation (e2e)', () => {
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

  it('should generate unique runIds for concurrent requests', async () => {
    const promises = Array.from({ length: 3 }, (_, i) =>
      llmService.generateCentralizedResponse(
        'You are a helpful assistant.',
        `Test message ${i + 1}`,
        {
          maxComplexity: 'simple',
          callerType: 'test',
          callerName: `runid-test-${i + 1}`,
          dataClassification: 'internal',
          preferLocal: true,
        }
      )
    );

    const results = await Promise.all(promises);
    const runIds = results.map(r => r.runMetadata.runId);
    const uniqueRunIds = new Set(runIds);

    expect(uniqueRunIds.size).toBe(3);
    console.log(`✅ Generated ${uniqueRunIds.size} unique runIds: ${Array.from(uniqueRunIds).join(', ')}`);
  });
});
