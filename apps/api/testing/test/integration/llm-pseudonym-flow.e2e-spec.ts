import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';

describe('LLM Pseudonym Flow (e2e)', () => {
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

  describe('PII Detection and Pseudonymization', () => {
    it('should detect and pseudonymize names in user message', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful. Respond with the exact names mentioned.',
        userMessage: 'Tell me about John Smith and Mary Johnson working at Acme Corp.',
        options: {
          includeMetadata: true,
          maxTokens: 100,
        }
      });

      expect(typeof result).toBe('object');
      const response = result as any;
      
      // Should have PII metadata
      expect(response.piiMetadata).toBeDefined();
      expect(response.piiMetadata.detectedPii).toBeDefined();
      expect(response.piiMetadata.pseudonymMap).toBeDefined();
      
      // Should detect names
      expect(response.piiMetadata.detectedPii.length).toBeGreaterThan(0);
      
      console.log('🔍 PII Detection:', {
        detectedPii: response.piiMetadata.detectedPii,
        pseudonymMap: response.piiMetadata.pseudonymMap,
        content: response.content.substring(0, 100) + '...'
      });
    }, 30000);

    it('should pseudonymize email addresses', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Repeat back the email address exactly.',
        userMessage: 'Contact john.doe@example.com for more information.',
        options: {
          includeMetadata: true,
          maxTokens: 50,
        }
      });

      const response = result as any;
      expect(response.piiMetadata).toBeDefined();
      
      // Should detect email
      const emailPii = response.piiMetadata.detectedPii.find((pii: any) => 
        pii.type === 'email' || pii.originalValue.includes('@')
      );
      expect(emailPii).toBeDefined();
      
      console.log('📧 Email PII:', emailPii);
    }, 30000);

    it('should handle phone numbers', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Repeat the phone number.',
        userMessage: 'Call me at (555) 123-4567 tomorrow.',
        options: {
          includeMetadata: true,
          maxTokens: 30,
        }
      });

      const response = result as any;
      expect(response.piiMetadata).toBeDefined();
      
      console.log('📞 Phone PII Detection:', response.piiMetadata.detectedPii);
    }, 30000);
  });

  describe('Dictionary-Based Pseudonymization', () => {
    it('should use dictionary pseudonyms for known entities', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Mention the person by name.',
        userMessage: 'What do you know about GolferGeek?',
        options: {
          includeMetadata: true,
          maxTokens: 100,
        }
      });

      const response = result as any;
      expect(response.piiMetadata).toBeDefined();
      
      // Should use dictionary pseudonym if GolferGeek is in dictionary
      const golferGeekPii = response.piiMetadata.detectedPii.find((pii: any) => 
        pii.originalValue.toLowerCase().includes('golfergeek')
      );
      
      if (golferGeekPii) {
        expect(golferGeekPii.pseudonym).toBeDefined();
        console.log('🎯 Dictionary Pseudonym:', golferGeekPii);
      }
    }, 30000);
  });

  describe('Pseudonym Reversal in Response', () => {
    it('should reverse pseudonyms back to original names in final response', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are helpful. Use the exact names provided.',
        userMessage: 'Write about Alice Cooper and Bob Dylan.',
        options: {
          includeMetadata: true,
          maxTokens: 100,
        }
      });

      const response = result as any;
      
      // Final content should contain original names, not pseudonyms
      expect(response.content).toContain('Alice');
      expect(response.content).toContain('Bob');
      
      // But should NOT contain pseudonyms in final output
      if (response.piiMetadata?.pseudonymMap) {
        Object.values(response.piiMetadata.pseudonymMap).forEach((pseudonym: any) => {
          expect(response.content).not.toContain(pseudonym);
        });
      }
      
      console.log('🔄 Pseudonym Reversal Check:', {
        finalContent: response.content,
        hadPseudonyms: !!response.piiMetadata?.pseudonymMap
      });
    }, 30000);
  });

  describe('PII Metadata Completeness', () => {
    it('should include complete PII processing metadata', async () => {
      const result = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'Respond professionally.',
        userMessage: 'Please contact Sarah Williams at sarah@company.com or (555) 987-6543.',
        options: {
          includeMetadata: true,
          maxTokens: 50,
        }
      });

      const response = result as any;
      expect(response.piiMetadata).toBeDefined();
      
      // Should have all required PII metadata fields
      expect(response.piiMetadata.detectedPii).toBeDefined();
      expect(response.piiMetadata.pseudonymMap).toBeDefined();
      expect(response.piiMetadata.processingStats).toBeDefined();
      
      // Processing stats should have timing info
      expect(response.piiMetadata.processingStats.detectionTimeMs).toBeGreaterThan(0);
      expect(response.piiMetadata.processingStats.pseudonymizationTimeMs).toBeGreaterThan(0);
      
      console.log('📊 Complete PII Metadata:', response.piiMetadata);
    }, 30000);
  });
});

