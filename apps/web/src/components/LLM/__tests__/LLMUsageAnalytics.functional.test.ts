/**
 * LLMUsageAnalytics Functional Integration Tests
 * 
 * Simplified tests focused on core functionality validation
 * without complex component stubbing.
 */

import { describe, it, expect } from 'vitest';
import { 
  transformToTimeSeries,
  calculateProviderStats,
  calculateProviderResponseTimes,
  calculateSanitizationBreakdown,
  calculateTrend,
  generateAnalyticsInsights,
  sanitizeUsageRecords,
  validateAnalyticsData
} from '@/utils/analyticsTransformations';

// Mock data for testing utility functions
const mockUsageRecords = [
  {
    id: '1',
    provider_name: 'openai',
    model_name: 'gpt-4',
    duration_ms: 1500,
    total_cost: 0.02,
    sanitization_time_ms: 150,
    input_tokens: 100,
    output_tokens: 50,
    status: 'success',
    created_at: new Date().toISOString()
  },
  {
    id: '2', 
    provider_name: 'anthropic',
    model_name: 'claude-3',
    duration_ms: 1200,
    total_cost: 0.018,
    sanitization_time_ms: 120,
    input_tokens: 80,
    output_tokens: 45,
    status: 'success',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '3',
    provider_name: 'openai',
    model_name: 'gpt-3.5-turbo',
    duration_ms: 800,
    total_cost: 0.005,
    sanitization_time_ms: 80,
    input_tokens: 60,
    output_tokens: 30,
    status: 'success',
    created_at: new Date(Date.now() - 172800000).toISOString()
  },
  // Invalid data for testing sanitization
  {
    id: 'invalid',
    provider_name: null,
    duration_ms: -100, // Invalid negative
    total_cost: 'invalid', // Invalid type
    sanitization_time_ms: null,
    status: 'error'
  } as Record<string, unknown>
];

const mockAnalytics = [
  {
    date: new Date().toISOString().split('T')[0],
    total_requests: 150,
    total_cost: 2.5,
    avg_duration_ms: 1200
  },
  {
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    total_requests: 120,
    total_cost: 2.1,
    avg_duration_ms: 1100
  }
];

