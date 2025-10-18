<template>
  <div class="llm-analytics">
    <!-- Analytics Filters -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="trendingUpOutline" />
          Analytics Overview
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-input
                  v-model="localFilters.startDate"
                  type="date"
                  label="Start Date"
                  label-placement="stacked"
                  @ion-change="applyFilters"
                />
              </ion-item>
            </ion-col>
            
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-input
                  v-model="localFilters.endDate"
                  type="date"
                  label="End Date"
                  label-placement="stacked"
                  @ion-change="applyFilters"
                />
              </ion-item>
            </ion-col>
            
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-select
                  v-model="localFilters.callerType"
                  placeholder="All Caller Types"
                  label="Caller Type"
                  label-placement="stacked"
                  interface="popover"
                  @ion-change="applyFilters"
                >
                  <ion-select-option value="">All Types</ion-select-option>
                  <ion-select-option 
                    v-for="type in callerTypes" 
                    :key="type" 
                    :value="type"
                  >
                    {{ type }}
                  </ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>
          </ion-row>
          <ion-row>
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-select
                  v-model="localFilters.route"
                  placeholder="All Routes"
                  label="Route"
                  label-placement="stacked"
                  interface="popover"
                  @ion-change="applyFilters"
                >
                  <ion-select-option value="">All Routes</ion-select-option>
                  <ion-select-option value="local">Local</ion-select-option>
                  <ion-select-option value="remote">Remote</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="4">
              <ion-button expand="block" fill="outline" @click="applyPresetLocal7d">
                Local last 7 days
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Key Metrics Cards -->
    <div class="metrics-grid">
      <ion-grid>
        <ion-row>
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="layersOutline" color="primary" size="large" />
                  <div class="metric-info">
                    <div class="metric-value">{{ totalRequests }}</div>
                    <div class="metric-label">Total Requests</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="cashOutline" color="success" size="large" />
                  <div class="metric-info">
                    <div class="metric-value">{{ formatCurrency(totalCost) }}</div>
                    <div class="metric-label">Total Cost</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="checkmarkCircleOutline" color="success" size="large" />
                  <div class="metric-info">
                    <div class="metric-value">{{ overallSuccessRate }}%</div>
                    <div class="metric-label">Success Rate</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="timeOutline" color="warning" size="large" />
                  <div class="metric-info">
                    <div class="metric-value">{{ formatDuration(avgDuration) }}</div>
                    <div class="metric-label">Avg Duration</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <!-- Daily Usage Chart -->
  <ion-card>
    <ion-card-header>
      <ion-card-title>Daily Usage Trends</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div class="chart-container">
        <div class="chart-placeholder">
          <!-- This would be where you'd integrate a charting library like Chart.js or ApexCharts -->
          <div class="chart-mock">
            <div v-for="(item, index) in chartData" :key="index" class="chart-bar">
              <div 
                class="bar" 
                :style="{ height: `${(item.total_requests / maxRequests) * 100}%` }"
                :title="`${item.date}: ${item.total_requests} requests`"
              ></div>
              <div class="bar-label">{{ formatChartDate(item.date) }}</div>
            </div>
          </div>
        </div>
      </div>
    </ion-card-content>
  </ion-card>

  <!-- Route Trend (Daily) -->
  <ion-card>
    <ion-card-header>
      <ion-card-title>Route Trends (Local vs Remote)</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div class="chart-container">
        <div class="chart-placeholder">
          <div class="chart-mock grouped">
            <div v-for="(day, idx) in routeTrendDays" :key="idx" class="chart-bar route-group">
              <div class="bar bar-local" :style="{ height: `${routeMax > 0 ? (routeLocalCounts[day] || 0) / routeMax * 100 : 0}%` }" :title="`${day}: ${routeLocalCounts[day] || 0} local`"></div>
              <div class="bar bar-remote" :style="{ height: `${routeMax > 0 ? (routeRemoteCounts[day] || 0) / routeMax * 100 : 0}%` }" :title="`${day}: ${routeRemoteCounts[day] || 0} remote`"></div>
              <div class="bar-label">{{ formatChartDate(day) }}</div>
            </div>
          </div>
        </div>
      </div>
    </ion-card-content>
  </ion-card>

      <!-- Caller Type Breakdown -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Usage by Caller Type</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="breakdown-grid">
            <div 
              v-for="breakdown in callerTypeBreakdown" 
              :key="breakdown.callerType"
              class="breakdown-item"
            >
              <div class="breakdown-header">
                <ion-icon 
                  :icon="getCallerIcon(breakdown.callerType)" 
                  :color="getCallerColor(breakdown.callerType)"
                />
                <span class="breakdown-title">{{ breakdown.callerType }}</span>
              </div>
              <div class="breakdown-stats">
                <div class="stat-row">
                  <span>Requests:</span>
                  <span class="stat-value">{{ breakdown.totalRequests }}</span>
                </div>
                <div class="stat-row">
                  <span>Success Rate:</span>
                  <span class="stat-value">{{ breakdown.successRate }}%</span>
                </div>
                <div class="stat-row">
                  <span>Avg Cost:</span>
                  <span class="stat-value">{{ formatCurrency(breakdown.avgCost) }}</span>
                </div>
                <div class="stat-row">
                  <span>Avg Duration:</span>
                  <span class="stat-value">{{ formatDuration(breakdown.avgDuration) }}</span>
                </div>
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Model Performance -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Model Performance</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="model-performance">
            <ion-grid>
              <ion-row>
                <ion-col size="6">
                  <div class="performance-metric">
                    <h4>Local vs External</h4>
                    <div class="metric-split">
                      <div class="split-item">
                        <div class="split-label">Local Models</div>
                        <div class="split-value">{{ localRequests }} requests</div>
                        <div class="split-percentage">{{ localPercentage }}%</div>
                      </div>
                      <div class="split-item">
                        <div class="split-label">External Models</div>
                        <div class="split-value">{{ externalRequests }} requests</div>
                        <div class="split-percentage">{{ externalPercentage }}%</div>
                      </div>
                    </div>
                  </div>
                </ion-col>
                
                <ion-col size="6">
                  <div class="performance-metric">
                    <h4>Token Usage</h4>
                    <div class="token-stats">
                      <div class="token-item">
                        <span>Total Input:</span>
                        <span class="token-value">{{ formatTokens(totalInputTokens) }}</span>
                      </div>
                      <div class="token-item">
                        <span>Total Output:</span>
                        <span class="token-value">{{ formatTokens(totalOutputTokens) }}</span>
                      </div>
                      <div class="token-item">
                        <span>Avg Input/Request:</span>
                        <span class="token-value">{{ formatTokens(avgInputTokens) }}</span>
                      </div>
                      <div class="token-item">
                        <span>Avg Output/Request:</span>
                        <span class="token-value">{{ formatTokens(avgOutputTokens) }}</span>
                      </div>
                    </div>
                  </div>
                </ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ion-spinner name="crescent" />
      <p>Loading analytics...</p>
    </div>

    <!-- Empty State -->
    <ion-card v-else-if="analytics.length === 0" class="empty-analytics">
      <ion-card-content>
        <div class="empty-state">
          <ion-icon :icon="analyticsOutline" size="large" />
          <h3>No Analytics Data</h3>
          <p>No analytics data available for the selected time period.</p>
        </div>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
  IonIcon,
  IonSpinner
} from '@ionic/vue';
import {
  trendingUpOutline,
  layersOutline,
  cashOutline,
  checkmarkCircleOutline,
  timeOutline,
  analyticsOutline,
} from 'ionicons/icons';

