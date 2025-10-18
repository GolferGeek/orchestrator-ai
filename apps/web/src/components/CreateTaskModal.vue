<template>
  <ion-modal :is-open="isOpen" @did-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>
          Create New Task
          {{ conversation ? `- ${formatAgentName(conversation.agentName)}` : '' }}
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <form @submit.prevent="createTask" class="create-task-form">
        <div class="form-content">
          <!-- Method Selection -->
          <ion-item>
            <ion-select
              v-model="taskData.method"
              label="Method"
              label-placement="stacked"
              placeholder="Select method"
              :disabled="creating"
            >
              <ion-select-option value="process">Process</ion-select-option>
              <ion-select-option value="analyze">Analyze</ion-select-option>
              <ion-select-option value="generate">Generate</ion-select-option>
              <ion-select-option value="summarize">Summarize</ion-select-option>
              <ion-select-option value="translate">Translate</ion-select-option>
              <ion-select-option value="custom">Custom</ion-select-option>
            </ion-select>
          </ion-item>
          <!-- Custom Method Input -->
          <ion-item v-if="taskData.method === 'custom'">
            <ion-input
              v-model="customMethod"
              label="Custom Method"
              label-placement="stacked"
              placeholder="Enter method name"
              :disabled="creating"
            />
          </ion-item>
          <!-- Prompt Input -->
          <ion-item>
            <ion-textarea
              v-model="taskData.prompt"
              label="Prompt"
              label-placement="stacked"
              placeholder="Describe what you want the agent to do..."
              :rows="6"
              :disabled="creating"
              required
            />
          </ion-item>
          <!-- Advanced Options -->
          <ion-accordion-group>
            <ion-accordion value="advanced">
              <ion-item slot="header">
                <ion-label>Advanced Options</ion-label>
              </ion-item>
              <div slot="content" class="advanced-options">
                <!-- LLM Selection -->
                <div class="llm-section">
                  <h4>LLM Configuration</h4>
                  <LLMSelector :disabled="creating" />
                </div>
                <!-- CIDAFM Controls -->
                <div class="cidafm-section">
                  <h4>Behavior Modification (CIDAFM)</h4>
                  <CIDAFMControls :disabled="creating" />
                </div>
                <!-- Timeout -->
                <ion-item>
                  <ion-input
                    v-model.number="taskData.timeoutSeconds"
                    label="Timeout (seconds)"
                    label-placement="stacked"
                    type="number"
                    placeholder="300"
                    :min="10"
                    :max="3600"
                    :disabled="creating"
                  />
                </ion-item>
                <!-- Parameters -->
                <ion-item>
                  <ion-textarea
                    v-model="parametersJson"
                    label="Parameters (JSON)"
                    label-placement="stacked"
                    placeholder="{&quot;key&quot;: &quot;value&quot;}"
                    :rows="4"
                    :disabled="creating"
                  />
                </ion-item>
                <!-- Parameter Helper -->
                <div class="parameter-helper">
                  <h4>Common Parameters:</h4>
                  <ion-chip
                    v-for="preset in parameterPresets"
                    :key="preset.name"
                    @click="applyParameterPreset(preset)"
                    :disabled="creating"
                  >
                    {{ preset.name }}
                  </ion-chip>
                </div>
              </div>
            </ion-accordion>
          </ion-accordion-group>
          <!-- Error Display -->
          <ion-item v-if="error" lines="none" class="error-item">
            <ion-icon :icon="alertCircleOutline" color="danger" slot="start" />
            <ion-label color="danger">
              {{ error }}
            </ion-label>
          </ion-item>
        </div>
        <!-- Actions -->
        <div class="form-actions">
          <ion-button
            type="button"
            fill="outline"
            @click="$emit('close')"
            :disabled="creating"
          >
            Cancel
          </ion-button>
          <ion-button
            type="submit"
            :disabled="!isFormValid || creating"
          >
            <ion-spinner v-if="creating" slot="start" />
            <span v-if="!creating">Create Task</span>
            <span v-else>Creating...</span>
          </ion-button>
        </div>
      </form>
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
  IonContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonAccordion,
  IonAccordionGroup,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonChip,
} from '@ionic/vue';
import { closeOutline, alertCircleOutline } from 'ionicons/icons';
import { tasksService } from '@/services/tasksService';
import LLMSelector from './LLMSelector.vue';
import CIDAFMControls from './CIDAFMControls.vue';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useValidation, ValidationRules } from '@/composables/useValidation';
interface Conversation {
  id: string;
  agentName: string;
  agentType: string;
}
interface TaskData {
  method: string;
  prompt: string;
  params?: Record<string, unknown>;
  timeoutSeconds?: number;
}
interface ParameterPreset {
  name: string;
  params: Record<string, unknown>;
}
// Props
const props = defineProps<{
  isOpen: boolean;
  conversation: Conversation | null;
}>();
// Events
const emit = defineEmits<{
  close: [];
  'task-created': [taskId: string];
}>();
// Reactive state
const creating = ref(false);
const error = ref<string | null>(null);
const customMethod = ref('');
const parametersJson = ref('');
// Store
const llmStore = useLLMPreferencesStore();
const validation = useValidation();

