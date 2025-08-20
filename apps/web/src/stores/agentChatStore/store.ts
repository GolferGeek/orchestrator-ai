import { defineStore } from 'pinia';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { useAgentConversationsStore } from '@/stores/agentConversationsStore';
import { useLLMStore } from '@/stores/llmStore';
import { formatAgentName } from '@/utils/caseConverter';
import tasksService from '@/services/tasksService';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { useContextStore } from '@/stores/contextStore';

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Import services
import { conversation } from './conversation';
import { taskExecution } from './taskExecution';
import { websocketHandler } from './websocketHandler';
import { messageFormatting } from './messageFormatting';
import { deliverable } from './deliverable';

// Import types
import type { AgentConversation, AgentChatMessage, ExecutionMode, Agent } from './types';

// Pre-generated task ID for WebSocket mode
let preGeneratedTaskId: string | undefined;

interface AgentChatState {
  conversations: AgentConversation[];
  activeConversationId: string | null;
  globalError: string | null;
}

export const useAgentChatStore = defineStore('agentChat', {
  state: (): AgentChatState => ({
    conversations: [],
    activeConversationId: null,
    globalError: null,
  }),

  getters: {
    hasCurrentAgent: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return !!activeConversation?.agent;
    },
    
    hasActiveConversation: (state) => !!state.activeConversationId,
    
    canSend: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return !!activeConversation?.agent;
    },
    
    isSendingMessage: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return activeConversation?.isSendingMessage || false;
    },
    
    isLoading: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return activeConversation?.isLoading || false;
    },
    
    error: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return activeConversation?.error || state.globalError;
    }
  },

  actions: {
    /**
     * Get active conversation
     */
    getActiveConversation(): AgentConversation | null {
      return this.conversations.find(conv => conv.id === this.activeConversationId) || null;
    },

    /**
     * Get conversation by ID
     */
    getConversationById(conversationId: string): AgentConversation | null {
      return this.conversations.find(conv => conv.id === conversationId) || null;
    },

    /**
     * Start new conversation with agent
     */
    async startNewConversation(agent: Agent): Promise<string> {
      console.log(`💬 Starting new conversation with agent: ${agent.name}`);
      
      // Create conversation object
      const newConversation = conversation.createConversationObject(agent);
      
      // Create conversation in backend first
      try {
        const backendConversationId = await conversation.createConversation(agent);
        // Use the backend conversation ID instead of the local one
        newConversation.id = backendConversationId;
        console.log(`🔗 Backend conversation created: ${backendConversationId}`);
      } catch (error) {
        console.error('❌ Failed to create backend conversation:', error);
        // Continue with local conversation ID as fallback, but this might cause issues
        console.warn('⚠️ Continuing with local conversation ID, but project creation may fail');
      }
      
      // Add welcome message (matching original behavior)
      newConversation.messages.push({
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hello! I'm the ${formatAgentName(agent.name)}. How can I help you today?`,
        timestamp: new Date(),
        metadata: { isWelcome: true }
      });
      
      // Update execution modes based on agent capabilities
      await conversation.updateConversationExecutionModes(newConversation);
      
      // Add to conversations list
      this.conversations.push(newConversation);
      this.activeConversationId = newConversation.id;
      
      // Add to navigation store immediately so it appears in the left pane
      const conversationsStore = useAgentConversationsStore();
      conversationsStore.addExistingConversation({
        id: newConversation.id,
        agentName: agent.name,
        agentType: agent.type,
        startedAt: new Date(),
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        taskCount: 0,
        completedTasks: 0,
        failedTasks: 0,
        activeTasks: 0,
      });
      console.log('✅ Conversation added to navigation tree immediately');
      
      console.log(`✅ New conversation started: ${newConversation.id}`);
      return newConversation.id;
    },

    /**
     * Switch to a different conversation
     */
    async switchToConversation(conversationId: string) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        this.activeConversationId = conversationId;
        conv.lastActiveAt = new Date();
        
        // Update supported execution modes if needed
        await conversation.updateConversationExecutionModes(conv);
      }
    },

    /**
     * Close conversation
     */
    closeConversation(conversationId: string) {
      const conv = this.getConversationById(conversationId);
      if (conv) {
        // Cleanup conversation resources
        conversation.cleanupConversation(conv);
        
        // Remove from list
        this.conversations = this.conversations.filter(c => c.id !== conversationId);
        
        // Update active conversation
        if (this.activeConversationId === conversationId) {
          this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
        }
      }
    },

    /**
     * Open existing conversation from backend
     */
    async openExistingConversation(backendConversationId: string) {
      try {
        console.log(`🔍 Opening existing conversation: ${backendConversationId}`);

        // Get conversation details from backend
        const backendConversation = await conversation.getBackendConversation(backendConversationId);
        
        // Create agent object from backend conversation data
        const agent = {
          name: backendConversation.agentName,
          type: backendConversation.agentType,
          description: undefined
        };
        
        // Create conversation object with proper creation date
        const conversationCreatedAt = new Date(backendConversation.startedAt);
        const newConversation = conversation.createConversationObject(agent, conversationCreatedAt);
        newConversation.id = backendConversationId; // Use backend ID
        
        // Load conversation messages (this already includes deliverable linking)
        console.log(`📚 Loading messages with deliverable linking...`);
        newConversation.messages = await conversation.loadConversationMessages(backendConversationId);
        console.log(`✅ Messages loaded with deliverable IDs linked`);
        
        // Update execution modes for this conversation
        await conversation.updateConversationExecutionModes(newConversation);
        
        // Add to conversations and make active
        this.conversations.push(newConversation);
        this.activeConversationId = backendConversationId;
        
        // Ensure the conversation is also in the navigation tree
        const conversationsStore = useAgentConversationsStore();
        conversationsStore.addExistingConversation({
          id: backendConversationId,
          agentName: backendConversation.agentName,
          agentType: backendConversation.agentType,
          startedAt: new Date(backendConversation.startedAt),
          lastActiveAt: new Date(backendConversation.lastActiveAt),
          createdAt: new Date(backendConversation.createdAt),
          updatedAt: new Date(backendConversation.updatedAt),
          taskCount: backendConversation.taskCount || 0,
          completedTasks: backendConversation.completedTasks || 0,
          failedTasks: backendConversation.failedTasks || 0,
          activeTasks: backendConversation.activeTasks || 0,
        });
        
        // Load conversation's deliverables (this happens AFTER conversation is shown but BEFORE UI updates)
        try {
          const deliverablesStore = useDeliverablesStore();
          
          console.log(`📋 Loading deliverables for conversation: ${backendConversationId}`);
          const deliverables = await deliverablesStore.loadDeliverablesByConversation(backendConversationId);
          
          if (deliverables && deliverables.length > 0) {
            console.log(`✅ Loaded ${deliverables.length} deliverable(s) for conversation`);
          } else {
            console.log(`ℹ️ No deliverables found for conversation: ${backendConversationId}`);
          }
        } catch (deliverableError) {
          console.warn('Failed to load deliverables for conversation:', deliverableError);
          // Don't let deliverable loading failure block conversation opening
        }
        
        // Restore WebSocket subscriptions for active tasks
        await this.restoreActiveTaskSubscriptions(newConversation);
        
        console.log(`✅ Existing conversation loaded: ${backendConversationId}`);
        
      } catch (error) {
        this.globalError = error instanceof Error ? error.message : 'Failed to load conversation';
        console.error('Failed to open existing conversation:', error);
      }
    },

    /**
     * Send message and create task
     */
    async sendMessage(content: string) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        console.error('No active conversation');
        return;
      }

      // Set loading state
      activeConversation.isSendingMessage = true;
      activeConversation.error = undefined;

      try {
        let conversationId = activeConversation.id;

        // Create conversation in backend if this is a new conversation (only has initial messages)
        const hasOnlyInitialMessages = activeConversation.messages.length <= 1 && 
          activeConversation.messages.every(msg => msg.metadata?.isWelcome);
          
        if (hasOnlyInitialMessages) {
          // Only create a backend conversation if one does not already exist
          const exists = await conversation.conversationExists(conversationId);
          if (!exists) {
            console.log('🔄 Creating new conversation in database...');
            const backendId = await conversation.createConversation(activeConversation.agent);
            conversationId = backendId;
            activeConversation.id = conversationId;
            this.activeConversationId = conversationId;
            console.log('✅ Backend conversation created:', backendId);
            
            // Update the conversations navigation store so the new conversation appears in the tree
            // Do this BEFORE creating tasks to avoid race conditions with WebSocket events
            const conversationsStore = useAgentConversationsStore();
            conversationsStore.addExistingConversation({
              id: conversationId,
              agentName: activeConversation.agent.name,
              agentType: activeConversation.agent.type,
              startedAt: new Date(),
              lastActiveAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              taskCount: 0,
              completedTasks: 0,
              failedTasks: 0,
              activeTasks: 0,
            });
            console.log('✅ Conversation added to navigation tree BEFORE task creation');
          } else {
            console.log('ℹ️ Backend conversation already exists, skipping creation');
          }
        } else {
          console.log('ℹ️ Using existing conversation ID:', conversationId);
        }

        // Add user message immediately
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        activeConversation.messages.push(userMessage);

        // Determine execution mode
        const userPreferences = useUserPreferencesStore();
        const effectiveMode = taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);
        
        // For WebSocket mode, generate task ID early and set up subscriptions
        if (effectiveMode === 'websocket') {
          preGeneratedTaskId = generateUUID();
          console.log(`🔗 Pre-generated task ID for WebSocket mode: ${preGeneratedTaskId}`);
        }

        // Prepare task execution options
        const taskOptions = {
          method: 'process',
          prompt: content,
          conversationId: conversationId,
          conversationHistory: this.buildConversationHistory(activeConversation),
          llmSelection: this.getLLMSelection(),
          executionMode: effectiveMode,
          agentType: activeConversation.agent.type,
          agentName: activeConversation.agent.name,
          taskId: preGeneratedTaskId,
        };

        // Execute task using service
        await taskExecution.createAndExecuteTask(taskOptions, {
          onPlaceholder: (taskId) => this.createPlaceholderMessage(conversationId, taskId),
          onCompletion: (taskId) => this.handleTaskCompletion(conversationId, taskId),
          onWorkflowStep: (convId, taskId, stepEvent) => this.handleWorkflowStepUpdate(convId, taskId, stepEvent),
          onStatusUpdate: (convId, taskId, statusUpdate) => this.handleTaskStatusUpdate(convId, taskId, statusUpdate),
          onImmediateResult: (convId, task) => this.createResponseMessage(convId, task),
        });

      } catch (error) {
        const conversation = this.getActiveConversation();
        if (conversation) {
          conversation.error = error instanceof Error ? error.message : 'Failed to send message';
        }
        console.error('Error sending message:', error);
      } finally {
        // Clear loading state
        const conversation = this.getActiveConversation();
        if (conversation) {
          conversation.isSendingMessage = false;
        }
      }
    },

    /**
     * Send message with context metadata for version operations
     */
    async sendMessageWithContext(content: string, metadata: any) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        console.error('No active conversation');
        return;
      }

      // Set loading state
      activeConversation.isSendingMessage = true;
      activeConversation.error = undefined;

      try {
        let conversationId = activeConversation.id;

        // Create conversation in backend if needed (same logic as sendMessage)
        const hasOnlyInitialMessages = activeConversation.messages.length <= 1 && 
          activeConversation.messages.every(msg => msg.metadata?.isWelcome);
          
        if (hasOnlyInitialMessages) {
          const exists = await conversation.conversationExists(conversationId);
          if (!exists) {
            console.log('🔄 Creating new conversation in database...');
            const backendId = await conversation.createConversation(activeConversation.agent);
            conversationId = backendId;
            activeConversation.id = conversationId;
            this.activeConversationId = conversationId;
            console.log('✅ Backend conversation created:', backendId);
            
            const conversationsStore = useAgentConversationsStore();
            conversationsStore.addExistingConversation({
              id: conversationId,
              agentName: activeConversation.agent.name,
              agentType: activeConversation.agent.type,
              startedAt: new Date(),
              lastActiveAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              taskCount: 0,
              completedTasks: 0,
              failedTasks: 0,
              activeTasks: 0,
            });
          }
        }

        // Add user message to conversation
        const userMessage = messageFormatting.createUserMessage(content);
        activeConversation.messages.push(userMessage);

        // Get execution mode and user preferences
        const userPreferences = useUserPreferencesStore();
        const effectiveMode = taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);
        
        // For WebSocket mode, generate task ID early
        if (effectiveMode === 'websocket') {
          preGeneratedTaskId = generateUUID();
          console.log(`🔗 Pre-generated task ID for WebSocket mode: ${preGeneratedTaskId}`);
        }

        // Prepare task execution options with context metadata
        const taskOptions = {
          method: 'process',
          prompt: content,
          conversationId: conversationId,
          conversationHistory: this.buildConversationHistory(activeConversation),
          llmSelection: this.getLLMSelection(),
          executionMode: effectiveMode,
          agentType: activeConversation.agent.type,
          agentName: activeConversation.agent.name,
          taskId: preGeneratedTaskId,
          metadata: metadata, // Include context metadata
        };

        // Execute task using service
        await taskExecution.createAndExecuteTask(taskOptions, {
          onPlaceholder: (taskId) => this.createPlaceholderMessage(conversationId, taskId),
          onCompletion: (taskId) => this.handleTaskCompletion(conversationId, taskId),
          onWorkflowStep: (convId, taskId, stepEvent) => this.handleWorkflowStepUpdate(convId, taskId, stepEvent),
          onStatusUpdate: (convId, taskId, statusUpdate) => this.handleTaskStatusUpdate(convId, taskId, statusUpdate),
          onImmediateResult: (convId, task) => this.createResponseMessage(convId, task),
        });

      } catch (error) {
        const conversation = this.getActiveConversation();
        if (conversation) {
          conversation.error = error instanceof Error ? error.message : 'Failed to send message';
        }
        console.error('Error sending message with context:', error);
      } finally {
        // Clear loading state
        const conversation = this.getActiveConversation();
        if (conversation) {
          conversation.isSendingMessage = false;
        }
      }
    },

    /**
     * Send message with automatic context detection
     */
    async sendContextAwareMessage(content: string) {
      const contextStore = useContextStore();
      const metadata = contextStore.contextMetadata;
      
      console.log('🎯 Sending context-aware message:', { content, metadata });
      
      if (metadata.context === 'conversation') {
        // Use regular sendMessage for conversation context
        return await this.sendMessage(content);
      } else {
        // Use sendMessageWithContext for deliverable/project contexts
        return await this.sendMessageWithContext(content, metadata);
      }
    },

    /**
     * Create placeholder message for ongoing task
     */
    createPlaceholderMessage(conversationId: string, taskId: string) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;

      const placeholderMessage = messageFormatting.createPlaceholderMessage(taskId);
      conv.messages.push(placeholderMessage);
    },

    /**
     * Create response message from completed task
     */
    createResponseMessage(conversationId: string, task: any) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;
      
      // Check for duplicates
      const existingResponse = conv.messages.find(msg => 
        msg.taskId === task.taskId && msg.role === 'assistant' && !msg.metadata?.isPlaceholder
      );
      
      if (existingResponse) {
        console.log(`⚠️ Response message already exists for task ${task.taskId}, skipping`);
        return;
      }

      const responseMessage = messageFormatting.createResponseMessage(conversationId, task);
      if (responseMessage) {
        conv.messages.push(responseMessage);
      }
    },

    /**
     * Handle task completion with deliverable generation
     */
    async handleTaskCompletion(conversationId: string, taskId: string) {
      console.log(`🏁 DEBUG: handleTaskCompletion called for task ${taskId}`);
      const conv = this.getConversationById(conversationId);
      if (!conv) {
        console.log(`🏁 DEBUG: No conversation found for ${conversationId}`);
        return;
      }

      const existingMessage = conv.messages.find(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );

      if (!existingMessage) {
        console.log(`🏁 DEBUG: No message found for task ${taskId}`);
        return;
      }

      console.log(`🏁 DEBUG: Found existing message for task ${taskId}`);

      // Set processing lock to prevent duplicates
      if (!deliverable.setProcessingLock(existingMessage, taskId)) {
        console.log(`🏁 DEBUG: Task ${taskId} already processing or completed`);
        return; // Already processing or completed
      }

      console.log(`🏁 DEBUG: Processing lock set for task ${taskId}`);

      try {
        // Get completed task
        console.log(`🏁 DEBUG: Getting completed task data for ${taskId}`);
        const completedTask = await tasksService.getTask(taskId);
        console.log(`🏁 DEBUG: Completed task data:`, completedTask);
        
        if (completedTask.status !== 'completed' || !completedTask.response) {
          console.log(`🏁 DEBUG: Task ${taskId} not completed or no response. Status: ${completedTask.status}`);
          deliverable.clearProcessingLock(existingMessage);
          return;
        }

        console.log(`🏁 DEBUG: Extracting deliverable content for task ${taskId}`);
        // Extract deliverable content
        const finalContent = messageFormatting.extractDeliverableContent(completedTask);
        console.log(`🏁 DEBUG: Final content extracted:`, finalContent.substring(0, 200) + '...');
        
        // Append deliverable with duplicate prevention
        console.log(`🏁 DEBUG: Appending deliverable for task ${taskId}`);
        const result = deliverable.appendDeliverable(existingMessage, {
          taskId,
          content: finalContent,
          existingContent: existingMessage.content,
          messageMetadata: existingMessage.metadata
        });

        console.log(`🏁 DEBUG: Task completion handled for ${taskId}: ${result.reason}`);

        // Force Vue reactivity by replacing the message in the array
        if (result.updated) {
          console.log(`🏁 DEBUG: Forcing Vue reactivity by replacing message in array`);
          const messageIndex = conv.messages.findIndex(msg => msg.taskId === taskId && msg.role === 'assistant');
          if (messageIndex >= 0) {
            console.log(`🏁 DEBUG: Replacing message at index ${messageIndex}`);
            // Create a new message object to trigger reactivity
            const updatedMessage = { ...existingMessage };
            conv.messages[messageIndex] = updatedMessage;
            console.log(`🏁 DEBUG: Message replaced, new content length: ${updatedMessage.content.length}`);
          }
        }

        // Cleanup WebSocket subscriptions
        websocketHandler.unsubscribeFromTask(taskId);
        console.log(`🏁 DEBUG: WebSocket unsubscribed for task ${taskId}`);

      } catch (error) {
        console.error(`🏁 DEBUG: Failed to handle task completion for ${taskId}:`, error);
        deliverable.clearProcessingLock(existingMessage);
        conv.error = error instanceof Error ? error.message : 'Failed to load task result';
      }
    },

    /**
     * Handle workflow step updates
     */
    handleWorkflowStepUpdate(conversationId: string, taskId: string, stepEvent: any) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;
      
      const messageIndex = conv.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = conv.messages[messageIndex];
        const result = websocketHandler.processWorkflowStepUpdate(message, stepEvent);
        
        if (result.contentUpdated && result.newContent) {
          message.content = result.newContent;
          conv.messages[messageIndex] = { ...message }; // Trigger reactivity
        }
      }
    },

    /**
     * Handle task status updates
     */
    handleTaskStatusUpdate(conversationId: string, taskId: string, statusUpdate: any) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;
      
      const messageIndex = conv.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = conv.messages[messageIndex];
        const result = websocketHandler.processTaskStatusUpdate(message, statusUpdate);
        
        if (result.contentUpdated && result.newContent) {
          message.content = result.newContent;
          conv.messages[messageIndex] = { ...message }; // Trigger reactivity
        }
      }
    },

    /**
     * Set execution mode for active conversation
     */
    setExecutionMode(mode: ExecutionMode) {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        taskExecution.setExecutionMode(activeConversation, mode);
      }
    },

    /**
     * Get effective execution mode for display
     */
    getEffectiveExecutionMode(): ExecutionMode {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        const userPreferences = useUserPreferencesStore();
        return taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);
      }
      return 'immediate';
    },

    /**
     * Clear chat session
     */
    clearChat() {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        this.closeConversation(activeConversation.id);
      }
      this.globalError = null;
    },

    /**
     * Set global error
     */
    setError(error: string | null) {
      this.globalError = error;
    },

    /**
     * Clear errors
     */
    clearError() {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        activeConversation.error = undefined;
      }
      this.globalError = null;
    },

    /**
     * Build conversation history for LLM context
     */
    buildConversationHistory(conversation: AgentConversation) {
      return conversation.messages
        .filter(msg => !msg.metadata?.isPlaceholder)
        .slice(-20) // Keep only last 20 messages
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          taskId: msg.taskId,
          metadata: msg.metadata
        }));
    },

    /**
     * Get current LLM selection
     */
    getLLMSelection() {
      const llmStore = useLLMStore();
      return llmStore.currentLLMSelection;
    },

    /**
     * Start chat with agent (alias for startNewConversation)
     */
    async startChatWithAgent(agent: Agent): Promise<string> {
      return this.startNewConversation(agent);
    },

    /**
     * Reset execution mode override
     */
    resetExecutionMode() {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        activeConversation.isExecutionModeOverride = false;
        console.log(`🔄 Reset execution mode override for agent: ${activeConversation.agent?.name}`);
      }
    },

    /**
     * Restore WebSocket subscriptions for active tasks in a conversation
     */
    async restoreActiveTaskSubscriptions(conv: AgentConversation) {
      try {
        console.log(`🔄 Restoring active task subscriptions for conversation: ${conv.id}`);
        
        // Get active tasks for this conversation
        const activeTasks = await conversation.getActiveTasksForConversation(conv.id);
        
        if (activeTasks.length === 0) {
          console.log(`ℹ️ No active tasks to restore for conversation ${conv.id}`);
          return;
        }
        
        console.log(`🔄 Restoring ${activeTasks.length} active task subscriptions:`, activeTasks.map(t => t.taskId));
        
        // Restore WebSocket subscriptions for each active task
        for (const task of activeTasks) {
          try {
            // Check if we have websocket mode enabled for this conversation
            if (conv.supportedExecutionModes.includes('websocket')) {
              console.log(`🔌 Restoring WebSocket subscription for task: ${task.taskId}`);
              
              // Use the websocket handler to subscribe to this task
              await websocketHandler.subscribeToTaskEvents(conv.id, task.taskId, {
                onTaskStatus: (update) => this.handleTaskStatusUpdate(conv.id, task.taskId, update),
                onCompletion: (taskId) => this.handleTaskCompletion(conv.id, taskId),
                onWorkflowStep: (stepEvent) => this.handleWorkflowStepUpdate(conv.id, task.taskId, stepEvent)
              });
              
              console.log(`✅ WebSocket subscription restored for task: ${task.taskId}`);
            } else {
              console.log(`⚠️ Conversation doesn't support WebSocket mode, skipping task: ${task.taskId}`);
            }
          } catch (error) {
            console.error(`❌ Failed to restore WebSocket subscription for task ${task.taskId}:`, error);
          }
        }
        
        console.log(`✅ Active task subscription restoration complete for conversation: ${conv.id}`);
        
      } catch (error) {
        console.error(`❌ Failed to restore active task subscriptions for conversation ${conv.id}:`, error);
      }
    }
  }
});