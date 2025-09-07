import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { useSanitizationStore } from './sanitizationStore';
import { useLlmUsageStore } from './llmUsageStore';
import { useAgentChatStore } from './agentChatStore';

// Types
export interface MessagePrivacyState {
  messageId: string;
  conversationId?: string;
  taskId?: string;
  
  // Data protection
  isDataProtected: boolean;
  dataProtectionLevel: 'none' | 'partial' | 'full';
  
  // Sanitization
  sanitizationStatus: 'none' | 'processing' | 'completed' | 'failed';
  piiDetectionCount: number;
  sanitizationProcessingTime: number;
  
  // Routing
  routingMode: 'local' | 'external' | 'hybrid';
  routingProvider: string | null;
  
  // Trust
  trustLevel: 'high' | 'medium' | 'low';
  trustScore: number | null;
  
  // Processing
  processingTimeMs: number;
  isProcessing: boolean;
  
  // Errors
  hasErrors: boolean;
  errorMessage: string | null;
  
  // Metadata
  lastUpdated: Date;
  updateCount: number;
}

export interface ConversationPrivacySettings {
  conversationId: string;
  
  // Display preferences
  showDataProtection: boolean;
  showSanitizationStatus: boolean;
  showRoutingDisplay: boolean;
  showTrustSignal: boolean;
  showPiiCount: boolean;
  showProcessingTime: boolean;
  
  // Real-time settings
  enableRealTimeUpdates: boolean;
  updateInterval: number;
  
  // UI settings
  compactMode: boolean;
  position: 'top' | 'bottom' | 'inline';
}

