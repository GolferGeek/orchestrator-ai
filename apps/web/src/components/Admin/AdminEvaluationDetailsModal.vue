<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('dismiss')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Evaluation Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('dismiss')">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding" v-if="evaluation">
      <!-- Evaluation Overview -->
      <ion-card>
        <ion-card-header>
          <ion-card-subtitle>
            <ion-chip color="primary" size="small">
              {{ evaluation.task.agentName }}
            </ion-chip>
            <span class="user-info">{{ evaluation.user.email }}</span>
          </ion-card-subtitle>
          <ion-card-title class="evaluation-title">
            {{ evaluation.task.prompt }}
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <!-- Rating Display -->
              <ion-col size="12" size-md="6">
                <div class="rating-section">
                  <h4>Overall Rating</h4>
                  <div class="rating-stars">
                    <ion-icon 
                      v-for="starIndex in 5" 
                      :key="starIndex"
                      :icon="starIndex <= evaluation.evaluation.userRating ? starIcon : starOutline"
                      :color="starIndex <= evaluation.evaluation.userRating ? 'warning' : 'medium'"
                      size="large"
                    ></ion-icon>
                  </div>
                  <p class="rating-text">{{ evaluation.evaluation.userRating }}/5</p>
                </div>
              </ion-col>
              <!-- Additional Ratings -->
              <ion-col size="12" size-md="6">
                <div class="additional-ratings">
                  <div v-if="evaluation.evaluation.speedRating" class="rating-item">
                    <ion-icon :icon="timerOutline" color="primary"></ion-icon>
                    <span>Speed: {{ evaluation.evaluation.speedRating }}/5</span>
                  </div>
                  <div v-if="evaluation.evaluation.accuracyRating" class="rating-item">
                    <ion-icon :icon="checkmarkCircleOutline" color="success"></ion-icon>
                    <span>Accuracy: {{ evaluation.evaluation.accuracyRating }}/5</span>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
      <!-- User Notes -->
      <ion-card v-if="evaluation.evaluation.userNotes">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="documentTextOutline" style="margin-right: 8px;"></ion-icon>
            User Feedback
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="user-notes">
            {{ evaluation.evaluation.userNotes }}
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Task Information -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="clipboardOutline" style="margin-right: 8px;"></ion-icon>
            Task Information
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Task ID</h3>
                <p>{{ evaluation.task.id }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Method</h3>
                <p>{{ evaluation.task.method }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Status</h3>
                <p>{{ evaluation.task.status }}</p>
              </ion-label>
              <ion-chip 
                slot="end" 
                :color="getStatusColor(evaluation.task.status)" 
                size="small"
              >
                {{ evaluation.task.status }}
              </ion-chip>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Created</h3>
                <p>{{ formatDate(evaluation.task.createdAt) }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.task.completedAt">
              <ion-label>
                <h3>Completed</h3>
                <p>{{ formatDate(evaluation.task.completedAt) }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.task.progress !== undefined">
              <ion-label>
                <h3>Progress</h3>
                <ion-progress-bar 
                  :value="evaluation.task.progress / 100" 
                  color="primary"
                  style="margin-top: 8px;"
                ></ion-progress-bar>
                <p>{{ evaluation.task.progress }}%</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Task Response -->
      <ion-card v-if="evaluation.task.response">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="chatbubbleEllipsesOutline" style="margin-right: 8px;"></ion-icon>
            Task Response
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="task-response">
            <pre>{{ evaluation.task.response }}</pre>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- User Information -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="personOutline" style="margin-right: 8px;"></ion-icon>
            User Information
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Email</h3>
                <p>{{ evaluation.user.email }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.user.name">
              <ion-label>
                <h3>Name</h3>
                <p>{{ evaluation.user.name }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Roles</h3>
                <div style="margin-top: 8px;">
                  <ion-chip 
                    v-for="role in evaluation.user.roles" 
                    :key="role"
                    size="small"
                    color="secondary"
                  >
                    {{ role }}
                  </ion-chip>
                </div>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Workflow Steps -->
      <ion-card v-if="evaluation.workflowSteps">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="gitNetworkOutline" style="margin-right: 8px;"></ion-icon>
            Workflow Analysis
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <!-- Workflow Summary -->
          <ion-grid class="workflow-summary">
            <ion-row>
              <ion-col size="6" size-md="3">
                <div class="workflow-metric">
                  <h4>{{ evaluation.workflowSteps.completedSteps }}</h4>
                  <p>Completed</p>
                </div>
              </ion-col>
              <ion-col size="6" size-md="3">
                <div class="workflow-metric">
                  <h4>{{ evaluation.workflowSteps.totalSteps }}</h4>
                  <p>Total Steps</p>
                </div>
              </ion-col>
              <ion-col size="6" size-md="3">
                <div class="workflow-metric">
                  <h4>{{ evaluation.workflowSteps.failedSteps }}</h4>
                  <p>Failed</p>
                </div>
              </ion-col>
              <ion-col size="6" size-md="3">
                <div class="workflow-metric">
                  <h4>{{ evaluation.workflowSteps.progressPercent }}%</h4>
                  <p>Success Rate</p>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
          <!-- Step Details -->
          <div v-if="evaluation.workflowSteps.stepDetails && evaluation.workflowSteps.stepDetails.length > 0">
            <h4>Step Details</h4>
            <ion-list>
              <ion-item 
                v-for="(step, index) in evaluation.workflowSteps.stepDetails" 
                :key="index"
                class="step-item"
              >
                <ion-label>
                  <h3>{{ step.name }}</h3>
                  <p>{{ step.status }}</p>
                  <p v-if="step.duration" class="step-duration">
                    Duration: {{ step.duration }}ms
                  </p>
                  <p v-if="step.error" class="step-error">
                    Error: {{ step.error }}
                  </p>
                </ion-label>
                <ion-chip 
                  slot="end" 
                  :color="getStepStatusColor(step.status)" 
                  size="small"
                >
                  {{ step.status || 'Unknown' }}
                </ion-chip>
              </ion-item>
            </ion-list>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- LLM Constraints -->
      <ion-card v-if="evaluation.llmConstraints">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="codeOutline" style="margin-right: 8px;"></ion-icon>
            LLM Constraints (CIDAFM)
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <!-- Constraint Categories -->
          <div v-if="evaluation.llmConstraints.activeStateModifiers && evaluation.llmConstraints.activeStateModifiers.length > 0">
            <h4>Active State Modifiers</h4>
            <div class="constraint-tags">
              <ion-chip 
                v-for="modifier in evaluation.llmConstraints.activeStateModifiers" 
                :key="modifier"
                size="small"
                color="primary"
              >
                {{ modifier }}
              </ion-chip>
            </div>
          </div>
          <div v-if="evaluation.llmConstraints.responseModifiers && evaluation.llmConstraints.responseModifiers.length > 0">
            <h4>Response Modifiers</h4>
            <div class="constraint-tags">
              <ion-chip 
                v-for="modifier in evaluation.llmConstraints.responseModifiers" 
                :key="modifier"
                size="small"
                color="secondary"
              >
                {{ modifier }}
              </ion-chip>
            </div>
          </div>
          <div v-if="evaluation.llmConstraints.executedCommands && evaluation.llmConstraints.executedCommands.length > 0">
            <h4>Executed Commands</h4>
            <div class="constraint-tags">
              <ion-chip 
                v-for="command in evaluation.llmConstraints.executedCommands" 
                :key="command"
                size="small"
                color="tertiary"
              >
                {{ command }}
              </ion-chip>
            </div>
          </div>
          <!-- Constraint Effectiveness -->
          <div v-if="evaluation.llmConstraints.constraintEffectiveness">
            <h4>Effectiveness Analysis</h4>
            <ion-list>
              <ion-item>
                <ion-label>
                  <h3>Modifier Compliance</h3>
                  <p>{{ evaluation.llmConstraints.constraintEffectiveness.modifierCompliance }}/10</p>
                </ion-label>
                <ion-progress-bar 
                  slot="end" 
                  :value="evaluation.llmConstraints.constraintEffectiveness.modifierCompliance / 10"
                  color="success"
                  style="width: 100px;"
                ></ion-progress-bar>
              </ion-item>
              <ion-item>
                <ion-label>
                  <h3>Constraint Impact</h3>
                  <p>{{ evaluation.llmConstraints.constraintEffectiveness.constraintImpact }}</p>
                </ion-label>
              </ion-item>
              <ion-item v-if="evaluation.llmConstraints.constraintEffectiveness.overallEffectiveness">
                <ion-label>
                  <h3>Overall Effectiveness</h3>
                  <p>{{ evaluation.llmConstraints.constraintEffectiveness.overallEffectiveness }}/10</p>
                </ion-label>
                <ion-progress-bar 
                  slot="end" 
                  :value="evaluation.llmConstraints.constraintEffectiveness.overallEffectiveness / 10"
                  color="primary"
                  style="width: 100px;"
                ></ion-progress-bar>
              </ion-item>
            </ion-list>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- LLM Information -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="hardwareChipOutline" style="margin-right: 8px;"></ion-icon>
            LLM Information
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Provider</h3>
                <p>{{ evaluation.llmInfo.provider }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Model</h3>
                <p>{{ evaluation.llmInfo.model }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Response Time</h3>
                <p>{{ evaluation.llmInfo.responseTimeMs }}ms</p>
              </ion-label>
              <ion-chip 
                slot="end" 
                :color="getResponseTimeColor(evaluation.llmInfo.responseTimeMs)"
                size="small"
              >
                {{ getResponseTimeLabel(evaluation.llmInfo.responseTimeMs) }}
              </ion-chip>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Cost</h3>
                <p>${{ evaluation.llmInfo.cost.toFixed(4) }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Token Usage</h3>
                <p>Input: {{ evaluation.llmInfo.tokenUsage.input }} | Output: {{ evaluation.llmInfo.tokenUsage.output }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.llmInfo.temperature">
              <ion-label>
                <h3>Temperature</h3>
                <p>{{ evaluation.llmInfo.temperature }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.llmInfo.maxTokens">
              <ion-label>
                <h3>Max Tokens</h3>
                <p>{{ evaluation.llmInfo.maxTokens }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Evaluation Metadata -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="informationCircleOutline" style="margin-right: 8px;"></ion-icon>
            Evaluation Metadata
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Evaluation Date</h3>
                <p>{{ formatDate(evaluation.evaluation.evaluationTimestamp) }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="evaluation.evaluation.evaluationDetails">
              <ion-label>
                <h3>Additional Details</h3>
                <pre class="evaluation-details">{{ JSON.stringify(evaluation.evaluation.evaluationDetails, null, 2) }}</pre>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
    <ion-content v-else class="ion-text-center ion-padding">
      <ion-icon :icon="documentOutline" size="large" color="medium"></ion-icon>
      <h3>No Evaluation Selected</h3>
      <p>Please select an evaluation to view details.</p>
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
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonChip,
  IonProgressBar
} from '@ionic/vue';
import {
  starOutline,
  star,
  timerOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  clipboardOutline,
  chatbubbleEllipsesOutline,
  personOutline,
  gitNetworkOutline,
  codeOutline,
  hardwareChipOutline,
  informationCircleOutline,
  documentOutline
} from 'ionicons/icons';
import type { EvaluationWithMessage } from '@/types/evaluation';

interface Props {
  isOpen: boolean;
  evaluation: EvaluationWithMessage;
}
defineProps<Props>();
defineEmits<{
  dismiss: []
}>();
const starIcon = computed(() => star);
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
      return 'warning';
    case 'running':
      return 'primary';
    default:
      return 'medium';
  }
}
function getStepStatusColor(status: string | undefined): string {
  if (!status) {
    return 'medium'; // Default color for undefined/null status
  }
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'success';
    case 'failed':
    case 'error':
      return 'danger';
    case 'running':
    case 'in_progress':
      return 'primary';
    case 'pending':
    case 'waiting':
      return 'warning';
    default:
      return 'medium';
  }
}
function getResponseTimeColor(time: number): string {
  if (time < 1000) return 'success';
  if (time < 3000) return 'warning';
  return 'danger';
}
function getResponseTimeLabel(time: number): string {
  if (time < 1000) return 'Fast';
  if (time < 3000) return 'Moderate';
  return 'Slow';
}
</script>
<style scoped>
.evaluation-title {
  font-size: 1.1rem;
  line-height: 1.4;
  margin-top: 0.5rem;
}
.user-info {
  margin-left: 8px;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.rating-section {
  text-align: center;
}
.rating-section h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
}
.rating-stars {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}
.rating-text {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}
.additional-ratings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}
.rating-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.user-notes {
  background: var(--ion-color-light);
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
  font-style: italic;
  line-height: 1.5;
}
.task-response {
  background: var(--ion-color-light);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--ion-color-medium);
  max-height: 300px;
  overflow-y: auto;
}
.task-response pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}
.workflow-summary {
  margin-bottom: 24px;
}
.workflow-metric {
  text-align: center;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}
.workflow-metric h4 {
  margin: 0 0 4px 0;
  font-size: 1.5rem;
  font-weight: 600;
}
.workflow-metric p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.step-item {
  margin-bottom: 8px;
}
.step-duration {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
.step-error {
  font-size: 0.8rem;
  color: var(--ion-color-danger);
  margin-top: 4px;
  font-family: monospace;
}
.constraint-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 24px 0;
}
.constraint-tags ion-chip {
  margin: 0;
}
.evaluation-details {
  font-size: 0.8rem;
  background: var(--ion-color-light);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin-top: 8px;
}
ion-card {
  margin-bottom: 16px;
}
h4 {
  color: var(--ion-color-primary);
  margin: 16px 0 12px 0;
  font-size: 1rem;
}
@media (max-width: 768px) {
  .rating-stars {
    gap: 2px;
  }
  .additional-ratings {
    margin-top: 16px;
  }
  .workflow-metric h4 {
    font-size: 1.2rem;
  }
  .task-response {
    max-height: 200px;
  }
  .constraint-tags {
    gap: 4px;
  }
}
</style>