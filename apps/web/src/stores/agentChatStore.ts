import { defineStore } from 'pinia';
import { agentConversationsService, type AgentType } from '@/services/agentConversationsService';
import { tasksService } from '@/services/tasksService';
import { useLLMStore } from '@/stores/llmStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { websocketService } from '@/services/websocketService';

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface AgentChatState {
  // Current agent being chatted with
  currentAgent: {
    name: string;
    type: AgentType;
    description?: string;
  } | null;
  
  // Current conversation ID (null until first message sent)
  currentConversationId: string | null;
  
  // Chat messages for current conversation
  messages: AgentChatMessage[];
  
  // UI state
  isLoading: boolean;
  isSendingMessage: boolean;
  error: string | null;
  
  // Task execution mode state
  currentExecutionMode: 'immediate' | 'polling' | 'websocket' | null;
  isExecutionModeOverride: boolean; // true when user manually selected mode for this session
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
}

export const useAgentChatStore = defineStore('agentChat', {
  state: (): AgentChatState => ({
    currentAgent: null,
    currentConversationId: null,
    messages: [],
    isLoading: false,
    isSendingMessage: false,
    error: null,
    currentExecutionMode: null,
    isExecutionModeOverride: false,
  }),

  actions: {
    /**
     * Start a new chat session with an agent
     * This doesn't create a conversation yet - that happens on first message
     */
    startChatWithAgent(agent: { name: string; type: 'specialist' | 'orchestrator' | 'external' | 'api'; description?: string }) {
      
      this.currentAgent = agent;
      this.currentConversationId = null;
      this.messages = [];
      this.error = null;
      
      // Add welcome message
      this.messages.push({
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hello! I'm ${agent.name}. How can I help you today?`,
        timestamp: new Date(),
        metadata: { isWelcome: true }
      });

      // Initialize execution mode based on preferences
      this.initializeExecutionMode();
    },

    /**
     * Initialize execution mode based on user preferences and agent type
     */
    initializeExecutionMode() {
      const preferencesStore = useUserPreferencesStore();
      const prefs = preferencesStore.preferences;
      
      // If user hasn't manually overridden, use preferences logic
      if (!this.isExecutionModeOverride) {
        let mode = prefs.defaultExecutionMode;
        
        // Auto-switch to WebSocket for workflow agents if enabled
        if (prefs.autoSwitchToWebSocketForWorkflows && 
            this.currentAgent?.name === 'requirements_writer') {
          mode = 'websocket';
        }
        
        this.currentExecutionMode = mode;
      }
    },

    /**
     * Manually set execution mode (user override)
     */
    setExecutionMode(mode: 'immediate' | 'polling' | 'websocket') {
      this.currentExecutionMode = mode;
      this.isExecutionModeOverride = true;
    },

    /**
     * Reset execution mode to preferences default
     */
    resetExecutionMode() {
      this.isExecutionModeOverride = false;
      this.initializeExecutionMode();
    },

    /**
     * Get effective execution mode for display
     */
    getEffectiveExecutionMode(): 'immediate' | 'polling' | 'websocket' {
      return this.currentExecutionMode || 'websocket'; // fallback to websocket
    },

    /**
     * Send a message to the current agent
     * Creates conversation lazily on first message
     */
    async sendMessage(content: string) {
      if (!this.currentAgent) {
        throw new Error('No agent selected');
      }

      this.isSendingMessage = true;
      this.error = null;

      try {
        // Add user message immediately
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        this.messages.push(userMessage);

        // Check execution mode preference
        const effectiveMode = this.getEffectiveExecutionMode();
        
        // For WebSocket mode, generate task ID early and subscribe before sending request
        let preGeneratedTaskId: string | undefined;
        if (effectiveMode === 'websocket') {
          preGeneratedTaskId = generateUUID();
          // Subscribe to WebSocket immediately to catch all events
          await this.subscribeToTask(preGeneratedTaskId);
        }
        
        // Create task request with trimmed conversation history to prevent payload too large errors
        const relevantMessages = this.messages
          .filter(msg => !msg.metadata?.isPlaceholder)
          .slice(-20); // Keep only last 20 messages to prevent payload size issues
        
        const conversationHistory = relevantMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          taskId: msg.taskId,
          metadata: msg.metadata
        }));

        // Get LLM preferences
        const llmStore = useLLMStore();
        const llmSelection = llmStore.currentLLMSelection;

        // Get agent type from current agent
        const agentType = this.currentAgent.type;
        
        // Simplified task creation - let backend handle complexity
        console.log('🚀 Sending task creation request with execution mode:', effectiveMode);
        console.log('🚀 Pre-generated task ID:', preGeneratedTaskId);
        console.log('🚀 Agent type:', agentType);
        console.log('🚀 Agent name:', this.currentAgent.name);
        console.log('🚀 Request payload:', {
          method: 'process',
          prompt: content,
          conversationId: this.currentConversationId || undefined,
          conversationHistory,
          llmSelection,
          executionMode: effectiveMode,
          taskId: preGeneratedTaskId,
        });
        
        console.log('🔥 About to call tasksService.createAgentTask...');
        
        const task = await tasksService.createAgentTask(
          agentType,
          this.currentAgent.name,
          {
            method: 'process',
            prompt: content,
            conversationId: this.currentConversationId || undefined,
            conversationHistory,
            llmSelection,
            executionMode: effectiveMode, // Pass execution mode to backend
            taskId: preGeneratedTaskId, // Pass pre-generated task ID for early WebSocket subscription
          }
        );
        
        console.log('✅ Task creation response:', task);

        // Store conversation ID
        if (task.conversationId) {
          this.currentConversationId = task.conversationId;
        }

        // Handle response based on execution mode and task status
        if (task.status === 'pending' && effectiveMode === 'websocket') {
          // Task is async - create placeholder (already subscribed to WebSocket)
          this.createPlaceholderMessage(task.taskId);
        } else if (task.status === 'pending' && effectiveMode === 'polling') {
          // Task is async - create placeholder and start polling
          this.createPlaceholderMessage(task.taskId);
          this.startPollingTask(task.taskId);
        } else {
          // Task completed immediately or immediate mode - create response message
          this.createResponseMessage(task);
        }

      } catch (error) {
        console.error('❌ Error in sendMessage:', error);
        this.error = error instanceof Error ? error.message : 'Failed to send message';
      } finally {
        this.isSendingMessage = false;
      }
    },

    /**
     * Create placeholder message for async tasks
     */
    createPlaceholderMessage(taskId: string) {
      const placeholderMessage: AgentChatMessage = {
        id: `task-${taskId}`,
        role: 'assistant',
        content: 'Processing your request...',
        timestamp: new Date(),
        taskId,
        metadata: {
          isPlaceholder: true,
          agentName: this.currentAgent?.name
        }
      };
      this.messages.push(placeholderMessage);
    },

    /**
     * Create response message from completed task
     */
    createResponseMessage(task: any) {
      let responseContent = 'Task completed successfully.';
      let responseMetadata = {};
      
      if (task.result) {
        try {
          const parsedResult = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
          if (parsedResult.success && parsedResult.response) {
            responseContent = String(parsedResult.response);
            responseMetadata = parsedResult.metadata || {};
          } else {
            responseContent = String(task.result);
          }
        } catch (error) {
          responseContent = String(task.result);
        }
      }

      const responseMessage: AgentChatMessage = {
        id: `assistant-${task.taskId}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        taskId: task.taskId,
        metadata: responseMetadata
      };
      this.messages.push(responseMessage);
    },

    /**
     * Simplified WebSocket subscription for a task
     */
    async subscribeToTask(taskId: string) {
      console.log('🚀 AgentChatStore: Starting WebSocket subscription for task:', taskId);
      
      // Subscribe to task with status change callback for new TaskStatusService events
      await websocketService.subscribeToTask(taskId, (statusEvent) => {
        console.log('📊 Received status event for task:', taskId, statusEvent);
        this.handleTaskStatusUpdate(taskId, {
          status: statusEvent.status,
          progress: statusEvent.progress,
          progressMessage: statusEvent.message,
          data: statusEvent.metadata
        });
      });

      // Set up completion/failure event handlers
      websocketService.onTaskEvent('completed', (event) => {
        console.log('🎉 WebSocket task completion event received:', event);
        if (event.taskId === taskId) {
          console.log('🎯 Task ID matches, calling handleTaskCompletion for:', taskId);
          this.handleTaskCompletion(taskId);
        } else {
          console.log('⚠️ Task ID mismatch - expected:', taskId, 'received:', event.taskId);
        }
      });

      websocketService.onTaskEvent('failed', (event) => {
        if (event.taskId === taskId) {
          this.handleTaskCompletion(taskId);
        }
      });

      // Legacy workflow step handlers (for backward compatibility)
      websocketService.onWorkflowStep(taskId, (stepEvent) => {
        this.handleWorkflowStepUpdate(taskId, stepEvent);
      });
    },

    /**
     * Start polling for task updates
     */
    async startPollingTask(taskId: string) {
      const userPreferences = useUserPreferencesStore();
      const interval = userPreferences.preferences.pollingInterval * 1000;
      
      const pollInterval = setInterval(async () => {
        try {
          // Use getTask to check status since we have full task data
          const task = await tasksService.getTask(taskId);
          
          if (task.status === 'completed' || task.status === 'failed') {
            clearInterval(pollInterval);
            this.handleTaskCompletion(taskId);
          } else {
            // Handle progress updates
            this.handleTaskStatusUpdate(taskId, {
              status: task.status,
              progress: task.progress,
              progressMessage: task.progressMessage,
              data: task.metadata
            });
          }
        } catch (error) {
          console.error('Polling error:', error);
          clearInterval(pollInterval);
        }
      }, interval);
    },

    /**
     * Handle task status updates from WebSocket or polling
     */
    handleTaskStatusUpdate(taskId: string, statusUpdate: any) {
      const messageIndex = this.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = this.messages[messageIndex];
        
        // Update placeholder message with progress
        if (message.metadata?.isPlaceholder) {
          let progressContent = 'Processing your request...';
          
          if (statusUpdate.progressMessage) {
            progressContent = statusUpdate.progressMessage;
          } else if (statusUpdate.progress !== undefined) {
            progressContent = `Processing... ${statusUpdate.progress}%`;
          }
          
          // Handle workflow steps from TaskStatusService JSON data
          if (statusUpdate.data?.workflowSteps) {
            const workflowSteps = statusUpdate.data.workflowSteps;
            const currentStep = statusUpdate.data.currentStep;
            const stepIndex = statusUpdate.data.stepIndex;
            const totalSteps = statusUpdate.data.totalSteps;
            
            console.log(`📊 Processing step update: ${currentStep} (${stepIndex + 1}/${totalSteps})`);
            console.log(`📊 Status update progressMessage:`, statusUpdate.progressMessage);
            
            // Initialize or get completed steps tracker
            if (!message.metadata.completedSteps) {
              message.metadata.completedSteps = [];
            }
            
            if (currentStep && stepIndex !== undefined && totalSteps) {
              // Use the progressMessage if available, otherwise fall back to step name
              const displayMessage = statusUpdate.progressMessage || currentStep;
              
              // Add this completed step to our tracker if not already there
              const stepData = {
                name: currentStep,
                message: displayMessage,
                index: stepIndex,
                total: totalSteps
              };
              
              const existingStepIndex = message.metadata.completedSteps.findIndex(
                step => step.index === stepIndex
              );
              
              if (existingStepIndex === -1) {
                message.metadata.completedSteps.push(stepData);
                console.log(`✅ Added new step: ${currentStep} with message: ${displayMessage}`);
              }
              
              // Sort steps by index to ensure correct order
              message.metadata.completedSteps.sort((a, b) => a.index - b.index);
              
              // Rebuild content from all completed steps
              let accumulatedContent = '';
              
              // Add all completed steps using their messages
              message.metadata.completedSteps.forEach(step => {
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
              console.log(`📝 Updated content:`, progressContent);
              console.log(`📊 Current completedSteps array:`, message.metadata.completedSteps);
              console.log(`📊 Total steps stored: ${message.metadata.completedSteps.length}/${totalSteps}`);
            }
            
            // Update workflow steps in metadata
            message.metadata.workflow_steps_realtime = workflowSteps;
            message.metadata.processing_type = 'langgraph-multi-step-workflow';
          }
          
          message.content = progressContent;
          message.metadata = { 
            ...message.metadata, 
            ...statusUpdate.data,
            lastUpdated: new Date().toISOString()
          };
          
          // Trigger reactivity
          this.messages[messageIndex] = { ...message };
        }
      }
    },

    /**
     * Load existing conversation
     */
    async loadConversation(conversationId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        // Load conversation details
        const conversation = await agentConversationsService.getConversation(conversationId);
        
        this.currentAgent = {
          name: conversation.agentName,
          type: conversation.agentType,
        };
        this.currentConversationId = conversationId;

        // Load tasks/messages for this conversation
        const tasks = await tasksService.listTasks({
          conversationId,
          limit: 100,
        });

        // Convert tasks to messages
        this.messages = [];
        tasks.tasks.forEach(task => {
          // Add user message
          this.messages.push({
            id: `user-${task.id}`,
            role: 'user',
            content: task.prompt,
            timestamp: new Date(task.createdAt),
            taskId: task.id,
          });

          // Add assistant message if task has response
          if (task.response) {
            // Parse agent response to extract markdown content
            let responseContent = task.response;
            let responseMetadata = task.responseMetadata || {};
            
            try {
              // A2A protocol agents return JSON with { success, response, metadata }
              const parsedResponse = typeof task.response === 'string' ? JSON.parse(task.response) : task.response;
              if (parsedResponse.success && parsedResponse.response) {
                responseContent = String(parsedResponse.response); // Ensure it's a string
                responseMetadata = { ...responseMetadata, ...parsedResponse.metadata };
              }
            } catch (error) {
              // If parsing fails, use the raw response
              responseContent = String(task.response);
            }

            this.messages.push({
              id: `assistant-${task.id}`,
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(task.completedAt || task.updatedAt),
              taskId: task.id,
              metadata: responseMetadata,
            });
          }
        });

        // Sort messages by timestamp
        this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load conversation';
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Clear current chat session
     */
    clearChat() {
      this.currentAgent = null;
      this.currentConversationId = null;
      this.messages = [];
      this.error = null;
    },

    /**
     * Set error state
     */
    setError(error: string | null) {
      this.error = error;
    },


    /**
     * Handle task completion - simplified version
     */
    async handleTaskCompletion(taskId: string) {
      console.log('🚀 handleTaskCompletion called for task:', taskId);
      try {
        // Get the completed task with full response
        console.log('📡 Fetching task data from backend...');
        const completedTask = await tasksService.getTask(taskId);
        console.log('📦 Received task data:', completedTask);
        
        // Skip processing if task is not actually completed or has no response yet
        if (completedTask.status !== 'completed') {
          console.log('⏳ Task not yet completed, skipping processing. Status:', completedTask.status);
          return;
        }
        
        if (!completedTask.response || completedTask.response === 'null' || completedTask.response.trim() === '') {
          console.log('⏳ Task completed but no response data yet, skipping processing. Response:', completedTask.response);
          return;
        }
        
        // Find and replace placeholder message
        const placeholderIndex = this.messages.findIndex(msg => 
          msg.taskId === taskId && msg.metadata?.isPlaceholder
        );
        
        if (placeholderIndex >= 0) {
          // Update the existing placeholder message with final result instead of replacing
          const placeholderMessage = this.messages[placeholderIndex];
          
          // Debug final state of accumulated steps
          console.log('📊 FINAL STATE - Completed steps in message metadata:');
          console.log('📊 completedSteps array:', placeholderMessage.metadata?.completedSteps);
          console.log('📊 Current message content:', placeholderMessage.content);
          
          // Extract the final deliverable - the actual requirements document
          console.log('🔍 Task completion - full task object:', completedTask);
          console.log('🔍 Task completion - raw result:', completedTask.result);
          console.log('🔍 Task completion - response field:', completedTask.response);
          
          let finalContent = '';
          
          // Try multiple fields where the content might be stored
          if (completedTask.response && completedTask.response !== 'null' && completedTask.response.trim() !== '') {
            // First try the response field directly - this might be the parsed Python JSON response
            try {
              const parsedResponse = typeof completedTask.response === 'string' ? JSON.parse(completedTask.response) : completedTask.response;
              console.log('🔍 Parsed response object:', parsedResponse);
              
              if (parsedResponse.response) {
                // This is the actual requirements document content from Python script
                finalContent = String(parsedResponse.response);
                console.log('🔍 Found document content in response.response:', finalContent.substring(0, 200) + '...');
              } else {
                finalContent = String(completedTask.response);
                console.log('🔍 Using raw response field:', finalContent);
              }
            } catch (error) {
              // If response isn't JSON, use it directly
              finalContent = String(completedTask.response);
              console.log('🔍 Using response field as-is (not JSON):', finalContent);
            }
          } else if (completedTask.result) {
            try {
              const parsedResult = typeof completedTask.result === 'string' ? JSON.parse(completedTask.result) : completedTask.result;
              console.log('🔍 Parsed result:', parsedResult);
              
              if (parsedResult.success && parsedResult.response) {
                finalContent = String(parsedResult.response);
              } else if (parsedResult.response) {
                finalContent = String(parsedResult.response);
              } else if (parsedResult.result) {
                finalContent = String(parsedResult.result);
              } else {
                finalContent = String(completedTask.result);
              }
            } catch (error) {
              console.log('🔍 Failed to parse result, using raw:', error);
              finalContent = String(completedTask.result);
            }
          }
          
          console.log('🔍 Final content to display:', finalContent);
          
          if (!finalContent || finalContent.trim() === '') {
            finalContent = 'No requirements document was generated. Please check the logs for more details.';
            console.warn('⚠️ No final content found in task result');
          }
          
          // Clean up the existing content and append final deliverable
          let existingContent = placeholderMessage.content;
          
          // Remove any "Processing final response..." indicator
          existingContent = existingContent.replace(/🔄 Processing final response\.\.\./g, '').trim();
          
          // Append the actual requirements document
          placeholderMessage.content = existingContent + `\n\n---\n\n**📋 Requirements Document:**\n\n${finalContent}`;
          placeholderMessage.metadata = {
            ...placeholderMessage.metadata,
            isPlaceholder: false, // No longer a placeholder
            isCompleted: true,
            completedAt: new Date().toISOString()
          };
          
          // Trigger reactivity
          this.messages[placeholderIndex] = { ...placeholderMessage };
        } else {
          // Add new message if no placeholder found
          this.createResponseMessage(completedTask);
        }
        
        // Cleanup subscriptions
        websocketService.unsubscribeFromTask(taskId);
        
      } catch (error) {
        console.error('Error handling task completion:', error);
        this.error = error instanceof Error ? error.message : 'Failed to load task result';
      }
    },

    /**
     * Handle workflow step updates - accumulating version
     */
    handleWorkflowStepUpdate(taskId: string, stepEvent: any) {
      console.log(`🔧 Workflow step event received:`, stepEvent);
      
      const messageIndex = this.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = this.messages[messageIndex];
        
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
            step => step.index === stepEvent.stepIndex
          );
          
          if (existingStepIndex === -1) {
            message.metadata.completedSteps.push(stepData);
            console.log(`✅ Added completed step: ${stepEvent.stepName} with message: ${displayMessage}`);
          }
          
          // Sort steps by index to ensure correct order
          message.metadata.completedSteps.sort((a, b) => a.index - b.index);
          
          // Rebuild content from all completed steps
          let accumulatedContent = '';
          
          // Add all completed steps using their messages
          message.metadata.completedSteps.forEach(step => {
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
          
          message.content = accumulatedContent;
          console.log(`📝 Updated workflow content:`, accumulatedContent);
          console.log(`📊 Current completedSteps: ${message.metadata.completedSteps.length}/${stepEvent.totalSteps}`);
        }
        
        // Keep the old workflow_steps_realtime for compatibility
        if (!message.metadata.workflow_steps_realtime) {
          message.metadata.workflow_steps_realtime = [];
        }
        
        const existingStepIndex = message.metadata.workflow_steps_realtime.findIndex(
          (step: any) => step.stepName === stepEvent.stepName
        );
        
        const stepData = {
          ...stepEvent,
          timestamp: new Date().toISOString()
        };
        
        if (existingStepIndex >= 0) {
          message.metadata.workflow_steps_realtime[existingStepIndex] = stepData;
        } else {
          message.metadata.workflow_steps_realtime.push(stepData);
        }
        
        message.metadata.workflow_steps_realtime.sort((a: any, b: any) => a.stepIndex - b.stepIndex);
        message.metadata.processing_type = 'langgraph-multi-step-workflow';
        
        // Trigger reactivity
        this.messages[messageIndex] = { ...message };
      }
    },
  },

  getters: {
    hasCurrentAgent: (state) => !!state.currentAgent,
    hasActiveConversation: (state) => !!state.currentConversationId,
    canSendMessage: (state) => !!state.currentAgent && !state.isSendingMessage,
  },
});