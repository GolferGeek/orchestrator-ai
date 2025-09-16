<template>
  <div class="chat-mode-control">
    <ion-item lines="none" class="compact-item">
      <ion-label class="label">Mode</ion-label>
      <ion-select interface="popover" :value="mode" @ionChange="onChange" class="compact-select">
        <ion-select-option value="converse">Converse</ion-select-option>
        <ion-select-option value="plan">Plan</ion-select-option>
        <ion-select-option value="build">Build</ion-select-option>
      </ion-select>
    </ion-item>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonItem, IonLabel, IonSelect, IonSelectOption } from '@ionic/vue';
import { useAgentChatStore } from '@/stores/agentChatStore';

const chatStore = useAgentChatStore();

const mode = computed(() => chatStore.getActiveChatMode());

function onChange(ev: CustomEvent) {
  const value = ev.detail.value as 'converse' | 'plan' | 'build';
  chatStore.setChatMode(value);
  // Optional: emit an event if switching to build should auto-trigger a build task later
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

