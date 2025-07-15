<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar :class="{ 'ios-header-style': isIOS }">
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            v-if="auth.isAuthenticated && sessionStore.currentSessionId" 
            fill="clear" 
            @click="toggleDebugPanel"
            :color="showDebugPanel ? 'primary' : 'medium'"
          >
            <ion-icon :icon="bugOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" :class="{ 'ion-padding': !agentChatStore.hasCurrentAgent }" ref="chatContentEl">
      <!-- Agent Chat View -->
      <AgentChatView 
        v-if="agentChatStore.hasCurrentAgent" 
        @close="handleCloseAgentChat"
      />
      
      <!-- Regular Chat View -->
      <div v-else>
        <div v-if="!auth.isAuthenticated" class="ion-text-center ion-padding">
           <p>Please <router-link to="/login">login</router-link> to start chatting.</p>
        </div>
        <div v-else-if="!sessionStore.currentSessionId && !sessionStore.isLoadingMessages" class="ion-text-center ion-padding">
          <p>Select a session or start a new chat from the menu.</p>
        </div>
        <div v-else-if="sessionStore.isLoadingMessages" class="ion-text-center ion-padding">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading messages...</p>
        </div>
        <div v-else-if="sessionStore.messagesError" class="ion-text-center ion-padding">
          <ion-text color="danger">Error loading messages: {{ sessionStore.messagesError }}</ion-text>
        </div>
        <MessageListComponent 
          v-else 
          :messages="sessionStore.currentSessionMessages" 
          @messages-rendered="handleMessagesRenderedInChild" 
          @returnToOrchestrator="handleReturnToOrchestrator"
          @viewAllAgentsClicked="handleViewAllAgents"
          @viewAgentCapabilitiesClicked="handleViewAgentCapabilities"
          @agentCapabilityRequestedFor="handleAgentCapabilityRequestedFor" />
      </div>
    </ion-content>

    <ion-footer v-if="auth.isAuthenticated && sessionStore.currentSessionId && !agentChatStore.hasCurrentAgent">
      <EnhancedChatInput @send-message="handleEnhancedSendMessage" :disabled="uiStore.getIsAppLoading" />
      <div v-if="uiStore.getIsAppLoading" class="loading-indicator ion-padding-start ion-padding-bottom">
        <ion-spinner name="dots" color="primary"></ion-spinner>
      </div>
    </ion-footer>

    <!-- Agent List Modal -->
    <AgentCapabilitiesModal 
      :is-open="showAgentModal"
      :agents="availableAgents"
      @dismiss="closeAgentModal"
      @agentSelected="handleAgentSelected"
    />

    <!-- Individual Agent Capabilities Modal -->
    <AgentCapabilitiesModal 
      :is-open="showAgentCapabilitiesModal"
      :single-agent="currentAgentCapabilities"
      @dismiss="closeAgentCapabilitiesModal"
    />

    <!-- Delegation Debug Panel -->
    <DelegationDebugPanel 
      :visible="showDebugPanel"
      @close="closeDebugPanel"
    />
  </ion-page>
</template>


<script setup lang="ts">
import { 
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonFooter, IonSpinner, IonText, 
  isPlatform, IonButtons, IonMenuButton, IonButton, IonIcon
} from '@ionic/vue';
import { bugOutline, appsOutline } from 'ionicons/icons';
import { onMounted, onUnmounted, computed, watch, nextTick, ref } from 'vue';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { useMessagesStore } from '@/stores/messagesStore';
import { useRouter } from 'vue-router';
// Removed obsolete import
import { storeToRefs } from 'pinia';
import { Message } from '../services/sessionService';
import { apiService } from '../services/apiService';

