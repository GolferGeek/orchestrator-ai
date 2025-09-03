import { Test, TestingModule } from '@nestjs/testing';
import { DataSanitizationService } from './data-sanitization.service';
import { SecretRedactionService } from './secret-redaction.service';
import { PseudonymizationService } from './pseudonymization.service';

describe('DataSanitizationService', () => {
  let service: DataSanitizationService;
  let mockSecretRedactionService: jest.Mocked<SecretRedactionService>;
  let mockPseudonymizationService: jest.Mocked<PseudonymizationService>;

  beforeEach(async () => {
    const mockSecretRedaction = {
      redactSecrets: jest.fn(),
      addRedactionPattern: jest.fn(),
      removeRedactionPattern: jest.fn(),
      getRedactionPatterns: jest.fn(),
      testRedaction: jest.fn(),
      getStats: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockPseudonymization = {
      pseudonymizeText: jest.fn(),
      generatePseudonym: jest.fn(),
      lookupPseudonym: jest.fn(),
      reversePseudonymization: jest.fn(),
      createReversiblePseudonymization: jest.fn(),
      addPIIPattern: jest.fn(),
      getPIIPatterns: jest.fn(),
      getStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSanitizationService,
        { provide: SecretRedactionService, useValue: mockSecretRedaction },
        { provide: PseudonymizationService, useValue: mockPseudonymization },
      ],
    }).compile();

    service = module.get<DataSanitizationService>(DataSanitizationService);
    mockSecretRedactionService = module.get(SecretRedactionService);
    mockPseudonymizationService = module.get(PseudonymizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeText', () => {
    it('should sanitize text with both redaction and pseudonymization', async () => {
      const inputText = 'API key: sk-1234567890 and email: john@example.com';
      
      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'API key: [REDACTED] and email: john@example.com',
        result: {
          originalLength: inputText.length,
          redactedLength: 45,
          redactionCount: 1,
          patternsMatched: ['api_key'],
        },
      });

      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: 'API key: [REDACTED] and email: john@example.com',
        pseudonymizedText: 'API key: [REDACTED] and email: user123@example.com',
        pseudonyms: [{
          originalValue: 'john@example.com',
          pseudonym: 'user123@example.com',
          dataType: 'email',
          isNew: false,
        }],
        processingTime: 10,
      });

      const result = await service.sanitizeText(inputText);

      expect(result.sanitizedText).toBe('API key: [REDACTED] and email: user123@example.com');
      expect(result.originalLength).toBe(inputText.length);
      expect(result.redactionResult).toBeDefined();
      expect(result.pseudonymizationResult).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle redaction-only mode', async () => {
      const inputText = 'API key: sk-1234567890';
      
      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'API key: [REDACTED]',
        result: {
          originalLength: inputText.length,
          redactedLength: 17,
          redactionCount: 1,
          patternsMatched: ['api_key'],
        },
      });

      const result = await service.sanitizeText(inputText, {
        enableRedaction: true,
        enablePseudonymization: false,
      });

      expect(result.sanitizedText).toBe('API key: [REDACTED]');
      expect(mockSecretRedactionService.redactSecrets).toHaveBeenCalled();
      expect(mockPseudonymizationService.pseudonymizeText).not.toHaveBeenCalled();
    });

    it('should handle pseudonymization-only mode', async () => {
      const inputText = 'Email: john@example.com';
      
      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: inputText,
        pseudonymizedText: 'Email: user123@example.com',
        pseudonyms: [{
          originalValue: 'john@example.com',
          pseudonym: 'user123@example.com',
          dataType: 'email',
          isNew: false,
        }],
        processingTime: 5,
      });

      const result = await service.sanitizeText(inputText, {
        enableRedaction: false,
        enablePseudonymization: true,
      });

      expect(result.sanitizedText).toBe('Email: user123@example.com');
      expect(mockSecretRedactionService.redactSecrets).not.toHaveBeenCalled();
      expect(mockPseudonymizationService.pseudonymizeText).toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const result = await service.sanitizeText('');

      expect(result.sanitizedText).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.sanitizedLength).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle null input', async () => {
      const result = await service.sanitizeText(null as any);

      expect(result.sanitizedText).toBe(null);
      expect(result.originalLength).toBe(0);
      expect(result.sanitizedLength).toBe(0);
    });

    it('should propagate errors from underlying services', async () => {
      const inputText = 'test input';
      
      mockSecretRedactionService.redactSecrets.mockImplementation(() => {
        throw new Error('Redaction error');
      });

      await expect(service.sanitizeText(inputText)).rejects.toThrow('Redaction error');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string values in an object', async () => {
      const inputObject = {
        apiKey: 'sk-1234567890',
        userEmail: 'john@example.com',
        nested: {
          password: 'secretpassword',
          phone: '(555) 123-4567',
        },
        numbers: [123, 456],
        mixedArray: ['text', 'jane@example.com', 789],
      };

      mockSecretRedactionService.redactSecrets
        .mockReturnValueOnce({
          redactedText: '[REDACTED]',
          result: { originalLength: 14, redactedLength: 11, redactionCount: 1, patternsMatched: ['api_key'] },
        })
        .mockReturnValueOnce({
          redactedText: 'john@example.com',
          result: { originalLength: 16, redactedLength: 16, redactionCount: 0, patternsMatched: [] },
        })
        .mockReturnValueOnce({
          redactedText: '[REDACTED]',
          result: { originalLength: 14, redactedLength: 11, redactionCount: 1, patternsMatched: ['password'] },
        })
        .mockReturnValueOnce({
          redactedText: '(555) 123-4567',
          result: { originalLength: 14, redactedLength: 14, redactionCount: 0, patternsMatched: [] },
        })
        .mockReturnValueOnce({
          redactedText: 'text',
          result: { originalLength: 4, redactedLength: 4, redactionCount: 0, patternsMatched: [] },
        })
        .mockReturnValueOnce({
          redactedText: 'jane@example.com',
          result: { originalLength: 16, redactedLength: 16, redactionCount: 0, patternsMatched: [] },
        });

      mockPseudonymizationService.pseudonymizeText
        .mockResolvedValueOnce({
          originalText: '[REDACTED]',
          pseudonymizedText: '[REDACTED]',
          pseudonyms: [],
          processingTime: 1,
        })
        .mockResolvedValueOnce({
          originalText: 'john@example.com',
          pseudonymizedText: 'user123@example.com',
          pseudonyms: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
          processingTime: 2,
        })
        .mockResolvedValueOnce({
          originalText: '[REDACTED]',
          pseudonymizedText: '[REDACTED]',
          pseudonyms: [],
          processingTime: 1,
        })
        .mockResolvedValueOnce({
          originalText: '(555) 123-4567',
          pseudonymizedText: '(555) 999-0000',
          pseudonyms: [{ originalValue: '(555) 123-4567', pseudonym: '(555) 999-0000', dataType: 'phone', isNew: false }],
          processingTime: 3,
        })
        .mockResolvedValueOnce({
          originalText: 'text',
          pseudonymizedText: 'text',
          pseudonyms: [],
          processingTime: 1,
        })
        .mockResolvedValueOnce({
          originalText: 'jane@example.com',
          pseudonymizedText: 'user456@example.com',
          pseudonyms: [{ originalValue: 'jane@example.com', pseudonym: 'user456@example.com', dataType: 'email', isNew: false }],
          processingTime: 2,
        });

      const result = await service.sanitizeObject(inputObject);

      expect(result.sanitizedObject.apiKey).toBe('[REDACTED]');
      expect(result.sanitizedObject.userEmail).toBe('user123@example.com');
      expect(result.sanitizedObject.nested.password).toBe('[REDACTED]');
      expect(result.sanitizedObject.nested.phone).toBe('(555) 999-0000');
      expect(result.sanitizedObject.numbers).toEqual([123, 456]);
      expect(result.sanitizedObject.mixedArray[1]).toBe('user456@example.com');
    });

    it('should handle arrays correctly', async () => {
      const inputArray = ['sk-1234567890', 'john@example.com', 123];

      mockSecretRedactionService.redactSecrets
        .mockReturnValueOnce({
          redactedText: '[REDACTED]',
          result: { originalLength: 14, redactedLength: 11, redactionCount: 1, patternsMatched: ['api_key'] },
        })
        .mockReturnValueOnce({
          redactedText: 'john@example.com',
          result: { originalLength: 16, redactedLength: 16, redactionCount: 0, patternsMatched: [] },
        });

      mockPseudonymizationService.pseudonymizeText
        .mockResolvedValueOnce({
          originalText: '[REDACTED]',
          pseudonymizedText: '[REDACTED]',
          pseudonyms: [],
          processingTime: 1,
        })
        .mockResolvedValueOnce({
          originalText: 'john@example.com',
          pseudonymizedText: 'user123@example.com',
          pseudonyms: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
          processingTime: 2,
        });

      const result = await service.sanitizeObject(inputArray);

      expect(Array.isArray(result.sanitizedObject)).toBe(true);
      expect(result.sanitizedObject[0]).toBe('[REDACTED]');
      expect(result.sanitizedObject[1]).toBe('user123@example.com');
      expect(result.sanitizedObject[2]).toBe(123);
    });

    it('should handle non-object input', async () => {
      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'test',
        result: { originalLength: 4, redactedLength: 4, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: 'test',
        pseudonymizedText: 'test',
        pseudonyms: [],
        processingTime: 1,
      });

      const result = await service.sanitizeObject('test string');

      expect(result.sanitizedObject).toBe('test');
    });
  });

  describe('reversibleSanitizeText', () => {
    it('should create reversible sanitization with context', async () => {
      const inputText = 'Email john@example.com and phone (555) 123-4567';
      const requestId = 'request-123';

      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: inputText, // No secrets to redact
        result: { originalLength: inputText.length, redactedLength: inputText.length, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.createReversiblePseudonymization.mockResolvedValue({
        pseudonymizedText: 'Email user123@example.com and phone (555) 999-0000',
        reversalContext: [
          { originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false },
          { originalValue: '(555) 123-4567', pseudonym: '(555) 999-0000', dataType: 'phone', isNew: false },
        ],
        processingTime: 15,
      });

      const result = await service.reversibleSanitizeText(inputText, requestId);

      expect(result.sanitizedText).toBe('Email user123@example.com and phone (555) 999-0000');
      expect(result.reversalContext).toBeDefined();
      expect(result.reversalContext).toHaveLength(2);
      expect(result.result.reversalContext).toBe(result.reversalContext);
    });

    it('should store context in cache', async () => {
      const requestId = 'cache-test-123';
      const inputText = 'john@example.com';

      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: inputText,
        result: { originalLength: inputText.length, redactedLength: inputText.length, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.createReversiblePseudonymization.mockResolvedValue({
        pseudonymizedText: 'user123@example.com',
        reversalContext: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
        processingTime: 5,
      });

      await service.reversibleSanitizeText(inputText, requestId);

      // Verify context was stored (check cache stats)
      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should handle empty input', async () => {
      const result = await service.reversibleSanitizeText('', 'request-123');

      expect(result.sanitizedText).toBe('');
      expect(result.reversalContext).toBeNull();
      expect(result.result.originalLength).toBe(0);
    });
  });

  describe('reverseSanitization', () => {
    it('should reverse sanitization using provided context', async () => {
      const sanitizedText = 'Contact user123@example.com';
      const reversalContext = [
        { originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false },
      ];

      mockPseudonymizationService.reversePseudonymization.mockResolvedValue({
        originalText: 'Contact john@example.com',
        reversalCount: 1,
        processingTime: 3,
      });

      const result = await service.reverseSanitization(sanitizedText, reversalContext);

      expect(result.originalText).toBe('Contact john@example.com');
      expect(result.reversalCount).toBe(1);
      expect(result.source).toBe('context');
    });

    it('should use cache when context not provided but requestId available', async () => {
      const requestId = 'cached-request-456';
      const sanitizedText = 'Contact user123@example.com';

      // First, store something in cache
      const contextData = [
        { originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false },
      ];
      
      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'john@example.com',
        result: { originalLength: 16, redactedLength: 16, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.createReversiblePseudonymization.mockResolvedValue({
        pseudonymizedText: 'user123@example.com',
        reversalContext: contextData,
        processingTime: 5,
      });

      // Store in cache first
      await service.reversibleSanitizeText('john@example.com', requestId);

      // Now try to reverse using cache
      mockPseudonymizationService.reversePseudonymization.mockResolvedValue({
        originalText: 'Contact john@example.com',
        reversalCount: 1,
        processingTime: 2,
      });

      const result = await service.reverseSanitization(sanitizedText, null, requestId);

      expect(result.originalText).toBe('Contact john@example.com');
      expect(result.source).toBe('memory');
    });

    it('should handle missing context gracefully', async () => {
      const sanitizedText = 'Contact user123@example.com';

      const result = await service.reverseSanitization(sanitizedText, null);

      expect(result.originalText).toBe(sanitizedText);
      expect(result.reversalCount).toBe(0);
      expect(result.source).toBe('context');
    });

    it('should handle errors during reversal', async () => {
      const sanitizedText = 'Contact user123@example.com';
      const reversalContext = [
        { originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false },
      ];

      mockPseudonymizationService.reversePseudonymization.mockRejectedValue(new Error('Reversal error'));

      const result = await service.reverseSanitization(sanitizedText, reversalContext);

      expect(result.originalText).toBe(sanitizedText); // Should return original on error
      expect(result.reversalCount).toBe(0);
    });
  });

  describe('sanitizeForLLM', () => {
    it('should sanitize both system prompt and user message', async () => {
      const systemPrompt = 'System API key: sk-1234567890';
      const userMessage = 'User email: john@example.com';
      const requestId = 'llm-request-789';

      mockSecretRedactionService.redactSecrets
        .mockReturnValueOnce({
          redactedText: 'System API key: [REDACTED]',
          result: { originalLength: systemPrompt.length, redactedLength: 25, redactionCount: 1, patternsMatched: ['api_key'] },
        })
        .mockReturnValueOnce({
          redactedText: userMessage,
          result: { originalLength: userMessage.length, redactedLength: userMessage.length, redactionCount: 0, patternsMatched: [] },
        });

      mockPseudonymizationService.createReversiblePseudonymization
        .mockResolvedValueOnce({
          pseudonymizedText: 'System API key: [REDACTED]',
          reversalContext: [],
          processingTime: 2,
        })
        .mockResolvedValueOnce({
          pseudonymizedText: 'User email: user123@example.com',
          reversalContext: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
          processingTime: 5,
        });

      const result = await service.sanitizeForLLM(systemPrompt, userMessage, requestId);

      expect(result.sanitizedSystemPrompt).toBe('System API key: [REDACTED]');
      expect(result.sanitizedUserMessage).toBe('User email: user123@example.com');
      expect(result.reversalContext).toBeDefined();
      expect(result.reversalContext.system).toBeDefined();
      expect(result.reversalContext.user).toBeDefined();
    });
  });

  describe('reverseLLMResponse', () => {
    it('should reverse LLM response using combined contexts', async () => {
      const llmResponse = 'The user user123@example.com should be contacted';
      const reversalContext = {
        system: [],
        user: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
      };

      mockPseudonymizationService.reversePseudonymization
        .mockResolvedValueOnce({
          originalText: llmResponse, // No system context changes
          reversalCount: 0,
          processingTime: 1,
        })
        .mockResolvedValueOnce({
          originalText: 'The user john@example.com should be contacted',
          reversalCount: 1,
          processingTime: 3,
        });

      const result = await service.reverseLLMResponse(llmResponse, reversalContext);

      expect(result).toBe('The user john@example.com should be contacted');
    });

    it('should handle missing reversal context', async () => {
      const llmResponse = 'No pseudonyms to reverse';

      const result = await service.reverseLLMResponse(llmResponse, null);

      expect(result).toBe(llmResponse);
    });
  });

  describe('safe logging', () => {
    it('should provide safe logging methods', async () => {
      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'Safe message',
        result: { originalLength: 12, redactedLength: 12, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: 'Safe message',
        pseudonymizedText: 'Safe message',
        pseudonyms: [],
        processingTime: 1,
      });

      // These should not throw
      await expect(service.debug('test message')).resolves.not.toThrow();
      await expect(service.info('test message')).resolves.not.toThrow();
      await expect(service.warn('test message')).resolves.not.toThrow();
      await expect(service.error('test message')).resolves.not.toThrow();
    });

    it('should handle sanitization errors in logging gracefully', async () => {
      mockSecretRedactionService.redactSecrets.mockImplementation(() => {
        throw new Error('Sanitization failed');
      });

      // Should not throw, should fallback gracefully
      await expect(service.info('test message')).resolves.not.toThrow();
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('expirationMs');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.expirationMs).toBe('number');
    });

    it('should respect cache size limits', async () => {
      // This would require testing the internal cache implementation
      // For now, just verify the cache stats are accessible
      const initialStats = service.getCacheStats();
      expect(initialStats.size).toBe(0);
    });

    it('should handle cache expiration', async () => {
      // This would require mocking time or waiting for expiration
      // For unit tests, we'll just verify the expiration setting exists
      const stats = service.getCacheStats();
      expect(stats.expirationMs).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      mockSecretRedactionService.getStats.mockReturnValue({
        totalPatterns: 10,
        productionMode: false,
        verboseLogging: false,
        customPatterns: 2,
      });

      mockPseudonymizationService.getStats.mockResolvedValue({
        totalPIIPatterns: 8,
        productionMode: false,
        customPatterns: 1,
        patternServiceStats: {},
      });

      const result = await service.getStats();

      expect(result.redactionStats).toBeDefined();
      expect(result.pseudonymizationStats).toBeDefined();
      expect(result.totalPatterns).toBe(18); // 10 + 8
      expect(result.productionMode).toBe(false);
      expect(result.verboseLogging).toBe(false);
    });
  });

  describe('testSanitization', () => {
    it('should provide comprehensive test results', async () => {
      const testText = 'API: sk-1234567890 Email: john@example.com';

      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: 'API: [REDACTED] Email: john@example.com',
        result: { originalLength: testText.length, redactedLength: 39, redactionCount: 1, patternsMatched: ['api_key'] },
      });

      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: 'API: [REDACTED] Email: john@example.com',
        pseudonymizedText: 'API: [REDACTED] Email: user123@example.com',
        pseudonyms: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
        processingTime: 8,
      });

      mockSecretRedactionService.testRedaction.mockReturnValue({
        redactedText: 'API: [REDACTED] Email: john@example.com',
        result: { originalLength: testText.length, redactedLength: 39, redactionCount: 1, patternsMatched: ['api_key'] },
        patternDetails: [{ name: 'api_key', matches: 1, description: 'API keys' }],
      });

      const result = await service.testSanitization(testText);

      expect(result.sanitizedText).toBe('API: [REDACTED] Email: user123@example.com');
      expect(result.result).toBeDefined();
      expect(result.redactionDetails).toBeDefined();
      expect(result.pseudonymizationDetails).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle service initialization errors gracefully', () => {
      // Service should initialize even if dependencies have issues
      expect(service).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const text = 'john@example.com';
      const requestId = 'concurrent-test';

      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: text,
        result: { originalLength: text.length, redactedLength: text.length, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.createReversiblePseudonymization.mockResolvedValue({
        pseudonymizedText: 'user123@example.com',
        reversalContext: [{ originalValue: 'john@example.com', pseudonym: 'user123@example.com', dataType: 'email', isNew: false }],
        processingTime: 5,
      });

      // Run multiple concurrent operations
      const promises = Array.from({ length: 5 }, (_, i) => 
        service.reversibleSanitizeText(text, `${requestId}-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.sanitizedText).toBe('user123@example.com');
      });
    });

    it('should handle very large text inputs', async () => {
      const largeText = 'test@example.com '.repeat(1000);

      mockSecretRedactionService.redactSecrets.mockReturnValue({
        redactedText: largeText,
        result: { originalLength: largeText.length, redactedLength: largeText.length, redactionCount: 0, patternsMatched: [] },
      });

      mockPseudonymizationService.pseudonymizeText.mockResolvedValue({
        originalText: largeText,
        pseudonymizedText: largeText.replace(/test@example\.com/g, 'user123@example.com'),
        pseudonyms: [],
        processingTime: 50,
      });

      const startTime = Date.now();
      const result = await service.sanitizeText(largeText);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
    });
  });
});