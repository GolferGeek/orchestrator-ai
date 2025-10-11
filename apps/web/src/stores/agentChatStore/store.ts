import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { useAgentConversationsStore } from '@/stores/agentConversationsStore';
import { useLLMStore } from '@/stores/llmStore';
import { formatAgentName } from '@/utils/caseConverter';
import tasksService from '@/services/tasksService';
import { agentExecutionService } from '@/services/agentExecutionService';
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
import { planActions } from './planActions';
import { deliverableActions } from './deliverableActions';
import { createPlansService } from './plans';
import analyticsService from '@/services/analyticsService';
import approvalsService from '@/services/approvalsService';
import { useAuthStore } from '@/stores/authStore';
import { A2AStreamHandler } from '@/services/agent2agent/sse';
import type {
  AgentStreamChunkData,
  AgentStreamCompleteData,
  AgentStreamErrorData,
} from '@orchestrator-ai/transport-types';
import type {
  AgentStreamChunkEvent,
  AgentStreamCompleteEvent,
  AgentStreamErrorEvent,
} from '@/services/websocketService';


// Import types
import type {
  AgentConversation,
  AgentChatMessage,
  ExecutionMode,
  Agent,
  PendingAction,
  AgentChatMode,
  ConversationPlanRecord,
  OrchestrationRunRecord,
  AgentOrchestrationRecord,
  AgentTaskResponse,
} from './types';
import { DEFAULT_CHAT_MODES } from './types';

// Pre-generated task ID for WebSocket mode
let preGeneratedTaskId: string | undefined;

// Agent task timeout configuration (in seconds)
const AGENT_TASK_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '120000', 10) / 1000;

const activeSseHandlers = new Map<string, A2AStreamHandler>();

interface AgentChatState {
  conversations: AgentConversation[];
  activeConversationId: string | null;
  globalError: string | null;
  pendingAction?: PendingAction | null;
  lastMessageWasSpeech: boolean;
}