import MessageListComponent from '../components/MessageList.vue';
import ChatInputComponent from '../components/ChatInput.vue';
import EnhancedChatInput from '../components/EnhancedChatInput.vue';
import AgentCapabilitiesModal from '@/components/AgentCapabilitiesModal.vue';
import DelegationDebugPanel from '@/components/DelegationDebugPanel.vue';
import AgentChatView from '@/components/AgentChatView.vue';
import { useAgentChatStore } from '@/stores/agentChatStore';

const auth = useAuthStore();
const sessionStore = useSessionStore();
const uiStore = useUiStore();
const messagesStore = useMessagesStore();
const agentChatStore = useAgentChatStore();
const router = useRouter();

const { currentSessionId, currentSessionMessages } = storeToRefs(sessionStore);
const chatContentEl = ref<InstanceType<typeof IonContent> | null>(null);

// Modal state
const showAgentModal = ref(false);
const availableAgents = ref<Array<{ name: string; description: string }>>([]);
const expectingAgentList = ref(false); // Track when we expect an agent list response

// Agent capabilities modal state
const showAgentCapabilitiesModal = ref(false);
const currentAgentCapabilities = ref<any>(null);

// Debug panel state
const showDebugPanel = ref(false);


const isIOS = computed(() => isPlatform('ios'));

const currentSessionName = computed(() => {
  if (currentSessionId.value) {
          return `Orchestrator AI Chat`;
  }
      return 'Orchestrator AI';
});

const pageTitle = computed(() => {
  if (agentChatStore.hasCurrentAgent) {
    return `Agent Chat - ${agentChatStore.currentAgent?.name}`;
  }
  return currentSessionName.value || 'Orchestrator AI';
});

const handleMessagesRenderedInChild = () => {
  console.log("[HomePage] Received messages-rendered event from MessageList.");
  scrollToBottom();
};

const scrollToBottom = async () => {
  console.log("[HomePage] scrollToBottom called (triggered by messages-rendered)");
  await new Promise(resolve => setTimeout(resolve, 100));

  const contentHostElement = chatContentEl.value?.$el as HTMLElement | undefined;
  if (!contentHostElement) {
    console.warn("[HomePage] IonContent $el not found.");
    return;
  }

  let scrollElement = contentHostElement.querySelector('.inner-scroll') as HTMLElement || 
                      (contentHostElement.shadowRoot ? contentHostElement.shadowRoot.querySelector('.inner-scroll') as HTMLElement : null) || 
                      contentHostElement;
  
  if (scrollElement === contentHostElement && scrollElement.firstElementChild && scrollElement.firstElementChild.scrollHeight > scrollElement.scrollHeight) {
    console.log("[HomePage] Host element $el might not be the scroller, trying its first child.");
    scrollElement = scrollElement.firstElementChild as HTMLElement;
  }

  if (scrollElement && typeof scrollElement.scrollTop !== 'undefined') {
    console.log(`[HomePage] Attempting to scroll element: ${scrollElement.tagName}${scrollElement.className ? '.' + scrollElement.className : ''}. Current scrollHeight: ${scrollElement.scrollHeight}, clientHeight: ${scrollElement.clientHeight}, current scrollTop: ${scrollElement.scrollTop}`);
    if (scrollElement.scrollHeight > scrollElement.clientHeight) { 
        scrollElement.scrollTop = scrollElement.scrollHeight;
        console.log("[HomePage] Manually set scrollTop. New scrollTop: " + scrollElement.scrollTop);
    } else {
        console.log("[HomePage] Element is not scrollable (scrollHeight <= clientHeight).");
    }
  } else {
    console.error("[HomePage] Could not find a suitable scrollable element or its scrollTop property.");
  }
};

watch(currentSessionId, (newId, oldId) => {
  console.log("[HomePage] Watcher for currentSessionId triggered. New ID:", newId);
  if (newId && newId !== oldId) {
    if (!newId) currentSessionMessages.value = [];
  }
});

