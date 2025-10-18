<template>
  <div class="llm-routing-dashboard">
    <!-- Routing Overview Cards -->
    <div class="routing-overview">
      <ion-grid>
        <ion-row>
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <div class="metric-icon">
                    <ion-icon :icon="gitNetworkOutline" color="primary"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ totalRoutingDecisions }}</div>
                    <div class="metric-label">Routing Decisions</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <div class="metric-icon">
                    <ion-icon :icon="homeOutline" color="success"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ localRoutingPercentage }}%</div>
                    <div class="metric-label">Local Routing</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <div class="metric-icon">
                    <ion-icon :icon="cloudOutline" color="tertiary"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ cloudRoutingPercentage }}%</div>
                    <div class="metric-label">Cloud Routing</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <div class="metric-icon">
                    <ion-icon :icon="refreshOutline" color="warning"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ fallbackPercentage }}%</div>
                    <div class="metric-label">Fallback Usage</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Charts Section -->
    <div class="routing-charts">
      <ion-grid>
        <ion-row>
          <!-- Routing Distribution Pie Chart -->
          <ion-col size="12" size-md="6">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>Routing Distribution</ion-card-title>
                <ion-card-subtitle>Local vs Cloud routing decisions</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <BaseChart
                  v-if="routingDistributionData.labels.length > 0"
                  :type="'pie'"
                  :data="routingDistributionData"
                  :options="pieChartOptions"
                  :height="300"
                />
                <div v-else class="no-data-message">
                  <ion-icon :icon="pieChartOutline" color="medium"></ion-icon>
                  <p>No routing data available</p>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Complexity Score Distribution -->
          <ion-col size="12" size-md="6">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>Complexity Score Distribution</ion-card-title>
                <ion-card-subtitle>Request complexity analysis</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <BaseChart
                  v-if="complexityDistributionData.labels.length > 0"
                  :type="'bar'"
                  :data="complexityDistributionData"
                  :options="barChartOptions"
                  :height="300"
                />
                <div v-else class="no-data-message">
                  <ion-icon :icon="barChartOutline" color="medium"></ion-icon>
                  <p>No complexity data available</p>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>

        <ion-row>
          <!-- Performance by Route -->
          <ion-col size="12">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>Performance Metrics by Route</ion-card-title>
                <ion-card-subtitle>Response time comparison: Local vs Cloud</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <BaseChart
                  v-if="performanceByRouteData.labels.length > 0"
                  :type="'bar'"
                  :data="performanceByRouteData"
                  :options="performanceChartOptions"
                  :height="400"
                />
                <div v-else class="no-data-message">
                  <ion-icon :icon="speedometerOutline" color="medium"></ion-icon>
                  <p>No performance data available</p>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Routing Reasons Analysis -->
    <div class="routing-reasons">
      <ion-card class="analysis-card">
        <ion-card-header>
          <ion-card-title>Routing Reasons Analysis</ion-card-title>
          <ion-card-subtitle>Why requests were routed to local vs cloud</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div v-if="routingReasons.length > 0" class="reasons-list">
            <div 
              v-for="reason in routingReasons" 
              :key="reason.reason"
              class="reason-item"
            >
              <div class="reason-header">
                <div class="reason-title">
                  <ion-icon 
                    :icon="reason.isLocal ? homeOutline : cloudOutline" 
                    :color="reason.isLocal ? 'success' : 'tertiary'"
                  ></ion-icon>
                  <span>{{ reason.reason || 'No reason specified' }}</span>
                </div>
                <div class="reason-stats">
                  <span class="count">{{ reason.count }} requests</span>
                  <span class="percentage">({{ reason.percentage }}%)</span>
                </div>
              </div>
              <div class="reason-details">
                <div class="detail-item">
                  <span class="detail-label">Avg Response Time:</span>
                  <span class="detail-value">{{ reason.avgDuration }}ms</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Success Rate:</span>
                  <span class="detail-value">{{ reason.successRate }}%</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Avg Complexity:</span>
                  <span class="detail-value">{{ reason.avgComplexity }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-data-message">
            <ion-icon :icon="listOutline" color="medium"></ion-icon>
            <p>No routing reason data available</p>
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Routing Rules Management -->
    <div class="routing-rules">
      <ion-card class="rules-card">
        <ion-card-header>
          <ion-card-title>
            Routing Rules Management
            <ion-button fill="clear" size="small" @click="showRulesEditor = !showRulesEditor">
              <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
              {{ showRulesEditor ? 'Hide' : 'Configure' }}
            </ion-button>
          </ion-card-title>
          <ion-card-subtitle>View and manage routing decision rules</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div v-if="showRulesEditor" class="rules-editor">
            <ion-item>
              <ion-label position="stacked">Complexity Threshold for Cloud Routing</ion-label>
              <ion-input 
                v-model="routingRules.complexityThreshold" 
                type="number" 
                min="0" 
                max="10" 
                step="0.1"
                placeholder="5.0"
              ></ion-input>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Local Model Availability</ion-label>
              <ion-toggle v-model="routingRules.localModelEnabled">
                {{ routingRules.localModelEnabled ? 'Enabled' : 'Disabled' }}
              </ion-toggle>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Fallback Strategy</ion-label>
              <ion-select v-model="routingRules.fallbackStrategy">
                <ion-select-option value="cloud">Always fallback to cloud</ion-select-option>
                <ion-select-option value="local">Prefer local fallback</ion-select-option>
                <ion-select-option value="none">No fallback</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="rules-actions">
              <ion-button fill="solid" @click="saveRoutingRules" :disabled="savingRules">
                <ion-icon :icon="saveOutline" slot="start"></ion-icon>
                {{ savingRules ? 'Saving...' : 'Save Rules' }}
              </ion-button>
              <ion-button fill="outline" @click="testRoutingRules">
                <ion-icon :icon="playOutline" slot="start"></ion-icon>
                Test Rules
              </ion-button>
            </div>
          </div>
          <div v-else class="rules-summary">
            <div class="rule-item">
              <span class="rule-label">Complexity Threshold:</span>
              <span class="rule-value">{{ routingRules.complexityThreshold }}</span>
            </div>
            <div class="rule-item">
              <span class="rule-label">Local Model:</span>
              <span class="rule-value">{{ routingRules.localModelEnabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <div class="rule-item">
              <span class="rule-label">Fallback Strategy:</span>
              <span class="rule-value">{{ routingRules.fallbackStrategy }}</span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonCardHeader, 
  IonCardTitle, IonCardSubtitle, IonIcon, IonButton, IonItem, 
  IonLabel, IonInput, IonToggle, IonSelect, IonSelectOption
} from '@ionic/vue';
import {
  gitNetworkOutline, homeOutline, cloudOutline, refreshOutline,
  pieChartOutline, barChartOutline, speedometerOutline, listOutline,
  settingsOutline, saveOutline, playOutline
} from 'ionicons/icons';

import BaseChart from '@/components/Charts/BaseChart.vue';
import { useLlmUsageStore } from '@/stores/llmUsageStore';

// Props
const props = defineProps<{
  timeRange: string;
  provider: string;
}>();

// Store
const llmUsageStore = useLlmUsageStore();

// Local state
const showRulesEditor = ref(false);
const savingRules = ref(false);
const routingRules = ref({
  complexityThreshold: 5.0,
  localModelEnabled: true,
  fallbackStrategy: 'cloud'
});

// Computed - Routing Metrics
const usageRecords = computed(() => llmUsageStore.usageRecords);

const totalRoutingDecisions = computed(() => usageRecords.value.length);

const localRoutingPercentage = computed(() => {
  if (usageRecords.value.length === 0) return 0;
  const localCount = usageRecords.value.filter(r => r.is_local).length;
  return Math.round((localCount / usageRecords.value.length) * 100);
});

const cloudRoutingPercentage = computed(() => {
  return Math.max(0, 100 - localRoutingPercentage.value);
});

const fallbackPercentage = computed(() => {
  if (usageRecords.value.length === 0) return 0;
  const fallbackCount = usageRecords.value.filter(r => r.fallback_used).length;
  return Math.round((fallbackCount / usageRecords.value.length) * 100);
});

// Computed - Chart Data
const routingDistributionData = computed(() => {
  const localCount = usageRecords.value.filter(r => r.is_local).length;
  const cloudCount = usageRecords.value.length - localCount;
  
  if (localCount === 0 && cloudCount === 0) {
    return { labels: [], datasets: [] };
  }
  
  return {
    labels: ['Local', 'Cloud'],
    datasets: [{
      data: [localCount, cloudCount],
      backgroundColor: [
        'rgba(40, 167, 69, 0.8)',   // Green for local
        'rgba(23, 162, 184, 0.8)'   // Blue for cloud
      ],
      borderColor: [
        'rgba(40, 167, 69, 1)',
        'rgba(23, 162, 184, 1)'
      ],
      borderWidth: 2
    }]
  };
});

const complexityDistributionData = computed(() => {
  const recordsWithComplexity = usageRecords.value.filter(r => r.complexity_score !== null);
  
  if (recordsWithComplexity.length === 0) {
    return { labels: [], datasets: [] };
  }
  
  // Create complexity buckets
  const buckets = {
    'Low (0-3)': 0,
    'Medium (3-6)': 0,
    'High (6-8)': 0,
    'Very High (8-10)': 0
  };
  
  recordsWithComplexity.forEach(record => {
    const score = record.complexity_score!;
    if (score <= 3) buckets['Low (0-3)']++;
    else if (score <= 6) buckets['Medium (3-6)']++;
    else if (score <= 8) buckets['High (6-8)']++;
    else buckets['Very High (8-10)']++;
  });
  
  return {
    labels: Object.keys(buckets),
    datasets: [{
      label: 'Request Count',
      data: Object.values(buckets),
      backgroundColor: [
        'rgba(40, 167, 69, 0.8)',   // Green for low
        'rgba(255, 193, 7, 0.8)',   // Yellow for medium
        'rgba(253, 126, 20, 0.8)',  // Orange for high
        'rgba(220, 53, 69, 0.8)'    // Red for very high
      ],
      borderColor: [
        'rgba(40, 167, 69, 1)',
        'rgba(255, 193, 7, 1)',
        'rgba(253, 126, 20, 1)',
        'rgba(220, 53, 69, 1)'
      ],
      borderWidth: 2
    }]
  };
});

const performanceByRouteData = computed(() => {
  const localRecords = usageRecords.value.filter(r => r.is_local && r.duration_ms);
  const cloudRecords = usageRecords.value.filter(r => !r.is_local && r.duration_ms);
  
  if (localRecords.length === 0 && cloudRecords.length === 0) {
    return { labels: [], datasets: [] };
  }
  
  const localAvgDuration = localRecords.length > 0 
    ? Math.round(localRecords.reduce((sum, r) => sum + r.duration_ms!, 0) / localRecords.length)
    : 0;
    
  const cloudAvgDuration = cloudRecords.length > 0
    ? Math.round(cloudRecords.reduce((sum, r) => sum + r.duration_ms!, 0) / cloudRecords.length)
    : 0;
    
  const localSuccessRate = localRecords.length > 0
    ? Math.round((localRecords.filter(r => r.status === 'completed').length / localRecords.length) * 100)
    : 0;
    
  const cloudSuccessRate = cloudRecords.length > 0
    ? Math.round((cloudRecords.filter(r => r.status === 'completed').length / cloudRecords.length) * 100)
    : 0;
  
  return {
    labels: ['Average Response Time (ms)', 'Success Rate (%)'],
    datasets: [
      {
        label: 'Local',
        data: [localAvgDuration, localSuccessRate],
        backgroundColor: 'rgba(40, 167, 69, 0.8)',
        borderColor: 'rgba(40, 167, 69, 1)',
        borderWidth: 2
      },
      {
        label: 'Cloud',
        data: [cloudAvgDuration, cloudSuccessRate],
        backgroundColor: 'rgba(23, 162, 184, 0.8)',
        borderColor: 'rgba(23, 162, 184, 1)',
        borderWidth: 2
      }
    ]
  };
});

const routingReasons = computed(() => {
  const reasonMap = new Map();
  
  usageRecords.value.forEach(record => {
    const reason = record.routing_reason || 'No reason specified';
    const key = `${reason}_${record.is_local}`;
    
    if (!reasonMap.has(key)) {
      reasonMap.set(key, {
        reason,
        isLocal: record.is_local,
        count: 0,
        totalDuration: 0,
        successCount: 0,
        complexitySum: 0,
        complexityCount: 0
      });
    }
    
    const data = reasonMap.get(key);
    data.count++;
    if (record.duration_ms) data.totalDuration += record.duration_ms;
    if (record.status === 'completed') data.successCount++;
    if (record.complexity_score) {
      data.complexitySum += record.complexity_score;
      data.complexityCount++;
    }
  });
  
  return Array.from(reasonMap.values())
    .map(data => ({
      ...data,
      percentage: Math.round((data.count / usageRecords.value.length) * 100),
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      successRate: data.count > 0 ? Math.round((data.successCount / data.count) * 100) : 0,
      avgComplexity: data.complexityCount > 0 ? (data.complexitySum / data.complexityCount).toFixed(1) : 'N/A'
    }))
    .sort((a, b) => b.count - a.count);
});

// Chart Options
const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context: { label?: string; parsed: number; dataset: { data: number[] } }) {
          const label = context.label || '';
          const value = context.parsed;
          const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
          const percentage = Math.round((value / total) * 100);
          return `${label}: ${value} (${percentage}%)`;
        }
      }
    }
  }
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0
      }
    }
  }
};

const performanceChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

// Methods
const saveRoutingRules = async () => {
  savingRules.value = true;
  try {
    // TODO: Implement API call to save routing rules
    console.log('Saving routing rules:', routingRules.value);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
  } catch (error) {
    console.error('Failed to save routing rules:', error);
  } finally {
    savingRules.value = false;
  }
};

const testRoutingRules = () => {
  // TODO: Implement routing rules testing
  console.log('Testing routing rules:', routingRules.value);
};

// Watch for prop changes to refresh data
watch(() => [props.timeRange, props.provider], () => {
  // Data will be automatically updated through the store reactivity
});

// Lifecycle
onMounted(() => {
  // Data is already loaded through the parent component
});
</script>

<style scoped>
.llm-routing-dashboard {
  padding: 1rem 0;
}

.routing-overview {
  margin-bottom: 2rem;
}

.metric-card {
  height: 100%;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.metric-icon {
  font-size: 2rem;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.metric-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.routing-charts {
  margin-bottom: 2rem;
}

.chart-card {
  height: 100%;
}

.no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.no-data-message ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.routing-reasons {
  margin-bottom: 2rem;
}

.reasons-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reason-item {
  padding: 1rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 0.5rem;
  background: var(--ion-color-light-tint);
}

.reason-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.reason-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.reason-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.count {
  font-weight: 600;
}

.percentage {
  color: var(--ion-color-medium);
}

.reason-details {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-weight: 600;
}

.routing-rules {
  margin-bottom: 2rem;
}

.rules-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rules-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.rules-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.rule-item:last-child {
  border-bottom: none;
}

.rule-label {
  font-weight: 500;
  color: var(--ion-color-medium);
}

.rule-value {
  font-weight: 600;
}

/* Mobile Responsiveness */
@media (max-width: 48rem) {
  .reason-details {
    gap: 1rem;
  }
  
  .rules-actions {
    flex-direction: column;
  }
  
  .reason-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
