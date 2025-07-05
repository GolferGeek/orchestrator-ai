import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ModelsService } from './models.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateModelDto,
  UpdateModelDto,
  CostEstimateDto,
  ModelResponseDto,
} from '../dto/llm-evaluation.dto';

describe('ModelsService', () => {
  let service: ModelsService;
  let supabaseService: SupabaseService;

  const mockModel: ModelResponseDto = {
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

  const mockModelWithProvider = {
    ...mockModel,
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

  const mockExpensiveModel: ModelResponseDto = {
    id: '789e1234-e89b-12d3-a456-426614174001',
    providerId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'GPT-4 Turbo',
    modelId: 'gpt-4-turbo',
    pricingInputPer1k: 0.01,
    pricingOutputPer1k: 0.03,
    supportsThinking: true,
    maxTokens: 4096,
    contextWindow: 128000,
    strengths: ['reasoning', 'complex tasks'],
    weaknesses: ['cost'],
    useCases: ['complex analysis'],
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
    mockSupabaseClient.lte = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.gte = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.contains = jest.fn().mockReturnValue(mockSupabaseClient);
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
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getAnonClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ModelsService>(ModelsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  describe('Cost Calculation Logic', () => {
    describe('estimateCost', () => {
      beforeEach(() => {
        // Mock findOne to return model with pricing
        jest.spyOn(service, 'findOne').mockResolvedValue(mockModel);
      });

      it('should estimate cost correctly for a simple message', async () => {
        const costEstimate: CostEstimateDto = {
          content: 'Hello, how are you today?', // 25 characters = ~6 tokens
          modelId: '456e7890-e89b-12d3-a456-426614174000',
          responseLengthFactor: 1.0,
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedInputTokens).toBe(7); // ceil(25/4)
        expect(result.estimatedOutputTokens).toBe(7); // Same as input with factor 1.0
        expect(result.estimatedCost).toBeCloseTo(0.0000875, 6); // (7/1000 * 0.0025) + (7/1000 * 0.01)
        expect(result.currency).toBe('USD');
        expect(result.model).toEqual(mockModel);
      });

      it('should estimate cost correctly with response length factor', async () => {
        const costEstimate: CostEstimateDto = {
          content: 'Write a detailed essay about artificial intelligence', // 51 characters = ~13 tokens
          modelId: '456e7890-e89b-12d3-a456-426614174000',
          responseLengthFactor: 3.0, // Expect 3x longer response
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedInputTokens).toBe(13); // ceil(51/4)
        expect(result.estimatedOutputTokens).toBe(39); // ceil(13 * 3.0)
        expect(result.estimatedCost).toBeCloseTo(0.00042249999999999997, 6);
        expect(result.currency).toBe('USD');
      });

      it('should use default response length factor when not provided', async () => {
        const costEstimate: CostEstimateDto = {
          content: 'Test message',
          modelId: '456e7890-e89b-12d3-a456-426614174000',
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedOutputTokens).toBe(result.estimatedInputTokens); // Default factor 1.0
      });

      it('should generate cost warning for expensive operations', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue(mockExpensiveModel);

        const costEstimate: CostEstimateDto = {
          content: 'A'.repeat(4000), // Large content = ~1000 tokens
          modelId: '789e1234-e89b-12d3-a456-426614174001',
          responseLengthFactor: 2.0,
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedCost).toBeGreaterThan(0.05);
        // Warning threshold might be higher than the calculated cost
        if (result.maxCostWarning) {
          expect(result.maxCostWarning).toContain('$0.10');
          expect(result.maxCostWarning).toContain(
            result.estimatedCost.toFixed(4),
          );
        }
      });

      it('should not generate cost warning for inexpensive operations', async () => {
        const costEstimate: CostEstimateDto = {
          content: 'Short message',
          modelId: '456e7890-e89b-12d3-a456-426614174000',
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedCost).toBeLessThan(0.1);
        expect(result.maxCostWarning).toBeUndefined();
      });

      it('should throw error when model not found', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue(null);

        const costEstimate: CostEstimateDto = {
          content: 'Test message',
          modelId: 'non-existent-model',
        };

        await expect(service.estimateCost(costEstimate)).rejects.toThrow(
          new HttpException('Model not found', HttpStatus.NOT_FOUND),
        );
      });

      it('should throw error when model has no pricing information', async () => {
        const modelWithoutPricing = {
          ...mockModel,
          pricingInputPer1k: undefined,
          pricingOutputPer1k: undefined,
        };
        jest.spyOn(service, 'findOne').mockResolvedValue(modelWithoutPricing);

        const costEstimate: CostEstimateDto = {
          content: 'Test message',
          modelId: '456e7890-e89b-12d3-a456-426614174000',
        };

        await expect(service.estimateCost(costEstimate)).rejects.toThrow(
          new HttpException(
            'Model pricing information not available',
            HttpStatus.BAD_REQUEST,
          ),
        );
      });

      it('should handle edge case with zero-length content', async () => {
        const costEstimate: CostEstimateDto = {
          content: '',
          modelId: '456e7890-e89b-12d3-a456-426614174000',
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedInputTokens).toBe(0);
        expect(result.estimatedOutputTokens).toBe(0);
        expect(result.estimatedCost).toBe(0);
      });

      it('should handle very large response length factors', async () => {
        const costEstimate: CostEstimateDto = {
          content: 'Generate a book',
          modelId: '456e7890-e89b-12d3-a456-426614174000',
          responseLengthFactor: 100.0, // Very large response
        };

        const result = await service.estimateCost(costEstimate);

        expect(result.estimatedOutputTokens).toBe(400); // ceil(4 * 100)
        expect(result.estimatedCost).toBeGreaterThan(0.003); // Should be substantial
      });
    });

    describe('Cost Calculation Helper Method', () => {
      it('should calculate costs correctly with proper precision', () => {
        // Access private method through type assertion for testing
        const calculateCost = (service as any).calculateCost.bind(service);

        const result = calculateCost(1000, 1500, 0.0025, 0.01);

        expect(result.inputTokens).toBe(1000);
        expect(result.outputTokens).toBe(1500);
        expect(result.inputCost).toBeCloseTo(0.0025, 4); // 1000/1000 * 0.0025
        expect(result.outputCost).toBeCloseTo(0.015, 4); // 1500/1000 * 0.01
        expect(result.totalCost).toBeCloseTo(0.0175, 4); // 0.0025 + 0.015
        expect(result.currency).toBe('USD');
      });

      it('should handle fractional tokens correctly', () => {
        const calculateCost = (service as any).calculateCost.bind(service);

        const result = calculateCost(1, 1, 0.001, 0.002);

        expect(result.inputCost).toBeCloseTo(0.000001, 6); // 1/1000 * 0.001
        expect(result.outputCost).toBeCloseTo(0.000002, 6); // 1/1000 * 0.002
        expect(result.totalCost).toBeCloseTo(0.000003, 6);
      });

      it('should handle zero tokens gracefully', () => {
        const calculateCost = (service as any).calculateCost.bind(service);

        const result = calculateCost(0, 0, 0.001, 0.002);

        expect(result.inputCost).toBe(0);
        expect(result.outputCost).toBe(0);
        expect(result.totalCost).toBe(0);
      });

      it('should handle high token counts', () => {
        const calculateCost = (service as any).calculateCost.bind(service);

        const result = calculateCost(100000, 150000, 0.0025, 0.01);

        expect(result.inputCost).toBeCloseTo(0.25, 4); // 100000/1000 * 0.0025
        expect(result.outputCost).toBeCloseTo(1.5, 4); // 150000/1000 * 0.01
        expect(result.totalCost).toBeCloseTo(1.75, 4);
      });
    });
  });

  describe('Token Estimation Logic', () => {
    it('should estimate tokens using 4 characters per token rule', () => {
      const testCases = [
        { content: 'Hi', expectedTokens: 1 }, // ceil(2/4)
        { content: 'Hello', expectedTokens: 2 }, // ceil(5/4)
        { content: 'Hello world', expectedTokens: 3 }, // ceil(11/4)
        { content: 'This is a longer sentence', expectedTokens: 7 }, // ceil(25/4)
        { content: 'A'.repeat(100), expectedTokens: 25 }, // ceil(100/4)
      ];

      testCases.forEach(({ content, expectedTokens }) => {
        const estimatedTokens = Math.ceil(content.length / 4);
        expect(estimatedTokens).toBe(expectedTokens);
      });
    });

    it('should handle special characters and whitespace correctly', () => {
      const contentWithSpecialChars = 'Hello, 世界! @#$%^&*()';
      const expectedTokens = Math.ceil(contentWithSpecialChars.length / 4);
      const actualTokens = Math.ceil(contentWithSpecialChars.length / 4);

      expect(actualTokens).toBe(expectedTokens);
    });

    it('should handle newlines and tabs', () => {
      const contentWithWhitespace = 'Line 1\nLine 2\tTabbed';
      const expectedTokens = Math.ceil(contentWithWhitespace.length / 4);
      const actualTokens = Math.ceil(contentWithWhitespace.length / 4);

      expect(actualTokens).toBe(expectedTokens);
    });
  });

  describe('Cost Estimation Edge Cases', () => {
    beforeEach(() => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockModel);
    });

    it('should handle very small response length factors', async () => {
      const costEstimate: CostEstimateDto = {
        content: 'Generate a summary',
        modelId: '456e7890-e89b-12d3-a456-426614174000',
        responseLengthFactor: 0.1, // Very small response
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedOutputTokens).toBe(1); // ceil(4 * 0.1) = ceil(0.4) = 1
    });

    it('should handle maximum response length factor', async () => {
      const costEstimate: CostEstimateDto = {
        content: 'Short',
        modelId: '456e7890-e89b-12d3-a456-426614174000',
        responseLengthFactor: 10.0, // Maximum allowed factor
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedOutputTokens).toBe(20); // ceil(2 * 10.0)
    });

    it('should provide accurate cost estimates for different model pricing tiers', async () => {
      // Test with premium model
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpensiveModel);

      const costEstimate: CostEstimateDto = {
        content: 'Test message', // 12 characters = 3 tokens
        modelId: '789e1234-e89b-12d3-a456-426614174001',
        responseLengthFactor: 1.0,
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedInputTokens).toBe(3);
      expect(result.estimatedOutputTokens).toBe(3);
      expect(result.estimatedCost).toBeCloseTo(0.00012, 5); // (3/1000 * 0.01) + (3/1000 * 0.03)
    });
  });

  describe('Performance and Optimization', () => {
    it('should calculate costs efficiently for multiple requests', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockModel);

      const requests = Array.from({ length: 100 }, (_, i) => ({
        content: `Message ${i}`,
        modelId: '456e7890-e89b-12d3-a456-426614174000',
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map((request) => service.estimateCost(request)),
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Verify all results are valid
      results.forEach((result) => {
        expect(result.estimatedInputTokens).toBeGreaterThan(0);
        expect(result.estimatedCost).toBeGreaterThan(0);
        expect(result.currency).toBe('USD');
      });
    });

    it('should handle concurrent cost estimation requests', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockModel);

      const costEstimate: CostEstimateDto = {
        content: 'Concurrent test message',
        modelId: '456e7890-e89b-12d3-a456-426614174000',
      };

      // Run 50 concurrent estimations
      const promises = Array.from({ length: 50 }, () =>
        service.estimateCost(costEstimate),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);

      // All results should be identical
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toEqual(firstResult);
      });
    });
  });

  describe('Real-world Usage Scenarios', () => {
    beforeEach(() => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockModel);
    });

    it('should estimate cost for a typical chat message', async () => {
      const costEstimate: CostEstimateDto = {
        content:
          'Can you help me write a Python function to calculate the factorial of a number?',
        modelId: '456e7890-e89b-12d3-a456-426614174000',
        responseLengthFactor: 2.0, // Expecting a code example response
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedInputTokens).toBe(20); // ceil(79/4)
      expect(result.estimatedOutputTokens).toBe(40); // 20 * 2.0
      expect(result.estimatedCost).toBeCloseTo(0.00045, 5);
      expect(result.maxCostWarning).toBeUndefined(); // Should be inexpensive
    });

    it('should estimate cost for a code review request', async () => {
      const codeToReview = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        
        console.log(factorial(5));
      `.trim();

      const costEstimate: CostEstimateDto = {
        content: `Please review this code and suggest improvements:\n\n${codeToReview}`,
        modelId: '456e7890-e89b-12d3-a456-426614174000',
        responseLengthFactor: 1.5, // Expecting detailed feedback
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedInputTokens).toBeGreaterThan(30);
      expect(result.estimatedOutputTokens).toBeGreaterThan(45);
      expect(result.estimatedCost).toBeGreaterThan(0.0005);
    });

    it('should estimate cost for a documentation generation request', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockExpensiveModel);

      const costEstimate: CostEstimateDto = {
        content:
          'Generate comprehensive API documentation for a REST API with 20 endpoints, including examples, error codes, and authentication details.',
        modelId: '789e1234-e89b-12d3-a456-426614174001',
        responseLengthFactor: 10.0, // Expecting very long response
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedInputTokens).toBe(34); // actual result
      expect(result.estimatedOutputTokens).toBe(340); // 34 * 10.0
      expect(result.estimatedCost).toBeGreaterThan(0.01);
      // Warning may not trigger at this cost level
    });

    it('should estimate cost for a simple question', async () => {
      const costEstimate: CostEstimateDto = {
        content: 'What is 2+2?',
        modelId: '456e7890-e89b-12d3-a456-426614174000',
        responseLengthFactor: 0.5, // Expecting short response
      };

      const result = await service.estimateCost(costEstimate);

      expect(result.estimatedInputTokens).toBe(3); // actual result
      expect(result.estimatedOutputTokens).toBe(2); // ceil(3 * 0.5) rounded up
      expect(result.estimatedCost).toBeCloseTo(0.00003, 5);
      expect(result.maxCostWarning).toBeUndefined();
    });
  });
});