import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { llmAnalyticsService } from '@/services/llmAnalyticsService';
// import { useAnalyticsStore } from '@/stores/analyticsStore';
// import { useLLMHealthStore } from '@/stores/llmHealthStore';
import { storeToRefs } from 'pinia';

const store = useLLMAnalyticsStore();
// const llmHealthStore = useLLMHealthStore();
// const analyticsStore = useAnalyticsStore();

// Reactive data
const localFilters = ref<{ startDate: string; endDate: string; callerType: string; route: '' | 'local' | 'remote' }>({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  callerType: '',
  route: ''
});

// Computed - Use storeToRefs to maintain reactivity
const { analytics, loading, callerTypes } = storeToRefs(store);

const totalRequests = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.total_requests, 0) || 0;
});

const totalCost = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.total_cost, 0) || 0;
});

const overallSuccessRate = computed(() => {
  if (totalRequests.value === 0) return 0;
  const totalSuccessful = analytics.value?.reduce((sum, item) => sum + item.successful_requests, 0) || 0;
  return Math.round((totalSuccessful / totalRequests.value) * 100);
});

const avgDuration = computed(() => {
  if (!analytics.value || analytics.value.length === 0) return 0;
  const totalDuration = analytics.value.reduce((sum, item) => sum + item.avg_duration_ms, 0);
  return totalDuration / analytics.value.length;
});

