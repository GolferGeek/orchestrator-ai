import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from '../llm.service';
import { LLMServiceFactory } from '../services/llm-service-factory';
import { RunMetadataService } from '../run-metadata.service';
import { PIIService } from '../../services/pii.service';
import { DictionaryPseudonymizerService } from '../../services/dictionary-pseudonymizer.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { CIDAFMService } from '../../cidafm/cidafm.service';
import { CentralizedRoutingService } from '../centralized-routing.service';
import { ProviderConfigService } from '../provider-config.service';
import { DataSanitizationService } from '../data-sanitization.service';
import { PseudonymizerService } from '../../services/pseudonymizer.service';
import { LocalModelStatusService } from '../local-model-status.service';
import { LocalLLMService } from '../local-llm.service';
import { BlindedLLMService } from '../blinded-llm.service';
import { _Logger } from '@nestjs/common';

/**
 * Comprehensive robustness tests for the unified generateResponse method
 * These tests ensure the method handles edge cases, error conditions, and
 * various input scenarios gracefully.
 */

// Mock implementations for all dependencies
const createMockLLMResponse = (overrides = {}) => ({
  content: 'Mock response content',
  metadata: {
    provider: 'ollama',
    model: 'test-model',
    requestId: 'test-request-id',
    timestamp: new Date().toISOString(),
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cost: 0.001,
    },
    timing: {
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      duration: 1000,
    },
    status: 'completed' as const,
    ...overrides,
  },
});

const mockSupabaseService = {
  client: {},
  getClient: jest.fn(),
  getServiceClient: jest.fn(),
};

const mockCIDAFMService = {
  processRequest: jest.fn(),
  getState: jest.fn(),
};

const mockCentralizedRoutingService = {
  routeRequest: jest.fn(),
  getOptimalProvider: jest.fn(),
};

const mockProviderConfigService = {
  getConfig: jest.fn(),
  validateProvider: jest.fn(),
};

const mockDataSanitizationService = {
  sanitizeInput: jest.fn(),
  sanitizeOutput: jest.fn(),
  debug: jest.fn(),
};

const mockPseudonymizerService = {
  pseudonymize: jest.fn(),
  reversePseudonyms: jest.fn(),
};

const mockLocalModelStatusService = {
  getStatus: jest.fn(),
  isAvailable: jest.fn(),
};

const mockLocalLLMService = {
  generateResponse: jest.fn(),
  isAvailable: jest.fn(),
};

const mockBlindedLLMService = {
  generateResponse: jest.fn(),
  processBlindedRequest: jest.fn(),
  createBlindedLLM: jest.fn(),
};

const mockLLMServiceFactory = {
  generateResponse: jest.fn(),
};

const mockPIIService = {
  processPII: jest.fn(),
  reversePseudonyms: jest.fn(),
};

const mockDictionaryPseudonymizerService = {
  pseudonymizeText: jest.fn().mockResolvedValue({
    pseudonymizedText: 'test message',
    mappings: [],
    processingTimeMs: 10,
  }),
  reversePseudonyms: jest.fn().mockResolvedValue({
    originalText: 'test response',
    reversalCount: 0,
    processingTimeMs: 5,
  }),
};

const mockRunMetadataService = {
  startRequest: jest.fn().mockResolvedValue({ requestId: 'test-request' }),
  completeRequest: jest.fn(),
  completeRequestWithError: jest.fn(),
};

