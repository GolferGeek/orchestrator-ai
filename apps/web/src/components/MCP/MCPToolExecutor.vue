<template>
  <div class="tool-executor">
    <div v-if="mcp && tool" class="executor-content">
      <!-- Tool Information -->
      <div class="tool-info">
        <h3 class="tool-title">{{ tool.name }}</h3>
        <p class="tool-description">{{ tool.description }}</p>
        <div class="mcp-info">
          <ion-badge :color="getTypeColor(mcp.type)" fill="outline">
            {{ mcp.name }}
          </ion-badge>
        </div>
      </div>

      <!-- Parameter Form -->
      <div class="parameters-section">
        <h4 class="section-title">Parameters</h4>
        <div v-if="hasParameters" class="parameters-form">
          <div 
            v-for="(param, key) in tool.parameters.properties" 
            :key="String(key)"
            class="parameter-item"
          >
            <label class="parameter-label">
              {{ formatParameterName(String(key)) }}
              <span v-if="isRequired(String(key))" class="required">*</span>
            </label>
            <div class="parameter-input">
              <ion-textarea
                v-if="param.type === 'string' && (param.description?.includes('SQL') || param.description?.includes('query'))"
                v-model="parameters[String(key)]"
                :placeholder="param.description || `Enter ${String(key)}`"
                :rows="4"
                fill="outline"
              ></ion-textarea>
              <ion-input
                v-else-if="param.type === 'string'"
                v-model="parameters[String(key)]"
                :placeholder="param.description || `Enter ${String(key)}`"
                fill="outline"
              ></ion-input>
              <ion-input
                v-else-if="param.type === 'number' || param.type === 'integer'"
                v-model.number="parameters[String(key)]"
                type="number"
                :placeholder="param.description || `Enter ${String(key)}`"
                fill="outline"
              ></ion-input>
              <ion-toggle
                v-else-if="param.type === 'boolean'"
                v-model="parameters[String(key)]"
              ></ion-toggle>
              <ion-select
                v-else-if="param.enum"
                v-model="parameters[String(key)]"
                :placeholder="`Select ${String(key)}`"
                fill="outline"
              >
                <ion-select-option 
                  v-for="option in param.enum" 
                  :key="option" 
                  :value="option"
                >
                  {{ option }}
                </ion-select-option>
              </ion-select>
              <ion-input
                v-else
                v-model="parameters[String(key)]"
                :placeholder="param.description || `Enter ${String(key)}`"
                fill="outline"
              ></ion-input>
            </div>
            <div v-if="param.description" class="parameter-description">
              {{ param.description }}
            </div>
          </div>
        </div>
        <div v-else class="no-parameters">
          <p>This tool requires no parameters.</p>
        </div>
      </div>

      <!-- Examples -->
      <div v-if="tool.examples && tool.examples.length > 0" class="examples-section">
        <h4 class="section-title">Examples</h4>
        <div class="examples-list">
          <div 
            v-for="(example, index) in tool.examples" 
            :key="index"
            class="example-item"
            @click="loadExample(example)"
          >
            <ion-icon :icon="bulbOutline" class="example-icon"></ion-icon>
            <span class="example-text">{{ example }}</span>
          </div>
        </div>
      </div>

      <!-- Execution Result -->
      <div v-if="executionResult" class="result-section">
        <h4 class="section-title">
          <ion-icon 
            :icon="executionResult.success ? checkmarkCircleOutline : closeCircleOutline" 
            :color="executionResult.success ? 'success' : 'danger'"
            class="result-icon"
          ></ion-icon>
          Execution Result
        </h4>
        <div class="result-content" :class="{ 'error': !executionResult.success }">
          <div v-if="executionResult.success" class="success-result">
            <div class="execution-meta">
              <span class="execution-time">{{ executionResult.executionTime }}ms</span>
              <span class="execution-id">ID: {{ executionResult.executionId }}</span>
            </div>
            <pre class="result-data">{{ formatResultData(executionResult.data) }}</pre>
          </div>
          <div v-else class="error-result">
            <div class="error-message">{{ executionResult.error }}</div>
            <div class="execution-meta">
              <span class="execution-time">{{ executionResult.executionTime }}ms</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-section">
        <ion-button 
          @click="executeTool" 
          :disabled="isExecuting || !isValid"
          color="primary"
        >
          <ion-icon v-if="isExecuting" :icon="hourglassOutline" slot="start"></ion-icon>
          <ion-icon v-else :icon="playOutline" slot="start"></ion-icon>
          {{ isExecuting ? 'Executing...' : 'Execute Tool' }}
        </ion-button>
        <ion-button 
          @click="clearResult" 
          v-if="executionResult"
          fill="outline"
          color="medium"
        >
          Clear Result
        </ion-button>
        <ion-button 
          @click="$emit('close')" 
          fill="outline"
          color="medium"
        >
          Close
        </ion-button>
      </div>
    </div>

    <!-- Loading/Error States -->
    <div v-else class="no-tool">
      <ion-icon :icon="constructOutline" class="no-tool-icon"></ion-icon>
      <h3>No Tool Selected</h3>
      <p>Please select a tool to execute.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonBadge,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon
} from '@ionic/vue';
import {
  playOutline,
  hourglassOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  bulbOutline,
  constructOutline
} from 'ionicons/icons';

