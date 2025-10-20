<template>
  <div class="llm-selector">
    <!-- Sovereign Mode Toggle -->
    <div v-if="!llmStore.sovereignPolicy?.enforced" class="sovereign-mode-section">
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
        <div class="sovereign-description">
          {{ sovereignModeDescription }}
        </div>
      </div>
      
      <!-- Policy Override Messages -->
      <div v-if="policyMessage" class="policy-message" :class="policyMessageClass">
        <span class="policy-icon">{{ policyMessageIcon }}</span>
        {{ policyMessage }}
      </div>
    </div>

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
      <div v-if="llmStore.providerError" class="error-message">
        {{ llmStore.providerError }}
      </div>
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
      <div v-if="llmStore.modelError" class="error-message">
        {{ llmStore.modelError }}
      </div>
      
      <!-- No Models Available Error -->
      <div v-if="showNoModelsError" class="no-models-error">
        <div class="no-models-icon">🚫</div>
        <div class="no-models-content">
          <div class="no-models-title">{{ noModelsErrorTitle }}</div>
          <div class="no-models-description">{{ noModelsErrorDescription }}</div>
          <div v-if="noModelsErrorSuggestion" class="no-models-suggestion">
            {{ noModelsErrorSuggestion }}
          </div>
        </div>
      </div>
    </div>
    <!-- Model Info Display -->
    <div v-if="selectedModel" class="model-info">
      <div class="model-info-header">
        <h4>{{ selectedModel.name }}</h4>
        <span class="provider-badge">{{ (selectedProvider && typeof selectedProvider === 'object') ? selectedProvider.name : '' }}</span>
      </div>
      <p v-if="selectedModel.description" class="model-description">
        {{ selectedModel.description }}
      </p>
      <div class="model-details">
        <div v-if="selectedModel.maxTokens" class="detail-item">
          <span class="detail-label">Max Tokens:</span>
          <span class="detail-value">{{ selectedModel.maxTokens?.toLocaleString() }}</span>
        </div>
        <div v-if="selectedModel.pricingInputPer1k" class="detail-item">
          <span class="detail-label">Pricing:</span>
          <span class="detail-value">
            ${{ selectedModel.pricingInputPer1k }}/1k input, 
            ${{ selectedModel.pricingOutputPer1k }}/1k output
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Features:</span>
          <span class="detail-value">
            <span v-if="selectedModel.supportsStreaming" class="feature-tag">Streaming</span>
            <span v-if="selectedModel.supportsFunctionCalling" class="feature-tag">Functions</span>
          </span>
        </div>
      </div>
      <!-- Strengths and Use Cases -->
      <div v-if="selectedModel.strengths?.length" class="model-tags">
        <span class="tags-label">Strengths:</span>
        <span 
          v-for="strength in selectedModel.strengths" 
          :key="strength" 
          class="tag strength-tag"
        >
          {{ strength }}
        </span>
      </div>
      <div v-if="selectedModel.useCases?.length" class="model-tags">
        <span class="tags-label">Best for:</span>
        <span 
          v-for="useCase in selectedModel.useCases" 
          :key="useCase" 
          class="tag use-case-tag"
        >
          {{ useCase }}
        </span>
      </div>
    </div>
    <!-- Advanced Settings -->
    <div v-if="showAdvanced" class="advanced-settings">
      <div class="setting-group">
        <label class="setting-label">
          Temperature: {{ temperature }}
        </label>
        <input 
          v-model.number="temperature"
          type="range" 
          min="0" 
          max="2" 
          step="0.1"
          class="setting-slider"
          @input="onTemperatureChange"
        >
        <div class="setting-description">
          Lower values = more focused, Higher values = more creative
        </div>
      </div>
      <div class="setting-group">
        <label class="setting-label">Max Tokens (optional)</label>
        <input 
          v-model.number="maxTokens"
          type="number" 
          min="1" 
          :max="(selectedModel && typeof selectedModel === 'object') ? (selectedModel.maxTokens || 4000) : 4000"
          class="setting-input"
          placeholder="Leave empty for default"
          @input="onMaxTokensChange"
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
    
    <!-- Action Slot for context-specific buttons -->
    <div v-if="$slots.actions" class="llm-selector-actions">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useLLMPreferencesStore } from '../stores/llmPreferencesStore';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';
