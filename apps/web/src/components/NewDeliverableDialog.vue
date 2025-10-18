<template>
  <ion-modal :is-open="isOpen" @will-dismiss="$emit('dismiss')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Create New Deliverable</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('dismiss')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="new-deliverable-content">
      <div class="creation-form">
        <!-- Step 1: Agent Selection -->
        <div class="form-section">
          <h3>1. Select an Agent</h3>
          <p class="section-description">Choose which agent will create your deliverable</p>
          <div class="agent-selection">
            <ion-list v-if="availableAgents.length > 0">
              <ion-radio-group v-model="selectedAgent">
                <ion-item 
                  v-for="agent in availableAgents" 
                  :key="`${agent.type}-${agent.name}`"
                  button
                  @click="selectedAgent = agent"
                  class="agent-option"
                  :class="{ selected: selectedAgent?.name === agent.name }"
                >
                  <ion-radio 
                    slot="start" 
                    :value="agent"
                  />
                  <ion-label>
                    <h3>{{ cleanAgentName(agent.name) }}</h3>
                    <p>{{ formatAgentDescription(agent.description) }}</p>
                    <ion-chip color="primary" outline size="small">
                      {{ agent.type }}
                    </ion-chip>
                  </ion-label>
                </ion-item>
              </ion-radio-group>
            </ion-list>
            <div v-else class="loading-agents">
              <ion-spinner />
              <p>Loading available agents...</p>
            </div>
          </div>
        </div>
        <!-- Step 2: Initial Prompt -->
        <div class="form-section" v-if="selectedAgent">
          <h3>2. Describe What You Want</h3>
          <p class="section-description">
            Tell {{ cleanAgentName(selectedAgent.name) }} what deliverable you'd like to create
          </p>
          <ion-textarea
            v-model="initialPrompt"
            placeholder="e.g., 'Write a blog post about AI trends in 2024', 'Create a market analysis for our product', 'Draft a project proposal for the new feature'..."
            :rows="4"
            class="prompt-input"
          />
        </div>
        <!-- Step 3: Deliverable Options (Optional) -->
        <div class="form-section" v-if="selectedAgent && initialPrompt.trim()">
          <h3>3. Options (Optional)</h3>
          <ion-item>
            <ion-label>Deliverable Type</ion-label>
            <ion-select v-model="deliverableType" placeholder="Auto-detect">
              <ion-select-option value="document">Document</ion-select-option>
              <ion-select-option value="analysis">Analysis</ion-select-option>
              <ion-select-option value="report">Report</ion-select-option>
              <ion-select-option value="plan">Plan</ion-select-option>
              <ion-select-option value="requirements">Requirements</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-label>Format</ion-label>
            <ion-select v-model="deliverableFormat" placeholder="Auto-detect">
              <ion-select-option value="markdown">Markdown</ion-select-option>
              <ion-select-option value="text">Plain Text</ion-select-option>
              <ion-select-option value="html">HTML</ion-select-option>
              <ion-select-option value="json">JSON</ion-select-option>
            </ion-select>
          </ion-item>
        </div>
        <!-- Preview -->
        <div class="form-section preview-section" v-if="selectedAgent && initialPrompt.trim()">
          <h4>Preview</h4>
          <div class="creation-preview">
            <div class="preview-item">
              <strong>Agent:</strong> {{ cleanAgentName(selectedAgent.name) }}
            </div>
            <div class="preview-item">
              <strong>Request:</strong> {{ initialPrompt }}
            </div>
            <div class="preview-item" v-if="deliverableType">
              <strong>Type:</strong> {{ deliverableType }}
            </div>
            <div class="preview-item" v-if="deliverableFormat">
              <strong>Format:</strong> {{ deliverableFormat }}
            </div>
          </div>
        </div>
        <!-- Action Buttons -->
        <div class="form-actions">
          <ion-button
            @click="$emit('dismiss')"
            fill="outline"
            color="medium"
          >
            Cancel
          </ion-button>
          <ion-button
            @click="createDeliverable"
            :disabled="!canCreate"
            color="primary"
          >
            <ion-icon :icon="addOutline" slot="start" />
            Create Deliverable
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonChip,
  IonSpinner,
} from '@ionic/vue';
import {
  closeOutline,
  addOutline,
} from 'ionicons/icons';
import { useAgentsStore } from '@/stores/agentsStore';
import { agentsService } from '@/services/agentsService';
import { useAuthStore } from '@/stores/authStore';
// import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { /* migrated */ } from '@/stores/agentChatStore';
import { useContextStore } from '@/stores/contextStore';
import { formatAgentDescription } from '@/utils/caseConverter';
// Props
interface Props {
  isOpen: boolean;
}
const props = defineProps<Props>();
// Emits
const emit = defineEmits<{
  dismiss: [];
  created: [deliverableId: string];
}>();
// Stores
const agentsStore = useAgentsStore();
// const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const contextStore = useContextStore();
// Reactive state
const selectedAgent = ref<Record<string, unknown> | null>(null);
const initialPrompt = ref('');
const deliverableType = ref('');
const deliverableFormat = ref('');
// Computed properties
const availableAgents = computed(() => {
  // Get agents from the store, excluding orchestrator agents for deliverable creation
  if (!agentsStore.agents || !Array.isArray(agentsStore.agents)) {
    return [];
  }
  return agentsStore.agents.filter(agent => 
    agent.type !== 'orchestrator' && 
    agent.name && 
    agent.description
  );
});
const canCreate = computed(() => 
  selectedAgent.value && initialPrompt.value.trim().length > 0
);
// Methods
const cleanAgentName = (name: string): string => {
  if (!name) return '';
  let cleanName = name.trim();
  cleanName = cleanName.replace(/^Agent Name:\s*/i, '');
  cleanName = cleanName.replace(/\s+Agent$/i, '');
  cleanName = cleanName.replace(/^Agent\s+/i, '');
  return cleanName || name;
};
const createDeliverable = async () => {
  if (!canCreate.value) return;
  try {
    // Create metadata for new deliverable creation
    const metadata = contextStore.createNewDeliverableMetadata(
      selectedAgent.value.type,
      selectedAgent.value.name
    );
    // Add optional deliverable options to metadata
    if (deliverableType.value) {
      metadata.deliverableType = deliverableType.value;
    }
    if (deliverableFormat.value) {
      metadata.deliverableFormat = deliverableFormat.value;
    }
    // Send the creation request through the agent chat store
    await chatUiStore.sendMessageWithContext(
      initialPrompt.value.trim(),
      metadata
    );
    // Reset form
    selectedAgent.value = null;
    initialPrompt.value = '';
    deliverableType.value = '';
    deliverableFormat.value = '';
    // Emit success and close
    emit('created', 'pending'); // Will be updated when the task completes
    emit('dismiss');
  } catch {

    // TODO: Show error toast or notification
  }
};
// Lifecycle
onMounted(async () => {
  // Load agents if not already loaded
  try {
    if (!agentsStore.availableAgents || agentsStore.availableAgents.length === 0) {
      const authStore = useAuthStore();
      const namespace = authStore.currentNamespace;

      if (namespace) {
        const agents = await agentsService.getAvailableAgents();
        const filteredAgents = agents.filter((agent) => {
          if (!agent || typeof agent !== 'object') return false;
          if (!('namespace' in agent) || !agent.namespace) return true;
          return agent.namespace === namespace || agent.namespace === 'global';
        });
        agentsStore.setAvailableAgents(filteredAgents);
      }
    }
  } catch {
    console.error('Failed to load agents');
  }
});
// Watch for dialog open/close to reset form
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    // Reset form when dialog closes
    selectedAgent.value = null;
    initialPrompt.value = '';
    deliverableType.value = '';
    deliverableFormat.value = '';
  }
});
</script>
<style scoped>
.new-deliverable-content {
  padding: 16px;
}
.creation-form {
  max-width: 600px;
  margin: 0 auto;
}
.form-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}
.form-section:last-of-type {
  border-bottom: none;
}
.form-section h3 {
  margin: 0 0 8px 0;
  color: var(--ion-color-primary);
  font-size: 18px;
}
.form-section h4 {
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
  font-size: 16px;
}
.section-description {
  margin: 0 0 16px 0;
  color: var(--ion-color-medium);
  font-size: 14px;
}
.agent-selection {
  margin-bottom: 16px;
}
.agent-option {
  margin-bottom: 8px;
  border-radius: 8px;
  --background: var(--ion-color-light);
}
.agent-option.selected {
  --background: var(--ion-color-primary-tint);
}
.agent-option:hover {
  --background: var(--ion-color-light-shade);
}
.loading-agents {
  text-align: center;
  padding: 32px;
  color: var(--ion-color-medium);
}
.prompt-input {
  margin-bottom: 16px;
}
.preview-section {
  background: var(--ion-color-light);
  padding: 16px;
  border-radius: 8px;
}
.creation-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-item {
  font-size: 14px;
}
.preview-item strong {
  color: var(--ion-color-dark);
  margin-right: 8px;
}
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light-shade);
}
/* Responsive design */
@media (max-width: 768px) {
  .form-actions {
    flex-direction: column-reverse;
  }
  .creation-form {
    max-width: none;
  }
}
</style>
