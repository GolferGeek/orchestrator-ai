<template>
  <div class="privacy-metrics-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <h2>Privacy Metrics Dashboard</h2>
      <div class="header-controls">
        <ion-button fill="outline" size="small" @click="refreshData" data-testid="refresh-button">
          <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
          Refresh
        </ion-button>
        <ion-button fill="clear" size="small" @click="showFilters = !showFilters">
          <ion-icon :icon="optionsOutline" slot="start"></ion-icon>
          Filters
        </ion-button>
      </div>
    </div>

    <!-- Time Range Filter -->
    <ion-card v-if="showFilters" class="filter-card">
      <ion-card-content>
        <div class="filter-controls">
          <div class="filter-group">
            <ion-label>Time Range:</ion-label>
            <ion-select v-model="selectedTimeRange" placeholder="Select Range" data-testid="time-range-filter">
              <ion-select-option value="24h">Last 24 Hours</ion-select-option>
              <ion-select-option value="7d">Last 7 Days</ion-select-option>
              <ion-select-option value="30d">Last 30 Days</ion-select-option>
              <ion-select-option value="90d">Last 90 Days</ion-select-option>
            </ion-select>
          </div>
          <div class="filter-group">
            <ion-label>Data Type:</ion-label>
            <ion-select v-model="selectedDataType" placeholder="All Types" data-testid="data-type-filter">
              <ion-select-option value="all">All Types</ion-select-option>
              <ion-select-option value="email">Email</ion-select-option>
              <ion-select-option value="phone">Phone</ion-select-option>
              <ion-select-option value="name">Name</ion-select-option>
              <ion-select-option value="ssn">SSN</ion-select-option>
              <ion-select-option value="api_key">API Key</ion-select-option>
            </ion-select>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Key Metrics Overview -->
    <div class="metrics-overview">
      <ion-grid>
        <ion-row>
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="eyeOutline" color="primary" size="large"></ion-icon>
                  <div class="metric-info">
                    <div class="metric-value">{{ formatNumber(metrics?.totalPIIDetections || 0) }}</div>
                    <div class="metric-label">PII Detections</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="shieldCheckmarkOutline" color="success" size="large"></ion-icon>
                  <div class="metric-info">
                    <div class="metric-value">{{ formatNumber(metrics?.itemsSanitized || 0) }}</div>
                    <div class="metric-label">Items Sanitized</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="swapHorizontalOutline" color="secondary" size="large"></ion-icon>
                  <div class="metric-info">
                    <div class="metric-value">{{ formatNumber(metrics?.pseudonymsCreated || 0) }}</div>
                    <div class="metric-label">Pseudonyms Created</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card class="metric-card">
              <ion-card-content>
                <div class="metric-content">
                  <ion-icon :icon="cashOutline" color="warning" size="large"></ion-icon>
                  <div class="metric-info">
                    <div class="metric-value">${{ formatNumber(costSavings) }}</div>
                    <div class="metric-label">Cost Savings</div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Detection Statistics by Type -->
    <div class="detection-stats-section">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="barChartOutline"></ion-icon>
            PII Detection Statistics by Type
          </ion-card-title>
          <ion-card-subtitle>Breakdown of detected PII patterns over time</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="chart-container">
            <BarChart
              :labels="detectionStats.map(s => formatTypeLabel(s.type))"
              :data="detectionStats.map(s => s.count)"
              :colors="detectionStats.map(s => getTypeColor(s.type))"
              label="PII Detections"
              :height="300"
            />
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Pattern Usage Analytics -->
    <div class="pattern-usage-section">
      <ion-row>
        <ion-col size="12" size-lg="6">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="analyticsOutline"></ion-icon>
                Pattern Usage Frequency
              </ion-card-title>
              <ion-card-subtitle>Most frequently matched patterns</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="pattern-list">
                <div v-for="pattern in topPatterns" :key="pattern.id" class="pattern-item">
                  <div class="pattern-info">
                    <div class="pattern-name">{{ pattern.name }}</div>
                    <div class="pattern-description">{{ pattern.description }}</div>
                  </div>
                  <div class="pattern-stats">
                    <div class="usage-count">{{ pattern.usageCount }}</div>
                    <div class="usage-bar">
                      <div 
                        class="usage-fill" 
                        :style="{ width: `${(pattern.usageCount / maxPatternUsage) * 100}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
        
        <ion-col size="12" size-lg="6">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="pieChartOutline"></ion-icon>
                Sanitization Methods
              </ion-card-title>
              <ion-card-subtitle>Distribution of sanitization techniques</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="chart-container">
                <DoughnutChart
                  :labels="sanitizationMethods.map(m => m.name)"
                  :data="sanitizationMethods.map(m => m.percentage)"
                  :colors="sanitizationMethods.map(m => m.color)"
                  :height="300"
                  legend-position="bottom"
                />
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </div>

    <!-- Performance & Cost Analysis -->
    <div class="performance-cost-section">
      <ion-row>
        <ion-col size="12" size-lg="8">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="speedometerOutline"></ion-icon>
                Performance Trends
              </ion-card-title>
              <ion-card-subtitle>Processing time and throughput over time</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="chart-container">
                <LineChart
                  :labels="performanceLabels"
                  :datasets="performanceDatasets"
                  :height="300"
                  :filled="true"
                />
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
        
        <ion-col size="12" size-lg="4">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="trendingUpOutline"></ion-icon>
                Cost Analysis
              </ion-card-title>
              <ion-card-subtitle>Savings and resource usage</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="cost-metrics">
                <div class="cost-item">
                  <div class="cost-label">Processing Cost</div>
                  <div class="cost-value">{{ formatCurrency(metrics?.costSavings || 0) }}</div>
                  <div class="cost-trend positive">
                    <ion-icon :icon="arrowUpOutline"></ion-icon>
                    {{ costTrend.processing }}% vs last period
                  </div>
                </div>
                
                <div class="cost-item">
                  <div class="cost-label">Storage Savings</div>
                  <div class="cost-value">${{ formatCurrency(storageSavings) }}</div>
                  <div class="cost-trend positive">
                    <ion-icon :icon="arrowUpOutline"></ion-icon>
                    {{ costTrend.storage }}% reduction
                  </div>
                </div>
                
                <div class="cost-item">
                  <div class="cost-label">Compliance Value</div>
                  <div class="cost-value">${{ formatCurrency(complianceValue) }}</div>
                  <div class="cost-trend neutral">
                    <ion-icon :icon="removeOutline"></ion-icon>
                    Risk mitigation
                  </div>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </div>

    <!-- System Health & Cost Analysis -->
    <div class="health-cost-section">
      <ion-grid>
        <ion-row>
          <!-- System Health Indicators -->
          <ion-col size="12" size-lg="6">
            <ion-card class="health-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="heartOutline" :color="getOverallHealthColor()"></ion-icon>
                  System Health
                </ion-card-title>
                <ion-card-subtitle>Real-time monitoring and status</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading health data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <ion-grid v-else>
                  <ion-row>
                    <ion-col size="12" size-md="6">
                      <div class="health-indicator">
                    <div class="health-icon" :class="getHealthStatusClass(systemHealth?.apiStatus)">
                      <ion-icon :icon="serverOutline" :color="getHealthColor(systemHealth?.apiStatus)"></ion-icon>
                    </div>
                    <div class="health-info">
                      <div class="health-label">API Status</div>
                      <div class="health-value">
                        <ion-badge :color="getHealthColor(systemHealth?.apiStatus)">
                          {{ formatHealthStatus(systemHealth?.apiStatus) }}
                        </ion-badge>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                    <ion-col size="12" size-md="6">
                      <div class="health-indicator">
                        <div class="health-icon" :class="getHealthStatusClass(systemHealth?.dbStatus)">
                          <ion-icon :icon="serverOutline" :color="getHealthColor(systemHealth?.dbStatus)"></ion-icon>
                    </div>
                    <div class="health-info">
                      <div class="health-label">Database</div>
                      <div class="health-value">
                        <ion-badge :color="getHealthColor(systemHealth?.dbStatus)">
                          {{ formatHealthStatus(systemHealth?.dbStatus) }}
                        </ion-badge>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                  </ion-row>
                  <ion-row>
                    <ion-col size="12" size-md="6">
                      <div class="health-indicator">
                        <div class="health-icon" :class="getUptimeStatusClass()">
                          <ion-icon :icon="flashOutline" :color="getUptimeColor()"></ion-icon>
                    </div>
                    <div class="health-info">
                      <div class="health-label">System Uptime</div>
                      <div class="health-value">
                        <span class="uptime-value">{{ systemHealth?.uptime || 'N/A' }}</span>
                        <ion-badge :color="getUptimeColor()">{{ systemHealth?.uptimeStatus || 'unknown' }}</ion-badge>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                    <ion-col size="12" size-md="6">
                      <div class="health-indicator">
                        <div class="health-icon healthy">
                          <ion-icon :icon="checkmarkCircleOutline" color="success"></ion-icon>
                        </div>
                        <div class="health-info">
                          <div class="health-label">Last Check</div>
                          <div class="health-value">
                            <ion-note>{{ formatTime(systemHealth?.lastHealthCheck || new Date()) }}</ion-note>
                          </div>
                        </div>
                      </div>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Cost Analysis Indicators -->
          <ion-col size="12" size-lg="6">
            <ion-card class="cost-analysis-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="cashOutline" color="warning"></ion-icon>
                  Cost Analysis
                </ion-card-title>
                <ion-card-subtitle>Financial impact and savings</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading cost data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <ion-grid v-else>
                  <ion-row>
                    <ion-col size="12" size-md="6">
                      <div class="cost-indicator">
                    <div class="cost-icon">
                      <ion-icon :icon="cashOutline" color="success" size="large"></ion-icon>
                    </div>
                    <div class="cost-info">
                      <div class="cost-label">Total Savings</div>
                      <div class="cost-value">{{ formatCurrency(metrics?.totalCostSavings || 0) }}</div>
                      <div class="cost-trend" :class="{ positive: metrics?.costSavingsTrend === 'up', negative: metrics?.costSavingsTrend === 'down' }">
                        <ion-icon :icon="metrics?.costSavingsTrend === 'up' ? arrowUpOutline : arrowDownOutline"></ion-icon>
                        <span>{{ metrics?.costSavingsTrend === 'up' ? 'Increasing' : 'Decreasing' }}</span>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                    <ion-col size="12" size-md="6">
                      <div class="cost-indicator">
                        <div class="cost-icon">
                          <ion-icon :icon="speedometerOutline" color="primary" size="large"></ion-icon>
                    </div>
                    <div class="cost-info">
                      <div class="cost-label">Avg Processing Time</div>
                      <div class="cost-value">{{ metrics?.avgProcessingTimeMs || 0 }}ms</div>
                      <div class="cost-trend" :class="{ positive: metrics?.processingTimeTrend === 'down', negative: metrics?.processingTimeTrend === 'up' }">
                        <ion-icon :icon="metrics?.processingTimeTrend === 'down' ? arrowDownOutline : arrowUpOutline"></ion-icon>
                        <span>{{ metrics?.processingTimeTrend === 'down' ? 'Improving' : 'Degrading' }}</span>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                  </ion-row>
                  <ion-row>
                    <ion-col size="12" size-md="6">
                      <div class="cost-indicator">
                        <div class="cost-icon">
                          <ion-icon :icon="walletOutline" color="tertiary" size="large"></ion-icon>
                    </div>
                    <div class="cost-info">
                      <div class="cost-label">Cost per Detection</div>
                      <div class="cost-value">
                        {{ formatCurrency(calculateCostPerDetection()) }}
                      </div>
                      <div class="cost-description">
                        <ion-note>Based on {{ formatNumber(metrics?.totalPIIDetections || 0) }} detections</ion-note>
                      </div>
                    </div>
                      </div>
                    </ion-col>
                    <ion-col size="12" size-md="6">
                      <div class="cost-indicator">
                        <div class="cost-icon">
                          <ion-icon :icon="trendingUpOutline" color="success" size="large"></ion-icon>
                        </div>
                        <div class="cost-info">
                          <div class="cost-label">ROI Estimate</div>
                          <div class="cost-value">{{ calculateROI() }}%</div>
                          <div class="cost-description">
                            <ion-note>Return on privacy investment</ion-note>
                          </div>
                        </div>
                      </div>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Recent Activity Feed -->
    <div class="activity-feed-section">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="listOutline"></ion-icon>
            Recent Privacy Activity
          </ion-card-title>
          <ion-card-subtitle>Latest sanitization and detection events</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="activity-list">
            <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
              <div class="activity-icon" :class="activity.type">
                <ion-icon :icon="getActivityIcon(activity.type)"></ion-icon>
              </div>
              <div class="activity-content">
                <div class="activity-title">{{ activity.title }}</div>
                <div class="activity-description">{{ activity.description }}</div>
                <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
              </div>
              <div class="activity-stats">
                <ion-badge :color="getActivityColor(activity.type)">
                  {{ activity.count }}
                </ion-badge>
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonSpinner,
  IonNote
} from '@ionic/vue';
import {
  refreshOutline,
  optionsOutline,
  eyeOutline,
  shieldCheckmarkOutline,
  swapHorizontalOutline,
  cashOutline,
  barChartOutline,
  analyticsOutline,
  pieChartOutline,
  speedometerOutline,
  trendingUpOutline,
  heartOutline,
  checkmarkCircleOutline,
  // warningOutline,
  alertCircleOutline,
  serverOutline,
  // bugOutline,
  flashOutline,
  listOutline,
  arrowUpOutline,
  arrowDownOutline,
  removeOutline,
  walletOutline
} from 'ionicons/icons';

