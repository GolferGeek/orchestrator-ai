<template>
  <div class="privacy-metrics-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <h2>Privacy Metrics Dashboard</h2>
      <div class="header-controls">
        <ion-button fill="outline" size="small" @click="refreshData">
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
            <ion-select v-model="selectedTimeRange" placeholder="Select Range">
              <ion-select-option value="24h">Last 24 Hours</ion-select-option>
              <ion-select-option value="7d">Last 7 Days</ion-select-option>
              <ion-select-option value="30d">Last 30 Days</ion-select-option>
              <ion-select-option value="90d">Last 90 Days</ion-select-option>
            </ion-select>
          </div>
          <div class="filter-group">
            <ion-label>Data Type:</ion-label>
            <ion-select v-model="selectedDataType" placeholder="All Types">
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
                    <div class="metric-value">{{ formatNumber(totalDetections) }}</div>
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
                    <div class="metric-value">{{ formatNumber(totalSanitized) }}</div>
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
                    <div class="metric-value">{{ formatNumber(totalPseudonyms) }}</div>
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
                  <div class="cost-value">${{ formatCurrency(processingCost) }}</div>
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

    <!-- System Health Indicators -->
    <div class="health-indicators-section">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="heartOutline"></ion-icon>
            System Health & Status
          </ion-card-title>
          <ion-card-subtitle>Real-time system monitoring and alerts</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="6" size-md="3">
                <div class="health-indicator">
                  <div class="health-icon" :class="systemHealth.overall.status">
                    <ion-icon :icon="checkmarkCircleOutline" v-if="systemHealth.overall.status === 'healthy'"></ion-icon>
                    <ion-icon :icon="warningOutline" v-else-if="systemHealth.overall.status === 'warning'"></ion-icon>
                    <ion-icon :icon="alertCircleOutline" v-else></ion-icon>
                  </div>
                  <div class="health-info">
                    <div class="health-label">System Status</div>
                    <div class="health-value">{{ systemHealth.overall.label }}</div>
                  </div>
                </div>
              </ion-col>
              
              <ion-col size="6" size-md="3">
                <div class="health-indicator">
                  <div class="health-icon healthy">
                    <ion-icon :icon="serverOutline"></ion-icon>
                  </div>
                  <div class="health-info">
                    <div class="health-label">Uptime</div>
                    <div class="health-value">{{ systemHealth.uptime }}</div>
                  </div>
                </div>
              </ion-col>
              
              <ion-col size="6" size-md="3">
                <div class="health-indicator">
                  <div class="health-icon" :class="systemHealth.errorRate.status">
                    <ion-icon :icon="bugOutline"></ion-icon>
                  </div>
                  <div class="health-info">
                    <div class="health-label">Error Rate</div>
                    <div class="health-value">{{ systemHealth.errorRate.value }}%</div>
                  </div>
                </div>
              </ion-col>
              
              <ion-col size="6" size-md="3">
                <div class="health-indicator">
                  <div class="health-icon" :class="systemHealth.throughput.status">
                    <ion-icon :icon="flashOutline"></ion-icon>
                  </div>
                  <div class="health-info">
                    <div class="health-label">Throughput</div>
                    <div class="health-value">{{ systemHealth.throughput.value }}/min</div>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
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
import { ref, computed, onMounted, watch } from 'vue';
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
  IonBadge
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
  warningOutline,
  alertCircleOutline,
  serverOutline,
  bugOutline,
  flashOutline,
  listOutline,
  arrowUpOutline,
  removeOutline
} from 'ionicons/icons';

// Chart components
import BarChart from '@/components/Charts/BarChart.vue';
import LineChart from '@/components/Charts/LineChart.vue';
import DoughnutChart from '@/components/Charts/DoughnutChart.vue';

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
  'data-loaded': [data: any];
  'refresh-requested': [];
  'filter-changed': [filters: any];
}>();

// Reactive state
const showFilters = ref(false);
const selectedTimeRange = ref('7d');
const selectedDataType = ref('all');
const isLoading = ref(false);
const error = ref<string | null>(null);

// Sample data (will be replaced with real API data)
const totalDetections = ref(15420);
const totalSanitized = ref(14890);
const totalPseudonyms = ref(8750);
const costSavings = ref(12450);

const detectionStats = ref([
  { type: 'email', count: 5420 },
  { type: 'phone', count: 3890 },
  { type: 'name', count: 3210 },
  { type: 'ssn', count: 1890 },
  { type: 'api_key', count: 1010 }
]);

const topPatterns = ref([
  { id: 1, name: 'Email Pattern', description: 'Standard email validation', usageCount: 5420 },
  { id: 2, name: 'Phone Pattern', description: 'US phone number format', usageCount: 3890 },
  { id: 3, name: 'Name Pattern', description: 'First Last name format', usageCount: 3210 },
  { id: 4, name: 'SSN Pattern', description: 'Social security number', usageCount: 1890 },
  { id: 5, name: 'API Key Pattern', description: 'API key detection', usageCount: 1010 }
]);