export const usePrivacyIndicatorsStore = defineStore('privacyIndicators', () => {
  // =====================================
  // STATE
  // =====================================
  
  // Message-specific privacy states
  const messageStates = ref<Map<string, MessagePrivacyState>>(new Map());
  
  // Conversation-specific settings
  const conversationSettings = ref<Map<string, ConversationPrivacySettings>>(new Map());
  
  // Global settings
  const globalSettings = ref({
    enableGlobalRealTime: true,
    defaultUpdateInterval: 2000,
    maxStoredStates: 100,
    autoCleanupAge: 3600000, // 1 hour in ms
    debugMode: false
  });
  
  // Processing state
  const isInitialized = ref(false);
  const activeUpdateTimers = ref<Map<string, NodeJS.Timeout>>(new Map());
  const lastGlobalUpdate = ref<Date | null>(null);
  
  // =====================================
  // GETTERS
  // =====================================
  
  /**
   * Get privacy state for a specific message
   */
  const getMessagePrivacyState = computed(() => {
    return (messageId: string): MessagePrivacyState | null => {
      return messageStates.value.get(messageId) || null;
    };
  });
  
  /**
   * Get conversation settings
   */
  const getConversationSettings = computed(() => {
    return (conversationId: string): ConversationPrivacySettings | null => {
      return conversationSettings.value.get(conversationId) || null;
    };
  });
  
  /**
   * Get all message states for a conversation
   */
  const getConversationMessageStates = computed(() => {
    return (conversationId: string): MessagePrivacyState[] => {
      return Array.from(messageStates.value.values())
        .filter(state => state.conversationId === conversationId)
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    };
  });
  
  /**
   * Get conversation privacy summary
   */
  const getConversationPrivacySummary = computed(() => {
    return (conversationId: string) => {
      const states = getConversationMessageStates.value(conversationId);
      
      if (states.length === 0) {
        return {
          totalMessages: 0,
          protectedMessages: 0,
          sanitizedMessages: 0,
          averageTrustScore: null,
          hasErrors: false,
          lastUpdate: null
        };
      }
      
      const protectedCount = states.filter(s => s.isDataProtected).length;
      const sanitizedCount = states.filter(s => s.sanitizationStatus === 'completed').length;
      const trustScores = states.filter(s => s.trustScore !== null).map(s => s.trustScore!);
      const averageTrustScore = trustScores.length > 0 
        ? trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length 
        : null;
      const hasErrors = states.some(s => s.hasErrors);
      const lastUpdate = states[0]?.lastUpdated || null;
      
      return {
        totalMessages: states.length,
        protectedMessages: protectedCount,
        sanitizedMessages: sanitizedCount,
        averageTrustScore: averageTrustScore ? Math.round(averageTrustScore) : null,
        hasErrors,
        lastUpdate
      };
    };
  });
  
  /**
   * Get global privacy statistics
   */
  const globalPrivacyStats = computed(() => {
    const allStates = Array.from(messageStates.value.values());
    
    if (allStates.length === 0) {
      return {
        totalMessages: 0,
        totalConversations: 0,
        protectedPercentage: 0,
        averageTrustScore: null,
        totalPiiDetected: 0,
        averageProcessingTime: 0
      };
    }
    
    const conversationIds = new Set(allStates.map(s => s.conversationId).filter(Boolean));
    const protectedCount = allStates.filter(s => s.isDataProtected).length;
    const trustScores = allStates.filter(s => s.trustScore !== null).map(s => s.trustScore!);
    const totalPii = allStates.reduce((sum, s) => sum + s.piiDetectionCount, 0);
    const processingTimes = allStates.filter(s => s.processingTimeMs > 0).map(s => s.processingTimeMs);
    
    return {
      totalMessages: allStates.length,
      totalConversations: conversationIds.size,
      protectedPercentage: Math.round((protectedCount / allStates.length) * 100),
      averageTrustScore: trustScores.length > 0 
        ? Math.round(trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length)
        : null,
      totalPiiDetected: totalPii,
      averageProcessingTime: processingTimes.length > 0
        ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
        : 0
    };
  });
  
  // =====================================
  // ACTIONS
  // =====================================
  
  /**
   * Initialize the privacy indicators store
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    
    // Start global cleanup timer
    setInterval(cleanupOldStates, 300000); // Clean every 5 minutes
    
    isInitialized.value = true;
    lastGlobalUpdate.value = new Date();
    
    if (globalSettings.value.debugMode) {
      console.log('[PrivacyIndicatorsStore] Initialized');
    }
  }
  
  /**
   * Create or update privacy state for a message
   */
  function updateMessagePrivacyState(
    messageId: string,
    updates: Partial<MessagePrivacyState>
  ): MessagePrivacyState {
    const existing = messageStates.value.get(messageId);
    
    const newState: MessagePrivacyState = {
      messageId,
      conversationId: updates.conversationId || existing?.conversationId,
      taskId: updates.taskId || existing?.taskId,
      
      // Data protection
      isDataProtected: updates.isDataProtected ?? existing?.isDataProtected ?? false,
      dataProtectionLevel: updates.dataProtectionLevel ?? existing?.dataProtectionLevel ?? 'none',
      
      // Sanitization
      sanitizationStatus: updates.sanitizationStatus ?? existing?.sanitizationStatus ?? 'none',
      piiDetectionCount: updates.piiDetectionCount ?? existing?.piiDetectionCount ?? 0,
      sanitizationProcessingTime: updates.sanitizationProcessingTime ?? existing?.sanitizationProcessingTime ?? 0,
      
      // Routing
      routingMode: updates.routingMode ?? existing?.routingMode ?? 'local',
      routingProvider: updates.routingProvider ?? existing?.routingProvider ?? null,
      
      // Trust
      trustLevel: updates.trustLevel ?? existing?.trustLevel ?? 'medium',
      trustScore: updates.trustScore ?? existing?.trustScore ?? null,
      
      // Processing
      processingTimeMs: updates.processingTimeMs ?? existing?.processingTimeMs ?? 0,
      isProcessing: updates.isProcessing ?? existing?.isProcessing ?? false,
      
      // Errors
      hasErrors: updates.hasErrors ?? existing?.hasErrors ?? false,
      errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,
      
      // Metadata
      lastUpdated: new Date(),
      updateCount: (existing?.updateCount ?? 0) + 1
    };
    
    messageStates.value.set(messageId, newState);
    
    if (globalSettings.value.debugMode) {
      console.log(`[PrivacyIndicatorsStore] Updated message ${messageId}:`, newState);
    }
    
    return newState;
  }
  
  /**
   * Set conversation privacy settings
   */
  function setConversationSettings(
    conversationId: string,
    settings: Partial<ConversationPrivacySettings>
  ): ConversationPrivacySettings {
    const existing = conversationSettings.value.get(conversationId);
    
    const newSettings: ConversationPrivacySettings = {
      conversationId,
      
      // Display preferences
      showDataProtection: settings.showDataProtection ?? existing?.showDataProtection ?? true,
      showSanitizationStatus: settings.showSanitizationStatus ?? existing?.showSanitizationStatus ?? true,
      showRoutingDisplay: settings.showRoutingDisplay ?? existing?.showRoutingDisplay ?? true,
      showTrustSignal: settings.showTrustSignal ?? existing?.showTrustSignal ?? true,
      showPiiCount: settings.showPiiCount ?? existing?.showPiiCount ?? true,
      showProcessingTime: settings.showProcessingTime ?? existing?.showProcessingTime ?? false,
      
      // Real-time settings
      enableRealTimeUpdates: settings.enableRealTimeUpdates ?? existing?.enableRealTimeUpdates ?? true,
      updateInterval: settings.updateInterval ?? existing?.updateInterval ?? globalSettings.value.defaultUpdateInterval,
      
      // UI settings
      compactMode: settings.compactMode ?? existing?.compactMode ?? false,
      position: settings.position ?? existing?.position ?? 'inline'
    };
    
    conversationSettings.value.set(conversationId, newSettings);
    
    // Update real-time timer if needed
    if (newSettings.enableRealTimeUpdates) {
      startConversationRealTimeUpdates(conversationId);
    } else {
      stopConversationRealTimeUpdates(conversationId);
    }
    
    return newSettings;
  }
  
  /**
   * Start real-time updates for a conversation
   */
  function startConversationRealTimeUpdates(conversationId: string): void {
    const settings = conversationSettings.value.get(conversationId);
    if (!settings?.enableRealTimeUpdates) return;
    
    // Clear existing timer
    stopConversationRealTimeUpdates(conversationId);
    
    const timer = setInterval(() => {
      refreshConversationPrivacyStates(conversationId);
    }, settings.updateInterval);
    
    activeUpdateTimers.value.set(conversationId, timer);
    
    if (globalSettings.value.debugMode) {
      console.log(`[PrivacyIndicatorsStore] Started real-time updates for conversation ${conversationId}`);
    }
  }
  
  /**
   * Stop real-time updates for a conversation
   */
  function stopConversationRealTimeUpdates(conversationId: string): void {
    const timer = activeUpdateTimers.value.get(conversationId);
    if (timer) {
      clearInterval(timer);
      activeUpdateTimers.value.delete(conversationId);
      
      if (globalSettings.value.debugMode) {
        console.log(`[PrivacyIndicatorsStore] Stopped real-time updates for conversation ${conversationId}`);
      }
    }
  }
  
  /**
   * Refresh privacy states for all messages in a conversation
   */
  async function refreshConversationPrivacyStates(conversationId: string): Promise<void> {
    const agentChatStore = useAgentChatStore();
    const sanitizationStore = useSanitizationStore();
    
    // Get conversation messages
    const conversation = agentChatStore.conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    // Update each message's privacy state
    for (const message of conversation.messages) {
      if (message.role === 'assistant') {
        await updateMessagePrivacyFromSources(message.id, message);
      }
    }
  }
  
  /**
   * Update message privacy state from external sources
   */
  async function updateMessagePrivacyFromSources(
    messageId: string,
    message: any
  ): Promise<MessagePrivacyState> {
    const sanitizationStore = useSanitizationStore();
    
    // Extract routing info from message metadata
    const routingInfo = extractRoutingInfo(message);
    
    // Calculate trust score
    const trustInfo = calculateTrustScore(message, sanitizationStore);
    
    // Determine data protection status
    const protectionInfo = calculateDataProtection(message, sanitizationStore, routingInfo);
    
    // Update the message state
    return updateMessagePrivacyState(messageId, {
      conversationId: message.conversationId,
      taskId: message.taskId,
      
      // Sanitization data
      sanitizationStatus: sanitizationStore.isProcessing ? 'processing' : 
        sanitizationStore.currentResult?.success ? 'completed' : 'none',
      piiDetectionCount: sanitizationStore.currentResult?.totalDetections || 0,
      sanitizationProcessingTime: sanitizationStore.currentResult?.totalProcessingTime || 0,
      
      // Routing data
      routingMode: routingInfo.mode,
      routingProvider: routingInfo.provider,
      
      // Trust data
      trustLevel: trustInfo.level,
      trustScore: trustInfo.score,
      
      // Protection data
      isDataProtected: protectionInfo.isProtected,
      dataProtectionLevel: protectionInfo.level,
      
      // Processing data
      processingTimeMs: message.metadata?.llmMetadata?.responseTimeMs || 0,
      isProcessing: sanitizationStore.isProcessing,
      
      // Error data
      hasErrors: sanitizationStore.error !== null,
      errorMessage: sanitizationStore.error
    });
  }
  
  /**
   * Remove privacy state for a message
   */
  function removeMessagePrivacyState(messageId: string): boolean {
    return messageStates.value.delete(messageId);
  }
  
  /**
   * Clear all privacy states for a conversation
   */
  function clearConversationPrivacyStates(conversationId: string): void {
    const messagesToRemove: string[] = [];
    
    for (const [messageId, state] of messageStates.value.entries()) {
      if (state.conversationId === conversationId) {
        messagesToRemove.push(messageId);
      }
    }
    
    messagesToRemove.forEach(messageId => {
      messageStates.value.delete(messageId);
    });
    
    // Stop real-time updates
    stopConversationRealTimeUpdates(conversationId);
    
    // Remove conversation settings
    conversationSettings.value.delete(conversationId);
  }
  
  /**
   * Clean up old privacy states
   */
  function cleanupOldStates(): void {
    const now = Date.now();
    const maxAge = globalSettings.value.autoCleanupAge;
    const messagesToRemove: string[] = [];
    
    for (const [messageId, state] of messageStates.value.entries()) {
      if (now - state.lastUpdated.getTime() > maxAge) {
        messagesToRemove.push(messageId);
      }
    }
    
    messagesToRemove.forEach(messageId => {
      messageStates.value.delete(messageId);
    });
    
    // Enforce max stored states limit
    if (messageStates.value.size > globalSettings.value.maxStoredStates) {
      const sortedStates = Array.from(messageStates.value.entries())
        .sort(([,a], [,b]) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
      
      const toRemove = sortedStates.slice(0, messageStates.value.size - globalSettings.value.maxStoredStates);
      toRemove.forEach(([messageId]) => {
        messageStates.value.delete(messageId);
      });
    }
    
    if (globalSettings.value.debugMode && messagesToRemove.length > 0) {
      console.log(`[PrivacyIndicatorsStore] Cleaned up ${messagesToRemove.length} old states`);
    }
  }
  
  // =====================================
  // HELPER FUNCTIONS
  // =====================================
  
  function extractRoutingInfo(message: any): { mode: 'local' | 'external' | 'hybrid', provider: string | null } {
    const llmMeta = message.metadata?.llmMetadata;
    if (!llmMeta) return { mode: 'local', provider: null };
    
    const provider = llmMeta.providerName || llmMeta.providerId;
    
    let mode: 'local' | 'external' | 'hybrid' = 'external';
    if (!provider || provider === 'local' || provider === 'ollama') {
      mode = 'local';
    } else if (provider.includes('hybrid')) {
      mode = 'hybrid';
    }
    
    return { mode, provider };
  }
  
  function calculateTrustScore(message: any, sanitizationStore: any): { level: 'high' | 'medium' | 'low', score: number } {
    let score = 70; // Base score
    
    // Check sanitization
    if (sanitizationStore.currentResult?.success) {
      score += 15;
    }
    
    // Check routing
    const routing = extractRoutingInfo(message);
    if (routing.mode === 'local') {
      score += 10;
    }
    
    // Check errors
    if (sanitizationStore.error) {
      score -= 20;
    }
    
    // Determine level
    let level: 'high' | 'medium' | 'low' = 'medium';
    if (score >= 85) level = 'high';
    else if (score <= 60) level = 'low';
    
    return { level, score: Math.max(0, Math.min(100, score)) };
  }
  
  function calculateDataProtection(message: any, sanitizationStore: any, routingInfo: any): { isProtected: boolean, level: 'none' | 'partial' | 'full' } {
    const hasSanitization = sanitizationStore.currentResult?.success;
    const isLocal = routingInfo.mode === 'local';
    const hasNoErrors = !sanitizationStore.error;
    
    if (hasSanitization && hasNoErrors) {
      return {
        isProtected: true,
        level: isLocal ? 'full' : 'partial'
      };
    }
    
    return { isProtected: false, level: 'none' };
  }
  
  // =====================================
  // RETURN
  // =====================================
  
  return {
    // State
    messageStates: readonly(messageStates),
    conversationSettings: readonly(conversationSettings),
    globalSettings,
    isInitialized: readonly(isInitialized),
    lastGlobalUpdate: readonly(lastGlobalUpdate),
    
    // Getters
    getMessagePrivacyState,
    getConversationSettings,
    getConversationMessageStates,
    getConversationPrivacySummary,
    globalPrivacyStats,
    
    // Actions
    initialize,
    updateMessagePrivacyState,
    setConversationSettings,
    startConversationRealTimeUpdates,
    stopConversationRealTimeUpdates,
    refreshConversationPrivacyStates,
    updateMessagePrivacyFromSources,
    removeMessagePrivacyState,
    clearConversationPrivacyStates,
    cleanupOldStates
  };
});
