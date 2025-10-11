import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentStreamChunkEvent,
  AgentStreamCompleteEvent,
  AgentStreamErrorEvent,
} from '@/agent-platform/services/agent-runtime-stream.service';
import { randomUUID } from 'crypto';

export interface TaskStatus {
  taskId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  // Agent-specific JSON data (flexible)
  [key: string]: any;
}

export interface TaskStatusUpdate {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  // Any additional JSON fields from agent
  [key: string]: any;
}

interface TaskStreamSession {
  sessionId: string;
  taskId: string;
  userId: string;
  agentSlug: string;
  organizationSlug: string;
  conversationId: string | null;
  streamId: string | null;
  registeredAt: number;
  lastEventAt: number;
  conversationKey: string;
}

/**
 * Single source of truth for task status management
 * Handles both ephemeral and persistent tasks based on agent card taskType
 */
@Injectable()
export class TaskStatusService {
  private readonly logger = new Logger(TaskStatusService.name);
  private readonly messageTtlMs =
    Math.max(Number(process.env.TASK_MESSAGE_TTL_MINUTES ?? 60), 1) * 60 * 1000;
  private readonly streamInactivityMs = Math.max(
    Number(process.env.TASK_STREAM_INACTIVITY_MS ?? 60_000),
    5_000,
  );

  // Hot cache for all active tasks (both ephemeral and persistent)
  private activeTaskStatuses = new Map<string, TaskStatus>();

  // Live message cache for active tasks (for polling clients)
  private activeTaskMessages = new Map<
    string,
    Array<{
      id: string;
      taskId: string;
      content: string;
      messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
      progressPercentage?: number;
      metadata?: Record<string, any>;
      createdAt: string;
      expiresAt: string;
    }>
  >();

