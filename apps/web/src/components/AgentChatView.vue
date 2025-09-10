<template>
  <div class="agent-chat-view">
    <!-- Task Execution Controls Bar -->
    <div class="controls-header">
      <TaskExecutionControls />
    </div>
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <ion-spinner />
      <p>Loading conversation...</p>
    </div>
    <!-- Error State -->
    <div v-if="error" class="error-state">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ error }}</p>
      <ion-button @click="clearError">Dismiss</ion-button>
    </div>
    <!-- Messages -->
    <div class="messages-container" ref="messagesContainer">
      <AgentTaskItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :conversationId="conversationId"
        :agentName="currentAgent?.name"
      />
    </div>
    <!-- Input Area -->
    <div class="input-area">
      <form @submit.prevent="sendMessage">
        <ion-item>
          <ion-textarea
            v-model="messageText"
            placeholder="Type your message..."
            :rows="2"
            :disabled="!currentAgent"
            @keydown.enter.prevent="sendMessage"
          />
          <!-- Speech Button -->
          <SpeechButton 
            slot="end"
            :disabled="!currentAgent"
            @transcription="handleTranscription"
            @error="handleSpeechError"
          />
          <ion-button
            slot="end"
            type="submit"
            :disabled="!canSend"
            fill="clear"
          >
            <ion-icon :icon="sendOutline" />
          </ion-button>
        </ion-item>
      </form>
      <!-- Compact LLM and CIDAFM Controls -->
      <div class="llm-controls">
        <CompactLLMControl />
      </div>
    </div>
    <!-- Typing Indicator -->
    <div v-if="isSendingMessage" class="typing-indicator">
      <ion-spinner size="small" />
      <span>Agent is thinking...</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import {
  IonIcon,
  IonButton,
  IonItem,
  IonTextarea,
  IonSpinner,
} from '@ionic/vue';
import {
  alertCircleOutline,
  sendOutline,
} from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { usePrivacyIndicatorsStore } from '@/stores/privacyIndicatorsStore';
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import SpeechButton from './SpeechButton.vue';
// Define emits
interface Props {
  conversation?: any; // The conversation object from the store
}
const props = defineProps<Props>();
// Stores
const agentChatStore = useAgentChatStore();
const privacyIndicatorsStore = usePrivacyIndicatorsStore();
// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
// Computed - use conversation data from props when available
const currentAgent = computed(() => 
  props.conversation?.agent || agentChatStore.getActiveConversation()?.agent
);
const messages = computed(() => 
  props.conversation?.messages || agentChatStore.getActiveConversation()?.messages || []
);
const isLoading = computed(() => 
  props.conversation?.isLoading || agentChatStore.getActiveConversation()?.isLoading || false
);
const error = computed(() => 
  props.conversation?.error || agentChatStore.getActiveConversation()?.error || null
);
const isSendingMessage = computed(() => 
  props.conversation?.isSendingMessage || agentChatStore.getActiveConversation()?.isSendingMessage || false
);
const canSend = computed(() => 
  messageText.value.trim().length > 0 && currentAgent.value && !isSendingMessage.value
);

const conversationId = computed(() => 
  props.conversation?.id || agentChatStore.getActiveConversation()?.id
);
// Methods
const sendMessage = async () => {
  if (!canSend.value) return;
  const text = messageText.value.trim();
  messageText.value = '';
  try {
    // Send message directly through the agent chat store
    const activeConversation = agentChatStore.getActiveConversation();
    if (activeConversation && currentAgent.value) {
      await agentChatStore.sendMessage(text);
    } else {

    }
  } catch (error) {

    // Re-populate the input if there was an error
    messageText.value = text;
  }
  scrollToBottom();
};
const clearError = () => {
  // Clear error on the active conversation
  const activeConversation = agentChatStore.getActiveConversation();
  if (activeConversation) {
    activeConversation.error = undefined;
  }
};
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Speech handling functions
const handleTranscription = (transcribedText: string) => {
  // Optionally populate the text area with the transcribed text
  // messageText.value = transcribedText;
  console.log('Speech transcribed:', transcribedText);
};

const handleSpeechError = (error: string) => {
  console.error('Speech error:', error);
  // You could show a toast or other error handling here
};
// Watch for new messages to auto-scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});

// Initialize privacy indicators store
onMounted(async () => {
  await privacyIndicatorsStore.initialize();
  
  // Set up conversation privacy settings if we have a conversation
  if (conversationId.value) {
    privacyIndicatorsStore.setConversationSettings(conversationId.value, {
      enableRealTimeUpdates: true,
      updateInterval: 2000,
      compactMode: false,
      position: 'inline'
    });
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (conversationId.value) {
    privacyIndicatorsStore.stopConversationRealTimeUpdates(conversationId.value);
  }
});

// Watch for conversation changes
watch(() => conversationId.value, (newConversationId, oldConversationId) => {
  if (oldConversationId) {
    privacyIndicatorsStore.stopConversationRealTimeUpdates(oldConversationId);
  }
  
  if (newConversationId) {
    privacyIndicatorsStore.setConversationSettings(newConversationId, {
      enableRealTimeUpdates: true,
      updateInterval: 2000,
      compactMode: false,
      position: 'inline'
    });
  }
});
</script>
<style scoped>
.agent-chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color);
}
.controls-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 16px;
  background: var(--ion-color-step-25);
  border-bottom: 1px solid var(--ion-color-step-100);
  min-height: 48px;
}
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}
.error-state {
  color: var(--ion-color-danger);
}
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.message-item {
  display: flex;
  max-width: 80%;
}
.message-item.user-message {
  align-self: flex-end;
}
.message-item.assistant-message {
  align-self: flex-start;
}
.message-content {
  background: var(--ion-color-step-100);
  border-radius: 16px;
  padding: 12px 16px;
  max-width: 100%;
}
.user-message .message-content {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.message-text {
  line-height: 1.4;
  word-wrap: break-word;
}
.message-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.75em;
  opacity: 0.7;
}
.input-area {
  border-top: 1px solid var(--ion-color-step-150);
  padding: 8px;
}
.input-area ion-item {
  --padding-start: 16px;
  --padding-end: 8px;
}
.llm-controls {
  padding: 4px 8px;
}
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
</style>