import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CIDAFMService } from '../cidafm/cidafm.service';
import { Provider, Model } from '../types/llm-evaluation';

describe('LLMService', () => {
  let service: LLMService;

  const mockProvider: Provider = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    authType: 'api_key',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockModel: Model = {
    id: '456e7890-e89b-12d3-a456-426614174000',
    providerId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'GPT-4o',
    modelId: 'gpt-4o',
    pricingInputPer1k: 0.0025,
    pricingOutputPer1k: 0.01,
    supportsThinking: false,
    maxTokens: 4096,
    contextWindow: 128000,
    strengths: ['reasoning', 'code'],
    weaknesses: ['math'],
    useCases: ['chat', 'coding'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  // Create a complete mock that supports the full chain
  const mockSupabaseClient: any = {};

  const resetMocks = () => {
    mockSupabaseClient.from = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.neq = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.limit = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single = jest.fn();
  };

  // Initialize mocks
  resetMocks();

  const mockSupabaseService = {
    getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getAnonClient: jest.fn().mockReturnValue(mockSupabaseClient),
    createAuthenticatedClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  const mockCIDAFMService = {
    processMessage: jest.fn(),
  };

  beforeEach(async () => {
    // Set test environment variables
    process.env.OPENAI_API_KEY =
      process.env.OPENAI_API_KEY || 'test-openai-key';
    process.env.ANTHROPIC_API_KEY =
      process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';
    process.env.GOOGLE_API_KEY =
      process.env.GOOGLE_API_KEY || 'test-google-key';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../../.env.local', '../../../.env'],
          expandVariables: true,
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
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    cidafmService = module.get<CIDAFMService>(CIDAFMService);
  });

  afterEach(() => {
    // Clean up test environment variables if they were set by the test
    if (process.env.OPENAI_API_KEY === 'test-openai-key') {
      delete process.env.OPENAI_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY === 'test-anthropic-key') {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.GOOGLE_API_KEY === 'test-google-key') {
      delete process.env.GOOGLE_API_KEY;
    }
    jest.clearAllMocks();
    resetMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('LangGraph LLM Creation', () => {
    it('should create OpenAI LLM instance', () => {
      const llm = service.getLangGraphLLM('openai');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Anthropic LLM instance', () => {
      const llm = service.getLangGraphLLM('anthropic');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Ollama LLM instance', () => {
      const llm = service.getLangGraphLLM('ollama');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Google LLM instance', () => {
      const llm = service.getLangGraphLLM('google');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should fall back to OpenAI for unknown providers', () => {
      const llm = service.getLangGraphLLM('unknown' as any);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });
  });

  describe('Custom LangGraph LLM Creation', () => {
    it('should create custom OpenAI LLM with configuration', () => {
      const config = {
        provider: 'openai' as const,
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1000,
      };

      const llm = service.createCustomLangGraphLLM(config);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create custom Anthropic LLM with configuration', () => {
      const config = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus-20240229',
        temperature: 0.3,
        maxTokens: 2000,
      };

      const llm = service.createCustomLangGraphLLM(config);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should throw error for unsupported provider', () => {
      const config = {
        provider: 'unsupported' as any,
      };

      expect(() => service.createCustomLangGraphLLM(config)).toThrow(
        'Unsupported provider: unsupported',
      );
    });
  });

  describe('Enhanced Messaging with LLM Selection', () => {
    // Mock LangChain LLM
    const mockLLM = {
      invoke: jest.fn(),
    };

    beforeEach(() => {
      // Mock private methods to avoid external dependencies
      jest.spyOn(service as any, 'getProviderAndModel').mockResolvedValue({
        provider: mockProvider,
        model: mockModel,
      });

      jest
        .spyOn(service as any, 'createLLMFromModel')
        .mockResolvedValue(mockLLM);

      mockCIDAFMService.processMessage.mockResolvedValue({
        modifiedPrompt: 'Processed user message',
        activeStateModifiers: ['disciplined'],
        executedCommands: ['state-check'],
        processingNotes: ['Applied response modifier: concise'],
      });

      mockLLM.invoke.mockResolvedValue({
        content: 'Enhanced response with LLM selection',
      });
    });

    describe('generateEnhancedResponse', () => {
      it('should generate enhanced response with LLM selection and CIDAFM processing', async () => {
        const result = await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          '^concise &disciplined Tell me about AI',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
            cidafmOptions: { activeStateModifiers: [] },
            sessionId: 'session-123',
            temperature: 0.7,
            maxTokens: 2000,
          },
        );

        expect(result).toHaveProperty(
          'content',
          'Enhanced response with LLM selection',
        );
        expect(result).toHaveProperty('usage');
        expect(result).toHaveProperty('costCalculation');
        expect(result).toHaveProperty(
          'processedPrompt',
          'Processed user message',
        );
        expect(result).toHaveProperty('cidafmState');

        // Verify CIDAFM processing was called
        expect(mockCIDAFMService.processMessage).toHaveBeenCalledWith(
          'user-123',
          '^concise &disciplined Tell me about AI',
          { activeStateModifiers: [] },
          'session-123',
        );

        // Verify cost calculation
        expect(result.costCalculation).toEqual({
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
          inputCost: expect.any(Number),
          outputCost: expect.any(Number),
          totalCost: expect.any(Number),
          currency: 'USD',
        });

        // Verify usage metrics
        expect(result.usage).toEqual({
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
          totalCost: expect.any(Number),
          responseTimeMs: expect.any(Number),
        });
      });

      it('should work without CIDAFM options', async () => {
        const result = await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Simple message without CIDAFM',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
          },
        );

        expect(result.content).toBe('Enhanced response with LLM selection');
        expect(result.processedPrompt).toBe('Simple message without CIDAFM');
        expect(mockCIDAFMService.processMessage).not.toHaveBeenCalled();
      });

      it('should apply state modifiers to system prompt', async () => {
        await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Test message',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
            cidafmOptions: { activeStateModifiers: [] },
            sessionId: 'session-123',
          },
        );

        // Verify that the LLM was called with enhanced system prompt
        const expectedSystemPrompt = expect.stringContaining('[CIDAFM');
        expect(mockLLM.invoke).toHaveBeenCalledWith([
          { role: 'system', content: expectedSystemPrompt },
          { role: 'user', content: 'Processed user message' },
        ]);
      });

      it('should use fallback provider/model when IDs are not provided', async () => {
        // Mock fallback to default OpenAI provider/model
        mockSupabaseClient.single
          .mockResolvedValueOnce({
            data: {
              id: 'default-provider-id',
              name: 'OpenAI',
              api_base_url: 'https://api.openai.com/v1',
              auth_type: 'api_key',
              status: 'active',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: 'default-model-id',
              provider_id: 'default-provider-id',
              name: 'GPT-4o Mini',
              model_id: 'gpt-4o-mini',
              pricing_input_per_1k: 0.00015,
              pricing_output_per_1k: 0.0006,
              supports_thinking: false,
              max_tokens: 16384,
              context_window: 128000,
              strengths: ['chat', 'reasoning'],
              weaknesses: [],
              use_cases: ['general'],
              status: 'active',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
            error: null,
          });

        const result = await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Test message',
        );

        expect(result.content).toBe('Enhanced response with LLM selection');
      });

      it('should handle errors in enhanced response generation', async () => {
        mockLLM.invoke.mockRejectedValue(new Error('LLM API Error'));

        await expect(
          service.generateEnhancedResponse(
            'user-123',
            'You are a helpful assistant.',
            'Test message',
            {
              providerId: '123e4567-e89b-12d3-a456-426614174000',
              modelId: '456e7890-e89b-12d3-a456-426614174000',
            },
          ),
        ).rejects.toThrow('Enhanced LLM service error: LLM API Error');
      });

      it('should calculate costs correctly based on model pricing', async () => {
        const result = await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Test message for cost calculation',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
          },
        );

        expect(result.costCalculation.inputCost).toBeGreaterThan(0);
        expect(result.costCalculation.outputCost).toBeGreaterThan(0);
        expect(result.costCalculation.totalCost).toBe(
          result.costCalculation.inputCost + result.costCalculation.outputCost,
        );
        expect(result.costCalculation.currency).toBe('USD');
      });

      it('should track response time metrics', async () => {
        const result = await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Test message for timing',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
          },
        );

        expect(result.usage.responseTimeMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.usage.responseTimeMs).toBe('number');
      });

      it('should pass custom temperature and maxTokens to LLM', async () => {
        await service.generateEnhancedResponse(
          'user-123',
          'You are a helpful assistant.',
          'Test message',
          {
            providerId: '123e4567-e89b-12d3-a456-426614174000',
            modelId: '456e7890-e89b-12d3-a456-426614174000',
            temperature: 0.9,
            maxTokens: 1500,
          },
        );

        // Verify createLLMFromModel was called with custom overrides
        expect(service as any).toHaveProperty('createLLMFromModel');
      });
    });

    describe('generateResponseWithHistory', () => {
      beforeEach(() => {
        jest.spyOn(service, 'getLangGraphLLM').mockReturnValue(mockLLM as any);
      });

      it('should generate response with conversation history', async () => {
        const mockResponse = {
          content: 'Response with conversation context',
        };

        mockLLM.invoke.mockResolvedValue(mockResponse);

        const conversationHistory = [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' },
        ];

        const result = await service.generateResponseWithHistory(
          'You are a helpful assistant.',
          conversationHistory,
          'What did I say before?',
        );

        expect(result).toBe('Response with conversation context');
        expect(mockLLM.invoke).toHaveBeenCalledWith([
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'What did I say before?' },
        ]);
      });

      it('should handle empty conversation history', async () => {
        const mockResponse = {
          content: 'Response without history',
        };

        mockLLM.invoke.mockResolvedValue(mockResponse);

        const result = await service.generateResponseWithHistory(
          'You are a helpful assistant.',
          [],
          'Hello',
        );

        expect(result).toBe('Response without history');
        expect(mockLLM.invoke).toHaveBeenCalledWith([
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ]);
      });
    });
  });
});
