<template>
  <div class="agent-chat-view">
    <!-- Header -->
    <div class="chat-header">
      <div class="agent-info">
        <ion-icon :icon="getAgentIcon()" :color="getAgentColor()" />
        <div class="agent-details">
          <h3>{{ formatAgentName(currentAgent?.name || '') }}</h3>
          <p v-if="currentAgent?.description">
            {{ currentAgent.description }}
          </p>
          <p v-else>{{ getAgentTypeLabel() }}</p>
        </div>
      </div>
      <div class="header-actions">
        <TaskExecutionControls />
        <ion-button fill="clear" @click="$emit('close')">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </div>
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
      <span>{{ formatAgentName(currentAgent?.name || '') }} is thinking...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import {
  IonIcon,
  IonButton,
  IonItem,
  IonTextarea,
  IonSpinner,
} from '@ionic/vue';
import {
  closeOutline,
  alertCircleOutline,
  sendOutline,
  personOutline,
  serverOutline,
  cloudOutline,
  codeSlashOutline,
  megaphoneOutline,
  callOutline,
  businessOutline,
  settingsOutline,
  cardOutline,
  constructOutline,
  searchOutline,
  cubeOutline,
  scaleOutline,
} from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { formatAgentName } from '@/utils/caseConverter';
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';

// Define emits
interface Props {
  conversation?: any; // The conversation object from the store
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
  'send-message': [content: string];
}>();

// Store
const agentChatStore = useAgentChatStore();

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

// Methods
const sendMessage = async () => {
  if (!canSend.value) return;

  const text = messageText.value.trim();
  messageText.value = '';

  // Emit the message to parent component to handle
  emit('send-message', text);
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

const formatTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getAgentIcon = () => {
  const type = currentAgent.value?.type;
  const icons: Record<string, any> = {
    orchestrator: serverOutline,
    specialist: personOutline,
    marketing: megaphoneOutline,
    sales: callOutline,
    hr: businessOutline,
    operations: settingsOutline,
    finance: cardOutline,
    engineering: constructOutline,
    research: searchOutline,
    product: cubeOutline,
    legal: scaleOutline,
  };
  return icons[type!] || personOutline;
};

const getAgentColor = () => {
  const type = currentAgent.value?.type;
  const colors: Record<string, string> = {
    orchestrator: 'success',
    specialist: 'primary',
    marketing: 'secondary',
    sales: 'tertiary',
    hr: 'warning',
    operations: 'dark',
    finance: 'success',
    engineering: 'danger',
    research: 'medium',
    product: 'light',
    legal: 'primary',
  };
  return colors[type!] || 'medium';
};

const getAgentTypeLabel = () => {
  const type = currentAgent.value?.type;
  const labels: Record<string, string> = {
    specialist: 'Specialist Agent',
    orchestrator: 'Orchestrator Agent',
    marketing: 'Marketing Agent',
    sales: 'Sales Agent',
    hr: 'HR Agent',
    operations: 'Operations Agent',
    finance: 'Finance Agent',
    engineering: 'Engineering Agent',
    research: 'Research Agent',
    product: 'Product Agent',
    legal: 'Legal Agent',
  };
  return labels[type!] || 'Agent';
};

// Watch for new messages to auto-scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});
</script>

<style scoped>
.agent-chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--ion-color-step-50);
  border-bottom: 1px solid var(--ion-color-step-150);
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-details h3 {
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
}

.agent-details p {
  margin: 0;
  font-size: 0.9em;
  color: var(--ion-color-medium);
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