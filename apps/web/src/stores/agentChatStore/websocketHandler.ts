import websocketService from '@/services/websocketService';
import type { WorkflowStepEvent, ProgressUpdate } from './types';

/**
 * Service for handling WebSocket events and subscriptions for agent chat
 */
export class WebSocketHandlerService {
  
  /**
   * Subscribe to task events with completion and progress handlers
   */
  async subscribeToTaskEvents(
    conversationId: string, 
    taskId: string, 
    handlers: {
      onCompletion: (taskId: string) => void;
      onWorkflowStep: (stepEvent: WorkflowStepEvent) => void;
      onTaskStatus: (statusUpdate: ProgressUpdate) => void;
    }
  ): Promise<void> {
    console.log(`🔗 Setting up WebSocket subscriptions for task ${taskId} in conversation ${conversationId}`);

    // Subscribe to task progress and status updates
    await websocketService.subscribeToTask(taskId, (progressEvent) => {
      console.log(`📊 WebSocket progress event for task ${taskId}:`, progressEvent);
      
      handlers.onTaskStatus({
        taskId,
        status: progressEvent.status || 'running',
        progress: progressEvent.progress || 0,
        progressMessage: progressEvent.message,
        data: progressEvent.metadata
      });
    });

    // Handle flexible task status updates (from TaskStatusService)
    websocketService.onAllTaskEvents((statusEvent: any) => {
      if (statusEvent.taskId === taskId) {
        console.log(`📈 WebSocket status update for task ${taskId}:`, statusEvent);
        console.log(`📈 DEBUG: Status event type: ${statusEvent.event || statusEvent.type || 'unknown'}`);
        console.log(`📈 DEBUG: Status event status: ${statusEvent.status}`);
        
        // Don't process status updates after task completion
        if (statusEvent.status === 'completed' || statusEvent.status === 'failed') {
          console.log(`📈 DEBUG: Ignoring status update for completed/failed task ${taskId}`);
          return;
        }
        
        handlers.onTaskStatus({
          taskId: statusEvent.taskId,
          status: statusEvent.status,
          progress: statusEvent.progress,
          progressMessage: statusEvent.message,
          data: statusEvent.metadata
        });
      }
    });

    // Set up completion/failure event handlers
    websocketService.onTaskEvent('completed', (event) => {
      console.log(`🎯 WebSocket completion event received for task ${event.taskId}`, event);
      if (event.taskId === taskId) {
        console.log(`🎯 WebSocket completion event matches subscribed task ${taskId}, calling completion handler`);
        console.log(`🎯 DEBUG: About to call handlers.onCompletion for task ${taskId}`);
        handlers.onCompletion(taskId);
        console.log(`🎯 DEBUG: handlers.onCompletion called for task ${taskId}`);
      } else {
        console.log(`🎯 WebSocket completion event for different task ${event.taskId}, subscribed to ${taskId}`);
      }
    });

    websocketService.onTaskEvent('failed', (event) => {
      if (event.taskId === taskId) {
        handlers.onCompletion(taskId);
      }
    });

    // Legacy workflow step handlers (for backward compatibility)
    websocketService.onWorkflowStep(taskId, (stepEvent) => {
      handlers.onWorkflowStep(stepEvent);
    });

    console.log(`✅ WebSocket subscriptions established for task ${taskId}`);
  }

  /**
   * Process workflow step updates with accumulation
   */
  processWorkflowStepUpdate(
    message: any, 
    stepEvent: WorkflowStepEvent
  ): { contentUpdated: boolean; newContent?: string } {
    // Initialize completed steps tracker
    if (!message.metadata) {
      message.metadata = {};
    }
    if (!message.metadata.completedSteps) {
      message.metadata.completedSteps = [];
    }
    
    // Only process completed steps (not in_progress)
    if (stepEvent.status === 'completed') {
      const displayMessage = stepEvent.message || stepEvent.stepName;
      
      // Add this completed step to our tracker if not already there
      const stepData = {
        name: stepEvent.stepName,
        message: displayMessage,
        index: stepEvent.stepIndex,
        total: stepEvent.totalSteps
      };
      
      const existingStepIndex = message.metadata.completedSteps.findIndex(
        (step: any) => step.index === stepEvent.stepIndex
      );
      
      if (existingStepIndex === -1) {
        message.metadata.completedSteps.push(stepData);
      }
      
      // Sort steps by index to ensure correct order
      message.metadata.completedSteps.sort((a: any, b: any) => a.index - b.index);
      
      // Rebuild content from all completed steps
      let accumulatedContent = '';
      
      // Add all completed steps using their messages
      message.metadata.completedSteps.forEach((step: any) => {
        const stepMessage = `✅ ${step.message} (${step.index + 1}/${step.total})`;
        if (accumulatedContent === '') {
          accumulatedContent = stepMessage;
        } else {
          accumulatedContent += `\n${stepMessage}`;
        }
      });
      
      // If not the last step, show next step starting
      if (stepEvent.stepIndex < stepEvent.totalSteps - 1) {
        const nextStepMessage = `🔄 Step ${stepEvent.stepIndex + 2}/${stepEvent.totalSteps} starting...`;
        accumulatedContent += `\n${nextStepMessage}`;
      } else {
        // Last step completed, show final processing
        const finalProcessingMessage = `🔄 Processing final response...`;
        accumulatedContent += `\n${finalProcessingMessage}`;
      }
      
      // Keep the old workflow_steps_realtime for compatibility
      if (!message.metadata.workflow_steps_realtime) {
        message.metadata.workflow_steps_realtime = [];
      }
      
      const existingRealTimeStepIndex = message.metadata.workflow_steps_realtime.findIndex(
        (step: any) => step.stepName === stepEvent.stepName
      );
      
      const stepData2 = {
        ...stepEvent,
        timestamp: new Date().toISOString()
      };
      
      if (existingRealTimeStepIndex >= 0) {
        message.metadata.workflow_steps_realtime[existingRealTimeStepIndex] = stepData2;
      } else {
        message.metadata.workflow_steps_realtime.push(stepData2);
      }
      
      message.metadata.workflow_steps_realtime.sort((a: any, b: any) => a.stepIndex - b.stepIndex);
      message.metadata.processing_type = 'langgraph-multi-step-workflow';
      
      return { contentUpdated: true, newContent: accumulatedContent };
    }

    return { contentUpdated: false };
  }

