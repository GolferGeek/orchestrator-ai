import agentConversationsService, { type AgentType } from '@/services/agentConversationsService';
import agent2AgentConversationsService from '@/services/agent2AgentConversationsService';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAuthStore } from '@/stores/authStore';
import { tasksService } from '@/services/tasksService';
import type { AgentConversation, AgentChatMessage, ExecutionMode, Agent, AgentChatMode } from '@/types/conversation';
import { DEFAULT_CHAT_MODES } from '@/types/conversation';
import { formatAgentName } from '@/utils/caseConverter';

/**
 * Generate a UUID - polyfill for crypto.randomUUID()
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for browsers that don't support crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Service for managing conversations and backend persistence
 */
export class ConversationService {

  /**
   * Create a new conversation in the backend
   */
  async createConversation(agent: Agent): Promise<string> {
    // Get organization slug from authStore - the canonical source of truth
    const authStore = useAuthStore();
    const orgSlug = authStore.currentNamespace || 'demo';

    // All agents now use the Agent2Agent conversation service
    console.log('🔍 [ConversationService.createConversation] Agent routing:', {
      agentName: agent.name,
      agentType: agent.type,
      orgSlug: orgSlug,
      approach: 'agent2agent-service'
    });

    // Use dedicated Agent2Agent conversation service for all agents
    console.log('🚀 [ConversationService] Using Agent2Agent service');
    const conversationId = generateUUID(); // Generate ID upfront
    const createdAt = new Date();
    const title = this.createConversationTitle(agent, createdAt);

    const backendConversation = await agent2AgentConversationsService.createConversation({
      agentName: agent.name,
      agentType: agent.type as AgentType, // Required for backend validation
      organizationSlug: orgSlug, // Use authStore.currentNamespace as canonical source
      conversationId: conversationId, // Pass the generated ID
      metadata: {
        source: 'frontend',
        title: title, // Include the formatted title
      },
    });

    console.log('✅ [ConversationService.createConversation] Created conversation:', backendConversation.id);
    return backendConversation.id;
  }

