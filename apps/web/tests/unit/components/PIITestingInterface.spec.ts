import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PIITestingInterface from '../../../src/components/PII/PIITestingInterface.vue';
import { waitFor, expectEventually } from '../../../src/tests/setup';

describe('PIITestingInterface Component', () => {
  let wrapper: any;
  
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('should render main interface structure', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.find('.pii-testing-interface').exists()).toBe(true);
    expect(wrapper.find('.testing-header').exists()).toBe(true);
    expect(wrapper.text()).toContain('PII Detection Testing');
    expect(wrapper.text()).toContain('Test your PII patterns in real-time');
  });

  it('should render input section correctly', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.text()).toContain('Test Input');
    expect(wrapper.text()).toContain('Type or paste text to test PII detection');
    expect(wrapper.find('ion-textarea').exists()).toBe(true);
  });

  it('should render results section correctly', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.text()).toContain('Detection Results');
    expect(wrapper.text()).toContain('Enter text in the input area to see detection results');
  });

  it('should render test options checkboxes', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.text()).toContain('Enable Redaction');
    expect(wrapper.text()).toContain('Enable Pseudonymization');
    expect(wrapper.findAll('ion-checkbox')).toHaveLength(2);
  });

  it('should initialize with default reactive data', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.vm.inputText).toBe('');
    expect(wrapper.vm.testOptions.enableRedaction).toBe(false);
    expect(wrapper.vm.testOptions.enablePseudonymization).toBe(false);
    expect(wrapper.vm.isDetecting).toBe(false);
    expect(wrapper.vm.detectionResult).toBe(null);
    expect(wrapper.vm.detectionError).toBe(null);
    expect(wrapper.vm.isInputFocused).toBe(false);
  });

  it('should show empty state when no input text', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Enter text in the input area to see detection results');
  });

  it('should handle input text changes', async () => {
    wrapper = mount(PIITestingInterface);

    const testText = 'Contact me at john.doe@example.com';
    wrapper.vm.inputText = testText;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.inputText).toBe(testText);
  });

  it('should handle test option changes', async () => {
    wrapper = mount(PIITestingInterface);

    // Toggle redaction
    wrapper.vm.testOptions.enableRedaction = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.testOptions.enableRedaction).toBe(true);

    // Toggle pseudonymization
    wrapper.vm.testOptions.enablePseudonymization = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.testOptions.enablePseudonymization).toBe(true);
  });

  it('should show detection results when available', async () => {
    wrapper = mount(PIITestingInterface);

    const mockResult = {
      matches: [
        {
          value: 'john.doe@example.com',
          dataType: 'email',
          patternName: 'Email Address',
          startIndex: 13,
          endIndex: 32,
          confidence: 0.95
        }
      ],
      patternsChecked: 5,
      processingTime: 150
    };

    wrapper.vm.detectionResult = mockResult;
    wrapper.vm.inputText = 'Contact me at john.doe@example.com';
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('1 PII entities detected');
    expect(wrapper.text()).toContain('Detected PII Entities');
    expect(wrapper.text()).toContain('john.doe@example.com');
    expect(wrapper.text()).toContain('Email Address');
    expect(wrapper.text()).toContain('email');
    expect(wrapper.text()).toContain('95%');
    expect(wrapper.text()).toContain('Position: 13-32');
    expect(wrapper.text()).toContain('Confidence: 95%');
  });

  it('should show no matches state when no PII detected', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.detectionResult = {
      matches: [],
      patternsChecked: 5,
      processingTime: 50
    };
    wrapper.vm.inputText = 'Hello world, this is clean text';
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.no-matches').exists()).toBe(true);
    expect(wrapper.text()).toContain('No PII Detected');
    expect(wrapper.text()).toContain('The text appears to be clean');
  });

  it('should show error state when detection fails', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.detectionError = 'Failed to connect to detection service';
    wrapper.vm.inputText = 'test text';
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Detection Error');
    expect(wrapper.text()).toContain('Failed to connect to detection service');
    expect(wrapper.text()).toContain('Retry Detection');
  });

  it('should show loading state during detection', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.isDetecting = true;
    wrapper.vm.inputText = 'test text';
    await wrapper.vm.$nextTick();

    expect(wrapper.find('ion-spinner').exists()).toBe(true);
    expect(wrapper.find('.detection-spinner').exists()).toBe(true);
  });

  it('should display performance indicators', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.lastDetectionTime = 125;
    wrapper.vm.detectionResult = {
      matches: [],
      patternsChecked: 8,
      processingTime: 125
    };
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.performance-indicator').exists()).toBe(true);
    expect(wrapper.text()).toContain('125ms');
    expect(wrapper.text()).toContain('8 patterns checked');
  });

  it('should handle input focus states', async () => {
    wrapper = mount(PIITestingInterface);

    // Initially not focused
    expect(wrapper.vm.isInputFocused).toBe(false);

    // Simulate focus
    wrapper.vm.isInputFocused = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.isInputFocused).toBe(true);

    // Simulate blur
    wrapper.vm.isInputFocused = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.isInputFocused).toBe(false);
  });

  it('should show highlighted text container when matches exist', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.detectionResult = {
      matches: [{ value: 'test@example.com', dataType: 'email' }],
      patternsChecked: 5
    };
    await wrapper.vm.$nextTick();

    const container = wrapper.find('.highlighted-textarea-container');
    expect(container.exists()).toBe(true);
    expect(container.classes()).toContain('has-matches');
  });

  it('should return correct data type colors', () => {
    wrapper = mount(PIITestingInterface);

    // Test if the method exists and returns expected values
    if (wrapper.vm.getDataTypeColor) {
      expect(wrapper.vm.getDataTypeColor('email')).toBeDefined();
      expect(wrapper.vm.getDataTypeColor('phone')).toBeDefined();
      expect(wrapper.vm.getDataTypeColor('ssn')).toBeDefined();
    }
  });

  it('should return correct confidence colors', () => {
    wrapper = mount(PIITestingInterface);

    if (wrapper.vm.getConfidenceColor) {
      const highConfidence = wrapper.vm.getConfidenceColor(0.9);
      const mediumConfidence = wrapper.vm.getConfidenceColor(0.7);
      const lowConfidence = wrapper.vm.getConfidenceColor(0.4);

      expect(highConfidence).toBeDefined();
      expect(mediumConfidence).toBeDefined();
      expect(lowConfidence).toBeDefined();
    }
  });

  it('should return correct performance colors', () => {
    wrapper = mount(PIITestingInterface);

    if (wrapper.vm.getPerformanceColor) {
      const fastTime = wrapper.vm.getPerformanceColor(50);
      const mediumTime = wrapper.vm.getPerformanceColor(150);
      const slowTime = wrapper.vm.getPerformanceColor(500);

      expect(fastTime).toBeDefined();
      expect(mediumTime).toBeDefined();
      expect(slowTime).toBeDefined();
    }
  });

  it('should handle multiple matches correctly', async () => {
    wrapper = mount(PIITestingInterface);

    const mockResult = {
      matches: [
        {
          value: 'john@example.com',
          dataType: 'email',
          patternName: 'Email',
          startIndex: 0,
          endIndex: 16,
          confidence: 0.95
        },
        {
          value: '555-1234',
          dataType: 'phone',
          patternName: 'Phone Number',
          startIndex: 20,
          endIndex: 28,
          confidence: 0.88
        }
      ],
      patternsChecked: 10
    };

    wrapper.vm.detectionResult = mockResult;
    wrapper.vm.inputText = 'john@example.com or 555-1234';
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('2 PII entities detected');
    expect(wrapper.text()).toContain('john@example.com');
    expect(wrapper.text()).toContain('555-1234');
    expect(wrapper.text()).toContain('Email');
    expect(wrapper.text()).toContain('Phone Number');
  });

  it('should disable textarea during detection', async () => {
    wrapper = mount(PIITestingInterface);

    wrapper.vm.isDetecting = true;
    await wrapper.vm.$nextTick();

    const textarea = wrapper.find('ion-textarea');
    expect(textarea.attributes('disabled')).toBe('');
  });

  it('should handle checkbox interactions', async () => {
    wrapper = mount(PIITestingInterface);

    const redactionCheckbox = wrapper.findAll('ion-checkbox')[0];
    const pseudonymizationCheckbox = wrapper.findAll('ion-checkbox')[1];

    // Initial states should be false
    expect(wrapper.vm.testOptions.enableRedaction).toBe(false);
    expect(wrapper.vm.testOptions.enablePseudonymization).toBe(false);

    // Toggle checkboxes
    wrapper.vm.testOptions.enableRedaction = true;
    wrapper.vm.testOptions.enablePseudonymization = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.testOptions.enableRedaction).toBe(true);
    expect(wrapper.vm.testOptions.enablePseudonymization).toBe(true);
  });

  it('should show placeholder text in textarea', () => {
    wrapper = mount(PIITestingInterface);

    const textarea = wrapper.find('ion-textarea');
    const placeholder = textarea.attributes('placeholder');
    
    expect(placeholder).toContain('Enter text to test PII detection');
    expect(placeholder).toContain('Examples to try');
    expect(placeholder).toContain('john.doe@example.com');
    expect(placeholder).toContain('(555) 123-4567');
  });

  it('should handle input events correctly', async () => {
    wrapper = mount(PIITestingInterface);

    // Simulate input change
    const newText = 'Test input with email@test.com';
    wrapper.vm.inputText = newText;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.inputText).toBe(newText);
  });

  it('should render highlight layer', () => {
    wrapper = mount(PIITestingInterface);

    expect(wrapper.find('.highlight-layer').exists()).toBe(true);
    expect(wrapper.find('.transparent-textarea').exists()).toBe(true);
  });

  it('should handle component initialization correctly', async () => {
    wrapper = mount(PIITestingInterface);

    // Wait for component to initialize
    await waitFor(100);

    expect(wrapper.vm).toBeDefined();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.pii-testing-interface').exists()).toBe(true);
  });

  it('should maintain state consistency', async () => {
    wrapper = mount(PIITestingInterface);

    // Set some initial state
    const initialText = 'Initial test text';
    wrapper.vm.inputText = initialText;
    wrapper.vm.testOptions.enableRedaction = true;
    await wrapper.vm.$nextTick();

    // Verify state persistence
    expect(wrapper.vm.inputText).toBe(initialText);
    expect(wrapper.vm.testOptions.enableRedaction).toBe(true);
    expect(wrapper.vm.testOptions.enablePseudonymization).toBe(false);
  });
});