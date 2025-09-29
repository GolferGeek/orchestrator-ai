<template>
  <div class="chat-mode-send-button">
    <!-- Main send button with current mode icon -->
    <ion-button
      fill="clear"
      :color="!disabled ? 'primary' : 'medium'"
      @click="sendWithCurrentMode"
      :disabled="disabled"
      class="send-button"
      :title="`Send (${currentModeName})`"
    >
      <ion-icon slot="icon-only" :icon="currentModeIcon"></ion-icon>
    </ion-button>

    <!-- Dropdown arrow for mode selection -->
    <ion-button
      fill="clear"
      :color="!disabled ? 'primary' : 'medium'"
      @click="toggleModeMenu"
      :disabled="disabled"
      class="mode-selector-button"
      size="small"
    >
      <ion-icon slot="icon-only" :icon="chevronDownOutline"></ion-icon>
    </ion-button>

    <!-- Mode selection popover -->
    <ion-popover
      :is-open="showModeMenu"
      @did-dismiss="showModeMenu = false"
      :trigger-action="'click'"
      class="mode-popover"
      :show-backdrop="false"
      alignment="end"
      side="top"
    >
      <ion-content class="mode-menu">
        <ion-list lines="none">
          <ion-item
            button
            v-for="mode in modes"
            :key="mode.value"
            @click="selectAndSend(mode.value)"
            :class="{ active: currentMode === mode.value }"
          >
            <ion-icon :icon="mode.icon" slot="start" :color="currentMode === mode.value ? 'primary' : 'medium'"></ion-icon>
            <ion-label>
              <h3>{{ mode.name }}</h3>
              <p>{{ mode.description }}</p>
            </ion-label>
            <ion-icon v-if="currentMode === mode.value" :icon="checkmarkOutline" slot="end" color="primary"></ion-icon>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel
} from '@ionic/vue';
import {
  sendOutline,
  chatbubblesOutline,
  documentTextOutline,
  hammerOutline,
  chevronDownOutline,
  checkmarkOutline
} from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';
import type { PrimaryChatMode, AgentChatMode } from '@/stores/agentChatStore/types';
import { DEFAULT_CHAT_MODES } from '@/stores/agentChatStore/types';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', mode: PrimaryChatMode): void;
}>();

const chatStore = useAgentChatStore();
const showModeMenu = ref(false);

const baseModes: Array<{ value: PrimaryChatMode; name: string; icon: any; description: string }> = [
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

const currentMode = computed<AgentChatMode>(() => chatStore.getActiveChatMode());

const allowedModes = computed(() => {
  const conversation = chatStore.getActiveConversation();
  return conversation?.allowedChatModes?.length ? conversation.allowedChatModes : DEFAULT_CHAT_MODES;
});

const modes = computed(() =>
  baseModes.filter(mode => allowedModes.value.includes(mode.value))
);

const currentModeConfig = computed(() => {
  return modes.value.find(m => m.value === currentMode.value) || modes.value[0] || baseModes[0];
});

const currentModeIcon = computed(() => {
  return currentModeConfig.value.icon;
});

const currentModeName = computed(() => {
  return currentModeConfig.value.name;
});

function toggleModeMenu() {
  showModeMenu.value = !showModeMenu.value;
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

function selectAndSend(mode: PrimaryChatMode) {
  showModeMenu.value = false;
  chatStore.setChatMode(mode);
  // Small delay to let the UI update before sending
  setTimeout(() => {
    emit('send', mode);
  }, 100);
}
</script>

<style scoped>
.chat-mode-send-button {
  display: flex;
  align-items: center;
  gap: 0;
}

.send-button {
  --padding-start: 12px;
  --padding-end: 8px;
  min-width: 44px;
  height: 44px;
  margin: 0;
}

.mode-selector-button {
  --padding-start: 4px;
  --padding-end: 8px;
  min-width: 32px;
  height: 44px;
  margin: 0;
  margin-left: -8px;
  border-left: 1px solid rgba(var(--ion-color-primary-rgb), 0.2);
}

.mode-popover {
  --width: 280px;
  --max-height: 320px;
}

.mode-menu {
  --background: var(--ion-background-color);
}

.mode-menu ion-list {
  padding: 8px 0;
}

.mode-menu ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 8px;
  --min-height: 56px;
}

.mode-menu ion-item.active {
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.mode-menu ion-item:hover {
  --background: rgba(var(--ion-color-primary-rgb), 0.04);
}

.mode-menu ion-label h3 {
  font-weight: 500;
  margin-bottom: 2px;
}

.mode-menu ion-label p {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  margin: 0;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .mode-selector-button {
    border-left-color: rgba(var(--ion-color-primary-rgb), 0.3);
  }
}
</style>
