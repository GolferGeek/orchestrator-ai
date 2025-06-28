<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar :class="{ 'ios-header-style': isIOS }">
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding" ref="chatContentEl">
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
    </ion-content>

    <ion-footer v-if="auth.isAuthenticated && sessionStore.currentSessionId">
      <ChatInputComponent @send-message="handleSendMessage" :disabled="uiStore.getIsAppLoading" />
      <div v-if="uiStore.getIsAppLoading" class="loading-indicator ion-padding-start ion-padding-bottom">
        <ion-spinner name="dots" color="primary"></ion-spinner>
      </div>
    </ion-footer>

    <!-- Agent Capabilities Modal -->
    <AgentCapabilitiesModal 
      :is-open="showAgentModal"
      :agents="availableAgents"
      @dismiss="closeAgentModal"
      @agentSelected="handleAgentSelected"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonFooter, IonSpinner, IonText, 
  isPlatform, IonButtons, IonMenuButton
} from '@ionic/vue';
import { onMounted, onUnmounted, computed, watch, nextTick, ref } from 'vue';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { useRouter } from 'vue-router';
import { postTaskToOrchestrator } from '@/services/apiService';
import { storeToRefs } from 'pinia';
import { Message } from '../services/sessionService';
import { nestjsApiService } from '../services/nestjsApiService';

import MessageListComponent from '../components/MessageList.vue';
import ChatInputComponent from '../components/ChatInput.vue';
import AgentCapabilitiesModal from '@/components/AgentCapabilitiesModal.vue';

const auth = useAuthStore();
const sessionStore = useSessionStore();
const uiStore = useUiStore();
const router = useRouter();

const { currentSessionId, currentSessionMessages } = storeToRefs(sessionStore);
const chatContentEl = ref<InstanceType<typeof IonContent> | null>(null);

// Modal state
const showAgentModal = ref(false);
const availableAgents = ref<Array<{ name: string; description: string }>>([]);

const isIOS = computed(() => isPlatform('ios'));

const currentSessionName = computed(() => {
  if (currentSessionId.value) {
          return `Orchestrator AI Chat`;
  }
      return 'Orchestrator AI';
});

const pageTitle = computed(() => {
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

    const taskResponse = await nestjsApiService.postTaskToOrchestrator(text, currentSessionId.value, conversationHistory);
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
    else if (taskResponse.result && typeof taskResponse.result === 'string') {
      agentText = taskResponse.result;
      console.log("[HomePage] Extracted response from direct result field");
    }
    else {
      console.warn("[HomePage] No response found in taskResponse:", JSON.parse(JSON.stringify(taskResponse)));
    }

    const agentMessageOrder = (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1);

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
  if (currentSessionId.value) {
    sessionStore.fetchMessagesForCurrentSession();
  }
};

const handleViewAllAgents = () => {
  console.log("[HomePage] View all agents request received");
  // TODO: Implement view all agents functionality
};

const handleViewAgentCapabilities = (agentInfo: any) => {
  console.log("[HomePage] View agent capabilities request received for:", agentInfo);
  
  if (agentInfo && agentInfo.name) {
    // We're asking a specific agent about their capabilities
    const agentName = agentInfo.name;
    console.log(`[HomePage] Asking ${agentName} about their capabilities`);
    
    // Ask the specific agent what they can do
    if (agentName.toLowerCase() === 'orchestrator' || agentName.toLowerCase() === 'orchestrator agent') {
      // If it's the orchestrator, ask for agent list
      handleSendMessage("View all that I can do for you");
    } else {
      // For specific agents, explicitly request delegation to that agent
      handleSendMessage(`I want to talk to ${agentName}. ${agentName}, what can you help me with? Please tell me about your capabilities and what you specialize in.`);
    }
  } else {
    // Fallback to orchestrator agent list
    console.log("[HomePage] No specific agent info, defaulting to orchestrator agent list");
    handleSendMessage("View all that I can do for you");
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

const handleAgentSelected = (agent: { name: string; description: string }) => {
  console.log("[HomePage] Agent selected from modal:", agent);
  // Send a message to talk to the specific agent with the requested format
  handleSendMessage(`I would like to talk with the ${agent.name} agent.`);
};

// Helper function to parse agent list from orchestrator response
const parseAgentListFromResponse = (responseText: string): Array<{ name: string; description: string }> => {
  const agents: Array<{ name: string; description: string }> = [];
  const lines = responseText.split('\n');
  
  for (const line of lines) {
    // Handle multiple formats:
    // Format 1: "- Agent Name: Blog Post, Description: Handles content creation..."
    let match = line.match(/- Agent Name:\s*([^,]+),\s*Description:\s*(.+)/i);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      agents.push({ name, description });
      continue;
    }
    
    // Format 2: "- Blog Post Agent: Handles content creation..."
    match = line.match(/- ([^:]+):\s*(.+)/);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      agents.push({ name, description });
      continue;
    }
    
    // Format 3: "- Blog Post - Handles content creation..."
    match = line.match(/- ([^-]+)\s*-\s*(.+)/);
    if (match) {
      const name = match[1].trim();
      const description = match[2].trim();
      agents.push({ name, description });
      continue;
    }
  }
  
  return agents;
};

// Watch for agent list responses and show modal
watch(currentSessionMessages, (newMessages) => {
  if (!newMessages || newMessages.length === 0) return;
  
  const lastMessage = newMessages[newMessages.length - 1];
  
  // Only show modal for orchestrator responses that contain agent lists
  // Don't show modal for individual agent capability responses
  if (lastMessage?.role === 'assistant' && 
      lastMessage?.metadata?.contentType === 'agentListFromOrchestrator' &&
      lastMessage?.metadata?.agentName === 'Orchestrator Agent' &&
      lastMessage?.content) {
    
    console.log("[HomePage] Detected orchestrator agent list response, parsing for modal...");
    const agents = parseAgentListFromResponse(lastMessage.content);
    
    if (agents.length > 0) {
      availableAgents.value = agents;
      showAgentModal.value = true;
      console.log("[HomePage] Showing agent modal with", agents.length, "agents");
    }
  }
}, { deep: true });

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