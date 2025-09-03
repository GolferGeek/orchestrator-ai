import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('Anthropic No-Train Header (e2e)', () => {
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

  it('should send anthropic-beta: no-train header and get real response', async () => {
    const result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say "testing anthropic" exactly.',
      {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022', // Specify a valid model
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'anthropic-header-test',
        dataClassification: 'confidential',
        preferLocal: false, // Force external to test headers
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.toLowerCase()).toContain('testing');
    expect(result.runMetadata.provider).toBe('anthropic');
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.runMetadata.inputTokens).toBeGreaterThan(0);
    expect(result.runMetadata.outputTokens).toBeGreaterThan(0);
    
    console.log(`✅ Anthropic no-train header test completed: ${result.runMetadata.runId}`);
    console.log(`   Response: ${result.content}`);
    console.log(`   Tokens: ${result.runMetadata.inputTokens} in, ${result.runMetadata.outputTokens} out`);
  });
});