describe('LLMUsageAnalytics Functional Integration Tests', () => {
  
  describe('Data Transformation Integration', () => {
    it('transforms usage records to time series data correctly', () => {
      const result = transformToTimeSeries(mockAnalytics, 'total_requests');
      
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('values');
      expect(result.labels).toHaveLength(2);
      expect(result.values).toHaveLength(2);
      expect(result.values[0]).toBe(150);
      expect(result.values[1]).toBe(120);
    });

    it('calculates provider statistics correctly', () => {
      const validRecords = sanitizeUsageRecords(mockUsageRecords);
      const stats = calculateProviderStats(validRecords);
      
      expect(stats).toHaveLength(2); // openai and anthropic
      expect(stats[0]).toHaveProperty('name');
      expect(stats[0]).toHaveProperty('count');
      expect(stats[0]).toHaveProperty('percentage');
      expect(stats[0]).toHaveProperty('avgResponseTime');
      expect(stats[0]).toHaveProperty('totalCost');
      
      // Verify percentages add up to 100%
      const totalPercentage = stats.reduce((sum, stat) => sum + stat.percentage, 0);
      expect(totalPercentage).toBe(100);
    });

    it('calculates provider response times correctly', () => {
      const validRecords = sanitizeUsageRecords(mockUsageRecords);
      const { providers, responseTimes } = calculateProviderResponseTimes(validRecords);
      
      expect(providers).toHaveLength(2);
      expect(responseTimes).toHaveLength(2);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(responseTimes.every(time => time > 0)).toBe(true);
    });

    it('calculates sanitization breakdown correctly', () => {
      const validRecords = sanitizeUsageRecords(mockUsageRecords);
      const breakdown = calculateSanitizationBreakdown(validRecords);
      
      expect(breakdown).not.toBeNull();
      expect(breakdown).toHaveProperty('piiDetection');
      expect(breakdown).toHaveProperty('pseudonymization');
      expect(breakdown).toHaveProperty('redaction');
      expect(breakdown).toHaveProperty('total');
      
      // Verify breakdown adds up correctly (within rounding)
      const sum = breakdown!.piiDetection + breakdown!.pseudonymization + breakdown!.redaction;
      expect(Math.abs(sum - breakdown!.total)).toBeLessThanOrEqual(2); // Allow for rounding
    });

    it('calculates trends correctly', () => {
      const requestsTrend = calculateTrend(mockAnalytics, 'total_requests');
      const costTrend = calculateTrend(mockAnalytics, 'total_cost');
      
      expect(['up', 'down', 'stable']).toContain(requestsTrend);
      expect(['up', 'down', 'stable']).toContain(costTrend);
      
      // Based on mock data: requests went down (150 -> 120), cost went down (2.5 -> 2.1)
      expect(requestsTrend).toBe('down');
      expect(costTrend).toBe('down');
    });

    it('generates insights from real data', () => {
      const validRecords = sanitizeUsageRecords(mockUsageRecords);
      const insights = generateAnalyticsInsights(mockAnalytics, validRecords);
      
      expect(insights).toBeInstanceOf(Array);
      expect(insights.length).toBeGreaterThan(0);
      
      insights.forEach(insight => {
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('trend');
        expect(['performance', 'cost', 'usage']).toContain(insight.type);
        expect(['up', 'down', 'stable']).toContain(insight.trend);
      });
    });
  });

  describe('Data Sanitization and Validation', () => {
    it('sanitizes invalid usage records correctly', () => {
      const sanitized = sanitizeUsageRecords(mockUsageRecords);
      
      // Should remove the invalid record
      expect(sanitized).toHaveLength(3);
      
      // All remaining records should be valid
      sanitized.forEach(record => {
        expect(record.provider_name).toBeTruthy();
        expect(record.id).toBeTruthy();
        expect(record.duration_ms).toBeGreaterThanOrEqual(0);
        expect(record.total_cost).toBeGreaterThanOrEqual(0);
      });
    });

    it('validates analytics data structure', () => {
      expect(validateAnalyticsData(mockAnalytics)).toBe(true);
      expect(validateAnalyticsData([])).toBe(false);
      expect(validateAnalyticsData([{ invalid: 'data' }])).toBe(false);
      expect(validateAnalyticsData(null as unknown)).toBe(false);
    });

    it('handles edge cases gracefully', () => {
      // Empty data - should return empty arrays, not mock data
      expect(transformToTimeSeries([], 'total_requests')).toEqual({
        labels: [],
        values: []
      });
      
      expect(calculateProviderStats([])).toEqual([]);
      
      expect(calculateProviderResponseTimes([])).toEqual({
        providers: [],
        responseTimes: []
      });
      
      expect(calculateSanitizationBreakdown([])).toBeNull();
      
      expect(generateAnalyticsInsights([], [])).toEqual([]);
    });
  });

  describe('Performance and Scalability', () => {
    it('handles large datasets efficiently', () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockUsageRecords[0],
        id: `record-${i}`,
        duration_ms: 1000 + (i % 1000),
        total_cost: 0.01 + (i % 100) * 0.001,
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }));

      const startTime = performance.now();
      
      const sanitized = sanitizeUsageRecords(largeDataset);
      const stats = calculateProviderStats(sanitized);
      const breakdown = calculateSanitizationBreakdown(sanitized);
      const insights = generateAnalyticsInsights(mockAnalytics, sanitized);
      
      const endTime = performance.now();
      
      // Should complete within reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Results should be valid
      expect(sanitized).toHaveLength(10000);
      expect(stats).toHaveLength(1); // All openai
      expect(breakdown).not.toBeNull();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('maintains accuracy with varying data sizes', () => {
      const sizes = [1, 10, 100, 1000];
      
      sizes.forEach(size => {
        const dataset = Array.from({ length: size }, (_, i) => ({
          ...mockUsageRecords[0],
          id: `record-${i}`,
          duration_ms: 1000 + i,
          total_cost: 0.01 + i * 0.001
        }));

        const stats = calculateProviderStats(dataset);
        expect(stats[0].count).toBe(size);
        expect(stats[0].percentage).toBe(100);
        
        const breakdown = calculateSanitizationBreakdown(dataset);
        expect(breakdown).not.toBeNull();
        expect(breakdown!.total).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Robustness', () => {
    it('handles corrupted data gracefully', () => {
      const corruptedData = [
        { ...mockUsageRecords[0], duration_ms: Infinity },
        { ...mockUsageRecords[0], total_cost: NaN },
        { ...mockUsageRecords[0], provider_name: '' },
        { ...mockUsageRecords[0], id: null }
      ] as Record<string, unknown>[];

      expect(() => {
        const sanitized = sanitizeUsageRecords(corruptedData);
        calculateProviderStats(sanitized);
        calculateProviderResponseTimes(sanitized);
        calculateSanitizationBreakdown(sanitized);
      }).not.toThrow();
    });

    it('returns empty arrays for empty states (no fallback data)', () => {
      const emptyTimeSeries = transformToTimeSeries([], 'total_requests');
      expect(emptyTimeSeries.labels).toEqual([]);
      expect(emptyTimeSeries.values).toEqual([]);
      
      const emptyResponseTimes = calculateProviderResponseTimes([]);
      expect(emptyResponseTimes.providers).toEqual([]);
      expect(emptyResponseTimes.responseTimes).toEqual([]);
    });

    it('handles missing or null fields correctly', () => {
      const incompleteData = [
        { id: '1', provider_name: 'openai' }, // Missing other fields
        { id: '2', duration_ms: 1000 }, // Missing provider
        { provider_name: 'anthropic', total_cost: 0.02 } // Missing id
      ] as Record<string, unknown>[];

      const sanitized = sanitizeUsageRecords(incompleteData);
      expect(sanitized.length).toBeLessThanOrEqual(1); // Most should be filtered out
    });
  });

  describe('Real-world Data Scenarios', () => {
    it('handles typical production data patterns', () => {
      const productionLikeData = [
        // High-volume provider
        ...Array.from({ length: 100 }, (_, i) => ({
          id: `openai-${i}`,
          provider_name: 'openai',
          model_name: 'gpt-4',
          duration_ms: 800 + Math.random() * 400, // 800-1200ms range
          total_cost: 0.01 + Math.random() * 0.02, // $0.01-$0.03
          sanitization_time_ms: 50 + Math.random() * 100, // 50-150ms
          status: Math.random() > 0.05 ? 'success' : 'failed', // 5% failure rate
          created_at: new Date(Date.now() - i * 60000).toISOString()
        })),
        // Medium-volume provider
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `anthropic-${i}`,
          provider_name: 'anthropic',
          model_name: 'claude-3',
          duration_ms: 1000 + Math.random() * 500,
          total_cost: 0.015 + Math.random() * 0.025,
          sanitization_time_ms: 60 + Math.random() * 80,
          status: 'success',
          created_at: new Date(Date.now() - i * 120000).toISOString()
        })),
        // Low-volume provider
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `google-${i}`,
          provider_name: 'google',
          model_name: 'gemini-pro',
          duration_ms: 600 + Math.random() * 300,
          total_cost: 0.008 + Math.random() * 0.012,
          sanitization_time_ms: 40 + Math.random() * 60,
          status: 'success',
          created_at: new Date(Date.now() - i * 300000).toISOString()
        }))
      ];

      const sanitized = sanitizeUsageRecords(productionLikeData);
      const stats = calculateProviderStats(sanitized);
      const breakdown = calculateSanitizationBreakdown(sanitized);
      const responseTimes = calculateProviderResponseTimes(sanitized);

      // Verify realistic distributions
      expect(stats).toHaveLength(3);
      
      const openaiStats = stats.find(s => s.name === 'openai');
      expect(openaiStats?.percentage).toBeGreaterThan(70); // Should be dominant
      
      const anthropicStats = stats.find(s => s.name === 'anthropic');
      expect(anthropicStats?.percentage).toBeLessThan(30);
      expect(anthropicStats?.percentage).toBeGreaterThan(15);
      
      const googleStats = stats.find(s => s.name === 'google');
      expect(googleStats?.percentage).toBeLessThan(10);

      // Verify response times are reasonable
      expect(responseTimes.responseTimes.every(time => time > 0 && time < 2000)).toBe(true);
      
      // Verify sanitization breakdown
      expect(breakdown).not.toBeNull();
      expect(breakdown!.total).toBeGreaterThan(0);
    });
  });
});