import type { Provider, Model } from '../types/llm';

const llmStore = useLLMPreferencesStore();
const userPreferencesStore = useUserPreferencesStore();

const showAdvanced = ref(false);

// Local reactive state for v-model
const selectedProvider = ref<Provider | ''>('');
const selectedModel = ref<Model | ''>('');
const temperature = ref(0.7);
const maxTokens = ref<number | undefined>(undefined);

// Sovereign mode state
const userSovereignMode = ref(false);
const loadingSovereignUpdate = ref(false);
// Initialize store and sync local state
onMounted(async () => {
  // Initialize user preferences first
  await userPreferencesStore.initializePreferences();
  
  // Initialize sovereign mode
  await llmStore.initializeSovereignMode();
  
  // Initialize LLM store with user preferences
  await llmStore.initialize({
    preferredProvider: userPreferencesStore.preferredProvider,
    preferredModel: userPreferencesStore.preferredModel
  });
  
  // Sync LLM store selection back to user preferences to ensure consistency
  if (llmStore.selectedProvider && llmStore.selectedModel && llmStore.selectedModel.modelName) {
    userPreferencesStore.setLLMPreferences(
      llmStore.selectedProvider.name,
      llmStore.selectedModel.modelName
    );
  }
  
  // Sync with store state
  selectedProvider.value = llmStore.selectedProvider || '';
  selectedModel.value = llmStore.selectedModel || '';
  temperature.value = llmStore.temperature;
  maxTokens.value = llmStore.maxTokens;
  
  // Sync sovereign mode state
  userSovereignMode.value = llmStore.sovereignMode;
});
// Watch store changes and sync to local state
watch(() => llmStore.selectedProvider, (newProvider) => {
  // Find the matching provider object from the available options
  if (newProvider) {
    const matchingProvider = llmStore.filteredProviders.find(p => p.id === newProvider.id);
    selectedProvider.value = matchingProvider || newProvider;
  } else {
    selectedProvider.value = '';
  }
}, { immediate: true });

watch(() => llmStore.selectedModel, (newModel) => {
  // Find the matching model object from the available options
  if (newModel) {
    const matchingModel = llmStore.availableModels.find(m => m.id === newModel.id);
    selectedModel.value = matchingModel || newModel;
  } else {
    selectedModel.value = '';
  }
}, { immediate: true });

// Watch sovereign mode changes and sync local state
watch(() => llmStore.sovereignMode, (newMode) => {
  userSovereignMode.value = newMode;
});

// Watch user preferences changes and sync to LLM store
watch(() => userPreferencesStore.preferredProvider, (newProviderName) => {
  if (newProviderName && newProviderName !== llmStore.selectedProvider?.name) {
    const provider = llmStore.getProviderByName(newProviderName);
    if (provider) {
      llmStore.setProvider(provider);
    }
  }
});
watch(() => userPreferencesStore.preferredModel, (newModelName) => {
  if (newModelName && newModelName !== llmStore.selectedModel?.modelName) {
    const providerName = userPreferencesStore.preferredProvider;
    if (providerName) {
      const model = llmStore.getModelByName(providerName, newModelName);
      if (model) {
        llmStore.setModel(model);
      }
    }
  }
});
// Event handlers
const onProviderChange = () => {
  if (selectedProvider.value && typeof selectedProvider.value === 'object') {
    llmStore.setProvider(selectedProvider.value);
    // Sync to user preferences store
    userPreferencesStore.setPreferredProvider(selectedProvider.value.name);
  }
};
const onModelChange = () => {
  if (selectedModel.value && typeof selectedModel.value === 'object') {
    llmStore.setModel(selectedModel.value);
    // Sync to user preferences store
    userPreferencesStore.setLLMPreferences(
      selectedModel.value.providerName,
      selectedModel.value.modelName
    );
  }
};
const onTemperatureChange = () => {
  llmStore.setTemperature(temperature.value);
};
const onMaxTokensChange = () => {
  llmStore.setMaxTokens(maxTokens.value);
};