const sanitizationMethods = ref([
  { name: 'Pseudonymization', percentage: 65, color: '#3b82f6' },
  { name: 'Redaction', percentage: 25, color: '#ef4444' },
  { name: 'Masking', percentage: 10, color: '#f59e0b' }
]);

const processingCost = ref(890.50);
const storageSavings = ref(2340.75);
const complianceValue = ref(15000);

const costTrend = ref({
  processing: -12.5,
  storage: 18.3
});

const systemHealth = ref({
  overall: { status: 'healthy', label: 'Operational' },
  uptime: '99.8%',
  errorRate: { status: 'healthy', value: 0.2 },
  throughput: { status: 'healthy', value: 1250 }
});

const recentActivity = ref([
  {
    id: 1,
    type: 'detection',
    title: 'PII Detection Spike',
    description: 'Detected 45 email addresses in batch processing',
    timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    count: 45
  },
  {
    id: 2,
    type: 'sanitization',
    title: 'Pseudonymization Complete',
    description: 'Successfully pseudonymized 23 names in user data',
    timestamp: new Date(Date.now() - 600000), // 10 minutes ago
    count: 23
  },
  {
    id: 3,
    type: 'redaction',
    title: 'API Keys Redacted',
    description: 'Removed 8 API keys from log files',
    timestamp: new Date(Date.now() - 900000), // 15 minutes ago
    count: 8
  }
]);

// Computed properties
const maxDetections = computed(() => {
  return Math.max(...detectionStats.value.map(s => s.count));
});

const maxPatternUsage = computed(() => {
  return Math.max(...topPatterns.value.map(p => p.usageCount));
});

const performanceLabels = ref(['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now']);

const performanceDatasets = computed(() => [
  {
    label: 'Processing Time (ms)',
    data: [150, 120, 80, 100, 60, 90, 40],
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f620',
    fill: true
  },
  {
    label: 'Throughput (req/min)',
    data: [1200, 1350, 1500, 1400, 1600, 1450, 1700],
    borderColor: '#10b981',
    backgroundColor: '#10b98120',
    fill: true
  }
]);

// Methods
const refreshData = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    emit('refresh-requested');
    // TODO: Implement actual API calls
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    emit('data-loaded', {
      detections: totalDetections.value,
      sanitized: totalSanitized.value,
      pseudonyms: totalPseudonyms.value
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to refresh data';
  } finally {
    isLoading.value = false;
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const formatCurrency = (amount: number): string => {
  return amount.toFixed(2);
};

const formatTime = (timestamp: Date): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (minutes < 1440) {
    return `${Math.floor(minutes / 60)}h ago`;
  } else {
    return `${Math.floor(minutes / 1440)}d ago`;
  }
};

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
onMounted(() => {
  refreshData();
  
  if (props.autoRefresh) {
    setInterval(refreshData, props.refreshInterval);
  }
});
</script>

<style scoped>
.privacy-metrics-dashboard {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h2 {
  margin: 0;
  color: var(--ion-color-primary);
}

.header-controls {
  display: flex;
  gap: 8px;
}

.filter-card {
  margin-bottom: 24px;
}

.filter-controls {
  display: flex;
  gap: 24px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group ion-label {
  min-width: 80px;
  font-weight: 600;
}

.metrics-overview {
  margin-bottom: 32px;
}

.metric-card {
  height: 120px;
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--ion-color-primary);
  line-height: 1;
}

.metric-label {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.detection-stats-section,
.pattern-usage-section,
.performance-cost-section,
.health-indicators-section,
.activity-feed-section {
  margin-bottom: 32px;
}

.chart-container {
  min-height: 300px;
  position: relative;
}

.chart-placeholder {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Chart mock styles removed - using Chart.js components */

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pattern-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.pattern-info {
  flex: 1;
}

.pattern-name {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.pattern-description {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.pattern-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 120px;
}

.usage-count {
  font-weight: bold;
  color: var(--ion-color-primary);
  min-width: 40px;
  text-align: right;
}

.usage-bar {
  flex: 1;
  height: 8px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: var(--ion-color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Pie and line chart mock styles removed - using Chart.js components */

.cost-metrics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cost-item {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.cost-label {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.cost-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.cost-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
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
  gap: 12px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  height: 100%;
}

.health-icon {
  width: 48px;
  height: 48px;
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
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 2px;
}

.health-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.activity-icon {
  width: 40px;
  height: 40px;
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
  margin-bottom: 2px;
}

.activity-description {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.activity-time {
  font-size: 12px;
  color: var(--ion-color-medium-shade);
}

.activity-stats {
  display: flex;
  align-items: center;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .filter-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .metric-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  
  .chart-mock {
    gap: 8px;
    padding: 0 10px;
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
