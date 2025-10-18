<template>
  <div class="workflow-progress-view">
    <div class="workflow-header">
      <h4>{{ workflowTitle }}</h4>
      <div class="workflow-overall-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${overallProgress}%` }"></div>
        </div>
        <span class="progress-text">{{ completedSteps }}/{{ totalSteps }} steps completed</span>
      </div>
    </div>
    <div class="workflow-steps">
      <div 
        v-for="(step, index) in steps" 
        :key="step.stepName"
        class="workflow-step"
        :class="getStepClass(step)"
      >
        <div class="step-indicator">
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-status-icon">
            <ion-icon 
              :icon="getStepIcon(step)"
              :class="getStepIconClass(step)"
            />
          </div>
        </div>
        <div class="step-content">
          <div class="step-title">{{ formatStepName(step.stepName) }}</div>
          <div v-if="step.message" class="step-message">{{ step.message }}</div>
          <div v-if="step.metadata" class="step-metadata">
            <div v-for="(value, key) in getVisibleMetadata(step.metadata)" :key="key" class="metadata-item">
              <span class="metadata-key">{{ formatMetadataKey(key) }}:</span>
              <span class="metadata-value">{{ formatMetadataValue(value) }}</span>
            </div>
          </div>
        </div>
        <div class="step-timestamp">
          {{ formatTimestamp(step.timestamp) }}
        </div>
      </div>
    </div>
    <div v-if="deliverables.length > 0" class="workflow-deliverables">
      <h5>Deliverables</h5>
      <div class="deliverable-list">
        <div 
          v-for="deliverable in deliverables" 
          :key="deliverable.title"
          class="deliverable-item"
        >
          <div class="deliverable-header">
            <ion-icon :icon="documentTextOutline" class="deliverable-icon" />
            <span class="deliverable-title">{{ deliverable.title }}</span>
            <span class="deliverable-type">{{ deliverable.deliverableType }}</span>
          </div>
          <div class="deliverable-actions">
            <ion-button 
              fill="clear" 
              size="small" 
              @click="viewDeliverable(deliverable)"
              class="action-button"
            >
              <ion-icon :icon="eyeOutline" slot="start" />
              View
            </ion-button>
            <ion-button 
              v-if="deliverable.downloadable" 
              fill="clear" 
              size="small" 
              @click="downloadDeliverable(deliverable)"
              class="action-button"
            >
              <ion-icon :icon="downloadOutline" slot="start" />
              Download
            </ion-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, defineProps, defineEmits } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import { 
  checkmarkCircleOutline,
  ellipseOutline,
  playCircleOutline,
  closeCircleOutline,
  documentTextOutline,
  eyeOutline,
  downloadOutline
} from 'ionicons/icons';
interface WorkflowStep {
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
interface WorkflowDeliverable {
  title: string;
  content: string;
  deliverableType: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  format: 'markdown' | 'text' | 'json' | 'html';
  metadata?: Record<string, unknown>;
  downloadable?: boolean;
  timestamp: Date;
}
const props = defineProps<{
  workflowTitle: string;
  steps: WorkflowStep[];
  deliverables: WorkflowDeliverable[];
  collapsible?: boolean;
}>();
const emit = defineEmits<{
  viewDeliverable: [deliverable: WorkflowDeliverable];
  downloadDeliverable: [deliverable: WorkflowDeliverable];
}>();
const totalSteps = computed(() => props.steps.length);
const completedSteps = computed(() => props.steps.filter(s => s.status === 'completed').length);
const overallProgress = computed(() => {
  if (totalSteps.value === 0) return 0;
  return Math.round((completedSteps.value / totalSteps.value) * 100);
});
const getStepClass = (step: WorkflowStep) => {
  return {
    'step-pending': step.status === 'pending',
    'step-in-progress': step.status === 'in_progress',
    'step-completed': step.status === 'completed',
    'step-failed': step.status === 'failed'
  };
};
const getStepIcon = (step: WorkflowStep) => {
  switch (step.status) {
    case 'completed':
      return checkmarkCircleOutline;
    case 'in_progress':
      return playCircleOutline;
    case 'failed':
      return closeCircleOutline;
    default:
      return ellipseOutline;
  }
};
const getStepIconClass = (step: WorkflowStep) => {
  return {
    'icon-completed': step.status === 'completed',
    'icon-in-progress': step.status === 'in_progress',
    'icon-failed': step.status === 'failed',
    'icon-pending': step.status === 'pending'
  };
};
const formatStepName = (stepName: string): string => {
  return stepName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};
const formatTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};
const getVisibleMetadata = (metadata: Record<string, unknown>): Record<string, unknown> => {
  const visibleKeys = [
    'validation_score',
    'review_score',
    'feature_count',
    'complexity',
    'document_type',
    'estimated_effort',
    'optimization_changes'
  ];
  const visible: Record<string, unknown> = {};
  for (const key of visibleKeys) {
    if (metadata[key] !== undefined) {
      visible[key] = metadata[key];
    }
  }
  return visible;
};
const formatMetadataKey = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};
const formatMetadataValue = (value: unknown): string => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};
const viewDeliverable = (deliverable: WorkflowDeliverable) => {
  emit('viewDeliverable', deliverable);
};
const downloadDeliverable = (deliverable: WorkflowDeliverable) => {
  emit('downloadDeliverable', deliverable);
};
</script>
<style scoped>
.workflow-progress-view {
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  border: 1px solid var(--ion-color-light-shade);
}
.workflow-header {
  margin-bottom: 16px;
}
.workflow-header h4 {
  margin: 0 0 8px 0;
  color: var(--ion-color-primary);
  font-size: 1.1em;
  font-weight: 600;
}
.workflow-overall-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}
.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--ion-color-light-shade);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--ion-color-success);
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  min-width: 120px;
}
.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  background: var(--ion-color-light-tint);
  border-left: 4px solid var(--ion-color-medium);
}
.workflow-step.step-pending {
  border-left-color: var(--ion-color-medium);
}
.workflow-step.step-in-progress {
  border-left-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
}
.workflow-step.step-completed {
  border-left-color: var(--ion-color-success);
}
.workflow-step.step-failed {
  border-left-color: var(--ion-color-danger);
  background: var(--ion-color-danger-tint);
}
.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 40px;
}
.step-number {
  font-size: 0.8em;
  font-weight: 600;
  color: var(--ion-color-medium);
  background: var(--ion-color-light);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-status-icon {
  font-size: 1.2em;
}
.step-status-icon .icon-completed {
  color: var(--ion-color-success);
}
.step-status-icon .icon-in-progress {
  color: var(--ion-color-primary);
}
.step-status-icon .icon-failed {
  color: var(--ion-color-danger);
}
.step-status-icon .icon-pending {
  color: var(--ion-color-medium);
}
.step-content {
  flex: 1;
}
.step-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}
.step-message {
  font-size: 0.9em;
  color: var(--ion-color-medium-shade);
  margin-bottom: 8px;
}
.step-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.metadata-item {
  font-size: 0.8em;
  background: var(--ion-color-light);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}
.metadata-key {
  font-weight: 600;
  color: var(--ion-color-medium);
}
.metadata-value {
  color: var(--ion-color-dark);
  margin-left: 4px;
}
.step-timestamp {
  font-size: 0.75em;
  color: var(--ion-color-medium);
  align-self: flex-end;
  min-width: 80px;
  text-align: right;
}
.workflow-deliverables {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light-shade);
}
.workflow-deliverables h5 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
  font-size: 1em;
  font-weight: 600;
}
.deliverable-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.deliverable-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--ion-color-light-tint);
  border-radius: 6px;
  border: 1px solid var(--ion-color-light-shade);
}
.deliverable-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.deliverable-icon {
  color: var(--ion-color-primary);
  font-size: 1.2em;
}
.deliverable-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  flex: 1;
}
.deliverable-type {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  background: var(--ion-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}
.deliverable-actions {
  display: flex;
  gap: 8px;
}
.action-button {
  --color: var(--ion-color-primary);
  --padding-start: 8px;
  --padding-end: 8px;
}
.action-button:hover {
  --color: var(--ion-color-primary-shade);
}
</style>