/**
 * Unified Conversations Store
 * Consolidates: conversationStore.ts + agentConversationsStore.ts
 *
 * Manages ALL conversation data (messages, tasks, metadata) in a single domain store.
 *
 * Architecture:
 * - State ONLY (no async, no API calls, no business logic)
 * - Uses Maps for O(1) lookups
 * - Synchronous mutations only
 * - Services call mutations after API success
 * - Vue reactivity updates UI automatically
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { AgentTaskMode } from '@orchestrator-ai/transport-types';
import type {
  MessageMetadata,
  ConversationMetadata,
} from '@/types/message';
import type {
  TaskStatus,
  TaskMetadata,
  TaskData,
} from '@/types/task';
import type { AgentConversation } from '@/types/conversation';
import { useAgentsStore } from '@/stores/agentsStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent types supported in the system
 */
export type AgentType =
  | 'context'
  | 'function'
  | 'api'
  | 'orchestrator'
  | 'custom';

/**
 * Store Conversation type - simplified for storage
 * Can be extended with AgentConversation properties
 */
export interface Conversation extends Partial<AgentConversation> {
  // Required fields
  id: string;
  title: string;

  // Optional backend fields
  userId?: string;
  agentName?: string;
  agentType?: AgentType;
  organizationSlug?: string | null;

  // Timestamps
  createdAt: Date | string;
  updatedAt?: Date | string;
  lastActiveAt?: Date | string;

  // Execution modes
  executionMode?: 'immediate' | 'polling' | 'real-time' | 'auto';
  supportedExecutionModes?: ('immediate' | 'polling' | 'real-time' | 'auto')[];
  isExecutionModeOverride?: boolean;
}

/**
 * Message in a conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

/**
 * Task associated with a conversation
 */
export interface Task {
  id: string;
  conversationId: string;
  mode: AgentTaskMode;
  action: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: TaskMetadata;
}

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: TaskData;
  error?: string;
  completedAt: string;
}

// Re-export types
export type { TaskStatus, MessageMetadata, ConversationMetadata, TaskMetadata, TaskData };

// ============================================================================
// Store Definition
// ============================================================================

