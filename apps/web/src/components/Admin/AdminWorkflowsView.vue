<template>
  <div class="admin-workflows">
    <!-- Loading State -->
    <div v-if="isLoading" class="ion-text-center ion-padding">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading workflow analytics...</p>
    </div>
    <!-- Workflow Analytics Content -->
    <div v-else-if="workflowAnalytics">
      <!-- Workflow Overview Cards -->
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ workflowAnalytics.totalWorkflowsExecuted || 0 }}</h2>
                <p>Total Workflows</p>
                <ion-icon :icon="gitNetworkOutline" color="primary" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ Math.round(workflowAnalytics.averageCompletionRate || 0) }}%</h2>
                <p>Success Rate</p>
                <ion-icon :icon="checkmarkCircleOutline" color="success" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ Math.round(workflowAnalytics.averageExecutionTime || 0) }}ms</h2>
                <p>Avg Duration</p>
                <ion-icon :icon="timeOutline" color="warning" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ workflowAnalytics.averageStepsCompleted || 0 }}</h2>
                <p>Avg Steps</p>
                <ion-icon :icon="layersOutline" color="medium" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
      <!-- Workflow Filters -->
      <ion-card class="filters-card">
        <ion-card-header>
          <ion-card-title>Filter Workflows</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-input 
                    v-model="workflowFilters.stepName" 
                    placeholder="Step Name"
                    @ionInput="debounceFilter"
                  ></ion-input>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-input 
                    v-model="workflowFilters.agentName" 
                    placeholder="Agent Name"
                    @ionInput="debounceFilter"
                  ></ion-input>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-select 
                    v-model="workflowFilters.status" 
                    placeholder="Status"
                    @ionChange="refreshWorkflows"
                  >
                    <ion-select-option value="">All Statuses</ion-select-option>
                    <ion-select-option value="completed">Completed</ion-select-option>
                    <ion-select-option value="failed">Failed</ion-select-option>
                    <ion-select-option value="partial">Partial</ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
      <!-- Step Performance Analysis -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Step Performance Analysis</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div v-if="workflowAnalytics.stepPerformance && workflowAnalytics.stepPerformance.length > 0">
            <ion-list>
              <ion-item 
                v-for="step in workflowAnalytics.stepPerformance"
                :key="step.stepName"
                class="step-item"
              >
                <ion-label>
                  <h3>{{ step.stepName }}</h3>
                  <p>Executed {{ step.executionCount }} times</p>
                  <p class="step-details">
                    Avg duration: {{ Math.round(step.averageDuration) }}ms | 
                    Success: {{ step.successRate.toFixed(1) }}%
                  </p>
                </ion-label>
                <div slot="end" class="step-metrics">
                  <ion-chip 
                    :color="getSuccessRateColor(step.successRate)" 
                    size="small"
                  >
                    {{ step.successRate.toFixed(1) }}%
                  </ion-chip>
                  <ion-progress-bar 
                    :value="step.successRate / 100" 
                    :color="getSuccessRateColor(step.successRate)"
                    style="width: 100px; margin-top: 4px;"
                  ></ion-progress-bar>
                </div>
              </ion-item>
            </ion-list>
          </div>
          <div v-else class="ion-text-center ion-padding">
            <ion-icon :icon="layersOutline" size="large" color="medium"></ion-icon>
            <p>No step performance data available</p>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Most Common Failure Points -->
      <ion-card v-if="workflowAnalytics.commonFailures && workflowAnalytics.commonFailures.length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="warningOutline" color="danger" style="margin-right: 8px;"></ion-icon>
            Common Failure Points
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="failure in workflowAnalytics.commonFailures.slice(0, 10)"
              :key="failure.stepName"
              class="failure-item"
            >
              <ion-label>
                <h3>{{ failure.stepName }}</h3>
                <p>{{ failure.failureCount }} failures out of {{ failure.totalAttempts }} attempts</p>
                <p class="failure-details">
                  <span class="error-snippet">{{ truncateError(failure.commonError) }}</span>
                </p>
              </ion-label>
              <div slot="end" class="failure-metrics">
                <ion-chip color="danger" size="small">
                  {{ failure.failureRate.toFixed(1) }}%
                </ion-chip>
                <ion-button 
                  fill="clear" 
                  size="small" 
                  @click="showFailureDetails(failure)"
                >
                  Details
                </ion-button>
              </div>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Workflow Duration Distribution -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Duration Distribution</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="duration-chart" v-if="workflowAnalytics.durationDistribution">
            <div 
              v-for="(bucket, index) in workflowAnalytics.durationDistribution"
              :key="index"
              class="duration-bar"
            >
              <div class="duration-label">{{ bucket.range }}</div>
              <div class="duration-bar-container">
                <div 
                  class="duration-bar-fill"
                  :style="{ width: `${(bucket.count / workflowAnalytics.totalWorkflowsExecuted) * 100}%` }"
                ></div>
              </div>
              <div class="duration-count">{{ bucket.count }}</div>
            </div>
          </div>
          <div v-else class="ion-text-center ion-padding">
            <p>No duration distribution data available</p>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Workflow Performance by Agent -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Performance by Agent</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div v-if="workflowAnalytics.agentPerformance && workflowAnalytics.agentPerformance.length > 0">
            <ion-list>
              <ion-item 
                v-for="agent in workflowAnalytics.agentPerformance"
                :key="agent.agentName"
                class="agent-workflow-item"
              >
                <ion-label>
                  <h3>{{ agent.agentName }}</h3>
                  <p>{{ agent.workflowCount }} workflows executed</p>
                  <p class="agent-workflow-details">
                    Success: {{ agent.successRate.toFixed(1) }}% | 
                    Avg Duration: {{ Math.round(agent.averageDuration) }}ms
                  </p>
                </ion-label>
                <div slot="end" class="agent-workflow-metrics">
                  <ion-chip 
                    :color="getSuccessRateColor(agent.successRate)"
                    size="small"
                  >
                    {{ agent.successRate.toFixed(1) }}%
                  </ion-chip>
                  <div class="workflow-progress">
                    <ion-progress-bar 
                      :value="agent.successRate / 100" 
                      :color="getSuccessRateColor(agent.successRate)"
                    ></ion-progress-bar>
                  </div>
                </div>
              </ion-item>
            </ion-list>
          </div>
          <div v-else class="ion-text-center ion-padding">
            <p>No agent performance data available</p>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Recent Workflow Activity -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Recent Activity</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div v-if="workflowAnalytics.recentActivity && workflowAnalytics.recentActivity.length > 0">
            <ion-list>
              <ion-item 
                v-for="activity in workflowAnalytics.recentActivity.slice(0, 5)"
                :key="`${activity.workflowId}-${activity.timestamp}`"
                class="activity-item"
              >
                <ion-label>
                  <h3>{{ activity.agentName }}</h3>
                  <p>{{ activity.stepName || 'Full Workflow' }}</p>
                  <p class="activity-timestamp">{{ formatTimestamp(activity.timestamp) }}</p>
                </ion-label>
                <ion-chip 
                  slot="end" 
                  :color="activity.status === 'completed' ? 'success' : activity.status === 'failed' ? 'danger' : 'warning'"
                  size="small"
                >
                  {{ activity.status }}
                </ion-chip>
              </ion-item>
            </ion-list>
          </div>
          <div v-else class="ion-text-center ion-padding">
            <p>No recent activity available</p>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Export Actions -->
      <ion-card class="export-actions">
        <ion-card-content>
          <ion-button 
            expand="block" 
            fill="outline" 
            @click="exportWorkflowReport"
          >
            <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
            Export Workflow Report
          </ion-button>
        </ion-card-content>
      </ion-card>
    </div>
    <!-- Empty State -->
    <ion-card v-else class="ion-text-center">
      <ion-card-content>
        <ion-icon :icon="gitNetworkOutline" size="large" color="medium"></ion-icon>
        <h3>No Workflow Data</h3>
        <p>No workflow analytics data available.</p>
        <ion-button fill="clear" @click="$emit('refresh')">
          Refresh Data
        </ion-button>
      </ion-card-content>
    </ion-card>
    <!-- Failure Details Modal -->
    <ion-modal :is-open="showFailureModal" @didDismiss="closeFailureModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Failure Details</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeFailureModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding" v-if="selectedFailure">
        <h3>{{ selectedFailure.stepName }}</h3>
        <p><strong>Failure Rate:</strong> {{ selectedFailure.failureRate.toFixed(1) }}%</p>
        <p><strong>Failed:</strong> {{ selectedFailure.failureCount }} of {{ selectedFailure.totalAttempts }} attempts</p>
        <h4>Common Error Message:</h4>
        <div class="error-message">
          {{ selectedFailure.commonError }}
        </div>
        <h4>Suggested Actions:</h4>
        <ul>
          <li>Review step implementation for edge cases</li>
          <li>Check input validation</li>
          <li>Verify error handling logic</li>
          <li>Consider adding retry mechanisms</li>
        </ul>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive } from 'vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonList,
  IonChip,
  IonProgressBar,
  IonButton,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent
} from '@ionic/vue';
import {
  gitNetworkOutline,
  checkmarkCircleOutline,
  timeOutline,
  layersOutline,
  warningOutline,
  downloadOutline
} from 'ionicons/icons';
import type { WorkflowAnalytics } from '@/types/analytics';