// Chart components
import BarChart from '@/components/Charts/BarChart.vue';
import LineChart from '@/components/Charts/LineChart.vue';
import DoughnutChart from '@/components/Charts/DoughnutChart.vue';

// Store
import { usePrivacyStore } from '@/stores/privacyStore';

// Props
interface Props {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: false,
  refreshInterval: 30000 // 30 seconds
});

// Emits
const emit = defineEmits<{
  'data-loaded': [data: Record<string, unknown>];
  'refresh-requested': [];
  'filter-changed': [filters: Record<string, unknown>];
}>();

// Store
const dashboardStore = usePrivacyStore();

// Local reactive state
const showFilters = ref(false);
const selectedTimeRange = ref('24h');
const selectedDataType = ref('all');

// Computed properties from store
const metrics = computed(() => dashboardStore.metrics);
const detectionStats = computed(() => dashboardStore.detectionStats);
const isLoading = computed(() => dashboardStore.isLoading);
const error = computed(() => dashboardStore.error);
// const hasData = computed(() => dashboardStore.hasData);

// const patternUsage = computed(() => dashboardStore.patternUsage);
const sanitizationMethods = computed(() => dashboardStore.sanitizationMethods);
const performanceData = computed(() => dashboardStore.performanceData);
const systemHealth = computed(() => dashboardStore.systemHealth);
const recentActivity = computed(() => dashboardStore.recentActivity);