  /**
   * Process task status updates with enhanced progress formatting
   */
  processTaskStatusUpdate(
    message: any,
    statusUpdate: ProgressUpdate
  ): { contentUpdated: boolean; newContent?: string } {
    let progressContent = message.content || 'Processing your request...';
    
    // Handle multi-step workflow progress
    if (statusUpdate.data?.workflow_steps_realtime) {
      const workflowSteps = statusUpdate.data.workflow_steps_realtime;
      let accumulatedContent = '';
      
      workflowSteps.forEach((step: any, index: number) => {
        const stepEmoji = step.status === 'completed' ? '✅' : 
                         step.status === 'failed' ? '❌' : '🔄';
        const stepMessage = `${stepEmoji} ${step.message || step.stepName} (${index + 1}/${workflowSteps.length})`;
        
        if (accumulatedContent === '') {
          accumulatedContent = stepMessage;
        } else {
          accumulatedContent += `\n${stepMessage}`;
        }
      });
      
      // Handle completion state
      const completedSteps = workflowSteps.filter((s: any) => s.status === 'completed');
      if (completedSteps.length > 0) {
        const stepIndex = completedSteps.length - 1;
        const totalSteps = workflowSteps.length;
        
        // Store completed steps in metadata
        if (!message.metadata.completedSteps) {
          message.metadata.completedSteps = [];
        }
        
        message.metadata.completedSteps.forEach((step: any) => {
          const stepMessage = `✅ ${step.message} (${step.index + 1}/${step.total})`;
          if (accumulatedContent === '') {
            accumulatedContent = stepMessage;
          } else {
            accumulatedContent += `\n${stepMessage}`;
          }
        });
        
        // If not the last step, show next step starting
        if (stepIndex < totalSteps - 1) {
          const nextStepMessage = `🔄 Step ${stepIndex + 2}/${totalSteps} starting...`;
          accumulatedContent += `\n${nextStepMessage}`;
        } else {
          // Last step completed, show final processing
          const finalProcessingMessage = `🔄 Processing final response...`;
          accumulatedContent += `\n${finalProcessingMessage}`;
        }
        
        progressContent = accumulatedContent;
      }
      
      // Update workflow steps in metadata
      message.metadata.workflow_steps_realtime = workflowSteps;
      message.metadata.processing_type = 'langgraph-multi-step-workflow';
    }
    
    // Update message metadata
    message.metadata = { 
      ...message.metadata, 
      ...statusUpdate.data,
      lastUpdated: new Date().toISOString()
    };
    
    return { contentUpdated: true, newContent: progressContent };
  }

  /**
   * Unsubscribe from task events and cleanup
   */
  unsubscribeFromTask(taskId: string): void {
    console.log(`🔌 Unsubscribing from WebSocket events for task ${taskId}`);
    websocketService.unsubscribeFromTask(taskId);
  }

  /**
   * Check WebSocket connection status
   */
  isConnected(): boolean {
    return websocketService.connected.value;
  }

  /**
   * Get connection state for debugging
   */
  getConnectionState(): {
    connected: boolean;
    connecting: boolean;
    error: string | null;
    subscribedTasksCount: number;
  } {
    return {
      connected: websocketService.connected.value,
      connecting: websocketService.connecting.value,
      error: websocketService.error.value,
      subscribedTasksCount: websocketService.subscribedTasks.size
    };
  }
}

// Export singleton instance
export const websocketHandler = new WebSocketHandlerService();