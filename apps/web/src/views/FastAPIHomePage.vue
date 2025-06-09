<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar :class="{ 'ios-header-style': isIOS }">
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }} - FastAPI</ion-title>
        <ion-buttons slot="end" v-if="auth.isAuthenticated">
          <div class="api-selector-container">
            <ion-button fill="clear" size="small" @click="switchToNestJS">
              <ion-icon :icon="swapHorizontal" slot="start" />
              Switch to NestJS
            </ion-button>
            <div class="api-badge">
              <span class="api-label">FastAPI</span>
            </div>
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
  isPlatform, IonButtons, IonMenuButton, IonButton, IonIcon
} from '@ionic/vue';
import { swapHorizontal } from 'ionicons/icons';
import { onMounted, onUnmounted, computed, watch, nextTick, ref } from 'vue';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { useRouter } from 'vue-router';
import { postTaskToOrchestrator } from '@/services/apiService';
import { storeToRefs } from 'pinia';
import { apiManager } from '../services/apiManager';
import { Message } from '../services/sessionService';

import MessageListComponent from '../components/MessageList.vue';
import ChatInputComponent from '../components/ChatInput.vue';

const auth = useAuthStore();
const sessionStore = useSessionStore();
const uiStore = useUiStore();
const router = useRouter();

const { currentSessionId, currentSessionMessages } = storeToRefs(sessionStore);
const chatContentEl = ref<InstanceType<typeof IonContent> | null>(null);

const isIOS = computed(() => isPlatform('ios'));

const currentSessionName = computed(() => {
  if (currentSessionId.value) {
    return `Chat`;
  }
  return 'FastAPI Orchestrator';
});

const pageTitle = computed(() => {
  return currentSessionName.value || 'FastAPI Orchestrator';
});

// Ensure we're using the FastAPI endpoint
onMounted(async () => {
  const fastApiEndpoint = apiManager.availableEndpoints.find(ep => ep.technology === 'python-fastapi');
  if (fastApiEndpoint && apiManager.currentEndpoint.technology !== 'python-fastapi') {
    await apiManager.switchToEndpoint(fastApiEndpoint);
  }
});

const switchToNestJS = async () => {
  router.push('/nestjs');
};

const handleMessagesRenderedInChild = () => {
  console.log("[FastAPIHomePage] Received messages-rendered event from MessageList.");
  scrollToBottom();
};

const scrollToBottom = async () => {
  console.log("[FastAPIHomePage] scrollToBottom called (triggered by messages-rendered)");
  await new Promise(resolve => setTimeout(resolve, 100));

  const contentHostElement = chatContentEl.value?.$el as HTMLElement | undefined;
  if (!contentHostElement) {
    console.warn("[FastAPIHomePage] IonContent $el not found.");
    return;
  }

  let scrollElement = contentHostElement.querySelector('.inner-scroll') as HTMLElement || 
                      (contentHostElement.shadowRoot ? contentHostElement.shadowRoot.querySelector('.inner-scroll') as HTMLElement : null) || 
                      contentHostElement;
  
  if (scrollElement === contentHostElement && scrollElement.firstElementChild && scrollElement.firstElementChild.scrollHeight > scrollElement.scrollHeight) {
    console.log("[FastAPIHomePage] Host element $el might not be the scroller, trying its first child.");
    scrollElement = scrollElement.firstElementChild as HTMLElement;
  }

  if (scrollElement && typeof scrollElement.scrollTop !== 'undefined') {
    console.log(`[FastAPIHomePage] Attempting to scroll element: ${scrollElement.tagName}${scrollElement.className ? '.' + scrollElement.className : ''}. Current scrollHeight: ${scrollElement.scrollHeight}, clientHeight: ${scrollElement.clientHeight}, current scrollTop: ${scrollElement.scrollTop}`);
    if (scrollElement.scrollHeight > scrollElement.clientHeight) { 
        scrollElement.scrollTop = scrollElement.scrollHeight;
        console.log("[FastAPIHomePage] Manually set scrollTop. New scrollTop: " + scrollElement.scrollTop);
    } else {
        console.log("[FastAPIHomePage] Element is not scrollable (scrollHeight <= clientHeight).");
    }
  } else {
    console.error("[FastAPIHomePage] Could not find a suitable scrollable element or its scrollTop property.");
  }
};

