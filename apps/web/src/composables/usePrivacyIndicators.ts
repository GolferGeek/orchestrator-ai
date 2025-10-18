import { ref, computed, watch, onMounted, onUnmounted, readonly } from 'vue';
import { useSanitizationStore } from '@/stores/sanitizationStore';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import type { AgentChatMessage } from '@/types/conversation';

export interface PrivacyStatus {
  // Data protection status
  isDataProtected: boolean;
  dataProtectionLevel: 'none' | 'partial' | 'full';
  
  // Sanitization status
  sanitizationStatus: 'none' | 'processing' | 'completed' | 'failed';
  piiDetectionCount: number;
  sanitizationProcessingTime: number;
  
  // Routing information
  routingMode: 'local' | 'external' | 'hybrid';
  routingProvider: string | null;
  
  // Trust signals
  trustLevel: 'high' | 'medium' | 'low';
  trustScore: number | null;
  
  // Processing metrics
  processingTimeMs: number;
  isProcessing: boolean;
  
  // Error states
  hasErrors: boolean;
  errorMessage: string | null;
}

export interface PrivacyIndicatorOptions {
  // Message context
  messageId?: string;
  taskId?: string;
  conversationId?: string;
  
  // Real-time updates
  enableRealTimeUpdates?: boolean;
  updateInterval?: number; // milliseconds
  
  // Display options
  showAllIndicators?: boolean;
  compactMode?: boolean;
}

/**
 * Composable for managing privacy indicators and real-time status updates
 */
