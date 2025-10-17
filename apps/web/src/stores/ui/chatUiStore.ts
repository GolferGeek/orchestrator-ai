/**
 * Chat UI Store
 * Manages UI-only state for chat interface
 *
 * This store contains ONLY UI state - no domain data.
 * Domain data (conversations, messages, tasks) lives in domain stores.
 *
 * Architecture:
 * - UI State ONLY (no domain data)
 * - Synchronous mutations only
 * - No API calls, no business logic
 * - Vue reactivity updates UI automatically
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';

// ============================================================================
// Types
// ============================================================================

/**
 * Chat mode for conversation
 */
export type ChatMode = 'conversational' | 'plan' | 'build' | 'orchestrate';

/**
 * Pending action in UI
 */
export interface PendingAction {
  type: 'plan' | 'build' | 'orchestration';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Store Definition
// ============================================================================

export const useChatUiStore = defineStore('chatUi', () => {
  // ============================================================================
  // STATE - UI-only reactive data
  // ============================================================================

  const activeConversationId = ref<string | null>(null);
  const openConversationTabs = ref<string[]>([]); // Array of open conversation tab IDs
  const pendingAction = ref<PendingAction | null>(null);
  const chatMode = ref<ChatMode>('conversational');
  const lastMessageWasSpeech = ref(false);

  // UI layout state
  const sidebarCollapsed = ref(false);
  const rightPanelVisible = ref(true);
  const inputFocused = ref(false);

  // ============================================================================
  // GETTERS - Computed UI state
  // ============================================================================

  const hasActiveConversation = computed(() => activeConversationId.value !== null);

  const hasPendingAction = computed(() => pendingAction.value !== null);

  const isPendingActionInProgress = computed(() =>
    pendingAction.value?.status === 'in_progress'
  );

  const isConversationalMode = computed(() => chatMode.value === 'conversational');
  const isPlanMode = computed(() => chatMode.value === 'plan');
  const isBuildMode = computed(() => chatMode.value === 'build');
  const isOrchestrateMode = computed(() => chatMode.value === 'orchestrate');

  // ============================================================================
  // MUTATIONS - ONLY way to mutate state (synchronous only)
  // ============================================================================

  /**
   * Set active conversation
   */
  function setActiveConversation(conversationId: string | null): void {
    activeConversationId.value = conversationId;

    // Add to open tabs if not already there
    if (conversationId && !openConversationTabs.value.includes(conversationId)) {
      openConversationTabs.value.push(conversationId);
    }
  }

  /**
   * Open conversation tab
   */
  function openConversationTab(conversationId: string): void {
    if (!openConversationTabs.value.includes(conversationId)) {
      openConversationTabs.value.push(conversationId);
    }
    setActiveConversation(conversationId);
  }

  /**
   * Close conversation tab
   */
  function closeConversationTab(conversationId: string): void {
    const index = openConversationTabs.value.indexOf(conversationId);
    if (index > -1) {
      openConversationTabs.value.splice(index, 1);
    }

    // If closing active tab, switch to another open tab or null
    if (activeConversationId.value === conversationId) {
      if (openConversationTabs.value.length > 0) {
        // Switch to the last tab
        activeConversationId.value = openConversationTabs.value[openConversationTabs.value.length - 1];
      } else {
        activeConversationId.value = null;
      }
    }
  }

  /**
   * Set pending action
   */
  function setPendingAction(action: PendingAction | null): void {
    pendingAction.value = action;
  }

  /**
   * Update pending action status
   */
  function updatePendingActionStatus(status: PendingAction['status']): void {
    if (pendingAction.value) {
      pendingAction.value = {
        ...pendingAction.value,
        status,
      };
    }
  }

  /**
   * Clear pending action
   */
  function clearPendingAction(): void {
    pendingAction.value = null;
  }

  /**
   * Set chat mode
   */
  function setChatMode(mode: ChatMode): void {
    chatMode.value = mode;
  }

  /**
   * Set last message was speech flag
   */
  function setLastMessageWasSpeech(wasSpeech: boolean): void {
    lastMessageWasSpeech.value = wasSpeech;
  }

  /**
   * Toggle sidebar collapsed state
   */
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  /**
   * Set sidebar collapsed state
   */
  function setSidebarCollapsed(collapsed: boolean): void {
    sidebarCollapsed.value = collapsed;
  }

  /**
   * Toggle right panel visibility
   */
  function toggleRightPanel(): void {
    rightPanelVisible.value = !rightPanelVisible.value;
  }

  /**
   * Set right panel visibility
   */
  function setRightPanelVisible(visible: boolean): void {
    rightPanelVisible.value = visible;
  }

  /**
   * Set input focused state
   */
  function setInputFocused(focused: boolean): void {
    inputFocused.value = focused;
  }

  /**
   * Clear all UI state (logout or reset)
   */
  function clearAll(): void {
    activeConversationId.value = null;
    openConversationTabs.value = [];
    pendingAction.value = null;
    chatMode.value = 'conversational';
    lastMessageWasSpeech.value = false;
    sidebarCollapsed.value = false;
    rightPanelVisible.value = true;
    inputFocused.value = false;
  }

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State (read-only exposure)
    activeConversationId: readonly(activeConversationId),
    openConversationTabs: readonly(openConversationTabs),
    pendingAction: readonly(pendingAction),
    chatMode: readonly(chatMode),
    lastMessageWasSpeech: readonly(lastMessageWasSpeech),
    sidebarCollapsed: readonly(sidebarCollapsed),
    rightPanelVisible: readonly(rightPanelVisible),
    inputFocused: readonly(inputFocused),

    // Computed getters
    hasActiveConversation,
    hasPendingAction,
    isPendingActionInProgress,
    isConversationalMode,
    isPlanMode,
    isBuildMode,
    isOrchestrateMode,

    // Mutations
    setActiveConversation,
    openConversationTab,
    closeConversationTab,
    setPendingAction,
    updatePendingActionStatus,
    clearPendingAction,
    setChatMode,
    setLastMessageWasSpeech,
    toggleSidebar,
    setSidebarCollapsed,
    toggleRightPanel,
    setRightPanelVisible,
    setInputFocused,
    clearAll,
  };
});
