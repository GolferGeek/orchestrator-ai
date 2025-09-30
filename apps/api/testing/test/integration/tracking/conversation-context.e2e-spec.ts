import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Conversation Context Tracking (e2e)', () => {
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

  it('should link requests to conversation context', async () => {
    const conversationId = `test-conversation-${Date.now()}`;
    
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'First message in conversation.',
      {
        maxComplexity: 'simple',
        callerType: 'user',
        callerName: 'conversation-test',
        conversationId,
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.runMetadata.runId).toBeDefined();
    console.log(`✅ Conversation ${conversationId} tracked with runId: ${result.runMetadata.runId}`);
  });
});
