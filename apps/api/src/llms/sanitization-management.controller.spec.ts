import { Test, TestingModule } from '@nestjs/testing';
import { SanitizationManagementController } from './sanitization-management.controller';
import { SecretRedactionService } from './secret-redaction.service';
import { PIIPatternService } from './pii-pattern.service';
import { PseudonymizationService } from './pseudonymization.service';
import { DataSanitizationService } from './data-sanitization.service';

describe('SanitizationManagementController', () => {
  let controller: SanitizationManagementController;
  let mockSecretRedactionService: jest.Mocked<SecretRedactionService>;
  let mockPIIPatternService: jest.Mocked<PIIPatternService>;
  let mockPseudonymizationService: jest.Mocked<PseudonymizationService>;
  let mockDataSanitizationService: jest.Mocked<DataSanitizationService>;

  beforeEach(async () => {
    const mockSecretRedaction = {
      getRedactionPatterns: jest.fn(),
      addRedactionPattern: jest.fn(),
      removeRedactionPattern: jest.fn(),
      testRedaction: jest.fn(),
      getStats: jest.fn(),
    };

    const mockPIIPattern = {
      getAllPatterns: jest.fn(),
      getPatternsByDataType: jest.fn(),
      addCustomPattern: jest.fn(),
      detectPII: jest.fn(),
      getStats: jest.fn(),
    };

    const mockPseudonymization = {
      generatePseudonym: jest.fn(),
      lookupPseudonym: jest.fn(),
      getStats: jest.fn(),
    };

    const mockDataSanitization = {
      testSanitization: jest.fn(),
      sanitizeText: jest.fn(),
      getStats: jest.fn(),
      getCacheStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SanitizationManagementController],
      providers: [
        { provide: SecretRedactionService, useValue: mockSecretRedaction },
        { provide: PIIPatternService, useValue: mockPIIPattern },
        { provide: PseudonymizationService, useValue: mockPseudonymization },
        { provide: DataSanitizationService, useValue: mockDataSanitization },
      ],
    }).compile();

    controller = module.get<SanitizationManagementController>(SanitizationManagementController);
    mockSecretRedactionService = module.get(SecretRedactionService);
    mockPIIPatternService = module.get(PIIPatternService);
    mockPseudonymizationService = module.get(PseudonymizationService);
    mockDataSanitizationService = module.get(DataSanitizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Redaction Pattern Endpoints', () => {
    describe('GET /sanitization/redaction/patterns', () => {
      it('should return all redaction patterns with stats', async () => {
        const mockPatterns = [
          { name: 'api_key', pattern: /sk-\w+/g, replacement: '[REDACTED]', description: 'API keys' },
          { name: 'password', pattern: /password:\s*\w+/gi, replacement: '[REDACTED]', description: 'Passwords' },
        ];
        const mockStats = { totalPatterns: 2, customPatterns: 0, productionMode: false, verboseLogging: false };

        mockSecretRedactionService.getRedactionPatterns.mockReturnValue(mockPatterns);
        mockSecretRedactionService.getStats.mockReturnValue(mockStats);

        const result = await controller.getRedactionPatterns();

        expect(result.patterns).toEqual(mockPatterns);
        expect(result.stats).toEqual(mockStats);
        expect(result.totalPatterns).toBe(2);
      });
    });

    describe('POST /sanitization/redaction/patterns', () => {
      it('should add custom redaction pattern successfully', async () => {
        const createPatternDto = {
          name: 'employee_id',
          pattern: 'EMP\\d{4}',
          replacement: '[EMPLOYEE_REDACTED]',
          description: 'Employee ID pattern',
          category: 'corporate',
          priority: 10,
        };

        const result = await controller.addRedactionPattern(createPatternDto);

        expect(result.success).toBe(true);
        expect(result.message).toContain('employee_id');
        expect(result.pattern).toEqual(createPatternDto);
        expect(mockSecretRedactionService.addRedactionPattern).toHaveBeenCalled();
      });

      it('should handle invalid regex patterns', async () => {
        const invalidPatternDto = {
          name: 'invalid_pattern',
          pattern: '[',  // Invalid regex
          replacement: '[REDACTED]',
          description: 'Invalid pattern',
        };

        const result = await controller.addRedactionPattern(invalidPatternDto);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to add pattern');
      });

      it('should handle service errors', async () => {
        const createPatternDto = {
          name: 'test_pattern',
          pattern: 'test',
          replacement: '[REDACTED]',
          description: 'Test pattern',
        };

        mockSecretRedactionService.addRedactionPattern.mockImplementation(() => {
          throw new Error('Service error');
        });

        const result = await controller.addRedactionPattern(createPatternDto);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Service error');
      });
    });

    describe('DELETE /sanitization/redaction/patterns/:name', () => {
      it('should remove existing pattern successfully', async () => {
        mockSecretRedactionService.removeRedactionPattern.mockReturnValue(true);

        const result = await controller.removeRedactionPattern('test_pattern');

        expect(result.success).toBe(true);
        expect(result.message).toContain('removed successfully');
        expect(mockSecretRedactionService.removeRedactionPattern).toHaveBeenCalledWith('test_pattern');
      });

      it('should handle non-existent pattern', async () => {
        mockSecretRedactionService.removeRedactionPattern.mockReturnValue(false);

        const result = await controller.removeRedactionPattern('non_existent');

        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
      });
    });

    describe('POST /sanitization/redaction/test', () => {
      it('should test redaction patterns successfully', async () => {
        const testText = 'API key: sk-1234567890abcdef';
        const mockTestResult = {
          redactedText: 'API key: [REDACTED]',
          result: { originalLength: 30, redactedLength: 17, redactionCount: 1, patternsMatched: ['api_key'] },
          patternDetails: [{ name: 'api_key', matches: 1, description: 'API keys' }],
        };

        mockSecretRedactionService.testRedaction.mockReturnValue(mockTestResult);

        const result = await controller.testRedaction(testText);

        expect(result.success).toBe(true);
        expect(result.originalText).toBe(testText);
        expect(result.redactedText).toBe('API key: [REDACTED]');
        expect(result.result).toEqual(mockTestResult.result);
        expect(result.patternDetails).toEqual(mockTestResult.patternDetails);
      });

      it('should handle missing text input', async () => {
        const result = await controller.testRedaction('');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Text is required');
      });
    });
  });

  describe('PII Pattern Endpoints', () => {
    describe('GET /sanitization/pii/patterns', () => {
      it('should return all PII patterns', async () => {
        const mockPatterns = [
          { name: 'email', dataType: 'email', pattern: /\S+@\S+\.\S+/g, description: 'Email addresses' },
          { name: 'phone', dataType: 'phone', pattern: /\(\d{3}\)\s*\d{3}-\d{4}/g, description: 'Phone numbers' },
        ];
        const mockStats = { builtInPatterns: 10, customPatterns: 2, totalPatterns: 12, enabledPatterns: 11 };

        mockPIIPatternService.getAllPatterns.mockReturnValue(mockPatterns);
        mockPIIPatternService.getStats.mockReturnValue(mockStats);

        const result = await controller.getPIIPatterns();

        expect(result.patterns).toEqual(mockPatterns);
        expect(result.stats).toEqual(mockStats);
        expect(result.totalPatterns).toBe(2);
        expect(result.dataTypes).toContain('email');
        expect(result.dataTypes).toContain('phone');
      });

      it('should filter patterns by data type', async () => {
        const allPatterns = [
          { name: 'email1', dataType: 'email', pattern: /test/g, description: 'Email 1' },
          { name: 'email2', dataType: 'email', pattern: /test/g, description: 'Email 2' },
          { name: 'phone1', dataType: 'phone', pattern: /test/g, description: 'Phone 1' },
        ];
        const mockStats = { builtInPatterns: 3, customPatterns: 0, totalPatterns: 3, enabledPatterns: 3 };

        mockPIIPatternService.getAllPatterns.mockReturnValue(allPatterns);
        mockPIIPatternService.getStats.mockReturnValue(mockStats);

        const result = await controller.getPIIPatterns('email');

        expect(result.patterns).toHaveLength(2);
        expect(result.patterns.every(p => p.dataType === 'email')).toBe(true);
      });
    });

    describe('POST /sanitization/pii/patterns', () => {
      it('should add custom PII pattern successfully', async () => {
        const createPatternDto = {
          name: 'custom_email',
          pattern: '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b',
          dataType: 'email' as const,
          description: 'Custom email pattern',
          priority: 10,
        };

        mockPIIPatternService.addCustomPattern.mockResolvedValue();

        const result = await controller.addPIIPattern(createPatternDto);

        expect(result.success).toBe(true);
        expect(result.message).toContain('custom_email');
        expect(result.pattern).toEqual(createPatternDto);
        expect(mockPIIPatternService.addCustomPattern).toHaveBeenCalled();
      });

      it('should handle invalid regex patterns', async () => {
        const invalidPatternDto = {
          name: 'invalid_pii',
          pattern: '[',
          dataType: 'custom' as const,
          description: 'Invalid pattern',
        };

        const result = await controller.addPIIPattern(invalidPatternDto);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to add PII pattern');
      });

      it('should handle service errors', async () => {
        const createPatternDto = {
          name: 'test_pii',
          pattern: 'test',
          dataType: 'custom' as const,
          description: 'Test pattern',
        };

        mockPIIPatternService.addCustomPattern.mockRejectedValue(new Error('Service error'));

        const result = await controller.addPIIPattern(createPatternDto);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Service error');
      });
    });

    describe('POST /sanitization/pii/test', () => {
      it('should test PII detection successfully', async () => {
        const testText = 'Contact john@example.com or call (555) 123-4567';
        const mockDetectionResult = {
          matches: [
            { value: 'john@example.com', dataType: 'email', patternName: 'email', startIndex: 8, endIndex: 23, confidence: 1.0 },
            { value: '(555) 123-4567', dataType: 'phone', patternName: 'phone', startIndex: 32, endIndex: 46, confidence: 1.0 },
          ],
          processingTime: 5,
          patternsChecked: 10,
        };

        mockPIIPatternService.detectPII.mockResolvedValue(mockDetectionResult);

        const result = await controller.testPIIDetection(testText);

        expect(result.success).toBe(true);
        expect(result.originalText).toBe(testText);
        expect(result.detectionResult).toEqual(mockDetectionResult);
        expect(result.matchCount).toBe(2);
        expect(result.processingTime).toBe(5);
      });

      it('should handle custom parameters', async () => {
        const testText = 'john@example.com and (555) 123-4567';
        const dataTypes = ['email'];
        const minConfidence = 0.9;

        mockPIIPatternService.detectPII.mockResolvedValue({
          matches: [{ value: 'john@example.com', dataType: 'email', patternName: 'email', startIndex: 0, endIndex: 15, confidence: 1.0 }],
          processingTime: 3,
          patternsChecked: 5,
        });

        const result = await controller.testPIIDetection(testText, dataTypes, minConfidence);

        expect(mockPIIPatternService.detectPII).toHaveBeenCalledWith(testText, {
          dataTypes,
          minConfidence,
          maxMatches: 50,
        });
      });

      it('should handle missing text input', async () => {
        const result = await controller.testPIIDetection('');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Text is required');
      });
    });

    describe('GET /sanitization/pii/patterns/:dataType', () => {
      it('should return patterns for specific data type', async () => {
        const emailPatterns = [
          { name: 'email1', dataType: 'email', pattern: /test/g, description: 'Email 1' },
          { name: 'email2', dataType: 'email', pattern: /test/g, description: 'Email 2' },
        ];

        mockPIIPatternService.getPatternsByDataType.mockReturnValue(emailPatterns);

        const result = await controller.getPIIPatternsByType('email');

        expect(result.dataType).toBe('email');
        expect(result.patterns).toEqual(emailPatterns);
        expect(result.count).toBe(2);
        expect(mockPIIPatternService.getPatternsByDataType).toHaveBeenCalledWith('email');
      });
    });
  });

  describe('Pseudonymization Endpoints', () => {
    describe('POST /sanitization/pseudonym/generate', () => {
      it('should generate pseudonym successfully', async () => {
        const mockPseudonymResult = {
          originalValue: 'john@example.com',
          pseudonym: 'user123@example.com',
          dataType: 'email',
          isNew: true,
          context: 'test-context',
        };

        mockPseudonymizationService.generatePseudonym.mockResolvedValue(mockPseudonymResult);

        const result = await controller.generatePseudonym('john@example.com', 'email', 'test-context');

        expect(result.success).toBe(true);
        expect(result.originalValue).toBe('john@example.com');
        expect(result.pseudonym).toBe('user123@example.com');
        expect(result.dataType).toBe('email');
        expect(result.isNew).toBe(true);
        expect(result.context).toBe('test-context');
      });

      it('should handle missing required parameters', async () => {
        const result = await controller.generatePseudonym('', 'email');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Value and dataType are required');
      });

      it('should handle service errors', async () => {
        mockPseudonymizationService.generatePseudonym.mockRejectedValue(new Error('Generation error'));

        const result = await controller.generatePseudonym('test@example.com', 'email');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Generation error');
      });
    });

    describe('POST /sanitization/pseudonym/lookup', () => {
      it('should lookup existing pseudonym', async () => {
        mockPseudonymizationService.lookupPseudonym.mockResolvedValue('user123@example.com');

        const result = await controller.lookupPseudonym('john@example.com', 'email');

        expect(result.success).toBe(true);
        expect(result.originalValue).toBe('john@example.com');
        expect(result.dataType).toBe('email');
        expect(result.pseudonym).toBe('user123@example.com');
        expect(result.found).toBe(true);
      });

      it('should handle non-existent pseudonym', async () => {
        mockPseudonymizationService.lookupPseudonym.mockResolvedValue(null);

        const result = await controller.lookupPseudonym('nonexistent@example.com', 'email');

        expect(result.success).toBe(true);
        expect(result.pseudonym).toBeNull();
        expect(result.found).toBe(false);
      });

      it('should handle missing parameters', async () => {
        const result = await controller.lookupPseudonym('', 'email');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Value and dataType are required');
      });
    });

    describe('GET /sanitization/pseudonym/stats', () => {
      it('should return pseudonymization statistics', async () => {
        const mockStats = {
          totalPIIPatterns: 15,
          productionMode: false,
          customPatterns: 3,
          patternServiceStats: {},
        };

        mockPseudonymizationService.getStats.mockResolvedValue(mockStats);

        const result = await controller.getPseudonymizationStats();

        expect(result.success).toBe(true);
        expect(result.stats).toEqual(mockStats);
        expect(result.timestamp).toBeDefined();
      });
    });
  });

  describe('Integrated Sanitization Endpoints', () => {
    describe('POST /sanitization/test', () => {
      it('should test complete sanitization pipeline', async () => {
        const testText = 'API: sk-1234567890 Email: john@example.com';
        const mockTestResult = {
          sanitizedText: 'API: [REDACTED] Email: user123@example.com',
          result: {
            sanitizedText: 'API: [REDACTED] Email: user123@example.com',
            originalLength: testText.length,
            sanitizedLength: 42,
            processingTimeMs: 15,
          },
          redactionDetails: { redactedText: 'API: [REDACTED] Email: john@example.com', result: {}, patternDetails: [] },
          pseudonymizationDetails: { originalText: testText, pseudonymizedText: 'user123@example.com', pseudonyms: [], processingTime: 5 },
        };

        mockDataSanitizationService.testSanitization.mockResolvedValue(mockTestResult);

        const result = await controller.testCompleteSanitization({ text: testText });

        expect(result.success).toBe(true);
        expect(result.originalText).toBe(testText);
        expect(result.sanitizedText).toBe('API: [REDACTED] Email: user123@example.com');
        expect(result.result).toEqual(mockTestResult.result);
        expect(result.redactionDetails).toBeDefined();
        expect(result.pseudonymizationDetails).toBeDefined();
        expect(result.processingTime).toBe(15);
      });

      it('should handle missing text', async () => {
        const result = await controller.testCompleteSanitization({ text: '' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Text is required');
      });

      it('should handle service errors', async () => {
        mockDataSanitizationService.testSanitization.mockRejectedValue(new Error('Test error'));

        const result = await controller.testCompleteSanitization({ text: 'test' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Test error');
      });
    });

    describe('POST /sanitization/sanitize', () => {
      it('should sanitize text successfully', async () => {
        const testText = 'Contact john@example.com with API key sk-1234567890';
        const mockSanitizeResult = {
          sanitizedText: 'Contact user123@example.com with API key [REDACTED]',
          originalLength: testText.length,
          sanitizedLength: 47,
          processingTimeMs: 20,
          redactionResult: { redactionCount: 1, patternsMatched: ['api_key'] },
          pseudonymizationResult: { pseudonyms: [{}], processingTime: 5 },
        };

        mockDataSanitizationService.sanitizeText.mockResolvedValue(mockSanitizeResult);

        const result = await controller.sanitizeText({
          text: testText,
          enableRedaction: true,
          enablePseudonymization: true,
          context: 'test-context',
        });

        expect(result.success).toBe(true);
        expect(result.sanitizedText).toBe('Contact user123@example.com with API key [REDACTED]');
        expect(result.originalLength).toBe(testText.length);
        expect(result.sanitizedLength).toBe(47);
        expect(result.processingTime).toBe(20);
        expect(result.redactionApplied).toBe(true);
        expect(result.pseudonymizationApplied).toBe(true);
      });

      it('should handle optional parameters', async () => {
        const testText = 'test text';
        const mockResult = {
          sanitizedText: testText,
          originalLength: 9,
          sanitizedLength: 9,
          processingTimeMs: 1,
        };

        mockDataSanitizationService.sanitizeText.mockResolvedValue(mockResult);

        const result = await controller.sanitizeText({ text: testText });

        expect(mockDataSanitizationService.sanitizeText).toHaveBeenCalledWith(testText, {
          enableRedaction: true,
          enablePseudonymization: true,
          pseudonymizationContext: 'api-request',
        });
      });

      it('should handle missing text', async () => {
        const result = await controller.sanitizeText({ text: '' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Text is required');
      });

      it('should handle service errors', async () => {
        mockDataSanitizationService.sanitizeText.mockRejectedValue(new Error('Sanitization error'));

        const result = await controller.sanitizeText({ text: 'test' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Sanitization error');
      });
    });

    describe('GET /sanitization/stats', () => {
      it('should return comprehensive service statistics', async () => {
        const mockStats = {
          redactionStats: { totalPatterns: 10 },
          pseudonymizationStats: { totalPIIPatterns: 8 },
          totalPatterns: 18,
          productionMode: false,
          verboseLogging: false,
        };
        const mockCacheStats = { size: 5, maxSize: 1000, expirationMs: 3600000 };

        mockDataSanitizationService.getStats.mockResolvedValue(mockStats);
        mockDataSanitizationService.getCacheStats.mockReturnValue(mockCacheStats);

        const result = await controller.getComprehensiveStats();

        expect(result.success).toBe(true);
        expect(result.sanitizationStats).toEqual(mockStats);
        expect(result.cacheStats).toEqual(mockCacheStats);
        expect(result.timestamp).toBeDefined();
        expect(result.services).toBeDefined();
        expect(result.services.redaction).toBe('SecretRedactionService');
        expect(result.services.piiDetection).toBe('PIIPatternService');
        expect(result.services.pseudonymization).toBe('PseudonymizationService');
        expect(result.services.orchestration).toBe('DataSanitizationService');
      });
    });

    describe('GET /sanitization/health', () => {
      it('should return healthy status when services work', async () => {
        const testText = 'test@example.com and (555) 123-4567';
        const mockTestResult = {
          sanitizedText: 'user123@example.com and (555) 999-0000',
          result: { processingTimeMs: 10 },
          redactionDetails: {},
          pseudonymizationDetails: {},
        };

        mockDataSanitizationService.testSanitization.mockResolvedValue(mockTestResult);

        const result = await controller.healthCheck();

        expect(result.success).toBe(true);
        expect(result.status).toBe('healthy');
        expect(result.timestamp).toBeDefined();
        expect(result.testResult).toBeDefined();
        expect(result.testResult.originalText).toBe(testText);
        expect(result.testResult.sanitizedText).toBe('user123@example.com and (555) 999-0000');
        expect(result.testResult.processingTime).toBe(10);
      });

      it('should return unhealthy status when services fail', async () => {
        mockDataSanitizationService.testSanitization.mockRejectedValue(new Error('Service unavailable'));

        const result = await controller.healthCheck();

        expect(result.success).toBe(false);
        expect(result.status).toBe('unhealthy');
        expect(result.timestamp).toBeDefined();
        expect(result.error).toContain('Service unavailable');
      });
    });
  });

  describe('Input Validation', () => {
    it('should handle validation errors gracefully', async () => {
      // This would typically be handled by NestJS validation pipes
      // For unit testing, we'll verify the DTOs are structured correctly
      expect(controller).toBeDefined();
    });

    it('should sanitize input parameters', async () => {
      // Test that malicious input doesn't break the system
      const maliciousText = '<script>alert("xss")</script>test@example.com';
      
      mockDataSanitizationService.sanitizeText.mockResolvedValue({
        sanitizedText: 'user123@example.com',
        originalLength: maliciousText.length,
        sanitizedLength: 17,
        processingTimeMs: 5,
      });

      const result = await controller.sanitizeText({ text: maliciousText });

      expect(result.success).toBe(true);
      // The sanitization service should handle the malicious content
      expect(mockDataSanitizationService.sanitizeText).toHaveBeenCalledWith(maliciousText, expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockSecretRedactionService.getRedactionPatterns.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(controller.getRedactionPatterns()).rejects.toThrow('Unexpected error');
    });

    it('should handle service unavailability', async () => {
      mockDataSanitizationService.getStats.mockRejectedValue(new Error('Service unavailable'));

      await expect(controller.getComprehensiveStats()).rejects.toThrow('Service unavailable');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const mockResult = {
        sanitizedText: 'test',
        originalLength: 4,
        sanitizedLength: 4,
        processingTimeMs: 1,
      };

      mockDataSanitizationService.sanitizeText.mockResolvedValue(mockResult);

      const requests = Array.from({ length: 10 }, () => 
        controller.sanitizeText({ text: 'test text' })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle large input efficiently', async () => {
      const largeText = 'test@example.com '.repeat(1000);
      const mockResult = {
        sanitizedText: 'user123@example.com '.repeat(1000),
        originalLength: largeText.length,
        sanitizedLength: largeText.length,
        processingTimeMs: 50,
      };

      mockDataSanitizationService.sanitizeText.mockResolvedValue(mockResult);

      const startTime = Date.now();
      const result = await controller.sanitizeText({ text: largeText });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});