import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateModelDto,
  UpdateModelDto,
  ModelResponseDto,
} from '../dto/llm-evaluation.dto';

describe('ModelsController', () => {
  let controller: ModelsController;

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
    provider: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'OpenAI',
      apiBaseUrl: 'https://api.openai.com/v1',
      authType: 'api_key',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  };

  const mockModelsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByProvider: jest.fn(),
  };

  const mockSupabaseService = {
    getServiceClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelsController],
      providers: [
        {
          provide: ModelsService,
          useValue: mockModelsService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<ModelsController>(ModelsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getModels', () => {
    it('should return array of models in camelCase format', async () => {
      mockModelsService.findAll.mockResolvedValue([mockModelResponse]);

      const result = await controller.getModels();

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
      expect(mockModelsService.findAll).toHaveBeenCalledWith({
        providerId: undefined,
        status: undefined,
        supportsThinking: undefined,
        includeProvider: undefined,
      });
    });

    it('should filter by status and provider when provided', async () => {
      mockModelsService.findAll.mockResolvedValue([mockModelResponse]);

      await controller.getModels(
        '123e4567-e89b-12d3-a456-426614174000',
        'active',
      );

      expect(mockModelsService.findAll).toHaveBeenCalledWith({
        providerId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
        supportsThinking: undefined,
        includeProvider: undefined,
      });
    });
  });

  describe('getModel', () => {
    it('should return a single model in camelCase format', async () => {
      mockModelsService.findOne.mockResolvedValue(mockModelResponse);

      const result = await controller.getModel(
        '456e7890-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockModelResponse);
      expect(result).toHaveProperty('providerId'); // camelCase
      expect(result).toHaveProperty('modelId'); // camelCase
      expect(result).toHaveProperty('pricingInputPer1k'); // camelCase
      expect(result).toHaveProperty('supportsThinking'); // camelCase
      expect(mockModelsService.findOne).toHaveBeenCalledWith(
        '456e7890-e89b-12d3-a456-426614174000',
        undefined,
      );
    });

    it('should throw HttpException when model not found', async () => {
      mockModelsService.findOne.mockResolvedValue(null);

      await expect(controller.getModel('non-existent-id')).rejects.toThrow(
        new HttpException('Model not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createModel', () => {
    it('should create model with camelCase input and return camelCase response', async () => {
      const createDto: CreateModelDto = {
        providerId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Model',
        modelId: 'test-model',
        pricingInputPer1k: 0.001,
        pricingOutputPer1k: 0.002,
        supportsThinking: true,
        maxTokens: 2048,
        contextWindow: 64000,
        strengths: ['fast'],
        weaknesses: ['limited'],
        useCases: ['testing'],
        status: 'active',
      };

      mockModelsService.create.mockResolvedValue(mockModelResponse);

      const result = await controller.createModel(createDto);

      expect(result).toEqual(mockModelResponse);
      expect(result).toHaveProperty('providerId'); // camelCase response
      expect(result).toHaveProperty('modelId'); // camelCase response
      expect(result).toHaveProperty('pricingInputPer1k'); // camelCase response
      expect(result).toHaveProperty('supportsThinking'); // camelCase response
      expect(mockModelsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateModel', () => {
    it('should update model with camelCase input and return camelCase response', async () => {
      const updateDto: UpdateModelDto = {
        name: 'Updated Model',
        modelId: 'updated-model',
        pricingInputPer1k: 0.002,
        pricingOutputPer1k: 0.004,
        supportsThinking: false,
        maxTokens: 4096,
        contextWindow: 128000,
      };

      mockModelsService.update.mockResolvedValue(mockModelResponse);

      const result = await controller.updateModel(
        '456e7890-e89b-12d3-a456-426614174000',
        updateDto,
      );

      expect(result).toEqual(mockModelResponse);
      expect(result).toHaveProperty('providerId'); // camelCase response
      expect(result).toHaveProperty('modelId'); // camelCase response
      expect(result).toHaveProperty('pricingInputPer1k'); // camelCase response
      expect(result).toHaveProperty('supportsThinking'); // camelCase response
      expect(mockModelsService.update).toHaveBeenCalledWith(
        '456e7890-e89b-12d3-a456-426614174000',
        updateDto,
      );
    });

    it('should throw HttpException when model not found for update', async () => {
      mockModelsService.update.mockResolvedValue(null);

      await expect(
        controller.updateModel('non-existent-id', {}),
      ).rejects.toThrow(
        new HttpException('Model not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('deleteModel', () => {
    it('should delete model successfully', async () => {
      mockModelsService.delete.mockResolvedValue(true);

      const result = await controller.deleteModel(
        '456e7890-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual({ message: 'Model deleted successfully' });
      expect(mockModelsService.delete).toHaveBeenCalledWith(
        '456e7890-e89b-12d3-a456-426614174000',
      );
    });

    it('should throw HttpException when model not found for deletion', async () => {
      mockModelsService.delete.mockResolvedValue(false);

      await expect(controller.deleteModel('non-existent-id')).rejects.toThrow(
        new HttpException('Model not found', HttpStatus.NOT_FOUND),
      );
    });
  });
});
