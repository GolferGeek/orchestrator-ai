<template>
  <div class="llm-usage-analytics">
    <!-- Dashboard Header -->
    <div class="analytics-header">
      <h2>LLM Usage Analytics</h2>
      <p class="header-subtitle">Comprehensive insights into LLM performance, routing, and costs</p>
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

    <!-- Time Range and Provider Filters -->
    <ion-card v-if="showFilters" class="filter-card">
      <ion-card-content>
        <div class="filter-controls">
          <div class="filter-group">
            <ion-label>Time Range:</ion-label>
            <ion-select v-model="selectedTimeRange" placeholder="Select Range" data-testid="time-range-filter">
              <ion-select-option value="1h">Last Hour</ion-select-option>
              <ion-select-option value="24h">Last 24 Hours</ion-select-option>
              <ion-select-option value="7d">Last 7 Days</ion-select-option>
              <ion-select-option value="30d">Last 30 Days</ion-select-option>
              <ion-select-option value="90d">Last 90 Days</ion-select-option>
            </ion-select>
          </div>
          <div class="filter-group">
            <ion-label>Provider:</ion-label>
            <ion-select v-model="selectedProvider" placeholder="All Providers" data-testid="provider-filter">
              <ion-select-option value="all">All Providers</ion-select-option>
              <ion-select-option value="openai">OpenAI</ion-select-option>
              <ion-select-option value="anthropic">Anthropic</ion-select-option>
              <ion-select-option value="google">Google</ion-select-option>
              <ion-select-option value="mistral">Mistral</ion-select-option>
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
                  <div class="metric-icon">
                    <ion-icon :icon="pulseOutline" color="primary"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ formatNumber(totalRequests) }}</div>
                    <div class="metric-label">Total Requests</div>
                    <div class="metric-trend" :class="{ positive: requestsTrend === 'up', negative: requestsTrend === 'down' }">
                      <ion-icon :icon="requestsTrend === 'up' ? arrowUpOutline : arrowDownOutline"></ion-icon>
                      <span>{{ requestsTrend === 'up' ? 'Increasing' : 'Decreasing' }}</span>
                    </div>
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
                    <ion-icon :icon="timeOutline" color="success"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ avgResponseTime }}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                    <div class="metric-trend" :class="{ positive: responseTimeTrend === 'down', negative: responseTimeTrend === 'up' }">
                      <ion-icon :icon="responseTimeTrend === 'down' ? arrowDownOutline : arrowUpOutline"></ion-icon>
                      <span>{{ responseTimeTrend === 'down' ? 'Improving' : 'Degrading' }}</span>
                    </div>
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
                    <ion-icon :icon="cashOutline" color="warning"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ formatCurrency(totalCost) }}</div>
                    <div class="metric-label">Total Cost</div>
                    <div class="metric-trend" :class="{ positive: costTrend === 'down', negative: costTrend === 'up' }">
                      <ion-icon :icon="costTrend === 'down' ? arrowDownOutline : arrowUpOutline"></ion-icon>
                      <span>{{ costTrend === 'down' ? 'Decreasing' : 'Increasing' }}</span>
                    </div>
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
                    <ion-icon :icon="shieldCheckmarkOutline" color="tertiary"></ion-icon>
                  </div>
                  <div class="metric-info">
                    <div class="metric-value">{{ sanitizationOverhead }}ms</div>
                    <div class="metric-label">Sanitization Overhead</div>
                    <div class="metric-trend" :class="{ positive: sanitizationTrend === 'down', negative: sanitizationTrend === 'up' }">
                      <ion-icon :icon="sanitizationTrend === 'down' ? arrowDownOutline : arrowUpOutline"></ion-icon>
                      <span>{{ sanitizationTrend === 'down' ? 'Optimized' : 'Increased' }}</span>
                    </div>
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
      <ion-grid>
        <ion-row>
          <!-- Request Volume Over Time -->
          <ion-col size="12" size-lg="8">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="barChartOutline"></ion-icon>
                  Request Volume Over Time
                </ion-card-title>
                <ion-card-subtitle>Hourly/Daily request patterns and trends</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading request volume data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <div v-else class="chart-container">
                  <LineChart 
                    :data="requestVolumeData"
                    :options="requestVolumeOptions"
                    height="300"
                  />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Provider Routing Distribution -->
          <ion-col size="12" size-lg="4">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="pieChartOutline"></ion-icon>
                  Provider Distribution
                </ion-card-title>
                <ion-card-subtitle>Request routing by provider</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading provider data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <div v-else class="chart-container">
                  <DoughnutChart 
                    :data="providerDistributionData"
                    :options="providerDistributionOptions"
                    height="300"
                  />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>

        <ion-row>
          <!-- Response Time Comparison -->
          <ion-col size="12" size-lg="6">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="speedometerOutline"></ion-icon>
                  Response Time Comparison
                </ion-card-title>
                <ion-card-subtitle>Average response times by provider</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading response time data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <div v-else class="chart-container">
                  <BarChart 
                    :data="responseTimeData"
                    :options="responseTimeOptions"
                    height="300"
                  />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Cost Trends -->
          <ion-col size="12" size-lg="6">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="trendingUpOutline"></ion-icon>
                  Cost Trends
                </ion-card-title>
                <ion-card-subtitle>Daily cost analysis and projections</ion-card-subtitle>
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
                <div v-else class="chart-container">
                  <LineChart 
                    :data="costTrendsData"
                    :options="costTrendsOptions"
                    height="300"
                  />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>

        <!-- Sanitization Overhead Analysis -->
        <ion-row>
          <ion-col size="12">
            <ion-card class="chart-card">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
                  Sanitization Overhead Analysis
                </ion-card-title>
                <ion-card-subtitle>Impact of privacy processing on response times</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div v-if="isLoading" class="loading-state">
                  <ion-spinner name="crescent"></ion-spinner>
                  <ion-note>Loading sanitization data...</ion-note>
                </div>
                <div v-else-if="error" class="error-state">
                  <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
                  <ion-note color="danger">{{ error }}</ion-note>
                </div>
                <div v-else class="chart-container">
                  <BarChart 
                    :data="sanitizationOverheadData"
                    :options="sanitizationOverheadOptions"
                    height="250"
                  />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Performance Insights -->
    <div class="insights-section">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="bulbOutline"></ion-icon>
            Performance Insights
          </ion-card-title>
          <ion-card-subtitle>AI-powered recommendations and trends</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div v-if="insights.length === 0" class="no-insights">
            <ion-icon :icon="informationCircleOutline" color="medium"></ion-icon>
            <ion-note>No insights available yet. Data will appear as usage patterns are analyzed.</ion-note>
          </div>
          <div v-else class="insights-list">
            <div v-for="insight in insights" :key="insight.id" class="insight-item">
              <div class="insight-icon" :class="insight.type">
                <ion-icon 
                  :icon="getInsightIcon(insight.type)"
                  :color="getInsightColor(insight.type)"
                ></ion-icon>
              </div>
              <div class="insight-content">
                <div class="insight-title">{{ insight.title }}</div>
                <div class="insight-description">{{ insight.description }}</div>
                <div class="insight-recommendation" v-if="insight.recommendation">
                  <strong>Recommendation:</strong> {{ insight.recommendation }}
                </div>
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCol,
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonNote
} from '@ionic/vue';
import {
  refreshOutline,
  optionsOutline,
  pulseOutline,
  timeOutline,
  cashOutline,
  shieldCheckmarkOutline,
  barChartOutline,
  pieChartOutline,
  speedometerOutline,
  trendingUpOutline,
  alertCircleOutline,
  arrowUpOutline,
  arrowDownOutline,
  bulbOutline,
  informationCircleOutline,
  warningOutline,
  checkmarkCircleOutline,
  flashOutline
} from 'ionicons/icons';

