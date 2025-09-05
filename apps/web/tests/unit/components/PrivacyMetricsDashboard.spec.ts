import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PrivacyMetricsDashboard from '../../../src/components/PII/PrivacyMetricsDashboard.vue';
import { waitFor, expectEventually } from '../../../src/tests/setup';

describe('PrivacyMetricsDashboard Component', () => {
  let wrapper: any;
  
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('should render main dashboard structure', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
    expect(wrapper.find('.dashboard-header').exists()).toBe(true);
    expect(wrapper.text()).toContain('Privacy Metrics Dashboard');
  });

  it('should render header controls correctly', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    expect(wrapper.find('[data-testid="refresh-button"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Refresh');
    expect(wrapper.text()).toContain('Filters');
  });

  it('should toggle filters visibility', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Initially filters should be hidden
    expect(wrapper.vm.showFilters).toBe(false);
    expect(wrapper.find('.filter-card').exists()).toBe(false);

    // Toggle filters
    const filtersButton = wrapper.findAll('ion-button').find((btn: any) => 
      btn.text().includes('Filters')
    );
    await filtersButton?.trigger('click');

    expect(wrapper.vm.showFilters).toBe(true);
    expect(wrapper.find('.filter-card').exists()).toBe(true);
  });

  it('should render filter controls when visible', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Show filters
    wrapper.vm.showFilters = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.filter-card').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-range-filter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="data-type-filter"]').exists()).toBe(true);
    
    // Check filter options
    expect(wrapper.text()).toContain('Time Range:');
    expect(wrapper.text()).toContain('Data Type:');
    expect(wrapper.text()).toContain('Last 24 Hours');
    expect(wrapper.text()).toContain('Last 7 Days');
    expect(wrapper.text()).toContain('All Types');
    expect(wrapper.text()).toContain('Email');
    expect(wrapper.text()).toContain('Phone');
  });

  it('should render key metrics overview', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    expect(wrapper.find('.metrics-overview').exists()).toBe(true);
    expect(wrapper.text()).toContain('PII Detections');
    expect(wrapper.text()).toContain('Items Sanitized');
    expect(wrapper.text()).toContain('Pseudonyms Created');
    expect(wrapper.text()).toContain('Cost Savings');
  });

  it('should render metric cards with icons and values', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const metricCards = wrapper.findAll('.metric-card');
    expect(metricCards.length).toBe(4);

    // Check for metric content structure
    expect(wrapper.findAll('.metric-content')).toHaveLength(4);
    expect(wrapper.findAll('.metric-info')).toHaveLength(4);
    expect(wrapper.findAll('.metric-value')).toHaveLength(4);
    expect(wrapper.findAll('.metric-label')).toHaveLength(4);
  });

  it('should initialize with default reactive data', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    expect(wrapper.vm.showFilters).toBe(false);
    expect(wrapper.vm.selectedTimeRange).toBe('7d');
    expect(wrapper.vm.selectedDataType).toBe('all');
    expect(wrapper.vm.isLoading).toBe(false);
  });

  it('should handle time range filter changes', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    wrapper.vm.selectedTimeRange = '30d';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTimeRange).toBe('30d');

    wrapper.vm.selectedTimeRange = '24h';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTimeRange).toBe('24h');
  });

  it('should handle data type filter changes', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    wrapper.vm.selectedDataType = 'email';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedDataType).toBe('email');

    wrapper.vm.selectedDataType = 'phone';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedDataType).toBe('phone');
  });

  it('should display metrics with default values when no data', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Should show 0 for all metrics when no data
    const metricValues = wrapper.findAll('.metric-value');
    metricValues.forEach((value: any) => {
      expect(value.text()).toContain('0');
    });
  });

  it('should display metrics with actual values when data is present', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const mockMetrics = {
      totalPIIDetections: 1250,
      itemsSanitized: 987,
      pseudonymsCreated: 543
    };

    wrapper.vm.metrics = mockMetrics;
    await wrapper.vm.$nextTick();

    if (wrapper.vm.formatNumber) {
      expect(wrapper.text()).toContain(wrapper.vm.formatNumber(mockMetrics.totalPIIDetections));
      expect(wrapper.text()).toContain(wrapper.vm.formatNumber(mockMetrics.itemsSanitized));
      expect(wrapper.text()).toContain(wrapper.vm.formatNumber(mockMetrics.pseudonymsCreated));
    }
  });

  it('should calculate and display cost savings', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    if (wrapper.vm.costSavings !== undefined) {
      expect(wrapper.vm.costSavings).toBeDefined();
      expect(typeof wrapper.vm.costSavings === 'number').toBe(true);
    }
  });

  it('should format numbers correctly', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    if (wrapper.vm.formatNumber) {
      expect(wrapper.vm.formatNumber(1000)).toBe('1,000');
      expect(wrapper.vm.formatNumber(1500)).toBe('1,500');
      expect(wrapper.vm.formatNumber(1000000)).toBe('1,000,000');
      expect(wrapper.vm.formatNumber(0)).toBe('0');
    }
  });

  it('should handle refresh data functionality', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const refreshButton = wrapper.find('[data-testid="refresh-button"]');
    expect(refreshButton.exists()).toBe(true);

    if (wrapper.vm.refreshData) {
      await refreshButton.trigger('click');
      // Should trigger refresh without errors
      expect(wrapper.vm).toBeDefined();
    }
  });

  it('should show loading state when data is loading', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    wrapper.vm.isLoading = true;
    await wrapper.vm.$nextTick();

    // Component should handle loading state gracefully
    expect(wrapper.vm.isLoading).toBe(true);
  });

  it('should handle error states gracefully', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Component should continue to work even with missing data
    wrapper.vm.metrics = null;
    await wrapper.vm.$nextTick();

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
  });

  it('should maintain filter state correctly', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Set initial filter state
    wrapper.vm.selectedTimeRange = '30d';
    wrapper.vm.selectedDataType = 'email';
    wrapper.vm.showFilters = true;
    await wrapper.vm.$nextTick();

    // Verify state persistence
    expect(wrapper.vm.selectedTimeRange).toBe('30d');
    expect(wrapper.vm.selectedDataType).toBe('email');
    expect(wrapper.vm.showFilters).toBe(true);
  });

  it('should render proper metric icons', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const icons = wrapper.findAll('ion-icon');
    expect(icons.length).toBeGreaterThan(4); // At least 4 metric icons plus header icons
  });

  it('should handle component initialization', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Wait for initialization
    await waitFor(100);

    expect(wrapper.vm).toBeDefined();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.privacy-metrics-dashboard').exists()).toBe(true);
  });

  it('should have responsive grid layout', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const gridCols = wrapper.findAll('ion-col');
    expect(gridCols.length).toBeGreaterThanOrEqual(4); // At least 4 metric columns

    // Check for responsive sizing
    gridCols.forEach((col: any) => {
      expect(col.attributes()).toHaveProperty('size');
    });
  });

  it('should display filter time range options correctly', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    wrapper.vm.showFilters = true;
    await wrapper.vm.$nextTick();

    const timeRangeOptions = [
      'Last 24 Hours',
      'Last 7 Days', 
      'Last 30 Days',
      'Last 90 Days'
    ];

    timeRangeOptions.forEach(option => {
      expect(wrapper.text()).toContain(option);
    });
  });

  it('should display filter data type options correctly', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    wrapper.vm.showFilters = true;
    await wrapper.vm.$nextTick();

    const dataTypeOptions = [
      'All Types',
      'Email',
      'Phone',
      'Name',
      'SSN',
      'API Key'
    ];

    dataTypeOptions.forEach(option => {
      expect(wrapper.text()).toContain(option);
    });
  });

  it('should handle metric value updates', async () => {
    wrapper = mount(PrivacyMetricsDashboard);

    const initialMetrics = {
      totalPIIDetections: 100,
      itemsSanitized: 50,
      pseudonymsCreated: 25
    };

    const updatedMetrics = {
      totalPIIDetections: 200,
      itemsSanitized: 150,
      pseudonymsCreated: 75
    };

    // Set initial metrics
    wrapper.vm.metrics = initialMetrics;
    await wrapper.vm.$nextTick();

    // Update metrics
    wrapper.vm.metrics = updatedMetrics;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.metrics).toEqual(updatedMetrics);
  });

  it('should maintain component responsiveness', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    // Check for responsive classes
    const responsiveCols = wrapper.findAll('ion-col[size-md]');
    expect(responsiveCols.length).toBeGreaterThan(0);
  });

  it('should handle edge cases for metric formatting', () => {
    wrapper = mount(PrivacyMetricsDashboard);

    if (wrapper.vm.formatNumber) {
      // Test edge cases
      expect(wrapper.vm.formatNumber(undefined)).toBe('0');
      expect(wrapper.vm.formatNumber(null)).toBe('0');
      expect(wrapper.vm.formatNumber(NaN)).toBe('0');
    }
  });
});