// Chart data computed properties
const performanceLabels = computed(() => {
  if (!performanceData.value?.length) return ['No Data'];
  return performanceData.value.map(point => {
    const date = new Date(point.timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    return diffHours === 0 ? 'Now' : `${diffHours}h ago`;
  });
});

const performanceDatasets = computed(() => {
  if (!performanceData.value?.length) {
    return [
      { label: 'Processing Time (ms)', data: [], borderColor: '#3b82f6', backgroundColor: '#3b82f620', fill: true },
      { label: 'Throughput (req/min)', data: [], borderColor: '#10b981', backgroundColor: '#10b98120', fill: true }
    ];
  }
  
  return [
    {
      label: 'Processing Time (ms)',
      data: performanceData.value.map(point => point.processingTimeMs),
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f620',
      fill: true
    },
    {
      label: 'Throughput (req/min)',
      data: performanceData.value.map(point => point.throughputPerMin),
      borderColor: '#10b981',
      backgroundColor: '#10b98120',
      fill: true
    }
  ];
});

// Methods
const refreshData = async () => {
  try {
    emit('refresh-requested');
    await dashboardStore.refreshData();
    
    // Emit event to notify parent component
    if (metrics.value) {
      emit('data-loaded', {
        detections: metrics.value.totalPIIDetections,
        sanitized: metrics.value.itemsSanitized,
        pseudonyms: metrics.value.pseudonymsCreated,
        savings: metrics.value.costSavings
      });
    }
  } catch (err: unknown) {
    console.error('Failed to refresh dashboard data:', err);
  }
};

// const onFilterChange = () => {
//   refreshData();
// };

// Use store utility methods
const formatNumber = (num: number): string => dashboardStore.formatNumber(num);
const formatCurrency = (amount: number): string => dashboardStore.formatCurrency(amount);
const formatTime = (timestamp: Date | string): string => dashboardStore.formatRelativeTime(timestamp);

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    email: '#10b981',
    phone: '#3b82f6',
    name: '#8b5cf6',
    ssn: '#ef4444',
    api_key: '#f59e0b'
  };
  return colors[type] || '#6b7280';
};

const formatTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    name: 'Name',
    ssn: 'SSN',
    api_key: 'API Key'
  };
  return labels[type] || type;
};

// Health status methods
const getHealthColor = (status: string | undefined): string => {
  switch (status) {
    case 'operational': return 'success';
    case 'degraded': return 'warning';
    case 'down': return 'danger';
    default: return 'medium';
  }
};

const getHealthStatusClass = (status: string | undefined): string => {
  switch (status) {
    case 'operational': return 'healthy';
    case 'degraded': return 'warning';
    case 'down': return 'critical';
    default: return 'unknown';
  }
};

const formatHealthStatus = (status: string | undefined): string => {
  switch (status) {
    case 'operational': return 'Operational';
    case 'degraded': return 'Degraded';
    case 'down': return 'Down';
    default: return 'Unknown';
  }
};

const getOverallHealthColor = (): string => {
  if (!systemHealth.value) return 'medium';
  
  if (systemHealth.value.apiStatus === 'operational' && systemHealth.value.dbStatus === 'operational') {
    return 'success';
  } else if (systemHealth.value.apiStatus === 'down' || systemHealth.value.dbStatus === 'down') {
    return 'danger';
  } else {
    return 'warning';
  }
};

const getUptimeColor = (): string => {
  if (!systemHealth.value?.uptimeStatus) return 'medium';
  
  switch (systemHealth.value.uptimeStatus) {
    case 'healthy': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'danger';
    default: return 'medium';
  }
};