interface Props {
  workflowAnalytics: WorkflowAnalytics;
  isLoading: boolean;
}
defineProps<Props>();
const emit = defineEmits<{
  refresh: []
}>();
const workflowFilters = reactive({
  stepName: '',
  agentName: '',
  status: ''
});
const showFailureModal = ref(false);
const selectedFailure = ref<WorkflowAnalytics['commonFailurePatterns'][0] | null>(null);
let filterTimeout: NodeJS.Timeout | null = null;
function debounceFilter() {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
  filterTimeout = setTimeout(() => {
    refreshWorkflows();
  }, 500);
}
function refreshWorkflows() {
  emit('refresh');
}
function getSuccessRateColor(rate: number): string {
  if (rate >= 90) return 'success';
  if (rate >= 70) return 'warning';
  return 'danger';
}
function truncateError(error: string): string {
  if (!error) return 'No error details available';
  return error.length > 100 ? error.substring(0, 100) + '...' : error;
}
function showFailureDetails(failure: WorkflowAnalytics['commonFailurePatterns'][0]) {
  selectedFailure.value = failure;
  showFailureModal.value = true;
}
function closeFailureModal() {
  showFailureModal.value = false;
  selectedFailure.value = null;
}
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
function exportWorkflowReport() {
  // Implementation would depend on your export service
}
</script>
<style scoped>
.admin-workflows {
  max-width: 1200px;
  margin: 0 auto;
}
.metric-card {
  height: 120px;
  margin-bottom: 1rem;
}
.metric-card ion-card-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.metric-card h2 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}
.metric-card p {
  margin: 0.5rem 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.filters-card {
  margin-bottom: 1rem;
}
.step-item,
.failure-item,
.agent-workflow-item,
.activity-item {
  margin-bottom: 8px;
}
.step-details,
.failure-details,
.agent-workflow-details {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
.error-snippet {
  font-family: monospace;
  background: var(--ion-color-light);
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 0.75rem;
}
.step-metrics,
.failure-metrics,
.agent-workflow-metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120px;
}
.workflow-progress {
  width: 100px;
  margin-top: 4px;
}
.duration-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}
.duration-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.duration-label {
  width: 100px;
  font-weight: 500;
  font-size: 0.9rem;
}
.duration-bar-container {
  flex: 1;
  height: 20px;
  background: var(--ion-color-light);
  border-radius: 10px;
  overflow: hidden;
}
.duration-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  transition: width 0.3s ease;
}
.duration-count {
  width: 40px;
  text-align: right;
  font-weight: 500;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}
.activity-timestamp {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
.export-actions {
  margin-top: 2rem;
}
.error-message {
  background: var(--ion-color-light);
  padding: 12px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.9rem;
  border-left: 4px solid var(--ion-color-danger);
  margin: 12px 0;
}
ion-card {
  margin-bottom: 1rem;
}
@media (max-width: 768px) {
  .metric-card h2 {
    font-size: 1.5rem;
  }
  .step-metrics,
  .failure-metrics,
  .agent-workflow-metrics {
    min-width: 100px;
  }
  .duration-label {
    width: 80px;
    font-size: 0.8rem;
  }
  .duration-count {
    width: 30px;
    font-size: 0.8rem;
  }
  .duration-bar {
    gap: 8px;
  }
}
</style>