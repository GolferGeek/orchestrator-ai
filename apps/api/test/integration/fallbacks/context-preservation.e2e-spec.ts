import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

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

  it('should track conversation context correctly', async () => {
    const testConversationId = `context-tracking-${Date.now()}`;
    const testCallerName = `context-preservation-${Date.now()}`;

    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say "context tracking test" and remember this conversation ID.',
      {
        maxComplexity: 'simple',
        callerType: 'context-test',
        callerName: testCallerName,
        conversationId: testConversationId,
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.toLowerCase()).toContain('context');
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.runMetadata.provider).toBeDefined();
    
    console.log(`✅ Context tracking test completed: runId ${result.runMetadata.runId}`);
    console.log(`   ConversationId: ${testConversationId}`);
    console.log(`   CallerName: ${testCallerName}`);
    console.log(`   Response: ${result.content}`);
  });
});
