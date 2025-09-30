import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Simple Request Speed (e2e)', () => {
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

  it('should complete simple request within reasonable time', async () => {
    const startTime = Date.now();
    
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say hello.',
      {
        maxComplexity: 'simple',
        callerType: 'performance-test',
        callerName: 'speed-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    const duration = Date.now() - startTime;
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(duration).toBeLessThan(30000); // 30 seconds max
    
    console.log(`✅ Request completed in ${duration}ms using ${result.runMetadata.provider}`);
  });
});
