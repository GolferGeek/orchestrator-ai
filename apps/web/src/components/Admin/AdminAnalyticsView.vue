<template>
  <div class="admin-analytics">
    <!-- Loading State -->
    <div v-if="isLoading" class="ion-text-center ion-padding">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading detailed analytics...</p>
    </div>
    <!-- Analytics Content -->
    <div v-else>
      <!-- Time Range Selector -->
      <ion-card class="filters-card">
        <ion-card-header>
          <ion-card-title>Analytics Filters</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-input 
                    v-model="analyticsFilters.startDate" 
                    type="date" 
                    placeholder="Start Date"
                    @ionChange="refreshAnalytics"
                  ></ion-input>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-input 
                    v-model="analyticsFilters.endDate" 
                    type="date" 
                    placeholder="End Date"
                    @ionChange="refreshAnalytics"
                  ></ion-input>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-item>
                  <ion-select 
                    v-model="analyticsFilters.userRole" 
                    placeholder="Filter by Role"
                    @ionChange="refreshAnalytics"
                  >
                    <ion-select-option value="">All Roles</ion-select-option>
                    <ion-select-option value="user">Users</ion-select-option>
                    <ion-select-option value="beta-tester">Beta Testers</ion-select-option>
                    <ion-select-option value="developer">Developers</ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
      <!-- Main Analytics Dashboard -->
      <ion-grid>
        <ion-row>
          <!-- Performance Metrics -->
          <ion-col size="12" size-lg="6">
            <ion-card>
              <ion-card-header>
                <ion-card-title>Performance Metrics</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="metrics-grid">
                  <div class="metric-item">
                    <h3>{{ analytics?.averageRating?.toFixed(1) || 'N/A' }}</h3>
                    <p>Average Rating</p>
                    <ion-progress-bar 
                      :value="(analytics?.averageRating || 0) / 5" 
                      color="success"
                    ></ion-progress-bar>
                  </div>
                  <div class="metric-item">
                    <h3>{{ analytics?.averageSpeedRating?.toFixed(1) || 'N/A' }}</h3>
                    <p>Speed Rating</p>
                    <ion-progress-bar 
                      :value="(analytics?.averageSpeedRating || 0) / 5" 
                      color="primary"
                    ></ion-progress-bar>
                  </div>
                  <div class="metric-item">
                    <h3>{{ analytics?.averageAccuracyRating?.toFixed(1) || 'N/A' }}</h3>
                    <p>Accuracy Rating</p>
                    <ion-progress-bar 
                      :value="(analytics?.averageAccuracyRating || 0) / 5" 
                      color="warning"
                    ></ion-progress-bar>
                  </div>
                  <div class="metric-item">
                    <h3>{{ Math.round(analytics?.averageResponseTime || 0) }}ms</h3>
                    <p>Avg Response Time</p>
                    <ion-chip 
                      :color="getResponseTimeColor(analytics?.averageResponseTime || 0)"
                      size="small"
                    >
                      {{ getResponseTimeLabel(analytics?.averageResponseTime || 0) }}
                    </ion-chip>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <!-- Cost Analysis -->
          <ion-col size="12" size-lg="6">
            <ion-card>
              <ion-card-header>
                <ion-card-title>Cost Analysis</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="cost-metrics">
                  <ion-item lines="none">
                    <ion-label>
                      <h3>Average Cost per Evaluation</h3>
                      <p>${{ analytics?.averageCost?.toFixed(4) || '0.0000' }}</p>
                    </ion-label>
                    <ion-icon :icon="cardOutline" slot="end" color="medium"></ion-icon>
                  </ion-item>
                  <ion-item lines="none">
                    <ion-label>
                      <h3>Total Estimated Cost</h3>
                      <p>${{ ((analytics?.averageCost || 0) * (analytics?.totalEvaluations || 0)).toFixed(2) }}</p>
                    </ion-label>
                    <ion-icon :icon="cashOutline" slot="end" color="success"></ion-icon>
                  </ion-item>
                  <ion-item lines="none">
                    <ion-label>
                      <h3>Cost per Rating Point</h3>
                      <p>${{ getCostPerRatingPoint().toFixed(4) }}</p>
                    </ion-label>
                    <ion-icon :icon="trendingUpOutline" slot="end" color="primary"></ion-icon>
                  </ion-item>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
      <!-- Workflow Analytics -->
      <ion-card v-if="workflowAnalytics">
        <ion-card-header>
          <ion-card-title>Workflow Performance</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6">
                <div class="workflow-metric">
                  <h3>{{ Math.round(analytics?.averageWorkflowCompletionRate || 0) }}%</h3>
                  <p>Overall Success Rate</p>
                  <ion-progress-bar 
                    :value="(analytics?.averageWorkflowCompletionRate || 0) / 100" 
                    color="success"
                  ></ion-progress-bar>
                </div>
              </ion-col>
              <ion-col size="12" size-md="6">
                <div class="workflow-metric">
                  <h3>{{ workflowAnalytics.averageStepsCompleted || 0 }}</h3>
                  <p>Avg Steps Completed</p>
                  <ion-chip color="primary" size="small">
                    of {{ workflowAnalytics.averageTotalSteps || 0 }} total
                  </ion-chip>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
          <!-- Top Workflow Issues -->
          <div v-if="analytics?.workflowFailurePoints?.length > 0" class="workflow-issues">
            <h4>Most Problematic Steps</h4>
            <ion-list>
              <ion-item 
                v-for="failure in analytics.workflowFailurePoints.slice(0, 3)"
                :key="failure.stepName"
              >
                <ion-label>
                  <h3>{{ failure.stepName }}</h3>
                  <p>{{ failure.failureRate.toFixed(1) }}% failure rate</p>
                  <p class="text-small">Avg duration: {{ Math.round(failure.averageDuration) }}ms</p>
                </ion-label>
                <ion-chip slot="end" color="danger" size="small">
                  Critical
                </ion-chip>
              </ion-item>
            </ion-list>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Constraint Analytics -->
      <ion-card v-if="constraintAnalytics">
        <ion-card-header>
          <ion-card-title>Constraint Effectiveness</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <!-- Top Constraints -->
              <ion-col size="12" size-lg="6">
                <h4>Most Effective Constraints</h4>
                <ion-list>
                  <ion-item 
                    v-for="constraint in analytics?.topConstraints?.slice(0, 5) || []"
                    :key="constraint.constraintName"
                  >
                    <ion-label>
                      <h3>{{ constraint.constraintName }}</h3>
                      <p>Used {{ constraint.usageCount }} times</p>
                    </ion-label>
                    <ion-chip 
                      slot="end" 
                      :color="getEffectivenessColor(constraint.effectivenessScore)"
                    >
                      {{ constraint.effectivenessScore.toFixed(1) }}
                    </ion-chip>
                  </ion-item>
                </ion-list>
              </ion-col>
              <!-- Constraint Usage Stats -->
              <ion-col size="12" size-lg="6">
                <h4>Usage Statistics</h4>
                <div class="constraint-stats">
                  <div class="stat-item">
                    <h3>{{ constraintAnalytics.totalConstraintsUsed || 0 }}</h3>
                    <p>Total Constraints Applied</p>
                  </div>
                  <div class="stat-item">
                    <h3>{{ constraintAnalytics.averageConstraintsPerEvaluation?.toFixed(1) || '0.0' }}</h3>
                    <p>Avg per Evaluation</p>
                  </div>
                  <div class="stat-item">
                    <h3>{{ constraintAnalytics.constraintComplianceRate?.toFixed(1) || '0.0' }}%</h3>
                    <p>Compliance Rate</p>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
      <!-- Agent Performance Comparison -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Agent Performance Comparison</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="agent-comparison">
            <ion-item 
              v-for="agent in analytics?.topPerformingAgents?.slice(0, 10) || []"
              :key="agent.agentName"
              class="agent-item"
            >
              <ion-label>
                <h3>{{ agent.agentName }}</h3>
                <p>{{ agent.evaluationCount }} evaluations</p>
              </ion-label>
              <div slot="end" class="agent-metrics">
                <ion-chip :color="getRatingColor(agent.averageRating)">
                  {{ agent.averageRating.toFixed(1) }} ⭐
                </ion-chip>
                <ion-progress-bar 
                  :value="agent.averageRating / 5" 
                  :color="getRatingColor(agent.averageRating)"
                  style="width: 100px; margin-top: 4px;"
                ></ion-progress-bar>
              </div>
            </ion-item>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Export Actions -->
      <ion-card class="export-actions">
        <ion-card-content>
          <ion-button expand="block" fill="outline" @click="exportDetailedReport">
            <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
            Export Detailed Analytics Report
          </ion-button>
        </ion-card-content>
      </ion-card>
    </div>
  </div>
