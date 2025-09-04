// Store-specific TypeScript interfaces
// This file contains interfaces specifically designed for Pinia store implementations

import type {
  BaseStoreState,
  DataStoreState,
  MonitoringStoreState,
  LoadingStates,
  ErrorState,
  PaginationState,
  SortOptions,
  SelectionState,
  StoreConfig,
  ValidationResult,
  BulkOperationResult
} from './index';

// =====================================
// STORE INTERFACE DEFINITIONS
// =====================================

/**
 * Interface for PII Patterns Store State
 */
export interface PIIPatternsStoreState extends DataStoreState {
  // PII-specific state
  patterns: any[]; // PIIPattern[] - imported from pii.ts
  testResults: any | null;
  statistics: any | null;
  
  // PII-specific filters
  filters: {
    dataType: string;
    enabled: string;
    category: string;
    builtIn: string;
    search: string;
  };
  
  // Testing state
  isTestingPattern: boolean;
  testInput: string;
}

/**
 * Interface for Pseudonym Dictionaries Store State
 */
export interface PseudonymDictionariesStoreState extends DataStoreState {
  // Pseudonym-specific state
  dictionaries: any[]; // PseudonymDictionaryEntry[] - imported from pii.ts
  generationResults: any | null;
  lookupResults: any | null;
  statistics: any | null;
  
  // Import/Export state
  isImporting: boolean;
  isExporting: boolean;
  importProgress: number;
  exportProgress: number;
  
  // Pseudonym-specific filters
  filters: {
    category: string;
    dataType: string;
    active: string;
    search: string;
  };
}

/**
 * Interface for LLM Monitoring Store State
 */
export interface LLMMonitoringStoreState extends MonitoringStoreState {
  // LLM-specific monitoring data
  usageRecords: any[]; // LLMUsageRecord[] - imported from llm-monitoring.ts
  systemHealth: any | null; // SystemHealthMetrics
  activeAlerts: any[]; // Alert[]
  modelMetrics: any[]; // ModelHealthMetrics[]
  
  // LLM-specific filters
  filters: {
    provider: string;
    model: string;
    status: string;
    dateRange: string;
    search: string;
  };
  
  // Real-time monitoring
  isMonitoring: boolean;
  alertsEnabled: boolean;
  thresholds: Record<string, number>;
}

/**
 * Interface for Analytics Store State
 */
export interface AnalyticsStoreState extends MonitoringStoreState {
  // Analytics-specific data
  dashboardData: any | null; // DashboardData
  evaluationAnalytics: any | null; // EvaluationAnalytics
  workflowAnalytics: any | null; // WorkflowAnalytics
  projectAnalytics: Record<string, any>; // ProjectAnalytics
  usageStats: any | null; // UsageStats
  costSummary: any | null; // CostSummary
  modelPerformance: any[]; // ModelPerformance[]
  
  // Analytics-specific filters
  filters: {
    timeRange: string;
    userRole: string;
    provider: string;
    model: string;
    project: string;
    status: string;
    granularity: 'daily' | 'weekly' | 'monthly';
    includeDetails: boolean;
    search: string;
  };
  
  // Event tracking
  eventQueue: any[]; // AnalyticsEvent[]
  eventTrackingEnabled: boolean;
  
  // Reporting
  reportConfigs: any[]; // ReportConfig[]
  generatedReports: any[]; // GeneratedReport[]
}

// =====================================
// STORE ACTION INTERFACES
// =====================================

/**
 * Base CRUD actions that all data stores should implement
 */
export interface BaseCRUDActions<T, CreatePayload, UpdatePayload> {
  // Data loading
  loadItems(): Promise<void>;
  refreshItems(): Promise<void>;
  
  // CRUD operations
  createItem(payload: CreatePayload): Promise<T>;
  updateItem(id: string, payload: UpdatePayload): Promise<T>;
  deleteItem(id: string): Promise<void>;
  
  // Bulk operations
  bulkCreate(items: CreatePayload[]): Promise<BulkOperationResult>;
  bulkUpdate(updates: Array<{ id: string; payload: UpdatePayload }>): Promise<BulkOperationResult>;
  bulkDelete(ids: string[]): Promise<BulkOperationResult>;
  
