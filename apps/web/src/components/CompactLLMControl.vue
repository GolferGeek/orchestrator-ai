<template>
  <div class="compact-llm-control">
    <div class="compact-display" @click="openModal">
      <div class="llm-info">
        <span class="provider-model">
          {{ currentProvider || 'Default' }} - {{ currentModel || 'Auto' }}
        </span>
        <div class="cidafm-preview">
          <span 
            v-for="modifier in firstTwoModifiers" 
            :key="modifier"
            class="modifier-tag"
          >
            {{ modifier }}
          </span>
          <span v-if="additionalModifiersCount > 0" class="more-count">
            +{{ additionalModifiersCount }}
          </span>
        </div>
      </div>
      <ion-icon :icon="settingsOutline" class="settings-icon" />
    </div>
    <!-- Modal -->
    <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>LLM & CIDAFM Settings</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="modal-content">
        <div class="settings-container">
          <LLMSelector />
          <CIDAFMControls />
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
} from '@ionic/vue';
import { settingsOutline, closeOutline } from 'ionicons/icons';
import { useLLMStore } from '@/stores/llmStore';
import LLMSelector from './LLMSelector.vue';
import CIDAFMControls from './CIDAFMControls.vue';
const llmStore = useLLMStore();
const isModalOpen = ref(false);
onMounted(() => {
  // Initialize store if not already done
  if (!llmStore.selectedProvider && !llmStore.selectedModel) {
    llmStore.initialize();
  }
});
// Computed properties for display
const currentProvider = computed(() => 
  llmStore.selectedProvider?.name || null
);
const currentModel = computed(() => 
  llmStore.selectedModel?.name || null
);
const allModifiers = computed(() => [
  ...llmStore.selectedCIDAFMCommands,
  ...llmStore.customModifiers,
]);
const firstTwoModifiers = computed(() => 
  allModifiers.value.slice(0, 2)
);
const additionalModifiersCount = computed(() => 
  Math.max(0, allModifiers.value.length - 2)
);
// Modal controls
const openModal = () => {
  isModalOpen.value = true;
};
const closeModal = () => {
  isModalOpen.value = false;
};
</script>
<style scoped>
.compact-llm-control {
  width: 100%;
}
.compact-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--ion-color-step-50);
  border: 1px solid var(--ion-color-step-150);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;
}
.compact-display:hover {
  background: var(--ion-color-step-100);
  border-color: var(--ion-color-primary);
}
.llm-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.provider-model {
  font-size: 0.9em;
  font-weight: 500;
  color: var(--ion-color-primary);
}
.cidafm-preview {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.modifier-tag {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7em;
  font-weight: 500;
}
.more-count {
  font-size: 0.7em;
  color: var(--ion-color-medium);
  font-weight: 500;
}
.settings-icon {
  font-size: 1.2em;
  color: var(--ion-color-medium);
}
.modal-content {
  --padding-top: 16px;
  --padding-bottom: 16px;
  --padding-start: 16px;
  --padding-end: 16px;
  --max-width: 100%;
  --width: 100%;
}
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>