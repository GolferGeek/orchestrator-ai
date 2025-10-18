<template>
  <div class="chat-mode-control">
    <ion-item lines="none" class="compact-item">
      <ion-label class="label">Mode</ion-label>
      <ion-select interface="popover" :value="mode" @ionChange="onChange" class="compact-select">
        <ion-select-option
          v-for="option in selectableModes"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
          :title="option.tooltip"
        >
          {{ option.label }}
        </ion-select-option>
      </ion-select>
    </ion-item>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonItem, IonLabel, IonSelect, IonSelectOption } from '@ionic/vue';
import type { PrimaryChatMode } from '@/types/conversation';
import { DEFAULT_CHAT_MODES } from '@/types/conversation';
import analyticsService from '@/services/analyticsService';

// Migrated to conversationsStore + chatUiStore

const mode = computed(() => chatStore.getActiveChatMode());

const BASE_MODE_OPTIONS: Array<{ value: PrimaryChatMode; label: string }> = [
  { value: 'converse', label: 'Converse' },
  { value: 'plan', label: 'Plan' },
  { value: 'build', label: 'Build' },
];

type SelectableMode = {
  value: PrimaryChatMode;
  label: string;
  disabled?: boolean;
  tooltip?: string;
};

const selectableModes = computed<SelectableMode[]>(() => {
  const conv = chatStore.getActiveConversation();
  const allowed = conv?.allowedChatModes?.length ? conv.allowedChatModes : DEFAULT_CHAT_MODES;
  const agent = conv?.agent;
  const planSupported = Boolean(agent?.plan_structure);

  return BASE_MODE_OPTIONS.filter(option => {
    if (option.value === 'plan') {
      return allowed.includes(option.value) || !planSupported;
    }
    return allowed.includes(option.value);
  }).map(option => {
    if (option.value === 'plan' && !planSupported) {
      return {
        ...option,
        disabled: true,
        tooltip: 'This agent does not support planning',
      };
    }

    return {
      ...option,
      disabled: !allowed.includes(option.value),
    };
  });
});

function onChange(ev: CustomEvent) {
  const value = ev.detail.value as PrimaryChatMode;
  chatStore.setChatMode(value);
  // Optional: emit an event if switching to build should auto-trigger a build task later
  const conv = chatStore.getActiveConversation();
  analyticsService.trackEvent({
    eventType: 'ui',
    category: 'chat',
    action: 'mode_selected',
    label: value,
    value: undefined,
    properties: {
      conversationId: conv?.id,
      agentName: conv?.agent?.name,
      agentType: conv?.agent?.type,
    },
    context: { url: window.location.pathname, userAgent: navigator.userAgent },
  });
}
</script>
<style scoped>
.chat-mode-control {
  display: inline-flex;
}
.compact-item {
  --inner-padding-end: 0;
  --min-height: 36px;
  --padding-start: 8px;
  --padding-end: 8px;
}
.label {
  margin-right: 6px;
}
.compact-select {
  min-width: 120px;
}
</style>