const taskData = ref<TaskData>({
  method: 'process',
  prompt: '',
  timeoutSeconds: 300,
});

// Setup validation rules
onMounted(() => {
  validation.addRule('prompt', ValidationRules.required('Task prompt is required'));
  validation.addRule('prompt', ValidationRules.minLength(5, 'Prompt must be at least 5 characters'));
  validation.addRule('prompt', ValidationRules.maxLength(2000, 'Prompt must not exceed 2000 characters'));
  validation.addRule('prompt', ValidationRules.security('Potentially unsafe content detected in prompt'));
  validation.addRule('prompt', ValidationRules.sanitizeApiInput());
  
  validation.addRule('method', ValidationRules.required('Method is required'));
  validation.addRule('method', ValidationRules.sanitize({ profile: 'strict' }));
});
// Parameter presets
const parameterPresets: ParameterPreset[] = [
  {
    name: 'Default',
    params: {},
  },
  {
    name: 'Verbose',
    params: { verbose: true, includeMetadata: true },
  },
  {
    name: 'Quick',
    params: { quick: true, maxTokens: 500 },
  },
  {
    name: 'Detailed',
    params: { detailed: true, maxTokens: 2000, includeExamples: true },
  },
  {
    name: 'Creative',
    params: { temperature: 0.8, creativity: 'high' },
  },
  {
    name: 'Analytical',
    params: { temperature: 0.2, analytical: true, structured: true },
  },
];
// Computed
const isFormValid = computed(() => {
  const method = taskData.value.method === 'custom' ? customMethod.value : taskData.value.method;
  return method && taskData.value.prompt.trim().length > 0;
});
// Methods
const createTask = async () => {
  if (!props.conversation || !isFormValid.value) return;
  
  // Validate inputs before creating task
  const promptValidation = await validation.validate('prompt', taskData.value.prompt);
  const methodValidation = await validation.validate('method', taskData.value.method);
  
  if (!promptValidation.isValid || !methodValidation.isValid) {
    error.value = 'Please fix validation errors before submitting';
    return;
  }
  
  creating.value = true;
  error.value = null;
  try {
    // Parse parameters JSON
    let params: Record<string, unknown> | undefined;
    if (parametersJson.value.trim()) {
      try {
        params = JSON.parse(parametersJson.value);
      } catch {
        throw new Error('Invalid JSON in parameters');
      }
    }
    // Prepare task data
    const method = taskData.value.method === 'custom' ? customMethod.value : taskData.value.method;
    const taskRequest = {
      method,
      prompt: taskData.value.prompt.trim(),
      params,
      conversationId: props.conversation.id,
      timeoutSeconds: taskData.value.timeoutSeconds,
      llmSelection: llmStore.currentLLMSelection,
    };
    // Create task via direct agent call
    const result = await tasksService.createAgentTask(
      props.conversation.agentType,
      props.conversation.agentName,
      taskRequest
    );
    // Emit success
    emit('task-created', result.taskId);
    // Reset form
    resetForm();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create task';
  } finally {
    creating.value = false;
  }
};
const applyParameterPreset = (preset: ParameterPreset) => {
  parametersJson.value = JSON.stringify(preset.params, null, 2);
};
const resetForm = () => {
  taskData.value = {
    method: 'process',
    prompt: '',
    timeoutSeconds: 300,
  };
  customMethod.value = '';
  parametersJson.value = '';
  error.value = null;
};
const formatAgentName = (name: string) => {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
// Watch for modal open/close
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});
</script>
<style scoped>
.create-task-form {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.form-content {
  flex: 1;
  padding: 16px;
}
.advanced-options {
  padding: 16px;
}
.parameter-helper {
  margin-top: 16px;
}
.parameter-helper h4,
.llm-section h4,
.cidafm-section h4 {
  margin: 0 0 8px 0;
  color: var(--ion-color-step-600);
  font-size: 0.9em;
}
.llm-section,
.cidafm-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--ion-color-light-shade);
  border-radius: 8px;
  border: 1px solid var(--ion-color-step-150);
}
.parameter-helper ion-chip {
  margin: 2px 4px 2px 0;
  cursor: pointer;
}
.error-item {
  --background: var(--ion-color-danger-tint);
  --border-color: var(--ion-color-danger);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin: 12px 0;
}
.form-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--ion-color-step-150);
  background: var(--ion-color-step-50);
}
.form-actions ion-button {
  flex: 1;
}
</style>