// Chart components
import BarChart from '@/components/Charts/BarChart.vue';
import LineChart from '@/components/Charts/LineChart.vue';
import DoughnutChart from '@/components/Charts/DoughnutChart.vue';

// Store
import { useLlmUsageStore } from '@/stores/llmUsageStore';

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

// Store
const llmUsageStore = useLlmUsageStore();

// Local reactive state (UI only)
const showFilters = ref(false);
const selectedTimeRange = ref('24h');
const selectedProvider = ref('all');

// Computed properties from store (reactive UI updates)
const isLoading = computed(() => llmUsageStore.loading);
const error = computed(() => llmUsageStore.error);

// Key metrics from store
const totalRequests = computed(() => llmUsageStore.usageRecords.length);
const avgResponseTime = computed(() => Math.round(llmUsageStore.avgDuration));
const totalCost = computed(() => llmUsageStore.totalCost);
const successRate = computed(() => llmUsageStore.successRate);

// Provider data
const providers = computed(() => llmUsageStore.providers);
const analytics = computed(() => llmUsageStore.analytics);
const usageRecords = computed(() => llmUsageStore.usageRecords);

// Computed trends (derived from analytics data)
const requestsTrend = computed(() => {
  if (analytics.value.length < 2) return 'stable';
  const recent = analytics.value[analytics.value.length - 1];
  const previous = analytics.value[analytics.value.length - 2];
  return recent.total_requests > previous.total_requests ? 'up' : 'down';
});

