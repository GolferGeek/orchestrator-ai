import { defineStore } from 'pinia';
import { reactive } from 'vue';
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
     * Initialize WebSocket handler with store instance
     */
    initializeWebSocketHandler() {
      websocketHandler.setStore(this);
    },
    
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
      
      // Create conversation object
      const newConversation = conversation.createConversationObject(agent);
      
      // Create conversation in backend first
      try {
        const backendConversationId = await conversation.createConversation(agent);
        // Use the backend conversation ID instead of the local one
        newConversation.id = backendConversationId;
      } catch (error) {
        console.error('❌ Failed to create backend conversation:', error);
        // Continue with local conversation ID as fallback, but this might cause issues
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

        newConversation.messages = await conversation.loadConversationMessages(backendConversationId);

        
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
          

          const deliverables = await deliverablesStore.loadDeliverablesByConversation(backendConversationId);
          
          if (deliverables && deliverables.length > 0) {

          } else {

          }
        } catch (deliverableError) {
          console.warn('Failed to load deliverables for conversation:', deliverableError);
          // Don't let deliverable loading failure block conversation opening
        }
        
        // Restore WebSocket subscriptions for active tasks
        await this.restoreActiveTaskSubscriptions(newConversation);
        

        
      } catch (error) {
        this.globalError = error instanceof Error ? error.message : 'Failed to load conversation';
        console.error('Failed to open existing conversation:', error);
      }
    },

    /**
     * Send message and create task
     */
    async sendMessage(content: string) {
      // Initialize WebSocket handler with store instance
      this.initializeWebSocketHandler();
      
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

            const backendId = await conversation.createConversation(activeConversation.agent);
            conversationId = backendId;
            activeConversation.id = conversationId;
            this.activeConversationId = conversationId;

            
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

          } else {

          }
        } else {

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

        // Always generate a unique task ID for every task execution to prevent database conflicts
        preGeneratedTaskId = generateUUID();


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

          onStatusUpdate: (convId, taskId, statusUpdate) => this.handleTaskStatusUpdate(convId, taskId, statusUpdate),

        });

      } catch (error) {
        const conversation = this.getActiveConversation();
        if (conversation) {
          // Generic error handling for actual errors
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

            const backendId = await conversation.createConversation(activeConversation.agent);
            conversationId = backendId;
            activeConversation.id = conversationId;
            this.activeConversationId = conversationId;

            
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

        // Ensure conversationId is included in metadata for deliverable operations
        const enhancedMetadata = {
          ...metadata,
          conversationId: conversationId
        };

        // Get execution mode and user preferences
        const userPreferences = useUserPreferencesStore();
        const effectiveMode = taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);

        // Always generate a unique task ID for every task execution to prevent database conflicts
        preGeneratedTaskId = generateUUID();


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
          metadata: enhancedMetadata, // Include context metadata with conversationId
        };

        // Execute task using service
        await taskExecution.createAndExecuteTask(taskOptions, {
          onPlaceholder: (taskId) => this.createPlaceholderMessage(conversationId, taskId),
          onCompletion: (taskId) => this.handleTaskCompletion(conversationId, taskId),

          onStatusUpdate: (convId, taskId, statusUpdate) => this.handleTaskStatusUpdate(convId, taskId, statusUpdate),

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

      console.log('🔍 [FRONTEND-DEBUG] handleTaskCompletion called for taskId:', taskId);


      // Prevent duplicate completion handling
      if ((this as any)._completingTasks?.has(taskId)) {
        return;
      }
      
      // Track that we're handling this completion
      if (!(this as any)._completingTasks) {
        (this as any)._completingTasks = new Set();
      }
      (this as any)._completingTasks.add(taskId);

      const conv = this.getConversationById(conversationId);
      if (!conv) {
        return;
      }

      const existingMessage = conv.messages.find(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );

      if (!existingMessage) {
        return;
      }



      try {
        // Get completed task - small delay to work around backend timing issue

        await new Promise(resolve => setTimeout(resolve, 100)); // Workaround: backend sends WebSocket before DB commit
        const completedTask = await tasksService.getTask(taskId);


        if (completedTask.status !== 'completed') {
          console.warn(`Task ${taskId} is not completed, status: ${completedTask.status}`);
          return;
        }


        // Extract final content for display - backend handles deliverable creation
        const finalContent = messageFormatting.extractDeliverableContent(completedTask);

        // Parse the response to get deliverable info (backend puts it in the response JSON)
        let deliverableId = null;
        let newVersionId = null;
        let versionNumber = null;
        let parsedResponse = null;

        if (completedTask.response) {
          try {
            parsedResponse = typeof completedTask.response === 'string'
              ? JSON.parse(completedTask.response)
              : completedTask.response;

            console.log('🔍 [FRONTEND-DEBUG] parsedResponse:', parsedResponse);
            console.log('🔍 [FRONTEND-DEBUG] completedTask.response type:', typeof completedTask.response);
            
            
            // Backend puts deliverable info directly in the result object
            deliverableId = parsedResponse?.deliverableId;
            newVersionId = parsedResponse?.newVersionId;
            versionNumber = parsedResponse?.versionNumber;
            
          } catch (e) {
          }
        }

        // Process unified response format if available
        const llmStore = useLLMStore();
        if (parsedResponse) {
          const processedResponse = llmStore.processUnifiedResponse(parsedResponse);
          
          // Store unified response data in message metadata for UI access
          existingMessage.metadata = {
            ...existingMessage.metadata,
            llmResponse: llmStore.lastUnifiedResponse,
            llmError: llmStore.lastStandardizedError,
            processedContent: processedResponse.content,
            isLLMError: processedResponse.isError,
            isRetryable: processedResponse.isRetryable,
          };
        }

        // Update message content with the final response
        existingMessage.content = finalContent;
        console.log('🔍 [FRONTEND-DEBUG] Agent result metadata:', parsedResponse?.metadata);
        console.log('🔍 [FRONTEND-DEBUG] Has sanitizationMetadata:', !!parsedResponse?.metadata?.sanitizationMetadata);
        console.log('🔍 [FRONTEND-DEBUG] Full sanitizationMetadata:', parsedResponse?.metadata?.sanitizationMetadata);

        existingMessage.metadata = {
          ...existingMessage.metadata,
          isPlaceholder: false,
          isCompleted: true,
          completedAt: new Date().toISOString()
        };

        // Update message metadata immediately for deliverables (synchronous - triggers immediate UI update)
        if (deliverableId) {
          (existingMessage as any).deliverableId = deliverableId;
          existingMessage.metadata = {
            ...existingMessage.metadata,
            deliverableId: deliverableId
          };
        }
        
        if (newVersionId) {
          existingMessage.metadata = {
            ...existingMessage.metadata,
            newVersionId: newVersionId,
            versionNumber: versionNumber
          };
        }

        // Force Vue reactivity by replacing the message in the array (after all metadata updates)
        const finalMessageIndex = conv.messages.findIndex(msg => msg.taskId === taskId && msg.role === 'assistant');
        if (finalMessageIndex >= 0) {
          const updatedMessage = { ...existingMessage };
          conv.messages[finalMessageIndex] = updatedMessage;
        }

        // Load deliverables in background (non-blocking) - fire and forget
        if (deliverableId) {
          this.loadDeliverableInBackground(deliverableId, conversationId);
        }

        // Cleanup WebSocket subscriptions
        websocketHandler.unsubscribeFromTask(taskId);


      } catch (error) {
        console.error(`🏁 DEBUG: Failed to handle task completion for ${taskId}:`, error);
        conv.error = error instanceof Error ? error.message : 'Failed to load task result';
      } finally {
        // Clean up completion tracking
        (this as any)._completingTasks?.delete(taskId);
      }
    },

    /**
     * Ensure deliverable is loaded into store for Vue reactivity
     */
    async ensureDeliverableLoaded(conversationId: string, task: any) {

      
      // Extract deliverable ID from task response (same logic as messageFormatting)
      let deliverableId = null;
      if (task.response) {
        try {
          const parsedResponse = typeof task.response === 'string' 
            ? JSON.parse(task.response) 
            : task.response;
          
          // Match the extraction logic from messageFormatting.ts
          if (parsedResponse?.deliverableId) {
            deliverableId = parsedResponse.deliverableId;
          } else if (parsedResponse?.success?.deliverableId) {
            deliverableId = parsedResponse.success.deliverableId;
          } else if (parsedResponse?.deliverableId) {
            deliverableId = parsedResponse.deliverableId;
          } else if (parsedResponse?.result?.deliverableId) {
            deliverableId = parsedResponse.result.deliverableId;
          }
          


        } catch (e) {

          return;
        }
      }

      if (deliverableId) {

        
        // Load the deliverable into the store to trigger Vue reactivity
        const deliverablesStore = useDeliverablesStore();
        try {
          await deliverablesStore.loadDeliverablesByConversation(conversationId);

        } catch (error) {
          console.error(`📦 ERROR: Failed to load deliverables for conversation ${conversationId}:`, error);
        }
      }
    },



    /**
     * Handle task status updates
     */
    handleTaskStatusUpdate(conversationId: string, taskId: string, statusUpdate: any) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;
      
      // Handle PII policy violations specifically
      if (statusUpdate.metadata?.type === 'pii_violation') {
        // Remove any existing placeholder message for this task
        const placeholderIndex = conv.messages.findIndex(msg => 
          msg.taskId === taskId && msg.role === 'assistant'
        );
        if (placeholderIndex >= 0) {
          conv.messages.splice(placeholderIndex, 1);
        }
        
        // Add PII violation system message with reactive metadata
        const piiMessageId = `pii-${taskId}-${Date.now()}`;
        const piiMessage = reactive({
          id: piiMessageId,
          role: 'system',
          content: statusUpdate.error || 'I cannot process your request because it contains sensitive personal information. Please rephrase your request without including any personal identifiable information.',
          timestamp: new Date(),
          metadata: {
            type: 'pii_violation',
            error: false, // Not an error, just a policy decision
            blocked: true,
            detectedTypes: statusUpdate.metadata.detectedTypes || [],
            suggestion: statusUpdate.metadata.suggestion || 'Please remove any SSNs, credit card numbers, API keys, or other sensitive data and try again.',
            // Add sanitization metadata for the banner
            sanitizationMetadata: {
              status: 'blocked',
              piiDetected: true,
              piiTypes: statusUpdate.metadata.detectedTypes || [],
              dataSanitizationApplied: true,
              sanitizationLevel: 'strict',
              blockReason: 'PII policy violation'
            }
          }
        });
        
        conv.messages.push(piiMessage);
        
        // Clear loading state
        conv.isSendingMessage = false;
        return;
      }
      
      // Handle regular status updates
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

      }
    },

    /**
     * Restore WebSocket subscriptions for active tasks in a conversation
     */
    async restoreActiveTaskSubscriptions(conv: AgentConversation) {
      try {

        
        // Get active tasks for this conversation
        const activeTasks = await conversation.getActiveTasksForConversation(conv.id);
        
        if (activeTasks.length === 0) {

          return;
        }
        

        
        // Restore WebSocket subscriptions for each active task
        for (const task of activeTasks) {
          try {
            // Check if we have websocket mode enabled for this conversation
            if (conv.supportedExecutionModes.includes('websocket')) {

              
              // Use the websocket handler to subscribe to this task
              await websocketHandler.subscribeToTaskEvents(conv.id, task.taskId, {
                onTaskStatus: (update) => this.handleTaskStatusUpdate(conv.id, task.taskId, update),
                onCompletion: (taskId) => this.handleTaskCompletion(conv.id, taskId),
                onWorkflowStep: (stepEvent) => websocketHandler.updateMessageWorkflowStep(conv.id, task.taskId, stepEvent)
              });
              

            } else {

            }
          } catch (error) {
            console.error(`❌ Failed to restore WebSocket subscription for task ${task.taskId}:`, error);
          }
        }
        

        
      } catch (error) {
        console.error(`❌ Failed to restore active task subscriptions for conversation ${conv.id}:`, error);
      }
    },

    /**
     * Load deliverable in background - non-blocking, UI will react when loaded
     */
    loadDeliverableInBackground(deliverableId: string, conversationId: string) {
      // Fire and forget - don't await or block
      (async () => {
        try {
          const { deliverablesService } = await import('@/services/deliverablesService');
          const { useDeliverablesStore } = await import('@/stores/deliverablesStore');
          const deliverablesStore = useDeliverablesStore();

          // Load the deliverable - Vue reactivity will update UI when this completes
          const newDeliverable = await deliverablesService.getDeliverable(deliverableId);
          
          deliverablesStore.addDeliverable(newDeliverable);

          // Load conversation deliverables to ensure it shows up in lists
          await deliverablesStore.loadDeliverablesByConversation(conversationId);

          // Load versions for the deliverable
          await deliverablesStore.loadDeliverableVersions(deliverableId);

        } catch (error) {
          // Don't throw - this is background processing
        }
      })();
    },

    /**
     * Load deliverable versions in background - non-blocking
     */
    loadVersionsInBackground(deliverableId: string) {
      // Fire and forget - don't await or block
      (async () => {
        try {
          const { useDeliverablesStore } = await import('@/stores/deliverablesStore');
          const deliverablesStore = useDeliverablesStore();
          
          await deliverablesStore.loadDeliverableVersions(deliverableId);
          
          console.log(`📄 Background version loading completed for ${deliverableId}`);
        } catch (error) {
          console.error('Background version loading failed:', error);
          // Don't throw - this is background processing
        }
      })();
    }
  }
});