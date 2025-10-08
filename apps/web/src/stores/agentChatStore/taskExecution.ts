import tasksService from '@/services/tasksService';
import { websocketHandler } from './websocketHandler';
import type { TaskExecutionOptions, ExecutionMode, AgentConversation } from './types';

// Agent task timeout configuration (in seconds)
const AGENT_TASK_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '120000', 10) / 1000;

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
      onPlaceholder: (taskId: string, mode?: string) => void;
      onCompletion: (taskId: string, immediateTask?: any) => void;
      onStatusUpdate: (conversationId: string, taskId: string, statusUpdate: any) => void;
      // onImmediateResult removed - all modes use consistent flow
    }
  ): Promise<void> {
    const { executionMode, conversationId, taskId } = options;
    
    // Create placeholder message FIRST so WebSocket events can find it
    if (taskId) {
      handlers.onPlaceholder(taskId, options.mode);
    }
    
    // For WebSocket mode, set up subscriptions AFTER placeholder exists
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
        timeoutSeconds: options.timeoutSeconds ?? (options.mode === 'build' ? AGENT_TASK_TIMEOUT_SECONDS : 60),
        // Pass mode in params for backend branching and deliverable gating
        params: {
          mode: options.mode || 'converse',
          quick: options.mode === 'converse' ? true : undefined,
          noDeliverable: options.mode === 'converse' ? true : undefined,
        },
        metadata: options.metadata, // Pass context metadata to backend
      }
    );

    // Check if the response indicates a PII policy block (successful response but blocked)
    if (task?.blocked && task?.reason === 'PII_POLICY_VIOLATION') {
      // Handle PII policy violation by calling the status update handler
      const piiViolationUpdate = {
        status: 'failed',
        error: task.message || 'Request blocked due to sensitive information detected',
        metadata: {
          type: 'pii_violation',
          blocked: true,
          detectedTypes: task.details?.detectedTypes || [],
          suggestion: task.details?.suggestion || 'Please remove any SSNs, credit card numbers, API keys, or other sensitive data and try again.'
        }
      };
      
      handlers.onStatusUpdate(conversationId, task.taskId || options.taskId, piiViolationUpdate);
      return; // Exit early, no need to continue processing
    }

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
    // In proper A2A architecture, the backend async call should wait for completion
    // All execution modes should return completed tasks, not pending
    if (task.status === 'pending') {
      console.error(`Backend returned pending status for task ${task.taskId} in ${executionMode} mode - async call should have waited`);
      throw new Error(`Backend error: ${executionMode} mode returned pending status for task ${task.taskId} - async call should have waited`);
    }
    
    handlers.onCompletion(task.taskId, task);
  }

  /**
   * Handle WebSocket mode execution
   */
  private async startWebSocketMode(
    conversationId: string, 
    taskId: string, 
    handlers: any
  ): Promise<void> {
    try {
      await websocketHandler.subscribeToTaskEvents(conversationId, taskId, {
        onCompletion: (completedTaskId) => {
          // Ignore WebSocket completion - completion comes from the async call
        },
        onWorkflowStep: (stepEvent) => {
          // Directly update message metadata in store for reactive UI
          websocketHandler.updateMessageWorkflowStep(conversationId, taskId, stepEvent);
        },
        onTaskStatus: (statusUpdate) => {
          handlers.onStatusUpdate(conversationId, taskId, statusUpdate);
        }
      });
    } catch (error) {
    }
  }

  // handleImmediateMode removed - A2A architecture means all modes await completion

  // startPollingMode removed - A2A architecture means all modes await completion, no polling needed
  private async startPollingMode_REMOVED(
    conversationId: string, 
    taskId: string, 
    handlers: any
  ): Promise<void> {
    const interval = 2000; // 2 second interval
    let lastMessageCount = 0;
    let pollCount = 0;
    const maxPolls = 300; // Maximum 5 minutes of polling (300 * 2s = 600s)
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        
        // Safety timeout - stop polling after maxPolls attempts
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          handlers.onCompletion(taskId);
          return;
        }
        
        // Get full task for completion check
        const fullTask = await tasksService.getTask(taskId);
        
        if (fullTask.status === 'completed' || fullTask.status === 'failed' || fullTask.status === 'cancelled') {
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
        console.error(`❌ Polling error for task ${taskId}:`, error);
        clearInterval(pollInterval);
        handlers.onCompletion(taskId); // Call completion handler even on error to clean up
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
