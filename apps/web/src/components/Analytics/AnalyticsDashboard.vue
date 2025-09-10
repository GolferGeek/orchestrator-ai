<template>
  <div class="analytics-dashboard">
    <!-- Dashboard Header -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="analyticsOutline" />
          Analytics Dashboard
        </ion-card-title>
        <ion-card-subtitle>
          Comprehensive system analytics and insights
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="12" size-md="6">
              <!-- Time Range Selector -->
              <ion-item>
                <ion-select
                  v-model="selectedTimeRange"
                  placeholder="Select Time Range"
                  label="Time Range"
                  label-placement="stacked"
                  @ionChange="updateTimeRange"
                >
                  <ion-select-option value="today">Today</ion-select-option>
                  <ion-select-option value="yesterday">Yesterday</ion-select-option>
                  <ion-select-option value="last7days">Last 7 Days</ion-select-option>
                  <ion-select-option value="last30days">Last 30 Days</ion-select-option>
                  <ion-select-option value="thisMonth">This Month</ion-select-option>
                  <ion-select-option value="lastMonth">Last Month</ion-select-option>
                  <ion-select-option value="custom">Custom Range</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="6">
              <!-- Auto-refresh Control -->
              <ion-item>
                <ion-toggle 
                  v-model="isAutoRefreshEnabled"
                  @ionChange="toggleAutoRefresh"
                >
                  Auto-refresh ({{ autoRefreshInterval / 1000 }}s)
                </ion-toggle>
                <ion-button 
                  fill="outline" 
                  size="small" 
                  @click="refreshNow"
                  :disabled="isLoading"
                  slot="end"
                >
                  <ion-spinner v-if="isLoading" name="crescent" />
                  <ion-icon v-else :icon="refreshOutline" />
                </ion-button>
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Custom Date Range (when selected) -->
    <ion-card v-if="selectedTimeRange === 'custom'">
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-item>
                <ion-input
                  v-model="customStartDate"
                  type="date"
                  label="Start Date"
                  label-placement="stacked"
                  @ion-change="updateCustomRange"
                />
              </ion-item>
            </ion-col>
            <ion-col size="6">
              <ion-item>
                <ion-input
                  v-model="customEndDate"
                  type="date"
                  label="End Date"
                  label-placement="stacked"
                  @ion-change="updateCustomRange"
                />
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Key Metrics Overview -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Key Metrics</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6" size-md="3">
              <div class="metric-card">
                <ion-icon :icon="trendingUpOutline" class="metric-icon success" />
                <div class="metric-content">
                  <h2>{{ formatNumber(keyMetrics.totalRequests) }}</h2>
                  <p>Total Requests</p>
                  <ion-badge 
                    :color="getTrendColor(keyMetrics.requestsTrend)"
                    v-if="keyMetrics.requestsTrend !== undefined"
                  >
                    {{ formatTrend(keyMetrics.requestsTrend) }}
                  </ion-badge>
                </div>
              </div>
            </ion-col>
            <ion-col size="6" size-md="3">
              <div class="metric-card">
                <ion-icon :icon="cashOutline" class="metric-icon primary" />
                <div class="metric-content">
                  <h2>${{ formatCurrency(keyMetrics.totalCost) }}</h2>
                  <p>Total Cost</p>
                  <ion-badge 
                    :color="getTrendColor(keyMetrics.costTrend)"
                    v-if="keyMetrics.costTrend !== undefined"
                  >
                    {{ formatTrend(keyMetrics.costTrend) }}
                  </ion-badge>
                </div>
              </div>
            </ion-col>
            <ion-col size="6" size-md="3">
              <div class="metric-card">
                <ion-icon :icon="speedometerOutline" class="metric-icon warning" />
                <div class="metric-content">
                  <h2>{{ formatDuration(keyMetrics.avgResponseTime) }}</h2>
                  <p>Avg Response Time</p>
                  <ion-badge 
                    :color="getResponseTimeColor(keyMetrics.avgResponseTime)"
                  >
                    {{ getResponseTimeLabel(keyMetrics.avgResponseTime) }}
                  </ion-badge>
                </div>
              </div>
            </ion-col>
            <ion-col size="6" size-md="3">
              <div class="metric-card">
                <ion-icon :icon="checkmarkCircleOutline" class="metric-icon success" />
                <div class="metric-content">
                  <h2>{{ formatPercentage(keyMetrics.successRate) }}</h2>
                  <p>Success Rate</p>
                  <ion-badge 
                    :color="getSuccessRateColor(keyMetrics.successRate)"
                  >
                    {{ getSuccessRateLabel(keyMetrics.successRate) }}
                  </ion-badge>
                </div>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- System Health Status -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="pulseOutline" />
          System Health
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label>
            <h3>Overall Status</h3>
            <p>System health and performance indicators</p>
          </ion-label>
          <ion-badge 
            :color="getHealthColor(systemHealthStatus)"
            slot="end"
            class="health-badge"
          >
            {{ systemHealthStatus.toUpperCase() }}
          </ion-badge>
        </ion-item>
        
        <ion-grid>
          <ion-row>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h3>{{ dashboardData.alerts?.length || 0 }}</h3>
                  <p>Active Alerts</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h3>{{ dashboardData.systemHealth?.totalModels || 0 }}</h3>
                  <p>Total Models</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h3>{{ dashboardData.systemHealth?.healthyModels || 0 }}</h3>
                  <p>Healthy Models</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h3>{{ formatPercentage(dashboardData.systemHealth?.memoryStats?.usagePercent || 0) }}</h3>
                  <p>Memory Usage</p>
                </ion-label>
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Top Performing Models -->
    <ion-card v-if="topPerformingModels.length > 0">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="trophyOutline" />
          Top Performing Models
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-list>
          <ion-item 
            v-for="(model, index) in topPerformingModels.slice(0, 5)" 
            :key="model.modelName"
          >
            <ion-avatar slot="start">
              <div class="rank-badge">{{ index + 1 }}</div>
            </ion-avatar>
            <ion-label>
              <h3>{{ model.modelName }}</h3>
              <p>{{ model.provider }} • {{ formatNumber(model.totalRequests) }} requests</p>
            </ion-label>
            <ion-badge :color="getPerformanceColor(model.performanceScore)" slot="end">
              {{ formatPercentage(model.performanceScore) }}
            </ion-badge>
          </ion-item>
        </ion-list>
      </ion-card-content>
    </ion-card>

    <!-- Recent Activity -->
    <ion-card v-if="recentActivity.length > 0">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="timeOutline" />
          Recent Activity
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-list>
          <ion-item 
            v-for="activity in recentActivity.slice(0, 10)" 
            :key="activity.id"
          >
            <ion-icon 
              :icon="getActivityIcon(activity.type)" 
              :color="getActivityColor(activity.type)"
              slot="start" 
            />
            <ion-label>
              <h3>{{ activity.description }}</h3>
              <p>{{ formatRelativeTime(activity.timestamp) }} • {{ activity.user || 'System' }}</p>
            </ion-label>
            <ion-badge 
              :color="getActivityStatusColor(activity.status)"
              slot="end"
            >
              {{ activity.status }}
            </ion-badge>
          </ion-item>
        </ion-list>
      </ion-card-content>
    </ion-card>

    <!-- Cost Analysis -->
    <ion-card v-if="costAnalysis">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="pieChartOutline" />
          Cost Analysis
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="12" size-md="6">
              <ion-item>
                <ion-label>
                  <h3>Total Cost</h3>
                  <p>${{ formatCurrency(costAnalysis.totalCost) }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <h3>Average Cost per Request</h3>
                  <p>${{ formatCurrency(costAnalysis.avgCostPerRequest) }}</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="6">
              <div class="cost-providers">
                <h4>Top Cost Providers</h4>
                <ion-item 
                  v-for="(cost, provider) in Object.entries(costAnalysis.topCostProviders).slice(0, 3)" 
                  :key="provider"
                >
                  <ion-label>
                    <h3>{{ provider }}</h3>
                    <p>${{ formatCurrency(cost) }}</p>
                  </ion-label>
                  <ion-badge color="primary" slot="end">
                    {{ formatPercentage((cost / costAnalysis.totalCost) * 100) }}
                  </ion-badge>
                </ion-item>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Event Tracking Status -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="layersOutline" />
          Event Tracking
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-item>
                <ion-label>
                  <h3>Queue Size</h3>
                  <p>{{ eventQueueSize }} pending events</p>
                </ion-label>
                <ion-badge 
                  :color="getQueueSizeColor(eventQueueSize)"
                  slot="end"
                >
                  {{ eventQueueSize > 0 ? 'Active' : 'Empty' }}
                </ion-badge>
              </ion-item>
            </ion-col>
            <ion-col size="6">
              <ion-item>
                <ion-label>
                  <h3>Tracking Status</h3>
                  <p>{{ isEventTrackingEnabled ? 'Enabled' : 'Disabled' }}</p>
                </ion-label>
                <ion-toggle 
                  v-model="isEventTrackingEnabled"
                  @ionChange="toggleEventTracking"
                  slot="end"
                />
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
        
        <ion-button 
          expand="block" 
          fill="outline"
          @click="flushEventQueue"
          :disabled="eventQueueSize === 0"
        >
          Flush Event Queue ({{ eventQueueSize }})
        </ion-button>
      </ion-card-content>
    </ion-card>

    <!-- Error Display -->
    <ion-card v-if="hasError" color="danger">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="alertCircleOutline" />
          System Error
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p>{{ firstError }}</p>
        <ion-button fill="outline" @click="clearAllErrors">
          Clear Error
        </ion-button>
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
  IonCardSubtitle,
  IonItem,
  IonLabel,
  IonButton,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonAvatar
} from '@ionic/vue';
import {
  analyticsOutline,
  refreshOutline,
  trendingUpOutline,
  cashOutline,
  speedometerOutline,
  checkmarkCircleOutline,
  pulseOutline,
  trophyOutline,
  timeOutline,
  pieChartOutline,
  layersOutline,
  alertCircleOutline,
  documentTextOutline,
  personOutline,
  settingsOutline,
  warningOutline
} from 'ionicons/icons';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useLLMMonitoringStore } from '@/stores/llmMonitoringStore';

