import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { piiService } from '@/services/piiService';
import { PIITestRequest, PIITestResponse } from '@/types/pii';

export interface SanitizationPhaseData {
  id: string;
  title: string;
  subtitle: string;
  inputLabel?: string;
  outputLabel?: string;
  inputText: string;
  outputText: string;
  patterns: SanitizationPattern[];
  metrics: SanitizationMetrics | null;
  performanceData: PerformanceMetric[] | null;
}

export interface SanitizationPattern {
  id: string;
  type: string;
  originalValue: string;
  replacementValue: string;
  description: string;
}

export interface SanitizationMetrics {
  processingTimeMs: number;
  detectedCount?: number;
}

export interface PerformanceMetric {
  label: string;
  value: number;
  unit: string;
  percentage: number;
  color: string;
}

export interface SanitizationResult {
  originalText: string;
  sanitizedText: string;
  phases: SanitizationPhaseData[];
  totalProcessingTime: number;
  totalDetections: number;
  success: boolean;
  error?: string;
}

export const useSanitizationStore = defineStore('sanitization', () => {
  // =====================================
  // STATE
  // =====================================
  
  const currentResult = ref<SanitizationResult | null>(null);
  const isProcessing = ref(false);
  const error = ref<string | null>(null);
  const lastProcessed = ref<Date | null>(null);
  
  // Processing history
  const processingHistory = ref<SanitizationResult[]>([]);
  const maxHistorySize = ref(50);
  
  // =====================================
  // GETTERS
  // =====================================
  
  const hasResult = computed(() => currentResult.value !== null);
  
  const totalPhases = computed(() => {
    return currentResult.value?.phases?.length || 0;
  });
  
  const totalProcessingTime = computed(() => {
    return currentResult.value?.totalProcessingTime || 0;
  });
  
  const totalDetections = computed(() => {
    return currentResult.value?.totalDetections || 0;
  });
  
  const processingStats = computed(() => {
    if (!currentResult.value) return null;
    
    const phases = currentResult.value.phases;
    return {
      totalPhases: phases.length,
      totalTime: currentResult.value.totalProcessingTime,
      totalDetections: currentResult.value.totalDetections,
      averagePhaseTime: phases.length > 0 
        ? currentResult.value.totalProcessingTime / phases.length 
        : 0,
      phaseBreakdown: phases.map(phase => ({
        id: phase.id,
        title: phase.title,
        time: phase.metrics?.processingTimeMs || 0,
        detections: phase.metrics?.detectedCount || 0
      }))
    };
  });
  
  const recentResults = computed(() => {
    return processingHistory.value.slice(-10);
  });
  
  // =====================================
  // ACTIONS
  // =====================================
  
  /**
   * Process text through sanitization pipeline
   */
  async function processText(
    text: string,
    options: {
      enableRedaction?: boolean;
      enablePseudonymization?: boolean;
      context?: string;
    } = {}
  ): Promise<SanitizationResult> {
    isProcessing.value = true;
    error.value = null;
    
    try {
      const request: PIITestRequest = {
        text,
        enableRedaction: options.enableRedaction ?? true,
        enablePseudonymization: options.enablePseudonymization ?? true,
        context: options.context || 'sanitization-inspector'
      };
      
      const startTime = Date.now();
      const response: PIITestResponse = await piiService.sanitizeText(request);
      const endTime = Date.now();
      
      const result = transformAPIResponseToResult(text, response, endTime - startTime);
      
      currentResult.value = result;
      lastProcessed.value = new Date();
      
      // Add to history
      addToHistory(result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sanitization error';
      error.value = errorMessage;
      
      // Create error result
      const errorResult: SanitizationResult = {
        originalText: text,
        sanitizedText: text,
        phases: [],
        totalProcessingTime: 0,
        totalDetections: 0,
        success: false,
        error: errorMessage
      };
      
      currentResult.value = errorResult;
      throw err;
    } finally {
      isProcessing.value = false;
    }
  }
  
  /**
   * Clear current result
   */
  function clearResult(): void {
    currentResult.value = null;
    error.value = null;
  }
  
  /**
   * Clear processing history
   */
  function clearHistory(): void {
    processingHistory.value = [];
  }
  
  /**
   * Get result from history by index
   */
  function getHistoryResult(index: number): SanitizationResult | null {
    return processingHistory.value[index] || null;
  }
  
  /**
   * Load result from history as current
   */
  function loadHistoryResult(index: number): boolean {
    const result = getHistoryResult(index);
    if (result) {
      currentResult.value = result;
      return true;
    }
    return false;
  }
  
  // =====================================
  // PRIVATE HELPERS
  // =====================================
  
  /**
   * Transform API response to internal result format
   */
  function transformAPIResponseToResult(
    originalText: string, 
    response: PIITestResponse, 
    totalTime: number
  ): SanitizationResult {
    // For now, create a simplified transformation
    // In the future, this should parse the actual API response structure
    const phases: SanitizationPhaseData[] = [
      {
        id: 'input',
        title: 'Input Text',
        subtitle: 'Original text before processing',
        inputText: originalText,
        outputText: originalText,
        patterns: [],
        metrics: { processingTimeMs: 5 },
        performanceData: [
          { label: 'Validation', value: 2, unit: 'ms', percentage: 40, color: '#10b981' },
          { label: 'Parsing', value: 3, unit: 'ms', percentage: 60, color: '#3b82f6' }
        ]
      }
    ];
    
    // Add detection phase if we have detections
    if (response.detectedPatterns && response.detectedPatterns.length > 0) {
      const detectionPatterns = response.detectedPatterns.map((pattern, index) => ({
        id: `detection-${index}`,
        type: pattern.type || 'unknown',
        originalValue: pattern.value || '',
        replacementValue: pattern.replacement || '[DETECTED]',
        description: pattern.description || `${pattern.type} pattern detected`
      }));
      
      phases.push({
        id: 'pii-detection',
        title: 'PII Detection',
        subtitle: 'Scanning for personally identifiable information',
        inputText: originalText,
        outputText: originalText,
        patterns: detectionPatterns,
        metrics: { 
          processingTimeMs: response.processingTime || 45,
          detectedCount: response.detectedPatterns.length 
        },
        performanceData: [
          { label: 'Pattern Scan', value: 28, unit: 'ms', percentage: 100, color: '#ef4444' },
          { label: 'Type Classification', value: 12, unit: 'ms', percentage: 43, color: '#f59e0b' }
        ]
      });
    }
    
    // Add final output phase
    phases.push({
      id: 'final-output',
      title: 'Final Output',
      subtitle: 'Sanitized text ready for processing',
      inputText: response.sanitizedText || originalText,
      outputText: response.sanitizedText || originalText,
      patterns: [],
      metrics: { processingTimeMs: totalTime },
      performanceData: [
        { label: 'Total Processing', value: totalTime, unit: 'ms', percentage: 100, color: '#3b82f6' }
      ]
    });
    
    return {
      originalText,
      sanitizedText: response.sanitizedText || originalText,
      phases,
      totalProcessingTime: totalTime,
      totalDetections: response.detectedPatterns?.length || 0,
      success: response.success ?? true
    };
  }
  
  /**
   * Add result to processing history
   */
  function addToHistory(result: SanitizationResult): void {
    processingHistory.value.push(result);
    
    // Maintain max history size
    if (processingHistory.value.length > maxHistorySize.value) {
      processingHistory.value = processingHistory.value.slice(-maxHistorySize.value);
    }
  }
  
  return {
    // State
    currentResult: readonly(currentResult),
    isProcessing: readonly(isProcessing),
    error: readonly(error),
    lastProcessed: readonly(lastProcessed),
    processingHistory: readonly(processingHistory),
    
    // Getters
    hasResult,
    totalPhases,
    totalProcessingTime,
    totalDetections,
    processingStats,
    recentResults,
    
    // Actions
    processText,
    clearResult,
    clearHistory,
    getHistoryResult,
    loadHistoryResult
  };
});
