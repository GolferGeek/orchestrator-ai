<template>
  <div class="compact-llm-control">
    <div class="compact-display" @click="openModal">
      <div class="llm-info">
        <span class="provider-model">
          {{ currentProvider }} - {{ currentModel }}
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

    <!-- Unified LLM Selector Modal -->
    <LLMSelectorModal
      :is-open="isModalOpen"
      mode="select"
      title="Change Language Model"
      description="Select your preferred AI provider and model for this conversation."
      @dismiss="closeModal"
      @select="handleLLMSelect"
    />
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
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import LLMSelectorModal from './LLMSelectorModal.vue';

const llmStore = useLLMStore();
const userPreferencesStore = useUserPreferencesStore();
const isModalOpen = ref(false);

onMounted(async () => {
  // Initialize both stores
  await userPreferencesStore.initializePreferences();
  
  // Initialize LLM store if not already done
  if (!llmStore.selectedProvider && !llmStore.selectedModel) {
    // Initialize LLM store with user preferences
    await llmStore.initialize({
      preferredProvider: userPreferencesStore.preferredProvider,
      preferredModel: userPreferencesStore.preferredModel
    });
    
    // Sync LLM store selection back to user preferences to ensure consistency
    if (llmStore.selectedProvider && llmStore.selectedModel) {
      userPreferencesStore.setLLMPreferences(
        llmStore.selectedProvider.name,
        llmStore.selectedModel.modelName
      );
    }
  }
});

// Computed properties for display - use user preferences as source of truth
const currentProvider = computed(() => 
  userPreferencesStore.preferredProvider || llmStore.selectedProvider?.name || 'Default'
);

const currentModel = computed(() => 
  userPreferencesStore.preferredModel || llmStore.selectedModel?.name || 'Auto'
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

const handleLLMSelect = (config: { provider: string; model: string; temperature?: number; sadafum?: number; maxTokens?: number }) => {
  console.log('🎯 LLM selection applied:', config);
  // The LLMSelectorModal already handles the store updates and shows confirmation
  // Just close the modal
  closeModal();
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
  min-height: 2.75rem; /* 44px minimum touch target */
}

.compact-display:hover {
  background: var(--ion-color-step-100);
  border-color: var(--ion-color-step-200);
}

.llm-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0; /* Allow text truncation */
}

.provider-model {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cidafm-preview {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.modifier-tag {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.more-count {
  background: var(--ion-color-medium);
  color: var(--ion-color-medium-contrast);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
}

.settings-icon {
  color: var(--ion-color-medium);
  font-size: 1.2rem;
  margin-left: 8px;
  flex-shrink: 0;
}

.modal-content {
  --padding-top: 16px;
  --padding-bottom: 16px;
  --padding-start: 16px;
  --padding-end: 16px;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Dark theme support */
.theme-dark .compact-display {
  background: var(--ion-color-step-100);
  border-color: var(--ion-color-step-200);
}

.theme-dark .compact-display:hover {
  background: var(--ion-color-step-150);
  border-color: var(--ion-color-step-250);
}

.theme-dark .provider-model {
  color: var(--ion-color-light);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .compact-display {
    padding: 8px 12px;
  }
  
  .provider-model {
    font-size: 0.85rem;
  }
  
  .modifier-tag,
  .more-count {
    font-size: 0.65rem;
    padding: 1px 4px;
  }
}
</style>