export function usePrivacyIndicators(options: PrivacyIndicatorOptions = {}) {
  // =====================================
  // STORES
  // =====================================
  
  const sanitizationStore = useSanitizationStore();
  const _llmAnalyticsStore = useLLMAnalyticsStore();
  const chatUiStore = useChatUiStore();
  
  // =====================================
  // STATE
  // =====================================
  
  const privacyStatus = ref<PrivacyStatus>({
    isDataProtected: false,
    dataProtectionLevel: 'none',
    sanitizationStatus: 'none',
    piiDetectionCount: 0,
    sanitizationProcessingTime: 0,
    routingMode: 'local',
    routingProvider: null,
    trustLevel: 'medium',
    trustScore: null,
    processingTimeMs: 0,
    isProcessing: false,
    hasErrors: false,
    errorMessage: null
  });
  
  const isInitialized = ref(false);
  const updateTimer = ref<NodeJS.Timeout | null>(null);
  
  // =====================================
  // COMPUTED PROPERTIES
  // =====================================
  
  /**
   * Current message being tracked
   */
  const currentMessage = computed((): AgentChatMessage | null => {
    if (!options.messageId) return null;
    
    const conversation = chatUiStore.activeConversation;
    if (!conversation) return null;
    
    return conversation.messages.find(msg => msg.id === options.messageId) || null;
  });
  
  /**
   * Sanitization data from current processing
   */
  const sanitizationData = computed(() => {
    const result = sanitizationStore.currentResult;
    if (!result) return null;
    
    return {
      status: result.success ? 'completed' : 'failed',
      piiCount: result.totalDetections,
      processingTime: result.totalProcessingTime,
      hasErrors: !result.success,
      errorMessage: result.error || null
    };
  });
  
  /**
   * LLM routing information
   */
  const routingInfo = computed(() => {
    if (!currentMessage.value?.metadata?.llmMetadata) {
      return {
        mode: 'local' as const,
        provider: null
      };
    }
    
    const llmMeta = currentMessage.value.metadata.llmMetadata;
    const provider = llmMeta.providerName || llmMeta.providerId;
    
    // Determine routing mode based on provider
    let mode: 'local' | 'external' | 'hybrid' = 'external';
    if (!provider || provider === 'local' || provider === 'ollama') {
      mode = 'local';
    } else if (provider.includes('hybrid')) {
      mode = 'hybrid';
    }
    
    return {
      mode,
      provider
    };
  });
  
  /**
   * Trust score calculation based on various factors
   */
  const trustCalculation = computed(() => {
    let score = 70; // Base trust score
    let level: 'high' | 'medium' | 'low' = 'medium';
    
    // Increase trust for data protection
    if (privacyStatus.value.isDataProtected) {
      score += 15;
    }
    
    // Increase trust for successful sanitization
    if (privacyStatus.value.sanitizationStatus === 'completed') {
      score += 10;
    }
    
    // Increase trust for local processing
    if (privacyStatus.value.routingMode === 'local') {
      score += 10;
    }
    
    // Decrease trust for errors
    if (privacyStatus.value.hasErrors) {
      score -= 20;
    }
    
    // Decrease trust for failed sanitization
    if (privacyStatus.value.sanitizationStatus === 'failed') {
      score -= 15;
    }
    
    // Determine trust level
    if (score >= 85) {
      level = 'high';
    } else if (score <= 60) {
      level = 'low';
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      level
    };
  });
  
  /**
   * Data protection status based on sanitization and routing
   */
  const dataProtectionStatus = computed(() => {
    const hasSanitization = privacyStatus.value.sanitizationStatus === 'completed';
    const isLocalRouting = privacyStatus.value.routingMode === 'local';
    const hasNoErrors = !privacyStatus.value.hasErrors;
    
    let level: 'none' | 'partial' | 'full' = 'none';
    let isProtected = false;
    
    if (hasSanitization && hasNoErrors) {
      if (isLocalRouting) {
        level = 'full';
        isProtected = true;
      } else {
        level = 'partial';
        isProtected = true;
      }
    }
    
    return {
      isProtected,
      level
    };
  });
  
  // =====================================
  // METHODS
  // =====================================
  
  /**
   * Update privacy status from all available sources
   */
  function updatePrivacyStatus(): void {
    const sanitizationData = sanitizationStore.currentResult;
    const routingData = routingInfo.value;
    const trustData = trustCalculation.value;
    const protectionData = dataProtectionStatus.value;
    
    // Update sanitization status
    if (sanitizationStore.isProcessing) {
      privacyStatus.value.sanitizationStatus = 'processing';
    } else if (sanitizationData) {
      privacyStatus.value.sanitizationStatus = sanitizationData.success ? 'completed' : 'failed';
      privacyStatus.value.piiDetectionCount = sanitizationData.totalDetections;
      privacyStatus.value.sanitizationProcessingTime = sanitizationData.totalProcessingTime;
      privacyStatus.value.hasErrors = !sanitizationData.success;
      privacyStatus.value.errorMessage = sanitizationData.error || null;
    }
    
    // Update routing information
    privacyStatus.value.routingMode = routingData.mode;
    privacyStatus.value.routingProvider = routingData.provider;
    
    // Update trust signals
    privacyStatus.value.trustLevel = trustData.level;
    privacyStatus.value.trustScore = trustData.score;
    
    // Update data protection
    privacyStatus.value.isDataProtected = protectionData.isProtected;
    privacyStatus.value.dataProtectionLevel = protectionData.level;
    
    // Update processing status
    privacyStatus.value.isProcessing = sanitizationStore.isProcessing;
    
    // Update processing time from message metadata
    if (currentMessage.value?.metadata?.llmMetadata?.responseTimeMs) {
      privacyStatus.value.processingTimeMs = currentMessage.value.metadata.llmMetadata.responseTimeMs;
    }
  }
  
  /**
   * Start real-time updates
   */
  function startRealTimeUpdates(): void {
    if (!options.enableRealTimeUpdates) return;
    
    const interval = options.updateInterval || 1000; // Default 1 second
    
    updateTimer.value = setInterval(() => {
      updatePrivacyStatus();
    }, interval);
  }
  
  /**
   * Stop real-time updates
   */
  function stopRealTimeUpdates(): void {
    if (updateTimer.value) {
      clearInterval(updateTimer.value);
      updateTimer.value = null;
    }
  }
  
  /**
   * Initialize privacy indicators
   */
  function initialize(): void {
    updatePrivacyStatus();
    
    if (options.enableRealTimeUpdates) {
      startRealTimeUpdates();
    }
    
    isInitialized.value = true;
  }
  
  /**
   * Manually refresh privacy status
   */
  function refresh(): void {
    updatePrivacyStatus();
  }
  
  /**
   * Reset privacy status to defaults
   */
  function reset(): void {
    privacyStatus.value = {
      isDataProtected: false,
      dataProtectionLevel: 'none',
      sanitizationStatus: 'none',
      piiDetectionCount: 0,
      sanitizationProcessingTime: 0,
      routingMode: 'local',
      routingProvider: null,
      trustLevel: 'medium',
      trustScore: null,
      processingTimeMs: 0,
      isProcessing: false,
      hasErrors: false,
      errorMessage: null
    };
  }
  
  // =====================================
  // WATCHERS
  // =====================================
  
  // Watch for sanitization store changes
  watch(
    () => sanitizationStore.currentResult,
    () => {
      if (isInitialized.value) {
        updatePrivacyStatus();
      }
    },
    { deep: true }
  );
  
  // Watch for processing status changes
  watch(
    () => sanitizationStore.isProcessing,
    () => {
      if (isInitialized.value) {
        updatePrivacyStatus();
      }
    }
  );
  
  // Watch for message metadata changes
  watch(
    () => currentMessage.value?.metadata,
    () => {
      if (isInitialized.value && currentMessage.value) {
        updatePrivacyStatus();
      }
    },
    { deep: true }
  );
  
  // =====================================
  // LIFECYCLE
  // =====================================
  
  onMounted(() => {
    initialize();
  });
  
  onUnmounted(() => {
    stopRealTimeUpdates();
  });
  
  // =====================================
  // RETURN
  // =====================================
  
  return {
    // State
    privacyStatus: readonly(privacyStatus),
    isInitialized: readonly(isInitialized),
    
    // Computed
    currentMessage,
    sanitizationData,
    routingInfo,
    trustCalculation,
    dataProtectionStatus,
    
    // Methods
    initialize,
    refresh,
    reset,
    updatePrivacyStatus,
    startRealTimeUpdates,
    stopRealTimeUpdates
  };
}

/**
 * Simplified version for basic privacy status tracking
 */
export function useBasicPrivacyIndicators(messageId?: string) {
  return usePrivacyIndicators({
    messageId,
    enableRealTimeUpdates: true,
    updateInterval: 2000, // 2 seconds
    showAllIndicators: true
  });
}

/**
 * Compact version for space-constrained areas
 */
export function useCompactPrivacyIndicators(messageId?: string) {
  return usePrivacyIndicators({
    messageId,
    enableRealTimeUpdates: false,
    compactMode: true,
    showAllIndicators: false
  });
}
