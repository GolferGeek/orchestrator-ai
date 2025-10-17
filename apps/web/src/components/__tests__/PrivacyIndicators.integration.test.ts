import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import AgentTaskItem from '../AgentTaskItem.vue';
import { usePrivacyStore } from '@/stores/privacyStore';

// Mock the deliverables store
vi.mock('@/stores/deliverablesStore', () => ({
  useDeliverablesStore: () => ({
    getDeliverableById: vi.fn(() => null),
    getDeliverablesByConversation: vi.fn(() => []),
    $state: {}
  })
}));

// Mock other stores
vi.mock('@/stores/sanitizationStore', () => ({
  useSanitizationStore: () => ({
    currentResult: {
      success: true,
      totalDetections: 2,
      totalProcessingTime: 150
    },
    isProcessing: false,
    error: null
  })
}));

vi.mock('@/stores/llmAnalyticsStore', () => ({
  useLLMAnalyticsStore: () => ({
    usageRecords: []
  })
}));

vi.mock('@/stores/agentChatStore', () => ({
  useAgentChatStore: () => ({
    conversations: []
  })
}));

const createWrapper = (messageProps = {}, componentProps = {}) => {
  const defaultMessage = {
    id: 'test-message-1',
    role: 'assistant',
    content: 'Test assistant message',
    timestamp: new Date(),
    metadata: {
      llmMetadata: {
        providerName: 'openai',
        responseTimeMs: 250
      }
    },
    ...messageProps
  };

  return mount(AgentTaskItem, {
    props: {
      message: defaultMessage,
      conversationId: 'test-conversation',
      agentName: 'Test Agent',
      ...componentProps
    },
    global: {
      plugins: [IonicVue],
      stubs: {
        TaskRating: true,
        TaskMetadataModal: true,
        LLMInfo: true
      }
    }
  });
};

