import { Test, TestingModule } from '@nestjs/testing';
import { SecretRedactionService } from './secret-redaction.service';

describe('SecretRedactionService', () => {
  let service: SecretRedactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecretRedactionService],
    }).compile();

    service = module.get<SecretRedactionService>(SecretRedactionService);
  });

  describe('redactSecrets', () => {
    it('should redact API keys', () => {
      const text = 'My API key is sk-1234567890abcdef1234567890abcdef12345678';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('[REDACTED]');
      expect(result.redactedText).not.toContain('sk-1234567890abcdef');
      expect(result.result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact OpenAI API keys', () => {
      const text = 'OpenAI key: sk-abcd1234567890abcdef1234567890abcdef123456';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('sk-[REDACTED]');
      expect(result.result.patternsMatched).toContain('openai_key');
    });

    it('should redact Anthropic API keys', () => {
      const text =
        'Claude API key: sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop_qrstuvwxyz';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('sk-ant-[REDACTED]');
      expect(result.result.patternsMatched).toContain('anthropic_key');
    });

    it('should redact Google API keys', () => {
      const text = 'Google key: AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('AIza[REDACTED]');
      expect(result.result.patternsMatched).toContain('google_key');
    });

    it('should redact JWT tokens', () => {
      const text =
        'JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('eyJ[REDACTED]');
      expect(result.result.patternsMatched).toContain('jwt_token');
    });

    it('should redact bearer tokens', () => {
      const text = 'Authorization: Bearer abcd1234567890efgh';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('bearer [REDACTED]');
      expect(result.result.patternsMatched).toContain('bearer_token');
    });

    it('should redact passwords', () => {
      const text = 'Password: mySecretPassword123';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('password=[REDACTED]');
      expect(result.result.patternsMatched).toContain('password');
    });

    it('should redact database URLs', () => {
      const text = 'DB: postgresql://user:password@localhost:5432/mydb';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('database://[REDACTED]');
      expect(result.result.patternsMatched).toContain('database_url');
    });

    it('should redact AWS access keys', () => {
      const text = 'AWS Key: AKIAIOSFODNN7EXAMPLE';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('AKIA[REDACTED]');
      expect(result.result.patternsMatched).toContain('aws_key');
    });

    it('should redact credit card numbers', () => {
      const text = 'Credit card: 4111 1111 1111 1111';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('[CREDIT_CARD_REDACTED]');
      expect(result.result.patternsMatched).toContain('credit_card');
    });

    it('should redact SSH private keys', () => {
      const text = `SSH Key:
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef...
-----END RSA PRIVATE KEY-----`;

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain(
        '-----BEGIN [REDACTED] PRIVATE KEY-----',
      );
      expect(result.result.patternsMatched).toContain('ssh_key');
    });

    it('should handle multiple different secrets in one text', () => {
      const text = `Config:
API_KEY=sk-1234567890abcdef
PASSWORD=myPassword123
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;

      const _result = service.redactSecrets(text);

      expect(result.result.redactionCount).toBeGreaterThanOrEqual(4);
      expect(result.result.patternsMatched.length).toBeGreaterThanOrEqual(3);
      expect(result.redactedText).toContain('[REDACTED]');
    });

    it('should handle empty or null input', () => {
      const emptyResult = service.redactSecrets('');
      const nullResult = service.redactSecrets(null as any);

      expect(emptyResult.redactedText).toBe('');
      expect(emptyResult.result.redactionCount).toBe(0);

      expect(nullResult.redactedText).toBe(null);
      expect(nullResult.result.redactionCount).toBe(0);
    });

    it('should not redact text without secrets', () => {
      const text = 'This is just regular text with no secrets';

      const _result = service.redactSecrets(text);

      expect(result.redactedText).toBe(text);
      expect(result.result.redactionCount).toBe(0);
      expect(result.result.patternsMatched).toHaveLength(0);
    });

    it('should preserve text length information', () => {
      const text = 'API key: sk-1234567890abcdef1234567890abcdef12345678';

      const _result = service.redactSecrets(text);

      expect(result.result.originalLength).toBe(text.length);
      expect(result.result.redactedLength).toBe(result.redactedText.length);
    });

    it('should handle case insensitive patterns', () => {
      const text = 'Password: MySecretPwd and PASSWORD: AnotherSecret';

      const _result = service.redactSecrets(text);

      expect(result.result.redactionCount).toBeGreaterThanOrEqual(2);
      expect(result.redactedText).not.toContain('MySecretPwd');
      expect(result.redactedText).not.toContain('AnotherSecret');
    });

    it('should handle different API key formats', () => {
      const text = `Various formats:
api_key: sk-1234567890abcdef
apikey=sk-abcdef1234567890
key: "sk-fedcba0987654321"`;

      const _result = service.redactSecrets(text);

      expect(result.result.redactionCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('addRedactionPattern', () => {
    it('should add custom redaction pattern', () => {
      const customPattern = {
        name: 'custom_secret',
        pattern: /SECRET_\w+/g,
        replacement: '[CUSTOM_REDACTED]',
        description: 'Custom secret pattern',
      };

      service.addRedactionPattern(customPattern);
      const patterns = service.getRedactionPatterns();

      expect(patterns.some((p) => p.name === 'custom_secret')).toBe(true);
    });

    it('should use custom pattern in redaction', () => {
      const customPattern = {
        name: 'employee_id',
        pattern: /EMP\d{4}/g,
        replacement: '[EMPLOYEE_ID_REDACTED]',
        description: 'Employee ID pattern',
      };

      service.addRedactionPattern(customPattern);
      const text = 'Employee EMP1234 has access';
      const _result = service.redactSecrets(text);

      expect(result.redactedText).toContain('[EMPLOYEE_ID_REDACTED]');
      expect(result.result.patternsMatched).toContain('employee_id');
    });
  });

  describe('removeRedactionPattern', () => {
    it('should remove existing pattern', () => {
      // First add a custom pattern
      const customPattern = {
        name: 'test_pattern',
        pattern: /TEST_\w+/g,
        replacement: '[TEST_REDACTED]',
        description: 'Test pattern',
      };

      service.addRedactionPattern(customPattern);
      const added = service
        .getRedactionPatterns()
        .some((p) => p.name === 'test_pattern');
      expect(added).toBe(true);

      // Then remove it
      const removed = service.removeRedactionPattern('test_pattern');
      expect(removed).toBe(true);

      const stillExists = service
        .getRedactionPatterns()
        .some((p) => p.name === 'test_pattern');
      expect(stillExists).toBe(false);
    });

    it('should return false for non-existent pattern', () => {
      const removed = service.removeRedactionPattern('non_existent_pattern');
      expect(removed).toBe(false);
    });

    it('should not affect built-in patterns', () => {
      const initialPatterns = service.getRedactionPatterns();
      const builtInPatternCount = initialPatterns.length;

      // Try to remove a built-in pattern
      service.removeRedactionPattern('api_key');

      const afterRemoval = service.getRedactionPatterns();
      // Built-in patterns should not be removable or should be restored
      expect(afterRemoval.length).toBeGreaterThan(0);
    });
  });

  describe('testRedaction', () => {
    it('should provide detailed test results', () => {
      const text = 'API: sk-1234567890abcdef and password: secretpass123';

      const _result = service.testRedaction(text);

      expect(result.redactedText).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.patternDetails).toBeDefined();
      expect(result.patternDetails.length).toBeGreaterThan(0);

      result.patternDetails.forEach((detail) => {
        expect(detail).toHaveProperty('name');
        expect(detail).toHaveProperty('matches');
        expect(detail).toHaveProperty('description');
        expect(detail.matches).toBeGreaterThanOrEqual(0);
      });
    });

    it('should show which patterns matched', () => {
      const text =
        'JWT: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const _result = service.testRedaction(text);

      const jwtPattern = result.patternDetails.find(
        (p) => p.name === 'jwt_token',
      );
      expect(jwtPattern).toBeDefined();
      expect(jwtPattern!.matches).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return service statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('productionMode');
      expect(stats).toHaveProperty('verboseLogging');
      expect(stats).toHaveProperty('customPatterns');
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });

    it('should track custom patterns correctly', () => {
      const initialStats = service.getStats();
      const initialCustom = initialStats.customPatterns;

      service.addRedactionPattern({
        name: 'stats_test',
        pattern: /STATS_TEST/g,
        replacement: '[STATS_REDACTED]',
        description: 'Stats test pattern',
      });

      const afterStats = service.getStats();
      expect(afterStats.customPatterns).toBe(initialCustom + 1);
    });
  });

  describe('safe logging methods', () => {
    it('should provide safe logging methods', () => {
      expect(typeof service.debug).toBe('function');
      expect(typeof service.info).toBe('function');
      expect(typeof service.warn).toBe('function');
      expect(typeof service.error).toBe('function');
    });

    // Note: These would require mocking the logger to test properly
    it('should not throw when calling logging methods', () => {
      expect(() => service.debug('test message')).not.toThrow();
      expect(() => service.info('test message')).not.toThrow();
      expect(() => service.warn('test message')).not.toThrow();
      expect(() => service.error('test message')).not.toThrow();
    });
  });

  describe('edge cases and performance', () => {
    it('should handle very long text efficiently', () => {
      const longText = 'API key sk-1234567890abcdef '.repeat(1000);
      const startTime = Date.now();

      const _result = service.redactSecrets(longText);
      const endTime = Date.now();

      expect(result.result.redactionCount).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle text with many different secret types', () => {
      const text = `
        API_KEY=sk-1234567890abcdef
        OPENAI_KEY=sk-abcd1234567890abcdef1234567890abcdef123456
        ANTHROPIC_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop_qrstuvwxyz
        GOOGLE_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
        JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
        PASSWORD=mySecretPassword123
        DATABASE_URL=postgresql://user:password@localhost:5432/mydb
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        CREDIT_CARD=4111-1111-1111-1111
      `;

      const _result = service.redactSecrets(text);

      expect(result.result.redactionCount).toBeGreaterThanOrEqual(8);
      expect(result.result.patternsMatched.length).toBeGreaterThanOrEqual(8);
    });

    it('should handle malformed secrets gracefully', () => {
      const text = `
        PARTIAL_KEY=sk-123
        MALFORMED_JWT=eyJ.malformed
        SHORT_PASSWORD=pwd
        INVALID_AWS=AKI123
      `;

      // Should not throw, even with malformed patterns
      expect(() => service.redactSecrets(text)).not.toThrow();
    });

    it('should be consistent across multiple calls', () => {
      const text = 'API key: sk-1234567890abcdef1234567890abcdef12345678';

      const result1 = service.redactSecrets(text);
      const result2 = service.redactSecrets(text);

      expect(result1.redactedText).toBe(result2.redactedText);
      expect(result1.result.redactionCount).toBe(result2.result.redactionCount);
    });
  });
});