  // Cleanup timers for completed tasks
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private streamSessionsById = new Map<string, TaskStreamSession>();
  private activeStreamSessionsByStreamId = new Map<string, TaskStreamSession>();
  private activeStreamSessionsByConversation = new Map<
    string,
    TaskStreamSession
  >();
  private streamCleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
  ) {}

  registerStreamSession(params: {
    taskId: string;
    userId: string;
    agentSlug: string;
    organizationSlug: string;
    streamId?: string | null;
    conversationId?: string | null;
  }): string {
    const sessionId = randomUUID();
    const normalizedOrg =
      params.organizationSlug && params.organizationSlug.trim().length > 0
        ? params.organizationSlug
        : 'global';
    const session: TaskStreamSession = {
      sessionId,
      taskId: params.taskId,
      userId: params.userId,
      agentSlug: params.agentSlug,
      organizationSlug: normalizedOrg,
      conversationId: params.conversationId ?? null,
      streamId: params.streamId ?? null,
      registeredAt: Date.now(),
      lastEventAt: Date.now(),
      conversationKey: this.buildConversationKey(
        normalizedOrg,
        params.agentSlug,
        params.conversationId ?? null,
      ),
    };

    this.streamSessionsById.set(session.sessionId, session);
    if (session.streamId) {
      this.activeStreamSessionsByStreamId.set(session.streamId, session);
    }
    this.activeStreamSessionsByConversation.set(
      session.conversationKey,
      session,
    );

    this.scheduleStreamCleanup(session);

    this.logger.debug('Registered stream session', {
      taskId: session.taskId,
      streamId: session.streamId,
      sessionId: session.sessionId,
      agentSlug: session.agentSlug,
      organizationSlug: session.organizationSlug,
      conversationId: session.conversationId,
    });

    return session.sessionId;
  }

  unregisterStreamSession(sessionId: string, reason: string = 'cleanup'): void {
    const session = this.streamSessionsById.get(sessionId);
    if (!session) {
      return;
    }

    if (session.streamId) {
      this.activeStreamSessionsByStreamId.delete(session.streamId);
    }
    this.activeStreamSessionsByConversation.delete(session.conversationKey);
    this.streamSessionsById.delete(session.sessionId);
    this.clearStreamCleanup(session);

    this.logger.debug('Unregistered stream session', {
      taskId: session.taskId,
      streamId: session.streamId,
      sessionId: session.sessionId,
      reason,
    });
  }

  private resolveStreamSession(filters: {
    streamId?: string;
    agentSlug: string;
    organizationSlug?: string | null;
    conversationId?: string | null;
  }): TaskStreamSession | undefined {
    if (filters.streamId) {
      const match = this.activeStreamSessionsByStreamId.get(filters.streamId);
      if (match) {
        return match;
      }
    }

    const conversationKey = this.buildConversationKey(
      filters.organizationSlug ?? 'global',
      filters.agentSlug,
      filters.conversationId ?? null,
    );

    return this.activeStreamSessionsByConversation.get(conversationKey);
  }

  private buildConversationKey(
    organizationSlug: string | null,
    agentSlug: string,
    conversationId: string | null,
  ): string {
    const normalizedOrg =
      organizationSlug && organizationSlug.trim().length > 0
        ? organizationSlug
        : 'global';
    const normalizedConversation =
      conversationId && conversationId.trim().length > 0
        ? conversationId
        : 'none';

    return `${normalizedOrg}::${agentSlug}::${normalizedConversation}`;
  }

  private touchStreamSession(session: TaskStreamSession): void {
    session.lastEventAt = Date.now();
    this.scheduleStreamCleanup(session);
  }

  private scheduleStreamCleanup(session: TaskStreamSession): void {
    this.clearStreamCleanup(session);

    const timer = setTimeout(() => {
      this.logger.debug('Stream session expired due to inactivity', {
        taskId: session.taskId,
        streamId: session.streamId,
        sessionId: session.sessionId,
      });
      this.unregisterStreamSession(session.sessionId, 'inactivity_timeout');
    }, this.streamInactivityMs);

    this.streamCleanupTimers.set(session.sessionId, timer);
  }

  private clearStreamCleanup(session: TaskStreamSession): void {
    const timer = this.streamCleanupTimers.get(session.sessionId);
    if (timer) {
      clearTimeout(timer);
      this.streamCleanupTimers.delete(session.sessionId);
    }
  }

  private pruneExpiredMessages(taskId: string): void {
    const messages = this.activeTaskMessages.get(taskId);
    if (!messages || messages.length === 0) {
      return;
    }

    const now = Date.now();
    const filtered = messages.filter(
      (message) => new Date(message.expiresAt).getTime() > now,
    );

    if (filtered.length === messages.length) {
      return;
    }

    this.activeTaskMessages.set(taskId, filtered);
  }

  private removeStreamSessionsForTask(taskId: string): void {
    const sessionIds = Array.from(this.streamSessionsById.values())
      .filter((session) => session.taskId === taskId)
      .map((session) => session.sessionId);

    for (const sessionId of sessionIds) {
      this.unregisterStreamSession(sessionId, 'task_cleanup');
    }
  }

  private extractProgress(
    metadata: Record<string, any> | undefined,
  ): number | undefined {
    if (!metadata) {
      return undefined;
    }

    const candidates: Array<unknown> = [
      metadata.progress,
      metadata.progressPercentage,
      metadata.percentage,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  @OnEvent('agent.stream.chunk')
  handleAgentStreamChunkEvent(event: AgentStreamChunkEvent): void {
    const session = this.resolveStreamSession({
      streamId: event.streamId,
      agentSlug: event.agentSlug,
      organizationSlug: event.organizationSlug ?? 'global',
      conversationId: event.conversationId ?? null,
    });

    if (!session) {
      this.logger.debug(
        `No active stream session found for chunk event ${event.streamId}`,
      );
      return;
    }

    this.touchStreamSession(session);

    const metadata = {
      streamId: event.streamId,
      conversationId: event.conversationId,
      orchestrationRunId: event.orchestrationRunId,
      organizationSlug: event.organizationSlug ?? null,
      agentSlug: event.agentSlug,
      mode: event.mode,
      chunkType: event.chunk.type,
      chunkMetadata: event.chunk.metadata ?? {},
      receivedAt: new Date().toISOString(),
    };

    const content =
      typeof event.chunk.content === 'string'
        ? event.chunk.content
        : JSON.stringify(event.chunk.content);

    this.addTaskMessage(session.taskId, content, 'progress', metadata);

    const progress = this.extractProgress(event.chunk.metadata);
    const currentStatus = this.activeTaskStatuses.get(session.taskId);

    const update: TaskStatusUpdate = {
      status: 'running',
    };

    if (progress !== undefined) {
      update.progress = progress;
    }

    if (content && content.trim().length > 0) {
      update.progressMessage = content;
    }

    if (!currentStatus || currentStatus.status !== 'completed') {
      this.updateTaskStatus(session.taskId, session.userId, update).catch(
        (error) => {
          this.logger.debug(
            `Failed to apply stream chunk status update for task ${session.taskId}`,
            error,
          );
        },
      );
    }
  }

  @OnEvent('agent.stream.complete')
  handleAgentStreamCompleteEvent(event: AgentStreamCompleteEvent): void {
    const session = this.resolveStreamSession({
      streamId: event.streamId,
      agentSlug: event.agentSlug,
      organizationSlug: event.organizationSlug ?? 'global',
      conversationId: event.conversationId ?? null,
    });

    if (!session) {
      return;
    }

    this.touchStreamSession(session);

    const metadata = {
      streamId: event.streamId,
      conversationId: event.conversationId,
      orchestrationRunId: event.orchestrationRunId,
      organizationSlug: event.organizationSlug ?? null,
      agentSlug: event.agentSlug,
      mode: event.mode,
      type: 'complete',
      receivedAt: new Date().toISOString(),
    };

    this.addTaskMessage(session.taskId, 'Stream completed', 'status', metadata);

    const currentStatus = this.activeTaskStatuses.get(session.taskId);
    if (!currentStatus || currentStatus.status !== 'completed') {
      this.updateTaskStatus(session.taskId, session.userId, {
        status: 'completed',
        progress: 100,
        progressMessage: 'Stream completed',
      }).catch((error) => {
        this.logger.debug(
          `Failed to apply stream completion status update for task ${session.taskId}`,
          error,
        );
      });
    }

    this.unregisterStreamSession(session.sessionId, 'complete_event');
  }

  @OnEvent('agent.stream.error')
  handleAgentStreamErrorEvent(event: AgentStreamErrorEvent): void {
    const session = this.resolveStreamSession({
      streamId: event.streamId,
      agentSlug: event.agentSlug,
      organizationSlug: event.organizationSlug ?? 'global',
      conversationId: event.conversationId ?? null,
    });

    if (!session) {
      return;
    }

    this.touchStreamSession(session);

    const errorMessage =
      typeof event.error === 'string'
        ? event.error
        : JSON.stringify(event.error);

    const metadata = {
      streamId: event.streamId,
      conversationId: event.conversationId,
      orchestrationRunId: event.orchestrationRunId,
      organizationSlug: event.organizationSlug ?? null,
      agentSlug: event.agentSlug,
      mode: event.mode,
      type: 'error',
      receivedAt: new Date().toISOString(),
    };

    this.addTaskMessage(session.taskId, errorMessage, 'error', metadata);

    const currentStatus = this.activeTaskStatuses.get(session.taskId);
    if (!currentStatus || currentStatus.status !== 'failed') {
      this.updateTaskStatus(session.taskId, session.userId, {
        status: 'failed',
        error: errorMessage,
      }).catch((error) => {
        this.logger.debug(
          `Failed to apply stream error status update for task ${session.taskId}`,
          error,
        );
      });
    }

    this.unregisterStreamSession(session.sessionId, 'error_event');
  }

  /**
   * Create a new task with initial status
   */
  async createTask(
    taskId: string,
    userId: string,
    taskType?: string,
    initialData: Partial<TaskStatus> = {},
  ): Promise<void> {
    // Default to ephemeral behavior if no task type specified
    const normalizedTaskType =
      taskType === 'long_running' || taskType === 'swarm'
        ? taskType
        : 'ephemeral';
    const taskStatus: TaskStatus = {
      taskId,
      userId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      taskType: normalizedTaskType, // Store normalized taskType for persistence decisions
      ...initialData,
    };

    // Store in hot cache
    this.activeTaskStatuses.set(taskId, taskStatus);

    // Persist to database for all task types (including ephemeral for evaluations)
    if (
      normalizedTaskType === 'long_running' ||
      normalizedTaskType === 'swarm' ||
      normalizedTaskType === 'ephemeral'
    ) {
      try {
        const { error } = await this.supabaseService
          .getAnonClient()
          .from('tasks')
          .update({
            status: taskStatus.status,
            progress: taskStatus.progress,
            progress_message: taskStatus.progressMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
        } else {
        }
      } catch (_error) {}
    }

    this.emitStatusChange(taskId, taskStatus);
  }

  /**
   * Update task status with flexible JSON data
   * This is the ONLY method that should update task status
   */
  async updateTaskStatus(
    taskId: string,
    userId: string,
    update: TaskStatusUpdate,
  ): Promise<void> {
    const currentStatus = this.activeTaskStatuses.get(taskId);
    if (!currentStatus) {
      return;
    }

    // Verify user ownership
    if (currentStatus.userId !== userId) {
      return;
    }

    // Merge the update with current status
    const newStatus: TaskStatus = {
      ...currentStatus,
      ...update,
      updatedAt: new Date(),
    };

    // Update hot cache
    this.activeTaskStatuses.set(taskId, newStatus);

    // Persist to database for all task types (including ephemeral for evaluations)
    if (
      currentStatus.taskType === 'long_running' ||
      currentStatus.taskType === 'swarm' ||
      currentStatus.taskType === 'ephemeral'
    ) {
      try {
        const updateData: any = {
          status: newStatus.status,
          progress: newStatus.progress,
          progress_message: newStatus.progressMessage,
          updated_at: new Date().toISOString(),
        };

        if (newStatus.result) {
          updateData.response =
            typeof newStatus.result === 'string'
              ? newStatus.result
              : JSON.stringify(newStatus.result);

          // Extract and store LLM metadata if present in the result
          if (
            typeof newStatus.result === 'object' &&
            newStatus.result.metadata
          ) {
            const resultMetadata = newStatus.result.metadata;

            // Store general metadata
            updateData.metadata = resultMetadata;

            // Extract and store LLM-specific metadata
            if (resultMetadata.llmUsed) {
              updateData.llm_metadata = resultMetadata.llmUsed;
            }

            // Store response metadata (for compatibility)
            updateData.response_metadata = resultMetadata;
          }
        }

        if (newStatus.error) {
          updateData.error_message = newStatus.error;
        }

        const { error } = await this.supabaseService
          .getAnonClient()
          .from('tasks')
          .update(updateData)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
        }
      } catch (_error) {}
    }

    // Emit status change event
    this.emitStatusChange(taskId, newStatus);

    // Handle task completion
    if (
      newStatus.status === 'completed' ||
      newStatus.status === 'failed' ||
      newStatus.status === 'cancelled'
    ) {
      this.handleTaskCompletion(taskId, newStatus);
    }
  }

  /**
   * Get current task status (for polling)
   * Only returns status if user owns the task
   */
  getTaskStatus(taskId: string, userId: string): TaskStatus | null {
    const status = this.activeTaskStatuses.get(taskId);
    if (!status || status.userId !== userId) {
      return null;
    }
    return { ...status }; // Return copy to prevent mutations
  }

  /**
   * Add a progress message to the live cache (for polling clients)
   */
  addTaskMessage(
    taskId: string,
    messageContent: string,
    messageType:
      | 'progress'
      | 'status'
      | 'info'
      | 'warning'
      | 'error' = 'progress',
    metadata?: Record<string, any>,
  ): void {
    if (!this.activeTaskMessages.has(taskId)) {
      this.activeTaskMessages.set(taskId, []);
    }

    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + this.messageTtlMs).toISOString();
    const messages = this.activeTaskMessages.get(taskId)!;
    const filtered = messages.filter(
      (message) => new Date(message.expiresAt).getTime() > now,
    );

    const normalizedMetadata =
      metadata !== undefined ? { ...metadata } : undefined;
    const progressPercentage =
      this.extractProgress(normalizedMetadata) ?? undefined;

    const newMessage = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 11)}`,
      taskId,
      content: messageContent,
      messageType,
      progressPercentage,
      metadata: normalizedMetadata,
      createdAt,
      expiresAt,
    };

    filtered.push(newMessage);
    this.activeTaskMessages.set(taskId, filtered);
  }

  /**
   * Get accumulated messages for a task (live cache first, for polling)
   */
  getTaskMessages(
    taskId: string,
    userId: string,
  ): Array<{
    id: string;
    taskId: string;
    content: string;
    messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
    progressPercentage?: number;
    metadata?: Record<string, any>;
    createdAt: string;
    expiresAt: string;
  }> {
    // Check if user owns this task
    const taskStatus = this.getTaskStatus(taskId, userId);
    if (!taskStatus) {
      return [];
    }

    // Return live messages from cache
    this.pruneExpiredMessages(taskId);
    const messages = this.activeTaskMessages.get(taskId) || [];

    return [...messages]; // Return copy to prevent mutations
  }

  /**
   * Get all active tasks for a user (for dashboard)
   */
  getUserActiveTasks(userId: string): TaskStatus[] {
    const userTasks: TaskStatus[] = [];
    for (const status of this.activeTaskStatuses.values()) {
      if (
        status.userId === userId &&
        status.status !== 'completed' &&
        status.status !== 'failed' &&
        status.status !== 'cancelled'
      ) {
        userTasks.push({ ...status });
      }
    }
    return userTasks;
  }

  /**
   * Mark task as completed (single authority)
   */
  async completeTask(
    taskId: string,
    userId: string,
    result: any,
  ): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'completed',
      progress: 100,
      result,
    });
  }

  /**
   * Mark task as failed (single authority)
   */
  async failTask(taskId: string, userId: string, error: string): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Update task progress (convenience method)
   */
  async updateProgress(
    taskId: string,
    userId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'running',
      progress,
      progressMessage: message,
    });
  }

  /**
   * Handle task completion and cleanup
   */
  private handleTaskCompletion(taskId: string, taskStatus: TaskStatus): void {
    // Clear any existing cleanup timer
    const existingTimer = this.cleanupTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set cleanup based on task type
    let cleanupDelayMs: number;

    switch (taskStatus.taskType) {
      case 'ephemeral':
        cleanupDelayMs = 60 * 1000; // 1 minute
        break;
      case 'long_running':
        cleanupDelayMs = 15 * 60 * 1000; // 15 minutes
        break;
      case 'swarm':
        cleanupDelayMs = 60 * 60 * 1000; // 1 hour
        break;
      default:
        cleanupDelayMs = 60 * 1000; // Default 1 minute
    }

    // Schedule cleanup
    const cleanupTimer = setTimeout(() => {
      this.cleanupTask(taskId);
    }, cleanupDelayMs);

    this.cleanupTimers.set(taskId, cleanupTimer);
  }

  /**
   * Remove task from active cache
   */
  private cleanupTask(taskId: string): void {
    this.removeStreamSessionsForTask(taskId);
    this.activeTaskStatuses.delete(taskId);
    this.activeTaskMessages.delete(taskId); // Clean up live messages too
    this.cleanupTimers.delete(taskId);
  }

  /**
   * Emit status change events for WebSocket broadcasting
   */
  private emitStatusChange(taskId: string, taskStatus: TaskStatus): void {
    // Emit generic task status change
    this.eventEmitter.emit('task.status_changed', {
      taskId,
      userId: taskStatus.userId,
      status: taskStatus.status,
      progress: taskStatus.progress,
      message: taskStatus.progressMessage,
      data: taskStatus,
    });

    // Emit specific lifecycle events
    switch (taskStatus.status) {
      case 'running':
        this.eventEmitter.emit('task.started', {
          taskId,
          userId: taskStatus.userId,
        });
        break;
      case 'completed':
        this.eventEmitter.emit('task.completed', {
          taskId,
          userId: taskStatus.userId,
          result: taskStatus.result,
        });
        break;
      case 'failed':
        this.eventEmitter.emit('task.failed', {
          taskId,
          userId: taskStatus.userId,
          error: taskStatus.error,
        });
        break;
      case 'cancelled':
        this.eventEmitter.emit('task.cancelled', {
          taskId,
          userId: taskStatus.userId,
        });
        break;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeTaskCount: number;
    userTaskCounts: Record<string, number>;
  } {
    const userTaskCounts: Record<string, number> = {};

    for (const status of this.activeTaskStatuses.values()) {
      userTaskCounts[status.userId] = (userTaskCounts[status.userId] || 0) + 1;
    }

    return {
      activeTaskCount: this.activeTaskStatuses.size,
      userTaskCounts,
    };
  }
}