export const useConversationsStore = defineStore('conversations', () => {
  // ============================================================================
  // STATE - Pure reactive data using Maps for O(1) lookups
  // ============================================================================

  const conversations = ref<Map<string, Conversation>>(new Map());
  const messages = ref<Map<string, Message[]>>(new Map()); // conversationId -> messages[]
  const tasks = ref<Map<string, Task>>(new Map()); // taskId -> task
  const taskResults = ref<Map<string, TaskResult>>(new Map()); // taskId -> result
  const tasksByConversation = ref<Map<string, string[]>>(new Map()); // conversationId -> taskIds[]

  const activeConversationId = ref<string | null>(null);
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const error = ref<string | null>(null);

  // ============================================================================
  // GETTERS - Computed properties for data access
  // ============================================================================

  /**
   * Get active conversation
   */
  const activeConversation = computed((): Conversation | null => {
    if (!activeConversationId.value) return null;
    return conversations.value.get(activeConversationId.value) || null;
  });

  /**
   * Get messages for active conversation
   */
  const activeMessages = computed(() => {
    if (!activeConversationId.value) return [];
    return messages.value.get(activeConversationId.value) || [];
  });

  /**
   * Get all conversations as sorted array
   */
  const allConversations = computed(() => {
    return Array.from(conversations.value.values())
      .sort((a, b) => {
        const dateA = a.lastActiveAt || a.updatedAt;
        const dateB = b.lastActiveAt || b.updatedAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  });

  /**
   * Get active conversations (not ended)
   */
  const activeConversations = computed(() => {
    return Array.from(conversations.value.values())
      .filter(conv => !conv.endedAt)
      .sort((a, b) => {
        const dateA = a.lastActiveAt || a.updatedAt;
        const dateB = b.lastActiveAt || b.updatedAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  });

  /**
   * Get running tasks
   */
  const runningTasks = computed(() => {
    return Array.from(tasks.value.values())
      .filter(task => task.status === 'running')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  /**
   * Get completed tasks
   */
  const completedTasks = computed(() => {
    return Array.from(tasks.value.values())
      .filter(task => task.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  /**
   * Get failed tasks
   */
  const failedTasks = computed(() => {
    return Array.from(tasks.value.values())
      .filter(task => task.status === 'failed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  // ============================================================================
  // GETTER FUNCTIONS - Functions that return computed data
  // ============================================================================

  /**
   * Get conversation by ID
   */
  const conversationById = (id: string): Conversation | undefined => {
    return conversations.value.get(id);
  };

  /**
   * Get messages by conversation ID
   */
  const messagesByConversation = (conversationId: string): Message[] => {
    return messages.value.get(conversationId) || [];
  };

  /**
   * Get tasks by conversation ID
   */
  const tasksByConversationId = (conversationId: string): Task[] => {
    const taskIds = tasksByConversation.value.get(conversationId) || [];
    return taskIds
      .map(id => tasks.value.get(id))
      .filter((task): task is Task => task !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  /**
   * Get conversations by agent name
   */
  const conversationsByAgent = (agentName: string, organizationSlug?: string | null): Conversation[] => {
    return Array.from(conversations.value.values())
      .filter(conv => {
        // Check both agentName field and agent.name
        const matchesName = conv.agentName === agentName || conv.agent?.name === agentName;
        if (!matchesName) return false;
        if (organizationSlug !== undefined) {
          const convOrg = conv.organizationSlug || conv.agent?.organizationSlug;
          return convOrg === organizationSlug;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.lastActiveAt || a.updatedAt || a.createdAt);
        const dateB = new Date(b.lastActiveAt || b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
  };

  /**
   * Get conversations by agent type
   */
  const conversationsByAgentType = (agentType: AgentType): Conversation[] => {
    return Array.from(conversations.value.values())
      .filter(conv => conv.agentType === agentType || conv.agent?.type === agentType)
      .sort((a, b) => {
        const dateA = new Date(a.lastActiveAt || a.updatedAt || a.createdAt);
        const dateB = new Date(b.lastActiveAt || b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
  };

  /**
   * Get task by ID
   */
  const taskById = (id: string): Task | undefined => {
    return tasks.value.get(id);
  };

  /**
   * Get task result by task ID
   */
  const resultByTaskId = (id: string): TaskResult | undefined => {
    return taskResults.value.get(id);
  };

  /**
   * Check if conversation is loading
   */
  const isLoading = (conversationId: string): boolean => {
    return loadingStates.value.get(conversationId) || false;
  };

  // ============================================================================
  // MUTATIONS - ONLY way to mutate state (synchronous only)
  // ============================================================================

  // --------------------------------------------------------------------------
  // Conversation Mutations
  // --------------------------------------------------------------------------

  /**
   * Add or update a conversation
   * Called by services after API success
   */
  function setConversation(conversation: Conversation): void {
    conversations.value.set(conversation.id, conversation);

    // Initialize messages and tasks arrays if not exists
    if (!messages.value.has(conversation.id)) {
      messages.value.set(conversation.id, []);
    }
    if (!tasksByConversation.value.has(conversation.id)) {
      tasksByConversation.value.set(conversation.id, []);
    }
  }

  /**
   * Add multiple conversations at once
   * Used when loading conversations from API
   */
  function setConversations(conversationList: Conversation[]): void {
    conversationList.forEach(conv => setConversation(conv));
  }

  /**
   * Update conversation data
   */
  function updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const existing = conversations.value.get(conversationId);
    if (existing) {
      conversations.value.set(conversationId, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Update conversation task counts
   */
  function updateConversationTaskCounts(
    conversationId: string,
    taskCounts: { activeTaskId?: string | null }
  ): void {
    const existing = conversations.value.get(conversationId);
    if (existing) {
      conversations.value.set(conversationId, {
        ...existing,
        ...taskCounts,
        lastActiveAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete a conversation
   * Also removes associated messages and tasks
   */
  function removeConversation(conversationId: string): void {
    conversations.value.delete(conversationId);
    messages.value.delete(conversationId);
    loadingStates.value.delete(conversationId);

    // Remove all tasks for this conversation
    const taskIds = tasksByConversation.value.get(conversationId) || [];
    taskIds.forEach(taskId => {
      tasks.value.delete(taskId);
      taskResults.value.delete(taskId);
    });
    tasksByConversation.value.delete(conversationId);

    // Clear active conversation if it was deleted
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
    }
  }

  /**
   * Set active conversation
   */
  function setActiveConversation(conversationId: string | null): void {
    if (conversationId === null || conversations.value.has(conversationId)) {
      activeConversationId.value = conversationId;
    }
  }

  /**
   * Set loading state for a conversation
   */
  function setLoading(conversationId: string, loading: boolean): void {
    loadingStates.value.set(conversationId, loading);
  }

  // --------------------------------------------------------------------------
  // Message Mutations
  // --------------------------------------------------------------------------

  /**
   * Add a message to a conversation
   */
  function addMessage(conversationId: string, message: Omit<Message, 'id'>): Message {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      conversationId,
    };

    const conversationMessages = messages.value.get(conversationId) || [];

    // Create a new Map to trigger Vue reactivity
    const newMessages = new Map(messages.value);
    newMessages.set(conversationId, [...conversationMessages, newMessage]);
    messages.value = newMessages;

    // Update conversation's updatedAt and lastActiveAt
    updateConversation(conversationId, {
      updatedAt: newMessage.timestamp,
      lastActiveAt: newMessage.timestamp,
    });

    return newMessage;
  }

  /**
   * Add assistant message from handler result
   * Helper for converse handler
   */
  function addAssistantMessage(
    conversationId: string,
    result: { message: string; metadata?: MessageMetadata }
  ): Message {
    return addMessage(conversationId, {
      conversationId,
      role: 'assistant',
      content: result.message,
      timestamp: result.metadata?.generation?.duration
        ? new Date().toISOString()
        : new Date().toISOString(),
      metadata: result.metadata,
    });
  }

  /**
   * Add user message
   * Helper for creating user messages
   */
  function addUserMessage(
    conversationId: string,
    content: string,
    metadata?: MessageMetadata
  ): Message {
    return addMessage(conversationId, {
      conversationId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Set all messages for a conversation
   * Used when loading messages from API
   */
  function setMessages(conversationId: string, messageList: Message[]): void {
    // Create a new Map to trigger Vue reactivity
    const newMessages = new Map(messages.value);
    newMessages.set(conversationId, messageList);
    messages.value = newMessages;
  }

  /**
   * Clear all messages for a conversation
   */
  function clearMessages(conversationId: string): void {
    // Create a new Map to trigger Vue reactivity
    const newMessages = new Map(messages.value);
    newMessages.set(conversationId, []);
    messages.value = newMessages;
  }

  /**
   * Update message metadata
   * Useful for updating workflow progress in real-time
   */
  function updateMessageMetadata(
    conversationId: string,
    messageId: string,
    metadataUpdates: Partial<MessageMetadata>
  ): void {
    const conversationMessages = messages.value.get(conversationId);
    if (!conversationMessages) return;

    const messageIndex = conversationMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = conversationMessages[messageIndex];
    const updatedMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        ...metadataUpdates,
      },
    };

    conversationMessages[messageIndex] = updatedMessage;

    // Create a new Map to trigger Vue reactivity
    const newMessages = new Map(messages.value);
    newMessages.set(conversationId, [...conversationMessages]);
    messages.value = newMessages;
  }

  /**
   * Update entire message (content, deliverableId, metadata, etc.)
   */
  function updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Omit<Message, 'id' | 'conversationId'>>
  ): void {
    const conversationMessages = messages.value.get(conversationId);
    if (!conversationMessages) return;

    const messageIndex = conversationMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = conversationMessages[messageIndex];
    const updatedMessage = {
      ...message,
      ...updates,
      metadata: updates.metadata ? {
        ...message.metadata,
        ...updates.metadata,
      } : message.metadata,
    };

    conversationMessages[messageIndex] = updatedMessage;

    // Create a new Map to trigger Vue reactivity
    const newMessages = new Map(messages.value);
    newMessages.set(conversationId, [...conversationMessages]);
    messages.value = newMessages;
  }

  // --------------------------------------------------------------------------
  // Task Mutations
  // --------------------------------------------------------------------------

  /**
   * Add a task
   */
  function addTask(task: Task): void {
    tasks.value.set(task.id, task);

    // Track task by conversation
    const conversationTasks = tasksByConversation.value.get(task.conversationId) || [];
    if (!conversationTasks.includes(task.id)) {
      tasksByConversation.value.set(task.conversationId, [...conversationTasks, task.id]);
    }
  }

  /**
   * Update task status
   */
  function updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = tasks.value.get(taskId);
    if (task) {
      tasks.value.set(taskId, {
        ...task,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Update task metadata
   */
  function updateTaskMetadata(taskId: string, metadata: TaskMetadata): void {
    const task = tasks.value.get(taskId);
    if (task) {
      tasks.value.set(taskId, {
        ...task,
        metadata: { ...task.metadata, ...metadata },
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Set task result
   */
  function setTaskResult(taskId: string, result: Omit<TaskResult, 'taskId'>): void {
    const taskResult: TaskResult = {
      taskId,
      ...result,
    };

    taskResults.value.set(taskId, taskResult);

    // Update task status based on result
    updateTaskStatus(taskId, result.success ? 'completed' : 'failed');
  }

  /**
   * Clear tasks for a conversation
   */
  function clearTasksByConversation(conversationId: string): void {
    const taskIds = tasksByConversation.value.get(conversationId) || [];

    taskIds.forEach(taskId => {
      tasks.value.delete(taskId);
      taskResults.value.delete(taskId);
    });

    tasksByConversation.value.delete(conversationId);
  }

  // --------------------------------------------------------------------------
  // Error Mutations
  // --------------------------------------------------------------------------

  /**
   * Set global error
   */
  function setError(errorMessage: string | null): void {
    error.value = errorMessage;
  }

  /**
   * Clear global error
   */
  function clearError(): void {
    error.value = null;
  }

  // --------------------------------------------------------------------------
  // Clear All
  // --------------------------------------------------------------------------

  /**
   * Clear all data (used on logout)
   */
  function clearAll(): void {
    conversations.value.clear();
    messages.value.clear();
    tasks.value.clear();
    taskResults.value.clear();
    tasksByConversation.value.clear();
    loadingStates.value.clear();
    activeConversationId.value = null;
    error.value = null;
  }

  // ============================================================================
  // TEMPORARY ASYNC METHODS - TO BE REMOVED IN PHASE 2
  // These methods wrap service calls for backward compatibility during migration
  // Phase 2 will move all async logic to services/agent2agent/actions/
  // ============================================================================

  /**
   * @deprecated Phase 2: Move to converse.actions.ts
   * Fetch conversations from API and update store
   */
  async function fetchConversations(_force = false): Promise<void> {
    const agent2AgentConversationsService = await import('@/services/agent2AgentConversationsService').then(m => m.default);

    setLoading('_global', true);
    setError(null);

    try {
      const response = await agent2AgentConversationsService.listConversations({
        limit: 1000,
      });

      // Get agents store to look up agent data
      const agentsStore = useAgentsStore();

      // Map API response to our Conversation interface
      const mappedConversations = response.conversations.map(conv => {
        // Look up the agent to get execution modes (agents should already be loaded)
        const agent = agentsStore.availableAgents?.find(a => a.name === conv.agentName);

        const normalizeMode = (mode: string): 'immediate' | 'polling' | 'real-time' | 'auto' | null => {
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

        // Extract execution modes from agent (check both formats)
        const agentWithContext = agent as typeof agent & { context?: { execution_modes?: string[] } };
        const rawModes = agent?.execution_modes ||
                         agentWithContext?.context?.execution_modes ||
                         ['immediate'];

        const supportedModes = rawModes
          .map((mode: string) => normalizeMode(mode))
          .filter((mode): mode is 'immediate' | 'polling' | 'real-time' | 'auto' => mode !== null) as (
            | 'immediate'
            | 'polling'
            | 'real-time'
            | 'auto'
          )[];

        const validModes: ('immediate' | 'polling' | 'real-time' | 'auto')[] =
          supportedModes.length > 0 ? supportedModes : ['immediate'];
        const defaultMode: ('immediate' | 'polling' | 'real-time' | 'auto') =
          (['auto', 'real-time', 'polling', 'immediate'] as const).find((mode) =>
            validModes.includes(mode),
          ) ?? validModes[0] ?? 'immediate';

        return {
          id: conv.id,
          userId: conv.userId,
          title: conv.metadata?.title || 'Untitled',
          agentName: conv.agentName,
          agentType: conv.agentType as AgentType,
          organizationSlug: conv.organizationSlug,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          startedAt: conv.startedAt,
          endedAt: conv.endedAt,
          lastActiveAt: conv.lastActiveAt,
          taskCount: conv.taskCount || 0,
          completedTasks: conv.completedTasks || 0,
          failedTasks: conv.failedTasks || 0,
          activeTasks: conv.activeTasks || 0,
          metadata: conv.metadata,
          // Add agent and execution mode fields
          agent: agent,
          executionMode: defaultMode,
          supportedExecutionModes: validModes,
          isExecutionModeOverride: false,
        };
      });

      setConversations(mappedConversations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading('_global', false);
    }
  }

  /**
   * @deprecated Phase 2: Move to converse.actions.ts
   * Delete conversation via API and update store
   */
  async function deleteConversation(conversationId: string): Promise<void> {
    const { agentConversationsService } = await import('@/services/agentConversationsService');

    try {
      // Optimistically remove from store
      removeConversation(conversationId);

      // Make API call
      await agentConversationsService.deleteConversation(conversationId);

      // Close tabs and clean up deliverables
      const { useChatUiStore } = await import('./ui/chatUiStore');
      const { useDeliverablesStore } = await import('./deliverablesStore');

      const chatUiStore = useChatUiStore();
      const deliverablesStore = useDeliverablesStore();

      chatUiStore.closeConversationTab(conversationId);

      if (deliverablesStore.handleConversationDeleted) {
        deliverablesStore.handleConversationDeleted(conversationId);
      }
    } catch (err) {
      // Rollback by fetching fresh data
      await fetchConversations(true);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(errorMessage);
      throw err;
    }
  }

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State (read-only exposure)
    conversations: readonly(conversations),
    activeConversationId: readonly(activeConversationId),
    error: readonly(error),

    // Computed getters
    activeConversation,
    activeMessages,
    allConversations,
    activeConversations,
    runningTasks,
    completedTasks,
    failedTasks,

    // Getter functions
    conversationById,
    messagesByConversation,
    tasksByConversationId,
    conversationsByAgent,
    conversationsByAgentType,
    taskById,
    resultByTaskId,
    isLoading,

    // Conversation mutations
    setConversation,
    setConversations,
    updateConversation,
    updateConversationTaskCounts,
    removeConversation,
    setActiveConversation,
    setLoading,

    // Message mutations
    addMessage,
    addAssistantMessage,
    addUserMessage,
    setMessages,
    clearMessages,
    updateMessageMetadata,
    updateMessage,

    // Task mutations
    addTask,
    updateTaskStatus,
    updateTaskMetadata,
    setTaskResult,
    clearTasksByConversation,

    // Error mutations
    setError,
    clearError,

    // Clear all
    clearAll,

    // TEMPORARY: Async methods for backward compatibility (Phase 1 only)
    // @deprecated Phase 2: These will be moved to services/agent2agent/actions/
    fetchConversations,
    deleteConversation,
  };
});
