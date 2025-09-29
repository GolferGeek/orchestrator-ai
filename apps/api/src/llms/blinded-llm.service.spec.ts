import { Test, TestingModule } from '@nestjs/testing';
import { BlindedLLMService } from './blinded-llm.service';
import { SourceBlindingService } from './source-blinding.service';
import { ProviderConfigService } from './provider-config.service';

describe('BlindedLLMService', () => {
  let service: BlindedLLMService;
  let sourceBlindingService: jest.Mocked<SourceBlindingService>;
  let providerConfigService: jest.Mocked<ProviderConfigService>;

  beforeEach(async () => {
    const mockSourceBlindingService = {
      createBlindedHttpClient: jest.fn(),
    };

    const mockProviderConfigService = {
      getEnhancedProviderConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlindedLLMService,
        {
          provide: SourceBlindingService,
          useValue: mockSourceBlindingService,
        },
        {
          provide: ProviderConfigService,
          useValue: mockProviderConfigService,
        },
      ],
    }).compile();

    service = module.get<BlindedLLMService>(BlindedLLMService);
    sourceBlindingService = module.get(SourceBlindingService);
    providerConfigService = module.get(ProviderConfigService);
  });

  describe('createBlindedLLM', () => {
    beforeEach(() => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue({
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        features: {
          supportsNoTrain: true,
          supportsNoRetrain: false,
          supportsStreaming: true,
        },
        models: [],
        defaultModel: 'gpt-4o-mini',
        costPerToken: { input: 0.00001, output: 0.00003 },
      } as any);

      sourceBlindingService.createBlindedHttpClient.mockReturnValue({
        post: jest.fn(),
        get: jest.fn(),
      } as any);
    });

    it('should create blinded OpenAI LLM with source blinding options', () => {
      const llm = service.createBlindedLLM({
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
        sourceBlindingOptions: {
          policyProfile: 'strict',
          dataClass: 'confidential',
          noTrain: true,
          noRetain: true,
        },
      });

      expect(llm).toBeDefined();
      expect(
        providerConfigService.getEnhancedProviderConfig,
      ).toHaveBeenCalledWith('openai');
      expect(
        sourceBlindingService.createBlindedHttpClient,
      ).toHaveBeenCalledWith('openai', {
        provider: 'openai',
        policyProfile: 'strict',
        dataClass: 'confidential',
        sovereignMode: 'false',
        noTrain: true,
        noRetain: true,
      });
    });

    it('should create blinded Anthropic LLM', () => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue({
        name: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        features: {
          supportsNoTrain: true,
          supportsNoRetrain: false,
        },
        models: [],
        defaultModel: 'claude-3-haiku-20240307',
      } as any);

      const llm = service.createBlindedLLM({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        apiKey: 'custom-key',
      });

      expect(llm).toBeDefined();
      expect(
        providerConfigService.getEnhancedProviderConfig,
      ).toHaveBeenCalledWith('anthropic');
    });

    it('should create blinded Google LLM', () => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue({
        name: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'google-key',
        features: {
          supportsNoTrain: false,
          supportsNoRetrain: false,
        },
        models: [],
        defaultModel: 'gemini-pro',
      } as any);

      const llm = service.createBlindedLLM({
        provider: 'google',
        model: 'gemini-pro',
      });

      expect(llm).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        service.createBlindedLLM({
          provider: 'unsupported' as any,
        });
      }).toThrow('Unsupported provider: unsupported');
    });

    it('should throw error when provider config not found', () => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue(null);

      expect(() => {
        service.createBlindedLLM({
          provider: 'openai',
        });
      }).toThrow('Provider configuration not found: openai');
    });
  });

  describe('createBlindedLLMs', () => {
    beforeEach(() => {
      providerConfigService.getEnhancedProviderConfig.mockImplementation(
        (provider) =>
          ({
            name: provider,
            baseUrl: `https://api.${provider}.com`,
            apiKey: `${provider}-key`,
            features: { supportsNoTrain: true },
            models: [],
            defaultModel: `${provider}-model`,
          }) as any,
      );

      sourceBlindingService.createBlindedHttpClient.mockReturnValue({} as any);
    });

    it('should create blinded LLMs for all providers', () => {
      const llms = service.createBlindedLLMs({
        temperature: 0.8,
        maxTokens: 500,
      });

      expect(llms.openai).toBeDefined();
      expect(llms.anthropic).toBeDefined();
      expect(llms.google).toBeDefined();
    });
  });

  describe('testSourceBlinding', () => {
    it('should test source blinding for OpenAI', async () => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue({
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        features: { supportsNoTrain: true },
        models: [],
        defaultModel: 'gpt-4o-mini',
      } as any);

      const mockLLM = {
        call: jest.fn().mockResolvedValue({
          content: 'Test response',
        }),
      };

      sourceBlindingService.createBlindedHttpClient.mockReturnValue({} as any);

      // Mock the LLM creation internally
      jest.spyOn(service, 'createBlindedLLM').mockReturnValue(mockLLM as any);

      const result = await service.testSourceBlinding('openai');

      expect(result.success).toBe(true);
      expect(result.blindingApplied).toBe(true);
      expect(mockLLM.call).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello, this is a source blinding test.' },
      ]);
    });

    it('should handle test failures', async () => {
      providerConfigService.getEnhancedProviderConfig.mockReturnValue({
        name: 'openai',
        features: { supportsNoTrain: true },
      } as any);

      jest.spyOn(service, 'createBlindedLLM').mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await service.testSourceBlinding('openai');

      expect(result.success).toBe(false);
      expect(result.blindingApplied).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('getStats', () => {
    it('should return service statistics', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        supportedProviders: ['openai', 'anthropic', 'google'],
        sourceBlindingEnabled: true,
        blindingService: undefined, // Will be undefined in test due to mocking
      });
    });
  });
});