// Store integration
const analyticsStore = useAnalyticsStore();
const llmMonitoringStore = useLLMMonitoringStore();

// Computed properties
const dashboardData = computed(() => analyticsStore.dashboardData);
const systemHealthStatus = computed(() => llmMonitoringStore.systemHealth?.status || 'unknown');
const costAnalysis = computed(() => analyticsStore.costAnalysis);
const isLoading = computed(() => analyticsStore.isLoading || llmMonitoringStore.isLoading);
const hasError = computed(() => !!analyticsStore.error || !!llmMonitoringStore.error);
const firstError = computed(() => analyticsStore.error || llmMonitoringStore.error);

// Auto-refresh functionality
const isAutoRefreshEnabled = ref(false);
const toggleAutoRefresh = () => {
  isAutoRefreshEnabled.value = !isAutoRefreshEnabled.value;
};

const refreshNow = async () => {
  await refreshAll();
};

const refreshAll = async () => {
  await Promise.all([
    analyticsStore.loadDashboardData(),
    llmMonitoringStore.fetchSystemHealth()
  ]);
};

// Reactive data
const selectedTimeRange = ref('last7days');
const customStartDate = ref('');
const customEndDate = ref('');
const autoRefreshInterval = ref(30000); // 30 seconds

// Computed properties from stores
const keyMetrics = computed(() => analyticsStore.keyMetrics || {
  totalRequests: 0,
  totalCost: 0,
  avgResponseTime: 0,
  successRate: 0,
  requestsTrend: 0,
  costTrend: 0
});

