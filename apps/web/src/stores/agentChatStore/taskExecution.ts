import tasksService from '@/services/tasksService';
import { websocketHandler } from './websocketHandler';
import type { TaskExecutionOptions, ExecutionMode, AgentConversation } from './types';
/**
 * Service for handling task execution in different modes
 */
export class TaskExecutionService {
  /**
   * Create and execute agent task with appropriate execution mode
   */
  async createAndExecuteTask(
    options: TaskExecutionOptions,
    handlers: {
      onPlaceholder: (taskId: string) => void;
      onCompletion: (taskId: string) => void;
      onWorkflowStep: (conversationId: string, taskId: string, stepEvent: any) => void;
      onStatusUpdate: (conversationId: string, taskId: string, statusUpdate: any) => void;
      onImmediateResult: (conversationId: string, task: any) => void;
    }
  ): Promise<void> {
    const { executionMode, conversationId, taskId } = options;
    // For WebSocket mode, set up subscriptions BEFORE making the API call
    if (executionMode === 'websocket' && taskId) {
      await this.startWebSocketMode(conversationId, taskId, handlers);
    }
    // Create the task
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
        metadata: options.metadata, // Pass context metadata to backend
      }
    );
    // Handle response based on execution mode and task status
    await this.handleTaskExecution(task, executionMode, conversationId, handlers);
  }
  /**
   * Handle task execution based on mode and status
   */
  private async handleTaskExecution(
    task: any,
    executionMode: ExecutionMode,
    conversationId: string,
    handlers: any
  ): Promise<void> {
    if (task.status === 'pending' && executionMode === 'websocket') {
      // Task is async - create placeholder (already subscribed to WebSocket)
      handlers.onPlaceholder(task.taskId);
      // WebSocket subscriptions already set up before API call, no need to subscribe again
    } else if (task.status === 'pending' && executionMode === 'polling') {
      // Task is async - create placeholder and start polling
      handlers.onPlaceholder(task.taskId);
      await this.startPollingMode(conversationId, task.taskId, handlers);
    } else if (task.status === 'pending' && executionMode === 'immediate') {
      // Immediate mode - wait for task completion by polling once
      handlers.onPlaceholder(task.taskId);
      await this.handleImmediateMode(conversationId, task.taskId, handlers);
    } else {
      // Task completed immediately - use result from task creation response
      // For immediate mode, the response is in the result field
      let taskForProcessing: any = task;
      if (task.result && task.result.response && !(task as any).response) {
        taskForProcessing = {
          ...task,
          response: JSON.stringify(task.result)
        };
      }
      handlers.onImmediateResult(conversationId, taskForProcessing);
    }
  }
  /**
   * Handle WebSocket mode execution
   */
  private async startWebSocketMode(
    conversationId: string, 
    taskId: string, 
    handlers: any
  ): Promise<void> {
    await websocketHandler.subscribeToTaskEvents(conversationId, taskId, {
      onCompletion: handlers.onCompletion,
      onWorkflowStep: (stepEvent) => handlers.onWorkflowStep(conversationId, taskId, stepEvent),
      onTaskStatus: (statusUpdate) => handlers.onStatusUpdate(conversationId, taskId, statusUpdate)
    });
  }
  /**
   * Handle immediate mode execution with timeout
   */
  private async handleImmediateMode(
    conversationId: string, 
    taskId: string, 
    handlers: any
  ): Promise<void> {
    const maxAttempts = 30; // 30 seconds total
    let attempts = 0;
    const waitForCompletion = async () => {
      while (attempts < maxAttempts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          const updatedTask = await tasksService.getTask(taskId);
          if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
            handlers.onCompletion(taskId);
            return;
          }
          attempts++;
        } catch (error) {

          break;
        }
      }
      // Fallback to polling if immediate wait times out
      await this.startPollingMode(conversationId, taskId, handlers);
    };
    await waitForCompletion();
  }
  /**
   * Handle polling mode execution
   */
  private async startPollingMode(
    conversationId: string, 
    taskId: string, 
    handlers: any
  ): Promise<void> {
    const interval = 2000; // 2 second interval
    let lastMessageCount = 0;
    const pollInterval = setInterval(async () => {
      try {
        // Get full task for completion check
        const fullTask = await tasksService.getTask(taskId);
        if (fullTask.status === 'completed' || fullTask.status === 'failed') {
          clearInterval(pollInterval);
          handlers.onCompletion(taskId);
          return;
        }
        // Get task status for progress info
        const taskStatus = await tasksService.getTaskStatus(taskId);
        // Get accumulated messages for progress updates
        const messages = await tasksService.getTaskMessages(taskId);
        // Process new messages since last poll
        if (messages.length > lastMessageCount) {
          const newMessages = messages.slice(lastMessageCount);
          // Build accumulated progress content from all progress messages
          const progressMessages = messages.filter(msg => msg.messageType === 'progress');
          let progressContent = 'Processing your request...\n\n';
          progressMessages.forEach(msg => {
            // Parse message content to extract step information
            try {
              const messageData = JSON.parse(msg.content);
              if (messageData.stepName && messageData.message) {
                const stepEmoji = messageData.status === 'completed' ? '✅' : '🔄';
                progressContent += `${stepEmoji} ${messageData.message}\n`;
              }
            } catch {
              // If not JSON, treat as plain text
              progressContent += `🔄 ${msg.content}\n`;
            }
          });
          // Update the assistant message with accumulated progress
          handlers.onStatusUpdate(conversationId, taskId, {
            status: taskStatus.status,
            progress: taskStatus.progress,
            progressMessage: progressContent.trim(),
            data: { 
              messageCount: messages.length,
              lastUpdated: new Date().toISOString(),
              allMessages: messages 
            }
          });
          lastMessageCount = messages.length;
        }
      } catch (error) {

        clearInterval(pollInterval);
      }
    }, interval);
  }
  /**
   * Determine appropriate execution mode for agent and task
   */
  determineExecutionMode(
    conversation: AgentConversation, 
    userPreferences: any
  ): ExecutionMode {
    if (conversation.executionMode && conversation.isExecutionModeOverride) {
      return conversation.executionMode;
    } else {
      // Use preference-based mode selection
      let mode = userPreferences.defaultExecutionMode;
      // Check if agent supports the preferred mode, fall back to first supported mode if not
      const supportedModes = conversation.supportedExecutionModes;
      if (!supportedModes.includes(mode)) {
        mode = supportedModes[0]; // Use first supported mode as fallback
      }
      // Auto-switch to WebSocket for workflow agents if enabled and supported
      if (userPreferences.autoSwitchToWebSocketForWorkflows && 
          conversation.agent?.name === 'requirements_writer' &&
          supportedModes.includes('websocket')) {
        mode = 'websocket';
      }
      conversation.executionMode = mode;
      return mode;
    }
  }
  /**
   * Validate execution mode against agent capabilities
   */
  validateExecutionMode(
    mode: ExecutionMode, 
    supportedModes: ExecutionMode[]
  ): boolean {
    return supportedModes.includes(mode);
  }
  /**
   * Set execution mode for conversation with validation
   */
  setExecutionMode(
    conversation: AgentConversation, 
    mode: ExecutionMode
  ): boolean {
    // Check if the agent supports this mode
    if (!conversation.supportedExecutionModes.includes(mode)) {

      return false;
    }
    conversation.executionMode = mode;
    conversation.isExecutionModeOverride = true;
    return true;
  }
  /**
   * Reset execution mode override
   */
  resetExecutionModeOverride(conversation: AgentConversation): void {
    conversation.isExecutionModeOverride = false;
  }
  /**
   * Get execution mode display info
   */
  getExecutionModeInfo(mode: ExecutionMode): {
    label: string;
    description: string;
    icon: string;
  } {
    switch (mode) {
      case 'immediate':
        return {
          label: 'Immediate',
          description: 'Fast execution with immediate results',
          icon: 'flash'
        };
      case 'polling':
        return {
          label: 'Polling',
          description: 'Regular updates with progress tracking',
          icon: 'refresh'
        };
      case 'websocket':
        return {
          label: 'Real-time',
          description: 'Live updates via WebSocket connection',
          icon: 'wifi'
        };
      default:
        return {
          label: 'Unknown',
          description: 'Unknown execution mode',
          icon: 'help'
        };
    }
  }
}
// Export singleton instance
export const taskExecution = new TaskExecutionService();