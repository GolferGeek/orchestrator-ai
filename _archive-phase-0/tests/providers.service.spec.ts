import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
} from '@/llms/dto/llm-evaluation.dto';
import { AuthType } from '@/llms/types/llm-evaluation';

describe('ProvidersService', () => {
  let service: ProvidersService;

  // Mock database data in snake_case (as stored in DB)
  const mockDbProvider = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'OpenAI',
    api_base_url: 'https://api.openai.com/v1',
    auth_type: 'api_key',
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  // Expected API response in camelCase
  const expectedProviderResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    authType: 'api_key' as AuthType,
    status: 'active' as any,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockDbModel = {
    id: '456e7890-e89b-12d3-a456-426614174000',
    provider_id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'GPT-4o',
    model_id: 'gpt-4o',
    pricing_input_per_1k: 0.0025,
    pricing_output_per_1k: 0.01,
    supports_thinking: false,
    max_tokens: 4096,
    context_window: 128000,
    strengths: ['reasoning', 'code'],
    weaknesses: ['math'],
    use_cases: ['chat', 'coding'],
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    provider: mockDbProvider,
  };

  const expectedModelResponse = {
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
    provider: expectedProviderResponse,
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
    getAnonClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ProvidersService>(ProvidersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  describe('findAll', () => {
    it('should return providers converted from snake_case to camelCase', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [mockDbProvider],
        error: null,
      });

      const result = await service.findAll();

      expect(result).toEqual([expectedProviderResponse]);
      expect(result[0]).toHaveProperty('apiBaseUrl'); // Converted to camelCase
      expect(result[0]).toHaveProperty('authType'); // Converted to camelCase
      expect(result[0]).toHaveProperty('createdAt'); // Converted to camelCase
      expect(result[0]).toHaveProperty('updatedAt'); // Converted to camelCase
      expect(result[0]).not.toHaveProperty('api_base_url'); // No snake_case in response
      expect(result[0]).not.toHaveProperty('auth_type'); // No snake_case in response
    });

    it('should filter by status when provided', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: [mockDbProvider],
        error: null,
      });

      await service.findAll('active');

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('should throw HttpException on database error', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.findAll()).rejects.toThrow(
        new HttpException(
          'Failed to fetch providers: Database error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findOne', () => {
    it('should return single provider converted to camelCase', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockDbProvider,
        error: null,
      });

      const result = await service.findOne(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(expectedProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // Converted to camelCase
      expect(result).toHaveProperty('authType'); // Converted to camelCase
    });

    it('should return null when provider not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findModelsByProvider', () => {
    it('should return models converted from snake_case to camelCase', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [mockDbModel],
        error: null,
      });

      const result = await service.findModelsByProvider(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual([expectedModelResponse]);
      expect(result[0]).toHaveProperty('providerId'); // Converted to camelCase
      expect(result[0]).toHaveProperty('modelId'); // Converted to camelCase
      expect(result[0]).toHaveProperty('pricingInputPer1k'); // Converted to camelCase
      expect(result[0]).toHaveProperty('pricingOutputPer1k'); // Converted to camelCase
      expect(result[0]).toHaveProperty('supportsThinking'); // Converted to camelCase
      expect(result[0]).toHaveProperty('maxTokens'); // Converted to camelCase
      expect(result[0]).toHaveProperty('contextWindow'); // Converted to camelCase
      expect(result[0]).toHaveProperty('useCases'); // Converted to camelCase
      expect(result[0]).not.toHaveProperty('provider_id'); // No snake_case in response
      expect(result[0]).not.toHaveProperty('model_id'); // No snake_case in response
      expect(result[0]).not.toHaveProperty('use_cases'); // No snake_case in response
    });

    it('should query with provider_id in snake_case (database format)', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.findModelsByProvider(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'provider_id',
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });
  });

  describe('create', () => {
    it('should convert camelCase DTO to snake_case for database and return camelCase response', async () => {
      const createDto: CreateProviderDto = {
        name: 'Test Provider',
        apiBaseUrl: 'https://api.test.com',
        authType: 'api_key',
        status: 'active',
      };

      // Mock check for existing provider (first call)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock insert response (second call)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockDbProvider,
        error: null,
      });

      const result = await service.create(createDto);

      expect(result).toEqual(expectedProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // Response in camelCase
      expect(result).toHaveProperty('authType'); // Response in camelCase

      // Check that database insert used snake_case
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Provider',
        api_base_url: 'https://api.test.com', // Converted to snake_case for DB
        auth_type: 'api_key', // Converted to snake_case for DB
        status: 'active',
      });
    });

    it('should throw conflict error if provider name already exists', async () => {
      const createDto: CreateProviderDto = {
        name: 'Existing Provider',
        apiBaseUrl: 'https://api.test.com',
        authType: 'api_key',
      };

      // Mock existing provider found
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'existing-id' },
        error: null,
      });

      await expect(service.create(createDto)).rejects.toThrow(
        new HttpException('Provider name already exists', HttpStatus.CONFLICT),
      );
    });
  });

  describe('update', () => {
    it('should convert camelCase DTO to snake_case for database and return camelCase response', async () => {
      const updateDto: UpdateProviderDto = {
        name: 'Updated Provider',
        apiBaseUrl: 'https://api.updated.com',
        authType: 'oauth',
      };

      // Mock findOne to return existing provider
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(expectedProviderResponse);

      // Mock name conflict check (first call returns no conflict)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock update response (second call)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockDbProvider,
        error: null,
      });

      const result = await service.update(
        '123e4567-e89b-12d3-a456-426614174000',
        updateDto,
      );

      expect(result).toEqual(expectedProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // Response in camelCase
      expect(result).toHaveProperty('authType'); // Response in camelCase

      // Check that database update used snake_case
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Provider',
          api_base_url: 'https://api.updated.com', // Converted to snake_case for DB
          auth_type: 'oauth', // Converted to snake_case for DB
          updated_at: expect.any(String),
        }),
      );
    });

    it('should return null when provider not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const result = await service.update('non-existent-id', {});

      expect(result).toBeNull();
    });
  });

  describe('findAllWithModels', () => {
    it('should return providers with models, both converted to camelCase', async () => {
      const mockDbProviderWithModels = {
        ...mockDbProvider,
        models: [mockDbModel],
      };

      mockSupabaseClient.order.mockResolvedValue({
        data: [mockDbProviderWithModels],
        error: null,
      });

      const result = await service.findAllWithModels();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('apiBaseUrl'); // Provider converted to camelCase
      expect(result[0]).toHaveProperty('authType'); // Provider converted to camelCase
      expect((result[0] as any).models).toHaveLength(1);
      expect((result[0] as any).models[0]).toHaveProperty('providerId'); // Model converted to camelCase
      expect((result[0] as any).models[0]).toHaveProperty('modelId'); // Model converted to camelCase
      expect((result[0] as any).models[0]).toHaveProperty('useCases'); // Model converted to camelCase
    });
  });
});