const topPerformingModels = computed(() => analyticsStore.topPerformingModels || []);
const recentActivity = computed(() => analyticsStore.recentActivity || []);
const eventQueueSize = computed(() => analyticsStore.eventQueueSize || 0);
const isEventTrackingEnabled = computed({
  get: () => analyticsStore.isEventTrackingEnabled || false,
  set: (value) => {
    if (value) {
      analyticsStore.enableEventTracking();
    } else {
      analyticsStore.disableEventTracking();
    }
  }
});

// Methods
const updateTimeRange = () => {
  analyticsStore.setTimeRange(selectedTimeRange.value);
  if (selectedTimeRange.value !== 'custom') {
    refreshAll();
  }
};

const updateCustomRange = () => {
  if (customStartDate.value && customEndDate.value) {
    analyticsStore.setCustomTimeRange(customStartDate.value, customEndDate.value);
    refreshAll();
  }
};

const toggleEventTracking = () => {
  if (isEventTrackingEnabled.value) {
    analyticsStore.enableEventTracking();
  } else {
    analyticsStore.disableEventTracking();
  }
};

const flushEventQueue = async () => {
  await analyticsStore.flushEventQueue();
};

const clearAllErrors = () => {
  analyticsStore.clearError();
  llmMonitoringStore.clearError();
};

