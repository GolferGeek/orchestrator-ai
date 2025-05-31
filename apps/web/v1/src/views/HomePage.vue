<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar :class="{ 'ios-header-style': isIOS }">
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end" v-if="auth.isAuthenticated">
          <div class="api-display">
            <span class="api-label">V1 FastAPI</span>
          </div>
        </ion-buttons>
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
import { postTaskToOrchestrator } from '@/services/apiService';
import { storeToRefs } from 'pinia';
import { apiManager } from '../services/apiManager';
import { Message } from '../services/sessionService';

import MessageListComponent from '../components/MessageList.vue';
import ChatInputComponent from '../components/ChatInput.vue';

const auth = useAuthStore();
const sessionStore = useSessionStore();
const uiStore = useUiStore();

const { currentSessionId, currentSessionMessages } = storeToRefs(sessionStore);
const chatContentEl = ref<InstanceType<typeof IonContent> | null>(null);

const isIOS = computed(() => isPlatform('ios'));

const currentSessionName = computed(() => {
  if (currentSessionId.value) {
    return `Chat`;
  }
  return 'Orchestrator Chat';
});

const pageTitle = computed(() => {
  return currentSessionName.value || 'Orchestrator Chat';
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
    // Messages will be fetched by store, then MessageList will emit 'messages-rendered'
    // Do NOT call scrollToBottom() here directly, wait for messages-rendered event.
    // scrollToBottom(); 
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
    const taskResponse = await postTaskToOrchestrator(text, currentSessionId.value);
    console.log("[HomePage] Received taskResponse from orchestrator:", JSON.parse(JSON.stringify(taskResponse))); // DEBUG PRINT
    
    // Extract response text - support both V1 and V2 A2A formats
    let agentText = 'No response text.';
    let agentMetadata: Record<string, any> = {};
    
    // V2 A2A Protocol format - check for output_artifacts first
    if (taskResponse.output_artifacts && taskResponse.output_artifacts.length > 0) {
      const outputArtifact = taskResponse.output_artifacts[0];
      if (outputArtifact.data && typeof outputArtifact.data === 'string') {
        agentText = outputArtifact.data;
        if (outputArtifact.metadata) {
          // Use display_name first, then agent_name, then fall back to agent_id
          agentMetadata.agentName = outputArtifact.metadata.display_name || 
                                   outputArtifact.metadata.agent_name || 
                                   outputArtifact.metadata.agent_id;
        }
        console.log("[HomePage] Extracted response from V2 A2A output_artifacts format");
      }
    }
    // V1 format fallback - check for response_message.parts
    else if (taskResponse.response_message && taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0) {
      agentText = taskResponse.response_message.parts[0]?.text || 'No response text.';
      if (taskResponse.response_message?.metadata?.responding_agent_name) {
        agentMetadata.agentName = taskResponse.response_message.metadata.responding_agent_name;
      }
      console.log("[HomePage] Extracted response from V1 response_message.parts format");
    }
    // Additional fallback - check for direct result field
    else if (taskResponse.result && typeof taskResponse.result === 'string') {
      agentText = taskResponse.result;
      console.log("[HomePage] Extracted response from direct result field");
    }
    else {
      console.warn("[HomePage] No response found in any supported format in taskResponse:", JSON.parse(JSON.stringify(taskResponse))); // DEBUG PRINT
    }

    const agentMessageOrder = (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1);

    const agentMessage: Message = {
      id: taskResponse.id,
      session_id: currentSessionId.value || 'unknown-session',
      user_id: 'agent',
      role: 'assistant',
      content: agentText,
      timestamp: new Date().toISOString(),
      order: agentMessageOrder,
      metadata: agentMetadata
    };
    console.log("[HomePage] Constructed agentMessage:", JSON.parse(JSON.stringify(agentMessage))); // DEBUG PRINT
    sessionStore.addMessageToCurrentSession(agentMessage);
    console.log("[HomePage] Agent message added to store. Store messages count:", sessionStore.currentSessionMessages.length); // DEBUG PRINT
    
    if (taskResponse.session_id && taskResponse.session_id !== currentSessionId.value) {
        sessionStore.setCurrentSessionId(taskResponse.session_id);
    }

  } catch (error: any) {
    console.error('Error sending message:', error);
    const errorMessageOrder = (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1);
    const errorMessage = {
      id: `temp-error-${Date.now()}`,
      session_id: currentSessionId.value!,
      user_id: 'system',
      role: 'system' as const,
      content: `Error: ${error.message || 'Could not send message.'}`, 
      timestamp: new Date().toISOString(),
      order: errorMessageOrder
    };
    sessionStore.addMessageToCurrentSession(errorMessage);
  } finally {
    uiStore.setAppLoading(false);
    scrollToBottom();
  }
};

