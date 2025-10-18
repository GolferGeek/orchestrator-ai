<template>
  <ion-modal :is-open="isOpen" @did-dismiss="handleDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ modalTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleCancel">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="modal-content">
      <div class="llm-modal-container">
        <div v-if="description" class="modal-description">
          <p>{{ description }}</p>
        </div>
        
        <div class="llm-selector-content">
          <!-- Provider Selection -->
          <div class="selection-group">
            <label class="selection-label">AI Provider</label>
            <select 
              v-model="selectedProvider" 
              :disabled="llmStore.loadingProviders"
              class="selection-dropdown"
              @change="onProviderChange"
            >
              <option value="">Select Provider...</option>
              <option 
                v-for="provider in llmStore.filteredProviders" 
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
              :disabled="llmStore.loadingModels || !selectedProvider"
              class="selection-dropdown"
              @change="onModelChange"
            >
              <option value="">Select Model...</option>
              <option 
                v-for="model in llmStore.availableModels" 
                :key="model.id" 
                :value="model"
              >
                {{ model.name }}
                <span v-if="model.pricingInputPer1k" class="model-pricing">
                  (${{ model.pricingInputPer1k }}/1k in, ${{ model.pricingOutputPer1k }}/1k out)
                </span>
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
                @input="onTemperatureChange"
                class="setting-slider"
              >
            </div>
            <div class="setting-group">
            </div>
            <div class="setting-group">
              <label class="setting-label">Max Tokens</label>
              <input 
                type="number" 
                v-model.number="maxTokens" 
                placeholder="Leave blank for model default"
                min="1"
                @input="onMaxTokensChange"
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

          <!-- Sovereign Mode (moved to bottom) -->
          <div v-if="!llmStore.sovereignPolicy?.enforced" class="sovereign-mode-section bottom">
            <div class="sovereign-toggle-group">
              <label class="sovereign-label">
                <input 
                  type="checkbox" 
                  v-model="userSovereignMode"
                  :disabled="llmStore.sovereignPolicy?.enforced || loadingSovereignUpdate"
                  class="sovereign-checkbox"
                  @change="onSovereignModeChange"
                />
                <span class="sovereign-text">Sovereign Mode</span>
                <span class="sovereign-badge" :class="effectiveSovereignModeClass">
                  {{ effectiveSovereignModeText }}
                </span>
              </label>
            </div>
          </div>
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
        @click="handlePrimaryAction"
        :disabled="!canExecuteAction"
        color="primary"
        size="default"
      >
        <ion-icon :icon="primaryActionIcon" slot="start" />
        {{ primaryActionText }}
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
  toastController,
} from '@ionic/vue';
import {
  closeOutline,
  checkmarkOutline,
  playOutline,
} from 'ionicons/icons';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import type { Provider, Model } from '@/types/llm';

interface Props {
  isOpen: boolean;
  mode: 'select' | 'execute'; // 'select' for conversation, 'execute' for rerun
  title?: string;
  description?: string;
}

interface Emits {
  (e: 'dismiss'): void;
  (e: 'select', config: { provider: string; model: string; temperature?: number; maxTokens?: number }): void;
  (e: 'execute', config: { provider: string; model: string; temperature?: number; maxTokens?: number }): void;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
});

// Stores
const llmStore = useLLMPreferencesStore();
const userPreferencesStore = useUserPreferencesStore();

// Local state
const selectedProvider = ref<Provider | ''>('');
const selectedModel = ref<Model | ''>('');
const temperature = ref(0.7);
const maxTokens = ref<number | undefined>(undefined);
const showAdvanced = ref(false);
const userSovereignMode = ref(false);
const loadingSovereignUpdate = ref(false);

// Computed properties
const modalTitle = computed(() => {
  if (props.title) return props.title;
  return props.mode === 'select' ? 'Change Language Model' : 'Run with Different LLM';
});

const primaryActionText = computed(() => {
  return props.mode === 'select' ? 'Apply Selection' : 'Run with Selected LLM';
});

const primaryActionIcon = computed(() => {
  return props.mode === 'select' ? checkmarkOutline : playOutline;
});

const canExecuteAction = computed(() => {
  return selectedProvider.value && selectedModel.value;
});

