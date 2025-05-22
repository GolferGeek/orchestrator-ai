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
        @returnToOrchestrator="handleReturnToOrchestrator" />
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
    
    if (taskResponse.response_message && taskResponse.response_message.parts && taskResponse.response_message.parts.length > 0) {
      const agentText = taskResponse.response_message.parts[0]?.text || 'No response text.';
      const agentMessageOrder = (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1);
      const agentMetadata: Record<string, any> = {};
      if (taskResponse.response_message?.metadata?.responding_agent_name) {
        agentMetadata.agentName = taskResponse.response_message.metadata.responding_agent_name;
      }

      const agentMessage = {
        id: taskResponse.id,
        session_id: currentSessionId.value,
        user_id: 'agent',
        role: 'assistant' as const,
        content: agentText,
        timestamp: new Date().toISOString(),
        order: agentMessageOrder,
        metadata: agentMetadata
      };
      console.log("[HomePage] Constructed agentMessage:", JSON.parse(JSON.stringify(agentMessage))); // DEBUG PRINT
      sessionStore.addMessageToCurrentSession(agentMessage);
      console.log("[HomePage] Agent message added to store. Store messages count:", sessionStore.currentSessionMessages.length); // DEBUG PRINT
    } else {
      console.warn("[HomePage] No response_message or parts found in taskResponse:", JSON.parse(JSON.stringify(taskResponse))); // DEBUG PRINT
    }
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

      const agentMessage = {
        id: taskResponse.id, 
        session_id: currentSessionId.value!,
        user_id: 'agent',
        role: 'assistant' as const,
        content: agentText,
        timestamp: new Date().toISOString(),
        order: agentMessageOrder,
        metadata: agentMetadata
      };
      sessionStore.addMessageToCurrentSession(agentMessage);
    } else if (taskResponse && taskResponse.messages) { 
        taskResponse.messages.forEach((msg: any) => {
        const existingMessage = sessionStore.currentSessionMessages.find(m => m.id === msg.id);
        if (!existingMessage) {
          sessionStore.addMessageToCurrentSession({
            id: msg.id,
            content: msg.content.toString(),
            role: msg.role,
            timestamp: msg.timestamp || new Date().toISOString(),
            metadata: msg.metadata || { agentName: 'Orchestrator' }, 
            order: (currentSessionMessages.value.length > 0 
            ? Math.max(...currentSessionMessages.value.map(m => m.order)) + 1 
            : 1)
          });
        }
      });
    }
  } catch (error) {
    console.error('Error returning to orchestrator:', error);
    sessionStore.addMessageToCurrentSession({
      id: Date.now().toString(),
      content: "Error trying to return to orchestrator. Please try again.",
      role: 'system',
      timestamp: new Date().toISOString(),
    });
  } finally {
    uiStore.setAppLoading(false);
    scrollToBottom();
  }
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
  --background: var(--ion-toolbar-background-ios, var(--ion-background-color, #fff)); /* Ensure iOS specific background if translucent is tricky */
}

/* Example for MD if needed 
.md-header-style {
  --background: var(--ion-toolbar-background-md, var(--ion-color-primary));
  --color: var(--ion-toolbar-color-md, var(--ion-color-primary-contrast));
}
*/
</style>