  /**
   * Load conversation messages from backend by reconstructing from tasks
   */
  async loadConversationMessages(conversationId: string): Promise<AgentChatMessage[]> {


    try {
      // Load all tasks for this conversation
      const tasksResponse = await tasksService.listTasks({
        conversationId: conversationId,
        limit: 100 // Load up to 100 tasks for this conversation
      });

      const tasks = tasksResponse.tasks || [];

      console.log(`📋 [loadConversationMessages] Loaded ${tasks.length} tasks for conversation ${conversationId}`);
      if (tasks.length > 0) {
        console.log('📋 [loadConversationMessages] First task:', tasks[0]);
      }

      
      // Load deliverables for this conversation to link them to messages
      const deliverables: unknown[] = [];
      try {
        const { deliverablesService } = await import('@/services/deliverablesService');
        const conversationDeliverables = await deliverablesService.getConversationDeliverables(conversationId);
        deliverables.push(...conversationDeliverables);

      } catch {
        // Failed to load conversation deliverables
      }
      
      // Create maps for linking deliverables to messages
      const messageDeliverableMap = new Map<string, string>(); // message_id -> deliverableId
      const taskDeliverableMap = new Map<string, string>(); // task_id -> deliverableId
      
      // First, extract deliverableId from task responses and create task->deliverable mapping
      tasks.forEach(task => {
        if (task.response && task.status === 'completed') {
          try {
            const parsedResponse = JSON.parse(task.response);
            if (parsedResponse.deliverableId) {
              taskDeliverableMap.set(task.id, parsedResponse.deliverableId);
            }
          } catch {
            // Could not parse task response to extract deliverableId
          }
        }
      });
      
      deliverables.forEach(deliverable => {
        // Keep the existing logic for backwards compatibility
        if (deliverable.message_id) {
          messageDeliverableMap.set(deliverable.message_id, deliverable.id);
        }
        if (deliverable.metadata?.taskId) {
          taskDeliverableMap.set(deliverable.metadata.taskId, deliverable.id);
        }
      });
      
      const messages: AgentChatMessage[] = [];
      
      // Convert each task to a pair of messages (user prompt + assistant response)
      for (const task of tasks) {
        // Create user message from task prompt
        if (task.prompt) {
          const userMessage: AgentChatMessage = {
            id: `user-${task.id}`,
            role: 'user',
            content: task.prompt,
            timestamp: new Date(task.createdAt),
            taskId: task.id,
            metadata: {
              originalTaskData: {
                method: task.method,
                params: task.params,
                status: task.status
              }
            }
          };
          messages.push(userMessage);
        }
        
        // Create assistant message based on task status
        if (task.status === 'completed' && task.response) {
          // Parse the JSON response to extract the actual content and metadata
          let responseContent = task.response;
          let mergedResponseMetadata: Record<string, unknown> = {};
          let planId: string | undefined;

          try {
            const parsedResponse = typeof task.response === 'string'
              ? JSON.parse(task.response)
              : task.response;

            // Detect if this is a plan task and extract planId
            const taskMode = task.params?.mode || task.method?.includes('plan') ? 'plan' : null;
            if (taskMode === 'plan' || parsedResponse?.planId || parsedResponse?.result?.planId) {
              planId = parsedResponse?.planId || parsedResponse?.result?.planId || parsedResponse?.payload?.planId;
            }

            // Extract content - try multiple paths for different response formats
            let extractedContent = null;
            let hasDeliverable = false;

            // Check if this response has a deliverable (check for both deliverableId and deliverable object)
            if (parsedResponse?.deliverableId ||
                parsedResponse?.result?.deliverableId ||
                parsedResponse?.payload?.deliverableId ||
                parsedResponse?.deliverable ||
                parsedResponse?.result?.deliverable ||
                parsedResponse?.payload?.content?.deliverable) {
              hasDeliverable = true;
            }

            // For plan tasks, use a simple message instead of the full plan content
            if (planId) {
              extractedContent = parsedResponse?.payload?.content?.message ||
                                parsedResponse?.result?.content?.message ||
                                parsedResponse?.content?.message ||
                                'Plan created successfully';
            }
            // For build tasks with deliverables, use a simple message
            else if (hasDeliverable) {
              extractedContent = parsedResponse?.payload?.content?.message ||
                                parsedResponse?.result?.content?.message ||
                                parsedResponse?.content?.message ||
                                'Deliverable created successfully';
            }
            // For other tasks, extract the message content
            else {
              // Try payload.content.message (new format from screenshot)
              if (parsedResponse?.payload?.content?.message) {
                extractedContent = parsedResponse.payload.content.message;
              }
              // Try result.content.message (agent2agent format)
              else if (parsedResponse?.result?.content?.message) {
                extractedContent = parsedResponse.result.content.message;
              }
              // Try content.message
              else if (parsedResponse?.content?.message) {
                extractedContent = parsedResponse.content.message;
              }
              // Try message field directly
              else if (parsedResponse?.message) {
                extractedContent = parsedResponse.message;
              }
              // Try response or content fields
              else if (parsedResponse?.response) {
                extractedContent = parsedResponse.response;
              }
              else if (parsedResponse?.content) {
                extractedContent = parsedResponse.content;
              }
            }

            // Use extracted content or fall back to full response
            responseContent = extractedContent || parsedResponse;

            // Only stringify if it's still an object (shouldn't be if we extracted correctly)
            if (typeof responseContent === 'object') {
              console.log('[loadConversationMessages] responseContent is object, hasDeliverable:', hasDeliverable, 'planId:', planId);
              console.log('[loadConversationMessages] responseContent keys:', Object.keys(responseContent).slice(0, 10));

              // If this is a deliverable or plan response without a message, use a simple fallback
              if (hasDeliverable) {
                console.log('[loadConversationMessages] Using deliverable fallback message');
                responseContent = 'Deliverable created';
              } else if (planId) {
                console.log('[loadConversationMessages] Using plan fallback message');
                responseContent = 'Plan created';
              } else {
                console.log('[loadConversationMessages] Stringifying response');
                responseContent = JSON.stringify(responseContent, null, 2);
              }
            }

            // Merge backend-provided metadata (provider/model/usage, etc.)
            if (parsedResponse && typeof parsedResponse === 'object') {
              console.log('[loadConversationMessages] Extracting metadata from response for task', task.id);

              // Extract metadata from various locations
              // 1. Top-level provider/model/usage fields
              if (parsedResponse.provider || parsedResponse.model || parsedResponse.usage) {
                console.log('[loadConversationMessages] Found metadata at top level:', {
                  provider: parsedResponse.provider,
                  model: parsedResponse.model
                });
                mergedResponseMetadata = {
                  ...mergedResponseMetadata,
                  provider: parsedResponse.provider,
                  model: parsedResponse.model,
                  usage: parsedResponse.usage
                };
              }

              // 2. result.metadata (agent2agent format)
              if (parsedResponse.result?.metadata) {
                console.log('[loadConversationMessages] Found result.metadata:', parsedResponse.result.metadata);
                mergedResponseMetadata = { ...mergedResponseMetadata, ...parsedResponse.result.metadata };
              }

              // 3. Top-level metadata object
              if (parsedResponse.metadata) {
                console.log('[loadConversationMessages] Found top-level metadata:', parsedResponse.metadata);
                mergedResponseMetadata = { ...mergedResponseMetadata, ...parsedResponse.metadata };
              }

              // 4. payload.metadata
              if (parsedResponse.payload?.metadata) {
                console.log('[loadConversationMessages] Found payload.metadata:', parsedResponse.payload.metadata);
                mergedResponseMetadata = { ...mergedResponseMetadata, ...parsedResponse.payload.metadata };
              }

              console.log('[loadConversationMessages] Final merged metadata:', mergedResponseMetadata);
            }
          } catch {
            // Keep raw response
            responseContent = task.response;
          }

          // Completed task - create assistant message with parsed response and merged metadata
          const assistantMessageId = `assistant-${task.id}`;

          // For API agents that don't use LLMs, provide defaults
          const taskMode = task.params?.mode || (task.method?.includes('plan') ? 'plan' : task.method?.includes('build') ? 'build' : 'converse');

          // Check if we have LLM metadata from task storage
          const storedLlmSelection = task.llmMetadata?.originalLLMSelection;
          if (storedLlmSelection && !mergedResponseMetadata.provider && !mergedResponseMetadata.model) {
            // Use stored LLM selection if response didn't include it
            // LlmSelection uses 'provider' and 'model' fields
            mergedResponseMetadata.provider = storedLlmSelection.provider;
            mergedResponseMetadata.model = storedLlmSelection.model;
            console.log('[loadConversationMessages] Using stored LLM selection:', mergedResponseMetadata);
          }

          const hasLlmMetadata = mergedResponseMetadata.provider || mergedResponseMetadata.model || (task.llmMetadata && Object.keys(task.llmMetadata).length > 0);

          const assistantMessage: AgentChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date(task.completedAt || task.updatedAt),
            taskId: task.id,
            metadata: {
              isCompleted: true,
              completedAt: task.completedAt,
              responseMetadata: task.responseMetadata,
              // Include mode information
              mode: taskMode,
              // Include LLM metadata stored with the task (contains original selection)
              ...(task.llmMetadata ? { llmMetadata: task.llmMetadata } : {}),
              // Include provider/model/usage from response metadata for accurate display
              ...mergedResponseMetadata,
              // For API agents without LLM metadata, provide defaults
              ...(!hasLlmMetadata && taskMode === 'build' ? {
                provider: 'n8n',
                model: 'workflow'
              } : {}),
              originalTaskData: {
                method: task.method,
                status: task.status,
                progress: task.progress,
              },
            },
          };

          // Check if this message has an associated deliverable
          // Try multiple sources: maps, response data
          let deliverableId = messageDeliverableMap.get(assistantMessageId);
          if (!deliverableId) {
            deliverableId = taskDeliverableMap.get(task.id);
          }
          // Also check if deliverableId is in the parsed response
          if (!deliverableId && task.response) {
            try {
              const parsedResponse = typeof task.response === 'string' ? JSON.parse(task.response) : task.response;
              deliverableId = parsedResponse?.deliverableId ||
                             parsedResponse?.result?.deliverableId ||
                             parsedResponse?.payload?.deliverableId;
            } catch {
              // Ignore parse errors
            }
          }

          if (deliverableId) {
            assistantMessage.deliverableId = deliverableId;
            // Also add to metadata for easier access
            assistantMessage.metadata.deliverableId = deliverableId;
          }

          // Check if this message has an associated plan
          if (planId) {
            assistantMessage.planId = planId;
          }

          messages.push(assistantMessage);
          
        } else if (['pending', 'running'].includes(task.status)) {
          // Active task - create placeholder message
          const placeholderMessage: AgentChatMessage = {
            id: `placeholder-${task.id}`,
            role: 'assistant',
            content: task.progressMessage || 'Processing your request...',
            timestamp: new Date(task.startedAt || task.createdAt),
            taskId: task.id,
            metadata: {
              isPlaceholder: true,
              processing_type: 'active_task',
              originalTaskData: {
                method: task.method,
                status: task.status,
                progress: task.progress,
                progressMessage: task.progressMessage
              },
              lastUpdated: task.updatedAt
            }
          };
          messages.push(placeholderMessage);
          
        } else if (task.status === 'failed') {
          // Failed task - create error message
          const errorMessage: AgentChatMessage = {
            id: `error-${task.id}`,
            role: 'assistant',
            content: `❌ Task failed: ${task.errorMessage || 'Unknown error occurred'}`,
            timestamp: new Date(task.completedAt || task.updatedAt),
            taskId: task.id,
            metadata: {
              isCompleted: true,
              isError: true,
              errorCode: task.errorCode,
              errorMessage: task.errorMessage,
              errorData: task.errorData,
              originalTaskData: {
                method: task.method,
                status: task.status,
                progress: task.progress
              }
            }
          };
          messages.push(errorMessage);
        }
      }
      
      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      

      
      // Log active tasks for restoration
      const activeTasks = tasks.filter(t => ['pending', 'running'].includes(t.status));
      if (activeTasks.length > 0) {
        // Log active tasks for debugging
      }
      
      return messages;
      
    } catch (error) {
console.error(`Failed to load messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Get active tasks for a conversation that need WebSocket restoration
   */
  async getActiveTasksForConversation(conversationId: string): Promise<Array<{
    taskId: string;
    status: string;
    progress: number;
    progressMessage?: string;
  }>> {
    try {
      const tasksResponse = await tasksService.listTasks({ 
        conversationId: conversationId,
        status: 'pending,running' // Filter for active tasks only
      });
      
      const activeTasks = (tasksResponse.tasks || [])
        .filter(task => ['pending', 'running'].includes(task.status))
        .map(task => ({
          taskId: task.id,
          status: task.status,
          progress: task.progress,
          progressMessage: task.progressMessage
        }));
      

      return activeTasks;
      
    } catch (error) {
console.error(`Failed to get active tasks for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Update execution modes for a conversation based on agent capabilities
   */
  async updateConversationExecutionModes(conversation: AgentConversation): Promise<void> {
    if (!conversation.agent) return;

    console.log('🔍 [ConversationService.updateConversationExecutionModes] Starting with agent:', {
      name: conversation.agent.name,
      execution_profile: conversation.agent.execution_profile,
      execution_capabilities: conversation.agent.execution_capabilities
    });

    try {
      // Use the existing agents store instead of making a separate API call
      const agentsStore = useAgentsStore();
      
      // Find agent info from the store
      const agentInfo = agentsStore.availableAgents.find(agent => agent.name === conversation.agent?.name);
      
      console.log('🔍 [ConversationService.updateConversationExecutionModes] Found agentInfo:', {
        found: !!agentInfo,
        agentInfo: agentInfo ? {
          name: agentInfo.name,
          execution_profile: agentInfo.execution_profile,
          execution_capabilities: agentInfo.execution_capabilities
        } : null
      });

      const normalizeMode = (mode: string): ExecutionMode | null => {
        switch (mode) {
          case 'immediate':
          case 'polling':
          case 'real-time':
          case 'auto':
            return mode;
          case 'websocket':
            return 'real-time';
          default:
            return null;
        }
      };

      if (agentInfo?.execution_modes && Array.isArray(agentInfo.execution_modes)) {
        // Use execution modes directly from agent data
        const rawModes = agentInfo.execution_modes;

        const supportedModes = rawModes
          .map((mode: string) => normalizeMode(mode))
          .filter((mode): mode is ExecutionMode => mode !== null);

        conversation.supportedExecutionModes = supportedModes.length > 0 ? supportedModes : ['immediate'];
      } else {
        // Default to immediate mode if no execution modes specified
        conversation.supportedExecutionModes = ['immediate'];
      }

      const defaultAllowed: AgentChatMode[] = [...DEFAULT_CHAT_MODES];
      let allowedChatModes = [...defaultAllowed];

      // Always use execution fields from the original agent object (from hierarchy)
      // The agentsStore.availableAgents may have stale data
      const profile = conversation.agent.execution_profile;
      const capabilities = conversation.agent.execution_capabilities;

      console.log('🔍 [ConversationService.updateConversationExecutionModes] Final execution fields:', {
        profile,
        capabilities,
        source: 'originalAgent',
        agentStoreHadFields: !!(agentInfo?.execution_profile)
      });

      conversation.executionProfile = profile;
      conversation.executionCapabilities = capabilities;

      if (profile === 'conversation_only') {
        allowedChatModes = ['converse'];
      } else {
        if (capabilities?.can_plan === false) {
          allowedChatModes = allowedChatModes.filter(mode => mode !== 'plan');
        }

        if (capabilities?.can_build === false) {
          allowedChatModes = allowedChatModes.filter(mode => mode !== 'build');
        }
      }


      console.log('🔍 [ConversationService.updateConversationExecutionModes] Final allowedChatModes:', allowedChatModes);
      conversation.allowedChatModes = allowedChatModes;
      if (!allowedChatModes.includes(conversation.chatMode)) {
        // Prefer 'converse' mode if available, otherwise use first allowed mode
        conversation.chatMode = allowedChatModes.includes('converse') ? 'converse' : (allowedChatModes[0] || DEFAULT_CHAT_MODES[0]);
      }
    } catch {

      conversation.supportedExecutionModes = ['immediate'];
      if (!conversation.allowedChatModes || conversation.allowedChatModes.length === 0) {
        conversation.allowedChatModes = [...DEFAULT_CHAT_MODES];
      }
    }
  }

  /**
   * Create conversation title based on agent and timestamp
   */
  createConversationTitle(agent: Agent, createdAt: Date): string {
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
    if (daysDiff < 7) {
      const dayName = createdAt.toLocaleDateString([], { weekday: 'short' });
      const time = createdAt.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      return `${agentDisplayName} ${dayName} ${time}`;
    }
    
    // For older conversations, show full date and time
    const dateTime = createdAt.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${agentDisplayName} ${dateTime}`;
  }

  /**
   * Create a new conversation object
   */
  createConversationObject(agent: Agent, createdAt: Date = new Date()): AgentConversation {
    // Extract and map execution modes from agent
    // Check both root level and context.execution_modes (backend format)
    const agentWithContext = agent as Agent & { context?: { execution_modes?: string[] } };
    const rawModes = agent.execution_modes ||
                     agentWithContext.context?.execution_modes ||
                     ['immediate'];

    console.log('🔍 [createConversationObject] Agent:', agent.name, 'rawModes:', rawModes);

    const normalizeMode = (mode: string): ExecutionMode | null => {
      switch (mode) {
        case 'immediate':
        case 'polling':
        case 'real-time':
        case 'auto':
          return mode;
        case 'websocket':
          return 'real-time';
        default:
          return null;
      }
    };

    const mappedModes = rawModes
      .map((mode: string) => normalizeMode(mode))
      .filter((mode): mode is ExecutionMode => mode !== null) as ExecutionMode[];

    const supportedModes: ExecutionMode[] = mappedModes.length > 0 ? mappedModes : ['immediate'];

    // Default to preferred ordering: auto > real-time > polling > immediate
    const defaultExecutionMode: ExecutionMode =
      (['auto', 'real-time', 'polling', 'immediate'] as ExecutionMode[]).find((mode) =>
        supportedModes.includes(mode),
      ) ?? supportedModes[0];

    console.log('✅ [createConversationObject] supportedModes:', supportedModes, 'defaultExecutionMode:', defaultExecutionMode);

    return {
      id: generateUUID(),
      agent,
      messages: [],
      createdAt,
      lastActiveAt: createdAt,
      chatMode: DEFAULT_CHAT_MODES[0],
      allowedChatModes: [...DEFAULT_CHAT_MODES],
      executionMode: defaultExecutionMode,
      supportedExecutionModes: supportedModes,
      executionProfile: agent.execution_profile,
      executionCapabilities: agent.execution_capabilities,
      title: this.createConversationTitle(agent, createdAt), // Use proper title with timestamp
      isLoading: false,
      isSendingMessage: false,
      isExecutionModeOverride: false,
      latestPlanId: null,
      latestPlan: null,
      plans: [],
      orchestrationRuns: [],
      savedOrchestrations: [],
      streamSubscriptions: {},
      activeTaskId: null,
    };
  }

  /**
   * Check if conversation exists in backend
   */
  async conversationExists(conversationId: string): Promise<boolean> {
    try {
      const conversation = await agentConversationsService.getConversation(conversationId);
      return !!conversation;
    } catch {
      return false;
    }
  }

  /**
   * Get conversation from backend
   */
  async getBackendConversation(conversationId: string): Promise<AgentConversation> {
    try {
      return await agentConversationsService.getConversation(conversationId);
    } catch (error) {
console.error(`Failed to get conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Persist conversation state to backend
   */
  async persistConversationState(_conversation: AgentConversation): Promise<void> {
    try {
      // This could be extended to save conversation metadata
      // For now, we don't need to persist the entire state
      // The messages are persisted separately when created
      
    } catch {
      // Failed to persist conversation state
    }
  }

  /**
   * Archive or delete conversation
   */
  async archiveConversation(_conversationId: string): Promise<void> {
    try {

      // Implementation depends on backend support for archiving
      // For now, we just log it
    } catch {
      // Failed to archive conversation
    }
  }

  /**
   * Get all conversations for current user
   * @deprecated Use useAgentConversationsStore().fetchConversations() instead for reactive updates
   */
  async getUserConversations(): Promise<AgentConversation[]> {
    try {
      const response = await agentConversationsService.listConversations();
      return response.conversations;
    } catch {
      return [];
    }
  }

  /**
   * Update conversation metadata
   */
  updateConversationMetadata(
    _conversation: AgentConversation, 
    _metadata: Partial<{
      executionMode: ExecutionMode;
      isExecutionModeOverride: boolean;
      lastActiveAt: Date;
      error?: string;
    }>
  ): void {
    // Implementation would update conversation metadata
    // For now, this is a placeholder
  }

  /**
   * Find conversation by ID
   */
  findConversationById(conversations: AgentConversation[], _conversationId: string): AgentConversation | undefined {
    return conversations.find(conv => conv.id === _conversationId);
  }

  /**
   * Filter conversations by agent
   */
  filterConversationsByAgent(conversations: AgentConversation[], _agentName: string): AgentConversation[] {
    return conversations.filter(conv => conv.agent.name === _agentName);
  }

  /**
   * Sort conversations by last active time
   */
  sortConversationsByActivity(_conversations: AgentConversation[]): AgentConversation[] {
    return _conversations.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(_conversation: AgentConversation): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    hasActiveTask: boolean;
    lastActivity: string;
  } {
    const messages = _conversation.messages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const hasActiveTask = messages.some(m => m.metadata?.isPlaceholder);
    
    return {
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      hasActiveTask,
      lastActivity: _conversation.lastActiveAt.toISOString()
    };
  }

  /**
   * Clean up conversation resources
   */
  cleanupConversation(_conversation: AgentConversation): void {
    // Clean up any active tasks
    const activeTasks = _conversation.messages
      .filter(m => m.metadata?.isPlaceholder)
      .map(m => m.taskId)
      .filter(Boolean);
    
    activeTasks.forEach(_taskId => {
      // This could unsubscribe from WebSocket events, etc.
    });
  }

  /**
   * Validate conversation object
   */
  validateConversation(_conversation: unknown): _conversation is AgentConversation {
    return (
      _conversation &&
      typeof _conversation.id === 'string' &&
      _conversation.agent &&
      Array.isArray(_conversation.messages) &&
      _conversation.createdAt instanceof Date &&
      _conversation.lastActiveAt instanceof Date &&
      typeof _conversation.executionMode === 'string' &&
      Array.isArray(_conversation.supportedExecutionModes)
    );
  }
}

// Export singleton instance
export const conversation = new ConversationService();
