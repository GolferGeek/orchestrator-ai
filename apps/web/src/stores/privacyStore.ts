/**
 * Privacy Store - Unified State Management for All Privacy/PII Features
 *
 * Phase 4.3 Consolidation: Combines 6 privacy stores into 1 unified store
 * - pseudonymMappingsStore
 * - pseudonymDictionariesStore
 * - piiPatternsStore
 * - privacyIndicatorsStore
 * - privacyDashboardStore
 * - sovereignPolicyStore
 *
 * Architecture: Sync state + mutations only (no async methods)
 * Use privacyService for all API calls and business logic
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type {
  PseudonymMapping,
  PseudonymDictionaryEntry,
  PIIPattern,
  PIIDataType,
  PseudonymMappingFilters,
  PseudonymMappingSortOptions,
  PseudonymDictionaryFilters,
  PseudonymDictionarySortOptions,
  PIIPatternFilters,
  PIIPatternSortOptions,
  PseudonymStatsResponse,
  PIIStatsResponse,
  PseudonymGenerateResponse,
  PseudonymLookupResponse,
  PIITestResponse,
  PrivacyDashboardData,
  PrivacyMetrics,
  DetectionStats,
  PatternUsageStats,
  SanitizationMethodStats,
  PerformanceDataPoint,
  SystemHealthIndicators,
  RecentActivityEntry,
  DashboardFilters,
} from '@/types/pii';

// ============================================================================
// TYPES
// ============================================================================

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

export interface SovereignPolicy {
  enforced: boolean;
  allowedProviders: string[];
  requiresLocalProcessing: boolean;
}

// Re-export dashboard types for backward compatibility
export type {
  PrivacyDashboardData,
  PrivacyMetrics,
  DetectionStats,
  PatternUsageStats,
  SanitizationMethodStats,
  PerformanceDataPoint,
  SystemHealthIndicators,
  RecentActivityEntry,
  DashboardFilters,
};

// ============================================================================
// STORE DEFINITION
// ============================================================================

export const usePrivacyStore = defineStore('privacy', () => {
  // ==========================================================================
  // STATE - PSEUDONYM MAPPINGS
  // ==========================================================================

  const mappings = ref<PseudonymMapping[]>([]);
  const mappingsLoading = ref(false);
  const mappingsError = ref<string | null>(null);
  const mappingsLastFetched = ref<Date | null>(null);

  const mappingFilters = ref<PseudonymMappingFilters>({
    dataType: 'all',
    context: undefined,
    search: ''
  });

  const mappingSortOptions = ref<PseudonymMappingSortOptions>({
    field: 'usageCount',
    direction: 'desc'
  });

  const mappingStats = ref<PseudonymStatsResponse['stats'] | null>(null);
  const mappingStatsLoading = ref(false);
  const mappingStatsError = ref<string | null>(null);

  // ==========================================================================
  // STATE - PSEUDONYM DICTIONARIES
  // ==========================================================================

  const dictionaries = ref<PseudonymDictionaryEntry[]>([]);
  const dictionariesLoading = ref(false);
  const dictionariesError = ref<string | null>(null);
  const dictionariesLastUpdated = ref<Date | null>(null);

  const dictionaryFilters = ref<PseudonymDictionaryFilters>({
    category: 'all',
    dataType: 'all',
    isActive: 'all',
    search: ''
  });

  const dictionarySortOptions = ref<PseudonymDictionarySortOptions>({
    field: 'category',
    direction: 'asc'
  });

  const selectedDictionaryIds = ref<string[]>([]);
  const generationResult = ref<PseudonymGenerateResponse | null>(null);
  const lookupResult = ref<PseudonymLookupResponse | null>(null);
  const isGenerating = ref(false);

  const dictionaryStats = ref<PseudonymStatsResponse | null>(null);

  const importProgress = ref<{ imported: number; total: number; errors: string[] } | null>(null);
  const isImporting = ref(false);
  const isExporting = ref(false);

  // ==========================================================================
  // STATE - PII PATTERNS
  // ==========================================================================

  const patterns = ref<PIIPattern[]>([]);
  const patternsLoading = ref(false);
  const patternsError = ref<string | null>(null);
  const patternsLastUpdated = ref<Date | null>(null);

  const patternFilters = ref<PIIPatternFilters>({
    dataType: 'all',
    enabled: 'all',
    isBuiltIn: 'all',
    category: 'all',
    search: ''
  });

  const patternSortOptions = ref<PIIPatternSortOptions>({
    field: 'name',
    direction: 'asc'
  });

  const selectedPatternIds = ref<string[]>([]);
  const testResult = ref<PIITestResponse | null>(null);
  const isTestingPII = ref(false);
  const patternStats = ref<PIIStatsResponse | null>(null);

  // ==========================================================================
  // STATE - PRIVACY INDICATORS
  // ==========================================================================

  const messageStates = ref<Map<string, MessagePrivacyState>>(new Map());
  const conversationSettings = ref<Map<string, ConversationPrivacySettings>>(new Map());

  const globalSettings = ref({
    enableGlobalRealTime: true,
    defaultUpdateInterval: 2000,
    maxStoredStates: 100,
    autoCleanupAge: 3600000, // 1 hour in ms
    debugMode: false
  });

  const indicatorsInitialized = ref(false);
  const activeUpdateTimers = ref<Map<string, NodeJS.Timeout>>(new Map());
  const lastGlobalUpdate = ref<Date | null>(null);

  // ==========================================================================
  // STATE - DASHBOARD
  // ==========================================================================

  const dashboardData = ref<PrivacyDashboardData | null>(null);
  const dashboardLoading = ref(false);
  const dashboardError = ref<string | null>(null);
  const dashboardLastUpdated = ref<Date | null>(null);
  const autoRefreshInterval = ref<NodeJS.Timeout | null>(null);

  const dashboardFilters = ref<DashboardFilters>({
    timeRange: '7d',
    dataType: ['all'],
    includeSystemEvents: true
  });

  // ==========================================================================
  // STATE - SOVEREIGN POLICY
  // ==========================================================================

  const sovereignPolicy = ref<SovereignPolicy | null>(null);
  const userSovereignMode = ref(false);
  const sovereignLoading = ref(false);
  const sovereignError = ref<string | null>(null);
  const sovereignInitialized = ref(false);

  // ==========================================================================
  // COMPUTED - PSEUDONYM MAPPINGS
  // ==========================================================================

  const totalMappings = computed(() => mappings.value.length);

  const availableDataTypes = computed(() => {
    const types = new Set(mappings.value.map(m => m.dataType));
    return Array.from(types).sort();
  });

  const availableContexts = computed(() => {
    const contexts = new Set(mappings.value.map(m => m.context).filter(Boolean));
    return Array.from(contexts).sort();
  });

  const filteredMappings = computed(() => {
    let filtered = [...mappings.value];

    if (mappingFilters.value.search) {
      const search = mappingFilters.value.search.toLowerCase();
      filtered = filtered.filter(mapping =>
        mapping.pseudonym.toLowerCase().includes(search) ||
        mapping.dataType.toLowerCase().includes(search) ||
        (mapping.context && mapping.context.toLowerCase().includes(search))
      );
    }

    if (mappingFilters.value.dataType && mappingFilters.value.dataType !== 'all') {
      filtered = filtered.filter(mapping => mapping.dataType === mappingFilters.value.dataType);
    }

    if (mappingFilters.value.context) {
      filtered = filtered.filter(mapping => mapping.context === mappingFilters.value.context);
    }

    filtered.sort((a, b) => {
      let aVal: number | Date | string;
      let bVal: number | Date | string;

      switch (mappingSortOptions.value.field) {
        case 'usageCount':
          aVal = a.usageCount;
          bVal = b.usageCount;
          break;
        case 'lastUsedAt':
          aVal = new Date(a.lastUsedAt);
          bVal = new Date(b.lastUsedAt);
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case 'dataType':
          aVal = a.dataType;
          bVal = b.dataType;
          break;
        case 'pseudonym':
          aVal = a.pseudonym.toLowerCase();
          bVal = b.pseudonym.toLowerCase();
          break;
        default:
          return 0;
      }

      if (mappingSortOptions.value.direction === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });

    return filtered;
  });

  const mappingsByDataType = computed(() => {
    const byType: Record<PIIDataType, PseudonymMapping[]> = {} as Record<PIIDataType, PseudonymMapping[]>;

    mappings.value.forEach(mapping => {
      if (!byType[mapping.dataType]) {
        byType[mapping.dataType] = [];
      }
      byType[mapping.dataType].push(mapping);
    });

    return byType;
  });

  // ==========================================================================
  // COMPUTED - PSEUDONYM DICTIONARIES
  // ==========================================================================

  const filteredAndSortedDictionaries = computed(() => {
    let filtered = [...dictionaries.value];

    if (dictionaryFilters.value.category && dictionaryFilters.value.category !== 'all') {
      filtered = filtered.filter(d => d.category === dictionaryFilters.value.category);
    }

    if (dictionaryFilters.value.dataType && dictionaryFilters.value.dataType !== 'all') {
      filtered = filtered.filter(d => d.dataType === dictionaryFilters.value.dataType);
    }

    if (dictionaryFilters.value.isActive !== 'all') {
      filtered = filtered.filter(d => d.isActive === dictionaryFilters.value.isActive);
    }

    if (dictionaryFilters.value.search) {
      const searchTerm = dictionaryFilters.value.search.toLowerCase();
      filtered = filtered.filter(d =>
        d.category.toLowerCase().includes(searchTerm) ||
        (d.description && d.description.toLowerCase().includes(searchTerm)) ||
        d.words.some(word => word.toLowerCase().includes(searchTerm))
      );
    }

    filtered.sort((a, b) => {
      const { field, direction } = dictionarySortOptions.value;
      let aVal: number | Date | string | undefined = a[field];
      let bVal: number | Date | string | undefined = b[field];

      if (field === 'wordsCount') {
        aVal = a.words.length;
        bVal = b.words.length;
      } else if (field === 'createdAt' && aVal && bVal) {
        aVal = new Date(aVal as string);
        bVal = new Date(bVal as string);
      }

      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  });

  const activeDictionaries = computed(() =>
    dictionaries.value.filter(d => d.isActive)
  );

  const dictionariesByCategory = computed(() => {
    const grouped: Record<string, PseudonymDictionaryEntry[]> = {};
    dictionaries.value.forEach(dictionary => {
      if (!grouped[dictionary.category]) {
        grouped[dictionary.category] = [];
      }
      grouped[dictionary.category].push(dictionary);
    });
    return grouped;
  });

  const availableCategories = computed(() => {
    const categories = new Set<string>();
    dictionaries.value.forEach(d => categories.add(d.category));
    return Array.from(categories).sort();
  });

  // ==========================================================================
  // COMPUTED - PII PATTERNS
  // ==========================================================================

  const filteredAndSortedPatterns = computed(() => {
    let filtered = [...patterns.value];

    if (patternFilters.value.dataType && patternFilters.value.dataType !== 'all') {
      filtered = filtered.filter(p => p.dataType === patternFilters.value.dataType);
    }

    if (patternFilters.value.enabled !== 'all') {
      filtered = filtered.filter(p => p.enabled === patternFilters.value.enabled);
    }

    if (patternFilters.value.isBuiltIn !== 'all') {
      filtered = filtered.filter(p => p.isBuiltIn === patternFilters.value.isBuiltIn);
    }

    if (patternFilters.value.category && patternFilters.value.category !== 'all') {
      filtered = filtered.filter(p => p.category === patternFilters.value.category);
    }

    if (patternFilters.value.search) {
      const searchTerm = patternFilters.value.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.pattern.toLowerCase().includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      const { field, direction } = patternSortOptions.value;
      let aVal: Date | string | number | boolean | undefined = a[field];
      let bVal: Date | string | number | boolean | undefined = b[field];

      if (field === 'createdAt' && aVal && bVal) {
        aVal = new Date(aVal as string);
        bVal = new Date(bVal as string);
      }

      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  });

  const enabledPatterns = computed(() =>
    patterns.value.filter(p => p.enabled !== false)
  );

  const patternsByDataType = computed(() => {
    const grouped: Partial<Record<PIIDataType, PIIPattern[]>> = {};
    patterns.value.forEach(pattern => {
      if (!grouped[pattern.dataType]) {
        grouped[pattern.dataType] = [];
      }
      grouped[pattern.dataType]!.push(pattern);
    });
    return grouped as Record<PIIDataType, PIIPattern[]>;
  });

  // ==========================================================================
  // COMPUTED - PRIVACY INDICATORS
  // ==========================================================================

  const getMessagePrivacyState = computed(() => {
    return (messageId: string): MessagePrivacyState | null => {
      return messageStates.value.get(messageId) || null;
    };
  });

  const getConversationSettings = computed(() => {
    return (conversationId: string): ConversationPrivacySettings | null => {
      return conversationSettings.value.get(conversationId) || null;
    };
  });

  const getConversationMessageStates = computed(() => {
    return (conversationId: string): MessagePrivacyState[] => {
      return Array.from(messageStates.value.values())
        .filter(state => state.conversationId === conversationId)
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    };
  });

  // ==========================================================================
  // COMPUTED - DASHBOARD
  // ==========================================================================

  const dashboardMetrics = computed(() => dashboardData.value?.metrics || null);
  const hasData = computed(() => dashboardData.value !== null);

  // ==========================================================================
  // COMPUTED - SOVEREIGN POLICY
  // ==========================================================================

  const isEnforced = computed(() => sovereignPolicy.value?.enforced ?? false);
  const canUserControlSovereignMode = computed(() => !sovereignPolicy.value?.enforced);
  const effectiveSovereignMode = computed(() => {
    return sovereignPolicy.value?.enforced || userSovereignMode.value;
  });
  const allowedProviders = computed(() => {
    const effectiveMode = sovereignPolicy.value?.enforced || userSovereignMode.value;
    return effectiveMode ? ['ollama'] : ['ollama', 'openai', 'anthropic'];
  });

  // ==========================================================================
  // MUTATIONS - PSEUDONYM MAPPINGS
  // ==========================================================================

  function setMappings(newMappings: PseudonymMapping[]) {
    mappings.value = newMappings;
    mappingsLastFetched.value = new Date();
  }

  function setMappingsLoading(loading: boolean) {
    mappingsLoading.value = loading;
  }

  function setMappingsError(error: string | null) {
    mappingsError.value = error;
  }

  function updateMappingFilters(newFilters: Partial<PseudonymMappingFilters>) {
    mappingFilters.value = { ...mappingFilters.value, ...newFilters };
  }

  function updateMappingSortOptions(newOptions: Partial<PseudonymMappingSortOptions>) {
    mappingSortOptions.value = { ...mappingSortOptions.value, ...newOptions };
  }

  function clearMappingFilters() {
    mappingFilters.value = {
      dataType: 'all',
      context: undefined,
      search: ''
    };
  }

  function setMappingStats(stats: PseudonymStatsResponse['stats'] | null) {
    mappingStats.value = stats;
  }

  function setMappingStatsLoading(loading: boolean) {
    mappingStatsLoading.value = loading;
  }

  // ==========================================================================
  // MUTATIONS - PSEUDONYM DICTIONARIES
  // ==========================================================================

  function setDictionaries(newDictionaries: PseudonymDictionaryEntry[]) {
    dictionaries.value = newDictionaries;
    dictionariesLastUpdated.value = new Date();
  }

  function addDictionary(dictionary: PseudonymDictionaryEntry) {
    dictionaries.value.push(dictionary);
    dictionariesLastUpdated.value = new Date();
  }

  function updateDictionary(id: string, updates: Partial<PseudonymDictionaryEntry>) {
    const index = dictionaries.value.findIndex(d => d.id === id);
    if (index !== -1) {
      dictionaries.value[index] = { ...dictionaries.value[index], ...updates };
      dictionariesLastUpdated.value = new Date();
    }
  }

  function removeDictionary(id: string) {
    dictionaries.value = dictionaries.value.filter(d => d.id !== id);
    selectedDictionaryIds.value = selectedDictionaryIds.value.filter(did => did !== id);
    dictionariesLastUpdated.value = new Date();
  }

  function setDictionariesLoading(loading: boolean) {
    dictionariesLoading.value = loading;
  }

  function setDictionariesError(error: string | null) {
    dictionariesError.value = error;
  }

  function updateDictionaryFilters(newFilters: Partial<PseudonymDictionaryFilters>) {
    dictionaryFilters.value = { ...dictionaryFilters.value, ...newFilters };
  }

  function clearDictionaryFilters() {
    dictionaryFilters.value = {
      category: 'all',
      dataType: 'all',
      isActive: 'all',
      search: ''
    };
  }

  function toggleDictionarySelection(dictionaryId: string) {
    const index = selectedDictionaryIds.value.indexOf(dictionaryId);
    if (index === -1) {
      selectedDictionaryIds.value.push(dictionaryId);
    } else {
      selectedDictionaryIds.value.splice(index, 1);
    }
  }

  function clearDictionarySelection() {
    selectedDictionaryIds.value = [];
  }

  function setGenerationResult(result: PseudonymGenerateResponse | null) {
    generationResult.value = result;
  }

  function setIsGenerating(generating: boolean) {
    isGenerating.value = generating;
  }

  function setImportProgress(progress: { imported: number; total: number; errors: string[] } | null) {
    importProgress.value = progress;
  }

  function setIsImporting(importing: boolean) {
    isImporting.value = importing;
  }

  function setIsExporting(exporting: boolean) {
    isExporting.value = exporting;
  }

  // ==========================================================================
  // MUTATIONS - PII PATTERNS
  // ==========================================================================

  function setPatterns(newPatterns: PIIPattern[]) {
    patterns.value = newPatterns;
    patternsLastUpdated.value = new Date();
  }

  function addPattern(pattern: PIIPattern) {
    patterns.value.push(pattern);
    patternsLastUpdated.value = new Date();
  }

  function updatePattern(id: string, updates: Partial<PIIPattern>) {
    const index = patterns.value.findIndex(p => p.id === id);
    if (index !== -1) {
      patterns.value[index] = { ...patterns.value[index], ...updates };
      patternsLastUpdated.value = new Date();
    }
  }

  function removePattern(id: string) {
    patterns.value = patterns.value.filter(p => p.id !== id);
    selectedPatternIds.value = selectedPatternIds.value.filter(pid => pid !== id);
    patternsLastUpdated.value = new Date();
  }

  function setPatternsLoading(loading: boolean) {
    patternsLoading.value = loading;
  }

  function setPatternsError(error: string | null) {
    patternsError.value = error;
  }

  function updatePatternFilters(newFilters: Partial<PIIPatternFilters>) {
    patternFilters.value = { ...patternFilters.value, ...newFilters };
  }

  function clearPatternFilters() {
    patternFilters.value = {
      dataType: 'all',
      enabled: 'all',
      isBuiltIn: 'all',
      category: 'all',
      search: ''
    };
  }

  function togglePatternSelection(patternId: string) {
    const index = selectedPatternIds.value.indexOf(patternId);
    if (index === -1) {
      selectedPatternIds.value.push(patternId);
    } else {
      selectedPatternIds.value.splice(index, 1);
    }
  }

  function clearPatternSelection() {
    selectedPatternIds.value = [];
  }

  function setTestResult(result: PIITestResponse | null) {
    testResult.value = result;
  }

  function setIsTestingPII(testing: boolean) {
    isTestingPII.value = testing;
  }

  function setPatternStats(stats: PIIStatsResponse | null) {
    patternStats.value = stats;
  }

  // ==========================================================================
  // MUTATIONS - PRIVACY INDICATORS
  // ==========================================================================

  function updateMessagePrivacyState(
    messageId: string,
    updates: Partial<MessagePrivacyState>
  ): MessagePrivacyState {
    const existing = messageStates.value.get(messageId);

    const newState: MessagePrivacyState = {
      messageId,
      conversationId: updates.conversationId || existing?.conversationId,
      taskId: updates.taskId || existing?.taskId,

      isDataProtected: updates.isDataProtected ?? existing?.isDataProtected ?? false,
      dataProtectionLevel: updates.dataProtectionLevel ?? existing?.dataProtectionLevel ?? 'none',

      sanitizationStatus: updates.sanitizationStatus ?? existing?.sanitizationStatus ?? 'none',
      piiDetectionCount: updates.piiDetectionCount ?? existing?.piiDetectionCount ?? 0,
      sanitizationProcessingTime: updates.sanitizationProcessingTime ?? existing?.sanitizationProcessingTime ?? 0,

      routingMode: updates.routingMode ?? existing?.routingMode ?? 'local',
      routingProvider: updates.routingProvider ?? existing?.routingProvider ?? null,

      trustLevel: updates.trustLevel ?? existing?.trustLevel ?? 'medium',
      trustScore: updates.trustScore ?? existing?.trustScore ?? null,

      processingTimeMs: updates.processingTimeMs ?? existing?.processingTimeMs ?? 0,
      isProcessing: updates.isProcessing ?? existing?.isProcessing ?? false,

      hasErrors: updates.hasErrors ?? existing?.hasErrors ?? false,
      errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,

      lastUpdated: new Date(),
      updateCount: (existing?.updateCount ?? 0) + 1
    };

    messageStates.value.set(messageId, newState);
    return newState;
  }

  function removeMessagePrivacyState(messageId: string): boolean {
    return messageStates.value.delete(messageId);
  }

  function clearConversationPrivacyStates(conversationId: string) {
    const messagesToRemove: string[] = [];

    for (const [messageId, state] of messageStates.value.entries()) {
      if (state.conversationId === conversationId) {
        messagesToRemove.push(messageId);
      }
    }

    messagesToRemove.forEach(messageId => {
      messageStates.value.delete(messageId);
    });

    conversationSettings.value.delete(conversationId);
  }

  function setConversationSettings(
    conversationId: string,
    settings: Partial<ConversationPrivacySettings>
  ): ConversationPrivacySettings {
    const existing = conversationSettings.value.get(conversationId);

    const newSettings: ConversationPrivacySettings = {
      conversationId,
      showDataProtection: settings.showDataProtection ?? existing?.showDataProtection ?? true,
      showSanitizationStatus: settings.showSanitizationStatus ?? existing?.showSanitizationStatus ?? true,
      showRoutingDisplay: settings.showRoutingDisplay ?? existing?.showRoutingDisplay ?? true,
      showTrustSignal: settings.showTrustSignal ?? existing?.showTrustSignal ?? true,
      showPiiCount: settings.showPiiCount ?? existing?.showPiiCount ?? true,
      showProcessingTime: settings.showProcessingTime ?? existing?.showProcessingTime ?? false,
      enableRealTimeUpdates: settings.enableRealTimeUpdates ?? existing?.enableRealTimeUpdates ?? true,
      updateInterval: settings.updateInterval ?? existing?.updateInterval ?? globalSettings.value.defaultUpdateInterval,
      compactMode: settings.compactMode ?? existing?.compactMode ?? false,
      position: settings.position ?? existing?.position ?? 'inline'
    };

    conversationSettings.value.set(conversationId, newSettings);
    return newSettings;
  }

  function setIndicatorsInitialized(initialized: boolean) {
    indicatorsInitialized.value = initialized;
  }

  // ==========================================================================
  // MUTATIONS - DASHBOARD
  // ==========================================================================

  function setDashboardData(data: PrivacyDashboardData | null) {
    dashboardData.value = data;
    dashboardLastUpdated.value = data ? new Date() : null;
  }

  function setDashboardLoading(loading: boolean) {
    dashboardLoading.value = loading;
  }

  function setDashboardError(error: string | null) {
    dashboardError.value = error;
  }

  function updateDashboardFilters(newFilters: Partial<DashboardFilters>) {
    dashboardFilters.value = { ...dashboardFilters.value, ...newFilters };
  }

  function setAutoRefreshInterval(interval: NodeJS.Timeout | null) {
    autoRefreshInterval.value = interval;
  }

  // ==========================================================================
  // MUTATIONS - SOVEREIGN POLICY
  // ==========================================================================

  function setSovereignPolicy(policy: SovereignPolicy | null) {
    sovereignPolicy.value = policy;
  }

  function setUserSovereignMode(enabled: boolean) {
    userSovereignMode.value = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('userSovereignMode', JSON.stringify(enabled));
    }
  }

  function setSovereignLoading(loading: boolean) {
    sovereignLoading.value = loading;
  }

  function setSovereignError(error: string | null) {
    sovereignError.value = error;
  }

  function setSovereignInitialized(initialized: boolean) {
    sovereignInitialized.value = initialized;
  }

  // ==========================================================================
  // RETURN PUBLIC API
  // ==========================================================================

  return {
    // STATE - Mappings
    mappings: readonly(mappings),
    mappingsLoading: readonly(mappingsLoading),
    mappingsError: readonly(mappingsError),
    mappingsLastFetched: readonly(mappingsLastFetched),
    mappingFilters,
    mappingSortOptions,
    mappingStats: readonly(mappingStats),
    mappingStatsLoading: readonly(mappingStatsLoading),
    mappingStatsError: readonly(mappingStatsError),

    // STATE - Dictionaries
    dictionaries: readonly(dictionaries),
    dictionariesLoading: readonly(dictionariesLoading),
    dictionariesError: readonly(dictionariesError),
    dictionariesLastUpdated: readonly(dictionariesLastUpdated),
    dictionaryFilters,
    dictionarySortOptions,
    selectedDictionaryIds,
    generationResult: readonly(generationResult),
    lookupResult: readonly(lookupResult),
    isGenerating: readonly(isGenerating),
    dictionaryStats: readonly(dictionaryStats),
    importProgress: readonly(importProgress),
    isImporting: readonly(isImporting),
    isExporting: readonly(isExporting),

    // STATE - Patterns
    patterns: readonly(patterns),
    patternsLoading: readonly(patternsLoading),
    patternsError: readonly(patternsError),
    patternsLastUpdated: readonly(patternsLastUpdated),
    patternFilters,
    patternSortOptions,
    selectedPatternIds,
    testResult: readonly(testResult),
    isTestingPII: readonly(isTestingPII),
    patternStats: readonly(patternStats),

    // STATE - Indicators
    messageStates: readonly(messageStates),
    conversationSettings: readonly(conversationSettings),
    globalSettings,
    indicatorsInitialized: readonly(indicatorsInitialized),
    activeUpdateTimers: readonly(activeUpdateTimers),
    lastGlobalUpdate: readonly(lastGlobalUpdate),

    // STATE - Dashboard
    dashboardData: readonly(dashboardData),
    dashboardLoading: readonly(dashboardLoading),
    dashboardError: readonly(dashboardError),
    dashboardLastUpdated: readonly(dashboardLastUpdated),
    autoRefreshInterval: readonly(autoRefreshInterval),
    dashboardFilters,

    // STATE - Sovereign
    sovereignPolicy: readonly(sovereignPolicy),
    userSovereignMode: readonly(userSovereignMode),
    sovereignLoading: readonly(sovereignLoading),
    sovereignError: readonly(sovereignError),
    sovereignInitialized: readonly(sovereignInitialized),

    // COMPUTED - Mappings
    totalMappings,
    availableDataTypes,
    availableContexts,
    filteredMappings,
    mappingsByDataType,

    // COMPUTED - Dictionaries
    filteredAndSortedDictionaries,
    activeDictionaries,
    dictionariesByCategory,
    availableCategories,

    // COMPUTED - Patterns
    filteredAndSortedPatterns,
    enabledPatterns,
    patternsByDataType,

    // COMPUTED - Indicators
    getMessagePrivacyState,
    getConversationSettings,
    getConversationMessageStates,

    // COMPUTED - Dashboard
    dashboardMetrics,
    hasData,

    // COMPUTED - Sovereign
    isEnforced,
    canUserControlSovereignMode,
    effectiveSovereignMode,
    allowedProviders,

    // MUTATIONS - Mappings
    setMappings,
    setMappingsLoading,
    setMappingsError,
    updateMappingFilters,
    updateMappingSortOptions,
    clearMappingFilters,
    setMappingStats,
    setMappingStatsLoading,

    // MUTATIONS - Dictionaries
    setDictionaries,
    addDictionary,
    updateDictionary,
    removeDictionary,
    setDictionariesLoading,
    setDictionariesError,
    updateDictionaryFilters,
    clearDictionaryFilters,
    toggleDictionarySelection,
    clearDictionarySelection,
    setGenerationResult,
    setIsGenerating,
    setImportProgress,
    setIsImporting,
    setIsExporting,

    // MUTATIONS - Patterns
    setPatterns,
    addPattern,
    updatePattern,
    removePattern,
    setPatternsLoading,
    setPatternsError,
    updatePatternFilters,
    clearPatternFilters,
    togglePatternSelection,
    clearPatternSelection,
    setTestResult,
    setIsTestingPII,
    setPatternStats,

    // MUTATIONS - Indicators
    updateMessagePrivacyState,
    removeMessagePrivacyState,
    clearConversationPrivacyStates,
    setConversationSettings,
    setIndicatorsInitialized,

    // MUTATIONS - Dashboard
    setDashboardData,
    setDashboardLoading,
    setDashboardError,
    updateDashboardFilters,
    setAutoRefreshInterval,

    // MUTATIONS - Sovereign
    setSovereignPolicy,
    setUserSovereignMode,
    setSovereignLoading,
    setSovereignError,
    setSovereignInitialized,
  };
});
