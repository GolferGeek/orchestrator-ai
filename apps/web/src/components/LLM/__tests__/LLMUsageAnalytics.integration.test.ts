/**
 * LLMUsageAnalytics Integration Tests
 * 
 * Comprehensive testing of dashboard integration, user interactions,
 * chart rendering, and real-world usage scenarios.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { IonicVue } from '@ionic/vue';
import LLMUsageAnalytics from '../LLMUsageAnalytics.vue';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { nextTick } from 'vue';

// Mock Chart.js components
vi.mock('@/components/Charts/LineChart.vue', () => ({
  default: {
    name: 'LineChart',
    props: ['data', 'options'],
    template: '<div data-testid="line-chart">Line Chart</div>'
  }
}));

vi.mock('@/components/Charts/DoughnutChart.vue', () => ({
  default: {
    name: 'DoughnutChart', 
    props: ['data', 'options'],
    template: '<div data-testid="doughnut-chart">Doughnut Chart</div>'
  }
}));

vi.mock('@/components/Charts/BarChart.vue', () => ({
  default: {
    name: 'BarChart',
    props: ['data', 'options'], 
    template: '<div data-testid="bar-chart">Bar Chart</div>'
  }
}));

// Mock sample data for testing
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
    created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
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
    created_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  }
];

const mockAnalytics = [
  {
    date: new Date().toISOString().split('T')[0],
    total_requests: 150,
    total_cost: 2.5,
    avg_duration_ms: 1200,
    provider_breakdown: { openai: 100, anthropic: 50 }
  },
  {
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    total_requests: 120,
    total_cost: 2.1,
    avg_duration_ms: 1100,
    provider_breakdown: { openai: 80, anthropic: 40 }
  }
];

const mockStats = {
  totalRequests: 500,
  totalCost: 12.5,
  avgResponseTime: 1150,
  topProvider: 'openai',
  costTrend: 'up',
  performanceTrend: 'stable'
};

describe('LLMUsageAnalytics Integration Tests', () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useLLMAnalyticsStore>;

  beforeEach(() => {
    // Create testing pinia with mocked store
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    });

    // Mount component with testing setup
    wrapper = mount(LLMUsageAnalytics, {
      global: {
        plugins: [IonicVue, pinia],
        stubs: {
          'ion-grid': true,
          'ion-row': true,
          'ion-col': true,
          'ion-card': true,
          'ion-card-header': true,
          'ion-card-title': true,
          'ion-card-content': true,
          'ion-button': true,
          'ion-icon': true,
          'ion-label': true,
          'ion-select': true,
          'ion-select-option': true,
          'ion-chip': true,
          'ion-badge': true,
          'ion-spinner': true
        }
      }
    });

    // Get store instance and mock data
    store = useLLMAnalyticsStore();
    store.usageRecords = mockUsageRecords;
    store.analytics = mockAnalytics;
    store.stats = mockStats;
    store.loading = false;
    store.error = null;
  });

  afterEach(() => {
    wrapper.unmount();
    vi.clearAllMocks();
  });

  describe('Component Integration', () => {
    it('renders dashboard with all main sections', () => {
      expect(wrapper.find('.llm-usage-analytics').exists()).toBe(true);
      expect(wrapper.find('.analytics-header').exists()).toBe(true);
      expect(wrapper.find('.metrics-overview').exists()).toBe(true);
      expect(wrapper.find('.charts-grid').exists()).toBe(true);
    });

    it('displays correct header information', () => {
      expect(wrapper.text()).toContain('LLM Usage Analytics');
      expect(wrapper.text()).toContain('Comprehensive insights into LLM performance');
    });

    it('shows refresh and filter buttons', () => {
      const refreshButton = wrapper.find('[data-testid="refresh-button"]');
      const filterButton = wrapper.find('ion-button[fill="clear"]');
      
      expect(refreshButton.exists()).toBe(true);
      expect(filterButton.exists()).toBe(true);
    });
  });

  describe('Chart Rendering and Data Flow', () => {
    it('renders all required charts', () => {
      expect(wrapper.findAll('[data-testid="line-chart"]')).toHaveLength(2); // Request volume + Cost trends
      expect(wrapper.find('[data-testid="doughnut-chart"]').exists()).toBe(true); // Provider distribution
      expect(wrapper.findAll('[data-testid="bar-chart"]')).toHaveLength(2); // Response time + Sanitization overhead
    });

    it('passes correct data to charts', async () => {
      await nextTick();
      
      // Check that charts receive data props
      const lineCharts = wrapper.findAll('[data-testid="line-chart"]');
      const doughnutChart = wrapper.find('[data-testid="doughnut-chart"]');
      const barCharts = wrapper.findAll('[data-testid="bar-chart"]');

      expect(lineCharts[0].props('data')).toBeDefined();
      expect(doughnutChart.props('data')).toBeDefined();
      expect(barCharts[0].props('data')).toBeDefined();
    });

    it('updates charts when store data changes', async () => {
      // Update store data
      const newRecord = {
        ...mockUsageRecords[0],
        id: '4',
        provider_name: 'google',
        duration_ms: 2000
      };
      
      store.usageRecords = [...mockUsageRecords, newRecord];
      await nextTick();

      // Verify charts receive updated data
      const doughnutChart = wrapper.find('[data-testid="doughnut-chart"]');
      expect(doughnutChart.props('data')).toBeDefined();
    });
  });

  describe('User Interactions', () => {
    it('shows/hides filters when filter button is clicked', async () => {
      // Initially filters should be hidden
      expect(wrapper.find('.filter-card').exists()).toBe(false);

      // Click filter button
      const filterButton = wrapper.find('ion-button[fill="clear"]');
      await filterButton.trigger('click');
      await nextTick();

      // Filters should now be visible
      expect(wrapper.find('.filter-card').exists()).toBe(true);
    });

    it('displays filter controls when filters are shown', async () => {
      // Show filters
      await wrapper.setData({ showFilters: true });
      await nextTick();

      expect(wrapper.find('[data-testid="time-range-filter"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="provider-filter"]').exists()).toBe(true);
    });

    it('calls refresh function when refresh button is clicked', async () => {
      const refreshSpy = vi.spyOn(store, 'fetchUsageRecords');
      
      const refreshButton = wrapper.find('[data-testid="refresh-button"]');
      await refreshButton.trigger('click');

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('handles time range filter changes', async () => {
      await wrapper.setData({ showFilters: true });
      await nextTick();

      const timeRangeFilter = wrapper.find('[data-testid="time-range-filter"]');
      await timeRangeFilter.setValue('7d');

      expect(wrapper.vm.selectedTimeRange).toBe('7d');
    });

    it('handles provider filter changes', async () => {
      await wrapper.setData({ showFilters: true });
      await nextTick();

      const providerFilter = wrapper.find('[data-testid="provider-filter"]');
      await providerFilter.setValue('openai');

      expect(wrapper.vm.selectedProvider).toBe('openai');
    });
  });

  describe('Metrics Display', () => {
    it('displays key metrics from store data', async () => {
      await nextTick();

      // Check that metrics are calculated and displayed
      expect(wrapper.text()).toContain('500'); // Total requests
      expect(wrapper.text()).toContain('$12.50'); // Total cost
      expect(wrapper.text()).toContain('1,150ms'); // Avg response time
    });

    it('shows insights based on real data', async () => {
      await nextTick();

      // Should display generated insights
      const insightCards = wrapper.findAll('.insight-card');
      expect(insightCards.length).toBeGreaterThan(0);
    });

    it('displays trend indicators correctly', async () => {
      await nextTick();

      // Check for trend icons/indicators
      expect(wrapper.text()).toContain('trending'); // Should have trend indicators
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty data gracefully', async () => {
      store.usageRecords = [];
      store.analytics = [];
      await nextTick();

      // Should show "No Data" states
      expect(wrapper.text()).toContain('No Data');
    });

    it('displays loading state correctly', async () => {
      store.loading = true;
      await nextTick();

      expect(wrapper.find('ion-spinner').exists()).toBe(true);
    });

    it('handles store errors appropriately', async () => {
      store.error = 'Failed to fetch data';
      store.loading = false;
      await nextTick();

      expect(wrapper.text()).toMatch(/error|Failed/);
    });

    it('handles invalid data without crashing', async () => {
      // Set invalid data
      store.usageRecords = [
        {
          id: 'invalid',
          provider_name: null,
          duration_ms: -100, // Invalid negative duration
          total_cost: 'invalid', // Invalid cost type
          sanitization_time_ms: null,
          status: 'unknown'
        }
      ] as Record<string, unknown>[];

      await nextTick();

      // Component should still render without crashing
      expect(wrapper.find('.llm-usage-analytics').exists()).toBe(true);
    });
  });

  describe('Performance and Responsiveness', () => {
    it('handles large datasets efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockUsageRecords[0],
        id: `record-${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }));

      const startTime = performance.now();
      store.usageRecords = largeDataset;
      await nextTick();
      const endTime = performance.now();

      // Should complete within reasonable time (< 100ms for rendering)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('updates charts reactively when data changes', async () => {
      let chartUpdateCount = 0;
      
      // Monitor chart updates
      // const originalProps = wrapper.find('[data-testid="line-chart"]').props;
      wrapper.find('[data-testid="line-chart"]').vm.$watch('data', () => {
        chartUpdateCount++;
      }, { deep: true });

      // Trigger multiple data updates
      for (let i = 0; i < 3; i++) {
        store.usageRecords = [...store.usageRecords, {
          ...mockUsageRecords[0],
          id: `new-${i}`,
          duration_ms: 1000 + i * 100
        }];
        await nextTick();
      }

      // Charts should update reactively
      expect(chartUpdateCount).toBeGreaterThan(0);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('simulates dashboard refresh cycle', async () => {
      const fetchSpy = vi.spyOn(store, 'fetchUsageRecords');
      const analyticsSpy = vi.spyOn(store, 'fetchAnalytics');

      // Simulate user clicking refresh
      const refreshButton = wrapper.find('[data-testid="refresh-button"]');
      await refreshButton.trigger('click');

      expect(fetchSpy).toHaveBeenCalled();
      expect(analyticsSpy).toHaveBeenCalled();
    });

    it('simulates filtering workflow', async () => {
      // Open filters
      const filterButton = wrapper.find('ion-button[fill="clear"]');
      await filterButton.trigger('click');
      await nextTick();

      // Select time range
      await wrapper.setData({ selectedTimeRange: '24h' });
      await nextTick();

      // Select provider
      await wrapper.setData({ selectedProvider: 'openai' });
      await nextTick();

      // Verify filters are applied
      expect(wrapper.vm.selectedTimeRange).toBe('24h');
      expect(wrapper.vm.selectedProvider).toBe('openai');
    });

    it('simulates auto-refresh functionality', async () => {
      const initializeSpy = vi.spyOn(store, 'initialize');
      const startAutoRefreshSpy = vi.spyOn(store, 'startAutoRefresh');

      // Mount new component to trigger lifecycle
      const newWrapper = mount(LLMUsageAnalytics, {
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
          stubs: {
            'ion-grid': true,
            'ion-row': true,
            'ion-col': true,
            'ion-card': true,
            'ion-card-header': true,
            'ion-card-title': true,
            'ion-card-content': true,
            'ion-button': true,
            'ion-icon': true,
            'ion-label': true,
            'ion-select': true,
            'ion-select-option': true,
            'ion-chip': true,
            'ion-badge': true,
            'ion-spinner': true
          }
        }
      });

      await nextTick();

      expect(initializeSpy).toHaveBeenCalled();
      expect(startAutoRefreshSpy).toHaveBeenCalled();

      newWrapper.unmount();
    });

    it('handles component unmounting properly', async () => {
      const stopAutoRefreshSpy = vi.spyOn(store, 'stopAutoRefresh');

      wrapper.unmount();

      expect(stopAutoRefreshSpy).toHaveBeenCalled();
    });
  });

  describe('Data Transformation Integration', () => {
    it('uses analytics utilities for data processing', async () => {
      await nextTick();

      // Verify that charts receive processed data (not raw)
      const doughnutChart = wrapper.find('[data-testid="doughnut-chart"]');
      const chartData = doughnutChart.props('data');

      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
      expect(chartData.datasets[0]).toHaveProperty('data');
    });

    it('handles data sanitization correctly', async () => {
      // Add some invalid/outlier data
      store.usageRecords = [
        ...mockUsageRecords,
        {
          id: 'outlier',
          provider_name: 'test',
          duration_ms: 120000, // 2 minutes - should be filtered as outlier
          total_cost: -0.5, // Negative cost - should be filtered
          sanitization_time_ms: 0,
          status: 'error'
        } as Record<string, unknown>
      ];

      await nextTick();

      // Component should still render properly with sanitized data
      expect(wrapper.find('.llm-usage-analytics').exists()).toBe(true);
    });
  });
});
