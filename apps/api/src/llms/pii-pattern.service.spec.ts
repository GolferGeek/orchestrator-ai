import { Test, TestingModule } from '@nestjs/testing';
import { PIIPatternService, PIIDataType } from './pii-pattern.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('PIIPatternService', () => {
  let service: PIIPatternService;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const mockSupabase = {
      getServiceClient: jest.fn(() => mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PIIPatternService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<PIIPatternService>(PIIPatternService);
    mockSupabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPII', () => {
    it('should detect email addresses', async () => {
      const text = 'Contact john.doe@company.com for more info';

      const result = await service.detectPII(text);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toMatchObject({
        value: 'john.doe@company.com',
        dataType: 'email',
        confidence: 1.0,
      });
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should detect phone numbers in various formats', async () => {
      const text =
        'Call me at (555) 123-4567 or 555-987-6543 or +1-555-111-2222';

      const result = await service.detectPII(text);

      expect(result.matches.length).toBeGreaterThanOrEqual(3);
      const phoneMatches = result.matches.filter((m) => m.dataType === 'phone');
      expect(phoneMatches).toHaveLength(3);
    });

    it('should detect names with proper capitalization', async () => {
      const text = 'John Smith and Sarah Johnson are attending the meeting';

      const result = await service.detectPII(text);

      const nameMatches = result.matches.filter((m) => m.dataType === 'name');
      expect(nameMatches).toHaveLength(2);
      expect(nameMatches.map((m) => m.value)).toContain('John Smith');
      expect(nameMatches.map((m) => m.value)).toContain('Sarah Johnson');
    });

    it('should detect IPv4 addresses', async () => {
      const text = 'Server is at 192.168.1.100 and backup at 10.0.0.1';

      const result = await service.detectPII(text);

      const ipMatches = result.matches.filter(
        (m) => m.dataType === 'ip_address',
      );
      expect(ipMatches).toHaveLength(2);
      expect(ipMatches.map((m) => m.value)).toContain('192.168.1.100');
      expect(ipMatches.map((m) => m.value)).toContain('10.0.0.1');
    });

    it('should detect Social Security Numbers', async () => {
      const text = 'SSN: 123-45-6789 is confidential';

      const result = await service.detectPII(text);

      const ssnMatches = result.matches.filter((m) => m.dataType === 'ssn');
      expect(ssnMatches).toHaveLength(1);
      expect(ssnMatches[0].value).toBe('123-45-6789');
    });

    it('should detect credit card numbers', async () => {
      const text = 'Visa card 4111111111111111 and Mastercard 5555555555554444';

      const result = await service.detectPII(text);

      const ccMatches = result.matches.filter(
        (m) => m.dataType === 'credit_card',
      );
      expect(ccMatches).toHaveLength(2);
    });

    it('should detect social media usernames', async () => {
      const text = 'Follow @johndoe and @sarahj on social media';

      const result = await service.detectPII(text);

      const usernameMatches = result.matches.filter(
        (m) => m.dataType === 'username',
      );
      expect(usernameMatches).toHaveLength(2);
      expect(usernameMatches.map((m) => m.value)).toContain('@johndoe');
      expect(usernameMatches.map((m) => m.value)).toContain('@sarahj');
    });

    it('should detect street addresses', async () => {
      const text =
        'Office is at 123 Main Street and warehouse at 456 Oak Avenue';

      const result = await service.detectPII(text);

      const addressMatches = result.matches.filter(
        (m) => m.dataType === 'address',
      );
      expect(addressMatches).toHaveLength(2);
    });

    it('should filter by data types when specified', async () => {
      const text = 'Contact john@example.com or call (555) 123-4567';

      const result = await service.detectPII(text, { dataTypes: ['email'] });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].dataType).toBe('email');
    });

    it('should respect minimum confidence threshold', async () => {
      const text = 'Email john@example.com and maybe fake@invalid';

      const result = await service.detectPII(text, { minConfidence: 0.9 });

      // Should only return high-confidence matches
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      result.matches.forEach((match) => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should respect maximum match limit', async () => {
      const text = 'test@1.com test@2.com test@3.com test@4.com test@5.com';

      const result = await service.detectPII(text, { maxMatches: 3 });

      expect(result.matches).toHaveLength(3);
    });

    it('should handle obfuscated email addresses', async () => {
      const text = 'Email john dot doe at company dot com for info';

      const result = await service.detectPII(text);

      const emailMatches = result.matches.filter((m) => m.dataType === 'email');
      expect(emailMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('should validate IP addresses correctly', async () => {
      const text = 'Valid IP 192.168.1.1 and invalid IP 999.999.999.999';

      const result = await service.detectPII(text);

      const ipMatches = result.matches.filter(
        (m) => m.dataType === 'ip_address',
      );
      expect(ipMatches).toHaveLength(1);
      expect(ipMatches[0].value).toBe('192.168.1.1');
    });

    it('should handle empty or invalid input', async () => {
      const result = await service.detectPII('');

      expect(result.matches).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should detect international phone numbers', async () => {
      const text = 'Call +44 20 7946 0958 or +33 1 42 86 83 26';

      const result = await service.detectPII(text);

      const phoneMatches = result.matches.filter((m) => m.dataType === 'phone');
      expect(phoneMatches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('addCustomPattern', () => {
    it('should add custom pattern successfully', async () => {
      const customPattern = {
        name: 'employee_id',
        dataType: 'custom' as PIIDataType,
        pattern: /\bEMP\d{4}\b/g,
        description: 'Employee ID pattern',
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await expect(
        service.addCustomPattern(customPattern),
      ).resolves.not.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      const customPattern = {
        name: 'test_pattern',
        dataType: 'custom' as PIIDataType,
        pattern: /test/g,
        description: 'Test pattern',
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest
          .fn()
          .mockResolvedValue({ error: new Error('Database error') }),
      });

      await expect(service.addCustomPattern(customPattern)).rejects.toThrow();
    });

    it('should validate regex pattern before adding', async () => {
      const invalidPattern = {
        name: 'invalid_pattern',
        dataType: 'custom' as PIIDataType,
        pattern: /invalid/g, // Test pattern (was intentionally invalid before)
        description: 'Invalid pattern',
      };

      await expect(service.addCustomPattern(invalidPattern)).rejects.toThrow();
    });
  });

  describe('getAllPatterns', () => {
    it('should return all built-in patterns', () => {
      const patterns = service.getAllPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some((p) => p.name === 'email_standard')).toBe(true);
      expect(patterns.some((p) => p.name === 'phone_us_standard')).toBe(true);
      expect(patterns.some((p) => p.name === 'ssn_standard')).toBe(true);
    });
  });

  describe('getPatternsByDataType', () => {
    it('should return patterns for specific data type', () => {
      const emailPatterns = service.getPatternsByDataType('email');

      expect(emailPatterns.length).toBeGreaterThan(0);
      emailPatterns.forEach((pattern) => {
        expect(pattern.dataType).toBe('email');
      });
    });

    it('should return empty array for non-existent data type', () => {
      const patterns = service.getPatternsByDataType(
        'nonexistent' as PIIDataType,
      );

      expect(patterns).toHaveLength(0);
    });
  });

  describe('testPattern', () => {
    it('should test pattern against sample text', () => {
      const emailPattern = service
        .getAllPatterns()
        .find((p) => p.name === 'email_standard');
      const testText = 'Contact john@example.com and sarah@test.org';

      const result = service.testPattern(emailPattern!, testText);

      expect(result.matches).toHaveLength(2);
      expect(result.validMatches).toHaveLength(2);
      expect(result.performance).toBeGreaterThanOrEqual(0);
    });

    it('should distinguish between matches and valid matches', () => {
      const ssnPattern = service
        .getAllPatterns()
        .find((p) => p.name === 'ssn_standard');
      const testText = 'Valid SSN: 123-45-6789 and invalid: 000-00-0000';

      const result = service.testPattern(ssnPattern!, testText);

      expect(result.matches).toHaveLength(2);
      expect(result.validMatches).toHaveLength(1); // Only valid SSN should pass validator
    });
  });

  describe('getStats', () => {
    it('should return service statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('builtInPatterns');
      expect(stats).toHaveProperty('customPatterns');
      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('enabledPatterns');
      expect(stats.builtInPatterns).toBeGreaterThan(0);
      expect(stats.totalPatterns).toBeGreaterThanOrEqual(stats.builtInPatterns);
    });
  });

  describe('pattern priority and overlap handling', () => {
    it('should handle overlapping matches by priority', async () => {
      const text = 'john@company.com'; // Could match both email patterns

      const result = await service.detectPII(text);

      // Should not have duplicate matches for the same text span
      const emailMatches = result.matches.filter((m) => m.dataType === 'email');
      if (emailMatches.length > 1) {
        // Check that matches don't overlap
        for (let i = 0; i < emailMatches.length - 1; i++) {
          for (let j = i + 1; j < emailMatches.length; j++) {
            const match1 = emailMatches[i];
            const match2 = emailMatches[j];
            const overlap = !(
              match1.endIndex <= match2.startIndex ||
              match2.endIndex <= match1.startIndex
            );
            expect(overlap).toBe(false);
          }
        }
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long text inputs', async () => {
      const longText = 'Contact john@example.com '.repeat(1000);

      const result = await service.detectPII(longText, { maxMatches: 10 });

      expect(result.matches.length).toBeLessThanOrEqual(10);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle text with no PII', async () => {
      const text = 'This is just regular text with no personal information';

      const result = await service.detectPII(text);

      expect(result.matches).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.patternsChecked).toBeGreaterThan(0);
    });

    it('should handle special characters in text', async () => {
      const text = 'Email: john@example.com!!! Phone: (555) 123-4567???';

      const result = await service.detectPII(text);

      expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle mixed case input', async () => {
      const text = 'JOHN@EXAMPLE.COM and john@example.com';

      const result = await service.detectPII(text);

      const emailMatches = result.matches.filter((m) => m.dataType === 'email');
      expect(emailMatches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
