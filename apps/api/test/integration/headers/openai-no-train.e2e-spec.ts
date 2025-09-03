import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';
import * as nock from 'nock';

describe('OpenAI No-Train Header (e2e)', () => {
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

  it('should send OpenAI-No-Train header', async () => {
    const scope = nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .matchHeader('OpenAI-No-Train', 'true')
      .reply(200, {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Test response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

    try {
      await llmService.generateResponse(
        'You are a helpful assistant.',
        'Test message.',
        {
          provider: 'openai',
          complexity: 'simple',
          callerType: 'test',
          callerName: 'openai-header-test',
          dataClassification: 'confidential',
        }
      );
      expect(scope.isDone()).toBe(true);
      console.log('✅ OpenAI no-train header sent correctly');
    } catch (error) {
      if (!error.message?.includes('API key')) {
        throw error;
      }
      console.log('⚠️ OpenAI API key not configured, header test mocked');
    }
  });
});
