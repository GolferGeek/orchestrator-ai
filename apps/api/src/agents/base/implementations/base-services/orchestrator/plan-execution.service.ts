import { Injectable, Logger } from '@nestjs/common';
import { 
  IPlanExecutionService,
  Project,
  PlanDefinition,
  PlanStep,
  ProjectStatus,
  ProjectStepStatus
} from '../../../../../orchestration/orchestration.types';
import { StateGraph, END, START } from '@langchain/langgraph';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import type { Checkpoint, CheckpointMetadata, CheckpointTuple } from '@langchain/langgraph';

/**
 * Enhanced Error Classification System
 */
export enum ErrorCategory {
  DEPENDENCY_FAILURE = 'dependency_failure',
  AGENT_UNAVAILABLE = 'agent_unavailable', 
  TIMEOUT = 'timeout',
  VALIDATION_ERROR = 'validation_error',
  LLM_SERVICE_ERROR = 'llm_service_error',
  DATABASE_ERROR = 'database_error',
  NETWORK_ERROR = 'network_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  CONFIGURATION_ERROR = 'configuration_error',
  USER_CANCELLED = 'user_cancelled',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',           // Can continue with degraded functionality
  MEDIUM = 'medium',     // Requires attention but not critical
  HIGH = 'high',         // Blocks progress, needs immediate attention
  CRITICAL = 'critical'  // Project-ending error, requires intervention
}

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  timestamp: string;
  context: {
    projectId: string;
    stepId?: string;
    agentName?: string;
    retryable: boolean;
    suggestedAction: string;
  };
  metadata?: Record<string, any>;
}
import { LLMService } from '../../../../../llms/llm.service';
import { SupabaseService } from '../../../../../supabase/supabase.service';

/**
 * Retry strategy enumeration for different error types and contexts
 */
enum RetryStrategy {
  IMMEDIATE = 'immediate',           // Retry immediately
  EXPONENTIAL_BACKOFF = 'exponential_backoff', // Retry with increasing delays
  LINEAR_BACKOFF = 'linear_backoff',  // Retry with consistent delays  
  NO_RETRY = 'no_retry',             // Don't retry - manual intervention needed
  ROLLBACK_AND_RETRY = 'rollback_and_retry' // Rollback to checkpoint then retry
}

/**
 * Custom LangGraph Checkpoint Saver using SupabaseService
 * 
 * Implements LangGraph's checkpointing interface using our existing Supabase connection
 * This allows us to leverage LangGraph's state management while using our database infrastructure
 */
class SupabaseCheckpointSaver extends BaseCheckpointSaver {
  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  async getTuple(config: { configurable?: { thread_id: string } }): Promise<CheckpointTuple | undefined> {
    try {
      const threadId = config.configurable?.thread_id;
      if (!threadId) return undefined;

      const { data, error } = await this.supabaseService.getServiceClient()
        .from('project_checkpoints')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return undefined;

      return {
        config,
        checkpoint: data.checkpoint_data,
        metadata: data.metadata || {},
        parentConfig: data.parent_config ? JSON.parse(data.parent_config) : undefined
      };
    } catch (error) {
      console.error('Failed to get checkpoint tuple:', error);
      return undefined;
    }
  }

  async *list(
    config: { configurable?: { thread_id: string } },
    filter?: { limit?: number; before?: string }
  ): AsyncGenerator<CheckpointTuple> {
    try {
      const threadId = config.configurable?.thread_id;
      if (!threadId) return;

      let query = this.supabaseService.getServiceClient()
        .from('project_checkpoints')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false });

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      if (filter?.before) {
        query = query.lt('created_at', filter.before);
      }

      const { data, error } = await query;
      if (error || !data) return;

