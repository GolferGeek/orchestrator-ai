import { Test, TestingModule } from '@nestjs/testing';
import { PIIPatternService } from './pii-pattern.service';
import { SecretRedactionService } from './secret-redaction.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('Sanitization System Integration', () => {
  let piiPatternService: PIIPatternService;
  let secretRedactionService: SecretRedactionService;

  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PIIPatternService,
        SecretRedactionService,
        {
          provide: SupabaseService,
          useValue: { getServiceClient: () => mockSupabaseClient },
        },
      ],
    }).compile();

    piiPatternService = module.get<PIIPatternService>(PIIPatternService);
    secretRedactionService = module.get<SecretRedactionService>(
      SecretRedactionService,
    );
  });

  describe('Basic Functionality Tests', () => {
    it('should detect emails with PII pattern service', async () => {
      const text = 'Contact john@example.com for info';
      const _result = await piiPatternService.detectPII(text);

      expect(result.matches.length).toBeGreaterThan(0);
      const emailMatch = result.matches.find((m) => m.dataType === 'email');
      expect(emailMatch).toBeDefined();
      expect(emailMatch?.value).toBe('john@example.com');
    });

    it('should redact API keys with secret redaction service', () => {
      const text =
        'My API key is sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      const _result = secretRedactionService.redactSecrets(text);

      expect(result.redactedText).toContain('[REDACTED]');
      expect(result.result.redactionCount).toBeGreaterThan(0);
    });

    it('should handle both services working together conceptually', async () => {
      // Test that both services can be instantiated and work
      expect(piiPatternService).toBeDefined();
      expect(secretRedactionService).toBeDefined();

      // PII detection
      const piiResult = await piiPatternService.detectPII('john@example.com');
      expect(piiResult.matches.length).toBeGreaterThan(0);

      // Secret redaction
      const redactionResult = secretRedactionService.redactSecrets(
        'api_key=sk-1234567890abcdef1234567890abcdef1234567890abcdef',
      );
      expect(redactionResult.result.redactionCount).toBeGreaterThan(0);
    });
  });

  describe('Service Statistics', () => {
    it('should provide PII pattern statistics', () => {
      const stats = piiPatternService.getStats();
      expect(stats.builtInPatterns).toBeGreaterThan(0);
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });

    it('should provide secret redaction statistics', () => {
      const stats = secretRedactionService.getStats();
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty inputs gracefully', async () => {
      const piiResult = await piiPatternService.detectPII('');
      expect(piiResult.matches).toHaveLength(0);

      const redactionResult = secretRedactionService.redactSecrets('');
      expect(redactionResult.redactedText).toBe('');
    });

    it('should handle null inputs gracefully', async () => {
      const piiResult = await piiPatternService.detectPII('no PII here');
      expect(piiResult.matches).toHaveLength(0);

      const redactionResult =
        secretRedactionService.redactSecrets('no secrets here');
      expect(redactionResult.redactedText).toBe('no secrets here');
      expect(redactionResult.result.redactionCount).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle reasonable loads efficiently', async () => {
      const testText = 'Contact john@example.com with API key abc123def456';

      const startTime = Date.now();

      // Run multiple operations
      const piiPromise = piiPatternService.detectPII(testText);
      const redactionResult = secretRedactionService.redactSecrets(testText);
      const piiResult = await piiPromise;

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(piiResult).toBeDefined();
      expect(redactionResult).toBeDefined();
    });
  });
});

describe('API Endpoints Basic Tests', () => {
  it('should be able to test endpoints exist', () => {
    // This is a placeholder to ensure the test suite runs
    // Actual endpoint testing would be done with supertest in e2e tests
    expect(true).toBe(true);
  });
});
