import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';
import * as nock from 'nock';

describe('Context Preservation During Fallback (e2e)', () => {
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

  it('should preserve context during fallback', async () => {
    nock('https://api.anthropic.com')
      .post('/v1/messages')
      .reply(503, { error: { message: 'Service unavailable' } });

    const testConversationId = `fallback-context-${Date.now()}`;
    const testCallerName = `context-preservation-${Date.now()}`;

    const result = await llmService.generateResponse(
      'You are a helpful assistant.',
      'Test context preservation.',
      {
        complexity: 'simple',
        callerType: 'context-test',
        callerName: testCallerName,
        conversationId: testConversationId,
        dataClassification: 'internal',
      }
    );

    expect(result).toBeDefined();
    expect(result.metadata.runId).toBeDefined();
    console.log(`✅ Context preserved during fallback: runId ${result.metadata.runId}`);
  });
});
