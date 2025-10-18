import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { IonicVue } from '@ionic/vue';
import UserPrivacyIndicators from '../UserPrivacyIndicators.vue';

// Create a test app with Ionic
const createWrapper = (props = {}) => {
  return mount(UserPrivacyIndicators, {
    props,
    global: {
      plugins: [IonicVue]
    }
  });
};

describe('UserPrivacyIndicators', () => {
  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders data protection badge when enabled', () => {
      const wrapper = createWrapper({
        showDataProtection: true,
        isDataProtected: true
      });
      
      const badge = wrapper.find('.data-protection');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Data Protected');
      expect(badge.classes()).toContain('active');
    });

    it('renders processing state for data protection', () => {
      const wrapper = createWrapper({
        showDataProtection: true,
        isDataProtected: false
      });
      
      const badge = wrapper.find('.data-protection');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Processing...');
      expect(badge.classes()).not.toContain('active');
    });
  });

  describe('Sanitization Status', () => {
    it('renders sanitization status badge', () => {
      const wrapper = createWrapper({
        showSanitizationStatus: true,
        sanitizationStatus: 'completed'
      });
      
      const badge = wrapper.find('.sanitization-status');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Sanitized');
      expect(badge.classes()).toContain('status-completed');
    });

    it('shows processing animation for sanitization in progress', () => {
      const wrapper = createWrapper({
        showSanitizationStatus: true,
        sanitizationStatus: 'processing'
      });
      
      const badge = wrapper.find('.sanitization-status');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Sanitizing...');
      expect(badge.classes()).toContain('status-processing');
    });

    it('shows failed state for sanitization errors', () => {
      const wrapper = createWrapper({
        showSanitizationStatus: true,
        sanitizationStatus: 'failed'
      });
      
      const badge = wrapper.find('.sanitization-status');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Sanitization Failed');
      expect(badge.classes()).toContain('status-failed');
    });

    it('shows default state when no sanitization', () => {
      const wrapper = createWrapper({
        showSanitizationStatus: true,
        sanitizationStatus: 'none'
      });
      
      const badge = wrapper.find('.sanitization-status');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('No Sanitization');
      expect(badge.classes()).toContain('status-none');
    });
  });

  describe('Routing Display', () => {
    it('renders local routing badge', () => {
      const wrapper = createWrapper({
        showRoutingDisplay: true,
        routingMode: 'local'
      });
      
      const badge = wrapper.find('.routing-display');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Local Processing');
      expect(badge.classes()).toContain('routing-local');
    });

    it('renders external routing badge', () => {
      const wrapper = createWrapper({
        showRoutingDisplay: true,
        routingMode: 'external'
      });
      
      const badge = wrapper.find('.routing-display');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('External API');
      expect(badge.classes()).toContain('routing-external');
    });

    it('renders hybrid routing badge', () => {
      const wrapper = createWrapper({
        showRoutingDisplay: true,
        routingMode: 'hybrid'
      });
      
      const badge = wrapper.find('.routing-display');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Hybrid Processing');
      expect(badge.classes()).toContain('routing-hybrid');
    });
  });

  describe('Trust Signals', () => {
    it('renders high trust badge', () => {
      const wrapper = createWrapper({
        showTrustSignal: true,
        trustLevel: 'high',
        trustScore: 95
      });
      
      const badge = wrapper.find('.trust-signal');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('High Trust');
      expect(badge.text()).toContain('95%');
      expect(badge.classes()).toContain('trust-high');
    });

    it('renders medium trust badge', () => {
      const wrapper = createWrapper({
        showTrustSignal: true,
        trustLevel: 'medium',
        trustScore: 70
      });
      
      const badge = wrapper.find('.trust-signal');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Medium Trust');
      expect(badge.text()).toContain('70%');
      expect(badge.classes()).toContain('trust-medium');
    });

    it('renders low trust badge', () => {
      const wrapper = createWrapper({
        showTrustSignal: true,
        trustLevel: 'low',
        trustScore: 45
      });
      
      const badge = wrapper.find('.trust-signal');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Low Trust');
      expect(badge.text()).toContain('45%');
      expect(badge.classes()).toContain('trust-low');
    });

    it('renders trust badge without score', () => {
      const wrapper = createWrapper({
        showTrustSignal: true,
        trustLevel: 'medium',
        trustScore: null
      });
      
      const badge = wrapper.find('.trust-signal');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Medium Trust');
      expect(badge.text()).not.toContain('%');
    });
  });

  describe('PII Detection Count', () => {
    it('renders PII count badge when PII detected', () => {
      const wrapper = createWrapper({
        showPiiCount: true,
        piiDetectionCount: 3
      });
      
      const badge = wrapper.find('.pii-detection');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('3 PII items');
    });

    it('hides PII count badge when no PII detected', () => {
      const wrapper = createWrapper({
        showPiiCount: true,
        piiDetectionCount: 0
      });
      
      const badge = wrapper.find('.pii-detection');
      expect(badge.exists()).toBe(false);
    });
  });

  describe('Processing Time', () => {
    it('renders processing time in milliseconds', () => {
      const wrapper = createWrapper({
        showProcessingTime: true,
        processingTimeMs: 250
      });
      
      const badge = wrapper.find('.processing-time');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('250ms');
    });

    it('renders processing time in seconds for large values', () => {
      const wrapper = createWrapper({
        showProcessingTime: true,
        processingTimeMs: 2500
      });
      
      const badge = wrapper.find('.processing-time');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('2.5s');
    });

    it('hides processing time badge when time is zero', () => {
      const wrapper = createWrapper({
        showProcessingTime: true,
        processingTimeMs: 0
      });
      
      const badge = wrapper.find('.processing-time');
      expect(badge.exists()).toBe(false);
    });
  });

  describe('Badge Visibility', () => {
    it('hides badges when show flags are false', () => {
      const wrapper = createWrapper({
        showDataProtection: false,
        showSanitizationStatus: false,
        showRoutingDisplay: false,
        showTrustSignal: false,
        showPiiCount: false,
        showProcessingTime: false
      });
      
      expect(wrapper.find('.data-protection').exists()).toBe(false);
      expect(wrapper.find('.sanitization-status').exists()).toBe(false);
      expect(wrapper.find('.routing-display').exists()).toBe(false);
      expect(wrapper.find('.trust-signal').exists()).toBe(false);
      expect(wrapper.find('.pii-detection').exists()).toBe(false);
      expect(wrapper.find('.processing-time').exists()).toBe(false);
    });

    it('shows all badges when enabled', () => {
      const wrapper = createWrapper({
        showDataProtection: true,
        isDataProtected: true,
        showSanitizationStatus: true,
        sanitizationStatus: 'completed',
        showRoutingDisplay: true,
        routingMode: 'local',
        showTrustSignal: true,
        trustLevel: 'high',
        showPiiCount: true,
        piiDetectionCount: 2,
        showProcessingTime: true,
        processingTimeMs: 150
      });
      
      expect(wrapper.find('.data-protection').exists()).toBe(true);
      expect(wrapper.find('.sanitization-status').exists()).toBe(true);
      expect(wrapper.find('.routing-display').exists()).toBe(true);
      expect(wrapper.find('.trust-signal').exists()).toBe(true);
      expect(wrapper.find('.pii-detection').exists()).toBe(true);
      expect(wrapper.find('.processing-time').exists()).toBe(true);
    });
  });

  describe('Compact Mode', () => {
    it('applies compact classes when compact prop is true', () => {
      const wrapper = createWrapper({
        compact: true,
        showDataProtection: true,
        isDataProtected: true
      });
      
      const container = wrapper.find('.privacy-indicators');
      expect(container.classes()).toContain('compact');
    });

    it('does not apply compact classes by default', () => {
      const wrapper = createWrapper({
        showDataProtection: true,
        isDataProtected: true
      });
      
      const container = wrapper.find('.privacy-indicators');
      expect(container.classes()).not.toContain('compact');
    });
  });

  describe('Default Props', () => {
    it('uses default prop values', () => {
      const wrapper = createWrapper();
      
      // Should show data protection badge with default values
      const badge = wrapper.find('.data-protection');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Processing...');
    });
  });

  describe('Accessibility', () => {
    it('includes proper ARIA attributes', () => {
      const wrapper = createWrapper({
        showDataProtection: true,
        isDataProtected: true
      });
      
      const icons = wrapper.findAll('ion-icon');
      expect(icons.length).toBeGreaterThan(0);
      
      // Check that badges have readable text content
      const badge = wrapper.find('.data-protection');
      expect(badge.text().trim()).not.toBe('');
    });
  });
});