const handleEnhancedSendMessage = async (text: string, llmSelection?: any) => {
  console.log("[HomePage] Enhanced send message called with LLM selection:", llmSelection);
  if (!currentSessionId.value) {
    console.error("No active session to send message to.");
    return;
  }
  
  // Use the messages store's enhanced submission method
  await messagesStore.submitMessageToOrchestrator(text, llmSelection);
};

const handleSendMessage = async (text: string) => {
  if (!currentSessionId.value) {
    console.error("No active session to send message to.");
    return;
  }

  uiStore.setAppLoading(true);
  const userMessageOrder = (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1);
  const userMessage = {
    id: `temp-user-${Date.now()}`,
    session_id: currentSessionId.value,
    user_id: auth.user?.id || 'unknown-user',
    role: 'user' as const,
    content: text,
    timestamp: new Date().toISOString(),
    order: userMessageOrder
  };
  sessionStore.addMessageToCurrentSession(userMessage);
  console.log("[HomePage] User message added to store:", JSON.parse(JSON.stringify(userMessage)));

  try {
    // Prepare conversation history for context (exclude the message we just added)
    const conversationHistory = currentSessionMessages.value
      .filter(msg => msg.id !== userMessage.id) // Exclude the message we just added
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || '',
        metadata: msg.metadata
      }));
    
    console.log("[HomePage] Sending conversation history with", conversationHistory.length, "messages");
    // Log last few messages to see if agent metadata is present
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-3);
      recentMessages.forEach((msg, index) => {
        console.log(`[HomePage] History[${conversationHistory.length - 3 + index}]:`, {
          role: msg.role,
          contentLength: msg.content.length,
          metadata: msg.metadata
        });
      });
    }

    const taskResponse = await apiService.postTaskToOrchestrator(text, currentSessionId.value, conversationHistory);
    console.log("[HomePage] Received taskResponse from orchestrator:", JSON.parse(JSON.stringify(taskResponse)));
    
    // Extract response text
    let agentText = 'No response text.';
    let agentMetadata: Record<string, any> = {};
    
    // Check for response_message.parts
    if (taskResponse.response_message && taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0) {
      agentText = taskResponse.response_message.parts[0]?.text || 'No response text.';
      if (taskResponse.response_message?.metadata?.responding_agent_name) {
        agentMetadata.agentName = taskResponse.response_message.metadata.responding_agent_name;
      }
      console.log("[HomePage] Extracted response from response_message.parts format");
    }
    // Additional fallback - check for direct result field
    else if (taskResponse.result) {
      // Handle both string and object result formats
      if (typeof taskResponse.result === 'string') {
        agentText = taskResponse.result;
      } else if ((taskResponse.result as any).response) {
        agentText = (taskResponse.result as any).response;
        // Extract metadata if available
        if ((taskResponse.result as any).metadata) {
          agentMetadata = { ...(taskResponse.result as any).metadata };
        }
      }
      console.log("[HomePage] Extracted response from direct result field, metadata:", agentMetadata);
    }
    
    // Also check taskResponse.metadata for agent information
    if (taskResponse.metadata) {
      // Merge taskResponse.metadata into agentMetadata, preserving any existing values
      agentMetadata = { ...taskResponse.metadata, ...agentMetadata };
      
      // Ensure agentName is set from various possible fields
      if (!agentMetadata.agentName) {
        agentMetadata.agentName = taskResponse.metadata.delegatedTo || 
                                  taskResponse.metadata.originalAgent?.agentName ||
                                  taskResponse.metadata.agentName ||
                                  taskResponse.metadata.responding_agent_name ||
                                  taskResponse.metadata.respondingAgentName;
      }
      console.log("[HomePage] Merged taskResponse.metadata, final agentMetadata:", agentMetadata);
    }
    else {
      console.warn("[HomePage] No response found in taskResponse:", JSON.parse(JSON.stringify(taskResponse)));
    }

    const agentMessageOrder = (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1);

    // Check if this response should show a modal based on structured metadata
    const contentType = (taskResponse.result as any)?.metadata?.contentType || agentMetadata.contentType;
    
    if (contentType === 'agentListModal') {
      console.log("[HomePage] Detected agent list modal response");
      
      // Extract agent list from structured metadata
      const agentListData = (taskResponse.result as any)?.metadata?.agentList || agentMetadata.agentList;
      
      if (agentListData && agentListData.length > 0) {
        // Use the structured data directly
        availableAgents.value = agentListData.map((agent: any) => ({
          name: agent.name,
          description: agent.description
        }));
        showAgentModal.value = true;
        console.log("[HomePage] Showing agent list modal with", agentListData.length, "agents:", agentListData);
      } else {
        console.log("[HomePage] No agent list data found, adding message to chat as fallback");
        // Fallback to showing text message
        const agentMessage: Message = {
          id: taskResponse.id,
          session_id: currentSessionId.value,
          user_id: auth.user?.id || 'unknown-user',
          role: 'assistant',
          content: agentText,
          timestamp: new Date().toISOString(),
          order: agentMessageOrder,
          metadata: agentMetadata
        };
        sessionStore.addMessageToCurrentSession(agentMessage);
      }
      
      // Reset the expectation flag
      expectingAgentList.value = false;
    } else if (contentType === 'agentCapabilitiesModal') {
      console.log("[HomePage] Detected agent capabilities modal response");
      
      // Extract agent capabilities from structured metadata
      const agentCapabilitiesData = (taskResponse.result as any)?.metadata?.agentCapabilities || agentMetadata.agentCapabilities;
      
      if (agentCapabilitiesData) {
        // Show agent capabilities modal
        showAgentCapabilitiesModal.value = true;
        currentAgentCapabilities.value = agentCapabilitiesData;
        console.log("[HomePage] Showing agent capabilities modal for:", agentCapabilitiesData.name);
      } else {
        console.log("[HomePage] No agent capabilities data found, adding message to chat as fallback");
        // Fallback to showing text message
        const agentMessage: Message = {
          id: taskResponse.id,
          session_id: currentSessionId.value,
          user_id: auth.user?.id || 'unknown-user',
          role: 'assistant',
          content: agentText,
          timestamp: new Date().toISOString(),
          order: agentMessageOrder,
          metadata: agentMetadata
        };
        sessionStore.addMessageToCurrentSession(agentMessage);
      }
    } else if (contentType === 'agentListFromOrchestrator' && (expectingAgentList.value || agentText.includes('Agent Name:'))) {
      // Legacy text-based agent list response - still support parsing for backward compatibility
      console.log("[HomePage] Detected legacy agent list response, showing modal instead of adding to chat");
      
      // Parse agents and show modal instead of adding message to chat
      const agents = parseAgentListFromResponse(agentText);
      
      if (agents.length > 0) {
        availableAgents.value = agents;
        showAgentModal.value = true;
        console.log("[HomePage] Showing agent modal with", agents.length, "agents:", agents);
      } else {
        console.log("[HomePage] No agents parsed from legacy response, adding message to chat as fallback");
        // Fallback to showing text message if parsing fails
        const agentMessage: Message = {
          id: taskResponse.id,
          session_id: currentSessionId.value,
          user_id: auth.user?.id || 'unknown-user',
          role: 'assistant',
          content: agentText,
          timestamp: new Date().toISOString(),
          order: agentMessageOrder,
          metadata: agentMetadata
        };
        sessionStore.addMessageToCurrentSession(agentMessage);
      }
      
      // Reset the expectation flag
      expectingAgentList.value = false;
    } else {
      // Regular response - add to chat as normal
      const agentMessage: Message = {
        id: taskResponse.id,
        session_id: currentSessionId.value,
        user_id: auth.user?.id || 'unknown-user',
        role: 'assistant',
        content: agentText,
        timestamp: new Date().toISOString(),
        order: agentMessageOrder,
        metadata: agentMetadata
      };

      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[HomePage] Agent message added to store:", JSON.parse(JSON.stringify(agentMessage)));
    }

    // Message saving is handled automatically by sessionStore

  } catch (error) {
    console.error("[HomePage] Error sending message:", error);
    
    const errorMessage: Message = {
      id: `error-${Date.now()}`,
      session_id: currentSessionId.value,
      user_id: auth.user?.id || 'unknown-user',
      role: 'assistant',
      content: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
      timestamp: new Date().toISOString(),
      order: (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1)
    };
    
    sessionStore.addMessageToCurrentSession(errorMessage);
    console.log("[HomePage] Error message added to store:", JSON.parse(JSON.stringify(errorMessage)));
  } finally {
    uiStore.setAppLoading(false);
  }
};