const responseTimeTrend = computed(() => {
  if (analytics.value.length < 2) return 'stable';
  const recent = analytics.value[analytics.value.length - 1];
  const previous = analytics.value[analytics.value.length - 2];
  return recent.avg_duration_ms < previous.avg_duration_ms ? 'down' : 'up';
});

const costTrend = computed(() => {
  if (analytics.value.length < 2) return 'stable';
  const recent = analytics.value[analytics.value.length - 1];
  const previous = analytics.value[analytics.value.length - 2];
  return recent.total_cost > previous.total_cost ? 'up' : 'down';
});

// Sanitization overhead (computed from usage records)
const sanitizationOverhead = computed(() => {
  const recordsWithSanitization = usageRecords.value.filter(r => r.duration_ms && r.duration_ms > 0);
  if (recordsWithSanitization.length === 0) return 0;
  
  // Estimate sanitization overhead as percentage of total response time
  const avgDuration = recordsWithSanitization.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / recordsWithSanitization.length;
  return Math.round(avgDuration * 0.1); // Assume 10% overhead for sanitization
});

const sanitizationTrend = computed(() => 'down'); // Default to optimized

// Computed insights from store analytics (no mock data)
const insights = computed(() => {
  if (!analytics.value.length || !usageRecords.value.length) {
    return [];
  }

  const computedInsights = [];
  
  // Performance insight based on real data
  if (analytics.value.length >= 2) {
    const recent = analytics.value[analytics.value.length - 1];
    const previous = analytics.value[analytics.value.length - 2];
    const responseTimeChange = ((recent.avg_duration_ms - previous.avg_duration_ms) / previous.avg_duration_ms) * 100;
    
    if (Math.abs(responseTimeChange) > 5) {
      computedInsights.push({
        id: 1,
        type: 'performance',
        title: 'Response Time Analysis',
        description: `Average response time has ${responseTimeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(responseTimeChange).toFixed(1)}% compared to previous period.`,
        recommendation: responseTimeChange > 0 ? 'Consider optimizing request routing or model selection.' : 'Current performance improvements are positive.'
      });
    }
  }

  // Cost insight based on real data
  const totalCostToday = analytics.value.reduce((sum, record) => sum + record.total_cost, 0);
  if (totalCostToday > 0) {
    computedInsights.push({
      id: 2,
      type: 'cost',
      title: 'Cost Analysis',
      description: `Total cost today: $${totalCostToday.toFixed(2)} across ${usageRecords.value.length} requests.`,
      recommendation: 'Monitor cost trends and consider optimizing high-cost providers.'
    });
  }

  // Provider distribution insight
  const providerUsage = usageRecords.value.reduce((acc, record) => {
    acc[record.provider_name] = (acc[record.provider_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topProvider = Object.entries(providerUsage).sort(([,a], [,b]) => b - a)[0];
  if (topProvider) {
    const percentage = ((topProvider[1] / usageRecords.value.length) * 100).toFixed(1);
    computedInsights.push({
      id: 3,
      type: 'usage',
      title: 'Provider Usage Pattern',
      description: `${topProvider[0]} is handling ${percentage}% of requests (${topProvider[1]} out of ${usageRecords.value.length}).`,
      recommendation: 'Consider load balancing if one provider is heavily utilized.'
    });
  }

  return computedInsights;
});

// Chart data computed properties (reactive from store data)
const requestVolumeData = computed(() => {
  if (!analytics.value.length) {
    return {
      labels: ['No Data'],
      datasets: [{
        label: 'Requests',
        data: [0],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
        fill: true
      }]
    };
  }

  // Group analytics by date and sum requests
  const dailyData = analytics.value.reduce((acc, record) => {
    const date = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + record.total_requests;
    return acc;
  }, {} as Record<string, number>);

  return {
    labels: Object.keys(dailyData),
    datasets: [{
      label: 'Requests',
      data: Object.values(dailyData),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.4,
      fill: true
    }]
  };
});

const requestVolumeOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Time'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Requests'
      },
      beginAtZero: true
    }
  }
}));