export const useAgentChatStore = defineStore('agentChat', {
  state: (): AgentChatState => ({
    conversations: [],
    activeConversationId: null,
    globalError: null,
    pendingAction: null,
    lastMessageWasSpeech: false,
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
    ,
    getLatestPlan(state): ConversationPlanRecord | null {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return activeConversation?.latestPlan ?? null;
    },
    getLatestRun(state): OrchestrationRunRecord | null {
      const activeConversation = state.conversations.find(conv => conv.id === state.activeConversationId);
      return activeConversation?.orchestrationRuns?.[0] ?? null;
    }
  },

  actions: {
    /**
     * Initialize WebSocket handler with store instance
     */
    initializeWebSocketHandler() {
      websocketHandler.setStore(this);
    },

    async startStreamSubscription(
      conversation: AgentConversation,
      streamInfo: string | Record<string, any>,
      label: string,
    ): Promise<void> {
      this.initializeWebSocketHandler();

      const metadata: Record<string, any> =
        typeof streamInfo === 'string' ? { streamId: streamInfo } : { ...streamInfo };
      const streamId =
        this.extractStreamId(metadata) ??
        (typeof streamInfo === 'string' ? streamInfo : generateUUID());
      metadata.streamId = streamId;

      if (!conversation.streamSubscriptions) {
        conversation.streamSubscriptions = {};
      }

      const existingSub = conversation.streamSubscriptions[streamId];
      if (existingSub) {
        try {
          existingSub.unsubscribe?.();
        } catch (error) {
          console.warn('⚠️ Failed to unsubscribe existing stream', error);
        }
      }

      const streamMessage = messageFormatting.createStreamMessage(streamId, label);
      conversation.messages.push(streamMessage);

      const registerSubscription = (unsubscribe: () => void) => {
        conversation.streamSubscriptions![streamId] = {
          messageId: streamMessage.id,
          unsubscribe,
        };
      };

      if (this.hasSseMetadata(metadata)) {
        const handler = new A2AStreamHandler({
          debug: import.meta.env.DEV,
        });
        activeSseHandlers.set(streamId, handler);

        registerSubscription(() => {
          try {
            handler.disconnect();
          } finally {
            activeSseHandlers.delete(streamId);
          }
        });

        try {
          await handler.connect({
            metadata,
            onChunk: (event) => this.handleStreamChunk(event),
            onComplete: (event) => this.handleStreamComplete(event),
            onError: (event) => this.handleStreamError(event),
          });
          return;
        } catch (error) {
          console.warn('⚠️ SSE stream connection failed, attempting WebSocket fallback', error);
          const active = conversation.streamSubscriptions?.[streamId];
          if (active) {
            try {
              active.unsubscribe?.();
            } catch {}
          }
          activeSseHandlers.delete(streamId);
        }
      }

      try {
        const unsubscribe = await websocketHandler.subscribeToStream(streamId, {
          onChunk: (event: AgentStreamChunkEvent) => this.handleStreamChunk(event),
          onComplete: (event: AgentStreamCompleteEvent) => this.handleStreamComplete(event),
          onError: (event: AgentStreamErrorEvent) => this.handleStreamError(event),
        });
        registerSubscription(() => {
          try {
            unsubscribe?.();
          } catch {}
        });
      } catch (error) {
        console.error('❌ Failed to subscribe to stream via WebSocket', error);
        messageFormatting.markStreamError(streamMessage, 'Unable to subscribe to stream');
      }
    },

    extractStreamId(metadata: Record<string, any>): string | undefined {
      if (!metadata) {
        return undefined;
      }
      const streamId =
        metadata.streamId ??
        metadata.stream_id ??
        metadata.streaming?.streamId ??
        metadata.streaming?.stream_id ??
        metadata.streaming?.id;
      return streamId ? String(streamId) : undefined;
    },

    hasSseMetadata(metadata: Record<string, any>): boolean {
      if (!metadata) {
        return false;
      }
      const streaming = metadata.streaming ?? {};
      const streamEndpoint =
        metadata.streamEndpoint ||
        metadata.streamUrl ||
        streaming.streamEndpoint ||
        streaming.streamUrl;
      const tokenEndpoint =
        metadata.streamTokenEndpoint ||
        metadata.streamTokenUrl ||
        streaming.streamTokenEndpoint ||
        streaming.streamTokenUrl;
      return Boolean(streamEndpoint && tokenEndpoint);
    },

    handleStreamChunk(event: AgentStreamChunkEvent | AgentStreamChunkData) {
      const conversation = this.getConversationForStream(
        event.streamId,
        event.conversationId ?? null,
      );
      if (!conversation) {
        return;
      }
      const message = conversation.messages.find(
        (msg) => msg.metadata?.streamId === event.streamId,
      );
      if (!message) {
        return;
      }
      const rawContent = event.chunk?.content ?? '';
      let parsed: any = null;
      if (typeof rawContent === 'string') {
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          parsed = { message: rawContent };
        }
      } else if (rawContent) {
        parsed = rawContent;
      }

      if (parsed?.run) {
        messageFormatting.updateStreamMessageFromRun(
          message,
          parsed.run,
          parsed.status,
        );
        this.updateOrchestrationRunRecord(conversation, parsed.run);
      } else {
        const contentText =
          parsed?.message ??
          parsed?.text ??
          (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent));
        messageFormatting.updateStreamMessageWithText(
          message,
          String(contentText ?? 'Processing...'),
        );
      }
    },

    handleStreamComplete(event: AgentStreamCompleteEvent | AgentStreamCompleteData) {
      const conversation = this.getConversationForStream(
        event.streamId,
        event.conversationId ?? null,
      );
      if (!conversation) {
        return;
      }
      const message = conversation.messages.find(
        (msg) => msg.metadata?.streamId === event.streamId,
      );
      if (message) {
        messageFormatting.markStreamComplete(message);
      }
      this.cleanupStreamSubscription(conversation, event.streamId);
    },

    handleStreamError(event: AgentStreamErrorEvent | AgentStreamErrorData) {
      const conversation = this.getConversationForStream(
        event.streamId,
        event.conversationId ?? null,
      );
      if (!conversation) {
        return;
      }
      const message = conversation.messages.find(
        (msg) => msg.metadata?.streamId === event.streamId,
      );
      if (message) {
        messageFormatting.markStreamError(message, event.error ?? 'Unknown error');
      }
      this.cleanupStreamSubscription(conversation, event.streamId);
    },

    getConversationForStream(streamId: string, conversationId: string | null): AgentConversation | null {
      if (conversationId) {
        const conversation = this.getConversationById(conversationId);
        if (conversation) {
          return conversation;
        }
      }
      return (
        this.conversations.find((conv) => {
          if (conv.streamSubscriptions?.[streamId]) {
            return true;
          }
          return conv.messages.some((m) => m.metadata?.streamId === streamId);
        }) || null
      );
    },

    cleanupStreamSubscription(conversation: AgentConversation, streamId: string) {
      const subs = conversation.streamSubscriptions;
      if (!subs || !subs[streamId]) {
        return;
      }
      try {
        subs[streamId].unsubscribe?.();
      } catch {
        // Ignore unsubscribe errors
      }
      delete subs[streamId];
      const handler = activeSseHandlers.get(streamId);
      if (handler) {
        try {
          handler.disconnect();
        } catch {
          // ignore disconnect errors
        }
        activeSseHandlers.delete(streamId);
      }
    },

    finalizeStreamMessage(
      conversation: AgentConversation,
      streamId: string,
      run: OrchestrationRunRecord,
    ) {
      const message = conversation.messages.find(
        (msg) => msg.metadata?.streamId === streamId,
      );
      if (!message) {
        const finalMessage = messageFormatting.createOrchestrationRunMessage(run);
        finalMessage.metadata = {
          ...(finalMessage.metadata ?? {}),
          streamId,
          isStreaming: false,
        };
        conversation.messages.push(finalMessage);
        return;
      }

      const finalMessage = messageFormatting.createOrchestrationRunMessage(run);
      message.content = finalMessage.content;
      message.timestamp = finalMessage.timestamp;
      message.metadata = {
        ...(finalMessage.metadata ?? {}),
        streamId,
        isStreaming: false,
      };
    },

    markStreamError(
      conversation: AgentConversation,
      streamId: string,
      error: string,
    ) {
      const message = conversation.messages.find(
        (msg) => msg.metadata?.streamId === streamId,
      );
      if (message) {
        messageFormatting.markStreamError(message, error);
      }
      this.cleanupStreamSubscription(conversation, streamId);
    },

    updateOrchestrationRunRecord(
      conversation: AgentConversation,
      run: OrchestrationRunRecord,
    ) {
      conversation.orchestrationRuns = conversation.orchestrationRuns ?? [];
      const existingIndex = conversation.orchestrationRuns.findIndex(
        (existing) => existing.id === run.id,
      );
      if (existingIndex >= 0) {
        conversation.orchestrationRuns.splice(existingIndex, 1, run);
      } else {
        conversation.orchestrationRuns.unshift(run);
      }
      if (run.plan_id) {
        conversation.latestPlanId = run.plan_id;
      }
    },


    async ensureBackendConversation(activeConversation: AgentConversation): Promise<string> {
      let conversationId = activeConversation.id;

      const hasInitialWelcomeOnly = activeConversation.messages.length <= 1 &&
        activeConversation.messages.every(msg => msg.metadata?.isWelcome);

      const exists = await conversation.conversationExists(conversationId);

      if (!exists) {
        const backendId = await conversation.createConversation(activeConversation.agent);
        conversationId = backendId;
        activeConversation.id = conversationId;
        this.activeConversationId = conversationId;

        const conversationsStore = useAgentConversationsStore();
        const effectiveAgentType = activeConversation.agent.namespace || activeConversation.agent.type;
        conversationsStore.addExistingConversation({
          id: conversationId,
          agentName: activeConversation.agent.name,
          agentType: effectiveAgentType,
          startedAt: new Date(),
          lastActiveAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          taskCount: 0,
          completedTasks: 0,
          failedTasks: 0,
          activeTasks: 0,
        });
      } else if (hasInitialWelcomeOnly) {
        const conversationsStore = useAgentConversationsStore();
        if (conversationsStore.getConversationById?.(conversationId) == null) {
          const effectiveAgentType2 = activeConversation.agent.namespace || activeConversation.agent.type;
          conversationsStore.addExistingConversation({
            id: conversationId,
            agentName: activeConversation.agent.name,
            agentType: effectiveAgentType2,
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

      return conversationId;
    },
    
    /**
     * Get active conversation
     */
    getActiveConversation(): AgentConversation | null {
      return this.conversations.find(conv => conv.id === this.activeConversationId) || null;
    },

    /**
     * Get current chat mode for active conversation
     */
    getActiveChatMode(): AgentChatMode {
      const conv = this.getActiveConversation();
      if (!conv) {
        return DEFAULT_CHAT_MODES[0];
      }

      const current = conv.chatMode || DEFAULT_CHAT_MODES[0];
      const allowed = conv.allowedChatModes?.length ? conv.allowedChatModes : DEFAULT_CHAT_MODES;

      if (!allowed.includes(current)) {
        return allowed[0] || DEFAULT_CHAT_MODES[0];
      }

      return current;
    },

    /**
     * Set chat mode for active conversation
     */
    setChatMode(mode: AgentChatMode) {
      const conv = this.getActiveConversation();
      if (conv) {
        const allowed = conv.allowedChatModes?.length ? conv.allowedChatModes : DEFAULT_CHAT_MODES;
        if (!allowed.includes(mode)) {
          return;
        }
        conv.chatMode = mode;
      }
    },

    isModeAllowed(mode: AgentChatMode): boolean {
      const conv = this.getActiveConversation();
      if (!conv) {
        return mode === DEFAULT_CHAT_MODES[0];
      }
      const allowed = conv.allowedChatModes?.length ? conv.allowedChatModes : DEFAULT_CHAT_MODES;
      return allowed.includes(mode);
    },

    /**
     * Set a pending Plan/Build action suggestion with expiry
     */
    setPendingAction(type: 'plan' | 'build', sourceTaskId?: string, ttlMs: number = 20000) {
      const expiresAt = Date.now() + ttlMs;
      this.pendingAction = { type, expiresAt, sourceTaskId };
    },
    clearPendingAction() {
      this.pendingAction = null;
    },
    getPendingAction(): PendingAction | null {
      if (!this.pendingAction) return null;
      if (Date.now() > this.pendingAction.expiresAt) {
        this.pendingAction = null;
        return null;
      }
      return this.pendingAction;
    },

    /**
     * Execute current mode from the last user message without adding a new user message
     */
    async executeFromLastUserMessage(mode: 'plan' | 'build') {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) return;

      if (!this.isModeAllowed(mode)) {
        console.warn(`Mode ${mode} is not allowed for this conversation.`);
        return;
      }

      // Locate the most recent non-empty user message (excluding placeholders)
      const lastUser = [...activeConversation.messages].reverse().find(m => m.role === 'user' && m.content?.trim());
      const basePrompt = lastUser?.content || 'Please proceed.';

      // Ensure backend conversation exists
      const conversationId = await this.ensureBackendConversation(activeConversation);

      // Determine execution mode
      const userPreferences = useUserPreferencesStore();
      const effectiveMode = taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);
      preGeneratedTaskId = generateUUID();

      // Mark sending state for UI (mirrors sendMessage path)
      activeConversation.isSendingMessage = true;

      if (mode === 'plan') {
        try {
          analyticsService.trackEvent({
            eventType: 'system',
            category: 'chat',
            action: 'plan_sent',
            label: 'plan_cta',
            properties: { conversationId },
            context: { url: window.location.pathname, userAgent: navigator.userAgent },
          });

          const plansService = createPlansService(activeConversation.agent.name);
          const result = await plansService.createPlan(conversationId, basePrompt);
          if (result) {
            activeConversation.currentPlan = result.plan;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create plan';
          activeConversation.error = message;
          console.error('Plan creation failed:', error);
        } finally {
          activeConversation.isSendingMessage = false;
        }
        return;
      }

      if (mode === 'build' && activeConversation.latestPlanId) {
        try {
          analyticsService.trackEvent({
            eventType: 'system',
            category: 'chat',
            action: 'orchestration_execute',
            label: 'build_from_plan_cta',
            properties: { conversationId, planId: activeConversation.latestPlanId },
            context: { url: window.location.pathname, userAgent: navigator.userAgent },
          });

          await this.executeOrchestrationRun({
            planId: activeConversation.latestPlanId,
          });
          activeConversation.isSendingMessage = false;
          return;
        } catch (error) {
          console.error('Orchestration execution failed, falling back to legacy build:', error);
        }
      }

      // Use authStore.currentNamespace as source of truth for routing
      // (agent.namespace might be null even when user selected a namespace)
      const authStore = useAuthStore();
      const effectiveNamespace = authStore.currentNamespace || null;
      
      console.log('🔍 Namespace resolution:', {
        authStoreNamespace: authStore.currentNamespace,
        agentNamespace: authStore.currentNamespace,
        effectiveNamespace,
        agentName: activeConversation.agent.name,
        agentType: activeConversation.agent.type
      });

      const taskOptions = {
        method: String(mode), // Ensure method is always a string for JSON-RPC
        prompt: basePrompt,
        conversationId,
        conversationHistory: this.buildConversationHistory(activeConversation),
        llmSelection: this.getLLMSelection(),
        executionMode: effectiveMode,
        agentType: activeConversation.agent.type,
        agentName: activeConversation.agent.name,
        agentNamespace: effectiveNamespace,
        taskId: preGeneratedTaskId,
        mode,
        timeoutSeconds: mode === 'build' ? AGENT_TASK_TIMEOUT_SECONDS : 60,
      };

      // Track plan/build dispatch from CTA or acceptance
      analyticsService.trackEvent({
        eventType: 'system',
        category: 'chat',
        action: mode === 'build' ? 'build_sent' : 'plan_sent',
        label: mode,
        properties: { conversationId, taskId: preGeneratedTaskId },
        context: { url: window.location.pathname, userAgent: navigator.userAgent },
      });

      await taskExecution.createAndExecuteTask(taskOptions, {
        onPlaceholder: (taskId, mode) => this.createPlaceholderMessage(conversationId, taskId, mode),
        onCompletion: (taskId, immediateTask) => this.handleTaskCompletion(conversationId, taskId, immediateTask),
        onStatusUpdate: (convId, taskId, statusUpdate) => this.handleTaskStatusUpdate(convId, taskId, statusUpdate),
      });

      // Clear sending state on completion path (safety)
      activeConversation.isSendingMessage = false;
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
      const effectiveAgentType3 = agent.namespace || agent.type;
      conversationsStore.addExistingConversation({
        id: newConversation.id,
        agentName: agent.name,
        agentType: effectiveAgentType3,
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
      console.log(`🗂️ agentChatStore.closeConversation called for: ${conversationId}`);
      const conv = this.getConversationById(conversationId);
      if (conv) {
        console.log(`✅ Found conversation to close: ${conv.title}`);
        // Cleanup conversation resources
        conversation.cleanupConversation(conv);
        
        // Remove from list
        const beforeCount = this.conversations.length;
        this.conversations = this.conversations.filter(c => c.id !== conversationId);
        const afterCount = this.conversations.length;
        console.log(`🗂️ Removed conversation from tabs: ${beforeCount} → ${afterCount} conversations`);
        
        // Update active conversation
        if (this.activeConversationId === conversationId) {
          this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
          console.log(`🗂️ Updated active conversation to: ${this.activeConversationId}`);
        }
      } else {
        console.log(`❌ Conversation not found in agentChatStore: ${conversationId}`);
        console.log(`📋 Current conversations: ${this.conversations.map(c => c.id).join(', ')}`);
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

        // Hydrate current plan for this conversation (ensures Plan tab shows in second pane)
        try {
          const { planActions } = await import('./planActions');
          // Bind planActions to this store instance and invoke loadCurrentPlan
          await planActions.loadCurrentPlan.call(this);
        } catch (e) {
          console.warn('⚠️ Failed to load current plan during rehydration:', e);
        }
        
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
            // Found existing deliverables for conversation
          } else {
            // No deliverables found for conversation
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
      // Don't clear speech flag here - let TTS handle clearing it after playback
      // The flag should only be cleared after TTS completes or if user types a new message
      
      // Initialize WebSocket handler with store instance
      this.initializeWebSocketHandler();
      
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        console.error('No active conversation');
        return;
      }

      // Natural acceptance: if a pending action exists and the content is affirmative, auto-run and return
      const pending = this.getPendingAction();
      const affirmative = /^(yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|sounds good|let's do it|proceed)[.!]?$/i;
      const negative = /^(no|nah|nope|stop|cancel|reject|do not|don't)$/i;
      if (pending && affirmative.test(content.trim())) {
        // Record the user's short reply as a normal message for continuity
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        activeConversation.messages.push(userMessage);
        this.setChatMode(pending.type);
        // Try approve-and-continue if a human gate approvalId exists
        try {
          const lastAssistant = [...activeConversation.messages].reverse().find(m => m.role === 'assistant' && m.metadata?.approvalId);
          const approvalId = lastAssistant?.metadata?.approvalId as string | undefined;
          if (approvalId) {
            const auth = useAuthStore();
            const orgSlug = auth.currentNamespace || null;
            const agentSlug = activeConversation.agent.name;
            // Attempt to approve and continue with streaming enabled
            const preStreamId = generateUUID();
            const response = await approvalsService.approveAndContinue(
              orgSlug,
              agentSlug,
              approvalId,
              { options: { stream: true }, metadata: { stream: true, streamId: preStreamId } }
            );
            const streamingMetadata = response?.payload?.metadata;
            if (streamingMetadata) {
              const mergedMetadata = { ...streamingMetadata };
              if (!mergedMetadata.streamId) {
                mergedMetadata.streamId =
                  mergedMetadata.streaming?.streamId ?? preStreamId;
              }
              await this.startStreamSubscription(
                activeConversation,
                mergedMetadata,
                'Continuing build…',
              );
            } else if (preStreamId) {
              await this.startStreamSubscription(
                activeConversation,
                preStreamId,
                'Continuing build…',
              );
            } else if (response?.payload?.content) {
              // Fallback: append a simple assistant message with returned content
              const content = typeof response.payload.content === 'string'
                ? response.payload.content
                : (response.payload.content.output || response.payload.content.message || JSON.stringify(response.payload.content));
              activeConversation.messages.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: String(content),
                timestamp: new Date(),
                metadata: { ...(response.payload.metadata || {}), approvalId },
              });
            }
            // Update the original assistant message to show approved chip
            if (lastAssistant) {
              lastAssistant.metadata = {
                ...(lastAssistant.metadata || {}),
                approvalStatus: 'approved',
                approvedAt: new Date().toISOString(),
              };
            }
            // Clear pending action since we handled approval
            this.clearPendingAction();
            return; // Skip legacy execution path
          }
        } catch (e) {
          console.warn('Approval continue failed; falling back to legacy execution path', e);
        }
        // Track natural acceptance
        analyticsService.trackEvent({
          eventType: 'ui',
          category: 'cta',
          action: 'auto_accept_yes',
          label: pending.type,
          properties: { conversationId: activeConversation.id, sourceTaskId: pending.sourceTaskId },
          context: { url: window.location.pathname, userAgent: navigator.userAgent },
        });
        this.clearPendingAction();
        await this.executeFromLastUserMessage(pending.type);
        return; // Skip normal task creation flow
      }
      // Natural rejection: if a pending action exists and the content is negative, reject and annotate
      if (pending && negative.test(content.trim())) {
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        activeConversation.messages.push(userMessage);
        try {
          const lastAssistant = [...activeConversation.messages].reverse().find(m => m.role === 'assistant' && m.metadata?.approvalId);
          const approvalId = lastAssistant?.metadata?.approvalId as string | undefined;
          if (approvalId) {
            await approvalsService.reject(approvalId);
            // Update chip on the gated message
            lastAssistant.metadata = {
              ...(lastAssistant.metadata || {}),
              approvalStatus: 'rejected',
              decisionAt: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.warn('Approval reject failed', e);
        }
        analyticsService.trackEvent({
          eventType: 'ui',
          category: 'cta',
          action: 'auto_reject_no',
          label: pending.type,
          properties: { conversationId: activeConversation.id, sourceTaskId: pending.sourceTaskId },
          context: { url: window.location.pathname, userAgent: navigator.userAgent },
        });
        this.clearPendingAction();
        return; // Skip legacy execution path
      }

      // Set loading state
      activeConversation.isSendingMessage = true;
      activeConversation.error = undefined;

      try {
        const conversationId = await this.ensureBackendConversation(activeConversation);

        // Add user message immediately
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        activeConversation.messages.push(userMessage);

        const chatMode = this.getActiveChatMode();

        // Enhancement path: if a deliverable is selected for enhancement, treat the user message as an enhancement instruction
        try {
          const deliverablesStore = useDeliverablesStore();
          const enhancing = (deliverablesStore as any).enhancementContext?.isEnhancing && (deliverablesStore as any).enhancementContext?.sourceDeliverableId;
          if (enhancing) {
            const deliverableId = (deliverablesStore as any).enhancementContext.sourceDeliverableId as string;
            // Determine current version to enhance
            let currentVersion = deliverablesStore.getCurrentVersion(deliverableId);
            if (!currentVersion) {
              await deliverablesStore.loadDeliverableVersions(deliverableId);
              currentVersion = deliverablesStore.getCurrentVersion(deliverableId);
            }
            if (currentVersion?.id) {
              // Map current LLM selection into optional enhancement params
              const sel = this.getLLMSelection();
              const params: any = {};
              if (sel?.providerName) params.providerName = sel.providerName;
              if (sel?.modelName) params.modelName = sel.modelName;
              await deliverablesStore.enhanceVersion(currentVersion.id, content, params);
              // Add assistant confirmation message
              const assistantMessage: AgentChatMessage = {
                id: `enhance-${Date.now()}`,
                role: 'assistant',
                content: `✨ Enhanced deliverable "${deliverableId}" with your instruction`,
                timestamp: new Date(),
                metadata: { enhancedDeliverableId: deliverableId, enhancedFromVersionId: currentVersion.id },
              };
              activeConversation.messages.push(assistantMessage);
              activeConversation.isSendingMessage = false;
              return; // Skip normal task flow
            }
          }
        } catch (e) {
          console.warn('Enhancement path failed; falling back to normal flow', e);
        }

        if (chatMode === 'plan') {
          try {
            analyticsService.trackEvent({
              eventType: 'system',
              category: 'chat',
              action: 'plan_sent',
              label: 'plan',
              properties: { conversationId },
              context: { url: window.location.pathname, userAgent: navigator.userAgent },
            });

            const plansService = createPlansService(activeConversation.agent.name);
            const result = await plansService.createPlan(conversationId, content);
            console.log('📋 [Plan Create] Result:', result);
            if (result) {
              activeConversation.currentPlan = result.plan;
              console.log('✅ [Plan Create] Set currentPlan:', result.plan);
              console.log('🔍 [Plan Create] Active conversation state:', {
                id: activeConversation.id,
                hasCurrentPlan: !!activeConversation.currentPlan,
                planId: activeConversation.currentPlan?.id
              });
            } else {
              console.warn('⚠️ [Plan Create] No result returned from plansService.createPlan');
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create plan';
            activeConversation.error = message;
            console.error('Plan creation failed:', error);
          } finally {
            activeConversation.isSendingMessage = false;
          }
          return;
        }

        // Determine execution mode
        const userPreferences = useUserPreferencesStore();
        const effectiveMode = taskExecution.determineExecutionMode(activeConversation, userPreferences.preferences);

        // Always generate a unique task ID for every task execution to prevent database conflicts
        preGeneratedTaskId = generateUUID();


        // Ensure system model selection is warmed for Converse/Plan
        const modeToWarm = (activeConversation.chatMode || 'converse');
        if (modeToWarm === 'converse' || modeToWarm === 'plan') {
          try { await (useLLMStore() as any).ensureSystemModelSelection?.(); } catch {
            // Failed to ensure system model selection
          }
        }

        if (chatMode === 'build' && activeConversation.latestPlanId) {
          try {
            analyticsService.trackEvent({
              eventType: 'system',
              category: 'chat',
              action: 'orchestration_execute',
              label: 'build_from_plan',
              properties: { conversationId, planId: activeConversation.latestPlanId },
              context: { url: window.location.pathname, userAgent: navigator.userAgent },
            });

            await this.executeOrchestrationRun({
              planId: activeConversation.latestPlanId,
            });
            activeConversation.isSendingMessage = false;
            return;
          } catch (error) {
            console.error('Orchestration execution failed, falling back to legacy build:', error);
          }
        }

        // Prepare task execution options
        // Ensure chatMode is a string to prevent JSON-RPC errors
        // Use authStore.currentNamespace as source of truth for routing
        const authStore = useAuthStore();
        const effectiveNamespace = authStore.currentNamespace || null;
        
        console.log('🔍 Namespace resolution (sendMessage):', {
          authStoreNamespace: authStore.currentNamespace,
          agentNamespace: authStore.currentNamespace,
          effectiveNamespace,
          agentName: activeConversation.agent.name,
          agentType: activeConversation.agent.type
        });
        
        const taskOptions = {
          method: chatMode, // This must be a string for JSON-RPC
          prompt: content,
          conversationId: conversationId,
          conversationHistory: this.buildConversationHistory(activeConversation),
          llmSelection: this.getLLMSelection(),
          executionMode: effectiveMode,
          agentType: activeConversation.agent.type,
          agentName: activeConversation.agent.name,
          agentNamespace: effectiveNamespace,
          taskId: preGeneratedTaskId,
          mode: chatMode,
          timeoutSeconds: chatMode === 'build' ? AGENT_TASK_TIMEOUT_SECONDS : 60,
        };

        // Track plan/build when dispatched from regular send
        if (chatMode === 'build' || chatMode === 'plan') {
          analyticsService.trackEvent({
            eventType: 'system',
            category: 'chat',
            action: chatMode === 'build' ? 'build_sent' : 'plan_sent',
            label: chatMode,
            properties: { conversationId, taskId: preGeneratedTaskId },
            context: { url: window.location.pathname, userAgent: navigator.userAgent },
          });
        }

      // Execute task using service
        await taskExecution.createAndExecuteTask(taskOptions, {
          onPlaceholder: (taskId, mode) => this.createPlaceholderMessage(conversationId, taskId, mode),
          onCompletion: (taskId, immediateTask) => this.handleTaskCompletion(conversationId, taskId, immediateTask),
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
            const effectiveAgentType4 = activeConversation.agent.namespace || activeConversation.agent.type;
            conversationsStore.addExistingConversation({
              id: conversationId,
              agentName: activeConversation.agent.name,
              agentType: effectiveAgentType4,
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
        // Ensure chatMode is a string to prevent JSON-RPC errors
        const chatMode2 = this.getActiveChatMode();
        const taskOptions = {
          method: chatMode2, // This must be a string for JSON-RPC
          prompt: content,
          conversationId: conversationId,
          conversationHistory: this.buildConversationHistory(activeConversation),
          llmSelection: this.getLLMSelection(),
          executionMode: effectiveMode,
          agentType: activeConversation.agent.type,
          agentName: activeConversation.agent.name,
          taskId: preGeneratedTaskId,
          mode: chatMode2,
          timeoutSeconds: chatMode2 === 'build' ? AGENT_TASK_TIMEOUT_SECONDS : 60,
          metadata: enhancedMetadata, // Include context metadata with conversationId
        };

        // Execute task using service
        await taskExecution.createAndExecuteTask(taskOptions, {
          onPlaceholder: (taskId, mode) => this.createPlaceholderMessage(conversationId, taskId, mode),
          onCompletion: (taskId, immediateTask) => this.handleTaskCompletion(conversationId, taskId, immediateTask),
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

    async createOrchestrationDraft(input: {
      planDraft: Record<string, any>;
      summary?: string | null;
      metadata?: Record<string, any>;
      createdBy?: string | null;
    }): Promise<ConversationPlanRecord | null> {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        throw new Error('No active conversation available for orchestration creation');
      }

      const conversationId = await this.ensureBackendConversation(activeConversation);
      const authStore = useAuthStore();
      const response = await agentExecutionService.executeAgentTask(
        authStore.currentNamespace ?? null,
        activeConversation.agent.name,
        {
          mode: 'plan_create',
          conversationId,
          userMessage: input.summary ?? 'Generate plan',
          payload: {
            planDraft: input.planDraft,
            summary: input.summary ?? null,
            metadata: input.metadata ?? {},
            createdBy: input.createdBy ?? null,
          },
        },
      );

      if (!response.success) {
        throw new Error(response.humanResponse?.message ?? 'Failed to create orchestration draft');
      }

      const planRecord = response.payload?.content as ConversationPlanRecord | undefined;
      if (planRecord) {
        activeConversation.plans = activeConversation.plans ?? [];
        activeConversation.plans.unshift(planRecord);
        activeConversation.latestPlanId = planRecord.id;
        activeConversation.latestPlan = planRecord;
        const planMessage = messageFormatting.createPlanMessage(planRecord);
        activeConversation.messages.push(planMessage);
        return planRecord;
      }

      return null;
    },

    async executeOrchestrationRun(input: {
      planId?: string | null;
      orchestrationSlug?: string | null;
      promptParameters?: Record<string, any>;
      metadata?: Record<string, any>;
    }): Promise<OrchestrationRunRecord | null> {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        throw new Error('No active conversation available for orchestration execution');
      }

      if (!input.planId && !input.orchestrationSlug) {
        throw new Error('planId or orchestrationSlug is required to execute an orchestration');
      }

      const conversationId = await this.ensureBackendConversation(activeConversation);

      const authStore = useAuthStore();
      let response: AgentTaskResponse;
      let streamId: string | undefined;

      try {
        response = await agentExecutionService.executeAgentTask(
          authStore.currentNamespace ?? null,
          activeConversation.agent.name,
          {
            mode: 'orchestrate_execute',
            conversationId,
            planId: input.planId ?? undefined,
            orchestrationSlug: input.orchestrationSlug ?? undefined,
            promptParameters: input.promptParameters,
            payload: {
              metadata: { ...(input.metadata ?? {}) },
              options: { stream: true },
            },
            metadata: {
              stream: true,
              ...(input.metadata ?? {}),
            },
          },
        );

        if (!response.success) {
          throw new Error(
            response.humanResponse?.message ?? 'Failed to execute orchestration',
          );
        }

        const streamingMetadata = response.payload?.metadata as Record<string, any> | undefined;
        if (streamingMetadata) {
          streamId = this.extractStreamId(streamingMetadata);
          if (streamId) {
            const mergedMetadata = { ...streamingMetadata, streamId };
            try {
              await this.startStreamSubscription(
                activeConversation,
                mergedMetadata,
                'Launching orchestration run…',
              );
            } catch (error) {
              console.warn('⚠️ Unable to subscribe to orchestration stream', error);
            }
          }
        }

        const runRecord = response.payload?.content as OrchestrationRunRecord | undefined;
        if (runRecord) {
          this.updateOrchestrationRunRecord(activeConversation, runRecord);
          if (streamId) {
            this.finalizeStreamMessage(activeConversation, streamId, runRecord);
            this.cleanupStreamSubscription(activeConversation, streamId);
          }
          return runRecord;
        }

        if (streamId) {
          this.markStreamError(
            activeConversation,
            streamId,
            'No orchestration run returned from server',
          );
        }
        return null;
      } catch (error) {
        if (streamId) {
          if (error instanceof Error) {
            this.markStreamError(activeConversation, streamId, error.message);
          } else {
            this.markStreamError(activeConversation, streamId, 'Unknown error');
          }
        }
        throw error;
      }
    },

    async continueOrchestrationRun(input: {
      runId: string;
      update?: Record<string, any>;
    }): Promise<OrchestrationRunRecord | null> {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        throw new Error('No active conversation available to continue orchestration');
      }

      const conversationId = await this.ensureBackendConversation(activeConversation);

      const authStore = useAuthStore();
      let response: AgentTaskResponse;
      let streamId: string | undefined;

      try {
        response = await agentExecutionService.executeAgentTask(
          authStore.currentNamespace ?? null,
          activeConversation.agent.name,
          {
            mode: 'orchestrate_continue',
            conversationId,
            orchestrationRunId: input.runId,
            payload: {
              update: input.update ?? {},
              options: { stream: true },
            },
            metadata: {
              stream: true,
            },
          },
        );

        if (!response.success) {
          throw new Error(
            response.humanResponse?.message ?? 'Failed to continue orchestration run',
          );
        }

        const streamingMetadata = response.payload?.metadata as Record<string, any> | undefined;
        if (streamingMetadata) {
          streamId = this.extractStreamId(streamingMetadata);
          if (streamId) {
            const mergedMetadata = { ...streamingMetadata, streamId };
            try {
              await this.startStreamSubscription(
                activeConversation,
                mergedMetadata,
                'Updating orchestration run…',
              );
            } catch (error) {
              console.warn('⚠️ Unable to subscribe to orchestration stream', error);
            }
          }
        }

        const runRecord = response.payload?.content as OrchestrationRunRecord | undefined;
        if (runRecord) {
          this.updateOrchestrationRunRecord(activeConversation, runRecord);
          if (streamId) {
            this.finalizeStreamMessage(activeConversation, streamId, runRecord);
            this.cleanupStreamSubscription(activeConversation, streamId);
          }
          return runRecord;
        }

        if (streamId) {
          this.markStreamError(
            activeConversation,
            streamId,
            'No orchestration run returned from server',
          );
        }
        return null;
      } catch (error) {
        if (streamId) {
          if (error instanceof Error) {
            this.markStreamError(activeConversation, streamId, error.message);
          } else {
            this.markStreamError(activeConversation, streamId, 'Unknown error');
          }
        }
        throw error;
      }
    },

    async saveOrchestrationRecipe(input: {
      orchestration: AgentOrchestrationRecord | Record<string, any>;
      metadata?: Record<string, any>;
    }): Promise<AgentOrchestrationRecord | null> {
      const activeConversation = this.getActiveConversation();
      if (!activeConversation) {
        throw new Error('No active conversation available to save orchestration');
      }

      const conversationId = await this.ensureBackendConversation(activeConversation);
      const authStore = useAuthStore();
      const response = await agentExecutionService.executeAgentTask(
        authStore.currentNamespace ?? null,
        activeConversation.agent.name,
        {
          mode: 'orchestrate_save_recipe',
          conversationId,
          payload: {
            orchestration: input.orchestration,
            metadata: input.metadata ?? {},
          },
        },
      );

      if (!response.success) {
        throw new Error(response.humanResponse?.message ?? 'Failed to save orchestration recipe');
      }

      const saved = response.payload?.content as AgentOrchestrationRecord | undefined;
      if (saved) {
        activeConversation.savedOrchestrations = activeConversation.savedOrchestrations ?? [];
        const existingIndex = activeConversation.savedOrchestrations.findIndex(item => item.id === saved.id);
        if (existingIndex >= 0) {
          activeConversation.savedOrchestrations.splice(existingIndex, 1, saved);
        } else {
          activeConversation.savedOrchestrations.unshift(saved);
        }
        const savedMessage = messageFormatting.createSavedOrchestrationMessage(saved);
        activeConversation.messages.push(savedMessage);
        return saved;
      }

      return null;
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
    createPlaceholderMessage(conversationId: string, taskId: string, mode?: string | any) {
      const conv = this.getConversationById(conversationId);
      if (!conv) return;

      // Ensure mode is a string before passing to messageFormatting
      const modeString = typeof mode === 'string' ? mode : undefined;
      const placeholderMessage = messageFormatting.createPlaceholderMessage(taskId, modeString);
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
    async handleTaskCompletion(conversationId: string, taskId: string, immediateTask?: any) {

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

      let existingMessage = conv.messages.find(msg => 
        msg.taskId === taskId && msg.role === 'assistant'
      );

      if (!existingMessage) {
        // Fallback: if we can't find the placeholder by taskId (e.g., ID changed), create a new assistant message to ensure UI shows content
        existingMessage = {
          id: `response-${Date.now()}`,
          role: 'assistant',
          content: 'Working on that…',
          timestamp: new Date(),
          taskId,
          metadata: {
            isPlaceholder: true,
            isCompleted: false,
          },
        } as any;
        conv.messages.push(existingMessage);
      }



      try {
        // Guard against undefined taskId; try to derive from immediateTask
        let effectiveTaskId = taskId;
        if (!effectiveTaskId && immediateTask) {
          effectiveTaskId = (immediateTask as any).taskId || (immediateTask as any).id || undefined;
        }
        if (!effectiveTaskId) {
          console.error('handleTaskCompletion called without a valid taskId; aborting to avoid /tasks/undefined');
          return;
        }

        // Retry mechanism for database timing issues (task not yet committed)
        let completedTask;
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelays = [100, 200, 400, 800, 1600]; // Exponential backoff in ms
        
        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              console.log(`🔄 Retry ${retryCount}/${maxRetries} fetching task ${effectiveTaskId}`);
            }
            // Suppress error notifications for retry attempts (not the final one)
            const suppressErrors = retryCount < maxRetries;
            completedTask = await tasksService.getTask(effectiveTaskId, { suppressErrors });
            break; // Success - exit retry loop
          } catch (error: any) {
            // Only retry on 404 (task not yet in DB)
            if (error?.response?.status === 404 && retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount]));
              retryCount++;
            } else {
              // Non-404 error or max retries reached - rethrow
              throw error;
            }
          }
        }


        if (completedTask.status !== 'completed') {
          // Fallback: use immediate task result returned from the POST if available
          if (immediateTask && immediateTask.status === 'completed' && immediateTask.result) {
            completedTask = {
              ...completedTask,
              status: 'completed',
              response: typeof immediateTask.result === 'string' ? immediateTask.result : JSON.stringify(immediateTask.result),
              llmMetadata: (immediateTask.metadata && (immediateTask.metadata.llmUsed || immediateTask.metadata.llmMetadata)) || completedTask.llmMetadata,
              metadata: immediateTask.metadata || completedTask.metadata,
            } as any;
          } else {
            console.warn(`Task ${effectiveTaskId} is not completed, status: ${completedTask.status}`);
            return;
          }
        }


        // Extract final content for display - backend handles deliverable creation
        const finalContent = messageFormatting.extractDeliverableContent(completedTask);

        // Parse the response to get deliverable/plan info (backend puts it in the response JSON)
        let deliverableId = null;
        let planId = null;
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


            // Backend puts deliverable/plan info in the A2A protocol structure
            // Check new A2A protocol structure first (result.payload.content)
            const content = parsedResponse?.result?.payload?.content;

            if (content?.deliverable) {
              // Build mode - extract deliverable
              const deliverable = content.deliverable;
              deliverableId = deliverable.id;
              // Version info is in currentVersion
              if (deliverable.currentVersion) {
                newVersionId = deliverable.currentVersion.id;
                versionNumber = deliverable.currentVersion.versionNumber;
              }
            } else if (content?.plan) {
              // Plan mode - extract plan
              const plan = content.plan;
              planId = plan.id;
              // Version info is in currentVersion
              if (plan.currentVersion) {
                newVersionId = plan.currentVersion.id;
                versionNumber = plan.currentVersion.versionNumber;
              }
            } else {
              // Fallback to old structure
              deliverableId = parsedResponse?.deliverableId;
              planId = parsedResponse?.planId;
              newVersionId = parsedResponse?.newVersionId;
              versionNumber = parsedResponse?.versionNumber;
            }
            
          } catch (e) {
            // Failed to parse deliverable response
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
        console.log('🔍 [FRONTEND-DEBUG] Task LLM metadata:', completedTask.llmMetadata);
        console.log('🔍 [FRONTEND-DEBUG] Has sanitizationMetadata:', !!parsedResponse?.metadata?.sanitizationMetadata);
        console.log('🔍 [FRONTEND-DEBUG] Full sanitizationMetadata:', parsedResponse?.metadata?.sanitizationMetadata);

        // Import the converter at the top of the function if needed
        const { convertToSimplifiedPII } = await import('@/utils/pii-converter');
        
        // Extract PII metadata from the correct location
        const legacyPiiMetadata = parsedResponse?.metadata?.piiMetadata || 
                                  parsedResponse?.piiMetadata ||
                                  // Include server-provided top-level metadata from the task result
                                  (completedTask as any)?.metadata?.piiMetadata ||
                                  // Fallback to LLM-level metadata carried with the task
                                  completedTask?.llmMetadata?.piiMetadata;
        
        // Convert to simplified format
        const simplifiedPiiMetadata = convertToSimplifiedPII(legacyPiiMetadata);
        
        // Log the conversion
        if (simplifiedPiiMetadata) {
          console.log('✅ [SIMPLIFIED-PII] Created simplified metadata:', simplifiedPiiMetadata);
          console.log('✅ [SIMPLIFIED-PII] Flag count:', simplifiedPiiMetadata.flagCount);
          console.log('✅ [SIMPLIFIED-PII] Pseudonym count:', simplifiedPiiMetadata.pseudonymCount);
        }
        
        // Merge agent result metadata with task LLM metadata
        const mergedMetadata = {
          // Prefer agent/LLM metadata embedded in the response
          ...parsedResponse?.metadata,
          // Merge server-provided top-level metadata (tokens, timing, pii)
          ...((completedTask as any)?.metadata || {}),
          // Include LLM metadata from the task record
          ...(completedTask.llmMetadata && {
            llmMetadata: completedTask.llmMetadata,
          }),
          // Include legacy PII metadata for backward compatibility
          ...(legacyPiiMetadata && {
            piiMetadata: legacyPiiMetadata,
          }),
          // Include new simplified PII metadata
          ...(simplifiedPiiMetadata && {
            simplifiedPii: simplifiedPiiMetadata,
          }),
          // Also check for sanitizationMetadata at the top level
          ...(parsedResponse?.sanitizationMetadata && {
            sanitizationMetadata: parsedResponse.sanitizationMetadata,
          }),
        };

        console.log('🔍 [FRONTEND-DEBUG] Merged metadata for message:', mergedMetadata);
        console.log('🔍 [FRONTEND-DEBUG] PII metadata extracted:', parsedResponse?.piiMetadata);
        
        // Add detailed PII debugging
        console.log('🎯 [PII-CHECK] Full parsedResponse:', parsedResponse);
        console.log('🎯 [PII-CHECK] completedTask.response type:', typeof completedTask.response);
        console.log('🎯 [PII-CHECK] completedTask.llmMetadata:', completedTask.llmMetadata);
        
        // Check multiple locations for PII metadata
        const piiLocations = {
          'parsedResponse.piiMetadata': parsedResponse?.piiMetadata,
          'parsedResponse.metadata.piiMetadata': parsedResponse?.metadata?.piiMetadata,
          'completedTask.llmMetadata.piiMetadata': completedTask.llmMetadata?.piiMetadata,
          'completedTask.piiMetadata': completedTask.piiMetadata,
        };
        
        console.log('🔍 [PII-SEARCH] Checking all possible locations:', piiLocations);
        
        // Find where PII metadata actually is
        const actualPiiMetadata = parsedResponse?.metadata?.piiMetadata || 
                                  parsedResponse?.piiMetadata || 
                                  completedTask.piiMetadata;
        
        if (actualPiiMetadata) {
          console.log('✅ [PII-FOUND] PII metadata detected!', actualPiiMetadata);
          console.log('✅ [PII-FOUND] Flaggings:', actualPiiMetadata.flaggings);
          console.log('✅ [PII-FOUND] Pseudonyms Applied:', actualPiiMetadata.pseudonymsApplied);
        } else {
          console.log('❌ [PII-MISSING] No PII metadata found in any location');
        }

        existingMessage.metadata = {
          ...existingMessage.metadata,
          ...mergedMetadata,
          isPlaceholder: false,
          isCompleted: true,
          completedAt: new Date().toISOString()
        };

        // Update message metadata immediately for deliverables/plans (synchronous - triggers immediate UI update)
        if (deliverableId) {
          (existingMessage as any).deliverableId = deliverableId;
          existingMessage.metadata = {
            ...existingMessage.metadata,
            deliverableId: deliverableId
          };
        }

        if (planId) {
          (existingMessage as any).planId = planId;
          existingMessage.metadata = {
            ...existingMessage.metadata,
            planId: planId
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
        const finalMessageIndex = conv.messages.findIndex(msg => msg.taskId === effectiveTaskId && msg.role === 'assistant');
        if (finalMessageIndex >= 0) {
          const updatedMessage = { ...existingMessage };
          conv.messages[finalMessageIndex] = updatedMessage;
        }

        // Load deliverables in background (non-blocking) - fire and forget
        if (deliverableId) {
          this.loadDeliverableInBackground(deliverableId, conversationId);
        }

        // If this is a plan response, extract and set the full plan data
        if (planId && parsedResponse?.result?.payload?.content?.plan) {
          const fullPlan = parsedResponse.result.payload.content.plan;
          const fullVersion = parsedResponse.result.payload.content.version;
          console.log('✅ [Plan Response] Setting currentPlan:', fullPlan);

          // Add to planStore for reactivity
          const { usePlanStore } = await import('@/stores/planStore');
          const planStore = usePlanStore();
          planStore.addPlan(fullPlan, fullVersion);

          // Also set on conversation for direct access
          conv.currentPlan = fullPlan;
          conv.latestPlanId = planId;
        }

        // Cleanup WebSocket subscriptions
        websocketHandler.unsubscribeFromTask(effectiveTaskId);


      } catch (error) {
        console.error(`🏁 DEBUG: Failed to handle task completion for ${taskId}:`, error);
        conv.error = error instanceof Error ? error.message : 'Failed to load task result';
      } finally {
        // Clean up completion tracking
        (this as any)._completingTasks?.delete(taskId);
        // Always clear sending state when a task completes
        const convDone = this.getConversationById(conversationId);
        if (convDone) {
          convDone.isSendingMessage = false;
        }
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
          // Check new A2A protocol structure first (result.payload.content.deliverable.id)
          if (parsedResponse?.result?.payload?.content?.deliverable?.id) {
            deliverableId = parsedResponse.result.payload.content.deliverable.id;
          } else if (parsedResponse?.deliverableId) {
            deliverableId = parsedResponse.deliverableId;
          } else if (parsedResponse?.success?.deliverableId) {
            deliverableId = parsedResponse.success.deliverableId;
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
      const active = this.getActiveConversation();
      // For Converse and Plan, prefer the system model from model-config service
      if (active?.chatMode === 'converse' || active?.chatMode === 'plan') {
        // Best effort: if system model cached, use it; otherwise fall back to current selection
        const sys = (llmStore as any)._systemModelSelection;
        if (sys) return sys;
      }
      return llmStore.currentLLMSelection;
    },

    /**
     * Internal: choose a fast local/cheap model for quick replies
     */
    _pickFastConversationModel(llmStore: any) {
      // Deprecated: Switching Converse to system model via model-config
      return null;
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
              // Task is not running, no action needed
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
    },

    /**
     * Set flag to indicate last message was sent via speech-to-text
     */
    setLastMessageWasSpeech(wasSpeech: boolean) {
      this.lastMessageWasSpeech = wasSpeech;
    },

    // ========================================================================
    // MODE × ACTION ARCHITECTURE ACTIONS
    // Import plan and deliverable actions from separate modules
    // ========================================================================
    ...planActions,
    ...deliverableActions,
  }
});
