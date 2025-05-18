import { defineStore } from 'pinia';
import { ChatMessage, MessageSender, AgentInfo, MessageDisplayType, TaskResponse } from '../types/chat';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { postTaskToOrchestrator } from '../services/apiService'; // Name is already updated
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
      sessionStore.clearSession();
    },
    async submitMessageToOrchestrator(text: string) {
      if (!text.trim()) return;
      this.addUserMessage(text);
      
      const uiStore = useUiStore();
      const agentsStore = useAgentsStore();
      const sessionStore = useSessionStore();

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
        const currentSessionId = sessionStore.getCurrentSessionId;
        const taskResponse: TaskResponse = await postTaskToOrchestrator(text, currentSessionId);
        console.log('[MESSAGES_STORE] Raw Task Response from orchestrator:', JSON.stringify(taskResponse, null, 2));

        if (taskResponse.session_id) {
          sessionStore.setCurrentSessionId(taskResponse.session_id);
        }

        const taskId = taskResponse.id;
        const taskStatus = taskResponse.status?.state; // Should be string: e.g., "completed"
        const agentResponseMessage = taskResponse.response_message;
        const agentOutput = agentResponseMessage?.parts?.find(part => part.type === 'text')?.text;
        
        // Enhanced logging for debugging the conditional flow
        console.log('[MESSAGES_STORE] Parsed values for condition check:');
        console.log('[MESSAGES_STORE] taskId:', taskId, '(type:', typeof taskId, ')');
        console.log('[MESSAGES_STORE] taskStatus:', taskStatus, '(type:', typeof taskStatus, ')');
        console.log('[MESSAGES_STORE] agentOutput:', agentOutput, '(type:', typeof agentOutput, ')');
        console.log('[MESSAGES_STORE] Condition (agentOutput && taskStatus === \'completed\'):', (agentOutput && taskStatus === 'completed'));

        let respondingAgentName = "Agent";
        if (agentResponseMessage?.role === 'agent') {
          respondingAgentName = 
            agentResponseMessage.metadata?.source_agent_name || 
            agentResponseMessage.metadata?.agent_name || 
            agentResponseMessage.metadata?.agent_id || 
            "Agent";
        }

        if (agentOutput && taskStatus === 'completed') { 
          console.log('[MESSAGES_STORE] Condition met: Adding agent message.');
          this.addAgentMessage(agentOutput, respondingAgentName);
        } else if (taskStatus === 'failed') {
          console.log('[MESSAGES_STORE] Condition met: Task failed.');
          this.addSystemMessage(
            `Task ${taskId || 'unknown'} failed. ${taskResponse.status?.message || 'No specific error details.'}`
          );
        } else if (taskStatus === 'completed' && !agentOutput) {
          console.log('[MESSAGES_STORE] Condition met: Task completed but no output.');
          this.addSystemMessage(
            `Task ${taskId || 'unknown'} completed but no output was provided.`
          );
        } else { 
          console.log('[MESSAGES_STORE] Condition met: Fallback - other status or issue.');
          this.addSystemMessage(`Task ${taskId || 'unknown'} status: ${taskStatus || 'unknown'}. ${taskResponse.status?.message || 'Waiting for result...'}`);
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