// Sovereign mode event handler
const onSovereignModeChange = async () => {
  if (loadingSovereignUpdate.value) return;
  
  loadingSovereignUpdate.value = true;
  try {
    llmStore.setSovereignMode(userSovereignMode.value);
    // No need to re-fetch - filtering is handled reactively by getters
  } catch (error) {
    console.error('Failed to update sovereign mode:', error);
    // Revert the toggle on error
    userSovereignMode.value = !userSovereignMode.value;
  } finally {
    loadingSovereignUpdate.value = false;
  }
};
// Computed properties
// const isLoading = computed(() => 
//   llmStore.loadingProviders || llmStore.loadingModels
// );
// const hasErrors = computed(() => 
//   llmStore.providerError || llmStore.modelError
// );

// Sovereign mode computed properties
const effectiveSovereignModeClass = computed(() => {
  const isActive = llmStore.effectiveSovereignMode;
  return {
    'sovereign-active': isActive,
    'sovereign-inactive': !isActive
  };
});

const effectiveSovereignModeText = computed(() => {
  return llmStore.effectiveSovereignMode ? 'ON' : 'OFF';
});

const sovereignModeDescription = computed(() => {
  if (llmStore.sovereignPolicy?.enforced) {
    return 'Organization policy enforces sovereign mode for all users';
  }
  if (userSovereignMode.value) {
    return 'Only local models (Ollama) will be used for enhanced privacy';
  }
  return 'External AI providers allowed - toggle for local-only models';
});

const policyMessage = computed(() => {
  if (llmStore.sovereignPolicy?.enforced && !userSovereignMode.value) {
    return 'Organization policy requires sovereign mode to be enabled';
  }
  return null;
});

const policyMessageClass = computed(() => {
  if (llmStore.sovereignPolicy?.enforced) {
    return 'policy-enforced';
  }
  return 'policy-info';
});

const policyMessageIcon = computed(() => {
  if (llmStore.sovereignPolicy?.enforced) {
    return '🔒';
  }
  return 'ℹ️';
});

// No models error computed properties
const showNoModelsError = computed(() => {
  // Show error when not loading, no model error, and no available models
  return !llmStore.loadingModels && 
         !llmStore.modelError && 
         llmStore.availableModels.length === 0 &&
         selectedProvider.value; // Only show when a provider is selected
});

const noModelsErrorTitle = computed(() => {
  if (llmStore.effectiveSovereignMode) {
    return 'No Sovereign-Compliant Models Available';
  }
  return 'No Models Available';
});

const noModelsErrorDescription = computed(() => {
  if (llmStore.effectiveSovereignMode) {
    return 'No local models are currently available for the selected provider in sovereign mode.';
  }
  return 'No models are currently available for the selected provider.';
});

const noModelsErrorSuggestion = computed(() => {
  if (llmStore.effectiveSovereignMode) {
    if (!llmStore.sovereignPolicy?.enforced) {
      return 'Try disabling sovereign mode to access external models, or ensure local models are running.';
    }
    return 'Please ensure local models (Ollama) are running and available.';
  }
  return 'Please try selecting a different provider or check your connection.';
});
</script>
<style scoped>
.llm-selector {
  padding: 1rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-color-step-50);
  margin-bottom: 1rem;
}
.selection-group {
  margin-bottom: 1rem;
}
.selection-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--ion-color-dark);
}
.selection-dropdown {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 4px;
  background: white;
  font-size: 0.9rem;
}
.selection-dropdown:disabled {
  background: var(--ion-color-step-100);
  cursor: not-allowed;
}
.error-message {
  color: var(--ion-color-danger);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}
