import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../../src/app.module';
import { LLMService } from '../../../../src/llms/llm.service';

describe('Provider Routing Logic (e2e)', () => {
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

  it('should route to local provider when preferLocal is true', async () => {
    const _result = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'Say "local routing test" exactly.',
      {
        maxComplexity: 'simple',
        callerType: 'test',
        callerName: 'local-routing-test',
        dataClassification: 'internal',
        preferLocal: true,
      }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.toLowerCase()).toContain('local');
    expect(result.runMetadata.provider).toBe('ollama');
    expect(result.runMetadata.runId).toBeDefined();
    expect(result.routingDecision.isLocal).toBe(true);
    
    console.log(`✅ Local routing successful: ${result.runMetadata.provider}`);
    console.log(`   Response: ${result.content}`);
    console.log(`   Model: ${result.routingDecision.model}`);
  });
});
