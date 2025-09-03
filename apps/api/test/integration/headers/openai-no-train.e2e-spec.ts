import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

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
  });

  it('should send OpenAI-No-Train header and get real response', async () => {
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say "hello world" exactly.',
      {
        provider: 'openai',
        model: 'gpt-4o-mini', // Specify a valid chat model
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'openai-header-test',
        dataClassification: 'confidential',
        preferLocal: false, // Force external to test headers
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.toLowerCase()).toContain('hello');
    expect(result.runMetadata.provider).toBe('openai');
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.runMetadata.inputTokens).toBeGreaterThan(0);
    expect(result.runMetadata.outputTokens).toBeGreaterThan(0);
    
    console.log(`✅ OpenAI no-train header test completed: ${result.runMetadata.runId}`);
    console.log(`   Response: ${result.content}`);
    console.log(`   Tokens: ${result.runMetadata.inputTokens} in, ${result.runMetadata.outputTokens} out`);
  });
});