// Keyboard event handling
const keyboardWillShowHandler = (info: KeyboardInfo) => {
  console.log('Keyboard will show, height:', info.keyboardHeight);
};

const keyboardWillHideHandler = () => {
  console.log('Keyboard will hide');
};

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    Keyboard.addListener('keyboardWillShow', keyboardWillShowHandler);
    Keyboard.addListener('keyboardWillHide', keyboardWillHideHandler);
  }
  // For initial load, if messages are already there, MessageList should emit on its own mount if messages exist (if we add that logic to MessageList).
  // For now, deferring this. The user can scroll manually on first load if needed, or we can refine MessageList.
  // if (currentSessionMessages.value.length > 0) { 
  //   console.log("[HomePage] onMounted: Messages present, scheduling a scrollToBottom soon.");
  //   setTimeout(scrollToBottom, 300); // Delay slightly for child component rendering
  // }
});

onUnmounted(() => {
  if (Capacitor.isNativePlatform()) {
    Keyboard.removeAllListeners();
  }
});

const defaultSessionName = () => {
  return 'Orchestrator Chat';
};

const handleReturnToOrchestrator = async () => {
  console.log('[HomePage.vue] handleReturnToOrchestrator method called');
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const taskResponse = await postTaskToOrchestrator("Can I return to the orchestrator?", currentSessionId.value);
    console.log("[HomePage] Received taskResponse from orchestrator (after invisible return request):", JSON.parse(JSON.stringify(taskResponse))); // DEBUG PRINT

    if (taskResponse.response_message && taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0) {
      const agentText = taskResponse.response_message.parts[0]?.text || 'No response text.';
      const agentMessageOrder = (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1);
      const agentMetadata: Record<string, any> = {};
      if (taskResponse.response_message?.metadata?.responding_agent_name) {
        agentMetadata.agentName = taskResponse.response_message.metadata.responding_agent_name;
      } else {
        agentMetadata.agentName = 'Orchestrator'; // Default to Orchestrator
      }

      const agentMessage: Message = {
        id: taskResponse.id,
        session_id: currentSessionId.value || 'unknown-session',
        user_id: 'agent',
        role: 'assistant',
        content: agentText,
        timestamp: new Date().toISOString(),
        order: agentMessageOrder,
        metadata: agentMetadata
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
    } else if (taskResponse && taskResponse.response_message) { 
      // Additional fallback for other response formats
      const fallbackText = typeof taskResponse.response_message === 'string' 
        ? taskResponse.response_message 
        : JSON.stringify(taskResponse.response_message);
      
      const fallbackMessage = {
        id: taskResponse.id || Date.now().toString(),
        session_id: currentSessionId.value || 'unknown-session',
        user_id: 'agent',
        role: 'assistant' as const,
        content: fallbackText,
        timestamp: new Date().toISOString(),
        order: (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1),
        metadata: { agentName: 'Orchestrator' }
      };
      sessionStore.addMessageToCurrentSession(fallbackMessage);
    }
  } catch (error) {
    console.error('Error returning to orchestrator:', error);
    sessionStore.addMessageToCurrentSession({
      id: Date.now().toString(),
      session_id: currentSessionId.value || 'unknown-session',
      user_id: 'system',
      content: "Error trying to return to orchestrator. Please try again.",
      role: 'system',
      timestamp: new Date().toISOString(),
      order: (currentSessionMessages.value.length > 0 
        ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
        : 1),
      metadata: null
    });
  } finally {
    uiStore.setAppLoading(false);
    scrollToBottom();
  }
};

const handleViewAllAgents = async () => {
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const taskResponse = await postTaskToOrchestrator("Tell me what agents you have", currentSessionId.value);
    if (taskResponse && taskResponse.response_message) {
      let messageContent = '';
      if (typeof taskResponse.response_message === 'string') {
        messageContent = taskResponse.response_message;
      } else if (taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0 && taskResponse.response_message.parts[0].text) {
        messageContent = taskResponse.response_message.parts[0].text;
      } else {
        // Fallback if structure is unexpected, or convert object to string for display
        messageContent = JSON.stringify(taskResponse.response_message);
        console.warn("[HomePage] viewAllAgents: response_message was an object without expected parts, stringified for display.");
      }

      const agentMessage: Message = {
        id: taskResponse.task_id || Date.now().toString(),
        session_id: currentSessionId.value || 'unknown-session',
        user_id: 'agent',
        content: messageContent,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        order: (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1),
        metadata: taskResponse.metadata || { responding_agent_name: taskResponse.responding_agent_name || 'Orchestrator' }
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[HomePage] Agent message for viewAllAgents added to store:", JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn("[HomePage] Received no valid response_message for viewAllAgents from orchestrator", taskResponse);
    }
  } catch (error) {
    console.error("[HomePage] Error in handleViewAllAgents:", error);
    // Optionally add a user-facing error message to the chat
  } finally {
    uiStore.setAppLoading(false);
  }
};

