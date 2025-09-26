<template>
  <div class="agent-chat-view">
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
      <!-- Agent Resources Panel -->
      <AgentResourcesPanel
        v-if="shouldShowAgentResources"
        :agent-video-ids="agentVideoIds"
        :fallback-video-ids="fallbackVideoIds"
        :videos="allVideos"
        :agent-slug="agentSlug"
        :agent-name="currentAgent?.name"
      />
      
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
          <!-- Mode-aware Send Button -->
          <ChatModeSendButton
            slot="end"
            :disabled="!canSend"
            @send="sendMessage"
          />
        </ion-item>
      </form>
      <!-- Compact LLM and Execution Controls -->
      <div class="llm-controls">
        <CompactLLMControl />
        <TaskExecutionControls />
      </div>
    </div>
    <!-- Typing Indicator -->
    <!-- Conversational/Planning thinking bubble -->
    <div v-if="isSendingMessage && (chatMode === 'converse' || chatMode === 'plan')" class="prominent-thinking-indicator">
      <div class="thinking-content">
        <div class="thinking-avatar">
          <ion-spinner name="dots" color="primary"></ion-spinner>
        </div>
        <div class="thinking-bubble">
          <div class="thinking-text">
            <div class="agent-thinking-name">{{ currentAgent?.name || 'Agent' }}</div>
            <div class="thinking-message">{{ thinkingMessage }}</div>
          </div>
          <div class="thinking-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>
    <!-- Default typing indicator for non-converse modes -->
    <div v-else-if="isSendingMessage" class="typing-indicator">
      <ion-spinner size="small" />
      <span>Processing...</span>
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
import { videoService, type Video } from '@/services/videoService';
// TTS is now handled directly in AgentTaskItem when messages are displayed
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import SpeechButton from './SpeechButton.vue';
import ChatModeSendButton from './ChatModeSendButton.vue';
import AgentResourcesPanel from './AgentResourcesPanel.vue';
// Define emits
interface Props {
  conversation?: any; // The conversation object from the store
}
const props = defineProps<Props>();
// Stores
const agentChatStore = useAgentChatStore();
const privacyIndicatorsStore = usePrivacyIndicatorsStore();

// TTS is now handled directly in AgentTaskItem components

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
const chatMode = computed(() => agentChatStore.getActiveChatMode());

// Informal thinking message for converse/plan
const thinkingMessage = computed(() => {
  const mode = (chatMode.value || '').toLowerCase();
  if (mode === 'converse') return 'One sec — thinking it through…';
  if (mode === 'plan') return 'Sketching a quick plan…';
  return 'Processing…';
});

const conversationId = computed(() => 
  props.conversation?.id || agentChatStore.getActiveConversation()?.id
);

// Video-related computed properties
const agentSlug = computed(() => {
  // Extract agent slug from currentAgent data if available
  return currentAgent.value?.slug || currentAgent.value?.id || '';
});

const agentVideoIds = computed(() => {
  if (!agentSlug.value) return [];
  return videoService.getAgentVideoIds(agentSlug.value);
});

const fallbackVideoIds = computed(() => {
  return videoService.getDefaultVideoIds();
});

const allVideos = computed(() => {
  return videoService.getAllVideos();
});

const shouldShowAgentResources = computed(() => {
  // Show panel if we have a current agent and at least one video to display
  return currentAgent.value && (agentVideoIds.value.length > 0 || fallbackVideoIds.value.length > 0);
});
// Methods
const sendMessage = async (mode?: 'converse' | 'plan' | 'build') => {
  if (!canSend.value) return;
  const text = messageText.value.trim();
  messageText.value = '';

  // If mode is provided, set it before sending
  if (mode) {
    agentChatStore.setChatMode(mode);
  }

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
  // TTS cleanup is handled in individual AgentTaskItem components
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
/* Prominent thinking indicator (converse mode) */
.prominent-thinking-indicator {
  margin-bottom: 16px;
  padding: 0 16px;
}
.thinking-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.thinking-avatar {
  width: 32px;
  height: 32px;
  background-color: var(--ion-color-medium-tint);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.thinking-bubble {
  background: var(--ion-color-light-shade);
  padding: 12px 16px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  flex: 1;
  max-width: 300px;
}
.thinking-text {
  margin-bottom: 8px;
}
.agent-thinking-name {
  font-size: 0.8em;
  font-weight: bold;
  color: var(--ion-color-medium-shade);
  margin-bottom: 2px;
}
.thinking-message {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  font-style: italic;
}
.thinking-dots {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}
.dot {
  width: 6px;
  height: 6px;
  background-color: var(--ion-color-medium);
  border-radius: 50%;
  animation: thinking-pulse 1.4s infinite ease-in-out;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }
@keyframes thinking-pulse {
  0%, 80%, 100% { 
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% { 
    transform: scale(1);
    opacity: 1;
  }
}
</style>