  // Selection management
  selectItem(id: string): void;
  deselectItem(id: string): void;
  selectAll(): void;
  deselectAll(): void;
  toggleSelection(id: string): void;
  
  // Filtering and sorting
  setFilters(filters: Record<string, any>): void;
  clearFilters(): void;
  setSortOptions(sortOptions: SortOptions): void;
  setSearch(query: string): void;
  
  // Pagination
  setPage(page: number): void;
  setPageSize(size: number): void;
  
  // Error handling
  clearError(): void;
  handleError(error: any): void;
}

/**
 * Monitoring store actions interface
 */
export interface MonitoringActions {
  // Real-time monitoring
  startMonitoring(): void;
  stopMonitoring(): void;
  refreshData(): Promise<void>;
  
  // Auto-refresh
  enableAutoRefresh(): void;
  disableAutoRefresh(): void;
  setRefreshInterval(interval: number): void;
  
  // Alerts and notifications
  acknowledgeAlert(alertId: string): void;
  dismissAlert(alertId: string): void;
  setAlertThreshold(metric: string, threshold: number): void;
  
  // Data export
  exportData(format: string, options?: any): Promise<void>;
}

/**
 * Analytics store specific actions
 */
export interface AnalyticsActions extends MonitoringActions {
  // Dashboard
  loadDashboardData(): Promise<void>;
  
  // Event tracking
  trackEvent(event: any): Promise<void>;
  trackPageView(page: string): Promise<void>;
  trackUserAction(action: string, category: string): Promise<void>;
  flushEventQueue(): Promise<void>;
  
  // Reporting
  loadReportConfigs(): Promise<void>;
  createReportConfig(config: any): Promise<any>;
  generateReport(configId: string): Promise<any>;
  loadGeneratedReports(): Promise<void>;
  
  // Time range management
  setTimeRange(range: string): void;
  setCustomTimeRange(start: string, end: string): void;
}

// =====================================
// STORE GETTER INTERFACES
// =====================================

/**
 * Base getters that all data stores should implement
 */
export interface BaseDataGetters<T> {
  // Filtered and sorted data
  filteredItems: T[];
  sortedItems: T[];
  filteredAndSortedItems: T[];
  
  // Selection state
  selectedItems: T[];
  selectedCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  hasSelection: boolean;
  
  // Loading states
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  
  // Search
  hasSearchQuery: boolean;
  searchResultCount: number;
  
  // Data state
  hasData: boolean;
  itemCount: number;
  isEmpty: boolean;
}

/**
 * Monitoring store getters interface
 */
export interface MonitoringGetters {
  // System health
  systemHealthStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  activeAlertCount: number;
  criticalAlertCount: number;
  
  // Real-time state
  isMonitoring: boolean;
  lastUpdateTime: Date | null;
  
  // Data freshness
  isDataFresh: boolean;
  dataAge: number; // in milliseconds
}

/**
 * Analytics store specific getters
 */
export interface AnalyticsGetters extends MonitoringGetters {
  // Dashboard metrics
  keyMetrics: any[];
  totalCostToday: number;
  averageResponseTime: number;
  topPerformingModels: any[];
  recentActivity: any[];
  
  // Time range
  currentTimeRange: any;
  formattedDateRange: string;
  
  // Event tracking
  eventQueueSize: number;
  isEventTrackingEnabled: boolean;
  
  // Reporting
  availableReportTypes: string[];
  reportCount: number;
}

// =====================================
// STORE COMPOSITION INTERFACES
// =====================================

/**
 * Complete PII Patterns Store interface
 */
export interface PIIPatternsStore extends BaseCRUDActions<any, any, any> {
  // State
  patterns: any[];
  isLoading: boolean;
  error: string | null;
  filters: PIIPatternsStoreState['filters'];
  
  // PII-specific actions
  testPattern(pattern: string, input: string): Promise<any>;
  validatePattern(pattern: string): ValidationResult;
  loadStatistics(): Promise<void>;
  
  // PII-specific getters
  enabledPatterns: any[];
  customPatterns: any[];
  builtInPatterns: any[];
  patternsByDataType: Record<string, any[]>;
  availableCategories: string[];
}

/**
 * Complete Pseudonym Dictionaries Store interface
 */