const handleReturnToOrchestrator = () => {
  console.log("[HomePage] Return to orchestrator request received");
  // Send a message to clear the sticky agent and return to orchestrator mode
  handleSendMessage("Return to orchestrator");
};

const handleViewAllAgents = () => {
  console.log("[HomePage] View all agents request received");
  // This is now handled by the sidebar agent tree view
};

const handleViewAgentCapabilities = async (agentInfo: any) => {
  console.log("[HomePage] View agent capabilities request received for:", agentInfo);
  
  try {
    if (agentInfo && agentInfo.name) {
      // We're asking a specific agent about their capabilities via UI click
      const agentName = agentInfo.name;
      console.log(`[HomePage] UI click: Asking ${agentName} about their capabilities`);
      
      if (agentName.toLowerCase() === 'orchestrator' || agentName.toLowerCase() === 'orchestrator agent') {
        // If it's the orchestrator, call REST endpoint for agent list modal
        console.log("[HomePage] Calling REST endpoint for agent list");
        const response = await apiService.getAgentsList();
        
        if (response.metadata?.agentList) {
          availableAgents.value = response.metadata.agentList.map((agent: any) => ({
            name: agent.name,
            description: agent.description
          }));
          showAgentModal.value = true;
          console.log("[HomePage] Showing agent list modal with", response.metadata.agentList.length, "agents");
        }
      } else {
        // For specific agents, call REST endpoint for capabilities modal
        console.log(`[HomePage] Calling REST endpoint for ${agentName} capabilities`);
        const response = await apiService.getAgentCapabilities(agentName);
        
        if (response.metadata?.agentCapabilities) {
          currentAgentCapabilities.value = response.metadata.agentCapabilities;
          showAgentCapabilitiesModal.value = true;
          console.log("[HomePage] Showing agent capabilities modal for:", agentName);
        }
      }
    } else {
      // Fallback to orchestrator agent list modal
      console.log("[HomePage] No specific agent info, defaulting to orchestrator agent list modal");
      const response = await apiService.getAgentsList();
      
      if (response.metadata?.agentList) {
        availableAgents.value = response.metadata.agentList.map((agent: any) => ({
          name: agent.name,
          description: agent.description
        }));
        showAgentModal.value = true;
        console.log("[HomePage] Showing agent list modal with", response.metadata.agentList.length, "agents");
      }
    }
  } catch (error) {
    console.error("[HomePage] Error fetching agent capabilities:", error);
    // Could show an error toast here
  }
};