import { mcpService } from '@/services/mcpService';
import type { MCPRegistration, MCPTool, MCPExecutionResult } from '@/types/mcp';

// Props
interface Props {
  mcp?: MCPRegistration | null;
  tool?: MCPTool | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'execution-complete': [result: MCPExecutionResult];
  'close': [];
}>();

// Local state
const parameters = ref<Record<string, any>>({});
const isExecuting = ref(false);
const executionResult = ref<MCPExecutionResult | null>(null);

// Computed properties
const hasParameters = computed(() => {
  return props.tool?.parameters?.properties && 
         Object.keys(props.tool.parameters.properties).length > 0;
});

const isValid = computed(() => {
  if (!props.tool?.parameters?.required) return true;
  
  return props.tool.parameters.required.every((key: string) => {
    const value = parameters.value[key];
    return value !== undefined && value !== null && value !== '';
  });
});

// Watch for tool changes to reset form
watch([() => props.tool, () => props.mcp], () => {
  resetForm();
});

// Methods
const getTypeColor = (type: string): string => {
  switch (type) {
    case 'database': return 'primary';
    case 'api': return 'secondary';
    case 'file': return 'tertiary';
    case 'communication': return 'success';
    case 'computation': return 'warning';
    case 'external': return 'medium';
    default: return 'dark';
  }
};

const formatParameterName = (key: string): string => {
  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const isRequired = (key: string): boolean => {
  return props.tool?.parameters?.required?.includes(key) || false;
};

const loadExample = (example: string) => {
  // Try to parse the example to set parameter values
  // This is a simple implementation - could be enhanced based on example format
  if (props.tool?.name === 'generate-sql') {
    parameters.value.prompt = example;
  } else if (props.tool?.name === 'execute-sql') {
    parameters.value.sql = example;
  }
};

const executeTool = async () => {
  if (!props.mcp || !props.tool) return;
  
  isExecuting.value = true;
  executionResult.value = null;
  
  try {
    const result = await mcpService.executeMCPTool({
      mcpId: props.mcp.id,
      toolName: props.tool.name,
      parameters: parameters.value,
      sessionId: 'web-client', // Could be from a store
      userId: 'web-user' // Could be from auth store
    });
    
    executionResult.value = result;
    
    // Emit result to parent
    emit('execution-complete', result);
    
  } catch (error) {
    executionResult.value = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0,
      mcpId: props.mcp.id,
      toolName: props.tool.name,
      timestamp: new Date(),
      executionId: 'error-' + Date.now()
    };
  } finally {
    isExecuting.value = false;
  }
};

const clearResult = () => {
  executionResult.value = null;
};

const resetForm = () => {
  parameters.value = {};
  executionResult.value = null;
  
  // Set default values if available
  if (props.tool?.parameters?.properties) {
    Object.entries(props.tool.parameters.properties).forEach(([key, param]: [string, any]) => {
      if (param && typeof param === 'object' && 'default' in param && param.default !== undefined) {
        parameters.value[key] = param.default;
      }
    });
  }
};

const formatResultData = (data: any): string => {
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2);
};


// Initialize form when component mounts
resetForm();
</script>

<style scoped>
.tool-executor {
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.executor-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tool-info {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.tool-title {
  margin: 0 0 8px 0;
  font-size: 1.2em;
  color: var(--ion-color-dark);
}

.tool-description {
  margin: 0 0 12px 0;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.mcp-info {
  display: flex;
  gap: 8px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 1em;
  color: var(--ion-color-dark);
  display: flex;
  align-items: center;
  gap: 8px;
}

.parameters-section {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
}

.parameters-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.parameter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parameter-label {
  font-weight: 500;
  color: var(--ion-color-dark);
  font-size: 0.9em;
}

.required {
  color: var(--ion-color-danger);
}

.parameter-input {
  width: 100%;
}

.parameter-description {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  font-style: italic;
}

.no-parameters {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 20px;
}

.examples-section {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--ion-color-light);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.example-item:hover {
  background: var(--ion-color-light-shade);
}

.example-icon {
  color: var(--ion-color-warning);
  font-size: 16px;
}

.example-text {
  font-size: 0.9em;
  color: var(--ion-color-dark);
}

.result-section {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
}

.result-icon {
  font-size: 18px;
}

.result-content {
  margin-top: 12px;
  border-radius: 6px;
  padding: 12px;
}

.success-result {
  background: var(--ion-color-success-tint);
  border: 1px solid var(--ion-color-success);
}

.error-result {
  background: var(--ion-color-danger-tint);
  border: 1px solid var(--ion-color-danger);
}

.execution-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8em;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.result-data {
  background: var(--ion-color-light);
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
  font-size: 0.85em;
}

.error-message {
  color: var(--ion-color-danger);
  font-weight: 500;
  margin-bottom: 8px;
}

.actions-section {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.no-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-tool-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-tool h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}

@media (max-width: 768px) {
  .actions-section {
    flex-direction: column;
  }
  
  .execution-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>