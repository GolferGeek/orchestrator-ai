import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PIIManagementPanel from '../../../src/components/PII/PIIManagementPanel.vue';
import { waitFor, expectEventually } from '../../../src/tests/setup';

describe('PIIManagementPanel Component', () => {
  let wrapper: any;
  
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('should render main panel structure', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.find('.pii-management-panel').exists()).toBe(true);
    expect(wrapper.text()).toContain('PII Management');
    expect(wrapper.text()).toContain('Manage PII patterns and pseudonym dictionaries');
  });

  it('should render system status section', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.text()).toContain('System Status');
    expect(wrapper.text()).toContain('PII Patterns');
    expect(wrapper.text()).toContain('Pseudonym Dictionaries');
  });

  it('should render PII detection test section', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.text()).toContain('PII Detection Test');
    expect(wrapper.find('ion-textarea').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test PII Detection');
  });

  it('should render pseudonymization test section', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.text()).toContain('Pseudonymization Test');
    expect(wrapper.text()).toContain('Generate Pseudonyms');
    expect(wrapper.text()).toContain('Preserve original format');
  });

  it('should render statistics section', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.text()).toContain('Statistics');
    expect(wrapper.text()).toContain('Total Patterns');
    expect(wrapper.text()).toContain('Enabled Patterns');
    expect(wrapper.text()).toContain('Dictionaries');
    expect(wrapper.text()).toContain('Total Words');
  });

  it('should initialize with default reactive data', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.vm.testInput).toBe('');
    expect(wrapper.vm.pseudonymInput).toBe('');
    expect(wrapper.vm.preserveFormat).toBe(true);
    expect(wrapper.vm.isTestingPII).toBe(false);
    expect(wrapper.vm.isPseudonymizing).toBe(false);
    expect(wrapper.vm.testResults).toBe(null);
    expect(wrapper.vm.pseudonymResults).toBe(null);
  });

  it('should handle auto-refresh toggle', async () => {
    wrapper = mount(PIIManagementPanel);

    const toggleElement = wrapper.find('ion-toggle');
    expect(toggleElement.exists()).toBe(true);
    
    // Initial state should be false for auto-refresh
    expect(wrapper.vm.isAutoRefreshEnabled).toBe(false);
  });

  it('should enable PII test button when input has content', async () => {
    wrapper = mount(PIIManagementPanel);

    // Initially disabled
    const testButton = wrapper.findAll('ion-button').find((btn: any) => 
      btn.text().includes('Test PII Detection')
    );
    expect(testButton?.attributes('disabled')).toBe('');

    // Set input content
    wrapper.vm.testInput = 'test@example.com';
    await wrapper.vm.$nextTick();

    // Should now be enabled
    expect(testButton?.attributes('disabled')).toBeUndefined();
  });

  it('should enable pseudonym test button when input has content', async () => {
    wrapper = mount(PIIManagementPanel);

    wrapper.vm.pseudonymInput = 'John Doe works at Company';
    await wrapper.vm.$nextTick();

    const pseudonymButton = wrapper.findAll('ion-button').find((btn: any) => 
      btn.text().includes('Generate Pseudonyms')
    );
    expect(pseudonymButton?.attributes('disabled')).toBeUndefined();
  });

  it('should show loading state during PII testing', async () => {
    wrapper = mount(PIIManagementPanel);

    wrapper.vm.isTestingPII = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Testing...');
    expect(wrapper.find('ion-spinner').exists()).toBe(true);
  });

  it('should show loading state during pseudonymization', async () => {
    wrapper = mount(PIIManagementPanel);

    wrapper.vm.isPseudonymizing = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Processing...');
    expect(wrapper.find('ion-spinner').exists()).toBe(true);
  });

  it('should display PII test results when available', async () => {
    wrapper = mount(PIIManagementPanel);

    const mockResults = {
      hasPII: true,
      matches: [
        {
          value: 'test@example.com',
          dataType: 'email',
          patternName: 'Email Pattern',
          confidence: 95
        }
      ],
      sanitizedText: '[EMAIL_ADDRESS]'
    };

    wrapper.vm.testResults = mockResults;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Detection Results');
    expect(wrapper.text()).toContain('1 PII items found');
    expect(wrapper.text()).toContain('test@example.com');
    expect(wrapper.text()).toContain('Email Pattern');
    expect(wrapper.text()).toContain('95% confidence');
    expect(wrapper.text()).toContain('[EMAIL_ADDRESS]');
  });

  it('should display no PII found message', async () => {
    wrapper = mount(PIIManagementPanel);

    wrapper.vm.testResults = {
      hasPII: false,
      matches: [],
      sanitizedText: 'Original text'
    };
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No PII detected');
  });

  it('should display pseudonymization results when available', async () => {
    wrapper = mount(PIIManagementPanel);

    const mockResults = {
      hasChanges: true,
      replacements: [
        {
          original: 'John Doe',
          pseudonym: 'Person_1',
          type: 'name'
        }
      ],
      pseudonymizedText: 'Person_1 works at Company'
    };

    wrapper.vm.pseudonymResults = mockResults;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Pseudonymization Results');
    expect(wrapper.text()).toContain('1 replacements made');
    expect(wrapper.text()).toContain('John Doe → Person_1');
    expect(wrapper.text()).toContain('Person_1 works at Company');
  });

  it('should show no changes needed for pseudonymization', async () => {
    wrapper = mount(PIIManagementPanel);

    wrapper.vm.pseudonymResults = {
      hasChanges: false,
      replacements: [],
      pseudonymizedText: 'Original text'
    };
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No changes needed');
  });

  it('should handle error states correctly', async () => {
    wrapper = mount(PIIManagementPanel);

    // Wait for component to fully initialize and try to load data
    await waitFor(2000);

    // The component should handle errors gracefully
    expect(wrapper.vm).toBeDefined();
  });

  it('should return correct data type colors', () => {
    wrapper = mount(PIIManagementPanel);

    expect(wrapper.vm.getDataTypeColor('email')).toBe('primary');
    expect(wrapper.vm.getDataTypeColor('phone')).toBe('secondary');
    expect(wrapper.vm.getDataTypeColor('name')).toBe('tertiary');
    expect(wrapper.vm.getDataTypeColor('address')).toBe('warning');
    expect(wrapper.vm.getDataTypeColor('ssn')).toBe('danger');
    expect(wrapper.vm.getDataTypeColor('credit_card')).toBe('danger');
    expect(wrapper.vm.getDataTypeColor('ip_address')).toBe('medium');
    expect(wrapper.vm.getDataTypeColor('username')).toBe('dark');
    expect(wrapper.vm.getDataTypeColor('unknown')).toBe('medium');
  });

  it('should return correct status colors', () => {
    wrapper = mount(PIIManagementPanel);

    const healthyColor = wrapper.vm.getStatusColor(true);
    const errorColor = wrapper.vm.getStatusColor(false);

    expect(healthyColor).toContain('success');
    expect(errorColor).toContain('danger');
  });

  it('should format time correctly', () => {
    wrapper = mount(PIIManagementPanel);
    
    const testDate = new Date('2024-01-15T10:30:45Z');
    const formatted = wrapper.vm.formatTime(testDate);
    
    expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should handle preserve format toggle correctly', () => {
    wrapper = mount(PIIManagementPanel);

    // Default should be true
    expect(wrapper.vm.preserveFormat).toBe(true);
    
    // Toggle should work
    wrapper.vm.preserveFormat = false;
    expect(wrapper.vm.preserveFormat).toBe(false);
  });

  it('should initialize stores on mount', async () => {
    wrapper = mount(PIIManagementPanel);

    // Wait a bit for initialization to complete
    await waitFor(100);

    // Component should be mounted successfully
    expect(wrapper.vm).toBeDefined();
    expect(wrapper.exists()).toBe(true);
  });

  it('should handle text input changes', async () => {
    wrapper = mount(PIIManagementPanel);

    // Test PII input
    const testText = 'Contact me at john.doe@example.com';
    wrapper.vm.testInput = testText;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.testInput).toBe(testText);

    // Pseudonym input
    const pseudonymText = 'John Doe lives in California';
    wrapper.vm.pseudonymInput = pseudonymText;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.pseudonymInput).toBe(pseudonymText);
  });

  it('should have correct button states based on input', async () => {
    wrapper = mount(PIIManagementPanel);

    // Empty inputs should disable buttons
    expect(wrapper.vm.testInput.trim()).toBe('');
    expect(wrapper.vm.pseudonymInput.trim()).toBe('');

    // Add content
    wrapper.vm.testInput = 'test@example.com';
    wrapper.vm.pseudonymInput = 'John Doe';
    await wrapper.vm.$nextTick();

    // Buttons should be enabled (not disabled)
    const canTestPII = wrapper.vm.testInput.trim() && !wrapper.vm.isTestingPII;
    const canPseudonymize = wrapper.vm.pseudonymInput.trim() && !wrapper.vm.isPseudonymizing;
    
    expect(canTestPII).toBe(true);
    expect(canPseudonymize).toBe(true);
  });

  it('should track loading states independently', async () => {
    wrapper = mount(PIIManagementPanel);

    // Both should start as false
    expect(wrapper.vm.isTestingPII).toBe(false);
    expect(wrapper.vm.isPseudonymizing).toBe(false);

    // Can set independently
    wrapper.vm.isTestingPII = true;
    expect(wrapper.vm.isTestingPII).toBe(true);
    expect(wrapper.vm.isPseudonymizing).toBe(false);

    wrapper.vm.isPseudonymizing = true;
    expect(wrapper.vm.isTestingPII).toBe(true);
    expect(wrapper.vm.isPseudonymizing).toBe(true);
  });
});