.model-info {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid var(--ion-color-light);
}
.model-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.model-info-header h4 {
  margin: 0;
  color: var(--ion-color-dark);
}
.provider-badge {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}
.model-description {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
.model-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.detail-label {
  font-weight: 500;
  color: var(--ion-color-dark);
}
.detail-value {
  color: var(--ion-color-dark);
}
.feature-tag {
  background: var(--ion-color-success);
  color: var(--ion-color-success-contrast, #000);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-size: 0.7rem;
  margin-left: 0.25rem;
}
.model-tags {
  margin-top: 1rem;
}
.tags-label {
  font-weight: 500;
  color: #555;
  margin-right: 0.5rem;
}
.tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  margin: 0.125rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}
.strength-tag {
  background: #e8f5e8;
  color: #27ae60;
}
.use-case-tag {
  background: #e8f4fd;
  color: #3498db;
}
.model-pricing {
  color: #666;
  font-size: 0.8rem;
}
.advanced-settings {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.setting-group {
  margin-bottom: 1rem;
}
.setting-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #555;
}
.setting-slider {
  width: 100%;
  margin-bottom: 0.25rem;
}
.setting-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.setting-description {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}
.toggle-advanced {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 1rem;
}
.toggle-advanced:hover {
  background: #2980b9;
}

.llm-selector-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--ion-color-light);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Sovereign Mode Styles */
.sovereign-mode-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.sovereign-toggle-group {
  margin-bottom: 0.75rem;
}

.sovereign-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.sovereign-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.sovereign-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.sovereign-text {
  font-size: 1rem;
  color: #333;
}

.sovereign-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sovereign-active {
  background: rgba(var(--ion-color-success-rgb), 0.15);
  color: var(--ion-color-success);
  border: 1px solid rgba(var(--ion-color-success-rgb), 0.35);
}

.sovereign-inactive {
  background: rgba(var(--ion-color-danger-rgb), 0.15);
  color: var(--ion-color-danger);
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.35);
}

.sovereign-description {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  line-height: 1.4;
  margin-left: 1.5rem;
}

.policy-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.policy-enforced {
  background: rgba(var(--ion-color-warning-rgb), 0.2);
  color: var(--ion-color-warning-shade);
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.35);
}

.policy-warning {
  background: rgba(var(--ion-color-danger-rgb), 0.15);
  color: var(--ion-color-danger);
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.35);
}

.policy-info {
  background: rgba(var(--ion-color-secondary-rgb), 0.2);
  color: var(--ion-color-secondary-shade);
  border: 1px solid rgba(var(--ion-color-secondary-rgb), 0.35);
}

.policy-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

/* No Models Error Styles */
.no-models-error {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  margin-top: 0.5rem;
  background: linear-gradient(135deg, rgba(var(--ion-color-danger-rgb), 0.08) 0%, rgba(var(--ion-color-danger-rgb), 0.16) 100%);
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.35);
  border-radius: 8px;
  color: var(--ion-color-danger-shade);
}

.no-models-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.no-models-content {
  flex: 1;
}

.no-models-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
  color: var(--ion-color-danger-shade);
}

.no-models-description {
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 0.5rem;
  color: var(--ion-color-danger);
}

.no-models-suggestion {
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--ion-color-danger);
  font-style: italic;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  border-left: 3px solid rgba(var(--ion-color-danger-rgb), 0.35);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .no-models-error {
    padding: 0.75rem;
    gap: 0.5rem;
  }
  
  .no-models-icon {
    font-size: 1.25rem;
  }
  
  .no-models-title {
    font-size: 0.9rem;
  }
  
  .no-models-description {
    font-size: 0.8rem;
  }
  
  .no-models-suggestion {
    font-size: 0.75rem;
    padding: 0.375rem;
  }
}
</style>
