import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderResponseDto,
  ModelResponseDto,
} from '../dto/llm-evaluation.dto';

describe('ProvidersController', () => {
  let controller: ProvidersController;

  const mockProviderResponse: ProviderResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    authType: 'api_key',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockModelResponse: ModelResponseDto = {
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

  const mockProvidersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findModelsByProvider: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [
        {
          provide: ProvidersService,
          useValue: mockProvidersService,
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<ProvidersController>(ProvidersController);
    service = module.get<ProvidersService>(ProvidersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviders', () => {
    it('should return array of providers in camelCase format', async () => {
      mockProvidersService.findAll.mockResolvedValue([mockProviderResponse]);

      const result = await controller.getProviders();

      expect(result).toEqual([mockProviderResponse]);
      expect(result[0]).toHaveProperty('apiBaseUrl'); // camelCase
      expect(result[0]).toHaveProperty('authType'); // camelCase
      expect(result[0]).toHaveProperty('createdAt'); // camelCase
      expect(result[0]).toHaveProperty('updatedAt'); // camelCase
      expect(mockProvidersService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter by status when provided', async () => {
      mockProvidersService.findAll.mockResolvedValue([mockProviderResponse]);

      await controller.getProviders('active');

      expect(mockProvidersService.findAll).toHaveBeenCalledWith('active');
    });
  });

  describe('getProvider', () => {
    it('should return a single provider in camelCase format', async () => {
      mockProvidersService.findOne.mockResolvedValue(mockProviderResponse);

      const result = await controller.getProvider(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // camelCase
      expect(result).toHaveProperty('authType'); // camelCase
      expect(mockProvidersService.findOne).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('should throw HttpException when provider not found', async () => {
      mockProvidersService.findOne.mockResolvedValue(null);

      await expect(controller.getProvider('non-existent-id')).rejects.toThrow(
        new HttpException('Provider not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('getProviderModels', () => {
    it('should return models for provider in camelCase format', async () => {
      mockProvidersService.findOne.mockResolvedValue(mockProviderResponse);
      mockProvidersService.findModelsByProvider.mockResolvedValue([
        mockModelResponse,
      ]);

      const result = await controller.getProviderModels(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual([mockModelResponse]);
      expect(result[0]).toHaveProperty('providerId'); // camelCase
      expect(result[0]).toHaveProperty('modelId'); // camelCase
      expect(result[0]).toHaveProperty('pricingInputPer1k'); // camelCase
      expect(result[0]).toHaveProperty('pricingOutputPer1k'); // camelCase
      expect(result[0]).toHaveProperty('supportsThinking'); // camelCase
      expect(result[0]).toHaveProperty('maxTokens'); // camelCase
      expect(result[0]).toHaveProperty('contextWindow'); // camelCase
      expect(result[0]).toHaveProperty('useCases'); // camelCase
      expect(result[0]).toHaveProperty('createdAt'); // camelCase
      expect(result[0]).toHaveProperty('updatedAt'); // camelCase
    });

    it('should throw HttpException when provider not found', async () => {
      mockProvidersService.findOne.mockResolvedValue(null);

      await expect(
        controller.getProviderModels('non-existent-id'),
      ).rejects.toThrow(
        new HttpException('Provider not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createProvider', () => {
    it('should create provider with camelCase input and return camelCase response', async () => {
      const createDto: CreateProviderDto = {
        name: 'Test Provider',
        apiBaseUrl: 'https://api.test.com',
        authType: 'api_key',
        status: 'active',
      };

      mockProvidersService.create.mockResolvedValue(mockProviderResponse);

      const result = await controller.createProvider(createDto);

      expect(result).toEqual(mockProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // camelCase response
      expect(result).toHaveProperty('authType'); // camelCase response
      expect(mockProvidersService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateProvider', () => {
    it('should update provider with camelCase input and return camelCase response', async () => {
      const updateDto: UpdateProviderDto = {
        name: 'Updated Provider',
        apiBaseUrl: 'https://api.updated.com',
        authType: 'oauth',
      };

      mockProvidersService.update.mockResolvedValue(mockProviderResponse);

      const result = await controller.updateProvider(
        '123e4567-e89b-12d3-a456-426614174000',
        updateDto,
      );

      expect(result).toEqual(mockProviderResponse);
      expect(result).toHaveProperty('apiBaseUrl'); // camelCase response
      expect(result).toHaveProperty('authType'); // camelCase response
      expect(mockProvidersService.update).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        updateDto,
      );
    });

    it('should throw HttpException when provider not found for update', async () => {
      mockProvidersService.update.mockResolvedValue(null);

      await expect(
        controller.updateProvider('non-existent-id', {}),
      ).rejects.toThrow(
        new HttpException('Provider not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('deleteProvider', () => {
    it('should delete provider successfully', async () => {
      mockProvidersService.delete.mockResolvedValue(true);

      const result = await controller.deleteProvider(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual({ message: 'Provider deleted successfully' });
      expect(mockProvidersService.delete).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('should throw HttpException when provider not found for deletion', async () => {
      mockProvidersService.delete.mockResolvedValue(false);

      await expect(
        controller.deleteProvider('non-existent-id'),
      ).rejects.toThrow(
        new HttpException('Provider not found', HttpStatus.NOT_FOUND),
      );
    });
  });
});
