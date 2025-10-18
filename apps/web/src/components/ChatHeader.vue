<template>
  <div class="chat-header">
    <div class="agent-info">
      <h2>{{ agent?.name || 'Conversation' }}</h2>
      <span v-if="showConversationOnlyBadge" class="badge conversation-only">
        💬 Conversation Only
      </span>
    </div>

    <div class="header-controls">
      <slot name="controls"></slot>
      <div class="mode-indicator" :class="modeClass">
        <ion-icon :icon="modeIcon"></ion-icon>
        <span>{{ modeLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chatbubblesOutline, documentTextOutline, hammerOutline } from 'ionicons/icons';

// Migrated to conversationsStore + chatUiStore

const agent = computed(() => chatStore.getActiveConversation()?.agent || null);
const currentMode = computed(() => chatStore.getActiveChatMode());

const modeConfig = {
  converse: { icon: chatbubblesOutline, label: 'Talking', className: 'mode-converse' },
  plan: { icon: documentTextOutline, label: 'Planning', className: 'mode-plan' },
  build: { icon: hammerOutline, label: 'Building', className: 'mode-build' },
};

const activeModeConfig = computed(() => modeConfig[currentMode.value as keyof typeof modeConfig] ?? modeConfig.converse);
const modeIcon = computed(() => activeModeConfig.value.icon);
const modeLabel = computed(() => activeModeConfig.value.label);
const modeClass = computed(() => activeModeConfig.value.className);

const showConversationOnlyBadge = computed(() => {
  const currentAgent = agent.value;
  if (!currentAgent) {
    return false;
  }
  return !currentAgent.plan_structure;
});
</script>

<style scoped>
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: var(--ion-color-light-shade);
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-controls {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.agent-info h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  color: var(--ion-color-primary);
  line-height: 1.2;
}

.mode-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.9rem;
  font-weight: 500;
}

.mode-converse {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.mode-plan {
  background: rgba(var(--ion-color-secondary-rgb), 0.12);
  color: var(--ion-color-secondary);
}

.mode-build {
  background: rgba(var(--ion-color-tertiary-rgb), 0.12);
  color: var(--ion-color-tertiary);
}
</style>