watch(currentSessionId, (newId, oldId) => {
  console.log("[FastAPIHomePage] Watcher for currentSessionId triggered. New ID:", newId);
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
  console.log("[FastAPIHomePage] User message added to store:", JSON.parse(JSON.stringify(userMessage)));

  try {
    const taskResponse = await postTaskToOrchestrator(text, currentSessionId.value);
    console.log("[FastAPIHomePage] Received taskResponse from FastAPI orchestrator:", JSON.parse(JSON.stringify(taskResponse)));
    
    // Extract response text - support V1 FastAPI formats
    let agentText = 'No response text.';
    let agentMetadata: Record<string, any> = {};
    
    // V1 format - check for response_message.parts
    if (taskResponse.response_message && taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0) {
      agentText = taskResponse.response_message.parts[0]?.text || 'No response text.';
      if (taskResponse.response_message?.metadata?.responding_agent_name) {
        agentMetadata.agentName = taskResponse.response_message.metadata.responding_agent_name;
      }
      console.log("[FastAPIHomePage] Extracted response from V1 response_message.parts format");
    }
    // Additional fallback - check for direct result field
    else if (taskResponse.result && typeof taskResponse.result === 'string') {
      agentText = taskResponse.result;
      console.log("[FastAPIHomePage] Extracted response from direct result field");
    }
    else {
      console.warn("[FastAPIHomePage] No response found in FastAPI format in taskResponse:", JSON.parse(JSON.stringify(taskResponse)));
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
    console.log("[FastAPIHomePage] Constructed agentMessage:", JSON.parse(JSON.stringify(agentMessage)));
    sessionStore.addMessageToCurrentSession(agentMessage);
    
    if (taskResponse.session_id && taskResponse.session_id !== currentSessionId.value) {
        sessionStore.setCurrentSessionId(taskResponse.session_id);
    }

  } catch (error: any) {
    console.error('Error sending message to FastAPI:', error);
    const errorMessageOrder = (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1);
    const errorMessage = {
      id: `temp-error-${Date.now()}`,
      session_id: currentSessionId.value!,
      user_id: 'system',
      role: 'system' as const,
      content: `Error: ${error.message || 'Could not send message to FastAPI.'}`, 
      timestamp: new Date().toISOString(),
      order: errorMessageOrder
    };
    sessionStore.addMessageToCurrentSession(errorMessage);
  } finally {
    uiStore.setAppLoading(false);
    scrollToBottom();
  }
};

const handleReturnToOrchestrator = async () => {
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const taskResponse = await postTaskToOrchestrator("Show me available agents", currentSessionId.value);
    if (taskResponse && taskResponse.response_message) {
      let messageContent = '';
      if (typeof taskResponse.response_message === 'string') {
        messageContent = taskResponse.response_message;
      } else if (taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0 && taskResponse.response_message.parts[0].text) {
        messageContent = taskResponse.response_message.parts[0].text;
      } else {
        messageContent = typeof taskResponse.response_message === 'object' ? JSON.stringify(taskResponse.response_message) : String(taskResponse.response_message);
        if (typeof taskResponse.response_message === 'object') {
            console.warn("[FastAPIHomePage] returnToOrchestrator: response_message was an object, stringified.");
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
        metadata: taskResponse.metadata || { responding_agent_name: taskResponse.responding_agent_name || 'FastAPI Orchestrator', isAgentListResponse: true }
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[FastAPIHomePage] Agent message for returnToOrchestrator added to store:", JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn("[FastAPIHomePage] Received no valid response_message for returnToOrchestrator from FastAPI orchestrator", taskResponse);
    }
  } catch (error) {
    console.error("[FastAPIHomePage] Error in handleReturnToOrchestrator:", error);
  } finally {
    uiStore.setAppLoading(false);
  }
};

const handleViewAllAgents = async () => {
  await handleReturnToOrchestrator();
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
        messageContent = typeof taskResponse.response_message === 'object' ? JSON.stringify(taskResponse.response_message) : String(taskResponse.response_message);
        if (typeof taskResponse.response_message === 'object') {
            console.warn("[FastAPIHomePage] viewAgentCapabilities: response_message was an object, stringified.");
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
        metadata: taskResponse.metadata || { responding_agent_name: taskResponse.responding_agent_name || 'FastAPI Agent', isCapabilitiesResponse: true }
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[FastAPIHomePage] Agent message for viewAgentCapabilities added to store:", JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn("[FastAPIHomePage] Received no valid response_message for viewAgentCapabilities from FastAPI orchestrator", taskResponse);
    }
  } catch (error) {
    console.error("[FastAPIHomePage] Error in handleViewAgentCapabilities:", error);
  } finally {
    uiStore.setAppLoading(false);
  }
};

const handleAgentCapabilityRequestedFor = async (agentName: string) => {
  if (!agentName) {
    console.warn("[FastAPIHomePage] handleAgentCapabilityRequestedFor called without agentName.");
    return;
  }
  if (uiStore.getIsAppLoading) return;
  uiStore.setAppLoading(true);
  try {
    const query = `What can the ${agentName} do for me?`;
    console.log(`[FastAPIHomePage] Sending query for ${agentName}: "${query}"`);

    const taskResponse = await postTaskToOrchestrator(query, currentSessionId.value);
    if (taskResponse && taskResponse.response_message) {
      let messageContent = '';
      if (typeof taskResponse.response_message === 'string') {
        messageContent = taskResponse.response_message;
      } else if (taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0 && taskResponse.response_message.parts[0].text) {
        messageContent = taskResponse.response_message.parts[0].text;
      } else {
        messageContent = JSON.stringify(taskResponse.response_message);
        console.warn(`[FastAPIHomePage] handleAgentCapabilityRequestedFor (${agentName}): response_message was an object, stringified.`);
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
      console.log(`[FastAPIHomePage] Agent message for ${agentName} capabilities added to store:`, JSON.parse(JSON.stringify(agentMessage)));
      scrollToBottom();
    } else {
      console.warn(`[FastAPIHomePage] Received no valid response_message for ${agentName} capabilities from FastAPI orchestrator`, taskResponse);
    }
  } catch (error) {
    console.error(`[FastAPIHomePage] Error in handleAgentCapabilityRequestedFor for ${agentName}:`, error);
  } finally {
    uiStore.setAppLoading(false);
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
});

onUnmounted(() => {
  if (Capacitor.isNativePlatform()) {
    Keyboard.removeAllListeners();
  }
});

</script>

<style scoped>
ion-content {
  /* ion-padding is applied via class */
}

.loading-indicator {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding-top: 4px;
}

.ios-header-style {
  --border-width: 0 0 0.55px 0;
  --border-color: var(--ion-color-step-250, #c8c7cc);
  --background: var(--ion-toolbar-background, var(--ion-background-color));
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-selector-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
}

.api-badge {
  display: flex;
  align-items: center;
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