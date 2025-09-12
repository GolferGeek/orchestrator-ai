import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Concurrent Requests Performance (e2e)', () => {
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

  it('should handle 3 concurrent requests', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 3 }, (_, i) =>
      llmService.generateCentralizedResponse(
        'You are a helpful assistant.',
        `Concurrent request ${i + 1}`,
        {
          maxComplexity: 'simple',
          callerType: 'concurrent-test',
          callerName: `concurrent-${i + 1}`,
          dataClassification: 'internal',
          preferLocal: true,
        }
      )
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    expect(duration).toBeLessThan(60000); // 1 minute total
    
    const runIds = results.map(r => r.runMetadata.runId);
    const uniqueRunIds = new Set(runIds);
    expect(uniqueRunIds.size).toBe(3);
    
    console.log(`✅ Concurrent: ${duration}ms for 3 requests`);
  });
});
