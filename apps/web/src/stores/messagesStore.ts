import { defineStore } from 'pinia';
import { ChatMessage, MessageSender, AgentInfo, MessageDisplayType, TaskResponse } from '../types/chat';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
// Removed obsolete import
import { apiService } from '../services/apiService';
import { useLLMStore } from './llmStore';
import type { LLMSelection } from '../types/llm';
import { useUiStore } from './uiStore'; // Import UI store to manage loading state
import { useAgentsStore } from './agentsStore'; // Keep this for instantiating agentsStore
import { useSessionStore } from './sessionStore'; // Import session store

export interface MessagesState {
  messages: ChatMessage[];
}

export const useMessagesStore = defineStore('messages', {
  state: (): MessagesState => ({
    messages: [],
  }),
  actions: {
    _addMessage(text: string | undefined, sender: MessageSender, agentName?: string, messageType: MessageDisplayType = 'text', data?: any) {
      const newMessage: ChatMessage = {
        id: uuidv4(),
        text: text, // text can be undefined for non-text messages
        sender,
        timestamp: new Date(),
        messageType,
        data,
      };
      if (agentName && (sender === 'agent' || sender === 'system')) {
        newMessage.agentName = agentName;
      }
      this.messages.push(newMessage);
    },
    addUserMessage(text: string) {
      this._addMessage(text, 'user', undefined, 'text');
    },
    addAgentMessage(text: string, agentName: string) {
      this._addMessage(text, 'agent', agentName, 'text');
    },
    addSystemMessage(text: string, messageType: MessageDisplayType = 'text', data?: any) {
      this._addMessage(text, 'system', "System", messageType, data);
    },
    addAgentListMessage(agents: AgentInfo[]) {
      this._addMessage(undefined, 'system', "System", 'agentList', { agents });
    },
    clearMessages() {
      this.messages = [];
      const sessionStore = useSessionStore(); // Also clear session on full message clear
      sessionStore.setCurrentSessionId(null);
    },
    async submitMessageToOrchestrator(text: string, llmSelection?: LLMSelection) {
      if (!text.trim()) return;
      
      const uiStore = useUiStore();
      const agentsStore = useAgentsStore();
      const sessionStore = useSessionStore();
      const llmStore = useLLMStore();

      const discoveryKeywords = ['list agents', 'show agents', 'available agents', 'what can you do', 'help'];
      const lowerCaseText = text.toLowerCase().trim();
      const isDiscoveryRequest = discoveryKeywords.some(keyword => lowerCaseText.includes(keyword));

      if (isDiscoveryRequest) {
        uiStore.setAppLoading(true);
        try {
            await agentsStore.fetchAvailableAgents();
            if (agentsStore.getAvailableAgents.length > 0) {
                this.addAgentListMessage(agentsStore.getAvailableAgents);
            } else if (agentsStore.getAgentError) {
                this.addSystemMessage(`Error fetching agents: ${agentsStore.getAgentError}`);
            } else {
                this.addSystemMessage("No agents are currently available or an error occurred.");
            }
        } catch (e) {
            this.addSystemMessage("Failed to fetch agent information.");
        }
        uiStore.setAppLoading(false);
        return;
      }

      uiStore.setAppLoading(true);
      try {
        const sessionStore = useSessionStore();
        const currentSessionId = sessionStore.currentSessionId;
        
        // Use enhanced messaging if LLM preferences are provided and we have a session
        if (llmSelection && currentSessionId) {
          try {
            console.log('[MESSAGES_STORE] Using enhanced messaging with LLM preferences:', llmSelection);
            
            const enhancedResponse = await apiService.sendEnhancedMessage(currentSessionId, {
              content: text,
              llmSelection: llmSelection
            });
            
            console.log('[MESSAGES_STORE] Enhanced message response:', enhancedResponse);
            
            // Enhanced messaging saves to database, so refresh session messages to get both user and assistant messages
            await sessionStore.fetchMessagesForCurrentSession();
            
            uiStore.setAppLoading(false);
            return;
          } catch (enhancedError) {
            console.warn('[MESSAGES_STORE] Enhanced messaging failed, falling back to orchestrator:', enhancedError);
            // Fall through to legacy orchestrator method
          }
        }
        
        // Legacy orchestrator method - also refresh session to avoid duplication
        const finalLLMSelection = llmSelection || llmStore.currentLLMSelection;
        const conversationHistory = sessionStore.currentSessionMessages
          .filter(msg => msg.content) // Only include messages with content
          .map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content || '',
            metadata: msg.metadata
          }));
        
        console.log('[MESSAGES_STORE] Sending to orchestrator with conversation history:', conversationHistory.length, 'messages');
        
        const taskResponse: TaskResponse = await apiService.postTaskToOrchestrator(text, currentSessionId, conversationHistory);
        console.log('[MESSAGES_STORE] Raw Task Response from orchestrator:', JSON.stringify(taskResponse, null, 2));

        if (taskResponse.session_id) {
          sessionStore.setCurrentSessionId(taskResponse.session_id);
        }

        // Extract agent information from response
        let agentName = 'Agent'; // default
        let agentMetadata: any = {};
        
        if (taskResponse.metadata) {
          agentName = taskResponse.metadata.delegatedTo || 
                      taskResponse.metadata.originalAgent?.agentName ||
                      taskResponse.metadata.agentName ||
                      taskResponse.metadata.responding_agent_name ||
                      taskResponse.metadata.respondingAgentName ||
                      'Agent';
          agentMetadata = { ...taskResponse.metadata };
        }
        
        if (taskResponse.response_message?.metadata?.responding_agent_name) {
          agentName = taskResponse.response_message.metadata.responding_agent_name;
          agentMetadata = { ...agentMetadata, ...taskResponse.response_message.metadata };
        }
        
        // Extract response text
        let responseText = '';
        if (taskResponse.response_message?.parts?.[0]?.text) {
          responseText = taskResponse.response_message.parts[0].text;
        } else if (taskResponse.result) {
          responseText = typeof taskResponse.result === 'string' ? taskResponse.result : (taskResponse.result as any).response || taskResponse.result;
        }
        
        // The orchestrator saves messages to the database
        // We need to update the session store (not this store) since that's what the UI displays
        
        // Create proper message objects for the session store
        const userMessageOrder = sessionStore.currentSessionMessages.length > 0 
          ? Math.max(...sessionStore.currentSessionMessages.map(m => m.order)) + 1 
          : 1;
          
        const userMsg = {
          id: `temp-user-${Date.now()}`,
          session_id: currentSessionId || 'no-session',
          user_id: 'user',
          role: 'user' as const,
          content: text,
          timestamp: new Date().toISOString(),
          order: userMessageOrder,
          metadata: {}
        };
        
        // Add to session store (which is what the UI displays)
        sessionStore.addMessageToCurrentSession(userMsg);
        
        if (responseText) {
          // Ensure agentMetadata includes agentName
          if (!agentMetadata.agentName && agentName !== 'Agent') {
            agentMetadata.agentName = agentName;
          }
          
          const agentMsg = {
            id: taskResponse.id || `temp-agent-${Date.now()}`,
            session_id: currentSessionId || 'no-session',
            user_id: 'assistant',
            role: 'assistant' as const,
            content: responseText,
            timestamp: new Date().toISOString(),
            order: userMessageOrder + 1,
            metadata: agentMetadata
          };
          
          // Add to session store with full metadata
          sessionStore.addMessageToCurrentSession(agentMsg);
          console.log('[MESSAGES_STORE] Added agent message to session store with metadata:', agentMetadata);
        }
      } catch (error) {
        console.error("Error submitting task to orchestrator:", error);
        this.addSystemMessage(
          error instanceof Error ? error.message : "Sorry, an error occurred while processing your request.",
          'text'
        );
      } finally {
        uiStore.setAppLoading(false);
      }
    },
  },
  getters: {
    getMessages: (state): ChatMessage[] => state.messages,
  },
}); 