// Sovereign mode computed properties (simplified from original LLMSelector)
const effectiveSovereignModeClass = computed(() => {
  return llmStore.sovereignMode ? 'enabled' : 'disabled';
});

const effectiveSovereignModeText = computed(() => {
  return llmStore.sovereignMode ? 'ON' : 'OFF';
});

// Initialize
onMounted(async () => {
  // Align initialization with full LLMSelector component for consistency
  try {
    await llmStore.initializeSovereignMode();
  } catch {}
  await llmStore.initialize();
  
  // Sync with store state
  selectedProvider.value = llmStore.selectedProvider || '';
  selectedModel.value = llmStore.selectedModel || '';
  temperature.value = llmStore.temperature;
  maxTokens.value = llmStore.maxTokens;
  userSovereignMode.value = llmStore.sovereignMode;
});

// Event handlers
const onProviderChange = () => {
  if (selectedProvider.value && typeof selectedProvider.value === 'object') {
    llmStore.setProvider(selectedProvider.value);
    // Immediately sync with user preferences for reactive display
    if (selectedModel.value && typeof selectedModel.value === 'object') {
      userPreferencesStore.setLLMPreferences(
        selectedProvider.value.name, 
        selectedModel.value.name
      );
    }
  }
};

const onModelChange = () => {
  if (selectedModel.value && typeof selectedModel.value === 'object') {
    llmStore.setModel(selectedModel.value);
    // Immediately sync with user preferences for reactive display
    if (selectedProvider.value && typeof selectedProvider.value === 'object') {
      userPreferencesStore.setLLMPreferences(
        selectedProvider.value.name, 
        selectedModel.value.name
      );
    }
  }
};

const onTemperatureChange = () => {
  llmStore.setTemperature(temperature.value);
};

const onMaxTokensChange = () => {
  llmStore.setMaxTokens(maxTokens.value);
};

const onSovereignModeChange = async () => {
  if (loadingSovereignUpdate.value) return;
  
  loadingSovereignUpdate.value = true;
  try {
    llmStore.setSovereignMode(userSovereignMode.value);
  } catch (error) {
    console.error('Failed to update sovereign mode:', error);
    userSovereignMode.value = !userSovereignMode.value;
  } finally {
    loadingSovereignUpdate.value = false;
  }
};

const handleCancel = () => {
  emit('dismiss');
};

const handleDismiss = () => {
  emit('dismiss');
};

const handlePrimaryAction = async () => {
  if (!canExecuteAction.value) return;

  const config = {
    provider: (selectedProvider.value as Provider).name.toLowerCase(),
    model: (selectedModel.value as Model).modelName,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
  };

  if (props.mode === 'select') {
    // Update user preferences to ensure reactivity
    const providerName = (selectedProvider.value as Provider).name;
    const modelName = (selectedModel.value as Model).name;
    
    // Update user preferences store for reactive display
    userPreferencesStore.setLLMPreferences(providerName, modelName);
    
    // Just apply the selection and show confirmation
    const toast = await toastController.create({
      message: `✅ LLM selection applied: ${providerName}/${modelName}`,
      duration: 2000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
    
    emit('select', config);
  } else {
    // Execute the action (rerun)
    emit('execute', config);
  }
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

.sovereign-mode-section.bottom {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--ion-color-light);
}

.sovereign-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sovereign-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sovereign-checkbox {
  margin: 0;
}

.sovereign-text {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.sovereign-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}

.sovereign-badge.enabled {
  background: var(--ion-color-success);
  color: white;
}

.sovereign-badge.disabled {
  background: var(--ion-color-light);
  color: var(--ion-color-medium);
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

/* Dark theme support */
html[data-theme="dark"] .modal-description p {
  color: #a0aec0;
}

html[data-theme="dark"] .selection-label {
  color: #f7fafc;
}

html[data-theme="dark"] .setting-label {
  color: #f7fafc;
}

html[data-theme="dark"] .sovereign-text {
  color: #f7fafc;
}

html[data-theme="dark"] .modal-footer {
  background: var(--ion-color-step-100);
  border-color: #4a5568;
}

html[data-theme="dark"] .advanced-settings {
  background: var(--ion-color-step-150);
}

html[data-theme="dark"] .sovereign-mode-section.bottom {
  border-color: #4a5568;
}
</style>