const getUptimeStatusClass = (): string => {
  if (!systemHealth.value?.uptimeStatus) return 'unknown';
  
  switch (systemHealth.value.uptimeStatus) {
    case 'healthy': return 'healthy';
    case 'warning': return 'warning';
    case 'critical': return 'critical';
    default: return 'unknown';
  }
};

// Cost analysis methods
const calculateCostPerDetection = (): number => {
  if (!metrics.value || !metrics.value.totalPIIDetections || metrics.value.totalPIIDetections === 0) {
    return 0;
  }
  
  // Estimate cost per detection based on total cost savings divided by detections
  // This is a simplified calculation - in reality, this would come from actual cost tracking
  const estimatedTotalCost = metrics.value.totalCostSavings * 0.1; // Assume savings represent 10x the actual cost
  return estimatedTotalCost / metrics.value.totalPIIDetections;
};

const calculateROI = (): number => {
  if (!metrics.value || !metrics.value.totalCostSavings) {
    return 0;
  }
  
  // Simplified ROI calculation: (Cost Savings - Investment) / Investment * 100
  // Assume investment is 20% of the total cost savings for this calculation
  const estimatedInvestment = metrics.value.totalCostSavings * 0.2;
  const netBenefit = metrics.value.totalCostSavings - estimatedInvestment;
  const roi = (netBenefit / estimatedInvestment) * 100;
  
  return Math.round(roi);
};

const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    detection: eyeOutline,
    sanitization: shieldCheckmarkOutline,
    redaction: removeOutline
  };
  return icons[type] || listOutline;
};

const getActivityColor = (type: string): string => {
  const colors: Record<string, string> = {
    detection: 'primary',
    sanitization: 'success',
    redaction: 'warning'
  };
  return colors[type] || 'medium';
};

// Watchers
watch([selectedTimeRange, selectedDataType], () => {
  emit('filter-changed', {
    timeRange: selectedTimeRange.value,
    dataType: selectedDataType.value
  });
  refreshData();
});

// Lifecycle hooks
onMounted(async () => {
  // Initialize dashboard data on component mount
  await dashboardStore.fetchDashboardData();
  
  // Set up auto-refresh if enabled
  if (props.autoRefresh) {
    dashboardStore.startAutoRefresh(props.refreshInterval);
  }
});