const chartData = computed(() => {
  return analytics.value?.filter(item => item.date).sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateA.localeCompare(dateB);
  }) || [];
});

const maxRequests = computed(() => {
  return Math.max(...(analytics.value?.map(item => item.total_requests) || []), 1);
});

interface AnalyticsDataPoint {
  date: string;
  [key: string]: unknown;
}

// Route trend data (client-side fetch of local/remote analytics)
const localAnalytics = ref<AnalyticsDataPoint[]>([]);
const remoteAnalytics = ref<AnalyticsDataPoint[]>([]);

const routeLocalCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  for (const item of localAnalytics.value || []) {
    if (!item?.date) continue;
    map[item.date] = (map[item.date] || 0) + (item.total_requests || 0);
  }
  return map;
});

const routeRemoteCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  for (const item of remoteAnalytics.value || []) {
    if (!item?.date) continue;
    map[item.date] = (map[item.date] || 0) + (item.total_requests || 0);
  }
  return map;
});

const routeTrendDays = computed<string[]>(() => {
  const days = new Set<string>([
    ...Object.keys(routeLocalCounts.value),
    ...Object.keys(routeRemoteCounts.value),
  ]);
  return Array.from(days).sort();
});

const routeMax = computed(() => {
  let max = 1;
  for (const d of routeTrendDays.value) {
    max = Math.max(max, (routeLocalCounts.value[d] || 0), (routeRemoteCounts.value[d] || 0));
  }
  return max;
});

const callerTypeBreakdown = computed(() => {
  const breakdown = new Map();
  
  analytics.value?.forEach(item => {
    if (!breakdown.has(item.caller_type)) {
      breakdown.set(item.caller_type, {
        callerType: item.caller_type,
        totalRequests: 0,
        successfulRequests: 0,
        totalCost: 0,
        totalDuration: 0,
        count: 0
      });
    }
    
    const entry = breakdown.get(item.caller_type);
    entry.totalRequests += item.total_requests;
    entry.successfulRequests += item.successful_requests;
    entry.totalCost += item.total_cost;
    entry.totalDuration += item.avg_duration_ms;
    entry.count++;
  });
  
  return Array.from(breakdown.values()).map(entry => ({
    ...entry,
    successRate: entry.totalRequests > 0 ? Math.round((entry.successfulRequests / entry.totalRequests) * 100) : 0,
    avgCost: entry.count > 0 ? entry.totalCost / entry.count : 0,
    avgDuration: entry.count > 0 ? entry.totalDuration / entry.count : 0
  }));
});

const localRequests = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.local_requests, 0) || 0;
});

const externalRequests = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.external_requests, 0) || 0;
});

const localPercentage = computed(() => {
  if (totalRequests.value === 0) return 0;
  return Math.round((localRequests.value / totalRequests.value) * 100);
});

const externalPercentage = computed(() => {
  if (totalRequests.value === 0) return 0;
  return Math.round((externalRequests.value / totalRequests.value) * 100);
});

