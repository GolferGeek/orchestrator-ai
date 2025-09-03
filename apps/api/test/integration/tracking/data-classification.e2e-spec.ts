import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Data Classification Tracking (e2e)', () => {
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

  it('should track confidential data classification', async () => {
    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Process confidential data.',
      {
        complexity: 'simple',
        callerType: 'system',
        callerName: 'confidential-test',
        dataClassification: 'confidential',
      }
    );

    expect(result).toBeDefined();
    expect(result.metadata.runId).toBeDefined();
    console.log(`✅ Confidential data tracked with runId: ${result.metadata.runId}`);
  });
});
