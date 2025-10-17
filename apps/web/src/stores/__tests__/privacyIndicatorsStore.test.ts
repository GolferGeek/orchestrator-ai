import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePrivacyIndicatorsStore } from '../privacyIndicatorsStore';

// Mock the other stores
vi.mock('../sanitizationStore', () => ({
  useSanitizationStore: () => ({
    currentResult: null,
    isProcessing: false,
    error: null
  })
}));

vi.mock('../llmAnalyticsStore', () => ({
  useLLMAnalyticsStore: () => ({
    usageRecords: []
  })
}));

vi.mock('../agentChatStore', () => ({
  useAgentChatStore: () => ({
    conversations: []
  })
}));

describe('PrivacyIndicatorsStore', () => {
  let store: ReturnType<typeof usePrivacyIndicatorsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = usePrivacyIndicatorsStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('initializes with default state', () => {
      expect(store.isInitialized).toBe(false);
      expect(store.messageStates.size).toBe(0);
      expect(store.conversationSettings.size).toBe(0);
    });

    it('initializes successfully', async () => {
      await store.initialize();
      expect(store.isInitialized).toBe(true);
      expect(store.lastGlobalUpdate).not.toBe(null);
    });

    it('does not initialize twice', async () => {
      await store.initialize();
      const firstUpdate = store.lastGlobalUpdate;
      
      await store.initialize();
      expect(store.lastGlobalUpdate).toBe(firstUpdate);
    });
  });

  describe('Message Privacy State Management', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('creates new message privacy state', () => {
      const messageId = 'test-message-1';
      const state = store.updateMessagePrivacyState(messageId, {
        conversationId: 'conv-1',
        isDataProtected: true,
        sanitizationStatus: 'completed',
        piiDetectionCount: 2
      });

      expect(state.messageId).toBe(messageId);
      expect(state.conversationId).toBe('conv-1');
      expect(state.isDataProtected).toBe(true);
      expect(state.sanitizationStatus).toBe('completed');
      expect(state.piiDetectionCount).toBe(2);
      expect(state.updateCount).toBe(1);
    });

    it('updates existing message privacy state', () => {
      const messageId = 'test-message-1';
      
      // Create initial state
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: false,
        sanitizationStatus: 'processing'
      });

      // Update the state
      const updatedState = store.updateMessagePrivacyState(messageId, {
        isDataProtected: true,
        sanitizationStatus: 'completed'
      });

      expect(updatedState.isDataProtected).toBe(true);
      expect(updatedState.sanitizationStatus).toBe('completed');
      expect(updatedState.updateCount).toBe(2);
    });

    it('retrieves message privacy state', () => {
      const messageId = 'test-message-1';
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: true
      });

      const retrievedState = store.getMessagePrivacyState(messageId);
      expect(retrievedState).not.toBe(null);
      expect(retrievedState?.messageId).toBe(messageId);
      expect(retrievedState?.isDataProtected).toBe(true);
    });

    it('returns null for non-existent message', () => {
      const state = store.getMessagePrivacyState('non-existent');
      expect(state).toBe(null);
    });

    it('removes message privacy state', () => {
      const messageId = 'test-message-1';
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: true
      });

      const removed = store.removeMessagePrivacyState(messageId);
      expect(removed).toBe(true);
      
      const retrievedState = store.getMessagePrivacyState(messageId);
      expect(retrievedState).toBe(null);
    });

    it('returns false when removing non-existent message', () => {
      const removed = store.removeMessagePrivacyState('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Conversation Settings Management', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('sets conversation privacy settings', () => {
      const conversationId = 'conv-1';
      const settings = store.setConversationSettings(conversationId, {
        showDataProtection: false,
        enableRealTimeUpdates: false,
        compactMode: true
      });

      expect(settings.conversationId).toBe(conversationId);
      expect(settings.showDataProtection).toBe(false);
      expect(settings.enableRealTimeUpdates).toBe(false);
      expect(settings.compactMode).toBe(true);
    });

    it('uses default values for unspecified settings', () => {
      const conversationId = 'conv-1';
      const settings = store.setConversationSettings(conversationId, {});

      expect(settings.showDataProtection).toBe(true);
      expect(settings.showSanitizationStatus).toBe(true);
      expect(settings.enableRealTimeUpdates).toBe(true);
      expect(settings.compactMode).toBe(false);
    });

    it('retrieves conversation settings', () => {
      const conversationId = 'conv-1';
      store.setConversationSettings(conversationId, {
        compactMode: true
      });

      const retrievedSettings = store.getConversationSettings(conversationId);
      expect(retrievedSettings).not.toBe(null);
      expect(retrievedSettings?.conversationId).toBe(conversationId);
      expect(retrievedSettings?.compactMode).toBe(true);
    });

    it('returns null for non-existent conversation settings', () => {
      const settings = store.getConversationSettings('non-existent');
      expect(settings).toBe(null);
    });
  });

  describe('Conversation Message States', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('retrieves message states for a conversation', () => {
      const conversationId = 'conv-1';
      
      store.updateMessagePrivacyState('msg-1', {
        conversationId,
        isDataProtected: true
      });
      
      store.updateMessagePrivacyState('msg-2', {
        conversationId,
        isDataProtected: false
      });
      
      store.updateMessagePrivacyState('msg-3', {
        conversationId: 'conv-2',
        isDataProtected: true
      });

      const conversationStates = store.getConversationMessageStates(conversationId);
      expect(conversationStates).toHaveLength(2);
      expect(conversationStates.every(state => state.conversationId === conversationId)).toBe(true);
    });

    it('returns empty array for conversation with no messages', () => {
      const conversationStates = store.getConversationMessageStates('empty-conv');
      expect(conversationStates).toHaveLength(0);
    });

    it('clears all message states for a conversation', () => {
      const conversationId = 'conv-1';
      
      store.updateMessagePrivacyState('msg-1', { conversationId });
      store.updateMessagePrivacyState('msg-2', { conversationId });
      store.setConversationSettings(conversationId, {});

      store.clearConversationPrivacyStates(conversationId);

      const conversationStates = store.getConversationMessageStates(conversationId);
      expect(conversationStates).toHaveLength(0);
      
      const settings = store.getConversationSettings(conversationId);
      expect(settings).toBe(null);
    });
  });

  describe('Privacy Summary Statistics', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('calculates conversation privacy summary', () => {
      const conversationId = 'conv-1';
      
      store.updateMessagePrivacyState('msg-1', {
        conversationId,
        isDataProtected: true,
        sanitizationStatus: 'completed',
        trustScore: 90
      });
      
      store.updateMessagePrivacyState('msg-2', {
        conversationId,
        isDataProtected: false,
        sanitizationStatus: 'failed',
        trustScore: 60,
        hasErrors: true
      });

      const summary = store.getConversationPrivacySummary(conversationId);
      expect(summary.totalMessages).toBe(2);
      expect(summary.protectedMessages).toBe(1);
      expect(summary.sanitizedMessages).toBe(1);
      expect(summary.averageTrustScore).toBe(75); // (90 + 60) / 2
      expect(summary.hasErrors).toBe(true);
    });

    it('returns default summary for empty conversation', () => {
      const summary = store.getConversationPrivacySummary('empty-conv');
      expect(summary.totalMessages).toBe(0);
      expect(summary.protectedMessages).toBe(0);
      expect(summary.sanitizedMessages).toBe(0);
      expect(summary.averageTrustScore).toBe(null);
      expect(summary.hasErrors).toBe(false);
    });

    it('calculates global privacy statistics', () => {
      // Add messages from different conversations
      store.updateMessagePrivacyState('msg-1', {
        conversationId: 'conv-1',
        isDataProtected: true,
        trustScore: 85,
        piiDetectionCount: 2,
        processingTimeMs: 150
      });
      
      store.updateMessagePrivacyState('msg-2', {
        conversationId: 'conv-2',
        isDataProtected: false,
        trustScore: 65,
        piiDetectionCount: 1,
        processingTimeMs: 200
      });

      const stats = store.globalPrivacyStats;
      expect(stats.totalMessages).toBe(2);
      expect(stats.totalConversations).toBe(2);
      expect(stats.protectedPercentage).toBe(50); // 1/2 * 100
      expect(stats.averageTrustScore).toBe(75); // (85 + 65) / 2
      expect(stats.totalPiiDetected).toBe(3); // 2 + 1
      expect(stats.averageProcessingTime).toBe(175); // (150 + 200) / 2
    });

    it('returns default global stats when no messages', () => {
      const stats = store.globalPrivacyStats;
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalConversations).toBe(0);
      expect(stats.protectedPercentage).toBe(0);
      expect(stats.averageTrustScore).toBe(null);
      expect(stats.totalPiiDetected).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await store.initialize();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts real-time updates for conversation', () => {
      const conversationId = 'conv-1';
      store.setConversationSettings(conversationId, {
        enableRealTimeUpdates: true,
        updateInterval: 1000
      });

      store.startConversationRealTimeUpdates(conversationId);
      
      // Timer should be active
      expect(vi.getTimerCount()).toBe(1);
    });

    it('stops real-time updates for conversation', () => {
      const conversationId = 'conv-1';
      store.setConversationSettings(conversationId, {
        enableRealTimeUpdates: true
      });

      store.startConversationRealTimeUpdates(conversationId);
      store.stopConversationRealTimeUpdates(conversationId);
      
      // Timer should be cleared
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start updates when disabled', () => {
      const conversationId = 'conv-1';
      store.setConversationSettings(conversationId, {
        enableRealTimeUpdates: false
      });

      store.startConversationRealTimeUpdates(conversationId);
      
      // No timer should be active
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('State Cleanup', () => {
    beforeEach(async () => {
      await store.initialize();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('cleans up old states based on age', () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 7200000); // 2 hours ago

      // Create old state
      store.updateMessagePrivacyState('old-msg', {
        conversationId: 'conv-1'
      });
      
      // Manually set old timestamp
      const oldState = store.messageStates.get('old-msg');
      if (oldState) {
        oldState.lastUpdated = oldTime;
      }

      // Create recent state
      store.updateMessagePrivacyState('new-msg', {
        conversationId: 'conv-1'
      });

      // Trigger cleanup
      store.cleanupOldStates();

      // Old state should be removed, new state should remain
      expect(store.getMessagePrivacyState('old-msg')).toBe(null);
      expect(store.getMessagePrivacyState('new-msg')).not.toBe(null);
    });

    it('enforces maximum stored states limit', () => {
      // Set a low limit for testing
      store.globalSettings.maxStoredStates = 2;

      // Add more states than the limit
      store.updateMessagePrivacyState('msg-1', { conversationId: 'conv-1' });
      store.updateMessagePrivacyState('msg-2', { conversationId: 'conv-1' });
      store.updateMessagePrivacyState('msg-3', { conversationId: 'conv-1' });

      // Trigger cleanup
      store.cleanupOldStates();

      // Should only have 2 states (the most recent ones)
      expect(store.messageStates.size).toBe(2);
      expect(store.getMessagePrivacyState('msg-1')).toBe(null); // Oldest should be removed
      expect(store.getMessagePrivacyState('msg-2')).not.toBe(null);
      expect(store.getMessagePrivacyState('msg-3')).not.toBe(null);
    });
  });

  describe('Helper Functions', () => {
    it('calculates trust score correctly', () => {
      // This tests the internal helper function indirectly
      const messageId = 'test-msg';
      
      // Mock message with good conditions
      const message = {
        metadata: {
          llmMetadata: {
            providerName: 'local'
          }
        }
      };

      // Update state which uses trust calculation internally
      store.updateMessagePrivacyFromSources(messageId, message);
      
      const state = store.getMessagePrivacyState(messageId);
      expect(state?.trustScore).toBeGreaterThan(70); // Should have base + local bonus
    });

    it('determines routing mode correctly', () => {
      const messageId = 'test-msg';
      
      const message = {
        metadata: {
          llmMetadata: {
            providerName: 'openai'
          }
        }
      };

      store.updateMessagePrivacyFromSources(messageId, message);
      
      const state = store.getMessagePrivacyState(messageId);
      expect(state?.routingMode).toBe('external');
    });
  });
});