// Formatting helpers
const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatPercentage = (value: number) => {
  return `${Math.round(value)}%`;
};

const formatTrend = (trend: number) => {
  const sign = trend >= 0 ? '+' : '';
  return `${sign}${trend.toFixed(1)}%`;
};

const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Color helpers
const getTrendColor = (trend: number) => {
  if (trend > 0) return 'success';
  if (trend < 0) return 'danger';
  return 'medium';
};

const getResponseTimeColor = (time: number) => {
  if (time < 1000) return 'success';
  if (time < 3000) return 'warning';
  return 'danger';
};

const getResponseTimeLabel = (time: number) => {
  if (time < 1000) return 'Fast';
  if (time < 3000) return 'Moderate';
  return 'Slow';
};

const getSuccessRateColor = (rate: number) => {
  if (rate >= 95) return 'success';
  if (rate >= 85) return 'warning';
  return 'danger';
};

const getSuccessRateLabel = (rate: number) => {
  if (rate >= 95) return 'Excellent';
  if (rate >= 85) return 'Good';
  return 'Needs Attention';
};

const getHealthColor = (status: string) => {
  const colors: Record<string, string> = {
    'healthy': 'success',
    'warning': 'warning',
    'critical': 'danger',
    'unknown': 'medium'
  };
  return colors[status] || 'medium';
};

const getPerformanceColor = (score: number) => {
  if (score >= 90) return 'success';
  if (score >= 75) return 'primary';
  if (score >= 60) return 'warning';
  return 'danger';
};

const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
    'user': personOutline,
    'system': settingsOutline,
    'document': documentTextOutline,
    'warning': warningOutline
  };
  return icons[type] || documentTextOutline;
};

const getActivityColor = (type: string) => {
  const colors: Record<string, string> = {
    'user': 'primary',
    'system': 'secondary',
    'document': 'tertiary',
    'warning': 'warning'
  };
  return colors[type] || 'medium';
};

const getActivityStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'success': 'success',
    'completed': 'success',
    'pending': 'warning',
    'failed': 'danger',
    'error': 'danger'
  };
  return colors[status] || 'medium';
};

const getQueueSizeColor = (size: number) => {
  if (size === 0) return 'success';
  if (size < 100) return 'primary';
  if (size < 500) return 'warning';
  return 'danger';
};

// Initialize on mount
onMounted(async () => {
  await refreshAll();
});
</script>

<style scoped>
.analytics-dashboard {
  padding: 1rem;
}

.metric-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.metric-icon {
  font-size: 2.5rem;
  margin-right: 1rem;
}

.metric-icon.success {
  color: var(--ion-color-success);
}

.metric-icon.primary {
  color: var(--ion-color-primary);
}

.metric-icon.warning {
  color: var(--ion-color-warning);
}

.metric-content h2 {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0 0 0.25rem 0;
}

.metric-content p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.health-badge {
  font-weight: bold;
  font-size: 0.9rem;
}

.rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--ion-color-primary);
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
}

.cost-providers h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-dark);
}

.ion-text-center h3 {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.ion-text-center p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

ion-badge {
  font-size: 0.75rem;
}
</style>
