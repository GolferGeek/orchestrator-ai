<template>
  <div v-if="hasMultipleNamespaces" class="namespace-switcher">
    <ion-select
      :value="currentNamespace"
      interface="popover"
      aria-label="Select active namespace"
      placeholder="Namespace"
      @ionChange="onNamespaceChange"
    >
      <ion-select-option
        v-for="ns in availableNamespaces"
        :key="ns"
        :value="ns"
      >
        {{ formatNamespace(ns) }}
      </ion-select-option>
    </ion-select>
  </div>
  <div v-else-if="currentNamespace" class="namespace-pill">
    {{ formatNamespace(currentNamespace) }}
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonSelect, IonSelectOption } from '@ionic/vue';
import type { SelectCustomEvent } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

const availableNamespaces = computed(() => authStore.availableNamespaces);
const currentNamespace = computed(() => authStore.currentNamespace);
const hasMultipleNamespaces = computed(() => availableNamespaces.value.length > 1);

function onNamespaceChange(event: SelectCustomEvent) {
  const value = event.detail.value as string | null;
  if (value) {
    authStore.setActiveNamespace(value);
  }
}

function formatNamespace(namespace: string): string {
  return namespace
    .split(/[\-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
</script>
<style scoped>
.namespace-switcher {
  display: flex;
  align-items: center;
}

.namespace-pill {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: var(--ion-color-dark, #222);
  font-size: 0.75rem;
  font-weight: 600;
}

ion-select {
  min-width: 140px;
  --padding-start: 0.5rem;
  --padding-end: 0.5rem;
  --padding-top: 0.25rem;
  --padding-bottom: 0.25rem;
  --min-height: 36px;
  font-size: 0.85rem;
}
</style>
