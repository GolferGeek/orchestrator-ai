import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationWrapperService, EvaluationConfig, EvaluationCriteria } from './evaluation-wrapper.service';

// Mock quick-lru to avoid ES module issues in Jest
jest.mock('quick-lru', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: 0,
    maxSize: 1000,
    values: jest.fn(() => [])
  }));
});

describe('EvaluationWrapperService', () => {
  let service: EvaluationWrapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EvaluationWrapperService,
          useFactory: () => new EvaluationWrapperService()
        }
      ],
    }).compile();

    service = module.get<EvaluationWrapperService>(EvaluationWrapperService);
  });

  afterEach(() => {
    if (service) {
      service.reset();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = service.getConfig();
      expect(config.enableMetrics).toBe(true);
      expect(config.enableErrorTracking).toBe(true);
      expect(config.enableResponseValidation).toBe(true);
      expect(config.enablePerformanceMonitoring).toBe(true);
      expect(config.maxCacheSize).toBe(1000);
      expect(config.evaluationThresholds?.minScore).toBe(7.0);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: EvaluationConfig = {
        enableMetrics: false,
        maxCacheSize: 500,
        evaluationThresholds: {
          minScore: 8.0,
          maxResponseTime: 3000,
          maxErrorRate: 0.02
        }
      };

      const customService = new EvaluationWrapperService();
      const config = customService.getConfig();
      
      expect(config.enableMetrics).toBe(false);
      expect(config.maxCacheSize).toBe(500);
      expect(config.evaluationThresholds?.minScore).toBe(8.0);
      expect(config.evaluationThresholds?.maxResponseTime).toBe(3000);
      expect(config.evaluationThresholds?.maxErrorRate).toBe(0.02);
    });

    it('should update configuration', () => {
      const newConfig = {
        enableMetrics: false,
        maxCacheSize: 2000
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.enableMetrics).toBe(false);
      expect(config.maxCacheSize).toBe(2000);
      expect(config.enableErrorTracking).toBe(true); // Should retain existing values
    });
  });

  describe('Task Recording', () => {
    it('should record task start', () => {
      service.recordTaskStart('task1', 'testMethod');
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.activeTasks).toBe(1);
    });

    it('should record successful task completion', () => {
      service.recordTaskStart('task1', 'testMethod');
      service.recordTaskCompletion('task1', 'testMethod', 1000, true);
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.averageResponseTime).toBe(1000);
      expect(metrics.successRate).toBe(100);
    });

    it('should record failed task completion', () => {
      const error = new Error('Test error');
      
      service.recordTaskStart('task1', 'testMethod');
      service.recordTaskCompletion('task1', 'testMethod', 500, false, error);
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should not record when metrics disabled', () => {
      service.updateConfig({ enableMetrics: false });
      
      service.recordTaskStart('task1', 'testMethod');
      service.recordTaskCompletion('task1', 'testMethod', 1000, true);
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.requestCount).toBe(0);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate basic metrics', () => {
      // Record multiple tasks
      service.recordTaskStart('task1', 'method1');
      service.recordTaskCompletion('task1', 'method1', 1000, true);
      
      service.recordTaskStart('task2', 'method2');
      service.recordTaskCompletion('task2', 'method2', 2000, true);
      
      service.recordTaskStart('task3', 'method3');
      service.recordTaskCompletion('task3', 'method3', 500, false, new Error('Test error'));
      
      const metrics = service.getEvaluationMetrics();
      
      expect(metrics.requestCount).toBe(3);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate average response time', () => {
      service.recordTaskStart('task1', 'method1');
      service.recordTaskCompletion('task1', 'method1', 1000, true);
      
      service.recordTaskStart('task2', 'method2');
      service.recordTaskCompletion('task2', 'method2', 2000, true);
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.averageResponseTime).toBe(1500);
    });

    it('should calculate percentiles', async () => {
      // Add multiple response times
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
             for (let i = 0; i < responseTimes.length; i++) {
         service.recordTaskStart(`task${i}`, 'method');
         service.recordTaskCompletion(`task${i}`, 'method', responseTimes[i]!, true);
       }
      
      const metrics = service.getEvaluationMetrics();
      
      expect(metrics.p95ResponseTime).toBeGreaterThan(900); // Should be around 950
      expect(metrics.p99ResponseTime).toBeGreaterThan(990); // Should be around 990
    });

    it('should calculate throughput per minute', async () => {
      // Wait a small amount to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      service.recordTaskStart('task1', 'method1');
      service.recordTaskCompletion('task1', 'method1', 1000, true);
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.throughputPerMinute).toBeGreaterThan(0);
    });

    it('should maintain task history when metrics enabled', () => {
      service.updateConfig({ enableMetrics: true });
      
      // Add many response times to test trimming
      for (let i = 0; i < 1200; i++) {
        service.recordTaskStart(`task${i}`, 'method');
        service.recordTaskCompletion(`task${i}`, 'method', 100 + i, true);
      }
      
      const metrics = service.getEvaluationMetrics();
      expect(metrics.completedTasks).toBe(1200);
      // Response timings should be trimmed to 1000 entries
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Error Tracking', () => {
    it('should track errors', () => {
      const error = new Error('Test error message');
      error.stack = 'Error stack trace';
      
      service.trackError('task1', 'testMethod', error, 'high');
      
      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByType['Error']).toBe(1);
      expect(stats.errorsBySeverity['high']).toBe(1);
      expect(stats.recentErrors).toHaveLength(1);
      
             const recentError = stats.recentErrors[0]!;
       expect(recentError.errorType).toBe('Error');
       expect(recentError.errorMessage).toBe('Test error message');
       expect(recentError.severity).toBe('high');
       expect(recentError.context.method).toBe('testMethod');
       expect(recentError.context.taskId).toBe('task1');
       expect(recentError.resolved).toBe(false);
    });

    it('should track multiple error types', () => {
      service.trackError('task1', 'method1', new Error('Error 1'), 'low');
      service.trackError('task2', 'method2', new TypeError('Type Error'), 'medium');
      service.trackError('task3', 'method3', new RangeError('Range Error'), 'high');
      service.trackError('task4', 'method4', new Error('Error 2'), 'critical');
      
      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByType['Error']).toBe(2);
      expect(stats.errorsByType['TypeError']).toBe(1);
      expect(stats.errorsByType['RangeError']).toBe(1);
      expect(stats.errorsBySeverity['low']).toBe(1);
      expect(stats.errorsBySeverity['medium']).toBe(1);
      expect(stats.errorsBySeverity['high']).toBe(1);
      expect(stats.errorsBySeverity['critical']).toBe(1);
    });

    it('should not track errors when disabled', () => {
      service.updateConfig({ enableErrorTracking: false });
      
      service.trackError('task1', 'testMethod', new Error('Test error'));
      
      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.recentErrors).toHaveLength(0);
    });

    it('should calculate error rate', () => {
      service.recordTaskStart('task1', 'method1');
      service.recordTaskCompletion('task1', 'method1', 1000, true);
      
      service.recordTaskStart('task2', 'method2');
      service.recordTaskCompletion('task2', 'method2', 500, false, new Error('Test error'));
      
      const stats = service.getErrorStatistics();
      expect(stats.errorRate).toBe(0.5); // 1 error out of 2 requests
    });
  });

  describe('Response Evaluation', () => {
    it('should evaluate response against criteria', async () => {
      const criteria: EvaluationCriteria[] = [
        {
          name: 'response_completeness',
          weight: 0.4,
          score: 0,
          passed: false,
          description: 'Response completeness check'
        },
        {
          name: 'response_accuracy',
          weight: 0.6,
          score: 0,
          passed: false,
          description: 'Response accuracy check'
        }
      ];

      const response = {
        success: true,
        result: 'This is a comprehensive test response with good content.'
      };

      const result = await service.evaluateResponse(response, criteria);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.criteria).toHaveLength(2);
      expect(result.feedback).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.metadata?.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should return default result when evaluation disabled', async () => {
      service.updateConfig({ enableResponseValidation: false });
      
      const criteria: EvaluationCriteria[] = [
        {
          name: 'test_criterion',
          weight: 1.0,
          score: 0,
          passed: false
        }
      ];

      const result = await service.evaluateResponse({}, criteria);
      
      expect(result.score).toBe(10);
      expect(result.passed).toBe(true);
      expect(result.feedback).toBe('Evaluation disabled');
    });
  });

  describe('Response Validation', () => {
    it('should validate valid response', () => {
      const response = {
        success: true,
        result: 'Valid response'
      };

      const validation = service.validateResponse(response);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
      expect(validation.score).toBe(10);
    });

    it('should detect null response', () => {
      const validation = service.validateResponse(null);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
             expect(validation.errors[0]!.field).toBe('response');
       expect(validation.errors[0]!.code).toBe('NULL_RESPONSE');
    });

    it('should detect missing error details in failed response', () => {
      const response = {
        success: false
        // Missing error details
      };

      const validation = service.validateResponse(response);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]?.field).toBe('error');
      expect(validation.errors[0]?.code).toBe('MISSING_ERROR_DETAILS');
    });

    it('should warn about missing success indicator', () => {
      const response = {
        data: 'some data'
        // Missing success indicator or result field
      };

      const validation = service.validateResponse(response);
      
      expect(validation.valid).toBe(true); // Only warnings, no errors
      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0]?.field).toBe('response');
    });

    it('should validate against schema', () => {
      const response = {
        name: 'John'
        // Missing required 'age' field
      };

      const schema = {
        required: ['name', 'age']
      };

      const validation = service.validateResponse(response, schema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]?.field).toBe('age');
      expect(validation.errors[0]?.code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should return valid when validation disabled', () => {
      service.updateConfig({ enableResponseValidation: false });
      
      const validation = service.validateResponse(null);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats.metrics).toBeDefined();
      expect(stats.metrics.size).toBe(0);
      expect(stats.metrics.size).toBeDefined();
      expect(stats.errorTracking).toBeDefined();
      expect(stats.errorTracking.size).toBe(0);
      expect(stats.errorTracking.size).toBeDefined();
    });

    it('should cache metrics', () => {
      // First call should create cache entry
      const metrics1 = service.getEvaluationMetrics();
      const stats1 = service.getCacheStats();
      expect(stats1.metrics.size).toBe(1);
      
      // Second call within same minute should use cache
      const metrics2 = service.getEvaluationMetrics();
      expect(metrics1.timestamp).toEqual(metrics2.timestamp);
    });

    it('should reset all data', () => {
      // Add some data
      service.recordTaskStart('task1', 'method1');
      service.recordTaskCompletion('task1', 'method1', 1000, true);
      service.trackError('task2', 'method2', new Error('Test error'));
      
      // Verify data exists
      const metricsBefore = service.getEvaluationMetrics();
      const statsBefore = service.getErrorStatistics();
      expect(metricsBefore.requestCount).toBe(1);
      expect(statsBefore.totalErrors).toBe(1);
      
      // Reset
      service.reset();
      
      // Verify data is cleared
      const metricsAfter = service.getEvaluationMetrics();
      const statsAfter = service.getErrorStatistics();
      expect(metricsAfter.requestCount).toBe(0);
      expect(statsAfter.totalErrors).toBe(0);
      
      const cacheStats = service.getCacheStats();
      expect(cacheStats.metrics.size).toBe(1); // New metrics entry created
      expect(cacheStats.errorTracking.size).toBe(0);
    });
  });

  describe('Private Method Testing (via public interface)', () => {
    it('should evaluate completeness correctly', async () => {
      const criteria: EvaluationCriteria[] = [
        {
          name: 'response_completeness',
          weight: 1.0,
          score: 0,
          passed: false
        }
      ];

      // Test string response
      const stringResult = await service.evaluateResponse('Short', criteria);
      expect(stringResult.criteria[0]?.score).toBe(4); // Short string

      const longStringResult = await service.evaluateResponse('This is a longer response with more content', criteria);
      expect(longStringResult.criteria[0]?.score).toBe(8); // Longer string

      // Test object response
      const objectResult = await service.evaluateResponse({ a: 1, b: 2, c: 3 }, criteria);
      expect(objectResult.criteria[0]?.score).toBe(8); // Object with multiple keys
    });

    it('should evaluate accuracy correctly', async () => {
      const criteria: EvaluationCriteria[] = [
        {
          name: 'response_accuracy',
          weight: 1.0,
          score: 0,
          passed: false
        }
      ];

      // Test successful response
      const successResult = await service.evaluateResponse({ success: true }, criteria);
      expect(successResult.criteria[0]?.score).toBe(8);

      // Test error response
      const errorResult = await service.evaluateResponse({ error: 'Something went wrong' }, criteria);
      expect(errorResult.criteria[0]?.score).toBe(3);
    });

    it('should evaluate clarity correctly', async () => {
      const criteria: EvaluationCriteria[] = [
        {
          name: 'response_clarity',
          weight: 1.0,
          score: 0,
          passed: false
        }
      ];

      // Test well-structured response
      const clearResult = await service.evaluateResponse('This is a clear response with proper punctuation.', criteria);
      expect(clearResult.criteria[0]?.score).toBeGreaterThan(6);

      // Test unclear response
      const unclearResult = await service.evaluateResponse('unclear', criteria);
      expect(unclearResult.criteria[0]?.score).toBeLessThan(6);
    });

    it('should generate appropriate feedback and recommendations', async () => {
      const criteria: EvaluationCriteria[] = [
        {
          name: 'response_completeness',
          weight: 0.5,
          score: 0,
          passed: false
        },
        {
          name: 'response_accuracy',
          weight: 0.5,
          score: 0,
          passed: false
        }
      ];

      const result = await service.evaluateResponse('Short', criteria);
      
      expect(result.feedback).toContain('criteria');
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations?.length).toBeGreaterThan(0);
    });
  });
}); 