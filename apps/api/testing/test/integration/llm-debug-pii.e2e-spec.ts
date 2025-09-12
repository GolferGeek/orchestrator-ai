import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('LLM PII Debug (e2e)', () => {
  let app: INestApplication;
  let llmService: LLMService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should debug what the actual response structure looks like', async () => {
    const result = await llmService.generateUnifiedResponse({
      provider: 'ollama',
      model: 'llama3.2:1b',
      systemPrompt: 'You are helpful. Mention the names exactly.',
      userMessage: 'Tell me about John Smith and his email john@example.com.',
      options: {
        includeMetadata: true,
        maxTokens: 100,
      }
    });

    console.log('🔍 FULL RESPONSE STRUCTURE:');
    console.log('Type:', typeof result);
    console.log('Keys:', Object.keys(result as any));
    console.log('Content:', (result as any).content?.substring(0, 100));
    console.log('Metadata keys:', (result as any).metadata ? Object.keys((result as any).metadata) : 'NO METADATA');
    console.log('PII Metadata:', (result as any).piiMetadata);
    console.log('Has PII Metadata:', !!(result as any).piiMetadata);
    
    // Log the entire response structure (truncated)
    const response = result as any;
    const debugResponse = {
      hasContent: !!response.content,
      hasMetadata: !!response.metadata,
      hasPiiMetadata: !!response.piiMetadata,
      metadataKeys: response.metadata ? Object.keys(response.metadata) : [],
      piiMetadataKeys: response.piiMetadata ? Object.keys(response.piiMetadata) : [],
    };
    
    console.log('🔍 DEBUG STRUCTURE:', JSON.stringify(debugResponse, null, 2));
    
    expect(result).toBeDefined();
  }, 30000);
});

