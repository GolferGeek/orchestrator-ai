<template>
  <div class="agent-chat-view">
    <ChatHeader>
      <template #controls>
        <ChatModeControl />
      </template>
    </ChatHeader>
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
        :conversation-id="conversationId"
        :agent-name="currentAgent?.name"
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
    <div v-if="isSendingMessage" class="mode-loading-indicator">
      <ion-spinner name="dots" />
      <span>{{ loadingMessage }}</span>
      <ion-button
        v-if="showCancelButton"
        size="small"
        fill="outline"
        @click="cancelCurrentOperation"
      >
        Cancel
      </ion-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import {
  IonIcon,
  IonItem,
  IonTextarea,
  IonSpinner,
} from '@ionic/vue';
import {
  alertCircleOutline,
} from 'ionicons/icons';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { usePrivacyStore } from '@/stores/privacyStore';
import { sendMessage, createPlan, createDeliverable } from '@/services/agent2agent/actions';
import { tasksService } from '@/services/tasksService';
// TTS is now handled directly in AgentTaskItem when messages are displayed
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import SpeechButton from './SpeechButton.vue';
import ChatModeSendButton from './ChatModeSendButton.vue';
import ChatHeader from './ChatHeader.vue';
import ChatModeControl from './ChatModeControl.vue';
import { useModeSwitchShortcuts } from '@/composables/useKeyboardShortcuts';
import type { AgentChatMode, AgentConversation } from '@/types/conversation';
// Define emits
interface Props {
  conversation?: AgentConversation; // The conversation object from the store
}
const props = defineProps<Props>();
// Stores
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const privacyIndicatorsStore = usePrivacyStore();
useModeSwitchShortcuts(chatUiStore);

// TTS is now handled directly in AgentTaskItem components

// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
// Computed - use conversation data from props when available, otherwise use reactive store getter
const currentAgent = computed(() => {
  const conv = props.conversation || chatUiStore.activeConversation;
  if (!conv) return null;
  return {
    name: conv.agentName || '',
    type: conv.agentType || 'custom',
    slug: conv.agentName || '',
    id: conv.agentName || '',
    organizationSlug: conv.organizationSlug,
  };
});
const messages = computed(() => {
  // Get conversation ID from props or active conversation
  const conversationId = props.conversation?.id || chatUiStore.activeConversation?.id;

  if (!conversationId) {
    console.log('📭 [AgentChatView] No conversationId, returning empty messages');
    return [];
  }

  // Get messages from the store's messages Map (not from conversation.messages)
  const msgs = conversationsStore.messagesByConversation(conversationId);
  console.log('📬 [AgentChatView] Messages computed for conversation', conversationId, ':', msgs.length);
  return msgs;
});
const isLoading = computed(() =>
  props.conversation?.isLoading || chatUiStore.activeConversation?.isLoading || false
);
const error = computed(() =>
  props.conversation?.error || chatUiStore.activeConversation?.error || null
);
const isSendingMessage = computed(() =>
  props.conversation?.isSendingMessage || chatUiStore.activeConversation?.isSendingMessage || false
);
const canSend = computed(() =>
  messageText.value.trim().length > 0 && currentAgent.value && !isSendingMessage.value
);
const chatMode = computed(() => chatUiStore.chatMode);
const loadingMessage = computed(() => {
  const mode = (chatMode.value || '').toLowerCase();
  if (mode === 'plan') return 'Creating plan...';
  if (mode === 'build') return 'Building deliverable...';
  return 'Agent is typing...';
});
const showCancelButton = computed(() => chatMode.value === 'build');

const conversationId = computed(() =>
  props.conversation?.id || chatUiStore.activeConversation?.id
);
// Methods
const sendMessage = async (mode?: AgentChatMode) => {
  if (!canSend.value) return;
  const text = messageText.value.trim();
  messageText.value = '';

  // If mode is provided, set it before sending
  if (mode) {
    chatUiStore.setChatMode(mode);
  }

  try {
    // Send message using service layer (Vue reactivity handles UI updates)
    const activeConversation = chatUiStore.activeConversation;
    if (activeConversation && currentAgent.value) {
      const effectiveMode = chatMode.value;
      const agentName = currentAgent.value.name;

      // Route to appropriate action based on mode
      if (effectiveMode === 'plan') {
        await createPlan(agentName, activeConversation.id, text);
      } else if (effectiveMode === 'build') {
        await createDeliverable(agentName, activeConversation.id, text);
      } else {
        // converse mode (default)
        await sendMessage(agentName, activeConversation.id, text);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    // Re-populate the input if there was an error
    messageText.value = text;
  }
  scrollToBottom();
};
const clearError = () => {
  // Clear error using store mutation (Vue reactivity handles UI updates)
  conversationsStore.clearError();
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

const cancelCurrentOperation = async () => {
  try {
    const activeConversation = chatUiStore.activeConversation;
    if (!activeConversation?.activeTaskId) {
      console.warn('No active task to cancel');
      return;
    }

    await tasksService.cancelTask(activeConversation.activeTaskId);
    console.log('Task cancelled successfully');
  } catch (error) {
    console.error('Failed to cancel current operation', error);
  }
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
.mode-loading-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
  border-top: 1px solid var(--ion-color-step-100);
  background: var(--ion-color-step-25);
}

.mode-loading-indicator ion-spinner {
  --spinner-width: 20px;
  --spinner-height: 20px;
}

.mode-loading-indicator ion-button {
  margin-left: auto;
}
</style>