describe('LLMService - Unified Method Robustness Tests', () => {
  let service: LLMService;
  let llmServiceFactory: jest.Mocked<LLMServiceFactory>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        LLMService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: CIDAFMService, useValue: mockCIDAFMService },
        {
          provide: CentralizedRoutingService,
          useValue: mockCentralizedRoutingService,
        },
        { provide: RunMetadataService, useValue: mockRunMetadataService },
        { provide: ProviderConfigService, useValue: mockProviderConfigService },
        {
          provide: DataSanitizationService,
          useValue: mockDataSanitizationService,
        },
        { provide: PIIService, useValue: mockPIIService },
        { provide: PseudonymizerService, useValue: mockPseudonymizerService },
        {
          provide: DictionaryPseudonymizerService,
          useValue: mockDictionaryPseudonymizerService,
        },
        {
          provide: LocalModelStatusService,
          useValue: mockLocalModelStatusService,
        },
        { provide: LocalLLMService, useValue: mockLocalLLMService },
        { provide: BlindedLLMService, useValue: mockBlindedLLMService },
        { provide: LLMServiceFactory, useValue: mockLLMServiceFactory },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    llmServiceFactory = module.get(LLMServiceFactory);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Parameter Edge Cases', () => {
    it('should handle whitespace-only parameters correctly', async () => {
      await expect(
        service.generateUnifiedResponse({
          provider: '   ',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Missing required parameter: provider is required');

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: '   ',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Missing required parameter: model is required');

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: '   ',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Missing required parameter: systemPrompt is required');

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: '   ',
        }),
      ).rejects.toThrow('Missing required parameter: userMessage is required');
    });

    it('should handle null and undefined parameters', async () => {
      const testCases = [
        { provider: null, field: 'provider' },
        { model: null, field: 'model' },
        { systemPrompt: null, field: 'systemPrompt' },
        { userMessage: null, field: 'userMessage' },
        { provider: undefined, field: 'provider' },
        { model: undefined, field: 'model' },
        { systemPrompt: undefined, field: 'systemPrompt' },
        { userMessage: undefined, field: 'userMessage' },
      ];

      for (const testCase of testCases) {
        const params = {
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
          ...testCase,
        };

        await expect(
          service.generateUnifiedResponse(params as any),
        ).rejects.toThrow(
          `Missing required parameter: ${testCase.field} is required`,
        );
      }
    });

    it('should handle very long input strings', async () => {
      const longString = 'A'.repeat(100000); // 100KB string
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: longString,
        userMessage: longString,
      });

      expect(llmServiceFactory.generateResponse).toHaveBeenCalled();
      expect(result).toBe('Mock response content');
    });

    it('should handle special characters and unicode', async () => {
      const specialChars =
        '🚀 Special chars: @#$%^&*()[]{}|\\:";\'<>?,./ 中文 العربية 🎉';
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: specialChars,
        userMessage: specialChars,
      });

      expect(result).toBe('Mock response content');
    });
  });

  describe('Provider Validation Edge Cases', () => {
    it('should handle case-insensitive provider names', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const providers = [
        'OLLAMA',
        'ollama',
        'OlLaMa',
        'OPENAI',
        'openai',
        'OpenAI',
      ];

      for (const provider of providers) {
        const _result = await service.generateUnifiedResponse({
          provider,
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        });

        expect(result).toBe('Mock response content');
      }
    });

    it('should reject providers with special characters', async () => {
      const invalidProviders = [
        'open@ai',
        'ollama!',
        'provider-with-spaces',
        'provider/with/slashes',
      ];

      for (const provider of invalidProviders) {
        await expect(
          service.generateUnifiedResponse({
            provider,
            model: 'test-model',
            systemPrompt: 'Test prompt',
            userMessage: 'Test message',
          }),
        ).rejects.toThrow('Unsupported provider');
      }
    });

    it('should provide helpful error message with supported providers', async () => {
      try {
        await service.generateUnifiedResponse({
          provider: 'invalid-provider',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        });
      } catch (_error) {
        expect(_error.message).toContain(
          'Unsupported provider: invalid-provider',
        );
        expect(_error.message).toContain(
          'Supported providers: openai, anthropic, google, grok, ollama',
        );
      }
    });
  });

  describe('Options Parameter Robustness', () => {
    it('should handle undefined options gracefully', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: undefined,
      });

      expect(result).toBe('Mock response content');
    });

    it('should handle empty options object', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: {},
      });

      expect(result).toBe('Mock response content');
    });

    it('should handle extreme temperature values', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      // Test extreme but valid values
      const extremeValues = [0, 0.0001, 1.9999, 2.0];

      for (const temperature of extremeValues) {
        const _result = await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
          options: { temperature },
        });

        expect(result).toBe('Mock response content');
      }
    });

    it('should handle extreme maxTokens values', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      // Test extreme but reasonable values
      const extremeValues = [1, 100000];

      for (const maxTokens of extremeValues) {
        const _result = await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
          options: { maxTokens },
        });

        expect(result).toBe('Mock response content');
      }
    });

    it('should handle very long string options', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const longString = 'X'.repeat(10000);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: {
          callerType: longString,
          callerName: longString,
          conversationId: longString,
          sessionId: longString,
          userId: longString,
          dataClassification: longString,
        },
      });

      expect(result).toBe('Mock response content');
    });
  });

  describe('Error Handling Robustness', () => {
    it('should handle LLMServiceFactory throwing different error types', async () => {
      const errorTypes = [
        new Error('Standard error'),
        new TypeError('Type error'),
        new RangeError('Range error'),
        'String error',
        { message: 'Object error' },
        null,
        undefined,
      ];

      for (const error of errorTypes) {
        llmServiceFactory.generateResponse.mockRejectedValue(error);

        await expect(
          service.generateUnifiedResponse({
            provider: 'ollama',
            model: 'test-model',
            systemPrompt: 'Test prompt',
            userMessage: 'Test message',
          }),
        ).rejects.toThrow(/Unified LLM service error/);
      }
    });

    it('should preserve original error context in wrapped errors', async () => {
      const originalError = new Error('Original error with context');
      llmServiceFactory.generateResponse.mockRejectedValue(originalError);

      try {
        await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        });
      } catch (_error) {
        expect(_error.message).toContain('Unified LLM service _error');
        expect(_error.message).toContain('Original _error with context');
      }
    });

    it('should handle async errors gracefully', async () => {
      llmServiceFactory.generateResponse.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async error');
      });

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Unified LLM service error: Async error');
    });
  });

  describe('Response Format Robustness', () => {
    it('should handle malformed LLMResponse from factory', async () => {
      const malformedResponses = [
        null,
        undefined,
        {},
        { content: null },
        { content: undefined },
        { metadata: null },
        { content: 'test', metadata: null },
      ];

      for (const response of malformedResponses) {
        llmServiceFactory.generateResponse.mockResolvedValue(response as any);

        // Should not throw, but handle gracefully
        const _result = await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
          options: { includeMetadata: false },
        });

        // Should return something reasonable
        expect(result).toBeDefined();
      }
    });

    it('should handle includeMetadata flag correctly with malformed responses', async () => {
      const malformedResponse = { content: 'test content' }; // Missing metadata
      llmServiceFactory.generateResponse.mockResolvedValue(
        malformedResponse as any,
      );

      // With includeMetadata: true, should return the response as-is
      const resultWithMetadata = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: { includeMetadata: true },
      });

      expect(resultWithMetadata).toEqual(malformedResponse);

      // With includeMetadata: false, should return just content
      const resultWithoutMetadata = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: { includeMetadata: false },
      });

      expect(resultWithoutMetadata).toBe('test content');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: `Test prompt ${i}`,
          userMessage: `Test message ${i}`,
          options: { callerName: `concurrent-test-${i}` },
        }),
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBe('Mock response content');
      });

      // Factory should have been called for each request
      expect(llmServiceFactory.generateResponse).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed success/failure concurrent requests', async () => {
      let callCount = 0;
      llmServiceFactory.generateResponse.mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error(`Error for call ${callCount}`);
        }
        return createMockLLMResponse();
      });

      const concurrentRequests = Array.from({ length: 6 }, (_, i) =>
        service
          .generateUnifiedResponse({
            provider: 'ollama',
            model: 'test-model',
            systemPrompt: `Test prompt ${i}`,
            userMessage: `Test message ${i}`,
          })
          .catch((error) => ({ error: error.message })),
      );

      const results = await Promise.all(concurrentRequests);

      // Should have mix of successes and failures
      const successes = results.filter((r) => typeof r === 'string');
      const failures = results.filter(
        (r) => typeof r === 'object' && 'error' in r,
      );

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(3);
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory with repeated calls', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      // Simulate many sequential calls
      for (let i = 0; i < 100; i++) {
        const _result = await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: `Test prompt ${i}`,
          userMessage: `Test message ${i}`,
        });

        expect(result).toBe('Mock response content');
      }

      // Should complete without memory issues
      expect(llmServiceFactory.generateResponse).toHaveBeenCalledTimes(100);
    });

    it('should handle rapid sequential calls efficiently', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const startTime = Date.now();

      // Make 50 rapid sequential calls
      for (let i = 0; i < 50; i++) {
        await service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: `Test message ${i}`,
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete reasonably quickly (allowing for test overhead)
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for 50 calls
      expect(llmServiceFactory.generateResponse).toHaveBeenCalledTimes(50);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle configuration with all optional parameters', async () => {
      const mockResponse = createMockLLMResponse();
      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        options: {
          temperature: 0.7,
          maxTokens: 100,
          callerType: 'test-caller',
          callerName: 'robustness-test',
          conversationId: 'conv-123',
          sessionId: 'session-456',
          userId: 'user-789',
          authToken: 'auth-token-abc',
          currentUser: { id: 'user-789', email: 'test@example.com' },
          dataClassification: 'confidential',
          includeMetadata: true,
        },
      });

      expect(result).toEqual(mockResponse);
      expect(llmServiceFactory.generateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'ollama',
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 100,
        }),
        expect.objectContaining({
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
          options: expect.objectContaining({
            callerType: 'test-caller',
            callerName: 'robustness-test',
            dataClassification: 'confidential',
          }),
        }),
      );
    });
  });
});
