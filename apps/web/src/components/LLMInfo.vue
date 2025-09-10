<template>
  <div class="llm-info" v-if="showLLMInfo">
    <div class="llm-header" @click="toggleExpanded">
      <div class="llm-summary">
        <div class="llm-icon">
          <ion-icon :icon="hardwareChipOutline" color="primary"></ion-icon>
        </div>
        <div class="llm-details">
          <span class="llm-model">{{ llmUsed?.modelName || 'Default Model' }}</span>
          <span class="llm-provider">{{ llmUsed?.providerName || 'Unknown Provider' }}</span>
        </div>
      </div>
      <div class="llm-actions">
        <div class="llm-cost" v-if="costCalculation?.totalCost">
          <span class="cost-value">${{ formatCost(costCalculation.totalCost) }}</span>
        </div>
        <ion-button fill="clear" size="small" v-if="llmUsed">
          <ion-icon :icon="isExpanded ? chevronUpOutline : chevronDownOutline" slot="icon-only" size="small"></ion-icon>
        </ion-button>
      </div>
    </div>
    <!-- Expanded Details -->
    <div class="llm-expanded" v-if="isExpanded && llmUsed">
      <div class="llm-detail-grid">
        <div class="detail-item">
          <span class="detail-label">Provider:</span>
          <span class="detail-value">{{ llmUsed.providerName }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Model:</span>
          <span class="detail-value">{{ llmUsed.modelName }}</span>
        </div>
        <div class="detail-item" v-if="llmUsed.temperature !== undefined">
          <span class="detail-label">Temperature:</span>
          <span class="detail-value">{{ llmUsed.temperature }}</span>
        </div>
        <div class="detail-item" v-if="llmUsed.responseTimeMs">
          <span class="detail-label">Response Time:</span>
          <span class="detail-value">{{ llmUsed.responseTimeMs }}ms</span>
        </div>
      </div>
      <!-- Token Usage -->
      <div class="usage-section" v-if="usage">
        <h5>Token Usage</h5>
        <div class="usage-grid">
          <div class="usage-item">
            <span class="usage-label">Input:</span>
            <span class="usage-value">{{ formatNumber(usage.inputTokens) }}</span>
          </div>
          <div class="usage-item">
            <span class="usage-label">Output:</span>
            <span class="usage-value">{{ formatNumber(usage.outputTokens) }}</span>
          </div>
          <div class="usage-item">
            <span class="usage-label">Total:</span>
            <span class="usage-value">{{ formatNumber(usage.inputTokens + usage.outputTokens) }}</span>
          </div>
        </div>
      </div>
      <!-- Cost Breakdown -->
      <div class="cost-section" v-if="costCalculation">
        <h5>Cost Breakdown</h5>
        <div class="cost-grid">
          <div class="cost-item">
            <span class="cost-label">Input Cost:</span>
            <span class="cost-value">${{ formatCost(costCalculation.inputCost) }}</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Output Cost:</span>
            <span class="cost-value">${{ formatCost(costCalculation.outputCost) }}</span>
          </div>
          <div class="cost-item total">
            <span class="cost-label">Total Cost:</span>
            <span class="cost-value">${{ formatCost(costCalculation.totalCost) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import {
  chevronUpOutline,
  chevronDownOutline,
  hardwareChipOutline
} from 'ionicons/icons';
interface Props {
  llmUsed?: {
    providerName?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    responseTimeMs?: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    responseTimeMs: number;
  };
  costCalculation?: {
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
}
const props = defineProps<Props>();
const isExpanded = ref(false);
const showLLMInfo = computed(() => {
  return props.llmUsed || props.usage || props.costCalculation;
});
const toggleExpanded = () => {
  if (props.llmUsed) {
    isExpanded.value = !isExpanded.value;
  }
};
const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return cost.toFixed(6);
  }
  return cost.toFixed(4);
};
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};
</script>
<style scoped>
.llm-info {
  margin: 8px 0;
  font-size: 0.85rem;
}
.llm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.llm-header:hover {
  background: var(--ion-color-light-shade);
}
.llm-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}
.llm-icon {
  display: flex;
  align-items: center;
}
.llm-details {
  display: flex;
  flex-direction: column;
}
.llm-model {
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}
.llm-provider {
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}
.llm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.llm-cost {
  font-size: 0.8rem;
  color: var(--ion-color-medium-shade);
}
.cost-value {
  font-weight: 500;
}
.llm-expanded {
  margin-top: 8px;
  padding: 12px;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
  border-left: 3px solid var(--ion-color-primary);
}
.llm-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}
.detail-label {
  color: var(--ion-color-medium-shade);
  font-weight: 500;
}
.detail-value {
  color: var(--ion-color-dark);
  font-weight: 600;
}
.usage-section, .cost-section {
  margin-top: 16px;
}
.usage-section h5, .cost-section h5 {
  margin: 0 0 8px 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-medium-shade);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.usage-grid, .cost-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.usage-item, .cost-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: var(--ion-color-light);
  border-radius: 4px;
}
.cost-item.total {
  grid-column: span 3;
  background: var(--ion-color-primary-tint);
  border: 1px solid var(--ion-color-primary);
}
.usage-label, .cost-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  font-weight: 500;
}
.usage-value, .cost-value {
  font-size: 0.85rem;
  color: var(--ion-color-dark);
  font-weight: 600;
}
.cost-item.total .cost-value {
  color: var(--ion-color-primary-shade);
  font-size: 0.9rem;
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .llm-header {
    background: var(--ion-color-dark-shade);
  }
  .llm-header:hover {
    background: var(--ion-color-dark-tint);
  }
  .llm-expanded {
    background: var(--ion-color-dark-tint);
  }
  .usage-item, .cost-item {
    background: var(--ion-color-dark-shade);
  }
  .cost-item.total {
    background: var(--ion-color-primary-tint);
  }
}
/* Mobile responsive */
@media (max-width: 768px) {
  .llm-detail-grid {
    grid-template-columns: 1fr;
  }
  .usage-grid, .cost-grid {
    grid-template-columns: 1fr;
  }
  .cost-item.total {
    grid-column: span 1;
  }
}
</style>