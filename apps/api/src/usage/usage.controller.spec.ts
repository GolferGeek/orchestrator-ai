import { Test, TestingModule } from '@nestjs/testing';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageStatsResponseDto } from '../dto/llm-evaluation.dto';

describe('UsageController', () => {
  let controller: UsageController;
  let usageService: UsageService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockUsageStats: UsageStatsResponseDto = {
    userId: 'user-123',
    dateRange: {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    },
    totalRequests: 50,
    totalTokens: 15000,
    totalCost: 0.75,
    averageResponseTime: 1200,
    averageUserRating: 4.2,
    byProvider: [
      {
        provider: {
          id: 'provider-1',
          name: 'OpenAI',
          apiBaseUrl: 'https://api.openai.com/v1',
          authType: 'api_key',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        requests: 30,
        tokens: 9000,
        cost: 0.45,
        avgRating: 4.5,
      },
      {
        provider: {
          id: 'provider-2',
          name: 'Anthropic',
          apiBaseUrl: 'https://api.anthropic.com',
          authType: 'api_key',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        requests: 20,
        tokens: 6000,
        cost: 0.30,
        avgRating: 3.8,
      },
    ],
    byModel: [
      {
        model: {
          id: 'model-1',
          providerId: 'provider-1',
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
        },
        requests: 25,
        tokens: 7500,
        cost: 0.50,
        avgRating: 4.3,
      },
    ],
    dailyStats: [
      {
        date: '2024-01-15',
        requests: 10,
        tokens: 3000,
        cost: 0.15,
        avgResponseTime: 1100,
      },
      {
        date: '2024-01-16',
        requests: 8,
        tokens: 2400,
        cost: 0.12,
        avgResponseTime: 1250,
      },
    ],
  };

  const mockCostSummary = {
    total_cost: 0.75,
    total_tokens: 15000,
    total_requests: 50,
    period: { start_date: '2024-01-01', end_date: '2024-01-31' },
    breakdown: [
      {
        key: 'OpenAI',
        cost: 0.45,
        tokens: 9000,
        requests: 30,
        percentage: 60,
      },
      {
        key: 'Anthropic',
        cost: 0.30,
        tokens: 6000,
        requests: 20,
        percentage: 40,
      },
    ],
    trends: [
      { date: '2024-01-15', cost: 0.15, tokens: 3000, requests: 10 },
      { date: '2024-01-16', cost: 0.12, tokens: 2400, requests: 8 },
    ],
  };

  const mockModelPerformance = [
    {
      model: mockUsageStats.byModel![0].model,
      metrics: {
        usage_count: 25,
        avg_user_rating: 4.3,
        avg_speed_rating: 4.1,
        avg_accuracy_rating: 4.2,
        avg_response_time_ms: 1150,
        avg_cost_per_request: 0.02,
        total_cost: 0.50,
        total_tokens: 7500,
        cost_efficiency_score: 0.85,
        performance_score: 4.1,
      },
      rank: 1,
    },
  ];

  const mockSpendingInsights = {
    analysis_period: {
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      days: 30,
    },
    spending_summary: {
      total_spent: 0.75,
      daily_average: 0.025,
      projected_monthly: 0.75,
      most_expensive_day: '2024-01-15',
      most_expensive_amount: 0.15,
    },
    usage_patterns: {
      peak_hours: [9, 10, 14, 15],
      busiest_day_of_week: 'Tuesday',
      avg_requests_per_day: 1.67,
      avg_tokens_per_request: 300,
    },
    model_insights: {
      most_used_model: 'GPT-4o',
      most_expensive_model: 'Claude 3 Opus',
      best_value_model: 'GPT-4o Mini',
      underutilized_models: ['Claude 3 Haiku'],
    },
    recommendations: [
      {
        type: 'cost_optimization',
        title: 'Consider using more cost-effective models',
        description: 'Switch to GPT-4o Mini for simpler tasks to reduce costs by up to 80%',
        potential_savings: 0.225,
        priority: 'medium',
      },
    ],
  };

  const mockBudgetStatus = {
    current_month: {
      spent: 85.50,
      budget: 100,
      percentage_used: 85.5,
      days_remaining: 15,
      projected_total: 95.00,
    },
    alerts: [
      {
        level: 'warning' as const,
        message: 'You have used 75% of your monthly budget',
        threshold: 75,
        current_value: 85.5,
      },
    ],
    recommendations: [
      {
        action: 'switch_to_cheaper_models',
        description: 'Use more cost-effective models for routine tasks',
        estimated_savings: 17.10,
      },
    ],
  };

  const mockUsageService = {
    getUserStats: jest.fn().mockResolvedValue(mockUsageStats),
    getCostSummary: jest.fn().mockResolvedValue(mockCostSummary),
    getModelPerformance: jest.fn().mockResolvedValue(mockModelPerformance),
    getSpendingInsights: jest.fn().mockResolvedValue(mockSpendingInsights),
    exportUsageData: jest.fn().mockResolvedValue([{ summary: mockUsageStats }]),
    getBudgetStatus: jest.fn().mockResolvedValue(mockBudgetStatus),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageController],
      providers: [
        {
          provide: UsageService,
          useValue: mockUsageService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsageController>(UsageController);
    usageService = module.get<UsageService>(UsageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserStats', () => {
    it('should return usage statistics for the current user', async () => {
      const result = await controller.getUserStats(mockUser);

      expect(result).toEqual(mockUsageStats);
      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123', {
        startDate: undefined,
        endDate: undefined,
        providerId: undefined,
        modelId: undefined,
        includeDetails: undefined,
        granularity: 'daily',
      });
    });

    it('should pass query parameters to the service', async () => {
      await controller.getUserStats(
        mockUser,
        '2024-01-01',
        '2024-01-31',
        'provider-1',
        'model-1',
        true,
        'weekly'
      );

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        providerId: 'provider-1',
        modelId: 'model-1',
        includeDetails: true,
        granularity: 'weekly',
      });
    });

    it('should use default granularity when not specified', async () => {
      await controller.getUserStats(mockUser);

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123', 
        expect.objectContaining({ granularity: 'daily' })
      );
    });

    it('should handle includeDetails parameter correctly', async () => {
      await controller.getUserStats(mockUser, undefined, undefined, undefined, undefined, true);

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ includeDetails: true })
      );
    });
  });

  describe('getCostSummary', () => {
    it('should return cost summary for the current user', async () => {
      const result = await controller.getCostSummary(mockUser);

      expect(result).toEqual(mockCostSummary);
      expect(usageService.getCostSummary).toHaveBeenCalledWith('user-123', {
        startDate: undefined,
        endDate: undefined,
        groupBy: 'provider',
      });
    });

    it('should pass query parameters to the service', async () => {
      await controller.getCostSummary(
        mockUser,
        '2024-01-01',
        '2024-01-31',
        'model'
      );

      expect(usageService.getCostSummary).toHaveBeenCalledWith('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'model',
      });
    });

    it('should use default groupBy when not specified', async () => {
      await controller.getCostSummary(mockUser);

      expect(usageService.getCostSummary).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ groupBy: 'provider' })
      );
    });

    it('should handle date groupBy option', async () => {
      await controller.getCostSummary(mockUser, undefined, undefined, 'date');

      expect(usageService.getCostSummary).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ groupBy: 'date' })
      );
    });
  });

  describe('getModelPerformance', () => {
    it('should return model performance metrics for the current user', async () => {
      const result = await controller.getModelPerformance(mockUser);

      expect(result).toEqual(mockModelPerformance);
      expect(usageService.getModelPerformance).toHaveBeenCalledWith('user-123', {
        startDate: undefined,
        endDate: undefined,
        minUsage: 1,
        sortBy: 'rating',
      });
    });

    it('should pass query parameters to the service', async () => {
      await controller.getModelPerformance(
        mockUser,
        '2024-01-01',
        '2024-01-31',
        5,
        'cost'
      );

      expect(usageService.getModelPerformance).toHaveBeenCalledWith('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        minUsage: 5,
        sortBy: 'cost',
      });
    });

    it('should use default values when parameters not specified', async () => {
      await controller.getModelPerformance(mockUser);

      expect(usageService.getModelPerformance).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ 
          minUsage: 1, 
          sortBy: 'rating' 
        })
      );
    });

    it('should handle different sort options', async () => {
      await controller.getModelPerformance(mockUser, undefined, undefined, undefined, 'speed');

      expect(usageService.getModelPerformance).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ sortBy: 'speed' })
      );
    });
  });

  describe('getSpendingInsights', () => {
    it('should return spending insights for the current user', async () => {
      const result = await controller.getSpendingInsights(mockUser);

      expect(result).toEqual(mockSpendingInsights);
      expect(usageService.getSpendingInsights).toHaveBeenCalledWith('user-123', 30);
    });

    it('should pass custom lookback days to the service', async () => {
      await controller.getSpendingInsights(mockUser, 7);

      expect(usageService.getSpendingInsights).toHaveBeenCalledWith('user-123', 7);
    });

    it('should use default lookback days when not specified', async () => {
      await controller.getSpendingInsights(mockUser);

      expect(usageService.getSpendingInsights).toHaveBeenCalledWith('user-123', 30);
    });

    it('should return comprehensive insights structure', async () => {
      const result = await controller.getSpendingInsights(mockUser);

      expect(result).toHaveProperty('analysis_period');
      expect(result).toHaveProperty('spending_summary');
      expect(result).toHaveProperty('usage_patterns');
      expect(result).toHaveProperty('model_insights');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.analysis_period).toHaveProperty('start_date');
      expect(result.analysis_period).toHaveProperty('end_date');
      expect(result.analysis_period).toHaveProperty('days');
    });
  });

  describe('exportUsageData', () => {
    it('should export usage data in JSON format by default', async () => {
      const result = await controller.exportUsageData(mockUser);

      expect(result).toEqual([{ summary: mockUsageStats }]);
      expect(usageService.exportUsageData).toHaveBeenCalledWith('user-123', {
        format: 'json',
        startDate: undefined,
        endDate: undefined,
        includeDetails: undefined,
      });
    });

    it('should export usage data in CSV format when requested', async () => {
      mockUsageService.exportUsageData.mockResolvedValueOnce('csv,data,here');

      const result = await controller.exportUsageData(
        mockUser,
        'csv'
      );

      expect(result).toBe('csv,data,here');
      expect(usageService.exportUsageData).toHaveBeenCalledWith('user-123', {
        format: 'csv',
        startDate: undefined,
        endDate: undefined,
        includeDetails: undefined,
      });
    });

    it('should pass query parameters to the service', async () => {
      await controller.exportUsageData(
        mockUser,
        'json',
        '2024-01-01',
        '2024-01-31',
        true
      );

      expect(usageService.exportUsageData).toHaveBeenCalledWith('user-123', {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        includeDetails: true,
      });
    });

    it('should use default format when not specified', async () => {
      await controller.exportUsageData(mockUser);

      expect(usageService.exportUsageData).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ format: 'json' })
      );
    });
  });

  describe('getBudgetStatus', () => {
    it('should return budget status for the current user', async () => {
      const result = await controller.getBudgetStatus(mockUser);

      expect(result).toEqual(mockBudgetStatus);
      expect(usageService.getBudgetStatus).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should pass monthly budget to the service when provided', async () => {
      await controller.getBudgetStatus(mockUser, 150);

      expect(usageService.getBudgetStatus).toHaveBeenCalledWith('user-123', 150);
    });

    it('should return proper budget status structure', async () => {
      const result = await controller.getBudgetStatus(mockUser);

      expect(result).toHaveProperty('current_month');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('recommendations');
      
      expect(result.current_month).toHaveProperty('spent');
      expect(result.current_month).toHaveProperty('budget');
      expect(result.current_month).toHaveProperty('percentage_used');
      expect(result.current_month).toHaveProperty('days_remaining');
      expect(result.current_month).toHaveProperty('projected_total');
      
      expect(Array.isArray(result.alerts)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle alerts structure correctly', async () => {
      const result = await controller.getBudgetStatus(mockUser);

      if (result.alerts.length > 0) {
        const alert = result.alerts[0];
        expect(alert).toHaveProperty('level');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('threshold');
        expect(alert).toHaveProperty('current_value');
        expect(['info', 'warning', 'danger']).toContain(alert.level);
      }
    });

    it('should handle recommendations structure correctly', async () => {
      const result = await controller.getBudgetStatus(mockUser);

      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        expect(recommendation).toHaveProperty('action');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('estimated_savings');
        expect(typeof recommendation.estimated_savings).toBe('number');
      }
    });
  });

  describe('Authentication and Authorization', () => {
    it('should be protected by JWT auth guard', () => {
      const guards = Reflect.getMetadata('__guards__', UsageController);
      expect(guards).toContain(JwtAuthGuard);
    });

    it('should extract user information correctly from JWT token', async () => {
      const result = await controller.getUserStats(mockUser);

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully in getUserStats', async () => {
      const error = new Error('Service unavailable');
      mockUsageService.getUserStats.mockRejectedValueOnce(error);

      await expect(controller.getUserStats(mockUser)).rejects.toThrow('Service unavailable');
    });

    it('should handle service errors gracefully in getCostSummary', async () => {
      const error = new Error('Database connection failed');
      mockUsageService.getCostSummary.mockRejectedValueOnce(error);

      await expect(controller.getCostSummary(mockUser)).rejects.toThrow('Database connection failed');
    });

    it('should handle service errors gracefully in exportUsageData', async () => {
      const error = new Error('Export failed');
      mockUsageService.exportUsageData.mockRejectedValueOnce(error);

      await expect(controller.exportUsageData(mockUser)).rejects.toThrow('Export failed');
    });
  });

  describe('Query Parameter Validation', () => {
    it('should accept valid date formats', async () => {
      await controller.getUserStats(mockUser, '2024-01-01', '2024-01-31');

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123',
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      );
    });

    it('should accept valid UUID formats for provider and model IDs', async () => {
      const providerId = '123e4567-e89b-12d3-a456-426614174000';
      const modelId = '456e7890-e89b-12d3-a456-426614174001';

      await controller.getUserStats(mockUser, undefined, undefined, providerId, modelId);

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123',
        expect.objectContaining({
          providerId,
          modelId,
        })
      );
    });

    it('should accept valid granularity options', async () => {
      await controller.getUserStats(mockUser, undefined, undefined, undefined, undefined, undefined, 'monthly');

      expect(usageService.getUserStats).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ granularity: 'monthly' })
      );
    });

    it('should accept valid groupBy options for cost summary', async () => {
      await controller.getCostSummary(mockUser, undefined, undefined, 'date');

      expect(usageService.getCostSummary).toHaveBeenCalledWith('user-123',
        expect.objectContaining({ groupBy: 'date' })
      );
    });
  });
});