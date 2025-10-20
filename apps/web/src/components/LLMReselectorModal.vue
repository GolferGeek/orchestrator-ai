<template>
  <ion-modal :is-open="isOpen" @did-dismiss="handleDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>Run with Different LLM</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleCancel">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="modal-content">
      <div class="llm-modal-container">
        <div class="modal-description">
          <p>This will create a new version using a different LLM model with the same original prompt.</p>
        </div>

        <div class="llm-selector-content">
          <!-- Provider Selection -->
          <div class="selection-group">
            <label class="selection-label">AI Provider</label>
            <select
              v-model="selectedProvider"
              :disabled="loadingModels"
              class="selection-dropdown"
              @change="onProviderChange"
            >
              <option value="">Select Provider...</option>
              <option
                v-for="provider in availableProviders"
                :key="provider.id"
                :value="provider"
              >
                {{ provider.name }}
              </option>
            </select>
          </div>

          <!-- Model Selection -->
          <div class="selection-group">
            <label class="selection-label">Model</label>
            <select
              v-model="selectedModel"
              :disabled="loadingModels || !selectedProvider"
              class="selection-dropdown"
            >
              <option value="">Select Model...</option>
              <option
                v-for="model in availableModels"
                :key="model.id"
                :value="model"
              >
                {{ model.name }}
              </option>
            </select>
          </div>

          <!-- Advanced Settings -->
          <div v-if="showAdvanced" class="advanced-settings">
            <div class="setting-group">
              <label class="setting-label">Temperature ({{ temperature }})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                v-model.number="temperature"
                class="setting-slider"
              >
            </div>
            <div class="setting-group">
              <label class="setting-label">Max Tokens</label>
              <input
                type="number"
                v-model.number="maxTokens"
                placeholder="Leave blank for model default"
                min="1"
                class="setting-input"
              >
            </div>
          </div>

          <!-- Toggle Advanced Settings -->
          <button
            @click="showAdvanced = !showAdvanced"
            class="toggle-advanced"
          >
            {{ showAdvanced ? 'Hide' : 'Show' }} Advanced Settings
          </button>
        </div>
      </div>
    </ion-content>

    <!-- Action Footer -->
    <div class="modal-footer">
      <ion-button
        fill="clear"
        @click="handleCancel"
        size="default"
      >
        Cancel
      </ion-button>
      <ion-button
        @click="handleRunWithSelected"
        :disabled="!canRun"
        color="primary"
        size="default"
      >
        <ion-icon :icon="playOutline" slot="start" />
        Run with Selected LLM
      </ion-button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
} from '@ionic/vue';
import {
  closeOutline,
  playOutline,
} from 'ionicons/icons';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import type { Provider, Model } from '@/types/llm';

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'dismiss'): void;
  (e: 'execute', config: { provider: string; model: string; temperature?: number; maxTokens?: number }): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

// Store
const llmStore = useLLMPreferencesStore();

// Local state - completely independent from store
const selectedProvider = ref<Provider | ''>('');
const selectedModel = ref<Model | ''>('');
const temperature = ref(0.7);
const maxTokens = ref<number | undefined>(undefined);
const showAdvanced = ref(false);
const loadingModels = ref(false);
const availableProviders = ref<Provider[]>([]);
const availableModels = ref<Model[]>([]);

// Computed
const canRun = computed(() => {
  if (!selectedProvider.value || typeof selectedProvider.value === 'string') return false;
  if (!selectedModel.value || typeof selectedModel.value === 'string') return false;
  const provider = selectedProvider.value as Provider;
  const model = selectedModel.value as Model;
  return !!(provider.name && model.modelName);
});

// Initialize
onMounted(async () => {
  // Initialize LLM store to get providers/models lists
  await llmStore.initialize();

  // Get providers from store
  availableProviders.value = llmStore.filteredProviders;

  // DON'T initialize with store selection - user must explicitly choose for rerun
  // This is a rerun operation, not changing the conversation's default LLM
});

// Load models for a provider WITHOUT updating the store
const loadModelsForProvider = async (provider: Provider) => {
  loadingModels.value = true;
  try {
    // Get all models from store
    const allModels = llmStore.filteredModels;
    // Filter to this provider
    availableModels.value = allModels.filter(m => m.providerName === provider.name);
  } finally {
    loadingModels.value = false;
  }
};

// Event handlers
const onProviderChange = async () => {
  // Reset model selection since provider changed
  selectedModel.value = '';
  availableModels.value = [];

  // Load models for the selected provider
  // DON'T update the store - just load the models list
  if (selectedProvider.value && typeof selectedProvider.value === 'object') {
    await loadModelsForProvider(selectedProvider.value as Provider);
  }
};

const handleCancel = () => {
  emit('dismiss');
};

const handleDismiss = () => {
  emit('dismiss');
};

const handleRunWithSelected = () => {
  if (!canRun.value) return;

  const provider = selectedProvider.value as Provider;
  const model = selectedModel.value as Model;

  // Build config and emit it
  // DON'T update the store - this is a one-time execution
  const config = {
    provider: provider.name.toLowerCase(),
    model: model.modelName,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
  };

  console.log('🔄 [LLMReselectorModal] Emitting execute with config:', config);

  // Emit the config - parent will use it to call rerun
  emit('execute', config);
};
</script>

<style scoped>
.llm-modal-container {
  padding: 20px;
}

.modal-description {
  margin-bottom: 20px;
}

.modal-description p {
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.llm-selector-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selection-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selection-label {
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}

.selection-dropdown {
  padding: 12px;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--ion-color-step-50);
}

.selection-dropdown:focus {
  outline: none;
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.2);
}

.advanced-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--ion-color-step-100);
  border-radius: 8px;
  margin-top: 8px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-weight: 500;
  color: var(--ion-color-dark);
  font-size: 0.85rem;
}

.setting-slider {
  width: 100%;
}

.setting-input {
  padding: 8px 12px;
  border: 1px solid var(--ion-color-light);
  border-radius: 6px;
  font-size: 0.9rem;
}

.toggle-advanced {
  background: var(--ion-color-primary);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 8px;
  align-self: flex-start;
}

.toggle-advanced:hover {
  background: var(--ion-color-primary-shade);
}

.modal-footer {
  padding: 16px 20px;
  background: var(--ion-color-step-50);
  border-top: 1px solid var(--ion-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
</style>