</template>
<script setup lang="ts">
import { reactive } from 'vue';
// import { useAnalyticsStore } from '@/stores/analyticsStore';
// import { useLLMHealthStore } from '@/stores/llmHealthStore';
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
  IonProgressBar,
  IonChip,
  IonList,
  IonButton
} from '@ionic/vue';
import {
  cardOutline,
  cashOutline,
  trendingUpOutline,
  downloadOutline
} from 'ionicons/icons';
import type { EvaluationAnalytics, WorkflowAnalytics, ConstraintAnalytics } from '@/types/analytics';

interface Props {
  analytics: EvaluationAnalytics;
  workflowAnalytics: WorkflowAnalytics;
  constraintAnalytics: ConstraintAnalytics;
  isLoading: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  refresh: []
}>();
// Enhanced store integration
// Direct store usage
// const analyticsStore = useAnalyticsStore();
// const llmHealthStore = useLLMHealthStore();

// Auto-refresh functionality (simplified)
// const isAutoRefreshEnabled = ref(false);

const analyticsFilters = reactive({
  startDate: '',
  endDate: '',
  userRole: ''
});
function refreshAnalytics() {
  emit('refresh');
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
function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'success';
  if (rating >= 4) return 'primary';
  if (rating >= 3) return 'warning';
  return 'danger';
}
function getEffectivenessColor(score: number): string {
  if (score >= 8) return 'success';
  if (score >= 6) return 'primary';
  if (score >= 4) return 'warning';
  return 'danger';
}
function getCostPerRatingPoint(): number {
  const avgCost = props.analytics?.averageCost || 0;
  const avgRating = props.analytics?.averageRating || 1;
  return avgRating > 0 ? avgCost / avgRating : 0;
}
function exportDetailedReport() {
  // This would trigger a detailed analytics export
  // Implementation would depend on your export service
}
</script>
<style scoped>
.admin-analytics {
  max-width: 1200px;
  margin: 0 auto;
}
.filters-card {
  margin-bottom: 1rem;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.metric-item {
  text-align: center;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}
.metric-item h3 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
}
.metric-item p {
  margin: 0 0 8px 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.cost-metrics {
  margin: 16px 0;
}
.workflow-metric {
  text-align: center;
  padding: 16px;
}
.workflow-metric h3 {
  margin: 0 0 8px 0;
  font-size: 2rem;
  font-weight: 600;
}
.workflow-metric p {
  margin: 0 0 8px 0;
  color: var(--ion-color-medium);
}
.workflow-issues {
  margin-top: 24px;
}
.workflow-issues h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}
.text-small {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
.constraint-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.stat-item {
  text-align: center;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}
.stat-item h3 {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  font-weight: 600;
}
.stat-item p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.agent-comparison {
  max-height: 400px;
  overflow-y: auto;
}
.agent-item {
  margin-bottom: 8px;
}
.agent-metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120px;
}
.export-actions {
  margin-top: 2rem;
}
ion-card {
  margin-bottom: 1rem;
}
@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .metric-item {
    padding: 12px;
  }
  .metric-item h3 {
    font-size: 1.2rem;
  }
  .workflow-metric h3 {
    font-size: 1.5rem;
  }
  .constraint-stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .agent-metrics {
    min-width: 100px;
  }
}
</style>