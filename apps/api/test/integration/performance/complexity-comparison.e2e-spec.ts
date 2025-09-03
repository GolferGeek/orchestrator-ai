import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Complexity Performance Comparison (e2e)', () => {
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

  it('should show performance differences between complexity levels', async () => {
    const complexities = [
      { level: 'simple', prompt: 'What is 1+1?' },
      { level: 'medium', prompt: 'Explain photosynthesis briefly.' },
      { level: 'complex', prompt: 'Analyze quantum computing benefits.' },
    ] as const;

    const results = [];
    
    for (const { level, prompt } of complexities) {
      const startTime = Date.now();
      
      const result = await llmService.generateResponse(
        'You are a helpful assistant.',
        prompt,
        {
          complexity: level,
          callerType: 'complexity-test',
          callerName: `${level}-comparison`,
          dataClassification: 'internal',
        }
      );

      const duration = Date.now() - startTime;
      results.push({ level, duration, provider: result.metadata.provider });
    }

    results.forEach(({ level, duration, provider }) => {
      console.log(`✅ ${level}: ${duration}ms (${provider})`);
    });

    expect(results).toHaveLength(3);
  });
});
