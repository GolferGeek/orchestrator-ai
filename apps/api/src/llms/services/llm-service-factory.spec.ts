import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { LLMServiceFactory, SupportedProvider } from './llm-service-factory';
import { PIIService } from '../../services/pii.service';
import { PseudonymizerService } from '../../services/pseudonymizer.service';
import { DictionaryPseudonymizerService } from '../../services/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import { OpenAILLMService } from './openai-llm.service';
import { AnthropicLLMService } from './anthropic-llm.service';
import { GoogleLLMService } from './google-llm.service';
import { OllamaLLMService } from './ollama-llm.service';
import { GrokLLMService } from './grok-llm.service';
import {
  LLMServiceConfig,
  GenerateResponseParams,
  LLMResponse,
} from './llm-interfaces';

describe('LLMServiceFactory', () => {
  let factory: LLMServiceFactory;
  let mockPIIService: jest.Mocked<PIIService>;
  let mockPseudonymizerService: jest.Mocked<PseudonymizerService>;
  let mockDictionaryPseudonymizerService: jest.Mocked<DictionaryPseudonymizerService>;
  let mockRunMetadataService: jest.Mocked<RunMetadataService>;
  let mockProviderConfigService: jest.Mocked<ProviderConfigService>;
  let mockHttpService: jest.Mocked<HttpService>;

  const createMockConfig = (
    provider: string,
    model: string = 'test-model',
  ): LLMServiceConfig => ({
    provider,
    model,
    temperature: 0.7,
    maxTokens: 1000,
    timeout: 30000,
  });

  beforeEach(async () => {
    // Create mock services
    mockPIIService = {
      processText: jest.fn(),
    } as any;

    mockPseudonymizerService = {
      pseudonymize: jest.fn(),
      depseudonymize: jest.fn(),
    } as any;

    mockDictionaryPseudonymizerService = {
      pseudonymize: jest.fn(),
      depseudonymize: jest.fn(),
    } as any;

    mockRunMetadataService = {
      createRun: jest.fn(),
      updateRun: jest.fn(),
    } as any;

    mockProviderConfigService = {
      getProviderConfig: jest.fn(),
    } as any;

    mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMServiceFactory,
        { provide: PIIService, useValue: mockPIIService },
        { provide: PseudonymizerService, useValue: mockPseudonymizerService },
        {
          provide: DictionaryPseudonymizerService,
          useValue: mockDictionaryPseudonymizerService,
        },
        { provide: RunMetadataService, useValue: mockRunMetadataService },
        { provide: ProviderConfigService, useValue: mockProviderConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    factory = module.get<LLMServiceFactory>(LLMServiceFactory);
  });

  afterEach(() => {
    // Clear cache after each test
    factory.clearCache();
  });

  describe('createService', () => {
    it('should create OpenAI service instance', async () => {
      const config = createMockConfig('openai', 'gpt-4');

      // Mock environment variable for API key
      process.env.OPENAI_API_KEY = 'test-key';

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(OpenAILLMService);
    });

    it('should create Anthropic service instance', async () => {
      const config = createMockConfig('anthropic', 'claude-3-sonnet');

      // Mock environment variable for API key
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(AnthropicLLMService);
    });

    it('should create Google service instance', async () => {
      const config = createMockConfig('google', 'gemini-pro');

      // Mock environment variable for API key
      process.env.GOOGLE_API_KEY = 'test-key';

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(GoogleLLMService);
    });

    it('should create Ollama service instance', async () => {
      const config = createMockConfig('ollama', 'llama2');

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(OllamaLLMService);
    });

    it('should create Grok service instance', async () => {
      const config = createMockConfig('grok', 'grok-beta');

      // Mock environment variable for API key
      process.env.XAI_API_KEY = 'test-key';

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(GrokLLMService);
    });

    it('should handle case-insensitive provider names', async () => {
      const config = createMockConfig('OPENAI', 'gpt-4');

      process.env.OPENAI_API_KEY = 'test-key';

      const service = await factory.createService(config);

      expect(service).toBeInstanceOf(OpenAILLMService);
    });

    it('should return cached instance when useCache is true', async () => {
      const config = createMockConfig('openai', 'gpt-4');

      process.env.OPENAI_API_KEY = 'test-key';

      const service1 = await factory.createService(config, true);
      const service2 = await factory.createService(config, true);

      expect(service1).toBe(service2); // Same instance
    });

    it('should create new instance when useCache is false', async () => {
      const config = createMockConfig('openai', 'gpt-4');

      process.env.OPENAI_API_KEY = 'test-key';

      const service1 = await factory.createService(config, false);
      const service2 = await factory.createService(config, false);

      expect(service1).not.toBe(service2); // Different instances
    });

    it('should throw error for unsupported provider', async () => {
      const config = createMockConfig('unsupported-provider');

      await expect(factory.createService(config)).rejects.toThrow(
        'Unsupported provider: unsupported-provider',
      );
    });

    it('should throw error for invalid configuration', async () => {
      await expect(factory.createService(null as any)).rejects.toThrow(
        'LLM service configuration is required',
      );

      await expect(factory.createService({} as any)).rejects.toThrow(
        'Provider is required in LLM service configuration',
      );

      await expect(
        factory.createService({ provider: 'openai' } as any),
      ).rejects.toThrow('Model is required in LLM service configuration');
    });

    it('should validate temperature parameter', async () => {
      const config = { ...createMockConfig('openai'), temperature: 3 };

      await expect(factory.createService(config)).rejects.toThrow(
        'Temperature must be a number between 0 and 2',
      );
    });

    it('should validate maxTokens parameter', async () => {
      const config = { ...createMockConfig('openai'), maxTokens: -1 };

      await expect(factory.createService(config)).rejects.toThrow(
        'Max tokens must be a positive number',
      );
    });

    it('should validate timeout parameter', async () => {
      const config = { ...createMockConfig('openai'), timeout: 0 };

      await expect(factory.createService(config)).rejects.toThrow(
        'Timeout must be a positive number',
      );
    });
  });

  describe('getSupportedProviders', () => {
    it('should return all supported providers', () => {
      const providers = factory.getSupportedProviders();

      expect(providers).toEqual([
        'openai',
        'anthropic',
        'google',
        'ollama',
        'grok',
      ]);
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for supported providers', () => {
      expect(factory.isProviderSupported('openai')).toBe(true);
      expect(factory.isProviderSupported('ANTHROPIC')).toBe(true);
      expect(factory.isProviderSupported('Google')).toBe(true);
    });

    it('should return false for unsupported providers', () => {
      expect(factory.isProviderSupported('unsupported')).toBe(false);
      expect(factory.isProviderSupported('')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific provider', async () => {
      const openaiConfig = createMockConfig('openai', 'gpt-4');
      const anthropicConfig = createMockConfig('anthropic', 'claude-3');

      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Create cached instances
      await factory.createService(openaiConfig);
      await factory.createService(anthropicConfig);

      let stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(2);

      // Clear only OpenAI cache
      factory.clearCache('openai');

      stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(1);
      expect(stats.providerBreakdown.anthropic).toBe(1);
    });

    it('should clear all cache when no provider specified', async () => {
      const openaiConfig = createMockConfig('openai', 'gpt-4');
      const anthropicConfig = createMockConfig('anthropic', 'claude-3');

      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Create cached instances
      await factory.createService(openaiConfig);
      await factory.createService(anthropicConfig);

      let stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(2);

      // Clear all cache
      factory.clearCache();

      stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const openaiConfig1 = createMockConfig('openai', 'gpt-4');
      const openaiConfig2 = createMockConfig('openai', 'gpt-3.5-turbo');
      const anthropicConfig = createMockConfig('anthropic', 'claude-3');

      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Create cached instances
      await factory.createService(openaiConfig1);
      await factory.createService(openaiConfig2);
      await factory.createService(anthropicConfig);

      const stats = factory.getCacheStats();

      expect(stats.totalCached).toBe(3);
      expect(stats.providerBreakdown.openai).toBe(2);
      expect(stats.providerBreakdown.anthropic).toBe(1);
    });

    it('should return empty stats when cache is empty', () => {
      const stats = factory.getCacheStats();

      expect(stats.totalCached).toBe(0);
      expect(stats.providerBreakdown).toEqual({});
    });
  });

  describe('cache key generation', () => {
    it('should generate different cache keys for different configurations', async () => {
      const config1 = createMockConfig('openai', 'gpt-4');
      const config2 = createMockConfig('openai', 'gpt-3.5-turbo');
      const config3 = {
        ...createMockConfig('openai', 'gpt-4'),
        temperature: 0.5,
      };

      process.env.OPENAI_API_KEY = 'test-key';

      // Create services with different configs
      const service1 = await factory.createService(config1);
      const service2 = await factory.createService(config2);
      const service3 = await factory.createService(config3);

      // All should be different instances
      expect(service1).not.toBe(service2);
      expect(service1).not.toBe(service3);
      expect(service2).not.toBe(service3);

      const stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle service instantiation errors gracefully', async () => {
      const config = createMockConfig('openai', 'gpt-4');

      // Don't set API key to trigger error
      delete process.env.OPENAI_API_KEY;

      await expect(factory.createService(config)).rejects.toThrow(
        'Failed to instantiate openai service',
      );
    });
  });

  describe('generateResponse', () => {
    it('should generate response with full metadata preservation', async () => {
      const config = createMockConfig('openai', 'gpt-4');
      const params: GenerateResponseParams = {
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'Hello, world!',
        config,
        options: {
          temperature: 0.7,
          maxTokens: 100,
        },
      };

      process.env.OPENAI_API_KEY = 'test-key';

      // Mock the generateResponse method on the service
      const mockResponse: LLMResponse = {
        content: 'Hello! How can I help you today?',
        metadata: {
          provider: 'openai',
          model: 'gpt-4',
          requestId: 'test-request-id',
          timestamp: new Date().toISOString(),
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cost: 0.001,
          },
          timing: {
            startTime: Date.now() - 1000,
            endTime: Date.now(),
            duration: 1000,
          },
          tier: 'external' as const,
          status: 'completed' as const,
          providerSpecific: {
            finish_reason: 'stop',
            system_fingerprint: 'test-fingerprint',
          },
        },
        piiMetadata: {
          piiDetected: false,
          showstopperDetected: false,
          detectionResults: {
            totalMatches: 0,
            flaggedMatches: [],
            dataTypesSummary: {},
            severityBreakdown: {
              showstopper: 0,
              warning: 0,
              info: 0,
            },
          },
          policyDecision: {
            allowed: true,
            blocked: false,
            violations: [],
            reasoningPath: ['No PII detected'],
            appliedFor: 'external',
          },
          userMessage: {
            summary: 'Request processed successfully',
            details: ['No PII detected in your request'],
            actionsTaken: ['Request processed normally'],
            isBlocked: false,
          },
          processingFlow: 'allowed-local',
          processingSteps: ['detection-completed'],
          timestamps: {
            detectionStart: Date.now() - 10,
          },
        },
      };

      // Create a service and mock its generateResponse method
      const service = await factory.createService(config);
      jest.spyOn(service, 'generateResponse').mockResolvedValue(mockResponse);

      const response = await factory.generateResponse(config, params);

      expect(response).toEqual(mockResponse);
      expect(response.metadata.provider).toBe('openai');
      expect(response.metadata.model).toBe('gpt-4');
      expect(response.metadata.usage.totalTokens).toBe(18);
      expect(response.metadata.timing.duration).toBe(1000);
      expect(response.piiMetadata?.piiDetected).toBe(false);
      expect(service.generateResponse).toHaveBeenCalledWith(params);
    });

    it('should use cached service for generateResponse', async () => {
      const config = createMockConfig('openai', 'gpt-4');
      const params: GenerateResponseParams = {
        systemPrompt: 'Test prompt',
        userMessage: 'Test message',
        config,
      };

      process.env.OPENAI_API_KEY = 'test-key';

      const mockResponse: LLMResponse = {
        content: 'Test response',
        metadata: {
          provider: 'openai',
          model: 'gpt-4',
          requestId: 'test-id',
          timestamp: new Date().toISOString(),
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          timing: { startTime: 0, endTime: 100, duration: 100 },
          tier: 'external' as const,
          status: 'completed' as const,
        },
      };

      // First call
      const service1 = await factory.createService(config);
      jest.spyOn(service1, 'generateResponse').mockResolvedValue(mockResponse);

      const response1 = await factory.generateResponse(config, params);

      // Second call should use cached service
      const response2 = await factory.generateResponse(config, params);

      expect(response1).toEqual(mockResponse);
      expect(response2).toEqual(mockResponse);

      // Should have used the same cached service
      const stats = factory.getCacheStats();
      expect(stats.totalCached).toBe(1);
    });
  });

  describe('getService', () => {
    it('should return service instance with full metadata capabilities', async () => {
      const config = createMockConfig('anthropic', 'claude-3-sonnet');

      process.env.ANTHROPIC_API_KEY = 'test-key';

      const service = await factory.getService(config);

      expect(service).toBeInstanceOf(AnthropicLLMService);
      expect(typeof service.generateResponse).toBe('function');
    });

    it('should respect caching parameter in getService', async () => {
      const config = createMockConfig('google', 'gemini-pro');

      process.env.GOOGLE_API_KEY = 'test-key';

      const service1 = await factory.getService(config, true);
      const service2 = await factory.getService(config, true);
      const service3 = await factory.getService(config, false);

      expect(service1).toBe(service2); // Same cached instance
      expect(service1).not.toBe(service3); // Different instance when cache disabled
    });
  });

  describe('metadata preservation', () => {
    it('should preserve provider-specific metadata fields', async () => {
      const config = createMockConfig('ollama', 'llama2');
      const service = await factory.createService(config);

      // Verify the service can handle provider-specific metadata
      expect(service).toBeInstanceOf(OllamaLLMService);

      // The service should have access to all dependencies needed for metadata generation
      expect(service).toHaveProperty('config');
      expect((service as any).runMetadataService).toBeDefined();
      expect((service as any).providerConfigService).toBeDefined();
    });

    it('should maintain PII processing capabilities for metadata', async () => {
      const config = createMockConfig('grok', 'grok-beta');

      process.env.XAI_API_KEY = 'test-key';

      const service = await factory.createService(config);

      // Verify PII services are properly injected
      expect((service as any).piiService).toBeDefined();
      expect((service as any).pseudonymizerService).toBeDefined();
      expect((service as any).dictionaryPseudonymizerService).toBeDefined();
    });
  });
});
