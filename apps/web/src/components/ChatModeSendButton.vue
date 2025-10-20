<template>
  <div class="chat-mode-send-button">
    <!-- Mode selection buttons (always visible) -->
    <div class="mode-buttons">
      <ion-button
        v-for="mode in modes"
        :key="mode.value"
        size="small"
        :fill="currentMode === mode.value ? 'solid' : 'outline'"
        :color="currentMode === mode.value ? 'primary' : 'medium'"
        @click="selectMode(mode.value)"
        :disabled="disabled"
        class="mode-button"
        :title="mode.description"
      >
        <ion-icon :icon="mode.icon" slot="start"></ion-icon>
        {{ mode.name }}
      </ion-button>
    </div>

    <!-- Send button -->
    <ion-button
      :color="!disabled ? 'primary' : 'medium'"
      @click="sendWithCurrentMode"
      :disabled="disabled"
      class="send-button"
      :title="`Send (${currentModeName})`"
    >
      <ion-icon slot="icon-only" :icon="sendOutline"></ion-icon>
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonButton,
  IonIcon
} from '@ionic/vue';
import {
  sendOutline,
  chatbubblesOutline,
  documentTextOutline,
  hammerOutline
} from 'ionicons/icons';
import type { PrimaryChatMode, AgentChatMode } from '@/types/conversation';
import { DEFAULT_CHAT_MODES } from '@/types/conversation';
import { useChatUiStore } from '@/stores/ui/chatUiStore';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', mode: PrimaryChatMode): void;
}>();

// Migrated to conversationsStore + chatUiStore
const chatStore = useChatUiStore();

const baseModes: Array<{ value: PrimaryChatMode; name: string; icon: string; description: string }> = [
  {
    value: 'converse',
    name: 'Converse',
    icon: chatbubblesOutline,
    description: 'Quick conversation and answers'
  },
  {
    value: 'plan',
    name: 'Plan',
    icon: documentTextOutline,
    description: 'Create detailed plans and strategies'
  },
  {
    value: 'build',
    name: 'Build',
    icon: hammerOutline,
    description: 'Generate deliverables and content'
  }
];

// Use reactive getters instead of method calls
const currentMode = computed<AgentChatMode>(() => chatStore.chatMode as AgentChatMode);

const allowedModes = computed(() => {
  const conversation = chatStore.activeConversation;
  return conversation?.allowedChatModes?.length ? conversation.allowedChatModes : DEFAULT_CHAT_MODES;
});

const modes = computed(() => {
  // Show all modes that are allowed for this conversation
  const filtered = baseModes.filter(mode => allowedModes.value.includes(mode.value));

  // Don't filter out plan mode - agent should handle it gracefully if not supported
  // The backend will return an error if plan mode isn't available
  return filtered;
});

const currentModeConfig = computed(() => {
  return modes.value.find(m => m.value === currentMode.value) || modes.value[0] || baseModes[0];
});

const currentModeName = computed(() => {
  return currentModeConfig.value.name;
});

function selectMode(mode: PrimaryChatMode) {
  chatStore.setChatMode(mode);
}

function sendWithCurrentMode() {
  if (!props.disabled) {
    const activeMode =
      modes.value.find(m => m.value === currentMode.value)?.value ||
      modes.value[0]?.value ||
      'converse';
    emit('send', activeMode);
  }
}
</script>

<style scoped>
.chat-mode-send-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.mode-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.mode-button {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 32px;
  font-size: 0.85rem;
  text-transform: none;
  font-weight: 500;
}

/* Outline buttons - make them more visible */
.mode-button[fill="outline"] {
  --border-width: 2px;
  --color: var(--ion-color-medium-contrast);
  opacity: 0.7;
}

.mode-button[fill="outline"]:hover {
  opacity: 1;
  --border-color: var(--ion-color-primary);
}

/* Solid buttons - active state */
.mode-button[fill="solid"] {
  font-weight: 600;
}

.mode-button ion-icon {
  font-size: 1rem;
  margin-right: 4px;
}

.send-button {
  --padding-start: 12px;
  --padding-end: 12px;
  min-width: 48px;
  height: 40px;
  margin: 0;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .mode-button {
    --border-color: rgba(var(--ion-color-primary-rgb), 0.3);
  }
}
</style>
