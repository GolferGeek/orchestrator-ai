<template>
  <div v-if="hasMultipleNamespaces" class="namespace-switcher">
    <ion-select
      :value="currentNamespace"
      interface="popover"
      :interface-options="{ cssClass: 'namespace-popover' }"
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
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const availableNamespaces = computed(() => authStore.availableNamespaces);
const currentNamespace = computed(() => authStore.currentNamespace || 'demo');
const hasMultipleNamespaces = computed(() => availableNamespaces.value.length > 1);

function getLandingPathForNamespace(namespace: string): string {
  const ns = (namespace || '').toLowerCase();
  const compact = ns.replace(/[^a-z0-9]/g, '');
  if (compact === 'demo') return '/landing';
  if (compact === 'myorg') return '/my-org';
  if (ns === 'saas' || ns.startsWith('saas-') || compact.startsWith('saas')) return '/saas';
  return '/landing';
}

function onNamespaceChange(event: SelectCustomEvent) {
  const value = event.detail.value as string | null;
  if (value) {
    authStore.setActiveNamespace(value);
    const target = getLandingPathForNamespace(value);
    router.replace(target);
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
  /* Ensure trigger text is visible on light header */
  --color: var(--ion-color-dark, #222);
  --placeholder-color: var(--ion-color-medium, #6b7280);
  font-size: 0.85rem;
}

/* Fallback for browsers needing part selector */
ion-select::part(text) {
  color: var(--ion-color-dark, #222);
}
</style>
