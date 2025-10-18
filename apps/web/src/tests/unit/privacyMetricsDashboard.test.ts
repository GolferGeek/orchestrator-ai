import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import { createApp } from 'vue';
import PrivacyMetricsDashboard from '@/components/PII/PrivacyMetricsDashboard.vue';
import { usePrivacyDashboardStore } from '@/stores/privacyDashboardStore';

// Create a minimal Vue app for testing
const createWrapper = (props = {}) => {
  const app = createApp({});
  app.use(IonicVue);
  
  return mount(PrivacyMetricsDashboard, {
    props,
    global: {
      plugins: [IonicVue]
    }
  });
};

describe('PrivacyMetricsDashboard.vue', () => {
  let wrapper: VueWrapper<unknown>;
  let store: ReturnType<typeof usePrivacyMetricsStore>;

  beforeEach(() => {
    // Initialize Pinia
    const pinia = createPinia();
    setActivePinia(pinia);
    
    wrapper = createWrapper();
    store = usePrivacyDashboardStore();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Component Rendering', () => {
    it('renders the main dashboard structure', () => {
      expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
      expect(wrapper.find('.dashboard-header').exists()).toBe(true);
    });

    it('displays the dashboard title', () => {
      const header = wrapper.find('.dashboard-header');
      expect(header.text()).toContain('Privacy Metrics Dashboard');
    });

    it('displays refresh control', () => {
      expect(wrapper.find('[data-testid="refresh-button"]').exists()).toBe(true);
    });
  });

  describe('Loading States', () => {
    it('displays loading content when data is loading', async () => {
      store.isLoading = true;
      await wrapper.vm.$nextTick();
      
      // Should still render the basic structure even when loading
      expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles error states gracefully', async () => {
      store.error = 'Test error message';
      await wrapper.vm.$nextTick();
      
      // Component should still render even with errors
      expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
    });
  });

  describe('Basic Functionality', () => {
    it('has reactive filter values', () => {
      expect(wrapper.vm.selectedTimeRange).toBe('24h');
      expect(wrapper.vm.selectedDataType).toBe('all');
    });

    it('has refresh method', () => {
      expect(typeof wrapper.vm.refreshData).toBe('function');
    });

    it('has formatting methods', () => {
      expect(typeof wrapper.vm.formatNumber).toBe('function');
      expect(typeof wrapper.vm.formatCurrency).toBe('function');
      expect(typeof wrapper.vm.formatTime).toBe('function');
    });
  });

  describe('Health Status Methods', () => {
    it('returns correct health colors for different statuses', () => {
      expect(wrapper.vm.getHealthColor('operational')).toBe('success');
      expect(wrapper.vm.getHealthColor('degraded')).toBe('warning');
      expect(wrapper.vm.getHealthColor('down')).toBe('danger');
      expect(wrapper.vm.getHealthColor(undefined)).toBe('medium');
    });

    it('formats health status correctly', () => {
      expect(wrapper.vm.formatHealthStatus('operational')).toBe('Operational');
      expect(wrapper.vm.formatHealthStatus('degraded')).toBe('Degraded');
      expect(wrapper.vm.formatHealthStatus('down')).toBe('Down');
      expect(wrapper.vm.formatHealthStatus(undefined)).toBe('Unknown');
    });
  });

  describe('Cost Analysis Methods', () => {
    it('calculates cost per detection with valid data', () => {
      store.metrics = {
        totalPIIDetections: 100,
        totalCostSavings: 1000
      };
      
      const result = wrapper.vm.calculateCostPerDetection();
      expect(result).toBe(1); // (1000 * 0.1) / 100 = 1
    });

    it('handles zero detections gracefully', () => {
      store.metrics = {
        totalPIIDetections: 0,
        totalCostSavings: 1000
      };
      
      const result = wrapper.vm.calculateCostPerDetection();
      expect(result).toBe(0);
    });

    it('calculates ROI with valid data', () => {
      store.metrics = {
        totalCostSavings: 1000
      };
      
      const result = wrapper.vm.calculateROI();
      expect(result).toBe(400); // ((1000 - 200) / 200) * 100 = 400%
    });

    it('handles missing cost data for ROI', () => {
      store.metrics = {
        totalCostSavings: 0
      };
      
      const result = wrapper.vm.calculateROI();
      expect(result).toBe(0);
    });
  });

  describe('Data Integration', () => {
    it('integrates with dashboard store', () => {
      expect(store).toBeDefined();
      expect(wrapper.vm.metrics).toBeDefined();
      expect(wrapper.vm.isLoading).toBeDefined();
      expect(wrapper.vm.error).toBeDefined();
    });

    it('handles store state changes', async () => {
      // Test that component reacts to store changes
      store.isLoading = true;
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.isLoading).toBe(true);

      store.isLoading = false;
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.isLoading).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined metrics gracefully', () => {
      store.metrics = undefined;
      
      // Should not throw errors
      expect(() => wrapper.vm.calculateCostPerDetection()).not.toThrow();
      expect(() => wrapper.vm.calculateROI()).not.toThrow();
      
      expect(wrapper.vm.calculateCostPerDetection()).toBe(0);
      expect(wrapper.vm.calculateROI()).toBe(0);
    });

    it('handles missing system health data', () => {
      store.systemHealth = undefined;
      
      // Should not throw errors
      expect(() => wrapper.vm.getOverallHealthColor()).not.toThrow();
      expect(wrapper.vm.getOverallHealthColor()).toBe('medium');
    });
  });
});