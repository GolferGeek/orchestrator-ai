import { defineStore } from 'pinia';
import { agentConversationsService, type AgentType } from '@/services/agentConversationsService';
import { tasksService } from '@/services/tasksService';
import { useLLMStore } from '@/stores/llmStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { websocketService } from '@/services/websocketService';
import { formatAgentName } from '@/utils/caseConverter';

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface Conversation {
  id: string; // Always non-null UUID generated on frontend
  agent: {
    name: string;
    type: AgentType;
    description?: string;
  };
  messages: AgentChatMessage[];
  isLoading: boolean;
  isSendingMessage: boolean;
  error: string | null;
  executionMode: 'immediate' | 'polling' | 'websocket' | null;
  isExecutionModeOverride: boolean;
  supportedExecutionModes: ('immediate' | 'polling' | 'websocket')[]; // Available modes for this agent
  createdAt: Date;
  lastActiveAt: Date;
  title: string; // Display name for the tab
}

export interface AgentChatState {
  // All open conversations
  conversations: Conversation[];
  
  // Currently active conversation ID
  activeConversationId: string | null;
  
  // Global UI state
  globalError: string | null;
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
    conversations: [],
    activeConversationId: null,
    globalError: null,
  }),

  actions: {
    /**
     * Get the currently active conversation
     */
    getActiveConversation(): Conversation | null {
      return this.conversations.find(conv => conv.id === this.activeConversationId) || null;
    },

    /**
     * Get conversation by ID
     */
    getConversationById(conversationId: string): Conversation | null {
      return this.conversations.find(conv => conv.id === conversationId) || null;
    },

    /**
     * Create conversation title based on agent and timestamp
     */
    createConversationTitle(agent: { name: string; type: AgentType }, createdAt: Date): string {
      const agentDisplayName = formatAgentName(agent.name);
      const now = new Date();
      
      // If it's today, show time only
      if (createdAt.toDateString() === now.toDateString()) {
        const time = createdAt.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        return `${agentDisplayName} ${time}`;
      }
      
      // If it's this week, show day and time
      const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        const time = createdAt.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        return `${agentDisplayName} Yesterday ${time}`;
      }
      
      if (daysDiff < 7) {
        const dayTime = createdAt.toLocaleDateString([], { 
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        return `${agentDisplayName} ${dayTime}`;
      }
      
      // For older conversations, show date and time
      const dateTime = createdAt.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${agentDisplayName} ${dateTime}`;
    },

    /**
     * Start a new conversation with an agent
     * Creates conversation immediately with generated UUID
     */
    startChatWithAgent(agent: { name: string; type: AgentType; description?: string; execution_modes?: string[] }) {
      const now = new Date();
      const conversationId = generateUUID(); // Generate conversation ID immediately
      
      // Determine supported execution modes from agent data or default to immediate
      let supportedModes: ('immediate' | 'polling' | 'websocket')[] = ['immediate'];
      if (agent.execution_modes && agent.execution_modes.length > 0) {
        // Map execution modes from agent data (handles 'real-time' -> 'websocket')
        supportedModes = agent.execution_modes.map(mode => 
          mode === 'real-time' ? 'websocket' : mode as ('immediate' | 'polling' | 'websocket')
        ).filter(mode => ['immediate', 'polling', 'websocket'].includes(mode));
      }
      
      // Create new conversation
      const newConversation: Conversation = {
        id: conversationId,
        agent: agent,
        messages: [],
        isLoading: false,
        isSendingMessage: false,
        error: null,
        executionMode: null,
        isExecutionModeOverride: false,
        supportedExecutionModes: supportedModes,
        createdAt: now,
        lastActiveAt: now,
        title: this.createConversationTitle(agent, now)
      };
      
      // Add welcome message
      newConversation.messages.push({
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hello! I'm the ${formatAgentName(agent.name)}. How can I help you today?`,
        timestamp: now,
        metadata: { isWelcome: true }
      });

      // Add conversation and set as active
      this.conversations.push(newConversation);
      this.activeConversationId = conversationId;
      this.globalError = null;
      
      // Initialize execution mode for new conversation
      this.initializeExecutionMode();
    },

    /**
     * Switch to a different conversation
     */
    async switchToConversation(conversationId: string) {
      const conversation = this.getConversationById(conversationId);
      if (conversation) {
        this.activeConversationId = conversationId;
        conversation.lastActiveAt = new Date();
        
        // Update supported execution modes if needed
        await this.updateConversationExecutionModes(conversationId);
      }
    },

    /**
     * Close a conversation tab
     */
    closeConversation(conversationId: string) {
      const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
      if (conversationIndex === -1) return;
      
      const wasActive = this.activeConversationId === conversationId;
      
      // Remove conversation
      this.conversations.splice(conversationIndex, 1);
      
      // If we closed the active conversation, switch to another or clear active
      if (wasActive) {
        if (this.conversations.length > 0) {
          // Switch to the previous conversation, or the first one if we closed the first
          const newActiveIndex = Math.max(0, conversationIndex - 1);
          this.activeConversationId = this.conversations[newActiveIndex]?.id || null;
        } else {
          this.activeConversationId = null;
        }
      }
    },

    /**
     * Load an existing backend conversation into a new tab
     */
    async openExistingConversation(backendConversationId: string) {
      try {
        // Check if this conversation is already open
        const existing = this.conversations.find(conv => 
          conv.id === backendConversationId
        );
        if (existing) {
          this.switchToConversation(existing.id);
          return;
        }
        
        // Load conversation details from backend
        const conversation = await agentConversationsService.getConversation(backendConversationId);
        
        const agent = {
          name: conversation.agentName,
          type: conversation.agentType,
          description: undefined
        };
        
        const now = new Date();
        
        // Create conversation object using the backend conversation ID
        const conversationCreatedAt = new Date(conversation.startedAt);
        const newConversation: Conversation = {
          id: backendConversationId, // Use the existing backend ID
          agent: agent,
          messages: [],
          isLoading: true,
          isSendingMessage: false,
          error: null,
          executionMode: null,
          isExecutionModeOverride: false,
          supportedExecutionModes: ['immediate'], // Default to immediate, will be updated after fetching agent card
          createdAt: conversationCreatedAt,
          lastActiveAt: now,
          title: this.createConversationTitle(agent, conversationCreatedAt)
        };
        
        // Add conversation and set as active
        this.conversations.push(newConversation);
        this.activeConversationId = backendConversationId;
        
        // Load conversation messages
        await this.loadConversationMessages(backendConversationId);
        
        // Update execution modes for this conversation
        await this.updateConversationExecutionModes(backendConversationId);
        
      } catch (error) {
        this.globalError = error instanceof Error ? error.message : 'Failed to load conversation';
      }
    },

    /**
     * Load messages for a specific conversation
     */
    async loadConversationMessages(conversationId: string) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation) return;

      conversation.isLoading = true;
      conversation.error = null;

      try {
        // Load tasks/messages for this conversation
        const taskPromise = tasksService.listTasks({
          conversationId,
          limit: 100,
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Tasks request timed out after 10 seconds')), 10000);
        });
        
        const tasks = await Promise.race([taskPromise, timeoutPromise]);

        // Convert tasks to messages
        conversation.messages = [];
        tasks.tasks.forEach(task => {
          // Add user message
          conversation.messages.push({
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
              
              // Handle different JSON response formats
              if (parsedResponse.success && parsedResponse.response) {
                // Format: {success: true, response: "content", metadata: {}}
                responseContent = String(parsedResponse.response);
                responseMetadata = { ...responseMetadata, ...parsedResponse.metadata };
              } else if (parsedResponse.response && typeof parsedResponse.response === 'string') {
                // Format: {response: "content"} - This is what we're seeing in the screenshot
                // Extract the markdown content directly from the response field
                responseContent = parsedResponse.response;
                responseMetadata = { ...responseMetadata };
              } else if (typeof parsedResponse === 'string') {
                // If the parsed response is itself a string, use it directly
                responseContent = parsedResponse;
              } else {
                // Fallback to the stringified parsed response
                responseContent = JSON.stringify(parsedResponse, null, 2);
              }
              
              console.log('📄 Parsed response content:', responseContent.substring(0, 200) + '...');
              
              // Check if this is a completed workflow response with embedded progress steps
              if (responseContent.includes('**📋 Requirements Document:**')) {
                const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
                if (docSectionMatch && docSectionMatch[1]) {
                  responseContent = docSectionMatch[1].trim();
                  console.log('📋 Extracted requirements document content:', responseContent.substring(0, 200) + '...');
                }
              }
            } catch (error) {
              // If parsing fails, use the raw response
              responseContent = String(task.response);
              console.log('📄 Raw response content:', responseContent.substring(0, 200) + '...');
              
              // Also check raw content for embedded document
              if (responseContent.includes('**📋 Requirements Document:**')) {
                const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
                if (docSectionMatch && docSectionMatch[1]) {
                  responseContent = docSectionMatch[1].trim();
                  console.log('📋 Extracted requirements document from raw content:', responseContent.substring(0, 200) + '...');
                }
              }
              
              // Also check if raw content has JSON data with the document
              if (responseContent.includes('"response":') && (responseContent.includes('# Technical Requirements Document') || responseContent.includes('# '))) {
                try {
                  // Try to extract the response field from JSON string
                  const jsonMatch = responseContent.match(/\{"response":"([^"]*(?:\\.[^"]*)*?)"\}/);
                  if (jsonMatch && jsonMatch[1]) {
                    let extractedContent = jsonMatch[1];
                    // Unescape JSON string
                    extractedContent = extractedContent
                      .replace(/\\n/g, '\n')
                      .replace(/\\"/g, '"')
                      .replace(/\\\\/g, '\\');
                    responseContent = extractedContent.trim();
                    console.log('🔧 Extracted content from raw JSON response:', responseContent.substring(0, 200) + '...');
                  } else {
                    // Fallback: try to find markdown content directly
                    const markdownMatch = responseContent.match(/(# [^\n]*[\s\S]*?)(?="|\}|$)/);
                    if (markdownMatch && markdownMatch[1]) {
                      responseContent = markdownMatch[1].trim();
                      console.log('🔧 Extracted markdown from raw response:', responseContent.substring(0, 200) + '...');
                    }
                  }
                } catch (error) {
                  console.warn('Failed to extract content from raw JSON response:', error);
                }
              }
            }

            conversation.messages.push({
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
        conversation.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      } catch (error) {
        conversation.error = error instanceof Error ? error.message : 'Failed to load conversation';
      } finally {
        conversation.isLoading = false;
      }
    },

    /**
     * Initialize execution mode for active conversation
     */
    initializeExecutionMode() {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      const preferencesStore = useUserPreferencesStore();
      const prefs = preferencesStore.preferences;
      
      // If user hasn't manually overridden, use preferences logic
      if (!activeConversation.isExecutionModeOverride) {
        let mode = prefs.defaultExecutionMode;
        console.log(`⚙️ Default execution mode from preferences: ${mode}`);
        
        // Check if agent supports the preferred mode, fall back to first supported mode if not
        const supportedModes = activeConversation.supportedExecutionModes;
        if (!supportedModes.includes(mode)) {
          mode = supportedModes[0]; // Use first supported mode as fallback
          console.log(`🔄 Agent doesn't support ${prefs.defaultExecutionMode}, falling back to: ${mode}`);
        }
        
        // Auto-switch to WebSocket for workflow agents if enabled and supported
        if (prefs.autoSwitchToWebSocketForWorkflows && 
            activeConversation.agent?.name === 'requirements_writer' &&
            supportedModes.includes('websocket')) {
          mode = 'websocket';
          console.log(`🔧 Auto-switched to WebSocket for workflow agent: ${activeConversation.agent?.name}`);
        }
        
        activeConversation.executionMode = mode;
        console.log(`✅ Final execution mode set to: ${mode} (supported: ${supportedModes.join(', ')})`);
      } else {
        console.log(`👤 User has overridden execution mode to: ${activeConversation.executionMode}`);
      }
    },

    /**
     * Manually set execution mode for active conversation
     */
    setExecutionMode(mode: 'immediate' | 'polling' | 'websocket') {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        // Check if the agent supports this mode
        if (!activeConversation.supportedExecutionModes.includes(mode)) {
          console.warn(`⚠️ Agent ${activeConversation.agent?.name} doesn't support ${mode} mode. Supported: ${activeConversation.supportedExecutionModes.join(', ')}`);
          return;
        }
        
        activeConversation.executionMode = mode;
        activeConversation.isExecutionModeOverride = true;
        console.log(`👤 User manually set execution mode to: ${mode}`);
      }
    },

    /**
     * Reset execution mode to preferences default for active conversation
     */
    resetExecutionMode() {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        activeConversation.isExecutionModeOverride = false;
        this.initializeExecutionMode();
      }
    },

    /**
     * Update execution modes for a conversation based on agent capabilities
     */
    async updateConversationExecutionModes(conversationId: string) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation?.agent) return;

      try {
        // Fetch current agents data to get execution modes
        const response = await fetch('/agents');
        if (!response.ok) return;
        
        const data = await response.json();
        const agentInfo = data.agents?.find((agent: any) => agent.name === conversation.agent?.name);
        
        if (agentInfo?.execution_modes && Array.isArray(agentInfo.execution_modes)) {
          // Map execution modes from agent data (handles 'real-time' -> 'websocket')
          const supportedModes = agentInfo.execution_modes.map((mode: string) => 
            mode === 'real-time' ? 'websocket' : mode as ('immediate' | 'polling' | 'websocket')
          ).filter((mode: string) => ['immediate', 'polling', 'websocket'].includes(mode));
          
          conversation.supportedExecutionModes = supportedModes;
          console.log(`🔄 Updated execution modes for ${conversation.agent.name}:`, supportedModes);
        }
      } catch (error) {
        console.warn('Failed to update execution modes for conversation:', error);
      }
    },

    /**
     * Get effective execution mode for display
     */
    getEffectiveExecutionMode(): 'immediate' | 'polling' | 'websocket' {
      const activeConversation = this.getActiveConversation();
      return activeConversation?.executionMode || 'polling'; // fallback to polling
    },

    /**
     * Send a message to the active conversation
     */
    async sendMessage(content: string) {
      console.log('🚀 sendMessage called with content:', content);
      
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        console.error('❌ No active conversation found');
        throw new Error('No active conversation');
      }

      console.log('✅ Active conversation found:', activeConversation.id);
      activeConversation.isSendingMessage = true;
      activeConversation.error = null;

      try {
        // Ensure conversation exists in database before creating tasks
        let conversationId = activeConversation.id;
        
        // Check if this is a new conversation (never been persisted)
        // If the conversation was loaded from backend, it will have tasks/messages
        // If it's brand new, it will only have the welcome message
        const hasOnlyWelcomeMessage = activeConversation.messages.length === 1 && 
          activeConversation.messages[0].metadata?.isWelcome;
        
        console.log('🔍 Conversation check:', {
          conversationId,
          messagesCount: activeConversation.messages.length,
          hasWelcomeMessage: activeConversation.messages[0]?.metadata?.isWelcome,
          hasOnlyWelcomeMessage,
          agentName: activeConversation.agent.name,
          agentType: activeConversation.agent.type
        });
        
        if (hasOnlyWelcomeMessage) {
          console.log('🔄 Creating new conversation in database...');
          // Create the conversation in the database first
          const backendConversation = await agentConversationsService.createConversation({
            agentName: activeConversation.agent.name,
            agentType: activeConversation.agent.type,
          });
          
          console.log('✅ Backend conversation created:', backendConversation.id);
          
          // Update the conversation ID to use the backend-generated one
          conversationId = backendConversation.id;
          activeConversation.id = conversationId;
          
          // Update the activeConversationId in the store
          this.activeConversationId = conversationId;
        } else {
          console.log('ℹ️ Using existing conversation ID:', conversationId);
        }

        console.log('💬 Adding user message to conversation:', conversationId);
        
        // Add user message immediately
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        activeConversation.messages.push(userMessage);

        // Check execution mode preference
        const effectiveMode = activeConversation.executionMode || 'polling';
        console.log(`🎯 Using execution mode: ${effectiveMode}`);
        
        // For WebSocket mode, generate task ID early and subscribe before sending request
        let preGeneratedTaskId: string | undefined;
        if (effectiveMode === 'websocket') {
          preGeneratedTaskId = generateUUID();
          // Subscribe to WebSocket immediately to catch all events
          await this.subscribeToTaskForConversation(conversationId, preGeneratedTaskId);
        }
        
        // Create task request with trimmed conversation history to prevent payload too large errors
        const relevantMessages = activeConversation.messages
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

        // Get agent type from active conversation
        const agentType = activeConversation.agent.type;
        
        console.log('🎯 Creating task with conversation ID:', conversationId);
        
        // Create agent task
        const task = await tasksService.createAgentTask(
          agentType,
          activeConversation.agent.name,
          {
            method: 'process',
            prompt: content,
            conversationId: conversationId, // Use the potentially updated conversationId
            conversationHistory,
            llmSelection,
            executionMode: effectiveMode,
            taskId: preGeneratedTaskId,
          }
        );

        console.log('📋 Task created:', {
          taskId: task.taskId,
          status: task.status,
          conversationId: task.conversationId,
          effectiveMode
        });

        // Handle response based on execution mode and task status
        if (task.status === 'pending' && effectiveMode === 'websocket') {
          // Task is async - create placeholder (already subscribed to WebSocket)
          this.createPlaceholderMessageForConversation(conversationId, task.taskId);
        } else if (task.status === 'pending' && effectiveMode === 'polling') {
          // Task is async - create placeholder and start polling
          console.log(`📊 Task ${task.taskId} is pending, starting polling mode`);
          this.createPlaceholderMessageForConversation(conversationId, task.taskId);
          this.startPollingTaskForConversation(conversationId, task.taskId);
        } else if (task.status === 'pending' && effectiveMode === 'immediate') {
          // Immediate mode - wait for task completion by polling once
          console.log(`⚡ Task ${task.taskId} is pending in immediate mode, waiting for completion`);
          this.createPlaceholderMessageForConversation(conversationId, task.taskId);
          
          // Poll until completion for immediate mode
          const waitForCompletion = async () => {
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max wait
            
            while (attempts < maxAttempts) {
              try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                const updatedTask = await tasksService.getTask(task.taskId);
                
                if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
                  console.log(`⚡ Task ${task.taskId} completed in immediate mode`);
                  this.handleTaskCompletionForConversation(conversationId, task.taskId);
                  return;
                }
                attempts++;
              } catch (error) {
                console.error(`⚡ Error waiting for task ${task.taskId}:`, error);
                break;
              }
            }
            
            // Fallback to polling if immediate wait times out
            console.log(`⚡ Task ${task.taskId} immediate mode timed out, falling back to polling`);
            this.startPollingTaskForConversation(conversationId, task.taskId);
          };
          
          waitForCompletion();
        } else {
          // Task completed immediately - use result from task creation response
          console.log(`✅ Task ${task.taskId} completed immediately, processing result`);
          console.log(`✅ Task creation response structure:`, {
            taskId: task.taskId,
            status: task.status,
            hasResult: !!task.result,
            hasResponse: !!(task as any).response,
            taskKeys: Object.keys(task)
          });
          
          // For immediate mode, the response is in the result field
          // Convert the result to the format expected by createResponseMessageForConversation
          let taskForProcessing: any = task;
          if (task.result && task.result.response && !(task as any).response) {
            console.log(`🔄 Converting result.response to response format for immediate mode`);
            taskForProcessing = {
              ...task,
              response: JSON.stringify(task.result)
            };
          }
          
          this.createResponseMessageForConversation(conversationId, taskForProcessing);
        }

      } catch (error) {
        activeConversation.error = error instanceof Error ? error.message : 'Failed to send message';
      } finally {
        activeConversation.isSendingMessage = false;
      }
    },

    /**
     * Create placeholder message for async tasks
     */
    createPlaceholderMessage(taskId: string) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      this.createPlaceholderMessageForConversation(activeConversation.id, taskId);
    },

    /**
     * Create placeholder message for specific conversation
     */
    createPlaceholderMessageForConversation(conversationId: string, taskId: string) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation) {
        console.error('❌ Cannot create placeholder - conversation not found:', conversationId);
        return;
      }
      
      console.log('📝 Creating placeholder message for task:', taskId);
      
      const placeholderMessage: AgentChatMessage = {
        id: `task-${taskId}`,
        role: 'assistant',
        content: 'Processing your request...',
        timestamp: new Date(),
        taskId,
        metadata: {
          isPlaceholder: true,
          agentName: conversation.agent.name
        }
      };
      conversation.messages.push(placeholderMessage);
    },

    /**
     * Create response message from completed task
     */
    createResponseMessage(task: any) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      this.createResponseMessageForConversation(activeConversation.id, task);
    },

    /**
     * Create response message for specific conversation
     */
    createResponseMessageForConversation(conversationId: string, task: any) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation) return;
      
      // Check if response message already exists for this task to prevent duplicates
      const existingResponseMessage = conversation.messages.find(msg => 
        msg.taskId === task.taskId && msg.role === 'assistant' && !msg.metadata?.isPlaceholder
      );
      
      if (existingResponseMessage) {
        console.log(`⚠️ Response message already exists for task ${task.taskId}, skipping createResponseMessage`);
        return;
      }
      
      console.log(`📝 Creating response message for task ${task.taskId}:`, {
        hasResponse: !!task.response,
        responseType: typeof task.response,
        responseLength: task.response?.length || 0,
        responsePreview: typeof task.response === 'string' ? task.response.substring(0, 200) : task.response ? JSON.stringify(task.response).substring(0, 200) : 'undefined'
      });
      
      let responseContent = 'Task completed successfully.';
      let responseMetadata = {};
      
      if (task.response) {
        try {
          // Try to parse JSON if it's a string
          let parsedResult;
          if (typeof task.response === 'string') {
            try {
              parsedResult = JSON.parse(task.response);
              console.log('📄 Parsed JSON response structure:', {
                type: typeof parsedResult,
                hasSuccess: 'success' in parsedResult,
                hasResponse: 'response' in parsedResult,
                keys: Object.keys(parsedResult)
              });
            } catch {
              // Not JSON, use as plain text
              console.log('📄 Response is plain text, using directly');
              responseContent = task.response;
              parsedResult = null;
            }
          } else {
            parsedResult = task.response;
            console.log('📄 Response is object:', Object.keys(parsedResult));
          }
          
          // Extract content from various possible formats
          if (parsedResult) {
            if (parsedResult.success && parsedResult.response) {
              // Format: { success: true, response: "content", metadata: {...} }
              responseContent = String(parsedResult.response);
              responseMetadata = parsedResult.metadata || {};
              console.log('📄 Using success.response format');
            } else if (parsedResult.response) {
              // Format: { response: "content" }
              responseContent = String(parsedResult.response);
              console.log('📄 Using response field');
            } else if (parsedResult.content) {
              // Format: { content: "content" }
              responseContent = String(parsedResult.content);
              console.log('📄 Using content field');
            } else if (parsedResult.result) {
              // Format: { result: "content" }
              responseContent = String(parsedResult.result);
              console.log('📄 Using result field');
            } else if (typeof parsedResult === 'string') {
              // Format: "content"
              responseContent = parsedResult;
              console.log('📄 Using direct string');
            } else {
              // Fallback: stringify the whole object
              responseContent = JSON.stringify(parsedResult, null, 2);
              console.log('📄 Using stringified object as fallback');
            }
          }
        } catch (error) {
          console.error('📄 Error parsing response:', error);
          responseContent = String(task.response);
        }
      } else {
        console.warn('📄 Task has no response content');
      }

      const responseMessage: AgentChatMessage = {
        id: `assistant-${task.taskId}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        taskId: task.taskId,
        metadata: responseMetadata
      };
      conversation.messages.push(responseMessage);
    },

    /**
     * Simplified WebSocket subscription for a task
     */
    async subscribeToTask(taskId: string) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      await this.subscribeToTaskForConversation(activeConversation.id, taskId);
    },

    /**
     * WebSocket subscription for a specific conversation task
     */
    async subscribeToTaskForConversation(conversationId: string, taskId: string) {
      // Subscribe to task with status change callback for new TaskStatusService events
      await websocketService.subscribeToTask(taskId, (statusEvent) => {
        this.handleTaskStatusUpdateForConversation(conversationId, taskId, {
          status: statusEvent.status,
          progress: statusEvent.progress,
          progressMessage: statusEvent.message,
          data: statusEvent.metadata
        });
      });

      // Set up completion/failure event handlers
      websocketService.onTaskEvent('completed', (event) => {
        console.log(`🎯 WebSocket completion event received for task ${event.taskId}`, event);
        if (event.taskId === taskId) {
          console.log(`🎯 WebSocket completion event matches subscribed task ${taskId}, calling completion handler`);
          this.handleTaskCompletionForConversation(conversationId, taskId);
        } else {
          console.log(`🎯 WebSocket completion event for different task ${event.taskId}, subscribed to ${taskId}`);
        }
      });

      websocketService.onTaskEvent('failed', (event) => {
        if (event.taskId === taskId) {
          this.handleTaskCompletionForConversation(conversationId, taskId);
        }
      });

      // Legacy workflow step handlers (for backward compatibility)
      websocketService.onWorkflowStep(taskId, (stepEvent) => {
        this.handleWorkflowStepUpdateForConversation(conversationId, taskId, stepEvent);
      });
    },

    /**
     * Start polling for task updates using accumulated messages
     */
    async startPollingTask(taskId: string) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      await this.startPollingTaskForConversation(activeConversation.id, taskId);
    },

    /**
     * Start polling for task updates for specific conversation
     */
    async startPollingTaskForConversation(conversationId: string, taskId: string) {
      console.log(`🔄 Starting polling for task ${taskId} in conversation ${conversationId}`);
      const userPreferences = useUserPreferencesStore();
      const interval = userPreferences.preferences.pollingInterval * 1000;
      console.log(`🔄 Polling interval: ${interval}ms`);
      let lastMessageCount = 0;
      
      const pollInterval = setInterval(async () => {
        try {
          // Get full task for completion check (using same API as completion handler)
          const fullTask = await tasksService.getTask(taskId);
          console.log(`🔍 Task ${taskId} status check:`, {
            status: fullTask.status,
            hasResponse: !!fullTask.response,
            responseLength: fullTask.response?.length || 0,
            timestamp: new Date().toISOString()
          });
          
          if (fullTask.status === 'completed' || fullTask.status === 'failed') {
            console.log(`🏁 Task ${taskId} completed with status: ${fullTask.status}, stopping polling`);
            clearInterval(pollInterval);
            this.handleTaskCompletionForConversation(conversationId, taskId);
            return;
          }
          
          // Also get task status for progress info (backwards compatibility)
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
            this.handleTaskStatusUpdateForConversation(conversationId, taskId, {
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
          console.error('Polling error:', error);
          clearInterval(pollInterval);
        }
      }, interval);
    },

    /**
     * Handle task status updates from WebSocket or polling
     */
    handleTaskStatusUpdate(taskId: string, statusUpdate: any) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      this.handleTaskStatusUpdateForConversation(activeConversation.id, taskId, statusUpdate);
    },

    /**
     * Handle task status updates for specific conversation
     */
    handleTaskStatusUpdateForConversation(conversationId: string, taskId: string, statusUpdate: any) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation) return;
      
      const messageIndex = conversation.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = conversation.messages[messageIndex];
        
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
                (step: any) => step.index === stepIndex
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
          
          message.content = progressContent;
          message.metadata = { 
            ...message.metadata, 
            ...statusUpdate.data,
            lastUpdated: new Date().toISOString()
          };
          
          // Trigger reactivity
          conversation.messages[messageIndex] = { ...message };
        }
      }
    },

    /**
     * Load existing conversation (legacy method - now handled by openExistingConversation)
     */
    async loadConversation(conversationId: string) {
      await this.openExistingConversation(conversationId);
    },

    /**
     * Clear current chat session (closes active conversation)
     */
    clearChat() {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        this.closeConversation(activeConversation.id);
      }
      this.globalError = null;
    },

    /**
     * Set global error state
     */
    setError(error: string | null) {
      this.globalError = error;
    },

    /**
     * Set error for active conversation
     */
    setConversationError(error: string | null) {
      const activeConversation = this.getActiveConversation();
      if (activeConversation) {
        activeConversation.error = error;
      }
    },


    /**
     * Handle task completion - simplified version
     */
    async handleTaskCompletion(taskId: string) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      await this.handleTaskCompletionForConversation(activeConversation.id, taskId);
    },

    /**
     * Handle task completion for specific conversation
     */
    async handleTaskCompletionForConversation(conversationId: string, taskId: string) {
      try {
        console.log(`🎯 Handling completion for task ${taskId} in conversation ${conversationId}`);
        
        const conversation = this.getConversationById(conversationId);
        if (!conversation) {
          console.log(`❌ Conversation ${conversationId} not found, aborting completion handler`);
          return;
        }
        
        // Check if task completion is already being processed or completed
        const existingMessage = conversation.messages.find(msg => 
          msg.taskId === taskId && msg.role === 'assistant'
        );
        
        if (existingMessage?.metadata?.isCompleted) {
          console.log(`⚠️ Task ${taskId} completion already processed, ignoring duplicate call`);
          return;
        }
        
        if (existingMessage?.metadata?.processingCompletion) {
          console.log(`⚠️ Task ${taskId} completion already in progress, ignoring duplicate call`);
          return;
        }
        
        // Mark as processing to prevent concurrent completions
        if (existingMessage) {
          existingMessage.metadata = { 
            ...existingMessage.metadata, 
            processingCompletion: true 
          };
        }
        
        // Get the completed task with full response
        const completedTask = await tasksService.getTask(taskId);
        console.log(`📋 Task ${taskId} full details:`, {
          id: completedTask.id,
          status: completedTask.status,
          hasResponse: !!completedTask.response,
          responseLength: completedTask.response?.length || 0,
          responsePreview: completedTask.response?.substring(0, 100),
          timestamp: new Date().toISOString()
        });
        
        // Skip processing if task is not actually completed or has no response yet
        if (completedTask.status !== 'completed') {
          console.log(`⚠️ Task ${taskId} is not completed (status: ${completedTask.status}), skipping completion handler`);
          // Clear processing flag
          if (existingMessage?.metadata) {
            existingMessage.metadata.processingCompletion = false;
          }
          return;
        }
        
        if (!completedTask.response || completedTask.response === 'null' || completedTask.response.trim() === '') {
          console.log(`⚠️ Task ${taskId} has no response content, skipping completion handler`);
          // Clear processing flag
          if (existingMessage?.metadata) {
            existingMessage.metadata.processingCompletion = false;
          }
          return;
        }
        
        // Find and replace placeholder message
        const placeholderIndex = conversation.messages.findIndex(msg => 
          msg.taskId === taskId && msg.metadata?.isPlaceholder
        );
        
        if (placeholderIndex >= 0) {
          // Update the existing placeholder message with final result instead of replacing
          const placeholderMessage = conversation.messages[placeholderIndex];
          
          // Extract the final deliverable using the same logic as createResponseMessageForConversation
          
          console.log(`🔄 Parsing completion response for task ${taskId}:`, {
            hasResponse: !!completedTask.response,
            responseType: typeof completedTask.response,
            responseLength: completedTask.response?.length || 0,
            responsePreview: typeof completedTask.response === 'string' ? completedTask.response.substring(0, 200) : completedTask.response ? JSON.stringify(completedTask.response).substring(0, 200) : 'undefined'
          });
          
          let finalContent = '';
          
          if (completedTask.response) {
            try {
              // Try to parse JSON if it's a string
              let parsedResult;
              if (typeof completedTask.response === 'string') {
                try {
                  parsedResult = JSON.parse(completedTask.response);
                  console.log('🔄 Parsed JSON completion response structure:', {
                    type: typeof parsedResult,
                    hasSuccess: 'success' in parsedResult,
                    hasResponse: 'response' in parsedResult,
                    keys: Object.keys(parsedResult)
                  });
                } catch {
                  // Not JSON, use as plain text
                  console.log('🔄 Completion response is plain text, using directly');
                  finalContent = completedTask.response;
                  parsedResult = null;
                }
              } else {
                parsedResult = completedTask.response;
                console.log('🔄 Completion response is object:', Object.keys(parsedResult));
              }
              
              // Extract content from various possible formats
              if (parsedResult) {
                if (parsedResult.success && parsedResult.response) {
                  // Format: { success: true, response: "content", metadata: {...} }
                  finalContent = String(parsedResult.response);
                  console.log('🔄 Using success.response format for completion');
                } else if (parsedResult.response) {
                  // Format: { response: "content" }
                  finalContent = String(parsedResult.response);
                  console.log('🔄 Using response field for completion');
                } else if (parsedResult.content) {
                  // Format: { content: "content" }
                  finalContent = String(parsedResult.content);
                  console.log('🔄 Using content field for completion');
                } else if (parsedResult.result) {
                  // Format: { result: "content" }
                  finalContent = String(parsedResult.result);
                  console.log('🔄 Using result field for completion');
                } else if (typeof parsedResult === 'string') {
                  // Format: "content"
                  finalContent = parsedResult;
                  console.log('🔄 Using direct string for completion');
                } else {
                  // Fallback: stringify the whole object
                  finalContent = JSON.stringify(parsedResult, null, 2);
                  console.log('🔄 Using stringified object as fallback for completion');
                }
              }
            } catch (error) {
              console.error('🔄 Error parsing completion response:', error);
              finalContent = String(completedTask.response);
            }
          }
          
          if (!finalContent || finalContent.trim() === '') {
            console.warn('🔄 No final content extracted from completion response');
            finalContent = 'No content was generated. Please check the logs for more details.';
          }
          
          // Clean up the existing content and append final deliverable
          let existingContent = placeholderMessage.content;
          
          // Remove any "Processing final response..." indicator
          existingContent = existingContent.replace(/🔄 Processing final response\.\.\./g, '').trim();
          
          // Check if deliverable has already been added (prevent duplicate deliverables)
          const deliverableAlreadyAdded = existingContent.includes('**📋 Requirements Document:**') ||
                                        placeholderMessage.metadata?.isCompleted;
          
          if (!deliverableAlreadyAdded) {
            // Append the actual requirements document
            placeholderMessage.content = existingContent + `\n\n---\n\n**📋 Requirements Document:**\n\n${finalContent}`;
            placeholderMessage.metadata = {
              ...placeholderMessage.metadata,
              isPlaceholder: false, // No longer a placeholder
              isCompleted: true,
              completedAt: new Date().toISOString(),
              processingCompletion: false // Clear processing flag
            };
            console.log(`✅ Deliverable added to task ${taskId} for the first time`);
          } else {
            console.log(`⚠️ Deliverable already exists for task ${taskId}, skipping duplicate`);
            // Just update the metadata to ensure it's marked as completed
            placeholderMessage.metadata = {
              ...placeholderMessage.metadata,
              isPlaceholder: false,
              isCompleted: true,
              processingCompletion: false // Clear processing flag
            };
          }
          
          // Trigger reactivity
          conversation.messages[placeholderIndex] = { ...placeholderMessage };
        } else {
          // Add new message if no placeholder found
          this.createResponseMessageForConversation(conversationId, completedTask);
        }
        
        // Cleanup subscriptions
        websocketService.unsubscribeFromTask(taskId);
        
      } catch (error) {
        const conversation = this.getConversationById(conversationId);
        if (conversation) {
          conversation.error = error instanceof Error ? error.message : 'Failed to load task result';
          
          // Clear processing flag on error
          const existingMessage = conversation.messages.find(msg => 
            msg.taskId === taskId && msg.role === 'assistant'
          );
          if (existingMessage?.metadata) {
            existingMessage.metadata.processingCompletion = false;
          }
        }
      }
    },

    /**
     * Handle workflow step updates - accumulating version
     */
    handleWorkflowStepUpdate(taskId: string, stepEvent: any) {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;
      
      this.handleWorkflowStepUpdateForConversation(activeConversation.id, taskId, stepEvent);
    },

    /**
     * Handle workflow step updates for specific conversation
     */
    handleWorkflowStepUpdateForConversation(conversationId: string, taskId: string, stepEvent: any) {
      const conversation = this.getConversationById(conversationId);
      if (!conversation) return;
      
      const messageIndex = conversation.messages.findIndex(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );
      
      if (messageIndex >= 0) {
        const message = conversation.messages[messageIndex];
        
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
          
          message.content = accumulatedContent;
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
        conversation.messages[messageIndex] = { ...message };
      }
    },
  },

  getters: {
    hasCurrentAgent: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return !!activeConversation?.agent;
    },
    hasActiveConversation: (state) => !!state.activeConversationId,
    canSendMessage: (state) => {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return !!activeConversation?.agent && !activeConversation?.isSendingMessage;
    },
  },
});