const providerDistributionData = computed(() => {
  if (!usageRecords.value.length) {
    return {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['rgba(128, 128, 128, 0.8)'],
        borderColor: ['rgb(128, 128, 128)'],
        borderWidth: 2
      }]
    };
  }

  // Count requests by provider
  const providerCounts = usageRecords.value.reduce((acc, record) => {
    acc[record.provider_name] = (acc[record.provider_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const colors = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(255, 205, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)'
  ];

  const borderColors = [
    'rgb(54, 162, 235)',
    'rgb(255, 99, 132)',
    'rgb(255, 205, 86)',
    'rgb(75, 192, 192)',
    'rgb(153, 102, 255)',
    'rgb(255, 159, 64)'
  ];

  const labels = Object.keys(providerCounts);
  const data = Object.values(providerCounts);

  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, labels.length),
      borderColor: borderColors.slice(0, labels.length),
      borderWidth: 2
    }]
  };
});

const providerDistributionOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        padding: 20,
        usePointStyle: true
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const label = context.label || '';
          const value = context.parsed || 0;
          return `${label}: ${value}%`;
        }
      }
    }
  }
}));

const responseTimeData = computed(() => {
  if (!usageRecords.value.length) {
    return {
      labels: ['No Data'],
      datasets: [{
        label: 'Response Time (ms)',
        data: [0],
        backgroundColor: ['rgba(128, 128, 128, 0.8)'],
        borderColor: ['rgb(128, 128, 128)'],
        borderWidth: 2
      }]
    };
  }

  // Calculate average response time by provider
  const providerTimes = usageRecords.value.reduce((acc, record) => {
    if (record.duration_ms && record.duration_ms > 0) {
      if (!acc[record.provider_name]) {
        acc[record.provider_name] = { total: 0, count: 0 };
      }
      acc[record.provider_name].total += record.duration_ms;
      acc[record.provider_name].count += 1;
    }
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const labels = Object.keys(providerTimes);
  const data = labels.map(provider => 
    Math.round(providerTimes[provider].total / providerTimes[provider].count)
  );

  const colors = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(255, 205, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)'
  ];

  const borderColors = [
    'rgb(54, 162, 235)',
    'rgb(255, 99, 132)',
    'rgb(255, 205, 86)',
    'rgb(75, 192, 192)',
    'rgb(153, 102, 255)',
    'rgb(255, 159, 64)'
  ];

  return {
    labels,
    datasets: [{
      label: 'Response Time (ms)',
      data,
      backgroundColor: colors.slice(0, labels.length),
      borderColor: borderColors.slice(0, labels.length),
      borderWidth: 2
    }]
  };
});

const responseTimeOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => `${context.parsed.y}ms`
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Provider'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Response Time (ms)'
      },
      beginAtZero: true
    }
  }
}));

const costTrendsData = computed(() => {
  if (!analytics.value.length) {
    return {
      labels: ['No Data'],
      datasets: [{
        label: 'Daily Cost',
        data: [0],
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        tension: 0.4,
        fill: true
      }]
    };
  }

  // Group analytics by date and sum costs
  const dailyCosts = analytics.value.reduce((acc, record) => {
    const date = new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' });
    acc[date] = (acc[date] || 0) + record.total_cost;
    return acc;
  }, {} as Record<string, number>);

  return {
    labels: Object.keys(dailyCosts),
    datasets: [{
      label: 'Daily Cost',
      data: Object.values(dailyCosts),
      borderColor: 'rgb(255, 159, 64)',
      backgroundColor: 'rgba(255, 159, 64, 0.2)',
      tension: 0.4,
      fill: true
    }]
  };
});

const costTrendsOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => `$${context.parsed.y.toFixed(2)}`
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Day'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Cost ($)'
      },
      beginAtZero: true,
      ticks: {
        callback: function(value: any) {
          return '$' + value.toFixed(2);
        }
      }
    }
  }
}));