const handleAgentCapabilityRequestedFor = (agentName: string) => {
  console.log("[HomePage] Agent capability requested for:", agentName);
  // TODO: Implement agent capability request functionality
};

// Modal handlers
const closeAgentModal = () => {
  showAgentModal.value = false;
  availableAgents.value = [];
};

const closeAgentCapabilitiesModal = () => {
  showAgentCapabilitiesModal.value = false;
  currentAgentCapabilities.value = null;
};

// Debug panel methods
const toggleDebugPanel = () => {
  showDebugPanel.value = !showDebugPanel.value;
};

const closeDebugPanel = () => {
  showDebugPanel.value = false;
};

// Agent tree view event handlers (now handled in SessionSidebar)
const handleConversationSelected = (conversation: any) => {
  console.log("[HomePage] Conversation selected from agent tree:", conversation);
  // You could navigate to this conversation or load it in the chat view
};

const handleAgentSelectedFromTree = (agent: any) => {
  console.log("[HomePage] Agent selected from agent tree:", agent);
  // Could start a new conversation with this agent
};

const handleAgentSelected = (agent: { name: string; description: string }) => {
  console.log("[HomePage] Agent selected from modal:", agent);
  // Send a message to talk to the specific agent with the requested format
  handleSendMessage(`I would like to talk with the ${agent.name} agent.`);
};

