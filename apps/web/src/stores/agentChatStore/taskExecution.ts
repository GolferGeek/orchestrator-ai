import tasksService from '@/services/tasksService';
import type { TaskExecutionOptions, ExecutionMode, AgentConversation } from './types';

// Agent task timeout configuration (in seconds)
const AGENT_TASK_TIMEOUT_SECONDS = parseInt(
  import.meta.env.VITE_API_TIMEOUT_MS || '120000',
  10,
) / 1000;

/**
 * Service for handling task execution in different modes. With SSE streaming in place,
 * we rely on the backend to return completed tasks (or rich metadata) rather than
 * maintaining a client-side socket connection.
 */
export class TaskExecutionService {
  async createAndExecuteTask(
    options: TaskExecutionOptions,
    handlers: {
      onPlaceholder: (taskId: string, mode?: string) => void;
      onCompletion: (taskId: string, immediateTask?: any) => void;
    },
  ): Promise<void> {
    const { conversationId, taskId } = options;

    if (taskId) {
      handlers.onPlaceholder(taskId, options.mode);
    }

    const mode = options.mode || 'converse';
    const params: Record<string, any> = {
      mode,
    };

    if (mode === 'plan') {
      params.payload = { action: 'create' };
    } else if (mode === 'build') {
      params.payload = { action: 'create' };
    } else {
      params.payload = {};
    }

    const task = await tasksService.createAgentTask(
      options.agentType,
      options.agentName,
      {
        method: options.method,
        prompt: options.prompt,
        conversationId: options.conversationId,
        conversationHistory: options.conversationHistory,
        llmSelection: options.llmSelection,
        executionMode: options.executionMode,
        taskId: options.taskId,
        timeoutSeconds:
          options.timeoutSeconds ??
          (options.mode === 'build' ? AGENT_TASK_TIMEOUT_SECONDS : 60),
        params,
        metadata: options.metadata,
      },
      { namespace: options.agentNamespace ?? null },
    );

    const resolvedTaskId =
      (task && (task as any).taskId) || (task && (task as any).id) || options.taskId;
    if (!resolvedTaskId) {
      throw new Error('Task creation response missing taskId; cannot proceed with completion handling');
    }
    (task as any).taskId = resolvedTaskId;

    if (task?.blocked && task?.reason === 'PII_POLICY_VIOLATION') {
      handlers.onCompletion(task.taskId, task);
      return;
    }

    await this.handleTaskExecution(task, options.executionMode, conversationId, handlers);
  }

  private async handleTaskExecution(
    task: any,
    executionMode: ExecutionMode,
    conversationId: string,
    handlers: any,
  ): Promise<void> {
    if (task.status === 'pending') {
      console.error(
        `Backend returned pending status for task ${task.taskId} in ${executionMode} mode - async call should have waited`,
      );
      throw new Error(
        `Backend error: ${executionMode} mode returned pending status for task ${task.taskId} - async call should have waited`,
      );
    }

    handlers.onCompletion(task.taskId, task);
  }

  determineExecutionMode(
    conversation: AgentConversation,
    userPreferences: any,
  ): ExecutionMode {
    if (conversation.executionMode && conversation.isExecutionModeOverride) {
      return conversation.executionMode;
    }

    let mode: ExecutionMode = userPreferences.defaultExecutionMode;
    const supported = conversation.supportedExecutionModes;
    if (!supported.includes(mode)) {
      mode = supported[0];
    }

    if (
      userPreferences.autoSwitchToWebSocketForWorkflows &&
      conversation.agent?.name === 'requirements_writer' &&
      supported.includes('websocket')
    ) {
      mode = 'websocket';
    }

    conversation.executionMode = mode;
    return mode;
  }

  validateExecutionMode(mode: ExecutionMode, supportedModes: ExecutionMode[]): boolean {
    return supportedModes.includes(mode);
  }

  setExecutionMode(conversation: AgentConversation, mode: ExecutionMode): boolean {
    if (!conversation.supportedExecutionModes.includes(mode)) {
      return false;
    }

    conversation.executionMode = mode;
    conversation.isExecutionModeOverride = true;
    return true;
  }

  resetExecutionModeOverride(conversation: AgentConversation): void {
    conversation.isExecutionModeOverride = false;
  }

  getExecutionModeInfo(mode: ExecutionMode): {
    label: string;
    description: string;
    icon: string;
  } {
    switch (mode) {
      case 'immediate':
        return { label: 'Immediate', description: 'Fast execution with immediate results', icon: 'flash' };
      case 'polling':
        return { label: 'Polling', description: 'Periodic updates with manual refresh', icon: 'refresh' };
      case 'websocket':
        return {
          label: 'Streaming',
          description: 'Live updates via SSE stream',
          icon: 'wifi',
        };
      default:
        return { label: 'Unknown', description: 'Unknown execution mode', icon: 'help' };
    }
  }
}

export const taskExecution = new TaskExecutionService();