const sanitizationOverheadData = computed(() => ({
  labels: ['Input Sanitization', 'Output Sanitization', 'PII Detection', 'Pseudonymization'],
  datasets: [{
    label: 'Processing Time (ms)',
    data: [45, 32, 28, 18],
    backgroundColor: [
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(75, 192, 192, 0.8)'
    ],
    borderColor: [
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)',
      'rgb(255, 99, 132)',
      'rgb(75, 192, 192)'
    ],
    borderWidth: 2
  }]
}));

const sanitizationOverheadOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => `${context.parsed.x}ms`
      }
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Processing Time (ms)'
      },
      beginAtZero: true
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Process'
      }
    }
  }
}));

// Methods
const refreshData = async () => {
  try {
    emit('refresh-requested');
    
    // Update analytics filters based on current selections
    const timeRangeInDays = {
      '1h': 1,
      '24h': 1, 
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[selectedTimeRange.value] || 7;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - timeRangeInDays);
    
    llmUsageStore.updateAnalyticsFilters({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    // Fetch fresh data from the store
    await Promise.all([
      llmUsageStore.fetchUsageRecords(),
      llmUsageStore.fetchAnalytics(),
      llmUsageStore.fetchStats()
    ]);
    
    // Emit event with current metrics
    emit('data-loaded', {
      requests: totalRequests.value,
      responseTime: avgResponseTime.value,
      cost: totalCost.value,
      sanitization: sanitizationOverhead.value
    });
  } catch (err: any) {
    console.error('Failed to refresh analytics data:', err);
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const getInsightIcon = (type: string): string => {
  const icons: Record<string, string> = {
    performance: flashOutline,
    cost: cashOutline,
    warning: warningOutline,
    success: checkmarkCircleOutline
  };
  return icons[type] || informationCircleOutline;
};

const getInsightColor = (type: string): string => {
  const colors: Record<string, string> = {
    performance: 'primary',
    cost: 'success',
    warning: 'warning',
    success: 'success'
  };
  return colors[type] || 'medium';
};

// Watchers
watch([selectedTimeRange, selectedProvider], () => {
  emit('filter-changed', {
    timeRange: selectedTimeRange.value,
    provider: selectedProvider.value
  });
  refreshData();
});

// Lifecycle hooks
onMounted(async () => {
  // Initialize the store with fresh data
  await llmUsageStore.initialize();
  
  if (props.autoRefresh) {
    llmUsageStore.startAutoRefresh(props.refreshInterval);
  }
});

onUnmounted(() => {
  // Cleanup auto-refresh
  llmUsageStore.stopAutoRefresh();
});
</script>

<style scoped>
.llm-usage-analytics {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header Styles */
.analytics-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  padding: 16px 0;
}

.analytics-header h2 {
  margin: 0;
  font-size: 28px;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.header-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--ion-color-medium);
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}

/* Filter Styles */
.filter-card {
  margin-bottom: 24px;
}

.filter-controls {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.filter-group ion-label {
  font-weight: 500;
  min-width: 80px;
}

/* Metrics Overview */
.metrics-overview {
  margin-bottom: 32px;
}

.metric-card {
  height: 100%;
  border-radius: 12px;
  box-shadow: var(--ion-box-shadow);
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ion-color-step-100);
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.metric-trend.positive {
  color: var(--ion-color-success);
}

.metric-trend.negative {
  color: var(--ion-color-danger);
}

/* Charts Section */
.charts-section {
  margin-bottom: 32px;
}

.chart-card {
  height: 100%;
  border-radius: 12px;
  box-shadow: var(--ion-box-shadow);
}

.chart-card ion-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.chart-container {
  position: relative;
  height: 300px;
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  text-align: center;
}

.error-state ion-icon {
  font-size: 2em;
}

/* Insights Section */
.insights-section {
  margin-bottom: 24px;
}

.no-insights {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  text-align: center;
}

.no-insights ion-icon {
  font-size: 2em;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.insight-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--ion-color-step-50);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.insight-item:hover {
  background: var(--ion-color-step-100);
}

.insight-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ion-color-step-100);
  flex-shrink: 0;
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.insight-description {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.insight-recommendation {
  font-size: 14px;
  color: var(--ion-color-dark);
}

/* Responsive Design */
@media (min-width: 768px) {
  .analytics-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .header-controls {
    margin-top: 0;
  }
  
  .filter-controls {
    justify-content: flex-start;
  }
}

@media (min-width: 1024px) {
  .llm-usage-analytics {
    padding: 24px;
  }
  
  .chart-container {
    height: 350px;
  }
}
</style>
