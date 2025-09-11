import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { LLMService } from './llm.service';
import { DataSanitizationService } from './data-sanitization.service';
import { PseudonymizationService } from './pseudonymization.service';
import { SecretRedactionService } from './secret-redaction.service';
import { SupabaseService } from '../supabase/supabase.service';
import { getTableName } from '../supabase/supabase.config';

describe('PII and Pseudonym E2E Tests', () => {
  let app: INestApplication;
  let llmService: LLMService;
  let dataSanitizationService: DataSanitizationService;
  let pseudonymizationService: PseudonymizationService;
  let secretRedactionService: SecretRedactionService;
  let supabaseService: SupabaseService;

  const TEST_PROMPT = `Can you check the status of my server at 192.168.1.1? The documentation is at http://internal-docs.company.com/wiki/setup. I wrote a blog post about Matt Weber. He is sometimes known as GolferGeek. He is the owner of Orchestrator AI. It was a great post! I can't find it anymore.`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    dataSanitizationService = moduleFixture.get<DataSanitizationService>(DataSanitizationService);
    pseudonymizationService = moduleFixture.get<PseudonymizationService>(PseudonymizationService);
    secretRedactionService = moduleFixture.get<SecretRedactionService>(SecretRedactionService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    
    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('PII Detection and Flagging', () => {
    it('should detect and flag IP address and URL', async () => {
      const redactionResult = secretRedactionService.redactSecrets(TEST_PROMPT);
      
      console.log('🔍 Redaction Result:', {
        patternsMatched: redactionResult.result.patternsMatched,
        redactionCount: redactionResult.result.redactionCount,
        redactedText: redactionResult.redactedText.substring(0, 200)
      });

      expect(redactionResult.result.redactionCount).toBeGreaterThanOrEqual(2);
      expect(redactionResult.result.patternsMatched).toContain('ipAddress');
      expect(redactionResult.result.patternsMatched).toContain('internalUrl');
      
      expect(redactionResult.redactedText).toContain('[IP_ADDRESS_REDACTED]');
      expect(redactionResult.redactedText).toContain('[INTERNAL_URL_REDACTED]');
      
      expect(redactionResult.redactedText).not.toContain('192.168.1.1');
      expect(redactionResult.redactedText).not.toContain('http://internal-docs.company.com');
    });
  });

  describe('Pseudonym Replacement', () => {
    it('should replace known entities with pseudonyms', async () => {
      const pseudonymResult = await pseudonymizationService.pseudonymizeText(TEST_PROMPT, {
        context: 'test'
      });

      console.log('🎭 Pseudonym Result:', {
        pseudonymCount: pseudonymResult.pseudonyms.length,
        pseudonyms: pseudonymResult.pseudonyms.map(p => ({
          original: p.originalValue,
          pseudonym: p.pseudonym,
          type: p.dataType
        }))
      });

      expect(pseudonymResult.pseudonyms.length).toBeGreaterThanOrEqual(3);
      
      const pseudonymValues = pseudonymResult.pseudonyms.map(p => p.originalValue.toLowerCase());
      expect(pseudonymValues).toContain('matt weber');
      expect(pseudonymValues).toContain('golfergeek');
      expect(pseudonymValues).toContain('orchestrator ai');
      
      expect(pseudonymResult.pseudonymizedText).not.toContain('Matt Weber');
      expect(pseudonymResult.pseudonymizedText).not.toContain('GolferGeek');
      expect(pseudonymResult.pseudonymizedText).not.toContain('Orchestrator AI');
    });
  });

  describe('Complete Sanitization Pipeline', () => {
    it('should apply both redaction and pseudonymization', async () => {
      const sanitizationResult = await dataSanitizationService.sanitizeText(TEST_PROMPT, {
        enableRedaction: true,
        enablePseudonymization: true,
        pseudonymizationContext: 'test'
      });

      console.log('🛡️ Complete Sanitization Result:', {
        originalLength: sanitizationResult.originalLength,
        sanitizedLength: sanitizationResult.sanitizedLength,
        redactionCount: sanitizationResult.redactionResult?.redactionCount || 0,
        pseudonymCount: sanitizationResult.pseudonymizationResult?.pseudonyms?.length || 0,
        processingTimeMs: sanitizationResult.processingTimeMs
      });

      expect(sanitizationResult.redactionResult).toBeDefined();
      expect(sanitizationResult.redactionResult!.redactionCount).toBeGreaterThanOrEqual(2);
      
      expect(sanitizationResult.pseudonymizationResult).toBeDefined();
      expect(sanitizationResult.pseudonymizationResult!.pseudonyms.length).toBeGreaterThanOrEqual(3);
      
      const sanitizedText = sanitizationResult.sanitizedText;
      expect(sanitizedText).not.toContain('192.168.1.1');
      expect(sanitizedText).not.toContain('http://internal-docs.company.com');
      expect(sanitizedText).not.toContain('Matt Weber');
      expect(sanitizedText).not.toContain('GolferGeek');
      expect(sanitizedText).not.toContain('Orchestrator AI');
    });
  });

  describe('LLM Request with PII Metadata', () => {
    it('should process LLM request with PII metadata tracking', async () => {
      const runId = `test-pii-${Date.now()}`;
      
      const result: any = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are a helpful assistant analyzing network and documentation information.',
        userMessage: TEST_PROMPT,
        options: {
          maxTokens: 100,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'pii-e2e-test',
          callerName: 'pii-pseudonym-test',
          requestId: runId,
          enableSanitization: true
        }
      });

      console.log('📊 LLM Response with PII Metadata:', {
        provider: result.metadata?.provider,
        model: result.metadata?.model,
        requestId: result.metadata?.requestId,
        piiDetected: result.metadata?.usage?.piiDetected,
        piiTypes: result.metadata?.usage?.piiTypes,
        pseudonymsUsed: result.metadata?.usage?.pseudonymsUsed,
        pseudonymTypes: result.metadata?.usage?.pseudonymTypes,
        redactionsApplied: result.metadata?.usage?.redactionsApplied,
        redactionTypes: result.metadata?.usage?.redactionTypes,
        sanitizationLevel: result.metadata?.usage?.sanitizationLevel
      });

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.usage).toBeDefined();
      
      const usage = result.metadata!.usage as any;
      expect(usage.piiDetected).toBe(true);
      expect(usage.piiTypes).toBeDefined();
      expect(usage.piiTypes.length).toBeGreaterThan(0);
      expect(usage.pseudonymsUsed).toBeGreaterThanOrEqual(3);
      expect(usage.pseudonymTypes).toBeDefined();
      expect(usage.redactionsApplied).toBeGreaterThanOrEqual(2);
      expect(usage.redactionTypes).toBeDefined();
      expect(usage.sanitizationLevel).toBeDefined();
      expect(['basic', 'standard', 'strict']).toContain(usage.sanitizationLevel);
    }, 30000);
  });

  describe('Database Storage Verification', () => {
    it('should store PII metadata in llm_usage table', async () => {
      const runId = `test-db-pii-${Date.now()}`;
      
      const result: any = await llmService.generateUnifiedResponse({
        provider: 'ollama',
        model: 'llama3.2:1b',
        systemPrompt: 'You are a helpful assistant.',
        userMessage: TEST_PROMPT,
        options: {
          maxTokens: 50,
          temperature: 0.1,
          includeMetadata: true,
          callerType: 'pii-db-test',
          callerName: 'pii-storage-verification',
          requestId: runId,
          enableSanitization: true
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const client = supabaseService.getServiceClient();
      const { data: usageRecord, error } = await client
        .from(getTableName('llm_usage'))
        .select('*')
        .eq('run_id', runId)
        .single();

      console.log('💾 Database Record:', {
        runId: usageRecord?.run_id,
        piiDetected: usageRecord?.pii_detected,
        piiTypes: usageRecord?.pii_types,
        pseudonymsUsed: usageRecord?.pseudonyms_used,
        pseudonymTypes: usageRecord?.pseudonym_types,
        redactionsApplied: usageRecord?.redactions_applied,
        redactionTypes: usageRecord?.redaction_types,
        sanitizationLevel: usageRecord?.sanitization_level
      });

      expect(error).toBeNull();
      expect(usageRecord).toBeDefined();
      expect(usageRecord.pii_detected).toBe(true);
      expect(usageRecord.pii_types).toBeDefined();
      expect(usageRecord.pii_types.length).toBeGreaterThan(0);
      expect(usageRecord.pseudonyms_used).toBeGreaterThanOrEqual(3);
      expect(usageRecord.pseudonym_types).toBeDefined();
      expect(usageRecord.redactions_applied).toBeGreaterThanOrEqual(2);
      expect(usageRecord.redaction_types).toBeDefined();
      expect(usageRecord.sanitization_level).toBeDefined();
    }, 30000);
  });

  describe('Reversible Sanitization', () => {
    it('should sanitize and then reverse the sanitization', async () => {
      const requestId = `test-reverse-${Date.now()}`;
      
      const sanitizeResult = await dataSanitizationService.reversibleSanitizeText(
        TEST_PROMPT,
        requestId,
        {
          enableRedaction: false,
          enablePseudonymization: true,
          pseudonymizationContext: 'test-reversible'
        }
      );

      console.log('🔄 Reversible Sanitization:', {
        originalLength: TEST_PROMPT.length,
        sanitizedLength: sanitizeResult.sanitizedText.length,
        hasReversalContext: !!sanitizeResult.reversalContext
      });

      expect(sanitizeResult.sanitizedText).not.toContain('Matt Weber');
      expect(sanitizeResult.sanitizedText).not.toContain('GolferGeek');
      expect(sanitizeResult.sanitizedText).not.toContain('Orchestrator AI');
      
      const reverseResult = await dataSanitizationService.reverseSanitization(
        sanitizeResult.sanitizedText,
        sanitizeResult.reversalContext,
        requestId
      );

      console.log('🔄 Reverse Result:', {
        reversalCount: reverseResult.reversalCount,
        source: reverseResult.source,
        processingTimeMs: reverseResult.processingTimeMs
      });

      expect(reverseResult.originalText).toContain('Matt Weber');
      expect(reverseResult.originalText).toContain('GolferGeek');
      expect(reverseResult.originalText).toContain('Orchestrator AI');
      expect(reverseResult.reversalCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Metrics Extraction', () => {
    it('should extract detailed sanitization metrics', async () => {
      const sanitizationResult = await dataSanitizationService.sanitizeText(TEST_PROMPT, {
        enableRedaction: true,
        enablePseudonymization: true,
        pseudonymizationContext: 'metrics-test'
      });

      const metrics = dataSanitizationService.extractSanitizationMetrics(sanitizationResult, false);

      console.log('📈 Sanitization Metrics:', metrics);

      expect(metrics.piiDetected).toBe(true);
      expect(metrics.piiTypes.length).toBeGreaterThan(0);
      expect(metrics.pseudonymsUsed).toBeGreaterThanOrEqual(3);
      expect(metrics.pseudonymTypes.length).toBeGreaterThan(0);
      expect(metrics.redactionsApplied).toBeGreaterThanOrEqual(2);
      expect(metrics.redactionTypes.length).toBeGreaterThan(0);
      expect(metrics.sanitizationTimeMs).toBeGreaterThan(0);
      expect(metrics.sanitizationLevel).not.toBe('none');
    });
  });

  describe('Cache Management', () => {
    it('should cache and retrieve reversal contexts', async () => {
      const requestId = `test-cache-${Date.now()}`;
      
      const sanitizeResult = await dataSanitizationService.reversibleSanitizeText(
        'Test message with Matt Weber',
        requestId,
        {
          enableRedaction: false,
          enablePseudonymization: true
        }
      );

      const cacheStats = dataSanitizationService.getCacheStats();
      console.log('💾 Cache Stats:', cacheStats);

      expect(cacheStats.size).toBeGreaterThan(0);
      
      const reverseFromCache = await dataSanitizationService.reverseSanitization(
        sanitizeResult.sanitizedText,
        null,
        requestId
      );

      expect(reverseFromCache.source).toBe('memory');
      expect(reverseFromCache.originalText).toContain('Matt Weber');
    });
  });

  describe('Safe Logging', () => {
    it('should sanitize logs automatically', async () => {
      const logSpy = jest.spyOn(console, 'log');
      
      await dataSanitizationService.info(
        `Processing request for Matt Weber at 192.168.1.1`,
        'test-run-id',
        'SafeLoggingTest',
        { user: 'GolferGeek', company: 'Orchestrator AI' }
      );

      logSpy.mockRestore();
    });
  });
});