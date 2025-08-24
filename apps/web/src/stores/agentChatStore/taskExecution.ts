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
    
    console.log(`🎯 Creating agent task with execution mode: ${executionMode}`);
    
    // For WebSocket mode, set up subscriptions BEFORE making the API call
    if (executionMode === 'websocket' && taskId) {
      console.log(`🔗 Setting up WebSocket subscriptions early for task ${taskId}`);
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

    console.log(`📋 Task created:`, {
      taskId: task.taskId,
      status: task.status,
      conversationId: task.conversationId,
      executionMode
    });

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
      console.log(`📊 Task ${task.taskId} is pending, starting polling mode`);
      handlers.onPlaceholder(task.taskId);
      await this.startPollingMode(conversationId, task.taskId, handlers);
      
    } else if (task.status === 'pending' && executionMode === 'immediate') {
      // Immediate mode - wait for task completion by polling once
      console.log(`⚡ Task ${task.taskId} is pending in immediate mode, waiting for completion`);
      handlers.onPlaceholder(task.taskId);
      await this.handleImmediateMode(conversationId, task.taskId, handlers);
      
    } else {
      // Task completed immediately - use result from task creation response
      console.log(`✅ Task ${task.taskId} completed immediately, processing result`);
      
      // For immediate mode, the response is in the result field
      let taskForProcessing: any = task;
      if (task.result && task.result.response && !(task as any).response) {
        console.log(`🔄 Converting result.response to response format for immediate mode`);
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
    console.log(`🔗 Starting WebSocket mode for task ${taskId} in conversation ${conversationId}`);
    
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
            console.log(`⚡ Task ${taskId} completed in immediate mode`);
            handlers.onCompletion(taskId);
            return;
          }
          attempts++;
        } catch (error) {
          console.error(`⚡ Error waiting for task ${taskId}:`, error);
          break;
        }
      }
      
      // Fallback to polling if immediate wait times out
      console.log(`⚡ Task ${taskId} immediate mode timed out, falling back to polling`);
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
    console.log(`🔄 Starting polling for task ${taskId} in conversation ${conversationId}`);
    console.log(`🚨 POLLING FIX LOADED: Enhanced polling with safety timeout and cancelled status check`);
    
    const interval = 2000; // 2 second interval
    console.log(`🔄 Polling interval: ${interval}ms`);
    let lastMessageCount = 0;
    let pollCount = 0;
    const maxPolls = 300; // Maximum 5 minutes of polling (300 * 2s = 600s)
    console.log(`🔄 Max polls before timeout: ${maxPolls}`);
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        
        // Safety timeout - stop polling after maxPolls attempts
        if (pollCount > maxPolls) {
          console.warn(`⚠️ Task ${taskId} polling timeout after ${maxPolls} attempts, stopping polling`);
          clearInterval(pollInterval);
          handlers.onCompletion(taskId);
          return;
        }
        
        // Get full task for completion check
        const fullTask = await tasksService.getTask(taskId);
        console.log(`🔍 Task ${taskId} status check (${pollCount}/${maxPolls}):`, {
          status: fullTask.status,
          hasResponse: !!fullTask.response,
          responseLength: fullTask.response?.length || 0,
          timestamp: new Date().toISOString()
        });
        
        // Enhanced status check with detailed logging
        console.log(`🚨 STATUS CHECK: Task ${taskId} status is "${fullTask.status}"`);
        console.log(`🚨 STATUS CHECK: Checking if "${fullTask.status}" matches completion conditions...`);
        
        if (fullTask.status === 'completed' || fullTask.status === 'failed' || fullTask.status === 'cancelled') {
          console.log(`🏁 ✅ STOPPING POLLING: Task ${taskId} completed with status: ${fullTask.status}`);
          clearInterval(pollInterval);
          handlers.onCompletion(taskId);
          return;
        } else {
          console.log(`🔄 ⏳ CONTINUING POLLING: Task ${taskId} status "${fullTask.status}" not in completion states [completed, failed, cancelled]`);
        }
        
        // Get task status for progress info
        const taskStatus = await tasksService.getTaskStatus(taskId);

        // Get accumulated messages for progress updates
        const messages = await tasksService.getTaskMessages(taskId);
        console.log(`📊 Polling task ${taskId}: ${messages.length} total messages (${lastMessageCount} seen before)`);
        
        // Process new messages since last poll
        if (messages.length > lastMessageCount) {
          const newMessages = messages.slice(lastMessageCount);
          console.log(`📨 Found ${newMessages.length} new messages for task ${taskId}`);
          
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
      console.log(`👤 User has overridden execution mode to: ${conversation.executionMode}`);
      return conversation.executionMode;
    } else {
      // Use preference-based mode selection
      let mode = userPreferences.defaultExecutionMode;
      console.log(`⚙️ Default execution mode from preferences: ${mode}`);
      
      // Check if agent supports the preferred mode, fall back to first supported mode if not
      const supportedModes = conversation.supportedExecutionModes;
      if (!supportedModes.includes(mode)) {
        mode = supportedModes[0]; // Use first supported mode as fallback
        console.log(`🔄 Agent doesn't support ${userPreferences.defaultExecutionMode}, falling back to: ${mode}`);
      }
      
      // Auto-switch to WebSocket for workflow agents if enabled and supported
      if (userPreferences.autoSwitchToWebSocketForWorkflows && 
          conversation.agent?.name === 'requirements_writer' &&
          supportedModes.includes('websocket')) {
        mode = 'websocket';
        console.log(`🔧 Auto-switched to WebSocket for workflow agent: ${conversation.agent?.name}`);
      }
      
      conversation.executionMode = mode;
      console.log(`✅ Final execution mode set to: ${mode} (supported: ${supportedModes.join(', ')})`);
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
      console.warn(`⚠️ Agent ${conversation.agent?.name} doesn't support ${mode} mode. Supported: ${conversation.supportedExecutionModes.join(', ')}`);
      return false;
    }
    
    conversation.executionMode = mode;
    conversation.isExecutionModeOverride = true;
    console.log(`👤 User manually set execution mode to: ${mode}`);
    return true;
  }

  /**
   * Reset execution mode override
   */
  resetExecutionModeOverride(conversation: AgentConversation): void {
    conversation.isExecutionModeOverride = false;
    console.log(`🔄 Reset execution mode override for agent: ${conversation.agent?.name}`);
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