const totalInputTokens = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.total_input_tokens, 0) || 0;
});

const totalOutputTokens = computed(() => {
  return analytics.value?.reduce((sum, item) => sum + item.total_output_tokens, 0) || 0;
});

const avgInputTokens = computed(() => {
  return totalRequests.value > 0 ? Math.round(totalInputTokens.value / totalRequests.value) : 0;
});

const avgOutputTokens = computed(() => {
  return totalRequests.value > 0 ? Math.round(totalOutputTokens.value / totalRequests.value) : 0;
});

// Methods
const applyFilters = () => {
  const filters = { ...localFilters.value };
  // Remove empty strings
  Object.keys(filters).forEach(key => {
    if (filters[key as keyof typeof filters] === '') {
      delete filters[key as keyof typeof filters];
    }
  });
  
  store.updateAnalyticsFilters(filters);
  store.fetchAnalytics();
  // Local fetch for route trend
  fetchRouteTrend(filters);
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4
  }).format(amount);
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTokens = (tokens: number) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
};

const formatChartDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getCallerIcon = (callerType: string) => {
  return llmAnalyticsService.getCallerTypeIcon(callerType);
};

const getCallerColor = (callerType: string) => {
  switch (callerType.toLowerCase()) {
    case 'agent': return 'success';
    case 'api': return 'primary';
    case 'user': return 'secondary';
    case 'system': return 'warning';
    case 'service': return 'tertiary';
    default: return 'medium';
  }
};

// Lifecycle
onMounted(() => {
  store.fetchAnalytics(localFilters.value);
  fetchRouteTrend(localFilters.value);
});

async function fetchRouteTrend(base: { startDate?: string; endDate?: string; callerType?: string; route?: 'local' | 'remote' | '' }) {
  const { startDate, endDate, callerType } = base || {};
  // Local
  localAnalytics.value = await llmAnalyticsService.getUsageAnalytics({ startDate, endDate, callerType, route: 'local' });
  // Remote
  remoteAnalytics.value = await llmAnalyticsService.getUsageAnalytics({ startDate, endDate, callerType, route: 'remote' });
}

function applyPresetLocal7d() {
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = new Date().toISOString().split('T')[0];
  localFilters.value.startDate = start;
  localFilters.value.endDate = end;
  localFilters.value.route = 'local';
  applyFilters();
}
</script>

<style scoped>
.llm-analytics {
  padding: 16px;
}

.metrics-grid {
  margin: 16px 0;
}

.metric-card {
  height: 100%;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.metric-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.charts-section {
  margin-top: 24px;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
}

.chart-mock {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 200px;
  width: 100%;
  max-width: 600px;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar {
  background: linear-gradient(to top, var(--ion-color-primary), var(--ion-color-primary-tint));
  width: 100%;
  min-height: 4px;
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.bar:hover {
  background: linear-gradient(to top, var(--ion-color-primary-shade), var(--ion-color-primary));
}

.bar-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-top: 8px;
  text-align: center;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.breakdown-item {
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  padding: 16px;
}

.breakdown-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.breakdown-title {
  font-weight: 600;
  text-transform: capitalize;
}

.breakdown-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-value {
  font-weight: 500;
  color: var(--ion-color-primary);
}

.model-performance {
  margin-top: 16px;
}

.performance-metric h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-dark);
}

.metric-split {
  display: flex;
  gap: 24px;
}

.split-item {
  flex: 1;
  text-align: center;
  padding: 16px;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
}

.split-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.split-value {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.split-percentage {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.token-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid var(--ion-color-light);
  border-radius: 6px;
}

.token-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
}

.empty-analytics {
  margin-top: 24px;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  margin-bottom: 16px;
  color: var(--ion-color-light);
}

@media (max-width: 768px) {
  .metric-split {
    flex-direction: column;
    gap: 12px;
  }
  
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-mock {
    height: 150px;
  }
}
</style>