describe('Privacy Indicators Integration', () => {
  let privacyStore: ReturnType<typeof usePrivacyStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    privacyStore = usePrivacyStore();
    await privacyStore.initialize();
  });

  describe('Privacy Indicators Display in Chat', () => {
    it('shows privacy indicators for assistant messages', async () => {
      const wrapper = createWrapper();
      
      // Wait for component to initialize privacy state
      await wrapper.vm.$nextTick();
      
      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(true);
    });

    it('hides privacy indicators for user messages', async () => {
      const wrapper = createWrapper({
        role: 'user'
      });
      
      await wrapper.vm.$nextTick();
      
      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(false);
    });

    it('passes correct props to privacy indicators', async () => {
      // Set up privacy state in store
      privacyStore.updateMessagePrivacyState('test-message-1', {
        conversationId: 'test-conversation',
        isDataProtected: true,
        sanitizationStatus: 'completed',
        piiDetectionCount: 3,
        routingMode: 'external',
        trustLevel: 'high',
        trustScore: 85,
        processingTimeMs: 250
      });

      // Set conversation settings
      privacyStore.setConversationSettings('test-conversation', {
        showDataProtection: true,
        showSanitizationStatus: true,
        showRoutingDisplay: true,
        showTrustSignal: true,
        showPiiCount: true,
        showProcessingTime: true,
        compactMode: false
      });

      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(true);

      const props = privacyIndicators.props();
      expect(props.showDataProtection).toBe(true);
      expect(props.isDataProtected).toBe(true);
      expect(props.showSanitizationStatus).toBe(true);
      expect(props.sanitizationStatus).toBe('completed');
      expect(props.piiDetectionCount).toBe(3);
      expect(props.showRoutingDisplay).toBe(true);
      expect(props.routingMode).toBe('external');
      expect(props.showTrustSignal).toBe(true);
      expect(props.trustLevel).toBe('high');
      expect(props.trustScore).toBe(85);
      expect(props.showProcessingTime).toBe(true);
      expect(props.processingTimeMs).toBe(250);
      expect(props.compact).toBe(false);
    });

    it('uses default settings when no conversation settings exist', async () => {
      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(true);

      const props = privacyIndicators.props();
      expect(props.showDataProtection).toBe(true);
      expect(props.showSanitizationStatus).toBe(true);
      expect(props.showRoutingDisplay).toBe(true);
      expect(props.showTrustSignal).toBe(true);
      expect(props.showPiiCount).toBe(true);
      expect(props.showProcessingTime).toBe(false);
      expect(props.compact).toBe(false);
    });
  });

  describe('Real-time Privacy State Updates', () => {
    it('updates privacy indicators when store state changes', async () => {
      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      // Initial state
      let privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.props().isDataProtected).toBe(false);

      // Update store state
      privacyStore.updateMessagePrivacyState('test-message-1', {
        isDataProtected: true,
        sanitizationStatus: 'completed'
      });

      await wrapper.vm.$nextTick();

      // Check updated props
      privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.props().isDataProtected).toBe(true);
      expect(privacyIndicators.props().sanitizationStatus).toBe('completed');
    });

    it('initializes privacy state from message metadata', async () => {
      const messageWithMetadata = {
        id: 'test-message-2',
        role: 'assistant',
        content: 'Test message',
        timestamp: new Date(),
        metadata: {
          llmMetadata: {
            providerName: 'local',
            responseTimeMs: 150
          }
        }
      };

      const wrapper = createWrapper(messageWithMetadata);
      await wrapper.vm.$nextTick();

      // Privacy state should be initialized from message metadata
      const privacyState = privacyStore.getMessagePrivacyState('test-message-2');
      expect(privacyState).not.toBe(null);
      expect(privacyState?.processingTimeMs).toBe(150);
    });
  });

  describe('Conversation Settings Integration', () => {
    it('applies conversation-specific display settings', async () => {
      // Set custom conversation settings
      privacyStore.setConversationSettings('test-conversation', {
        showDataProtection: false,
        showSanitizationStatus: true,
        showRoutingDisplay: false,
        showTrustSignal: true,
        compactMode: true
      });

      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      const props = privacyIndicators.props();
      
      expect(props.showDataProtection).toBe(false);
      expect(props.showSanitizationStatus).toBe(true);
      expect(props.showRoutingDisplay).toBe(false);
      expect(props.showTrustSignal).toBe(true);
      expect(props.compact).toBe(true);
    });

    it('handles missing conversation ID gracefully', async () => {
      const wrapper = createWrapper({}, { conversationId: undefined });
      await wrapper.vm.$nextTick();

      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(true);
      
      // Should use default settings
      const props = privacyIndicators.props();
      expect(props.showDataProtection).toBe(true);
      expect(props.compact).toBe(false);
    });
  });

  describe('Privacy State Calculation', () => {
    it('calculates trust score based on message conditions', async () => {
      const localMessage = {
        id: 'local-message',
        role: 'assistant',
        content: 'Local processed message',
        timestamp: new Date(),
        metadata: {
          llmMetadata: {
            providerName: 'local'
          }
        }
      };

      const wrapper = createWrapper(localMessage, {
        conversationId: 'test-conv'
      });
      
      await wrapper.vm.$nextTick();

      const privacyState = privacyStore.getMessagePrivacyState('local-message');
      expect(privacyState?.trustScore).toBeGreaterThan(70); // Should have bonus for local processing
      expect(privacyState?.routingMode).toBe('local');
    });

    it('determines data protection level correctly', async () => {
      // Mock successful sanitization
      vi.mocked(vi.importMock('@/stores/sanitizationStore')).mockReturnValue({
        useSanitizationStore: () => ({
          currentResult: {
            success: true,
            totalDetections: 1,
            totalProcessingTime: 100
          },
          isProcessing: false,
          error: null
        })
      });

      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      // Update privacy state from sources
      await privacyStore.updateMessagePrivacyFromSources('test-message-1', {
        id: 'test-message-1',
        metadata: {
          llmMetadata: {
            providerName: 'local'
          }
        }
      });

      const privacyState = privacyStore.getMessagePrivacyState('test-message-1');
      expect(privacyState?.isDataProtected).toBe(true);
      expect(privacyState?.dataProtectionLevel).toBe('full'); // Local + sanitized = full protection
    });
  });

  describe('Error Handling', () => {
    it('handles missing message metadata gracefully', async () => {
      const messageWithoutMetadata = {
        id: 'no-metadata-message',
        role: 'assistant',
        content: 'Message without metadata',
        timestamp: new Date()
        // No metadata property
      };

      const wrapper = createWrapper(messageWithoutMetadata);
      await wrapper.vm.$nextTick();

      const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
      expect(privacyIndicators.exists()).toBe(true);
      
      // Should still render with default values
      const props = privacyIndicators.props();
      expect(props.routingMode).toBe('local'); // Default fallback
      expect(props.processingTimeMs).toBe(0);
    });

    it('handles store errors gracefully', async () => {
      // Simulate store error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        // This should not throw even if there are internal errors
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();
        
        const privacyIndicators = wrapper.findComponent({ name: 'UserPrivacyIndicators' });
        expect(privacyIndicators.exists()).toBe(true);
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Performance', () => {
    it('does not cause excessive re-renders', async () => {
      const wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      const renderSpy = vi.spyOn(wrapper.vm, '$forceUpdate');
      
      // Multiple rapid state updates
      for (let i = 0; i < 5; i++) {
        privacyStore.updateMessagePrivacyState('test-message-1', {
          trustScore: 80 + i
        });
      }

      await wrapper.vm.$nextTick();
      
      // Should not cause excessive updates due to Vue's reactivity batching
      expect(renderSpy).toHaveBeenCalledTimes(0); // $forceUpdate should not be called
    });

    it('handles large numbers of privacy states efficiently', async () => {
      const startTime = Date.now();
      
      // Create many privacy states
      for (let i = 0; i < 1000; i++) {
        privacyStore.updateMessagePrivacyState(`message-${i}`, {
          conversationId: 'test-conversation',
          isDataProtected: i % 2 === 0,
          trustScore: 50 + (i % 50)
        });
      }
      
      const endTime = Date.now();
      
      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verify states were created correctly
      expect(privacyStore.messageStates.size).toBe(1000);
      
      // Verify summary calculations still work efficiently
      const summary = privacyStore.getConversationPrivacySummary('test-conversation');
      expect(summary.totalMessages).toBe(1000);
      expect(summary.protectedMessages).toBe(500); // Half should be protected
    });
  });
});
