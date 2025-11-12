/**
 * Unit Tests for Chat UI Store
 * Tests all UI state mutations and computed properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatUiStore, type PendingAction } from '../ui/chatUiStore';

describe('ChatUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Store Initialization', () => {
    it('should initialize with default UI state', () => {
      const store = useChatUiStore();

      expect(store.activeConversationId).toBeNull();
      expect(store.pendingAction).toBeNull();
      expect(store.chatMode).toBe('conversational');
      expect(store.lastMessageWasSpeech).toBe(false);
      expect(store.sidebarCollapsed).toBe(false);
      expect(store.rightPanelVisible).toBe(true);
      expect(store.inputFocused).toBe(false);
    });
  });

  describe('Active Conversation', () => {
    it('should set active conversation', () => {
      const store = useChatUiStore();

      store.setActiveConversation('conv-123');

      expect(store.activeConversationId).toBe('conv-123');
      expect(store.hasActiveConversation).toBe(true);
    });

    it('should clear active conversation', () => {
      const store = useChatUiStore();

      store.setActiveConversation('conv-123');
      expect(store.hasActiveConversation).toBe(true);

      store.setActiveConversation(null);
      expect(store.activeConversationId).toBeNull();
      expect(store.hasActiveConversation).toBe(false);
    });
  });

  describe('Pending Actions', () => {
    it('should set pending action', () => {
      const store = useChatUiStore();

      const action: PendingAction = {
        type: 'plan',
        status: 'pending',
        conversationId: 'conv-123',
      };

      store.setPendingAction(action);

      expect(store.pendingAction).toEqual(action);
      expect(store.hasPendingAction).toBe(true);
      expect(store.isPendingActionInProgress).toBe(false);
    });

    it('should update pending action status', () => {
      const store = useChatUiStore();

      const action: PendingAction = {
        type: 'build',
        status: 'pending',
        conversationId: 'conv-123',
      };

      store.setPendingAction(action);
      store.updatePendingActionStatus('in_progress');

      expect(store.pendingAction?.status).toBe('in_progress');
      expect(store.isPendingActionInProgress).toBe(true);
    });

    it('should clear pending action', () => {
      const store = useChatUiStore();

      const action: PendingAction = {
        type: 'orchestration',
        status: 'completed',
      };

      store.setPendingAction(action);
      expect(store.hasPendingAction).toBe(true);

      store.clearPendingAction();
      expect(store.pendingAction).toBeNull();
      expect(store.hasPendingAction).toBe(false);
    });
  });

  describe('Chat Mode', () => {
    it('should set chat mode', () => {
      const store = useChatUiStore();

      expect(store.isConversationalMode).toBe(true);

      store.setChatMode('plan');
      expect(store.chatMode).toBe('plan');
      expect(store.isPlanMode).toBe(true);
      expect(store.isConversationalMode).toBe(false);

      store.setChatMode('build');
      expect(store.chatMode).toBe('build');
      expect(store.isBuildMode).toBe(true);
      expect(store.isPlanMode).toBe(false);

      // orchestrate mode removed in Orchestrator V2
    });
  });

  describe('Speech State', () => {
    it('should track last message speech state', () => {
      const store = useChatUiStore();

      expect(store.lastMessageWasSpeech).toBe(false);

      store.setLastMessageWasSpeech(true);
      expect(store.lastMessageWasSpeech).toBe(true);

      store.setLastMessageWasSpeech(false);
      expect(store.lastMessageWasSpeech).toBe(false);
    });
  });

  describe('Layout State', () => {
    it('should toggle sidebar', () => {
      const store = useChatUiStore();

      expect(store.sidebarCollapsed).toBe(false);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(true);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(false);
    });

    it('should set sidebar collapsed state', () => {
      const store = useChatUiStore();

      store.setSidebarCollapsed(true);
      expect(store.sidebarCollapsed).toBe(true);

      store.setSidebarCollapsed(false);
      expect(store.sidebarCollapsed).toBe(false);
    });

    it('should toggle right panel', () => {
      const store = useChatUiStore();

      expect(store.rightPanelVisible).toBe(true);

      store.toggleRightPanel();
      expect(store.rightPanelVisible).toBe(false);

      store.toggleRightPanel();
      expect(store.rightPanelVisible).toBe(true);
    });

    it('should set right panel visibility', () => {
      const store = useChatUiStore();

      store.setRightPanelVisible(false);
      expect(store.rightPanelVisible).toBe(false);

      store.setRightPanelVisible(true);
      expect(store.rightPanelVisible).toBe(true);
    });

    it('should track input focused state', () => {
      const store = useChatUiStore();

      expect(store.inputFocused).toBe(false);

      store.setInputFocused(true);
      expect(store.inputFocused).toBe(true);

      store.setInputFocused(false);
      expect(store.inputFocused).toBe(false);
    });
  });

  describe('Clear All', () => {
    it('should clear all UI state', () => {
      const store = useChatUiStore();

      // Set various UI state
      store.setActiveConversation('conv-123');
      store.setPendingAction({
        type: 'plan',
        status: 'in_progress',
      });
      store.setChatMode('build');
      store.setLastMessageWasSpeech(true);
      store.setSidebarCollapsed(true);
      store.setRightPanelVisible(false);
      store.setInputFocused(true);

      // Verify state is set
      expect(store.activeConversationId).toBe('conv-123');
      expect(store.pendingAction).not.toBeNull();
      expect(store.chatMode).toBe('build');
      expect(store.lastMessageWasSpeech).toBe(true);
      expect(store.sidebarCollapsed).toBe(true);
      expect(store.rightPanelVisible).toBe(false);
      expect(store.inputFocused).toBe(true);

      // Clear all
      store.clearAll();

      // Verify everything is reset
      expect(store.activeConversationId).toBeNull();
      expect(store.pendingAction).toBeNull();
      expect(store.chatMode).toBe('conversational');
      expect(store.lastMessageWasSpeech).toBe(false);
      expect(store.sidebarCollapsed).toBe(false);
      expect(store.rightPanelVisible).toBe(true);
      expect(store.inputFocused).toBe(false);
    });
  });

  describe('State Isolation', () => {
    it('should contain only UI state, no domain data', () => {
      const store = useChatUiStore();

      // Verify the store only exposes UI-related properties
      const storeKeys = Object.keys(store);

      // Should NOT have domain data
      expect(storeKeys).not.toContain('conversations');
      expect(storeKeys).not.toContain('messages');
      expect(storeKeys).not.toContain('tasks');
      expect(storeKeys).not.toContain('agents');
      expect(storeKeys).not.toContain('plans');
      expect(storeKeys).not.toContain('deliverables');

      // Should ONLY have UI state
      expect(storeKeys).toContain('activeConversationId');
      expect(storeKeys).toContain('pendingAction');
      expect(storeKeys).toContain('chatMode');
      expect(storeKeys).toContain('lastMessageWasSpeech');
      expect(storeKeys).toContain('sidebarCollapsed');
      expect(storeKeys).toContain('rightPanelVisible');
      expect(storeKeys).toContain('inputFocused');
    });
  });
});