onUnmounted(() => {
  // Clean up auto-refresh interval
  dashboardStore.stopAutoRefresh();
});
</script>

<style scoped>
.privacy-metrics-dashboard {
  padding: 1rem;
  max-width: 87.5rem;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.dashboard-header h2 {
  margin: 0;
  color: var(--ion-color-primary);
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

.filter-card {
  margin-bottom: 1.5rem;
}

.filter-controls {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group ion-label {
  min-width: 5rem;
  font-weight: 600;
}

.metrics-overview {
  margin-bottom: 2rem;
}

.metric-card {
  height: 7.5rem;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  height: 100%;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--ion-color-primary);
  line-height: 1;
}

.metric-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
}

.detection-stats-section,
.pattern-usage-section,
.performance-cost-section,
.health-indicators-section,
.activity-feed-section {
  margin-bottom: 2rem;
}

.chart-container {
  min-height: 18.75rem;
  position: relative;
}

.chart-placeholder {
  width: 100%;
  height: 18.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Chart mock styles removed - using Chart.js components */

/* Health and Cost Analysis Styles */
.health-cost-section {
  margin-bottom: 1.5rem;
}

.health-card, .cost-analysis-card {
  height: 100%;
  border-radius: 0.75rem;
  box-shadow: var(--ion-box-shadow);
}

/* Removed: Using Ionic grid instead */

.health-indicator, .cost-indicator {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-step-50);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.health-indicator:hover, .cost-indicator:hover {
  background: var(--ion-color-step-100);
  transform: translateY(-2px);
}

.health-icon, .cost-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.health-icon.healthy, .health-icon.operational {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.health-icon.warning, .health-icon.degraded {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.health-icon.critical, .health-icon.down {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.health-icon.unknown {
  background: var(--ion-color-medium-tint);
  color: var(--ion-color-medium);
}

.health-info, .cost-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-label, .cost-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ion-color-medium);
}

.health-value, .cost-value {
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--ion-color-dark);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.uptime-value {
  font-size: 1.25rem;
  color: var(--ion-color-primary);
}

.cost-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

.cost-trend.positive {
  color: var(--ion-color-success);
}

.cost-trend.negative {
  color: var(--ion-color-danger);
}

.cost-description {
  margin-top: 0.25rem;
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem;
  text-align: center;
}

.error-state ion-icon {
  font-size: 2em;
}

/* Responsive handled by Ionic grid */

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pattern-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--ion-color-light);
  border-radius: 0.5rem;
}

.pattern-info {
  flex: 1;
}

.pattern-name {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.pattern-description {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.pattern-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 7.5rem;
}

.usage-count {
  font-weight: bold;
  color: var(--ion-color-primary);
  min-width: 2.5rem;
  text-align: right;
}

.usage-bar {
  flex: 1;
  height: 0.5rem;
  background: var(--ion-color-light-shade);
  border-radius: 0.25rem;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: var(--ion-color-primary);
  border-radius: 0.25rem;
  transition: width 0.3s ease;
}

/* Pie and line chart mock styles removed - using Chart.js components */

.cost-metrics {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cost-item {
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 0.5rem;
}

.cost-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.cost-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.cost-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}

.cost-trend.positive {
  color: var(--ion-color-success);
}

.cost-trend.negative {
  color: var(--ion-color-danger);
}

.cost-trend.neutral {
  color: var(--ion-color-medium);
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 0.5rem;
  height: 100%;
}

.health-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.health-icon.healthy {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.health-icon.warning {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.health-icon.error {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.health-info {
  flex: 1;
}

.health-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.125rem;
}

.health-value {
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 0.5rem;
}

.activity-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-icon.detection {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.activity-icon.sanitization {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.activity-icon.redaction {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 0.125rem;
}

.activity-description {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
}

.activity-stats {
  display: flex;
  align-items: center;
}

/* Mobile responsive */
@media (max-width: 48rem) {
  .filter-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .metric-content {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  
  .chart-mock {
    gap: 0.5rem;
    padding: 0 0.625rem;
  }
  
  .pattern-item {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .pattern-stats {
    justify-content: center;
  }
}
</style>