      for (const checkpoint of data) {
        yield {
          config,
          checkpoint: checkpoint.checkpoint_data,
          metadata: checkpoint.metadata || {},
          parentConfig: checkpoint.parent_config ? JSON.parse(checkpoint.parent_config) : undefined
        };
      }
    } catch (error) {
      console.error('Failed to list checkpoints:', error);
    }
  }

  async put(
    config: { configurable?: { thread_id: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    parentConfig?: { configurable?: { thread_id: string } }
  ): Promise<void> {
    try {
      const threadId = config.configurable?.thread_id;
      if (!threadId) throw new Error('Thread ID is required for checkpoint');

      const { error } = await this.supabaseService.getServiceClient()
        .from('project_checkpoints')
        .insert({
          thread_id: threadId,
          checkpoint_data: checkpoint,
          metadata,
          parent_config: parentConfig ? JSON.stringify(parentConfig) : null,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to save checkpoint: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to put checkpoint:', error);
      throw error;
    }
  }
}

/**
 * Plan Execution Service - LangGraph-based execution engine
 * 
 * Executes approved project plans using LangGraph's state management
 * and persistence features, with ReAct patterns for reasoning and action-taking.
 */
/**
 * LangGraph State Interface for Project Execution
 * This follows LangGraph's state management patterns
 */
interface ProjectExecutionState {
  // Core execution state
  projectId: string;
  threadId: string; // LangGraph thread ID for checkpoint management
  currentStepId: string;
  status: ProjectStatus;
  
  // Step tracking
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Record<string, any>;
  stepErrors: Record<string, ClassifiedError[]>;
  retryAttempts: Record<string, number>;
  
  // Project-level tracking
  projectErrors: ClassifiedError[];
  plan: PlanDefinition;
  
  // Checkpoint metadata
  checkpointId?: string;
  lastCheckpointTime?: string;
  recoveryPoint?: string;
  
  // Execution context
  metadata: Record<string, any>;
}

/**
 * Legacy execution state for backward compatibility
 */
interface ExecutionState extends ProjectExecutionState {
  // Legacy interface - maps to ProjectExecutionState
}

@Injectable()
export class PlanExecutionService implements IPlanExecutionService {
  private readonly logger = new Logger(PlanExecutionService.name);
  private activeExecutions = new Map<string, ExecutionState>();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  // LangGraph components
  private checkpointSaver: SupabaseCheckpointSaver;
  private executionGraphs = new Map<string, StateGraph<ProjectExecutionState>>();

  constructor(
    private readonly llmService: LLMService,
    private readonly supabaseService: SupabaseService,
  ) {
    // Initialize checkpoint saver
    this.checkpointSaver = new SupabaseCheckpointSaver(this.supabaseService);
  }

  // ============================================================================
  // LANGGRAPH CHECKPOINT MANAGEMENT
  // ============================================================================

  /**
   * Create a LangGraph StateGraph for project execution with checkpointing
   */
  private createExecutionGraph(projectId: string, plan: PlanDefinition): StateGraph<ProjectExecutionState> {
    const graph = new StateGraph<ProjectExecutionState>({
      channels: {
        projectId: null,
        threadId: null,
        currentStepId: null,
        status: null,
        completedSteps: null,
        failedSteps: null,
        stepResults: null,
        stepErrors: null,
        retryAttempts: null,
        projectErrors: null,
        plan: null,
        checkpointId: null,  
        lastCheckpointTime: null,
        recoveryPoint: null,
        metadata: null
      }
    });

    // Add execution nodes
    graph.addNode('init_execution', this.initExecutionNode.bind(this));
    graph.addNode('execute_step', this.executeStepNode.bind(this));
    graph.addNode('checkpoint_progress', this.checkpointProgressNode.bind(this));
    graph.addNode('handle_error', this.handleErrorNode.bind(this));
    graph.addNode('complete_project', this.completeProjectNode.bind(this));

    // Define graph flow with checkpointing
    graph.addEdge(START, 'init_execution');
    graph.addEdge('init_execution', 'execute_step');
    graph.addEdge('execute_step', 'checkpoint_progress');
    
    // Conditional edges for error handling and completion
    graph.addConditionalEdges(
      'checkpoint_progress',
      this.routeAfterCheckpoint.bind(this),
      {
        'continue': 'execute_step',
        'error': 'handle_error', 
        'complete': 'complete_project',
        'pause': END
      }
    );
    
    graph.addEdge('handle_error', END);
    graph.addEdge('complete_project', END);

    // Compile with checkpoint saver
    const compiledGraph = graph.compile({
      checkpointer: this.checkpointSaver,
      interruptBefore: ['handle_error'], // Allow intervention before error handling
      interruptAfter: ['checkpoint_progress'] // Allow pause after checkpoints
    });

    return compiledGraph;
  }

  /**
   * Create a checkpoint at the current execution state
   */
  private async createCheckpoint(
    executionState: ExecutionState,
    checkpointType: 'step_start' | 'step_complete' | 'error' | 'pause' | 'manual',
    context?: { stepId?: string; reason?: string }
  ): Promise<string> {
    try {
      const checkpointId = `${executionState.projectId}_${checkpointType}_${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Create checkpoint metadata
      const checkpointMetadata = {
        checkpointId,
        type: checkpointType,
        timestamp,
        projectId: executionState.projectId,
        currentStepId: executionState.currentStepId,
        completedSteps: executionState.completedSteps.length,
        failedSteps: executionState.failedSteps.length,
        context: context || {},
        recoverable: true
      };

      // Update execution state with checkpoint info
      executionState.checkpointId = checkpointId;
      executionState.lastCheckpointTime = timestamp;
      executionState.recoveryPoint = checkpointType;

      // Use LangGraph's checkpoint system
      const config = { configurable: { thread_id: executionState.threadId || executionState.projectId } };
      
      // Create the checkpoint using our custom saver
      await this.checkpointSaver.put(
        config,
        {
          // Checkpoint data in LangGraph format
          channel_values: executionState,
          channel_versions: {
            // Version tracking for state changes
            projectId: 1,
            status: this.getStateVersion(executionState, 'status'),
            currentStepId: this.getStateVersion(executionState, 'currentStepId'),
            completedSteps: this.getStateVersion(executionState, 'completedSteps'),
            failedSteps: this.getStateVersion(executionState, 'failedSteps')
          },
          versions_seen: {}
        },
        checkpointMetadata
      );

      // Log checkpoint creation
      this.logger.log(
        `📍 Checkpoint created [${checkpointType}]: ${checkpointId} for project ${executionState.projectId}` +
        (context?.stepId ? ` at step ${context.stepId}` : '') +
        (context?.reason ? ` (${context.reason})` : '')
      );

      // Send WebSocket update about checkpoint
      await this.sendWebSocketUpdate(executionState.projectId, {
        type: 'checkpoint_created',
        checkpointId,
        checkpointType,
        timestamp,
        metadata: checkpointMetadata
      });

      return checkpointId;

    } catch (error) {
      this.logger.error(`Failed to create checkpoint for project ${executionState.projectId}:`, error);
      throw new Error(`Checkpoint creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the version number for a specific state field (for LangGraph versioning)
   */
  private getStateVersion(executionState: ExecutionState, field: string): number {
    // Simple versioning based on changes - in a real implementation you'd track this more precisely
    const versionKey = `${field}_version`;
    const currentVersion = executionState.metadata[versionKey] || 1;
    executionState.metadata[versionKey] = currentVersion + 1;
    return currentVersion;
  }

  /**
   * Restore execution state from a specific checkpoint
   */
  async restoreFromCheckpoint(projectId: string, checkpointId?: string): Promise<ExecutionState> {
    try {
      this.logger.log(`🔄 Restoring project ${projectId} from checkpoint: ${checkpointId || 'latest'}`);

      const config = { configurable: { thread_id: projectId } };
      
      let checkpoint: CheckpointTuple | undefined;
      
      if (checkpointId) {
        // Find specific checkpoint
        for await (const cp of this.checkpointSaver.list(config, { limit: 100 })) {
          if (cp.metadata.checkpointId === checkpointId) {
            checkpoint = cp;
            break;
          }
        }
      } else {
        // Get latest checkpoint
        checkpoint = await this.checkpointSaver.getTuple(config);
      }

      if (!checkpoint) {
        throw new Error(`No checkpoint found for project ${projectId}${checkpointId ? ` with ID ${checkpointId}` : ''}`);
      }

      // Restore execution state from checkpoint
      const restoredState = checkpoint.checkpoint.channel_values as ExecutionState;
      
      // Validate restored state
      if (!restoredState.projectId || restoredState.projectId !== projectId) {
        throw new Error('Invalid checkpoint data: project ID mismatch');
      }

      // Update checkpoint metadata
      restoredState.checkpointId = checkpoint.metadata.checkpointId;
      restoredState.lastCheckpointTime = checkpoint.metadata.timestamp;
      restoredState.recoveryPoint = checkpoint.metadata.type;

      // Store in active executions
      this.activeExecutions.set(projectId, restoredState);

      this.logger.log(
        `✅ Restored project ${projectId} from checkpoint ${checkpoint.metadata.checkpointId} ` +
        `(${checkpoint.metadata.type} at ${checkpoint.metadata.timestamp})`
      );

      // Send WebSocket update
      await this.sendWebSocketUpdate(projectId, {
        type: 'checkpoint_restored',
        checkpointId: checkpoint.metadata.checkpointId,
        checkpointType: checkpoint.metadata.type,
        restoredAt: new Date().toISOString(),
        executionState: {
          currentStepId: restoredState.currentStepId,
          completedSteps: restoredState.completedSteps.length,
          failedSteps: restoredState.failedSteps.length,
          status: restoredState.status
        }
      });

      return restoredState;

    } catch (error) {
      this.logger.error(`Failed to restore checkpoint for project ${projectId}:`, error);
      throw new Error(`Checkpoint restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available checkpoints for a project
   */
  async listCheckpoints(projectId: string, limit = 20): Promise<Array<{
    checkpointId: string;
    type: string;
    timestamp: string;
    currentStepId: string;
    completedSteps: number;
    failedSteps: number;
    context: any;
  }>> {
    try {
      const config = { configurable: { thread_id: projectId } };
      const checkpoints: any[] = [];

      for await (const checkpoint of this.checkpointSaver.list(config, { limit })) {
        checkpoints.push({
          checkpointId: checkpoint.metadata.checkpointId,
          type: checkpoint.metadata.type,
          timestamp: checkpoint.metadata.timestamp,
          currentStepId: checkpoint.metadata.currentStepId,
          completedSteps: checkpoint.metadata.completedSteps,
          failedSteps: checkpoint.metadata.failedSteps,
          context: checkpoint.metadata.context
        });
      }

      return checkpoints;

    } catch (error) {
      this.logger.error(`Failed to list checkpoints for project ${projectId}:`, error);
      throw new Error(`Failed to list checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // ENHANCED ERROR CLASSIFICATION SYSTEM
  // ============================================================================

  /**
   * Classify and enhance error information for better handling and recovery
   */
  private classifyError(
    error: Error, 
    context: { projectId: string; stepId?: string; agentName?: string }
  ): ClassifiedError {
    const timestamp = new Date().toISOString();
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = false;
    let suggestedAction = 'Contact support for assistance';

    // Classify based on error message and type
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      suggestedAction = 'Retry with longer timeout or check network connectivity';
    } else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      category = ErrorCategory.DATABASE_ERROR;
      severity = ErrorSeverity.HIGH;
      retryable = true;
      suggestedAction = 'Check database connectivity and permissions';
    } else if (errorMessage.includes('llm') || errorMessage.includes('anthropic') || errorMessage.includes('openai')) {
      category = ErrorCategory.LLM_SERVICE_ERROR;
      severity = ErrorSeverity.HIGH;
      retryable = true;
      suggestedAction = 'Check LLM service credentials and rate limits';
    } else if (errorMessage.includes('agent') && errorMessage.includes('not found')) {
      category = ErrorCategory.AGENT_UNAVAILABLE;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      suggestedAction = 'Verify agent exists and is properly configured';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      category = ErrorCategory.VALIDATION_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = false;
      suggestedAction = 'Review input data and step configuration';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      category = ErrorCategory.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      suggestedAction = 'Check network connectivity and service availability';
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      category = ErrorCategory.AUTHORIZATION_ERROR;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      suggestedAction = 'Check authentication credentials and permissions';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      category = ErrorCategory.RESOURCE_EXHAUSTED;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      suggestedAction = 'Wait for rate limit reset or upgrade service limits';
    } else if (errorMessage.includes('dependency') || errorMessage.includes('prerequisite')) {
      category = ErrorCategory.DEPENDENCY_FAILURE;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      suggestedAction = 'Check that all prerequisite steps completed successfully';
    } else if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
      category = ErrorCategory.USER_CANCELLED;
      severity = ErrorSeverity.LOW;
      retryable = false;
      suggestedAction = 'Operation was cancelled by user - no action needed';
    } else if (errorMessage.includes('config') || errorMessage.includes('setup')) {
      category = ErrorCategory.CONFIGURATION_ERROR;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      suggestedAction = 'Review system configuration and environment variables';
    }

    return {
      category,
      severity,
      message: error.message,
      originalError: error,
      timestamp,
      context: {
        ...context,
        retryable,
        suggestedAction
      },
      metadata: {
        stack: error.stack,
        errorType: error.constructor.name
      }
    };
  }

  /**
   * Record classified error in execution state and database
   */
  private async recordError(executionState: ExecutionState, classifiedError: ClassifiedError): Promise<void> {
    try {
      // Add to step errors if step-specific
      if (classifiedError.context.stepId) {
        const stepId = classifiedError.context.stepId;
        if (!executionState.stepErrors[stepId]) {
          executionState.stepErrors[stepId] = [];
        }
        executionState.stepErrors[stepId].push(classifiedError);
      } else {
        // Add to project-level errors
        executionState.projectErrors.push(classifiedError);
      }

      // Persist error to database
      const { error } = await this.supabaseService.getServiceClient()
        .from('project_errors')
        .insert({
          project_id: classifiedError.context.projectId,
          step_id: classifiedError.context.stepId,
          agent_name: classifiedError.context.agentName,
          category: classifiedError.category,
          severity: classifiedError.severity,
          message: classifiedError.message,
          error_data: {
            originalError: {
              message: classifiedError.originalError.message,
              stack: classifiedError.originalError.stack,
              name: classifiedError.originalError.name
            },
            context: classifiedError.context,
            metadata: classifiedError.metadata
          },
          created_at: classifiedError.timestamp
        });

      if (error) {
        this.logger.warn(`Failed to persist error to database: ${error.message}`);
      }

      // Send real-time error notification
      await this.sendWebSocketUpdate(executionState.projectId, {
        type: 'error_recorded',
        error: {
          category: classifiedError.category,
          severity: classifiedError.severity,
          message: classifiedError.message,
          stepId: classifiedError.context.stepId,
          agentName: classifiedError.context.agentName,
          retryable: classifiedError.context.retryable,
          suggestedAction: classifiedError.context.suggestedAction,
          timestamp: classifiedError.timestamp
        }
      });

      this.logger.error(
        `Classified error [${classifiedError.category}/${classifiedError.severity}] ` +
        `in project ${executionState.projectId}${classifiedError.context.stepId ? ` step ${classifiedError.context.stepId}` : ''}: ` +
        `${classifiedError.message}. Suggested action: ${classifiedError.context.suggestedAction}`
      );

    } catch (error) {
      this.logger.error(`Failed to record classified error:`, error);
      // Don't throw - error recording failures shouldn't stop execution
    }
  }

  /**
   * Determine if error should cause project pause based on severity and context
   */
  private shouldPauseProject(classifiedError: ClassifiedError, executionState: ExecutionState): boolean {
    // Always pause on critical errors
    if (classifiedError.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    // Pause on high severity errors unless they're retryable and under retry limit
    if (classifiedError.severity === ErrorSeverity.HIGH) {
      if (classifiedError.context.retryable && classifiedError.context.stepId) {
        const retryCount = executionState.retryAttempts[classifiedError.context.stepId] || 0;
        return retryCount >= this.MAX_RETRY_ATTEMPTS;
      }
      return true;
    }

    // Continue on medium/low severity errors
    return false;
  }

  // ============================================================================
  // PROJECT STATE TRANSITION MANAGEMENT
  // ============================================================================

  /**
   * Transition project to new status with proper validation and logging
   */
  private async transitionProjectState(
    executionState: ExecutionState,
    newStatus: ProjectStatus,
    context: {
      reason: string;
      stepId?: string;
      error?: ClassifiedError;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const oldStatus = executionState.status;
    
    // Validate state transition
    if (!this.isValidStateTransition(oldStatus, newStatus)) {
      this.logger.error(`Invalid state transition from ${oldStatus} to ${newStatus} for project ${executionState.projectId}`);
      throw new Error(`Invalid state transition: cannot change from ${oldStatus} to ${newStatus}`);
    }

    // Update execution state
    executionState.status = newStatus;

    // Prepare transition metadata
    const transitionMetadata = {
      previousStatus: oldStatus,
      transitionReason: context.reason,
      transitionTime: new Date().toISOString(),
      ...(context.stepId && { relatedStep: context.stepId }),
      ...(context.error && {
        errorCategory: context.error.category,
        errorSeverity: context.error.severity,
        errorMessage: context.error.message
      }),
      ...context.metadata
    };

    // Update database
    await this.updateProjectStatus(executionState.projectId, newStatus, transitionMetadata);

    // Log transition
    this.logger.log(
      `Project ${executionState.projectId}: ${oldStatus} → ${newStatus} (${context.reason})` +
      (context.stepId ? ` [Step: ${context.stepId}]` : '') +
      (context.error ? ` [Error: ${context.error.category}]` : '')
    );

    // Send specialized WebSocket updates based on new status
    await this.sendStateTransitionUpdate(executionState, oldStatus, newStatus, context);
  }

  /**
   * Validate if a state transition is allowed
   */
  private isValidStateTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      'planning': ['running', 'aborted'],
      'running': ['completed', 'paused_for_approval', 'paused_on_error', 'aborted'],
      'paused_for_approval': ['running', 'aborted'],
      'paused_on_error': ['running', 'aborted'],
      'completed': [], // Terminal state
      'aborted': []    // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Send specialized WebSocket update for state transitions
   */
  private async sendStateTransitionUpdate(
    executionState: ExecutionState,
    oldStatus: ProjectStatus,
    newStatus: ProjectStatus,
    context: any
  ): Promise<void> {
    const updateData = {
      type: 'project_state_transition',
      projectId: executionState.projectId,
      transition: {
        from: oldStatus,
        to: newStatus,
        reason: context.reason,
        timestamp: new Date().toISOString()
      },
      currentState: {
        status: newStatus,
        completedSteps: executionState.completedSteps.length,
        failedSteps: executionState.failedSteps.length,
        totalSteps: Object.keys(executionState.stepResults).length,
        currentStepId: executionState.currentStepId
      }
    };

    // Add error details for error-related transitions
    if (context.error) {
      updateData.currentState = {
        ...updateData.currentState,
        lastError: {
          category: context.error.category,
          severity: context.error.severity,
          message: context.error.message,
          retryable: context.error.context.retryable,
          suggestedAction: context.error.context.suggestedAction
        }
      };
    }

    await this.sendWebSocketUpdate(executionState.projectId, updateData);
  }

  /**
   * Get current project health status based on errors and execution state
   */
  private getProjectHealthStatus(executionState: ExecutionState): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for critical errors
    const criticalErrors = executionState.projectErrors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    if (criticalErrors.length > 0) {
      status = 'critical';
      issues.push(`${criticalErrors.length} critical error(s) detected`);
      recommendations.push('Immediate intervention required');
    }

    // Check for high severity errors
    const highSeverityErrors = executionState.projectErrors.filter(e => e.severity === ErrorSeverity.HIGH);
    if (highSeverityErrors.length > 0 && status !== 'critical') {
      status = 'warning';
      issues.push(`${highSeverityErrors.length} high severity error(s) detected`);
      recommendations.push('Review errors and consider manual intervention');
    }

    // Check for failed steps with multiple retry attempts
    const problematicSteps = Object.entries(executionState.retryAttempts)
      .filter(([_, attempts]) => attempts >= this.MAX_RETRY_ATTEMPTS);
    
    if (problematicSteps.length > 0) {
      if (status === 'healthy') status = 'warning';
      issues.push(`${problematicSteps.length} step(s) have exceeded retry limits`);
      recommendations.push('Review step configurations or consider alternative approaches');
    }

    // Check for stalled execution
    if (executionState.status === 'running' && executionState.currentStepId === '') {
      if (status === 'healthy') status = 'warning';
      issues.push('Project appears to be stalled without an active step');
      recommendations.push('Check execution logic or restart project');
    }

    return { status, issues, recommendations };
  }

  /**
   * Start project execution
   * 
   * Sets up execution state management and begins sequential step processing.
   * Uses database persistence for checkpointing and state recovery.
   */
  async startProject(project: Project): Promise<void> {
    this.logger.log(`Starting project execution: ${project.id}`);
    
    try {
      if (!project.planJson) {
        throw new Error('Project has no plan to execute');
      }

      // Initialize execution state
      const executionState: ExecutionState = {
        projectId: project.id,
        currentStepId: '',
        status: 'running',
        completedSteps: [],
        failedSteps: [],
        stepResults: {},
        stepErrors: {},
        projectErrors: [],
        retryAttempts: {},
        metadata: {
          startedAt: new Date().toISOString(),
          plan: project.planJson
        }
      };

      this.activeExecutions.set(project.id, executionState);

      // Transition project to running state
      await this.transitionProjectState(executionState, 'running', {
        reason: 'Project execution started',
        metadata: {
          totalSteps: project.planJson.steps.length,
          startedBy: 'system'
        }
      });

      // Start execution loop
      await this.executeProjectSteps(project.planJson, executionState);
      
    } catch (error) {
      const projectError = error instanceof Error ? error : new Error(String(error));
      
      // Classify project-level error
      const classifiedError = this.classifyError(projectError, { projectId: project.id });
      
      // Create temporary execution state for error recording if needed
      let executionState = this.activeExecutions.get(project.id);
      if (!executionState) {
        executionState = {
          projectId: project.id,
          currentStepId: '',
          status: 'paused_on_error',
          completedSteps: [],
          failedSteps: [],
          stepResults: {},
          stepErrors: {},
          projectErrors: [],
          retryAttempts: {},
          metadata: {}
        };
      }
      
      await this.recordError(executionState, classifiedError);
      await this.updateProjectStatus(project.id, 'paused_on_error', { 
        error: classifiedError.message,
        errorCategory: classifiedError.category,
        errorSeverity: classifiedError.severity,
        suggestedAction: classifiedError.context.suggestedAction
      });
      
      throw new Error(`Project execution failed [${classifiedError.category}]: ${classifiedError.message}`);
    }
  }

  /**
   * Resume paused project
   * 
   * Continues execution from last checkpoint, handling human input or error recovery.
   */
  async resumeProject(projectId: string): Promise<void> {
    this.logger.log(`Resuming project: ${projectId}`);
    
    try {
      // Load project and execution state
      const project = await this.loadProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Check if execution state exists in memory, otherwise reconstruct from database
      let executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        executionState = await this.reconstructExecutionState(project);
        this.activeExecutions.set(projectId, executionState);
      }

      // Transition to running state
      await this.transitionProjectState(executionState, 'running', {
        reason: 'Project resumed from pause',
        metadata: {
          resumedBy: 'user',
          previousState: executionState.status
        }
      });

      // Continue execution from current step
      if (project.planJson) {
        await this.executeProjectSteps(project.planJson, executionState);
      }
      
    } catch (error) {
      this.logger.error(`Failed to resume project ${projectId}:`, error);
      await this.updateProjectStatus(projectId, 'paused_on_error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Project resumption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry failed step
   * 
   * Implements "time travel" functionality by reverting step state and re-executing.
   */
  async retryStep(projectId: string, stepId: string): Promise<void> {
    this.logger.log(`Retrying step ${stepId} in project ${projectId}`);
    
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        throw new Error(`No active execution found for project ${projectId}`);
      }

      // Remove step from failed and completed lists (time travel reset)
      executionState.failedSteps = executionState.failedSteps.filter(id => id !== stepId);
      executionState.completedSteps = executionState.completedSteps.filter(id => id !== stepId);
      
      // Clear step result
      delete executionState.stepResults[stepId];

      // Update step status in database
      await this.updateStepStatus(projectId, stepId, 'pending');

      // Load project plan
      const project = await this.loadProject(projectId);
      if (!project?.planJson) {
        throw new Error(`Project plan not found for ${projectId}`);
      }

      // Find and retry the specific step
      const step = project.planJson.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found in project plan`);
      }

      // Execute the step
      await this.executeStep(step, executionState);
      
    } catch (error) {
      this.logger.error(`Failed to retry step ${stepId} in project ${projectId}:`, error);
      throw new Error(`Step retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Abort project execution
   * 
   * Terminates the project and cleans up resources.
   */
  async abortProject(projectId: string): Promise<void> {
    this.logger.log(`Aborting project: ${projectId}`);
    
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (executionState) {
        executionState.status = 'aborted';
        this.activeExecutions.delete(projectId);
      }

      await this.updateProjectStatus(projectId, 'aborted', { 
        abortedAt: new Date().toISOString(),
        reason: 'User requested abortion'
      });
      
      this.logger.log(`Project ${projectId} aborted successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to abort project ${projectId}:`, error);
      throw new Error(`Project abortion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // CORE EXECUTION METHODS - Step sequencing and execution logic
  // ============================================================================

  /**
   * Execute project steps sequentially with dependency management
   */
  private async executeProjectSteps(plan: PlanDefinition, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Executing ${plan.steps.length} steps for project ${executionState.projectId}`);
    
    try {
      const steps = plan.steps;
      const pendingSteps = steps.filter(step => 
        !executionState.completedSteps.includes(step.stepId) && 
        !executionState.failedSteps.includes(step.stepId)
      );

      for (const step of pendingSteps) {
        // Check if execution was aborted
        if (executionState.status === 'aborted') {
          this.logger.log(`Project ${executionState.projectId} execution aborted`);
          return;
        }

        // Check dependencies before executing step
        const dependenciesMet = this.checkStepDependencies(step, executionState);
        if (!dependenciesMet) {
          this.logger.warn(`Step ${step.stepId} dependencies not met, skipping for now`);
          continue;
        }

        // Execute the step
        executionState.currentStepId = step.stepId;
        
        try {
          await this.executeStep(step, executionState);
          
          // Mark step as completed
          executionState.completedSteps.push(step.stepId);
          await this.updateStepStatus(executionState.projectId, step.stepId, 'completed');
          
          this.logger.log(`Step ${step.stepId} completed successfully`);
          
        } catch (stepError) {
          const error = stepError instanceof Error ? stepError : new Error(String(stepError));
          
          // Classify and record the error
          const classifiedError = this.classifyError(error, {
            projectId: executionState.projectId,
            stepId: step.stepId,
            agentName: step.agentName
          });
          
          await this.recordError(executionState, classifiedError);
          
          // Increment retry counter
          const stepId = step.stepId;
          executionState.retryAttempts[stepId] = (executionState.retryAttempts[stepId] || 0) + 1;
          
          // Mark step as failed
          executionState.failedSteps.push(stepId);
          await this.updateStepStatus(executionState.projectId, stepId, 'failed', {
            error: classifiedError.message,
            category: classifiedError.category,
            severity: classifiedError.severity,
            retryable: classifiedError.context.retryable,
            suggestedAction: classifiedError.context.suggestedAction,
            retryAttempts: executionState.retryAttempts[stepId]
          });
          
          // Determine if we should pause the project
          const shouldPause = this.shouldPauseProject(classifiedError, executionState);
          
          if (shouldPause) {
            // For human approval steps, pause for approval
            if (step.stepType === 'human_approval') {
              await this.transitionProjectState(executionState, 'paused_for_approval', {
                reason: 'Human approval step failed and requires intervention',
                stepId,
                error: classifiedError,
                metadata: {
                  pendingApprovalStep: stepId,
                  approvalRequired: true
                }
              });
            } else {
              // For agent steps, pause on error
              await this.transitionProjectState(executionState, 'paused_on_error', {
                reason: `Step failed with ${classifiedError.severity} severity error`,
                stepId,
                error: classifiedError,
                metadata: {
                  failedStep: stepId,
                  retryAttempts: executionState.retryAttempts[stepId],
                  maxRetriesReached: (executionState.retryAttempts[stepId] || 0) >= this.MAX_RETRY_ATTEMPTS
                }
              });
            }
            return; // Stop execution
          } else {
            // Continue with remaining steps for non-critical errors
            this.logger.warn(`Step ${stepId} failed with ${classifiedError.severity} severity, continuing with remaining steps: ${classifiedError.message}`);
          }
        }
      }

      // Check if all steps are completed
      const allStepsCompleted = steps.every(step => 
        executionState.completedSteps.includes(step.stepId)
      );

      if (allStepsCompleted) {
        await this.transitionProjectState(executionState, 'completed', {
          reason: 'All project steps completed successfully',
          metadata: {
            completedAt: new Date().toISOString(),
            totalSteps: steps.length,
            completedSteps: executionState.completedSteps.length,
            failedSteps: executionState.failedSteps.length,
            projectHealth: this.getProjectHealthStatus(executionState)
          }
        });
        
        // Clean up execution state
        this.activeExecutions.delete(executionState.projectId);
        
        this.logger.log(`✅ Project ${executionState.projectId} completed successfully with ${executionState.completedSteps.length}/${steps.length} steps completed`);
      } else {
        // Project has remaining steps - determine why execution stopped
        const remainingSteps = steps.filter(s => !executionState.completedSteps.includes(s.stepId));
        const hasFailedSteps = executionState.failedSteps.length > 0;
        const hasPendingDependencies = remainingSteps.some(step => 
          !this.checkStepDependencies(step, executionState)
        );
        
        let pauseReason: string;
        let newStatus: ProjectStatus;
        
        if (hasFailedSteps) {
          newStatus = 'paused_on_error';
          pauseReason = `Project paused due to ${executionState.failedSteps.length} failed step(s)`;
        } else if (hasPendingDependencies) {
          newStatus = 'paused_on_error';
          pauseReason = 'Project paused due to unresolved step dependencies';
        } else {
          newStatus = 'paused_for_approval';
          pauseReason = 'Project paused awaiting human approval';
        }
        
        await this.transitionProjectState(executionState, newStatus, {
          reason: pauseReason,
          metadata: {
            remainingSteps: remainingSteps.length,
            failedSteps: executionState.failedSteps.length,
            pendingDependencies: hasPendingDependencies,
            projectHealth: this.getProjectHealthStatus(executionState)
          }
        });
      }
      
    } catch (error) {
      const projectError = error instanceof Error ? error : new Error(String(error));
      const classifiedError = this.classifyError(projectError, { 
        projectId: executionState.projectId 
      });
      
      await this.recordError(executionState, classifiedError);
      await this.transitionProjectState(executionState, 'paused_on_error', {
        reason: 'Project execution failed with unexpected error',
        error: classifiedError,
        metadata: {
          unexpectedFailure: true,
          executionContext: 'project_steps_loop'
        }
      });
      throw error;
    }
  }

  /**
   * Execute individual step based on step type
   */
  private async executeStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Executing step ${step.stepId}: ${step.stepName}`);
    
    try {
      await this.updateStepStatus(executionState.projectId, step.stepId, 'running');

      if (step.stepType === 'agent_step') {
        await this.executeAgentStep(step, executionState);
      } else if (step.stepType === 'human_approval') {
        await this.executeHumanApprovalStep(step, executionState);
      } else {
        throw new Error(`Unknown step type: ${step.stepType}`);
      }
      
    } catch (error) {
      this.logger.error(`Step ${step.stepId} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute agent step by delegating to specific agent
   */
  private async executeAgentStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    if (!step.agentName) {
      throw new Error(`Agent step ${step.stepId} missing agent assignment`);
    }

    this.logger.log(`Delegating step ${step.stepId} to agent: ${step.agentName}`);
    
    try {
      // TODO: Integrate with DelegationService when available
      // For now, simulate agent execution with LLM call
      
      const stepResult = await this.simulateAgentExecution(step, executionState);
      
      // Store step result
      executionState.stepResults[step.stepId] = stepResult;
      
      // Update step with result
      await this.updateStepStatus(executionState.projectId, step.stepId, 'completed', {
        result: stepResult,
        agentName: step.agentName,
        executedAt: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error(`Agent step execution failed for ${step.stepId}:`, error);
      throw error;
    }
  }

  /**
   * Execute human approval step
   */
  private async executeHumanApprovalStep(step: PlanStep, executionState: ExecutionState): Promise<void> {
    this.logger.log(`Pausing for human approval: ${step.stepId}`);
    
    try {
      // Human approval steps pause execution and wait for user input
      executionState.status = 'paused_for_approval';
      
      await this.updateStepStatus(executionState.projectId, step.stepId, 'pending_approval', {
        approvalRequested: new Date().toISOString(),
        prompt: step.prompt
      });
      
      await this.updateProjectStatus(executionState.projectId, 'paused_for_approval', {
        pendingApprovalStep: step.stepId,
        approvalPrompt: step.prompt
      });
      
      // Send WebSocket notification for approval needed
      await this.sendWebSocketUpdate(executionState.projectId, {
        type: 'approval_required',
        stepId: step.stepId,
        stepName: step.stepName,
        prompt: step.prompt
      });
      
      // Execution will pause here until resumeProject is called with approval
      throw new Error('Human approval required - execution paused');
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Human approval required')) {
        throw error; // Expected pause for approval
      }
      
      this.logger.error(`Human approval step failed for ${step.stepId}:`, error);
      throw error;
    }
  }

  /**
   * Simulate agent execution with LLM (temporary until DelegationService is ready)
   */
  private async simulateAgentExecution(step: PlanStep, executionState: ExecutionState): Promise<any> {
    const systemPrompt = `You are simulating the execution of an agent task. 
Provide a realistic result that an AI agent would produce for this type of task.

Agent: ${step.agentName}
Task Type: ${step.stepType}
Context: This is step ${step.stepId} in a larger project workflow.`;

    const userMessage = `Execute this task:
"${step.prompt}"

Previous step results available:
${Object.keys(executionState.stepResults).length > 0 ? 
  JSON.stringify(executionState.stepResults, null, 2) : 
  'None - this is an early step in the project'
}

Provide a realistic result that moves the project forward.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 500,
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return {
        success: true,
        result: response,
        executedBy: step.agentName,
        executedAt: new Date().toISOString(),
        stepId: step.stepId
      };
      
    } catch (error) {
      this.logger.error(`Simulated agent execution failed:`, error);
      throw new Error(`Agent execution simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // DATABASE HELPER METHODS - Project and step persistence
  // ============================================================================

  /**
   * Update project status in database
   */
  private async updateProjectStatus(
    projectId: string, 
    status: ProjectStatus, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await this.supabaseService.getServiceClient()
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // Send WebSocket update
      await this.sendWebSocketUpdate(projectId, {
        type: 'project_status_changed',
        status,
        metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to update project status for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Update step status in database
   */
  private async updateStepStatus(
    projectId: string,
    stepId: string,
    status: ProjectStepStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await this.supabaseService.getServiceClient()
        .from('project_steps')
        .update(updateData)
        .eq('project_id', projectId)
        .eq('step_id', stepId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // Send WebSocket update
      await this.sendWebSocketUpdate(projectId, {
        type: 'step_status_changed',
        stepId,
        status,
        metadata
      });
      
    } catch (error) {
      this.logger.error(`Failed to update step status for ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Load project from database
   */
  private async loadProject(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabaseService.getServiceClient()
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return data;
      
    } catch (error) {
      this.logger.error(`Failed to load project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Reconstruct execution state from database
   */
  private async reconstructExecutionState(project: Project): Promise<ExecutionState> {
    try {
      // Load project steps from database
      const { data: steps, error } = await this.supabaseService.getServiceClient()
        .from('project_steps')
        .select('*')
        .eq('project_id', project.id);

      if (error) {
        throw new Error(`Failed to load project steps: ${error.message}`);
      }

      const completedSteps = steps?.filter((s: any) => s.status === 'completed').map((s: any) => s.step_id) || [];
      const failedSteps = steps?.filter((s: any) => s.status === 'failed').map((s: any) => s.step_id) || [];
      const stepResults: Record<string, any> = {};
      
      // Reconstruct step results
      steps?.forEach((step: any) => {
        if (step.metadata?.result) {
          stepResults[step.step_id] = step.metadata.result;
        }
      });

      // Reconstruct error tracking from database
      const stepErrors: Record<string, ClassifiedError[]> = {};
      const projectErrors: ClassifiedError[] = [];
      const retryAttempts: Record<string, number> = {};

      // Load error history from database
      try {
        const { data: errorData } = await this.supabaseService.getServiceClient()
          .from('project_errors')
          .select('*')
          .eq('project_id', project.id)
          .order('created_at', { ascending: true });

        if (errorData) {
          errorData.forEach((errorRecord: any) => {
            const classifiedError: ClassifiedError = {
              category: errorRecord.category,
              severity: errorRecord.severity,
              message: errorRecord.message,
              originalError: new Error(errorRecord.error_data?.originalError?.message || errorRecord.message),
              timestamp: errorRecord.created_at,
              context: errorRecord.error_data?.context || {
                projectId: project.id,
                retryable: false,
                suggestedAction: 'Contact support'
              },
              metadata: errorRecord.error_data?.metadata
            };

            if (errorRecord.step_id) {
              if (!stepErrors[errorRecord.step_id]) {
                stepErrors[errorRecord.step_id] = [];
              }
              stepErrors[errorRecord.step_id].push(classifiedError);
            } else {
              projectErrors.push(classifiedError);
            }
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to load error history for project ${project.id}:`, error);
      }

      // Reconstruct retry attempts from step metadata
      steps?.forEach((step: any) => {
        if (step.metadata?.retryAttempts) {
          retryAttempts[step.step_id] = step.metadata.retryAttempts;
        }
      });

      const executionState: ExecutionState = {
        projectId: project.id,
        currentStepId: project.metadata?.currentStepId || '',
        status: project.status,
        completedSteps,
        failedSteps,
        stepResults,
        stepErrors,
        projectErrors,
        retryAttempts,
        metadata: project.metadata || {}
      };

      this.logger.log(`Reconstructed execution state for project ${project.id}: ${completedSteps.length} completed, ${failedSteps.length} failed`);
      return executionState;
      
    } catch (error) {
      this.logger.error(`Failed to reconstruct execution state for project ${project.id}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS - Dependencies and WebSocket integration
  // ============================================================================

  /**
   * Check if step dependencies are satisfied
   */
  private checkStepDependencies(step: PlanStep, executionState: ExecutionState): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true; // No dependencies
    }

    return step.dependencies.every(depId => 
      executionState.completedSteps.includes(depId)
    );
  }

  /**
   * Send WebSocket update for real-time project monitoring
   */
  private async sendWebSocketUpdate(projectId: string, update: any): Promise<void> {
    try {
      // TODO: Integrate with WebSocketGateway when available
      // For now, just log the update
      this.logger.debug(`WebSocket update for project ${projectId}:`, update);
      
    } catch (error) {
      this.logger.warn(`Failed to send WebSocket update for project ${projectId}:`, error);
      // Don't throw - WebSocket failures shouldn't stop execution
    }
  }

  // ============================================================================
  // LANGGRAPH EXECUTION NODES - State machine implementation
  // ============================================================================

  /**
   * Initialize execution node - Sets up initial state and creates first checkpoint
   */
  private async initExecutionNode(state: ProjectExecutionState): Promise<Partial<ProjectExecutionState>> {
    try {
      this.logger.log(`🚀 Initializing execution for project ${state.projectId}`);

      // Validate initial state
      if (!state.plan || !state.plan.steps || state.plan.steps.length === 0) {
        throw new Error('Invalid project plan: no steps found');
      }

      // Set thread ID for checkpoint management
      const threadId = state.threadId || state.projectId;

      // Find first executable step (no dependencies)
      const firstStep = state.plan.steps.find(step => 
        !step.dependencies || step.dependencies.length === 0
      );

      if (!firstStep) {
        throw new Error('No executable starting step found in plan');
      }

      // Create initialization checkpoint
      const checkpointId = await this.createCheckpoint(
        state as ExecutionState,
        'step_start',
        { stepId: firstStep.stepId, reason: 'Project execution initialized' }
      );

      // Update state for execution
      const updatedState: Partial<ProjectExecutionState> = {
        threadId,
        currentStepId: firstStep.stepId,
        status: 'running',
        checkpointId,
        lastCheckpointTime: new Date().toISOString(),
        recoveryPoint: 'init_execution',
        metadata: {
          ...state.metadata,
          initializationTime: new Date().toISOString(),
          firstStepId: firstStep.stepId,
          totalSteps: state.plan.steps.length
        }
      };

      this.logger.log(`✅ Project ${state.projectId} initialized, starting with step: ${firstStep.stepId}`);
      return updatedState;

    } catch (error) {
      this.logger.error(`❌ Failed to initialize execution for project ${state.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Execute step node - Handles step execution with error classification
   */
  private async executeStepNode(state: ProjectExecutionState): Promise<Partial<ProjectExecutionState>> {
    try {
      const stepId = state.currentStepId;
      if (!stepId) {
        throw new Error('No current step ID in execution state');
      }

      // Find the step in the plan
      const step = state.plan.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found in project plan`);
      }

      this.logger.log(`⚡ Executing step ${stepId}: ${step.stepName}`);

      // Check dependencies
      const dependenciesMet = this.checkStepDependencies(step, state as ExecutionState);
      if (!dependenciesMet) {
        throw new Error(`Step ${stepId} dependencies not satisfied`);
      }

      let stepResult: any;
      let stepError: ClassifiedError | null = null;

      try {
        // Execute the step based on type
        if (step.stepType === 'agent_step') {
          stepResult = await this.simulateAgentExecution(step, state as ExecutionState);
        } else if (step.stepType === 'human_approval') {
          // Human approval pauses execution - this will be handled in routing
          return {
            status: 'paused_for_approval',
            metadata: {
              ...state.metadata,
              pendingApprovalStep: stepId,
              approvalPrompt: step.prompt
            }
          };
        } else {
          throw new Error(`Unknown step type: ${step.stepType}`);
        }

        // Mark step as completed
        const updatedCompletedSteps = [...(state.completedSteps || []), stepId];
        const updatedStepResults = { 
          ...(state.stepResults || {}), 
          [stepId]: stepResult 
        };

        this.logger.log(`✅ Step ${stepId} completed successfully`);

        return {
          completedSteps: updatedCompletedSteps,
          stepResults: updatedStepResults,
          metadata: {
            ...state.metadata,
            lastCompletedStep: stepId,
            lastCompletedTime: new Date().toISOString()
          }
        };

      } catch (stepExecutionError) {
        const error = stepExecutionError instanceof Error 
          ? stepExecutionError 
          : new Error(String(stepExecutionError));

        // Classify the error
        stepError = this.classifyError(error, {
          projectId: state.projectId,
          stepId,
          agentName: step.agentName
        });

        // Record error in state
        const updatedFailedSteps = [...(state.failedSteps || []), stepId];
        const updatedStepErrors = {
          ...(state.stepErrors || {}),
          [stepId]: [...((state.stepErrors || {})[stepId] || []), stepError]
        };
        const updatedRetryAttempts = {
          ...(state.retryAttempts || {}),
          [stepId]: ((state.retryAttempts || {})[stepId] || 0) + 1
        };

        this.logger.error(`❌ Step ${stepId} failed: ${stepError.message}`);

        return {
          failedSteps: updatedFailedSteps,
          stepErrors: updatedStepErrors,
          retryAttempts: updatedRetryAttempts,
          metadata: {
            ...state.metadata,
            lastFailedStep: stepId,
            lastFailureTime: new Date().toISOString(),
            lastError: stepError
          }
        };
      }

    } catch (error) {
      this.logger.error(`❌ Execute step node failed for project ${state.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Checkpoint progress node - Creates checkpoints and determines next actions
   */
  private async checkpointProgressNode(state: ProjectExecutionState): Promise<Partial<ProjectExecutionState>> {
    try {
      this.logger.log(`📍 Creating checkpoint for project ${state.projectId}`);

      // Determine checkpoint type based on current state
      let checkpointType: 'step_start' | 'step_complete' | 'error' | 'pause' | 'manual';
      let context: { stepId?: string; reason?: string } = {};

      if (state.metadata?.lastError) {
        checkpointType = 'error';
        context = {
          stepId: state.currentStepId,
          reason: `Error occurred: ${state.metadata.lastError.message}`
        };
      } else if (state.status === 'paused_for_approval') {
        checkpointType = 'pause';
        context = {
          stepId: state.currentStepId,
          reason: 'Human approval required'
        };
      } else if (state.metadata?.lastCompletedStep) {
        checkpointType = 'step_complete';
        context = {
          stepId: state.metadata.lastCompletedStep,
          reason: 'Step completed successfully'
        };
      } else {
        checkpointType = 'step_start';
        context = {
          stepId: state.currentStepId,
          reason: 'Starting new step'
        };
      }

      // Create checkpoint
      const checkpointId = await this.createCheckpoint(
        state as ExecutionState,
        checkpointType,
        context
      );

      // Update checkpoint metadata in state
      const updatedState: Partial<ProjectExecutionState> = {
        checkpointId,
        lastCheckpointTime: new Date().toISOString(),
        recoveryPoint: checkpointType,
        metadata: {
          ...state.metadata,
          lastCheckpointType: checkpointType,
          checkpointContext: context
        }
      };

      this.logger.log(`✅ Checkpoint created: ${checkpointId} (${checkpointType})`);
      return updatedState;

    } catch (error) {
      this.logger.error(`❌ Failed to create checkpoint for project ${state.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Handle error node - Processes errors and determines recovery actions
   */
  private async handleErrorNode(state: ProjectExecutionState): Promise<Partial<ProjectExecutionState>> {
    try {
      const lastError = state.metadata?.lastError as ClassifiedError;
      if (!lastError) {
        throw new Error('Handle error node called without error context');
      }

      this.logger.log(`🚨 Handling error for project ${state.projectId}: ${lastError.category}/${lastError.severity}`);

      // Record the error in database
      await this.recordError(state as ExecutionState, lastError);

      // Determine if project should pause based on error severity
      const shouldPause = this.shouldPauseProject(lastError, state as ExecutionState);

      if (shouldPause) {
        // Transition to error state
        const newStatus: ProjectStatus = lastError.context.stepId?.includes('approval') 
          ? 'paused_for_approval' 
          : 'paused_on_error';

        await this.transitionProjectState(state as ExecutionState, newStatus, {
          reason: `Project paused due to ${lastError.severity} severity error`,
          stepId: lastError.context.stepId,
          error: lastError,
          metadata: {
            errorHandlingTime: new Date().toISOString(),
            pauseReason: lastError.context.suggestedAction,
            retryable: lastError.context.retryable
          }
        });

        return {
          status: newStatus,
          metadata: {
            ...state.metadata,
            pausedDueToError: true,
            pausedAt: new Date().toISOString(),
            pauseReason: lastError.context.suggestedAction
          }
        };
      } else {
        // Continue execution despite error
        this.logger.warn(`⚠️ Continuing execution despite ${lastError.severity} error: ${lastError.message}`);
        
        return {
          metadata: {
            ...state.metadata,
            errorHandled: true,
            continuedDespiteError: true,
            handledAt: new Date().toISOString()
          }
        };
      }

    } catch (error) {
      this.logger.error(`❌ Error handling failed for project ${state.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Complete project node - Finalizes successful project execution
   */
  private async completeProjectNode(state: ProjectExecutionState): Promise<Partial<ProjectExecutionState>> {
    try {
      this.logger.log(`🎉 Completing project ${state.projectId}`);

      // Validate all steps are completed
      const totalSteps = state.plan.steps.length;
      const completedSteps = (state.completedSteps || []).length;
      const failedSteps = (state.failedSteps || []).length;

      if (completedSteps !== totalSteps) {
        this.logger.warn(`Project completion with incomplete steps: ${completedSteps}/${totalSteps} completed`);
      }

      // Get project health status
      const healthStatus = this.getProjectHealthStatus(state as ExecutionState);

      // Create final checkpoint
      const finalCheckpointId = await this.createCheckpoint(
        state as ExecutionState,
        'manual',
        { reason: 'Project completed' }
      );

      // Transition to completed state
      await this.transitionProjectState(state as ExecutionState, 'completed', {
        reason: 'All project steps completed successfully',
        metadata: {
          completedAt: new Date().toISOString(),
          totalSteps,
          completedSteps,
          failedSteps,
          projectHealth: healthStatus,
          finalCheckpointId
        }
      });

      // Clean up active execution
      this.activeExecutions.delete(state.projectId);

      const completionMetadata = {
        ...state.metadata,
        completed: true,
        completedAt: new Date().toISOString(),
        finalStats: {
          totalSteps,
          completedSteps,
          failedSteps,
          successRate: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
        },
        healthStatus,
        finalCheckpointId
      };

      this.logger.log(`✅ Project ${state.projectId} completed successfully: ${completedSteps}/${totalSteps} steps (${completionMetadata.finalStats.successRate.toFixed(1)}% success rate)`);

      return {
        status: 'completed',
        metadata: completionMetadata
      };

    } catch (error) {
      this.logger.error(`❌ Failed to complete project ${state.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Route after checkpoint - Determines next step in execution flow
   */
  private routeAfterCheckpoint(state: ProjectExecutionState): string {
    try {
      // Check for errors that need handling
      if (state.metadata?.lastError) {
        this.logger.log(`🔀 Routing to error handler for project ${state.projectId}`);
        return 'error';
      }

      // Check if project is paused for approval
      if (state.status === 'paused_for_approval') {
        this.logger.log(`⏸️ Routing to pause for project ${state.projectId} (approval required)`);
        return 'pause';
      }

      // Check if all steps are completed
      const totalSteps = state.plan.steps.length;
      const completedSteps = (state.completedSteps || []).length;
      
      if (completedSteps >= totalSteps) {
        this.logger.log(`🏁 Routing to completion for project ${state.projectId} (${completedSteps}/${totalSteps} steps completed)`);
        return 'complete';
      }

      // Find next executable step
      const remainingSteps = state.plan.steps.filter(step => 
        !(state.completedSteps || []).includes(step.stepId) &&
        !(state.failedSteps || []).includes(step.stepId)
      );

      const nextStep = remainingSteps.find(step => 
        this.checkStepDependencies(step, state as ExecutionState)
      );

      if (nextStep) {
        // Update current step and continue execution
        const currentExecution = this.activeExecutions.get(state.projectId);
        if (currentExecution) {
          currentExecution.currentStepId = nextStep.stepId;
        }
        
        this.logger.log(`➡️ Routing to continue execution for project ${state.projectId}, next step: ${nextStep.stepId}`);
        return 'continue';
      } else {
        // No executable steps remaining - might be dependency issues
        if (remainingSteps.length > 0) {
          this.logger.warn(`⚠️ Routing to error for project ${state.projectId}: ${remainingSteps.length} steps remain but none are executable (dependency issues)`);
          return 'error';
        } else {
          // All steps processed
          this.logger.log(`🏁 Routing to completion for project ${state.projectId} (all steps processed)`);
          return 'complete';
        }
      }

    } catch (error) {
      this.logger.error(`❌ Failed to route after checkpoint for project ${state.projectId}:`, error);
      return 'error';
    }
  }

  // ============================================================================
  // ENHANCED RETRY/ROLLBACK FUNCTIONALITY - Advanced recovery mechanisms
  // ============================================================================

  /**
   * Get appropriate retry strategy based on error classification
   */
  private getRetryStrategy(error: ClassifiedError, currentAttempt: number): {
    strategy: RetryStrategy;
    delayMs: number;
    shouldRetry: boolean;
    maxAttempts: number;
  } {
    let strategy = RetryStrategy.NO_RETRY;
    let delayMs = 0;
    let shouldRetry = false;
    let maxAttempts = this.MAX_RETRY_ATTEMPTS;

    // Determine strategy based on error category and severity
    switch (error.category) {
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.NETWORK_ERROR:
        strategy = RetryStrategy.EXPONENTIAL_BACKOFF;
        maxAttempts = 5; // More attempts for transient issues
        delayMs = Math.min(1000 * Math.pow(2, currentAttempt), 30000); // Cap at 30s
        shouldRetry = currentAttempt < maxAttempts;
        break;

      case ErrorCategory.LLM_SERVICE_ERROR:
      case ErrorCategory.DATABASE_ERROR:
        strategy = RetryStrategy.LINEAR_BACKOFF;
        maxAttempts = 3;
        delayMs = 2000 * currentAttempt; // 2s, 4s, 6s
        shouldRetry = currentAttempt < maxAttempts;
        break;

      case ErrorCategory.RESOURCE_EXHAUSTED:
        strategy = RetryStrategy.EXPONENTIAL_BACKOFF;
        maxAttempts = 4;
        delayMs = Math.min(5000 * Math.pow(2, currentAttempt), 120000); // Cap at 2min
        shouldRetry = currentAttempt < maxAttempts;
        break;

      case ErrorCategory.DEPENDENCY_FAILURE:
        strategy = RetryStrategy.ROLLBACK_AND_RETRY;
        maxAttempts = 2; // Limited attempts for dependency issues
        delayMs = 1000;
        shouldRetry = currentAttempt < maxAttempts;
        break;

      case ErrorCategory.VALIDATION_ERROR:
      case ErrorCategory.AUTHORIZATION_ERROR:
      case ErrorCategory.CONFIGURATION_ERROR:
      case ErrorCategory.AGENT_UNAVAILABLE:
        strategy = RetryStrategy.NO_RETRY;
        shouldRetry = false; // These require manual intervention
        break;

      case ErrorCategory.USER_CANCELLED:
        strategy = RetryStrategy.NO_RETRY;
        shouldRetry = false;
        break;

      default:
        // Unknown errors get limited retry attempts
        strategy = RetryStrategy.LINEAR_BACKOFF;
        maxAttempts = 2;
        delayMs = 3000 * currentAttempt;
        shouldRetry = currentAttempt < maxAttempts;
    }

    // Override based on severity
    if (error.severity === ErrorSeverity.CRITICAL) {
      shouldRetry = false;
      strategy = RetryStrategy.NO_RETRY;
    }

    return { strategy, delayMs, shouldRetry, maxAttempts };
  }

  /**
   * Enhanced retry step with intelligent retry strategies
   */
  async retryStepWithStrategy(
    projectId: string, 
    stepId: string, 
    forceStrategy?: RetryStrategy
  ): Promise<{ success: boolean; checkpointId?: string; error?: string }> {
    this.logger.log(`🔄 Starting intelligent retry for step ${stepId} in project ${projectId}`);
    
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        throw new Error(`No active execution found for project ${projectId}`);
      }

      // Get step error history
      const stepErrors = executionState.stepErrors[stepId] || [];
      const lastError = stepErrors[stepErrors.length - 1];
      
      if (!lastError) {
        throw new Error(`No error history found for step ${stepId}`);
      }

      const currentAttempt = executionState.retryAttempts[stepId] || 0;
      
      // Determine retry strategy
      const retryConfig = forceStrategy 
        ? { strategy: forceStrategy, delayMs: 1000, shouldRetry: true, maxAttempts: this.MAX_RETRY_ATTEMPTS }
        : this.getRetryStrategy(lastError, currentAttempt);

      if (!retryConfig.shouldRetry) {
        return {
          success: false,
          error: `Step ${stepId} cannot be retried: ${retryConfig.strategy} strategy indicates manual intervention required`
        };
      }

      this.logger.log(`Retry strategy for step ${stepId}: ${retryConfig.strategy} (attempt ${currentAttempt + 1}/${retryConfig.maxAttempts}, delay: ${retryConfig.delayMs}ms)`);

      // Handle rollback strategy
      if (retryConfig.strategy === RetryStrategy.ROLLBACK_AND_RETRY) {
        const rollbackResult = await this.rollbackToDependencyCheckpoint(projectId, stepId);
        if (!rollbackResult.success) {
          return {
            success: false,
            error: `Rollback failed before retry: ${rollbackResult.error}`
          };
        }
      }

      // Apply delay if specified
      if (retryConfig.delayMs > 0) {
        this.logger.log(`⏱️ Waiting ${retryConfig.delayMs}ms before retry attempt...`);
        await new Promise(resolve => setTimeout(resolve, retryConfig.delayMs));
      }

      // Create pre-retry checkpoint
      const preRetryCheckpointId = await this.createCheckpoint(
        executionState,
        'manual',
        { 
          stepId, 
          reason: `Pre-retry checkpoint (${retryConfig.strategy}, attempt ${currentAttempt + 1})` 
        }
      );

      // Perform the actual retry
      const retryResult = await this.performStepRetry(projectId, stepId, retryConfig.strategy);

      if (retryResult.success) {
        this.logger.log(`✅ Step ${stepId} retry successful using ${retryConfig.strategy} strategy`);
        
        // Send success notification
        await this.sendWebSocketUpdate(projectId, {
          type: 'step_retry_success',
          stepId,
          strategy: retryConfig.strategy,
          attempt: currentAttempt + 1,
          checkpointId: preRetryCheckpointId
        });

        return { success: true, checkpointId: preRetryCheckpointId };
      } else {
        this.logger.warn(`⚠️ Step ${stepId} retry failed using ${retryConfig.strategy} strategy: ${retryResult.error}`);
        return { success: false, error: retryResult.error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Enhanced retry failed for step ${stepId} in project ${projectId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Perform the actual step retry with cleanup
   */
  private async performStepRetry(
    projectId: string, 
    stepId: string, 
    strategy: RetryStrategy
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        throw new Error(`No active execution found for project ${projectId}`);
      }

      // Load project plan
      const project = await this.loadProject(projectId);
      if (!project?.planJson) {
        throw new Error(`Project plan not found for ${projectId}`);
      }

      // Find the step
      const step = project.planJson.steps.find(s => s.stepId === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found in project plan`);
      }

      // Clean up previous state
      executionState.failedSteps = executionState.failedSteps.filter(id => id !== stepId);
      executionState.completedSteps = executionState.completedSteps.filter(id => id !== stepId);
      delete executionState.stepResults[stepId];

      // Reset step in database
      await this.updateStepStatus(projectId, stepId, 'pending', {
        retryStrategy: strategy,
        retryAttempt: (executionState.retryAttempts[stepId] || 0) + 1,
        clearedAt: new Date().toISOString()
      });

      // Execute the step
      await this.executeStep(step, executionState);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Rollback to a specific checkpoint with cascade handling
   */
  async rollbackToCheckpoint(
    projectId: string, 
    checkpointId: string,
    options: {
      cascadeRollback?: boolean;
      preserveSubsequentCheckpoints?: boolean;
      reason?: string;
    } = {}
  ): Promise<{ success: boolean; affectedSteps?: string[]; error?: string }> {
    this.logger.log(`⏪ Rolling back project ${projectId} to checkpoint ${checkpointId}`);
    
    try {
      // Restore state from checkpoint
      const restoredState = await this.restoreFromCheckpoint(projectId, checkpointId);
      
      // Determine which steps need to be rolled back
      const currentState = this.activeExecutions.get(projectId);
      const affectedSteps: string[] = [];

      if (currentState && options.cascadeRollback !== false) {
        // Find steps that were completed after the checkpoint
        const checkpointCompletedSteps = restoredState.completedSteps;
        const currentCompletedSteps = currentState.completedSteps;
        
        affectedSteps.push(
          ...currentCompletedSteps.filter(stepId => 
            !checkpointCompletedSteps.includes(stepId)
          )
        );

        // Handle cascade rollback - rollback dependent steps
        if (options.cascadeRollback && affectedSteps.length > 0) {
          const cascadeSteps = await this.findDependentSteps(projectId, affectedSteps);
          affectedSteps.push(...cascadeSteps);
        }
      }

      // Clean up affected steps
      for (const stepId of affectedSteps) {
        await this.cleanupStepState(projectId, stepId, 'rollback');
      }

      // Create rollback completion checkpoint
      const rollbackCheckpointId = await this.createCheckpoint(
        restoredState,
        'manual',
        { 
          reason: options.reason || `Rollback to checkpoint ${checkpointId}`,
          rollbackType: 'checkpoint_restore',
          affectedSteps: affectedSteps.length
        }
      );

      // Send rollback notification
      await this.sendWebSocketUpdate(projectId, {
        type: 'project_rollback_completed',
        checkpointId,
        rollbackCheckpointId,
        affectedSteps,
        rollbackReason: options.reason,
        timestamp: new Date().toISOString()
      });

      this.logger.log(`✅ Rollback completed for project ${projectId}. Affected steps: ${affectedSteps.join(', ')}`);

      return { success: true, affectedSteps };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Rollback failed for project ${projectId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Rollback to the last checkpoint before a dependency failure
   */
  private async rollbackToDependencyCheckpoint(
    projectId: string,
    failedStepId: string
  ): Promise<{ success: boolean; checkpointId?: string; error?: string }> {
    try {
      this.logger.log(`🔄 Rolling back to dependency checkpoint for step ${failedStepId}`);

      // Load project plan to understand dependencies
      const project = await this.loadProject(projectId);
      if (!project?.planJson) {
        throw new Error(`Project plan not found for ${projectId}`);
      }

      const failedStep = project.planJson.steps.find(s => s.stepId === failedStepId);
      if (!failedStep) {
        throw new Error(`Step ${failedStepId} not found in project plan`);
      }

      // Find the last successful dependency
      const dependencies = failedStep.dependencies || [];
      if (dependencies.length === 0) {
        return { success: false, error: 'No dependencies to rollback to' };
      }

      // Get all checkpoints for this project
      const checkpoints = await this.listCheckpoints(projectId, 50);
      
      // Find the checkpoint right after the last successful dependency
      let targetCheckpoint = null;
      
      for (const checkpoint of checkpoints.reverse()) { // Start from oldest
        const checkpointSteps = checkpoint.completedSteps || 0;
        
        // Check if this checkpoint has all dependencies completed but not the failed step
        const hasAllDependencies = dependencies.every(depId => {
          // This is a simplified check - in reality we'd need to check the actual checkpoint state
          return checkpointSteps > 0; // Placeholder logic
        });
        
        if (hasAllDependencies && checkpoint.currentStepId !== failedStepId) {
          targetCheckpoint = checkpoint;
          break;
        }
      }

      if (!targetCheckpoint) {
        return { success: false, error: 'No suitable dependency checkpoint found' };
      }

      // Perform the rollback
      const rollbackResult = await this.rollbackToCheckpoint(projectId, targetCheckpoint.checkpointId, {
        cascadeRollback: true,
        reason: `Dependency rollback for failed step ${failedStepId}`
      });

      if (rollbackResult.success) {
        return { success: true, checkpointId: targetCheckpoint.checkpointId };
      } else {
        return { success: false, error: rollbackResult.error };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Dependency rollback failed:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find steps that depend on the given steps (for cascade rollback)
   */
  private async findDependentSteps(projectId: string, stepIds: string[]): Promise<string[]> {
    try {
      const project = await this.loadProject(projectId);
      if (!project?.planJson) {
        return [];
      }

      const dependentSteps: string[] = [];
      
      for (const step of project.planJson.steps) {
        if (step.dependencies && step.dependencies.some(depId => stepIds.includes(depId))) {
          if (!dependentSteps.includes(step.stepId)) {
            dependentSteps.push(step.stepId);
          }
        }
      }

      // Recursively find dependent steps
      if (dependentSteps.length > 0) {
        const nestedDependents = await this.findDependentSteps(projectId, dependentSteps);
        dependentSteps.push(...nestedDependents.filter(id => !dependentSteps.includes(id)));
      }

      return dependentSteps;

    } catch (error) {
      this.logger.error(`Failed to find dependent steps:`, error);
      return [];
    }
  }

  /**
   * Clean up step state during rollback
   */
  private async cleanupStepState(
    projectId: string, 
    stepId: string, 
    reason: 'rollback' | 'retry' | 'abort'
  ): Promise<void> {
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (executionState) {
        // Remove from completed steps
        executionState.completedSteps = executionState.completedSteps.filter(id => id !== stepId);
        
        // Clear step result
        delete executionState.stepResults[stepId];
        
        // Add to failed steps if not already there
        if (!executionState.failedSteps.includes(stepId)) {
          executionState.failedSteps.push(stepId);
        }
      }

      // Update database
      await this.updateStepStatus(projectId, stepId, 'pending', {
        clearedBy: reason,
        clearedAt: new Date().toISOString(),
        previousStatus: 'completed'
      });

      this.logger.debug(`🧹 Cleaned up step ${stepId} state due to ${reason}`);

    } catch (error) {
      this.logger.error(`Failed to cleanup step ${stepId} state:`, error);
      throw error;
    }
  }

  /**
   * Get retry/rollback recommendations based on project state
   */
  async getRecoveryRecommendations(projectId: string): Promise<{
    recommendations: Array<{
      type: 'retry' | 'rollback' | 'manual_intervention';
      stepId?: string;
      checkpointId?: string;
      strategy?: RetryStrategy;
      reason: string;
      confidence: number; // 0-1 scale
      estimatedSuccess: number; // 0-1 scale
    }>;
    projectHealth: 'healthy' | 'warning' | 'critical';
  }> {
    try {
      const executionState = this.activeExecutions.get(projectId);
      if (!executionState) {
        throw new Error(`No active execution found for project ${projectId}`);
      }

      const recommendations: any[] = [];
      
      // Analyze failed steps
      for (const stepId of executionState.failedSteps) {
        const stepErrors = executionState.stepErrors[stepId] || [];
        const lastError = stepErrors[stepErrors.length - 1];
        const retryAttempts = executionState.retryAttempts[stepId] || 0;

        if (lastError) {
          const retryConfig = this.getRetryStrategy(lastError, retryAttempts);
          
          if (retryConfig.shouldRetry) {
            recommendations.push({
              type: 'retry',
              stepId,
              strategy: retryConfig.strategy,
              reason: `Step failed with ${lastError.category} - ${retryConfig.strategy} strategy recommended`,
              confidence: this.calculateRetryConfidence(lastError, retryAttempts),
              estimatedSuccess: this.estimateRetrySuccess(lastError, retryConfig.strategy)
            });
          } else {
            recommendations.push({
              type: 'manual_intervention',
              stepId,
              reason: `Step requires manual intervention: ${lastError.context.suggestedAction}`,
              confidence: 0.9,
              estimatedSuccess: 0.1
            });
          }
        }
      }

      // Analyze potential rollback opportunities
      const checkpoints = await this.listCheckpoints(projectId, 10);
      for (const checkpoint of checkpoints) {
        if (checkpoint.type === 'step_complete' && checkpoint.completedSteps > 0) {
          const rollbackWorthiness = this.assessRollbackWorthiness(executionState, checkpoint);
          
          if (rollbackWorthiness.confidence > 0.3) {
            recommendations.push({
              type: 'rollback',
              checkpointId: checkpoint.checkpointId,
              reason: rollbackWorthiness.reason,
              confidence: rollbackWorthiness.confidence,
              estimatedSuccess: rollbackWorthiness.estimatedSuccess
            });
          }
        }
      }

      // Sort by confidence and estimated success
      recommendations.sort((a, b) => (b.confidence * b.estimatedSuccess) - (a.confidence * a.estimatedSuccess));

      const projectHealth = this.getProjectHealthStatus(executionState);

      return {
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
        projectHealth: projectHealth.status
      };

    } catch (error) {
      this.logger.error(`Failed to get recovery recommendations for project ${projectId}:`, error);
      return { recommendations: [], projectHealth: 'critical' };
    }
  }

  /**
   * Calculate confidence in retry success based on error history
   */
  private calculateRetryConfidence(error: ClassifiedError, attempts: number): number {
    let baseConfidence = 0.5;

    // Adjust based on error category
    switch (error.category) {
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.NETWORK_ERROR:
        baseConfidence = 0.8; // High confidence for transient issues
        break;
      case ErrorCategory.RESOURCE_EXHAUSTED:
        baseConfidence = 0.7;
        break;
      case ErrorCategory.LLM_SERVICE_ERROR:
        baseConfidence = 0.6;
        break;
      case ErrorCategory.DATABASE_ERROR:
        baseConfidence = 0.5;
        break;
      default:
        baseConfidence = 0.3;
    }

    // Reduce confidence with more attempts
    const attemptPenalty = attempts * 0.15;
    return Math.max(0.1, baseConfidence - attemptPenalty);
  }

  /**
   * Estimate retry success based on error type and strategy
   */
  private estimateRetrySuccess(error: ClassifiedError, strategy: RetryStrategy): number {
    let baseSuccess = 0.5;

    // Strategy effectiveness
    const strategyBonus = {
      [RetryStrategy.EXPONENTIAL_BACKOFF]: 0.2,
      [RetryStrategy.LINEAR_BACKOFF]: 0.1,
      [RetryStrategy.ROLLBACK_AND_RETRY]: 0.3,
      [RetryStrategy.IMMEDIATE]: 0.0,
      [RetryStrategy.NO_RETRY]: 0.0
    };

    // Error category success rates
    const categorySuccess = {
      [ErrorCategory.TIMEOUT]: 0.8,
      [ErrorCategory.NETWORK_ERROR]: 0.7,
      [ErrorCategory.RESOURCE_EXHAUSTED]: 0.6,
      [ErrorCategory.LLM_SERVICE_ERROR]: 0.5,
      [ErrorCategory.DATABASE_ERROR]: 0.4,
      [ErrorCategory.DEPENDENCY_FAILURE]: 0.3,
      [ErrorCategory.VALIDATION_ERROR]: 0.1,
      [ErrorCategory.AUTHORIZATION_ERROR]: 0.1,
      [ErrorCategory.CONFIGURATION_ERROR]: 0.1,
      [ErrorCategory.AGENT_UNAVAILABLE]: 0.1,
      [ErrorCategory.USER_CANCELLED]: 0.0,
      [ErrorCategory.UNKNOWN]: 0.2
    };

    baseSuccess = categorySuccess[error.category] || 0.2;
    return Math.min(0.95, baseSuccess + strategyBonus[strategy]);
  }

  /**
   * Assess if a rollback to a checkpoint would be worthwhile
   */
  private assessRollbackWorthiness(
    currentState: ExecutionState,
    checkpoint: any
  ): { confidence: number; estimatedSuccess: number; reason: string } {
    const failedSteps = currentState.failedSteps.length;
    const completedSinceCheckpoint = currentState.completedSteps.length - (checkpoint.completedSteps || 0);
    
    // Don't recommend rollback if no significant progress was made
    if (completedSinceCheckpoint < 2) {
      return { confidence: 0.1, estimatedSuccess: 0.2, reason: 'Minimal progress since checkpoint' };
    }

    // Higher confidence if many steps failed after checkpoint
    if (failedSteps > completedSinceCheckpoint / 2) {
      return { 
        confidence: 0.8, 
        estimatedSuccess: 0.7, 
        reason: `High failure rate (${failedSteps} failures vs ${completedSinceCheckpoint} completed) suggests rollback may help` 
      };
    }

    // Medium confidence for moderate failure rates
    if (failedSteps > 0) {
      return { 
        confidence: 0.5, 
        estimatedSuccess: 0.6, 
        reason: `${failedSteps} step failures since stable checkpoint` 
      };
    }

    return { confidence: 0.2, estimatedSuccess: 0.4, reason: 'No clear benefit from rollback' };
  }
}