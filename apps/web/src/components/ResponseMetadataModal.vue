<template>
  <ion-modal :is-open="isOpen" @did-dismiss="handleClose">
    <ion-header>
      <ion-toolbar>
        <ion-title>Response Metadata</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleClose">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="metadata-container">
        <!-- Agent Information Section -->
        <div class="metadata-section" v-if="hasAgentInfo">
          <h3>Agent Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.agentName">
              <span class="label">Agent Name:</span>
              <span class="value">{{ metadata.agentName }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.agentType">
              <span class="label">Agent Type:</span>
              <span class="value">{{ metadata.agentType }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.delegatedTo">
              <span class="label">Delegated To:</span>
              <span class="value">{{ metadata.delegatedTo }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.delegationReason">
              <span class="label">Delegation Reason:</span>
              <span class="value">{{ metadata.delegationReason }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.confidence">
              <span class="label">Confidence:</span>
              <span class="value">{{ (metadata.confidence * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
        <!-- LLM Information Section -->
        <div class="metadata-section" v-if="hasLLMInfo">
          <h3>LLM Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.llmOptions?.provider">
              <span class="label">Provider:</span>
              <span class="value">{{ metadata.llmOptions.provider }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.model">
              <span class="label">Model:</span>
              <span class="value">{{ metadata.llmOptions.model }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.temperature !== undefined">
              <span class="label">Temperature:</span>
              <span class="value">{{ metadata.llmOptions.temperature }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.maxTokens">
              <span class="label">Max Tokens:</span>
              <span class="value">{{ metadata.llmOptions.maxTokens }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.responseTimeMs">
              <span class="label">Response Time:</span>
              <span class="value">{{ metadata.llmOptions.responseTimeMs }}ms</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.operationType">
              <span class="label">Operation Type:</span>
              <span class="value">{{ metadata.llmOptions.operationType }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.llmOptions?.isSystemLLM !== undefined">
              <span class="label">System LLM:</span>
              <span class="value">{{ metadata.llmOptions.isSystemLLM ? 'Yes' : 'No' }}</span>
            </div>
          </div>
        </div>
        <!-- Token Usage Section -->
        <div class="metadata-section" v-if="hasUsageInfo">
          <h3>Token Usage</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.usage?.inputTokens">
              <span class="label">Input Tokens:</span>
              <span class="value">{{ metadata.usage.inputTokens.toLocaleString() }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.usage?.outputTokens">
              <span class="label">Output Tokens:</span>
              <span class="value">{{ metadata.usage.outputTokens.toLocaleString() }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.usage?.inputTokens && metadata.usage?.outputTokens">
              <span class="label">Total Tokens:</span>
              <span class="value">{{ (metadata.usage.inputTokens + metadata.usage.outputTokens).toLocaleString() }}</span>
            </div>
          </div>
        </div>
        <!-- Cost Information Section -->
        <div class="metadata-section" v-if="hasCostInfo">
          <h3>Cost Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.costCalculation?.inputCost">
              <span class="label">Input Cost:</span>
              <span class="value">${{ formatCost(metadata.costCalculation.inputCost) }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.costCalculation?.outputCost">
              <span class="label">Output Cost:</span>
              <span class="value">${{ formatCost(metadata.costCalculation.outputCost) }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.costCalculation?.totalCost">
              <span class="label">Total Cost:</span>
              <span class="value total-cost">${{ formatCost(metadata.costCalculation.totalCost) }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.costCalculation?.currency">
              <span class="label">Currency:</span>
              <span class="value">{{ metadata.costCalculation.currency }}</span>
            </div>
          </div>
        </div>
        <!-- User Preferences Section -->
        <div class="metadata-section" v-if="hasUserPreferences">
          <h3>User LLM Preferences</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.userLLMPreferences?.providerName">
              <span class="label">Requested Provider:</span>
              <span class="value">{{ metadata.userLLMPreferences.providerName }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.userLLMPreferences?.modelName">
              <span class="label">Requested Model:</span>
              <span class="value">{{ metadata.userLLMPreferences.modelName }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.userLLMPreferences?.temperature !== undefined">
              <span class="label">Requested Temperature:</span>
              <span class="value">{{ metadata.userLLMPreferences.temperature }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.userLLMPreferences?.maxTokens">
              <span class="label">Requested Max Tokens:</span>
              <span class="value">{{ metadata.userLLMPreferences.maxTokens }}</span>
            </div>
          </div>
        </div>
        <!-- Processing Information Section -->
        <div class="metadata-section" v-if="hasProcessingInfo">
          <h3>Processing Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.processedAt">
              <span class="label">Processed At:</span>
              <span class="value">{{ formatTimestamp(metadata.processedAt) }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.processingAgentName">
              <span class="label">Processing Agent:</span>
              <span class="value">{{ metadata.processingAgentName }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.messageType">
              <span class="label">Message Type:</span>
              <span class="value">{{ metadata.messageType }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.isDelegated !== undefined">
              <span class="label">Is Delegated:</span>
              <span class="value">{{ metadata.isDelegated ? 'Yes' : 'No' }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.isTemplateResponse !== undefined">
              <span class="label">Template Response:</span>
              <span class="value">{{ metadata.isTemplateResponse ? 'Yes' : 'No' }}</span>
            </div>
          </div>
        </div>
        <!-- Context Information Section -->
        <div class="metadata-section" v-if="hasContextInfo">
          <h3>Context Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="metadata.stickyContext">
              <span class="label">Sticky Context:</span>
              <span class="value">{{ metadata.stickyContext }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.continuityReason">
              <span class="label">Continuity Reason:</span>
              <span class="value">{{ metadata.continuityReason }}</span>
            </div>
            <div class="metadata-item" v-if="metadata.agentContext">
              <span class="label">Agent Context:</span>
              <span class="value">{{ metadata.agentContext }}</span>
            </div>
          </div>
        </div>
        <!-- Raw Metadata Section (for debugging) -->
        <div class="metadata-section">
          <h3>Raw Metadata (Debug)</h3>
          <div class="raw-metadata">
            <pre>{{ JSON.stringify(metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>
<script setup lang="ts">
import { computed } from 'vue';
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
import { closeOutline } from 'ionicons/icons';
interface Props {
  isOpen: boolean;
  metadata: Record<string, unknown>;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();
const handleClose = () => {
  emit('close');
};
const hasAgentInfo = computed(() => {
  return props.metadata?.agentName || props.metadata?.agentType || props.metadata?.delegatedTo || props.metadata?.delegationReason || props.metadata?.confidence;
});
const hasLLMInfo = computed(() => {
  return props.metadata?.llmOptions;
});
const hasUsageInfo = computed(() => {
  return props.metadata?.usage;
});
const hasCostInfo = computed(() => {
  return props.metadata?.costCalculation;
});
const hasUserPreferences = computed(() => {
  return props.metadata?.userLLMPreferences;
});
const hasProcessingInfo = computed(() => {
  return props.metadata?.processedAt || props.metadata?.processingAgentName || props.metadata?.messageType || props.metadata?.isDelegated !== undefined || props.metadata?.isTemplateResponse !== undefined;
});
const hasContextInfo = computed(() => {
  return props.metadata?.stickyContext || props.metadata?.continuityReason || props.metadata?.agentContext;
});
const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return cost.toFixed(6);
  }
  return cost.toFixed(4);
};
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};
</script>
<style scoped>
.metadata-container {
  max-width: 800px;
  margin: 0 auto;
}
.metadata-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
}
.metadata-section h3 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
  font-size: 1.1rem;
  font-weight: 600;
}
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}
.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--ion-color-light-tint);
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}
.label {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-right: 8px;
}
.value {
  font-family: 'Courier New', monospace;
  color: var(--ion-color-medium-shade);
  text-align: right;
  word-break: break-word;
}
.total-cost {
  font-weight: 700;
  color: var(--ion-color-success);
}
.raw-metadata {
  background: var(--ion-color-dark);
  color: var(--ion-color-light);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}
.raw-metadata pre {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .metadata-section {
    background: var(--ion-color-dark-shade);
    border-left-color: var(--ion-color-primary-tint);
  }
  .metadata-item {
    background: var(--ion-color-dark-tint);
    border-color: var(--ion-color-dark);
  }
  .raw-metadata {
    background: var(--ion-color-step-800);
    color: var(--ion-color-light);
  }
}
/* Mobile responsive */
@media (max-width: 768px) {
  .metadata-grid {
    grid-template-columns: 1fr;
  }
  .metadata-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .value {
    text-align: left;
  }
}
</style>