export interface PseudonymDictionariesStore extends BaseCRUDActions<any, any, any> {
  // State
  dictionaries: any[];
  isLoading: boolean;
  error: string | null;
  filters: PseudonymDictionariesStoreState['filters'];
  
  // Pseudonym-specific actions
  generatePseudonym(request: any): Promise<any>;
  lookupPseudonym(request: any): Promise<any>;
  importDictionaries(file: File, options: any): Promise<void>;
  exportDictionaries(format: string, options: any): Promise<void>;
  
  // Pseudonym-specific getters
  activeDictionaries: any[];
  dictionariesByCategory: Record<string, any[]>;
  totalWords: number;
  importProgress: number;
  exportProgress: number;
}

/**
 * Complete LLM Monitoring Store interface
 */
export interface LLMMonitoringStore extends MonitoringActions {
  // State
  usageRecords: any[];
  systemHealth: any | null;
  activeAlerts: any[];
  isLoading: boolean;
  error: string | null;
  
  // LLM-specific actions
  loadUsageRecords(): Promise<void>;
  loadSystemHealth(): Promise<void>;
  loadModelMetrics(): Promise<void>;
  
  // LLM-specific getters
  healthyModels: any[];
  unhealthyModels: any[];
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTime: number;
}

/**
 * Complete Analytics Store interface
 */
export interface AnalyticsStore extends AnalyticsActions {
  // State
  dashboardData: any | null;
  realTimeAnalytics: any | null;
  isLoading: boolean;
  error: string | null;
  filters: AnalyticsStoreState['filters'];
  
  // Analytics-specific getters (extends AnalyticsGetters)
  keyMetrics: any[];
  systemHealthStatus: string;
  totalCostToday: number;
  averageResponseTime: number;
  topPerformingModels: any[];
  recentActivity: any[];
  currentTimeRange: any;
  formattedDateRange: string;
}

// =====================================
// STORE FACTORY INTERFACES
// =====================================

/**
 * Configuration for creating a data store
 */
export interface DataStoreConfig<T> {
  name: string;
  apiEndpoint: string;
  defaultFilters?: Record<string, any>;
  defaultSortOptions?: SortOptions;
  pageSize?: number;
  enableSearch?: boolean;
  enableSelection?: boolean;
  enableBulkOperations?: boolean;
  cacheTimeout?: number;
  validation?: (item: T) => ValidationResult;
}

/**
 * Configuration for creating a monitoring store
 */
export interface MonitoringStoreConfig {
  name: string;
  refreshInterval?: number;
  enableRealTime?: boolean;
  enableAlerts?: boolean;
  alertThresholds?: Record<string, number>;
  enableAutoRefresh?: boolean;
  dataRetentionDays?: number;
}

// =====================================
// UTILITY INTERFACES
// =====================================

/**
 * Store initialization options
 */
export interface StoreInitOptions {
  loadDataOnInit?: boolean;
  enablePersistence?: boolean;
  persistenceKey?: string;
  enableLogging?: boolean;
  enableAnalytics?: boolean;
}

/**
 * Store middleware interface
 */
export interface StoreMiddleware<T = any> {
  name: string;
  beforeAction?: (action: string, payload: any, state: T) => void | Promise<void>;
  afterAction?: (action: string, payload: any, result: any, state: T) => void | Promise<void>;
  onError?: (error: any, action: string, payload: any, state: T) => void | Promise<void>;
}

/**
 * Store plugin interface
 */
export interface StorePlugin<T = any> {
  name: string;
  install: (store: T, options?: any) => void;
  uninstall?: (store: T) => void;
}

// =====================================
// TYPE HELPERS FOR STORES
// =====================================

/**
 * Extract store state type from store definition
 */
export type ExtractStoreState<T> = T extends { $state: infer S } ? S : never;

/**
 * Extract store getters type from store definition
 */
export type ExtractStoreGetters<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => infer R ? R : T[K];
};

/**
 * Extract store actions type from store definition
 */
export type ExtractStoreActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

/**
 * Create a strongly-typed store interface
 */
export type TypedStore<
  State extends Record<string, any>,
  Getters extends Record<string, any>,
  Actions extends Record<string, any>
> = {
  $state: State;
  $getters: Getters;
  $actions: Actions;
} & State & Getters & Actions;