const handleCloseAgentChat = () => {
  agentChatStore.clearChat();
};

// Helper function to parse agent list from orchestrator response
const parseAgentListFromResponse = (responseText: string): Array<{ name: string; description: string }> => {
  console.log("[HomePage] Parsing agent list from response:", responseText);
  const agents: Array<{ name: string; description: string }> = [];
  const lines = responseText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    console.log(`[HomePage] Processing line ${i}: "${line}"`);
    
    // Handle multiple formats:
    // Format 1: "Agent Name: Blog Post Writer, Description: Blog Post Writer specialist agent"
    let match = line.match(/Agent Name:\s*([^,]+),\s*Description:\s*(.+)/i);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      console.log(`[HomePage] Found agent (Format 1): "${name}" - "${description}"`);
      agents.push({ name, description });
      continue;
    }
    
    // Format 2: "- Agent Name: Blog Post, Description: Handles content creation..."
    match = line.match(/- Agent Name:\s*([^,]+),\s*Description:\s*(.+)/i);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      console.log(`[HomePage] Found agent (Format 2): "${name}" - "${description}"`);
      agents.push({ name, description });
      continue;
    }
    
    // Format 3: "- Blog Post Agent: Handles content creation..."
    match = line.match(/- ([^:]+):\s*(.+)/);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      console.log(`[HomePage] Found agent (Format 3): "${name}" - "${description}"`);
      agents.push({ name, description });
      continue;
    }
    
    // Format 4: "- Blog Post - Handles content creation..."
    match = line.match(/- ([^-]+)\s*-\s*(.+)/);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      console.log(`[HomePage] Found agent (Format 4): "${name}" - "${description}"`);
      agents.push({ name, description });
      continue;
    }
    
    console.log(`[HomePage] No match found for line: "${line}"`);
  }
  
  console.log(`[HomePage] Parsed ${agents.length} agents:`, agents);
  return agents;
};

// Agent list detection is now handled directly in handleSendMessage

// Keyboard handling for mobile devices
let keyboardHandler: (info: KeyboardInfo) => void;

onMounted(() => {
  console.log("[HomePage] Component mounted");
  
  if (Capacitor.isNativePlatform()) {
    keyboardHandler = (info: KeyboardInfo) => {
      const keyboardHeight = info.keyboardHeight;
      console.log(`[HomePage] Keyboard event: keyboardHeight = ${keyboardHeight}`);
      
      nextTick(() => {
        scrollToBottom();
      });
    };
    
    Keyboard.addListener('keyboardWillShow', keyboardHandler);
    Keyboard.addListener('keyboardDidShow', keyboardHandler);
  }
});

onUnmounted(() => {
  console.log("[HomePage] Component unmounted");
  
  if (Capacitor.isNativePlatform() && typeof keyboardHandler === 'function') {
    Keyboard.removeAllListeners();
  }
});
</script>

<style scoped>
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ion-color-medium);
}

.ios-header-style {
  --border-color: transparent;
  --background: var(--ion-color-primary);
  --color: white;
}

ion-content {
  --overflow: hidden;
}

.ion-padding {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 16px;
  --padding-bottom: 16px;
}
</style> 