<template>
  <div class="llm-selector">
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
          v-for="provider in llmStore.providers" 
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
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useLLMStore } from '../stores/llmStore';
import type { Provider, Model } from '../types/llm';
const llmStore = useLLMStore();
const showAdvanced = ref(false);
// Local reactive state for v-model
const selectedProvider = ref<Provider | ''>('');
const selectedModel = ref<Model | ''>('');
const temperature = ref(0.7);
const maxTokens = ref<number | undefined>(undefined);
// Initialize store and sync local state
onMounted(async () => {
  await llmStore.initialize();
  // Sync with store state
  selectedProvider.value = llmStore.selectedProvider || '';
  selectedModel.value = llmStore.selectedModel || '';
  temperature.value = llmStore.temperature;
  maxTokens.value = llmStore.maxTokens;
  // Load saved preferences
  llmStore.loadFromLocalStorage();
});
// Watch store changes and sync to local state
watch(() => llmStore.selectedProvider, (newProvider) => {
  selectedProvider.value = newProvider || '';
});
watch(() => llmStore.selectedModel, (newModel) => {
  selectedModel.value = newModel || '';
});
// Event handlers
const onProviderChange = () => {
  if (selectedProvider.value && typeof selectedProvider.value === 'object') {
    llmStore.setProvider(selectedProvider.value);
    llmStore.saveToLocalStorage();
  }
};
const onModelChange = () => {
  if (selectedModel.value && typeof selectedModel.value === 'object') {
    llmStore.setModel(selectedModel.value);
    llmStore.saveToLocalStorage();
  }
};
const onTemperatureChange = () => {
  llmStore.setTemperature(temperature.value);
  llmStore.saveToLocalStorage();
};
const onMaxTokensChange = () => {
  llmStore.setMaxTokens(maxTokens.value);
  llmStore.saveToLocalStorage();
};
// Computed properties
const isLoading = computed(() => 
  llmStore.loadingProviders || llmStore.loadingModels
);
const hasErrors = computed(() => 
  llmStore.providerError || llmStore.modelError
);
</script>
<style scoped>
.llm-selector {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  margin-bottom: 1rem;
}
.selection-group {
  margin-bottom: 1rem;
}
.selection-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}
.selection-dropdown {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  font-size: 0.9rem;
}
.selection-dropdown:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}
.error-message {
  color: #e74c3c;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}
.model-info {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.model-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.model-info-header h4 {
  margin: 0;
  color: #2c3e50;
}
.provider-badge {
  background: #3498db;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}
.model-description {
  color: #666;
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
  color: #555;
}
.detail-value {
  color: #333;
}
.feature-tag {
  background: #27ae60;
  color: white;
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
</style>