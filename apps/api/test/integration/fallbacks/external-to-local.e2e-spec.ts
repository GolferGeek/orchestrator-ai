import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';
import * as nock from 'nock';

describe('External to Local Fallback (e2e)', () => {
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
    nock.cleanAll();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  it('should fallback to local when external provider fails', async () => {
    const scope = nock('https://api.anthropic.com')
      .post('/v1/messages')
      .reply(500, { error: { message: 'Internal server error' } });

    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Test fallback.',
      {
        provider: 'anthropic',
        complexity: 'simple',
        callerType: 'test',
        callerName: 'fallback-test',
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(['ollama', 'openai', 'google']).toContain(result.metadata.provider);
    expect(scope.isDone()).toBe(true);
    console.log(`✅ Fallback successful: ${result.metadata.provider}`);
  });
});
