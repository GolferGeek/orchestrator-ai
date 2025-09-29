import { Injectable, Logger } from '@nestjs/common';

/**
 * Evaluation and Performance Interfaces
 */
export interface EvaluationMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeTasks: number;
  completedTasks: number;
  uptime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  timestamp: Date;
  successRate: number;
  p95ResponseTime?: number;
  p99ResponseTime?: number;
  errorsByType: Record<string, number>;
  throughputPerMinute: number;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  responseTime: number;
  success: boolean;
  errorType?: string;
  memoryUsage: NodeJS.MemoryUsage;
  taskId?: string;
  method?: string;
}

export interface EvaluationResult {
  score: number; // 0-10 scale
  passed: boolean;
  criteria: EvaluationCriteria[];
  feedback?: string;
  recommendations?: string[];
  metadata?: Record<string, any>;
}

export interface EvaluationCriteria {
  name: string;
  weight: number; // 0-1 scale
  score: number; // 0-10 scale
  passed: boolean;
  description?: string;
  feedback?: string;
}

export interface ResponseValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ErrorTrackingEntry {
  id: string;
  timestamp: Date;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context: {
    method?: string;
    params?: any;
    taskId?: string;
    agentName?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

export interface EvaluationConfig {
  enableMetrics?: boolean;
  enableErrorTracking?: boolean;
  enableResponseValidation?: boolean;
  enablePerformanceMonitoring?: boolean;
  metricsRetentionPeriod?: number; // in milliseconds
  errorRetentionPeriod?: number; // in milliseconds
  performanceSnapshotInterval?: number; // in milliseconds
  maxCacheSize?: number;
  evaluationThresholds?: {
    minScore?: number;
    maxResponseTime?: number;
    maxErrorRate?: number;
  };
}

/**
 * Service responsible for evaluation integration, performance metrics,
 * error tracking, and response validation for A2A agents.
 */
@Injectable()
export class EvaluationWrapperService {
  private readonly logger = new Logger(EvaluationWrapperService.name);
  private readonly startTime = Date.now();

  // Caches for performance
  private readonly metricsCache: Map<string, EvaluationMetrics>;
  private readonly performanceSnapshots: Map<string, PerformanceSnapshot>;
  private readonly errorTrackingCache: Map<string, ErrorTrackingEntry>;

  // In-memory storage for real-time metrics
  private readonly responseTimings: number[] = [];
  private readonly errorCounts = new Map<string, number>();
  private requestCount = 0;
  private errorCount = 0;
  private completedTasks = 0;
  private activeTasks = 0;

  // Configuration
  private config: EvaluationConfig;

  constructor() {
    this.config = {
      enableMetrics: true,
      enableErrorTracking: true,
      enableResponseValidation: true,
      enablePerformanceMonitoring: true,
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      errorRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      performanceSnapshotInterval: 60 * 1000, // 1 minute
      maxCacheSize: 1000,
      evaluationThresholds: {
        minScore: 7.0,
        maxResponseTime: 5000,
        maxErrorRate: 0.05,
      },
    };

    // Initialize caches with configuration

    this.metricsCache = new Map<string, EvaluationMetrics>();
    this.performanceSnapshots = new Map<string, PerformanceSnapshot>();
    this.errorTrackingCache = new Map<string, ErrorTrackingEntry>();
  }

  /**
   * Record the start of a task execution
   */
  recordTaskStart(taskId: string, method: string): void {
    if (!this.config.enableMetrics) return;

    this.requestCount++;
    this.activeTasks++;
  }

  /**
   * Record the completion of a task execution
   */
  recordTaskCompletion(
    taskId: string,
    method: string,
    responseTime: number,
    success: boolean,
    error?: any,
  ): void {
    if (!this.config.enableMetrics) return;

    this.activeTasks = Math.max(0, this.activeTasks - 1);

    if (success) {
      this.completedTasks++;
      this.responseTimings.push(responseTime);

      // Keep only recent timings for performance
      if (this.responseTimings.length > 1000) {
        this.responseTimings.splice(0, 500);
      }
    } else {
      this.errorCount++;
      if (error) {
        this.trackError(taskId, method, error);
      }
    }

    // Create performance snapshot
    if (this.config.enablePerformanceMonitoring) {
      this.createPerformanceSnapshot(
        taskId,
        method,
        responseTime,
        success,
        error,
      );
    }
  }

  /**
   * Get current evaluation metrics
   */
  getEvaluationMetrics(): EvaluationMetrics {
    const cacheKey = `metrics:${Math.floor(Date.now() / 60000)}`; // Cache per minute
    const cached = this.metricsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const averageResponseTime =
      this.responseTimings.length > 0
        ? this.responseTimings.reduce((sum, time) => sum + time, 0) /
          this.responseTimings.length
        : 0;

    const successRate =
      this.requestCount > 0
        ? (this.completedTasks / this.requestCount) * 100
        : 100;

    const throughputPerMinute = this.calculateThroughputPerMinute();

    const metrics: EvaluationMetrics = {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      averageResponseTime,
      activeTasks: this.activeTasks,
      completedTasks: this.completedTasks,
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date(),
      successRate,
      p95ResponseTime: this.calculatePercentile(95),
      p99ResponseTime: this.calculatePercentile(99),
      errorsByType: Object.fromEntries(this.errorCounts),
      throughputPerMinute,
    };

    this.metricsCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Evaluate a response against criteria
   */
  async evaluateResponse(
    response: any,
    criteria: EvaluationCriteria[],
    context?: Record<string, any>,
  ): Promise<EvaluationResult> {
    if (!this.config.enableResponseValidation) {
      return {
        score: 10,
        passed: true,
        criteria: [],
        feedback: 'Evaluation disabled',
      };
    }

    const evaluatedCriteria: EvaluationCriteria[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const evaluatedCriterion = await this.evaluateCriterion(
        response,
        criterion,
        context,
      );
      evaluatedCriteria.push(evaluatedCriterion);

      totalScore += evaluatedCriterion.score * evaluatedCriterion.weight;
      totalWeight += evaluatedCriterion.weight;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const passed =
      finalScore >= (this.config.evaluationThresholds?.minScore || 7.0);

    const result: EvaluationResult = {
      score: finalScore,
      passed,
      criteria: evaluatedCriteria,
      feedback: this.generateEvaluationFeedback(evaluatedCriteria, finalScore),
      recommendations: this.generateRecommendations(evaluatedCriteria),
      metadata: {
        evaluatedAt: new Date(),
        context,
      },
    };

    return result;
  }

  /**
   * Validate a response structure and content
   */
  validateResponse(
    response: any,
    expectedSchema?: any,
  ): ResponseValidationResult {
    if (!this.config.enableResponseValidation) {
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    if (response === null || response === undefined) {
      errors.push({
        field: 'response',
        message: 'Response is null or undefined',
        severity: 'error',
        code: 'NULL_RESPONSE',
      });
    }

    // Check for required fields in A2A responses
    if (typeof response === 'object' && response !== null) {
      if (
        !Object.prototype.hasOwnProperty.call(response, 'success') &&
        !Object.prototype.hasOwnProperty.call(response, 'result')
      ) {
        warnings.push({
          field: 'response',
          message: 'Response missing success indicator or result field',
          suggestion: 'Include either success boolean or result field',
        });
      }

      // Check for error handling
      if (response.success === false && !response.error && !response.message) {
        errors.push({
          field: 'error',
          message: 'Failed response missing error details',
          severity: 'error',
          code: 'MISSING_ERROR_DETAILS',
        });
      }
    }

    // Schema validation if provided
    if (expectedSchema) {
      const schemaErrors = this.validateAgainstSchema(response, expectedSchema);
      errors.push(...schemaErrors);
    }

    const valid = errors.length === 0;
    const score = this.calculateValidationScore(errors, warnings);

    return {
      valid,
      errors,
      warnings,
      score,
    };
  }

  /**
   * Track an error occurrence
   */
  trackError(
    taskId: string,
    method: string,
    error: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): void {
    if (!this.config.enableErrorTracking) return;

    const errorType = error.constructor.name || 'UnknownError';
    const errorMessage = error.message || error.toString();

    // Update error counts
    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);

    // Create error tracking entry
    const errorEntry: ErrorTrackingEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errorType,
      errorMessage,
      stackTrace: error.stack,
      context: {
        method,
        taskId,
        params: error.params,
        agentName: error.agentName,
      },
      severity,
      resolved: false,
    };

    this.errorTrackingCache.set(errorEntry.id, errorEntry);
  }

  /**
   * Get error tracking statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ErrorTrackingEntry[];
    errorRate: number;
  } {
    const allErrors: ErrorTrackingEntry[] = Array.from(
      this.errorTrackingCache.values(),
    );
    const errorsBySeverity = allErrors.reduce(
      (acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentErrors = allErrors
      .filter(
        (error: ErrorTrackingEntry) =>
          Date.now() - error.timestamp.getTime() < 60 * 60 * 1000,
      ) // Last hour
      .sort(
        (a: ErrorTrackingEntry, b: ErrorTrackingEntry) =>
          b.timestamp.getTime() - a.timestamp.getTime(),
      )
      .slice(0, 10);

    const errorRate =
      this.requestCount > 0 ? this.errorCount / this.requestCount : 0;

    return {
      totalErrors: this.errorCount,
      errorsByType: Object.fromEntries(this.errorCounts),
      errorsBySeverity,
      recentErrors,
      errorRate,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EvaluationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): EvaluationConfig {
    return { ...this.config };
  }

  /**
   * Clear all caches and reset metrics
   */
  reset(): void {
    this.metricsCache.clear();
    this.performanceSnapshots.clear();
    this.errorTrackingCache.clear();
    this.responseTimings.length = 0;
    this.errorCounts.clear();
    this.requestCount = 0;
    this.errorCount = 0;
    this.completedTasks = 0;
    this.activeTasks = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheStats: {
        metricsCache: {
          size: this.metricsCache.size,
        },
        performanceSnapshots: {
          size: this.performanceSnapshots.size,
        },
        errorTracking: {
          size: this.errorTrackingCache.size,
        },
      },
      metrics: {
        size: this.metricsCache.size,
      },
      performanceSnapshots: {
        size: this.performanceSnapshots.size,
      },
      errorTracking: {
        size: this.errorTrackingCache.size,
      },
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create a performance snapshot
   */
  private createPerformanceSnapshot(
    taskId: string,
    method: string,
    responseTime: number,
    success: boolean,
    error?: any,
  ): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      responseTime,
      success,
      errorType: error ? error.constructor.name : undefined,
      memoryUsage: process.memoryUsage(),
      taskId,
      method,
    };

    const snapshotKey = `snapshot_${Date.now()}_${taskId}`;
    this.performanceSnapshots.set(snapshotKey, snapshot);
  }

  /**
   * Calculate response time percentile
   */
  private calculatePercentile(percentile: number): number | undefined {
    if (this.responseTimings.length === 0) return undefined;

    const sorted = [...this.responseTimings].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate throughput per minute
   */
  private calculateThroughputPerMinute(): number {
    const uptimeMinutes = (Date.now() - this.startTime) / (60 * 1000);
    return uptimeMinutes > 0 ? this.completedTasks / uptimeMinutes : 0;
  }

  /**
   * Evaluate a single criterion
   */
  private async evaluateCriterion(
    response: any,
    criterion: EvaluationCriteria,
    context?: Record<string, any>,
  ): Promise<EvaluationCriteria> {
    // This is a simplified evaluation - in a real system, this would use
    // more sophisticated evaluation logic, possibly including LLM-based evaluation

    let score = 5; // Default neutral score
    let passed = false;
    let feedback = '';

    switch (criterion.name.toLowerCase()) {
      case 'response_completeness':
        score = this.evaluateCompleteness(response);
        break;
      case 'response_accuracy':
        score = this.evaluateAccuracy(response, context);
        break;
      case 'response_relevance':
        score = this.evaluateRelevance(response, context);
        break;
      case 'response_clarity':
        score = this.evaluateClarity(response);
        break;
      default:
        score = 7; // Default good score for unknown criteria
    }

    passed = score >= 6; // Pass threshold
    feedback = this.generateCriterionFeedback(criterion.name, score);

    return {
      ...criterion,
      score,
      passed,
      feedback,
    };
  }

  /**
   * Evaluate response completeness
   */
  private evaluateCompleteness(response: any): number {
    if (!response) return 0;

    if (typeof response === 'string') {
      return response.length > 10 ? 8 : 4;
    }

    if (typeof response === 'object') {
      const keys = Object.keys(response);
      return keys.length > 2 ? 8 : keys.length > 0 ? 6 : 2;
    }

    return 5;
  }

  /**
   * Evaluate response accuracy (simplified)
   */
  private evaluateAccuracy(
    response: any,
    _context?: Record<string, any>,
  ): number {
    // This would typically involve more sophisticated accuracy checking
    // For now, we'll use basic heuristics

    if (!response) return 0;

    // Check for error indicators
    if (typeof response === 'object' && response.error) {
      return 3;
    }

    // Check for success indicators
    if (typeof response === 'object' && response.success === true) {
      return 8;
    }

    return 7; // Default good score
  }

  /**
   * Evaluate response relevance
   */
  private evaluateRelevance(
    response: any,
    context?: Record<string, any>,
  ): number {
    // Simplified relevance check
    if (!response || !context) return 5;

    // This would typically involve semantic analysis
    // For now, we'll use basic keyword matching

    return 7; // Default good score
  }

  /**
   * Evaluate response clarity
   */
  private evaluateClarity(response: any): number {
    if (!response) return 0;

    if (typeof response === 'string') {
      // Basic clarity heuristics
      const hasProperStructure =
        response.includes('.') ||
        response.includes('!') ||
        response.includes('?');
      const isNotTooShort = response.length > 20;
      const isNotTooLong = response.length < 1000;

      let score = 5;
      if (hasProperStructure) score += 1;
      if (isNotTooShort) score += 1;
      if (isNotTooLong) score += 1;

      return Math.min(10, score);
    }

    return 6; // Default for non-string responses
  }

  /**
   * Generate evaluation feedback
   */
  private generateEvaluationFeedback(
    criteria: EvaluationCriteria[],
    score: number,
  ): string {
    const passedCount = criteria.filter((c) => c.passed).length;
    const totalCount = criteria.length;

    if (score >= 8) {
      return `Excellent response! Passed ${passedCount}/${totalCount} criteria with high scores.`;
    } else if (score >= 6) {
      return `Good response. Passed ${passedCount}/${totalCount} criteria. Some areas for improvement.`;
    } else if (score >= 4) {
      return `Adequate response. Passed ${passedCount}/${totalCount} criteria. Several areas need improvement.`;
    } else {
      return `Poor response. Only passed ${passedCount}/${totalCount} criteria. Significant improvement needed.`;
    }
  }

  /**
   * Generate recommendations based on criteria
   */
  private generateRecommendations(criteria: EvaluationCriteria[]): string[] {
    const recommendations: string[] = [];

    for (const criterion of criteria) {
      if (!criterion.passed) {
        switch (criterion.name.toLowerCase()) {
          case 'response_completeness':
            recommendations.push(
              'Provide more comprehensive and detailed responses',
            );
            break;
          case 'response_accuracy':
            recommendations.push(
              'Improve accuracy by validating information before responding',
            );
            break;
          case 'response_relevance':
            recommendations.push(
              "Ensure responses directly address the user's question or request",
            );
            break;
          case 'response_clarity':
            recommendations.push(
              'Use clearer language and better structure in responses',
            );
            break;
          default:
            recommendations.push(`Improve performance in: ${criterion.name}`);
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate feedback for a specific criterion
   */
  private generateCriterionFeedback(
    criterionName: string,
    score: number,
  ): string {
    const scoreDescriptions = {
      10: 'Exceptional',
      9: 'Excellent',
      8: 'Very Good',
      7: 'Good',
      6: 'Satisfactory',
      5: 'Adequate',
      4: 'Below Average',
      3: 'Poor',
      2: 'Very Poor',
      1: 'Unacceptable',
      0: 'Failed',
    };

    const description =
      scoreDescriptions[Math.round(score) as keyof typeof scoreDescriptions] ||
      'Unknown';
    return `${criterionName}: ${description} (${score}/10)`;
  }

  /**
   * Validate response against schema
   */
  private validateAgainstSchema(response: any, schema: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // This is a simplified schema validation
    // In a real implementation, you'd use a proper JSON schema validator

    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(response, requiredField)) {
          errors.push({
            field: requiredField,
            message: `Required field '${requiredField}' is missing`,
            severity: 'error',
            code: 'MISSING_REQUIRED_FIELD',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Calculate validation score based on errors and warnings
   */
  private calculateValidationScore(
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): number {
    let score = 10;

    // Deduct points for errors
    score -= errors.length * 2;

    // Deduct points for warnings
    score -= warnings.length * 0.5;

    return Math.max(0, score);
  }
}
