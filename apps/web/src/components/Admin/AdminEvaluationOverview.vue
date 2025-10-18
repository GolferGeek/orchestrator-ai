<template>
  <div class="admin-overview">
    <!-- Loading State -->
    <div v-if="isLoading" class="ion-text-center ion-padding">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading analytics...</p>
    </div>
    <!-- Analytics Cards -->
    <div v-else-if="analytics">
      <!-- Key Metrics Row -->
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ analytics.totalEvaluations }}</h2>
                <p>Total Evaluations</p>
                <ion-icon :icon="barChartOutline" color="primary" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ analytics.averageRating.toFixed(1) }}</h2>
                <p>Average Rating</p>
                <ion-icon :icon="starOutline" color="warning" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>{{ Math.round(analytics.averageWorkflowCompletionRate) }}%</h2>
                <p>Workflow Success</p>
                <ion-icon :icon="checkmarkCircleOutline" color="success" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6" size-lg="3">
            <ion-card class="metric-card">
              <ion-card-content class="ion-text-center">
                <h2>${{ analytics.averageCost.toFixed(4) }}</h2>
                <p>Avg Cost</p>
                <ion-icon :icon="cardOutline" color="medium" size="large"></ion-icon>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
      <!-- Rating Distribution Chart -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Rating Distribution</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="rating-chart">
            <div 
              v-for="(count, rating) in analytics.ratingDistribution" 
              :key="rating"
              class="rating-bar"
            >
              <div class="rating-label">{{ rating }} ⭐</div>
              <div class="rating-bar-container">
                <div 
                  class="rating-bar-fill"
                  :style="{ width: `${(count / analytics.totalEvaluations) * 100}%` }"
                ></div>
              </div>
              <div class="rating-count">{{ count }}</div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
      <!-- Top Performing Agents -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Top Performing Agents</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="agent in analytics.topPerformingAgents.slice(0, 5)"
              :key="agent.agentName"
            >
              <ion-label>
                <h3>{{ agent.agentName }}</h3>
                <p>{{ agent.evaluationCount }} evaluations</p>
              </ion-label>
              <ion-chip slot="end" :color="getRatingColor(agent.averageRating)">
                {{ agent.averageRating.toFixed(1) }} ⭐
              </ion-chip>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Most Effective Constraints -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Most Effective Constraints</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="constraint in analytics.topConstraints.slice(0, 5)"
              :key="constraint.constraintName"
            >
              <ion-label>
                <h3>{{ constraint.constraintName }}</h3>
                <p>Used {{ constraint.usageCount }} times</p>
              </ion-label>
              <ion-chip slot="end" color="success">
                {{ constraint.effectivenessScore.toFixed(1) }}
              </ion-chip>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Workflow Failure Points -->
      <ion-card v-if="analytics.workflowFailurePoints.length > 0">
        <ion-card-header>
          <ion-card-title>Common Workflow Issues</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="failure in analytics.workflowFailurePoints.slice(0, 5)"
              :key="failure.stepName"
            >
              <ion-label>
                <h3>{{ failure.stepName }}</h3>
                <p>Avg duration: {{ Math.round(failure.averageDuration) }}ms</p>
              </ion-label>
              <ion-chip slot="end" color="danger">
                {{ failure.failureRate.toFixed(1) }}% fail
              </ion-chip>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Performance Metrics -->
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="6">
            <ion-card>
              <ion-card-header>
                <ion-card-title>Response Performance</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-item lines="none">
                  <ion-label>
                    <h3>Speed Rating</h3>
                    <p>{{ analytics.averageSpeedRating.toFixed(1) }}/5</p>
                  </ion-label>
                  <ion-icon :icon="timerOutline" slot="end" color="primary"></ion-icon>
                </ion-item>
                <ion-item lines="none">
                  <ion-label>
                    <h3>Accuracy Rating</h3>
                    <p>{{ analytics.averageAccuracyRating.toFixed(1) }}/5</p>
                  </ion-label>
                  <ion-icon :icon="radioButtonOnOutline" slot="end" color="success"></ion-icon>
                </ion-item>
                <ion-item lines="none">
                  <ion-label>
                    <h3>Avg Response Time</h3>
                    <p>{{ Math.round(analytics.averageResponseTime) }}ms</p>
                  </ion-label>
                  <ion-icon :icon="timeOutline" slot="end" color="warning"></ion-icon>
                </ion-item>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6">
            <ion-card>
              <ion-card-header>
                <ion-card-title>Quick Actions</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-button expand="block" fill="outline" @click="$emit('refresh')">
                  <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
                  Refresh Data
                </ion-button>
                <ion-button expand="block" fill="outline" color="secondary">
                  <ion-icon :icon="analyticsOutline" slot="start"></ion-icon>
                  View Detailed Analytics
                </ion-button>
                <ion-button expand="block" fill="outline" color="tertiary">
                  <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
                  Export Report
                </ion-button>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>
    <!-- Empty State -->
    <ion-card v-else class="ion-text-center">
      <ion-card-content>
        <ion-icon :icon="barChartOutline" size="large" color="medium"></ion-icon>
        <h3>No Analytics Data</h3>
        <p>No evaluation data available to display analytics.</p>
        <ion-button fill="clear" @click="$emit('refresh')">
          Refresh Data
        </ion-button>
      </ion-card-content>
    </ion-card>
  </div>
</template>
<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonButton
} from '@ionic/vue';
import {
  barChartOutline,
  starOutline,
  checkmarkCircleOutline,
  cardOutline,
  timerOutline,
  radioButtonOnOutline,
  timeOutline,
  refreshOutline,
  analyticsOutline,
  downloadOutline
} from 'ionicons/icons';
import type { EvaluationAnalytics } from '@/types/analytics';

interface Props {
  analytics: EvaluationAnalytics;
  isLoading: boolean;
}
defineProps<Props>();
defineEmits<{
  refresh: []
}>();
function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'success';
  if (rating >= 4) return 'primary';
  if (rating >= 3) return 'warning';
  return 'danger';
}
</script>
<style scoped>
.admin-overview {
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
.rating-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}
.rating-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rating-label {
  width: 60px;
  font-weight: 500;
}
.rating-bar-container {
  flex: 1;
  height: 24px;
  background: var(--ion-color-light);
  border-radius: 12px;
  overflow: hidden;
}
.rating-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-warning), var(--ion-color-warning-shade));
  transition: width 0.3s ease;
}
.rating-count {
  width: 40px;
  text-align: right;
  font-weight: 500;
  color: var(--ion-color-dark);
}
ion-card {
  margin-bottom: 1rem;
}
@media (max-width: 768px) {
  .metric-card h2 {
    font-size: 1.5rem;
  }
  .rating-bar {
    gap: 8px;
  }
  .rating-label {
    width: 50px;
    font-size: 0.9rem;
  }
  .rating-count {
    width: 30px;
    font-size: 0.9rem;
  }
}
</style>