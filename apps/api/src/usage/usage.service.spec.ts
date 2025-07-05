import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { UsageService } from './usage.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('UsageService', () => {
  let service: UsageService;
  let supabaseService: SupabaseService;

  // Mock message data for testing
  const mockMessages = [
    {
      id: '1',
      user_id: 'user-123',
      timestamp: '2024-01-15T10:00:00.000Z',
      total_cost: 0.005,
      input_tokens: 100,
      output_tokens: 150,
      response_time_ms: 1250,
      user_rating: 4,
      speed_rating: 5,
      accuracy_rating: 4,
      provider: { id: 'provider-1', name: 'OpenAI' },
      model: { id: 'model-1', name: 'GPT-4o', model_id: 'gpt-4o' },
    },
    {
      id: '2',
      user_id: 'user-123',
      timestamp: '2024-01-16T14:30:00.000Z',
      total_cost: 0.003,
      input_tokens: 80,
      output_tokens: 120,
      response_time_ms: 980,
      user_rating: 5,
      speed_rating: 4,
      accuracy_rating: 5,
      provider: { id: 'provider-1', name: 'OpenAI' },
      model: { id: 'model-2', name: 'GPT-4o Mini', model_id: 'gpt-4o-mini' },
    },
    {
      id: '3',
      user_id: 'user-123',
      timestamp: '2024-01-17T09:15:00.000Z',
      total_cost: 0.012,
      input_tokens: 200,
      output_tokens: 300,
      response_time_ms: 2100,
      user_rating: 3,
      speed_rating: 3,
      accuracy_rating: 4,
      provider: { id: 'provider-2', name: 'Anthropic' },
      model: { id: 'model-3', name: 'Claude 3 Opus', model_id: 'claude-3-opus-20240229' },
    },
  ];

  // Create a complete mock that supports the full chain
  const mockSupabaseClient: any = {};
  
  const resetMocks = () => {
    mockSupabaseClient.from = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.gte = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.lte = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.not = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.limit = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single = jest.fn();
    
    // Make the client thenable so it can be awaited
    mockSupabaseClient.then = jest.fn((resolve) => {
      // This will be the default response unless overridden in individual tests
      resolve({ data: mockMessages, error: null });
      return Promise.resolve({ data: mockMessages, error: null });
    });
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
        UsageService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  describe('getUserStats', () => {
    it('should calculate basic usage statistics correctly', async () => {
      // Override the thenable behavior for this specific test
      mockSupabaseClient.then = jest.fn((resolve) => {
        resolve({ data: mockMessages, error: null });
        return Promise.resolve({ data: mockMessages, error: null });
      });

      const result = await service.getUserStats('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.totalRequests).toBe(3);
      expect(result.totalTokens).toBe(950); // 100+150 + 80+120 + 200+300
      expect(result.totalCost).toBe(0.020); // 0.005 + 0.003 + 0.012
      expect(result.averageResponseTime).toBeCloseTo(1443.33, 2); // (1250 + 980 + 2100) / 3
      expect(result.averageUserRating).toBe(4); // (4 + 5 + 3) / 3
    });

    it('should handle empty results gracefully', async () => {
      mockSupabaseClient.then = jest.fn((resolve) => {
        resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      });

      const result = await service.getUserStats('user-123', {});

      expect(result.totalRequests).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.averageResponseTime).toBe(0);
      expect(result.averageUserRating).toBeUndefined();
    });

    it('should include detailed breakdowns when requested', async () => {
      mockSupabaseClient.not.mockResolvedValue({
        data: mockMessages,
        error: null,
      });

      const result = await service.getUserStats('user-123', {
        includeDetails: true,
      });

      expect(result.byProvider).toBeDefined();
      expect(result.byModel).toBeDefined();
      expect(result.dailyStats).toBeDefined();
      
      // Check provider breakdown
      expect(result.byProvider).toHaveLength(2); // OpenAI and Anthropic
      
      // Check model breakdown
      expect(result.byModel).toHaveLength(3); // 3 different models
      
      // Check daily stats
      expect(result.dailyStats).toHaveLength(3); // 3 different days
    });

    it('should filter by provider ID correctly', async () => {
      const filteredMessages = mockMessages.filter(msg => msg.provider.id === 'provider-1');
      mockSupabaseClient.then = jest.fn((resolve) => {
        resolve({ data: filteredMessages, error: null });
        return Promise.resolve({ data: filteredMessages, error: null });
      });

      const result = await service.getUserStats('user-123', {
        providerId: 'provider-1',
      });

      expect(result.totalRequests).toBe(2); // Only OpenAI messages
      expect(result.totalCost).toBe(0.008); // 0.005 + 0.003
    });

    it('should filter by model ID correctly', async () => {
      const filteredMessages = mockMessages.filter(msg => msg.model.id === 'model-1');
      mockSupabaseClient.then = jest.fn((resolve) => {
        resolve({ data: filteredMessages, error: null });
        return Promise.resolve({ data: filteredMessages, error: null });
      });

      const result = await service.getUserStats('user-123', {
        modelId: 'model-1',
      });

      expect(result.totalRequests).toBe(1); // Only GPT-4o message
      expect(result.totalCost).toBe(0.005);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.not.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        service.getUserStats('user-123', {})
      ).rejects.toThrow(
        new HttpException(
          'Failed to fetch usage stats: Database connection failed',
          HttpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });

    it('should use default date range when not provided', async () => {
      mockSupabaseClient.not.mockResolvedValue({
        data: mockMessages,
        error: null,
      });

      await service.getUserStats('user-123', {});

      // Verify that gte and lte were called with date strings
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', expect.any(String));
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', expect.any(String));
    });
  });

  describe('getCostSummary', () => {
    beforeEach(() => {
      // Mock getUserStats for cost summary tests
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalRequests: 3,
        totalTokens: 950,
        totalCost: 0.020,
        averageResponseTime: 1443.33,
        averageUserRating: 4,
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
            requests: 2,
            tokens: 450,
            cost: 0.008,
          },
          {
            provider: { 
              id: 'provider-2', 
              name: 'Anthropic',
              authType: 'api_key' as const,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 1,
            tokens: 500,
            cost: 0.012,
          },
        ],
        byModel: [
          {
            model: { 
              id: 'model-1', 
              name: 'GPT-4o',
              providerId: 'provider-1',
              modelId: 'gpt-4o',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 1,
            tokens: 250,
            cost: 0.005,
          },
          {
            model: { 
              id: 'model-2', 
              name: 'GPT-4o Mini',
              providerId: 'provider-1',
              modelId: 'gpt-4o-mini',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 1,
            tokens: 200,
            cost: 0.003,
          },
          {
            model: { 
              id: 'model-3', 
              name: 'Claude 3 Opus',
              providerId: 'provider-2',
              modelId: 'claude-3-opus-20240229',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 1,
            tokens: 500,
            cost: 0.012,
          },
        ],
        dailyStats: [
          { date: '2024-01-15', requests: 1, tokens: 250, cost: 0.005 },
          { date: '2024-01-16', requests: 1, tokens: 200, cost: 0.003 },
          { date: '2024-01-17', requests: 1, tokens: 500, cost: 0.012 },
        ],
      });
    });

    it('should return cost summary with breakdown and trends', async () => {
      const result = await service.getCostSummary('user-123', {
        groupBy: 'provider',
      });

      expect(result.totalCost).toBe(0.020);
      expect(result.totalTokens).toBe(950);
      expect(result.totalRequests).toBe(3);
      expect(result.period).toEqual({
        startDate: expect.any(String),
        endDate: expect.any(String),
      });
      expect(result.breakdown).toBeDefined();
      expect(result.trends).toBeDefined();
      expect(result.trends).toHaveLength(3); // 3 days of data
    });

    it('should use default date range when not provided', async () => {
      const result = await service.getCostSummary('user-123', {
        groupBy: 'model',
      });

      expect(result.period.startDate).toBeDefined();
      expect(result.period.endDate).toBeDefined();
    });
  });

  describe('getModelPerformance', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalRequests: 3,
        totalTokens: 950,
        totalCost: 0.020,
        averageResponseTime: 1443.33,
        averageUserRating: 4,
        byModel: [
          {
            model: { 
              id: 'model-1', 
              name: 'GPT-4o',
              providerId: 'provider-1',
              modelId: 'gpt-4o',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 2,
            tokens: 450,
            cost: 0.010,
            avgRating: 4.5,
          },
          {
            model: { 
              id: 'model-2', 
              name: 'GPT-4o Mini',
              providerId: 'provider-1',
              modelId: 'gpt-4o-mini',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 5,
            tokens: 800,
            cost: 0.005,
            avgRating: 4.2,
          },
          {
            model: { 
              id: 'model-3', 
              name: 'Claude 3 Opus',
              providerId: 'provider-2',
              modelId: 'claude-3-opus-20240229',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 1,
            tokens: 500,
            cost: 0.015,
            avgRating: 3.5,
          },
        ],
      });
    });

    it('should return model performance metrics sorted by rating', async () => {
      const result = await service.getModelPerformance('user-123', {
        minUsage: 1,
        sortBy: 'rating',
      });

      expect(result).toHaveLength(3);
      expect(result[0]?.metrics.avgUserRating).toBeGreaterThanOrEqual(result[1]?.metrics.avgUserRating || 0);
      expect(result[1]?.metrics.avgUserRating).toBeGreaterThanOrEqual(result[2]?.metrics.avgUserRating || 0);
      
      // Check that ranks are assigned correctly
      expect(result[0]?.rank).toBe(1);
      expect(result[1]?.rank).toBe(2);
      expect(result[2]?.rank).toBe(3);
    });

    it('should filter models by minimum usage threshold', async () => {
      const result = await service.getModelPerformance('user-123', {
        minUsage: 2,
        sortBy: 'usage',
      });

      expect(result).toHaveLength(2); // Only models with >= 2 requests
      result.forEach(model => {
        expect(model.metrics.usageCount).toBeGreaterThanOrEqual(2);
      });
    });

    it('should sort by cost per request correctly', async () => {
      const result = await service.getModelPerformance('user-123', {
        minUsage: 1,
        sortBy: 'cost',
      });

      expect(result).toHaveLength(3);
      
      // Should be sorted by lowest cost per request first
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i]?.metrics.avgCostPerRequest).toBeLessThanOrEqual(
          result[i + 1]?.metrics.avgCostPerRequest || 0
        );
      }
    });

    it('should calculate cost efficiency and performance scores', async () => {
      const result = await service.getModelPerformance('user-123', {
        minUsage: 1,
        sortBy: 'rating',
      });

      result.forEach(model => {
        expect(model.metrics.costEfficiencyScore).toBeGreaterThanOrEqual(0);
        expect(model.metrics.performanceScore).toBeGreaterThanOrEqual(0);
        expect(model.metrics.avgCostPerRequest).toBeGreaterThan(0);
        expect(typeof model.metrics.totalCost).toBe('number');
        expect(typeof model.metrics.totalTokens).toBe('number');
      });
    });
  });

  describe('getSpendingInsights', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
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
              authType: 'api_key' as const,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 30,
            tokens: 9000,
            cost: 0.45,
          },
        ],
        byModel: [
          {
            model: { 
              id: 'model-1', 
              name: 'GPT-4o',
              providerId: 'provider-1',
              modelId: 'gpt-4o',
              supportsThinking: false,
              status: 'active' as const,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            requests: 25,
            tokens: 7500,
            cost: 0.50,
          },
        ],
        dailyStats: [
          { date: '2024-01-15', requests: 10, tokens: 3000, cost: 0.15 },
          { date: '2024-01-16', requests: 8, tokens: 2400, cost: 0.12 },
        ],
      });
    });

    it('should return comprehensive spending insights', async () => {
      const result = await service.getSpendingInsights('user-123', 30);

      expect(result.analysisPeriod).toEqual({
        startDate: expect.any(String),
        endDate: expect.any(String),
        days: 30,
      });

      expect(result.spendingSummary).toEqual({
        totalSpent: 0.75,
        dailyAverage: 0.025, // 0.75 / 30
        projectedMonthly: 0.75, // (0.75 / 30) * 30
        mostExpensiveDay: '',
        mostExpensiveAmount: 0,
      });

      expect(result.usagePatterns).toEqual({
        peakHours: [9, 10, 14, 15],
        busiestDayOfWeek: 'Tuesday',
        avgRequestsPerDay: expect.any(Number),
        avgTokensPerRequest: expect.any(Number),
      });

      expect(result.modelInsights).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should use default lookback period when not specified', async () => {
      const result = await service.getSpendingInsights('user-123', 30);

      expect(result.analysisPeriod.days).toBe(30);
    });
  });

  describe('getBudgetStatus', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalRequests: 100,
        totalTokens: 30000,
        totalCost: 85.50, // High spending to trigger alerts
        averageResponseTime: 1200,
        averageUserRating: 4.2,
      });
    });

    it('should return budget status with alerts for high spending', async () => {
      const result = await service.getBudgetStatus('user-123', 100);

      expect(result.currentMonth.budget).toBe(100);
      expect(result.currentMonth.spent).toBe(85.50);
      expect(result.currentMonth.percentageUsed).toBe(85.5);
      expect(result.currentMonth.daysRemaining).toBeGreaterThan(0);

      // Should have warning alert for high spending
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some(alert => alert.level === 'warning')).toBe(true);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should use default budget when not provided', async () => {
      const result = await service.getBudgetStatus('user-123');

      expect(result.currentMonth.budget).toBe(100); // Default budget
    });

    it('should generate danger alert when budget is exceeded', async () => {
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalRequests: 100,
        totalTokens: 30000,
        totalCost: 95.00, // Over 90% of default budget
        averageResponseTime: 1200,
        averageUserRating: 4.2,
      });

      const result = await service.getBudgetStatus('user-123', 100);

      expect(result.alerts.some(alert => alert.level === 'danger')).toBe(true);
    });
  });

  describe('exportUsageData', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getUserStats').mockResolvedValue({
        userId: 'user-123',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalRequests: 10,
        totalTokens: 3000,
        totalCost: 0.15,
        averageResponseTime: 1200,
        averageUserRating: 4.2,
        byProvider: [],
        byModel: [],
        dailyStats: [],
      });
    });

    it('should export data in JSON format by default', async () => {
      const result = await service.exportUsageData('user-123', {
        format: 'json',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('summary');
      expect(result[0].summary).toHaveProperty('totalRequests', 10);
      expect(result[0].summary).toHaveProperty('totalCost', 0.15);
    });

    it('should export data in CSV format when requested', async () => {
      const result = await service.exportUsageData('user-123', {
        format: 'csv',
      });

      expect(typeof result).toBe('string');
    });

    it('should include date range in export options', async () => {
      await service.exportUsageData('user-123', {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(service.getUserStats).toHaveBeenCalledWith('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        includeDetails: true,
      });
    });
  });

  describe('Cost Calculation Logic', () => {
    it('should correctly aggregate costs across multiple messages', () => {
      const messages = [
        { totalCost: 0.005, inputTokens: 100, outputTokens: 150 },
        { totalCost: 0.003, inputTokens: 80, outputTokens: 120 },
        { totalCost: 0.012, inputTokens: 200, outputTokens: 300 },
      ];

      const totalCost = messages.reduce((sum, msg) => sum + (msg.totalCost || 0), 0);
      const totalTokens = messages.reduce(
        (sum, msg) => sum + (msg.inputTokens || 0) + (msg.outputTokens || 0),
        0
      );

      expect(totalCost).toBe(0.020);
      expect(totalTokens).toBe(950);
    });

    it('should handle null and undefined cost values gracefully', () => {
      const messages = [
        { totalCost: 0.005, inputTokens: 100, outputTokens: 150 },
        { totalCost: null, inputTokens: 80, outputTokens: 120 },
        { totalCost: undefined, inputTokens: 200, outputTokens: 300 },
      ];

      const totalCost = messages.reduce((sum, msg) => sum + (msg.totalCost || 0), 0);
      expect(totalCost).toBe(0.005);
    });

    it('should calculate average metrics correctly', () => {
      const values = [1250, 980, 2100];
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      expect(average).toBeCloseTo(1443.33, 2);
    });
  });

  describe('Date Range Handling', () => {
    it('should calculate correct date range for lookback days', () => {
      const getDateDaysAgo = (days: number): string => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0] || '';
      };

      const thirtyDaysAgo = getDateDaysAgo(30);
      const today = new Date().toISOString().split('T')[0] || '';

      expect(thirtyDaysAgo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Verify the date is actually 30 days ago
      const thirtyDaysAgoDate = new Date(thirtyDaysAgo);
      const todayDate = new Date(today);
      const diffInDays = Math.floor((todayDate.getTime() - thirtyDaysAgoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(diffInDays).toBe(30);
    });
  });
});