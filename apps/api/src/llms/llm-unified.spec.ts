import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { LLMServiceFactory } from './services/llm-service-factory';
import { RunMetadataService } from './run-metadata.service';
import { PIIService } from '../services/pii.service';
import { DictionaryPseudonymizerService } from '../services/dictionary-pseudonymizer.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CIDAFMService } from '../cidafm/cidafm.service';
import { CentralizedRoutingService } from './centralized-routing.service';
import { ProviderConfigService } from './provider-config.service';
import { DataSanitizationService } from './data-sanitization.service';
import { PseudonymizerService } from '../services/pseudonymizer.service';
import { LocalModelStatusService } from './local-model-status.service';
import { LocalLLMService } from './local-llm.service';
import { BlindedLLMService } from './blinded-llm.service';
import { _Logger } from '@nestjs/common';

// Comprehensive mock implementations for all dependencies
const mockSupabaseService = {
  client: {},
  getClient: jest.fn(),
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
};

const mockLLMServiceFactory = {
  generateResponse: jest.fn(),
};

const mockPIIService = {
  processPII: jest.fn(),
  reversePseudonyms: jest.fn(),
};

const mockDictionaryPseudonymizerService = {
  pseudonymize: jest.fn(),
  reversePseudonyms: jest.fn(),
};

const mockRunMetadataService = {
  startRequest: jest.fn(),
  completeRequest: jest.fn(),
  completeRequestWithError: jest.fn(),
};

describe('LLMService - Unified Architecture', () => {
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
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: CIDAFMService,
          useValue: mockCIDAFMService,
        },
        {
          provide: CentralizedRoutingService,
          useValue: mockCentralizedRoutingService,
        },
        {
          provide: RunMetadataService,
          useValue: mockRunMetadataService,
        },
        {
          provide: ProviderConfigService,
          useValue: mockProviderConfigService,
        },
        {
          provide: DataSanitizationService,
          useValue: mockDataSanitizationService,
        },
        {
          provide: PIIService,
          useValue: mockPIIService,
        },
        {
          provide: PseudonymizerService,
          useValue: mockPseudonymizerService,
        },
        {
          provide: DictionaryPseudonymizerService,
          useValue: mockDictionaryPseudonymizerService,
        },
        {
          provide: LocalModelStatusService,
          useValue: mockLocalModelStatusService,
        },
        {
          provide: LocalLLMService,
          useValue: mockLocalLLMService,
        },
        {
          provide: BlindedLLMService,
          useValue: mockBlindedLLMService,
        },
        {
          provide: LLMServiceFactory,
          useValue: mockLLMServiceFactory,
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    llmServiceFactory = module.get(LLMServiceFactory);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateUnifiedResponse', () => {
    it('should validate required parameters', async () => {
      await expect(
        service.generateUnifiedResponse({
          provider: '',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow(
        'Unified LLM service error: Missing required parameter: provider is required',
      );

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: '',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow(
        'Unified LLM service error: Missing required parameter: model is required',
      );

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: '',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow(
        'Unified LLM service error: Missing required parameter: systemPrompt is required',
      );

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: '',
        }),
      ).rejects.toThrow(
        'Unified LLM service error: Missing required parameter: userMessage is required',
      );
    });

    it('should validate supported providers', async () => {
      await expect(
        service.generateUnifiedResponse({
          provider: 'unsupported-provider',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Unsupported provider');
    });

    it('should call LLMServiceFactory with correct parameters', async () => {
      const mockResponse = {
        content: 'Test response',
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
        },
      };

      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test system prompt',
        userMessage: 'Test user message',
        options: {
          temperature: 0.7,
          maxTokens: 100,
        },
      });

      expect(llmServiceFactory.generateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'ollama',
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 100,
        }),
        expect.objectContaining({
          systemPrompt: 'Test system prompt',
          userMessage: 'Test user message',
          options: expect.objectContaining({
            temperature: 0.7,
            maxTokens: 100,
          }),
        }),
      );

      expect(result).toBe('Test response');
    });

    it('should return metadata when includeMetadata is true', async () => {
      const mockResponse = {
        content: 'Test response',
        metadata: {
          provider: 'ollama',
          model: 'test-model',
          requestId: 'test-request-id-2',
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
        },
      };

      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUnifiedResponse({
        provider: 'ollama',
        model: 'test-model',
        systemPrompt: 'Test system prompt',
        userMessage: 'Test user message',
        options: {
          includeMetadata: true,
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors gracefully', async () => {
      const _error = new Error('LLM service error');
      llmServiceFactory.generateResponse.mockRejectedValue(error);

      await expect(
        service.generateUnifiedResponse({
          provider: 'ollama',
          model: 'test-model',
          systemPrompt: 'Test prompt',
          userMessage: 'Test message',
        }),
      ).rejects.toThrow('Unified LLM service error: LLM service error');
    });
  });

  describe('generateUserContentResponse', () => {
    it('should validate user preferences', async () => {
      await expect(
        service.generateUserContentResponse(
          'Test prompt',
          'Test message',
          { providerName: undefined, modelName: 'test-model' } as any,
          'test-token',
          'test-session',
        ),
      ).rejects.toThrow('User preferences must include a valid providerName');

      await expect(
        service.generateUserContentResponse(
          'Test prompt',
          'Test message',
          { providerName: 'ollama', modelName: undefined } as any,
          'test-token',
          'test-session',
        ),
      ).rejects.toThrow('User preferences must include a valid modelName');
    });

    it('should call generateUnifiedResponse and format response correctly', async () => {
      const mockResponse = {
        content: 'Generated content',
        metadata: {
          provider: 'ollama',
          model: 'test-model',
          requestId: 'test-request-id-3',
          timestamp: new Date().toISOString(),
          usage: {
            inputTokens: 20,
            outputTokens: 10,
            totalTokens: 30,
            cost: 0.002,
          },
          timing: {
            startTime: Date.now() - 1500,
            endTime: Date.now(),
            duration: 1500,
          },
          status: 'completed' as const,
          langsmithRunId: 'test-run-id',
        },
      };

      llmServiceFactory.generateResponse.mockResolvedValue(mockResponse);

      const _result = await service.generateUserContentResponse(
        'Test system prompt',
        'Test user message',
        {
          providerName: 'ollama',
          modelName: 'test-model',
          temperature: 0.8,
          maxTokens: 200,
        },
        'test-auth-token',
        'test-session-id',
      );

      expect(result).toEqual({
        content: 'Generated content',
        usage: expect.objectContaining({
          totalTokens: 30,
          inputTokens: 20,
          outputTokens: 10,
        }),
        costCalculation: expect.objectContaining({
          inputTokens: 20,
          outputTokens: 10,
          totalCost: 0.002,
          currency: 'USD',
        }),
        langsmithRunId: 'test-run-id',
        processedPrompt: 'Test user message',
        cidafmState: undefined,
        llmMetadata: expect.objectContaining({
          providerName: 'ollama',
          modelName: 'test-model',
        }),
      });
    });
  });
});
