import { defineStore } from 'pinia';
import { agentConversationsService, type AgentType } from '@/services/agentConversationsService';
import { tasksService } from '@/services/tasksService';
import { useLLMStore } from '@/stores/llmStore';
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

        // Generate task ID upfront for workflow agents to enable early WebSocket subscription
        let preGeneratedTaskId: string | null = null;
        let placeholderMessage: AgentChatMessage | null = null;
        
        if (this.currentAgent.name === 'requirements_writer') {
          // Generate task ID immediately
          preGeneratedTaskId = generateUUID();
          console.log('🆔 Generated task ID upfront:', preGeneratedTaskId);
          
          // Create placeholder message with the pre-generated task ID
          placeholderMessage = {
            id: `workflow-${preGeneratedTaskId}`,
            role: 'assistant',
            content: 'Processing your request using multi-step workflow...',
            timestamp: new Date(),
            taskId: preGeneratedTaskId, // Set task ID immediately
            metadata: {
              processing_type: 'langgraph-multi-step-workflow',
              isPlaceholder: true,
              agentName: this.currentAgent.name
            }
          };
          
          console.log('📝 Creating placeholder message with pre-generated task ID:', placeholderMessage);
          this.messages.push(placeholderMessage);
        }

        // For workflow agents, establish WebSocket connection and subscribe immediately with pre-generated task ID
        if (this.currentAgent.name === 'requirements_writer' && preGeneratedTaskId) {
          console.log('🔗 Ensuring WebSocket connection before creating task...');
          await websocketService.ensureConnection();
          console.log('✅ WebSocket connection established');
          
          // Subscribe to WebSocket events BEFORE making the API call
          console.log('📡 Subscribing to WebSocket events BEFORE API call for task:', preGeneratedTaskId);
          websocketService.subscribeToTask(preGeneratedTaskId);
          console.log('✅ Early WebSocket subscription completed for task:', preGeneratedTaskId);
        }

        // Create task (this will create conversation if needed)
        
        // Use agent type as-is - everything should use 'specialist' (singular)
        const agentType = this.currentAgent.type;
        
        // Build conversation history array from current messages (excluding placeholder)
        const conversationHistory = this.messages
          .filter(msg => !msg.metadata?.isPlaceholder)
          .map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            taskId: msg.taskId,
            metadata: msg.metadata
          }));
        
        // Get LLM preferences from store
        const llmStore = useLLMStore();
        const llmSelection = llmStore.currentLLMSelection;
        
        // Pre-setup WebSocket event handlers for workflow agents
        let workflowStepHandler: ((stepEvent: any) => void) | null = null;
        let taskCompletionHandler: ((event: any) => void) | null = null;
        
        if (this.currentAgent.name === 'requirements_writer') {
          console.log('🔗 Pre-registering WebSocket handlers for workflow agent...');
          
          // Pre-register workflow step handler (will be called with actual task ID)
          workflowStepHandler = (stepEvent: any) => {
            console.log('🔧 Workflow step event received in agentChatStore:', stepEvent);
            console.log('🔧 Workflow step details:', {
              taskId: stepEvent.taskId,
              stepName: stepEvent.stepName,
              stepIndex: stepEvent.stepIndex,
              status: stepEvent.status,
              message: stepEvent.message
            });
            this.handleWorkflowStepUpdate(stepEvent.taskId, stepEvent);
          };
          
          // Pre-register task completion handler
          taskCompletionHandler = (event: any) => {
            console.log('🎉 Task completed event received:', event);
            this.handleTaskCompletion(event.taskId);
          };
          
          // Set up global listeners that will catch events for any task
          websocketService.onAllWorkflowSteps(workflowStepHandler);
          websocketService.onAllTaskEvents(taskCompletionHandler);
        }

        const task = await tasksService.createAgentTask(
          agentType,
          this.currentAgent.name,
          {
            method: 'process',
            prompt: content,
            conversationId: this.currentConversationId || undefined, // null on first message
            taskId: preGeneratedTaskId || undefined, // Include pre-generated task ID for workflow agents
            conversationHistory, // Pass conversation history with each message
            llmSelection, // Include LLM and CIDAFM preferences
          }
        );

        // Store conversation ID from response
        if (task.conversationId) {
          this.currentConversationId = task.conversationId;
        }

        // Verify task ID matches pre-generated ID for workflow agents
        if (this.currentAgent.name === 'requirements_writer' && preGeneratedTaskId) {
          if (task.taskId !== preGeneratedTaskId) {
            console.warn('⚠️ Task ID mismatch! Expected:', preGeneratedTaskId, 'Got:', task.taskId);
          } else {
            console.log('✅ Task ID matches pre-generated ID:', task.taskId);
          }
          
          // For workflow agents, the task is processed asynchronously
          // We already subscribed to WebSocket events with the pre-generated task ID
          if (task.status === 'pending') {
            console.log('🔄 Task is pending, will receive updates via pre-subscribed WebSocket');
            return; // Don't create assistant message yet - wait for WebSocket completion
          }
        }

        // Parse agent response to extract markdown content
        let responseContent = 'Task submitted successfully.';
        let responseMetadata = {};
        
        if (task.result) {
          try {
            // A2A protocol agents return JSON with { success, response, metadata }
            const parsedResult = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
            if (parsedResult.success && parsedResult.response) {
              responseContent = String(parsedResult.response); // Ensure it's a string
              responseMetadata = parsedResult.metadata || {};
            } else {
              responseContent = String(task.result);
            }
          } catch (error) {
            // If parsing fails, use the raw result
            responseContent = String(task.result);
          }
        }

        // WebSocket subscription is now handled above for workflow agents
        // For non-workflow agents, still subscribe to task completion
        if (!placeholderMessage) {
          this.subscribeToTaskCompletion(task.taskId);
        }

      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to send message';
      } finally {
        this.isSendingMessage = false;
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
     * Subscribe to task completion via WebSocket
     */
    async subscribeToTaskCompletion(taskId: string) {
      console.log('🔔 Subscribing to task completion:', taskId);
      
      // Ensure WebSocket connection is established
      await websocketService.ensureConnection();
      console.log('🔗 WebSocket connection status:', websocketService.getStatus());
      
      // Subscribe to task completion events
      websocketService.onTaskEvent('completed', (event) => {
        console.log('🎉 Task completed event received:', event);
        
        if (event.taskId === taskId) {
          console.log('✅ Task completion matches our task:', taskId);
          
          // Fetch the completed task to get the full response
          this.handleTaskCompletion(taskId);
        }
      });
      
      // Subscribe to workflow step events for real-time progress
      websocketService.onWorkflowStep(taskId, (stepEvent) => {
        console.log('🔧 Workflow step event received in agentChatStore:', stepEvent);
        this.handleWorkflowStepUpdate(taskId, stepEvent);
      });
      
      // Subscribe to task updates via WebSocket
      websocketService.subscribeToTask(taskId);
      console.log('📡 Subscribed to WebSocket events for task:', taskId);
    },

    /**
     * Handle task completion by fetching the full task result
     */
    async handleTaskCompletion(taskId: string) {
      try {
        console.log('📥 Fetching completed task:', taskId);
        
        // Get the completed task with full response
        const completedTask = await tasksService.getTask(taskId);
        console.log('📋 Completed task data:', completedTask);
        
        // Parse the response
        let responseContent = 'Task completed successfully.';
        let responseMetadata = {};
        
        if (completedTask.result) {
          try {
            // A2A protocol agents return JSON with { success, response, metadata }
            const parsedResult = typeof completedTask.result === 'string' 
              ? JSON.parse(completedTask.result) 
              : completedTask.result;
            
            if (parsedResult.success && parsedResult.response) {
              responseContent = String(parsedResult.response);
              responseMetadata = parsedResult.metadata || {};
            } else {
              responseContent = String(completedTask.result);
            }
          } catch (error) {
            // If parsing fails, use the raw result
            responseContent = String(completedTask.result);
          }
        }

        // Find and replace placeholder message, or add new message
        const placeholderIndex = this.messages.findIndex(msg => 
          msg.taskId === taskId && msg.metadata?.isPlaceholder
        );
        
        const assistantMessage: AgentChatMessage = {
          id: `assistant-${taskId}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(completedTask.completedAt || completedTask.updatedAt),
          taskId: taskId,
          metadata: responseMetadata,
        };
        
        if (placeholderIndex >= 0) {
          console.log('🔄 Replacing placeholder message with final result');
          this.messages[placeholderIndex] = assistantMessage;
        } else {
          console.log('💬 Adding assistant message:', assistantMessage);
          this.messages.push(assistantMessage);
        }
        
        // Unsubscribe from task updates (but not for workflow agents that need real-time progress)
        const isWorkflowAgent = this.currentAgent?.name === 'requirements_writer';
        if (!isWorkflowAgent) {
          websocketService.unsubscribeFromTask(taskId);
        }
        
      } catch (error) {
        console.error('❌ Error handling task completion:', error);
        this.error = error instanceof Error ? error.message : 'Failed to load task result';
      }
    },

    /**
     * Handle workflow step updates in real-time
     */
    handleWorkflowStepUpdate(taskId: string, stepEvent: any) {
      console.log('🔧 Handling workflow step update:', stepEvent);
      
      // Find the placeholder message for this task
      const messageIndex = this.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = this.messages[messageIndex];
        
        // Initialize workflow steps if not present
        if (!message.metadata) {
          message.metadata = {};
        }
        
        if (!message.metadata.workflow_steps_realtime) {
          message.metadata.workflow_steps_realtime = [];
        }
        
        // Update or add the step
        const existingStepIndex = message.metadata.workflow_steps_realtime.findIndex(
          (step: any) => step.stepName === stepEvent.stepName
        );
        
        if (existingStepIndex >= 0) {
          // Update existing step
          message.metadata.workflow_steps_realtime[existingStepIndex] = {
            ...stepEvent,
            timestamp: new Date(stepEvent.timestamp || new Date())
          };
        } else {
          // Add new step
          message.metadata.workflow_steps_realtime.push({
            ...stepEvent,
            timestamp: new Date(stepEvent.timestamp || new Date())
          });
        }
        
        // Sort steps by index
        message.metadata.workflow_steps_realtime.sort((a: any, b: any) => a.stepIndex - b.stepIndex);
        
        // Mark as workflow message
        message.metadata.processing_type = 'langgraph-multi-step-workflow';
        
        // Trigger reactivity
        this.messages[messageIndex] = { ...message };
        
        console.log('✅ Updated placeholder message with workflow step:', message.metadata.workflow_steps_realtime);
      } else {
        console.log('⚠️ No placeholder message found for workflow step update');
      }
    },
  },

  getters: {
    hasCurrentAgent: (state) => !!state.currentAgent,
    hasActiveConversation: (state) => !!state.currentConversationId,
    canSendMessage: (state) => !!state.currentAgent && !state.isSendingMessage,
  },
});