const handleViewAgentCapabilities = async () => {
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const taskResponse = await postTaskToOrchestrator("What can this agent do for me?", currentSessionId.value);
    if (taskResponse && taskResponse.response_message) {
      let messageContent = '';
      if (typeof taskResponse.response_message === 'string') {
        messageContent = taskResponse.response_message;
      } else if (taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0 && taskResponse.response_message.parts[0].text) {
        messageContent = taskResponse.response_message.parts[0].text;
      } else {
        // Fallback for capabilities, ensure it's a string, possibly markdown list
        // If it's an object, the backend should ideally format it as a markdown string.
        // For safety, we'll stringify if it's an unexpected object.
        messageContent = typeof taskResponse.response_message === 'object' ? JSON.stringify(taskResponse.response_message) : String(taskResponse.response_message);
        if (typeof taskResponse.response_message === 'object') {
            console.warn("[HomePage] viewAgentCapabilities: response_message was an object, stringified. Backend should provide markdown string for lists.");
        }
      }
      
      const agentMessage: Message = {
        id: taskResponse.task_id || Date.now().toString(),
        session_id: currentSessionId.value || 'unknown-session',
        user_id: 'agent',
        content: messageContent,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        order: (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1),
        metadata: taskResponse.metadata || { responding_agent_name: taskResponse.responding_agent_name || 'AI', isCapabilitiesResponse: true }
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[HomePage] Agent message for viewAgentCapabilities added to store:", JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn("[HomePage] Received no valid response_message for viewAgentCapabilities from orchestrator", taskResponse);
    }
  } catch (error) {
    console.error("[HomePage] Error in handleViewAgentCapabilities:", error);
  } finally {
    uiStore.setAppLoading(false);
  }
};

const handleAgentCapabilityRequestedFor = async (agentName: string) => {
  if (!agentName) {
    console.warn("[HomePage] handleAgentCapabilityRequestedFor called without agentName.");
    return;
  }
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const query = `What can the ${agentName} do for me?`;
    console.log(`[HomePage] Sending query for ${agentName}: "${query}"`);

    const taskResponse = await postTaskToOrchestrator(query, currentSessionId.value);
    if (taskResponse && taskResponse.response_message) {
      let messageContent = '';
      if (typeof taskResponse.response_message === 'string') {
        messageContent = taskResponse.response_message;
      } else if (taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0 && taskResponse.response_message.parts[0].text) {
        messageContent = taskResponse.response_message.parts[0].text;
      } else {
        messageContent = JSON.stringify(taskResponse.response_message);
        console.warn(`[HomePage] handleAgentCapabilityRequestedFor (${agentName}): response_message was an object, stringified.`);
      }

      const agentMessage: Message = {
        id: taskResponse.task_id || Date.now().toString(),
        session_id: currentSessionId.value || 'unknown-session',
        user_id: 'agent',
        content: messageContent,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        order: (currentSessionMessages.value.length > 0 
          ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
          : 1),
        metadata: taskResponse.metadata || { responding_agent_name: taskResponse.responding_agent_name || agentName, isCapabilitiesResponse: true }
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log(`[HomePage] Agent message for ${agentName} capabilities added to store:`, JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn(`[HomePage] Received no valid response_message for ${agentName} capabilities from orchestrator`, taskResponse);
    }
  } catch (error) {
    console.error(`[HomePage] Error in handleAgentCapabilityRequestedFor for ${agentName}:`, error);
  } finally {
    uiStore.setAppLoading(false);
  }
};

const loadSessionData = async () => {
  // ... existing code ...
};

</script>

<style scoped>
ion-content {
  /* ion-padding is applied via class */
}

.loading-indicator {
  display: flex;
  justify-content: flex-start; /* Align to the start of the footer, near input */
  align-items: center;
  padding-top: 4px; /* Some space above spinner */
}

/* Ensure footer can accommodate spinner if shown */
ion-footer {
  /* padding-bottom to make space if spinner is outside toolbar */
}

/* Potential style for keyboard offset */
/* ion-content {
  --padding-bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-offset, 0px));
  transition: padding-bottom 0.2s ease-in-out;
} */

.ios-header-style {
  --border-width: 0 0 0.55px 0; /* Add a bottom border for iOS header */
  --border-color: var(--ion-color-step-250, #c8c7cc); /* Standard iOS border color */
  --background: var(--ion-toolbar-background, var(--ion-background-color)); /* Ensure iOS specific background if translucent is tricky */
}

/* Example for MD if needed 
.md-header-style {
  --background: var(--ion-toolbar-background-md, var(--ion-color-primary));
  --color: var(--ion-toolbar-color-md, var(--ion-color-primary-contrast));
}
*/

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-display {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.api-label {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .api-label {
    font-size: 0.7rem;
    padding: 3px 6px;
  }
}
</style>
