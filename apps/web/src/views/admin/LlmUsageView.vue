<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>LLM Usage Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            fill="clear" 
            @click="toggleAutoRefresh"
            :color="autoRefreshEnabled ? 'success' : 'medium'"
          >
            <ion-icon :icon="autoRefreshEnabled ? refreshCircleOutline : refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Tab Navigation -->
      <ion-segment v-model="selectedTab" @ion-change="onTabChange">
        <ion-segment-button value="overview">
          <ion-icon :icon="speedometerOutline" />
          <ion-label>Overview</ion-label>
        </ion-segment-button>
        
        <ion-segment-button value="records">
          <ion-icon :icon="listOutline" />
          <ion-label>Records</ion-label>
        </ion-segment-button>
        
        <ion-segment-button value="analytics">
          <ion-icon :icon="barChartOutline" />
          <ion-label>Analytics</ion-label>
        </ion-segment-button>
        
        <ion-segment-button value="monitoring">
          <ion-icon :icon="pulseOutline" />
          <ion-label>Live</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Overview Tab -->
        <div v-show="selectedTab === 'overview'" class="tab-panel">
          <div class="overview-section">
            <!-- Route Filter -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="barChartOutline" />
                  Filters
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-segment v-model="routeFilter" @ion-change="onRouteFilterChange">
                  <ion-segment-button value="all">
                    <ion-label>All</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="local">
                    <ion-label>Local</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="remote">
                    <ion-label>Remote</ion-label>
                  </ion-segment-button>
                </ion-segment>
                <div style="margin-top:12px;">
                  <ion-button size="small" fill="outline" @click="applyPresetLocal7d">Local last 7 days</ion-button>
                </div>
              </ion-card-content>
            </ion-card>
            <!-- Quick Stats -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="statsChartOutline" />
                  Quick Stats
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-grid>
                  <ion-row>
                    <ion-col size="6" size-md="3">
                      <div class="quick-stat">
                        <div class="stat-value">{{ stats?.activeRuns || 0 }}</div>
                        <div class="stat-label">Active Runs</div>
                        <ion-chip 
                          :color="stats?.activeRuns > 0 ? 'success' : 'medium'" 
                          size="small"
                        >
                          <ion-icon :icon="stats?.activeRuns > 0 ? playCircleOutline : pauseCircleOutline" />
                          {{ stats?.activeRuns > 0 ? 'Running' : 'Idle' }}
                        </ion-chip>
                      </div>
                    </ion-col>
                    
                    <ion-col size="6" size-md="3">
                      <div class="quick-stat">
                        <div class="stat-value">{{ stats?.totalRunsToday || 0 }}</div>
                        <div class="stat-label">Runs Today</div>
                      </div>
                    </ion-col>
                    
                    <ion-col size="6" size-md="3">
                      <div class="quick-stat">
                        <div class="stat-value">{{ formatDuration(stats?.avgDuration || 0) }}</div>
                        <div class="stat-label">Avg Duration</div>
                      </div>
                    </ion-col>
                    
                    <ion-col size="6" size-md="3">
                      <div class="quick-stat">
                        <div class="stat-value">{{ formatCurrency(stats?.avgCost || 0) }}</div>
                        <div class="stat-label">Avg Cost</div>
                      </div>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-card-content>
            </ion-card>

            <!-- Route Split (Local vs Remote) -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="barChartOutline" />
                  Route Split (Local vs Remote)
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-grid>
                  <ion-row>
                    <ion-col size="12" size-md="6">
                      <div class="route-stat">
                        <div class="route-label">
                          <ion-chip color="success" outline>Local</ion-chip>
                        </div>
                        <div class="route-values">
                          <span class="route-count">{{ routeSplit.local }}</span>
                          <span class="route-percent">({{ routeSplit.localPercent }}%)</span>
                        </div>
                        <ion-progress-bar color="success" :value="routeSplit.localPercent / 100" />
                      </div>
                    </ion-col>
                    <ion-col size="12" size-md="6">
                      <div class="route-stat">
                        <div class="route-label">
                          <ion-chip color="tertiary" outline>Remote</ion-chip>
                        </div>
                        <div class="route-values">
                          <span class="route-count">{{ routeSplit.remote }}</span>
                          <span class="route-percent">({{ routeSplit.remotePercent }}%)</span>
                        </div>
                        <ion-progress-bar color="tertiary" :value="routeSplit.remotePercent / 100" />
                      </div>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-card-content>
            </ion-card>

            <!-- Recent Activity -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="timeOutline" />
                  Recent Activity
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div v-if="recentRecords.length === 0" class="empty-state">
                  <ion-icon :icon="documentTextOutline" color="medium" size="large" />
                  <p>No recent activity</p>
                </div>
                
                <div v-else class="recent-activity">
                  <div 
                    v-for="record in recentRecords" 
                    :key="record.id"
                    class="activity-item clickable"
                    @click="$router.push({ name: 'LLMUsageDetails', params: { runId: record.run_id } })"
                  >
                    <div class="activity-icon">
                      <ion-icon 
                        :icon="getCallerIcon(record.caller_type)" 
                        :color="getCallerColor(record.caller_type)"
                      />
                    </div>
                    <div class="activity-content">
                      <div class="activity-title">
                        {{ record.caller_name }} ({{ record.caller_type }})
                      </div>
          <div class="activity-details">
            {{ record.model_name }} • {{ formatDuration(record.duration_ms) }} • {{ formatCurrency(record.total_cost || 0) }}
            <ion-badge v-if="record.pii_detected && (record.pseudonyms_used || 0) > 0" color="warning" style="margin-left:8px;">
              {{ record.pseudonyms_used }} pseudonyms
            </ion-badge>
          </div>
                      <div class="activity-time">
                        {{ formatRelativeTime(record.started_at) }}
                      </div>
                    </div>
                    <div class="activity-status">
                      <ion-chip 
                        :color="getStatusColor(record.status)" 
                        size="small"
                      >
                        {{ record.status }}
                      </ion-chip>
                    </div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </div>

        <!-- Records Tab -->
        <div v-show="selectedTab === 'records'" class="tab-panel">
          <LlmUsageTable />
        </div>

        <!-- Analytics Tab -->
        <div v-show="selectedTab === 'analytics'" class="tab-panel">
          <LlmAnalytics />
        </div>

        <!-- Monitoring Tab -->
        <div v-show="selectedTab === 'monitoring'" class="tab-panel">
          <div class="monitoring-section">
            <!-- Active Runs -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="flashOutline" />
                  Active Runs
                  <ion-badge v-if="activeRuns.length > 0" color="primary">
                    {{ activeRuns.length }}
                  </ion-badge>
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div v-if="activeRuns.length === 0" class="empty-state">
                  <ion-icon :icon="checkmarkCircleOutline" color="success" size="large" />
                  <h3>No Active Runs</h3>
                  <p>All LLM requests have completed successfully.</p>
                </div>
                
                <div v-else class="active-runs">
                  <div 
                    v-for="run in activeRuns" 
                    :key="run.runId"
                    class="active-run-item"
                  >
                    <div class="run-info">
                      <div class="run-id">{{ run.runId }}</div>
                      <div class="run-details">
                        {{ run.model }} • Started {{ formatRelativeTime(run.startTime) }}
                      </div>
                    </div>
                    <div class="run-status">
                      <ion-spinner name="dots" color="primary" />
                    </div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- System Health -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="heartOutline" />
                  System Health
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="health-metrics">
                  <div class="health-item">
                    <ion-icon :icon="serverOutline" color="primary" />
                    <div class="health-info">
                      <div class="health-label">API Status</div>
                      <div class="health-value">
                        <ion-chip color="success" size="small">Online</ion-chip>
                      </div>
                    </div>
                  </div>
                  
                  <div class="health-item">
                    <ion-icon :icon="cloudOutline" color="primary" />
                    <div class="health-info">
                      <div class="health-label">External Providers</div>
                      <div class="health-value">
                        <ion-chip color="success" size="small">Available</ion-chip>
                      </div>
                    </div>
                  </div>
                  
                  <div class="health-item">
                    <ion-icon :icon="desktopOutline" color="primary" />
                    <div class="health-info">
                      <div class="health-label">Local Models</div>
                      <div class="health-value">
                        <ion-chip color="warning" size="small">Checking...</ion-chip>
                      </div>
                    </div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonMenuButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonBadge,
  IonSpinner
} from '@ionic/vue';
import {
  speedometerOutline,
  listOutline,
  barChartOutline,
  pulseOutline,
  refreshOutline,
  refreshCircleOutline,
  statsChartOutline,
  playCircleOutline,
  pauseCircleOutline,
  timeOutline,
  documentTextOutline,
  flashOutline,
  checkmarkCircleOutline,
  heartOutline,
  serverOutline,
  cloudOutline,
  desktopOutline,
} from 'ionicons/icons';

import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { llmAnalyticsService } from '@/services/llmAnalyticsService';
import LlmUsageTable from '@/components/Admin/LlmUsageTable.vue';
import LlmAnalytics from '@/components/Admin/LlmAnalytics.vue';
import { storeToRefs } from 'pinia';

const store = useLLMAnalyticsStore();

// Reactive data
const selectedTab = ref('overview');
const autoRefreshEnabled = ref(false);
const routeFilter = ref<'all' | 'local' | 'remote'>('all');

// Computed - Use storeToRefs to maintain reactivity
const { usageRecords, stats, activeRuns, loading: _loading } = storeToRefs(store);

const recentRecords = computed(() => {
  return (usageRecords.value || [])
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 5);
});

const routeSplit = computed(() => {
  const records = usageRecords.value || [];
  const total = records.length || 0;
  const local = records.filter((r: Record<string, unknown>) => (r.route ? r.route === 'local' : r.is_local)).length;
  const remote = total - local;
  const localPercent = total ? Math.round((local / total) * 100) : 0;
  const remotePercent = total ? 100 - localPercent : 0;
  return { total, local, remote, localPercent, remotePercent };
});

// Methods
const onTabChange = (event: CustomEvent) => {
  selectedTab.value = event.detail.value;
  
  // Load data for the selected tab
  switch (selectedTab.value) {
    case 'records':
      if (!usageRecords.value || usageRecords.value.length === 0) {
        store.fetchUsageRecords();
      }
      break;
    case 'analytics':
      store.fetchAnalytics();
      break;
    case 'monitoring':
      store.fetchActiveRuns();
      break;
  }
};

const onRouteFilterChange = async () => {
  const route = routeFilter.value === 'all' ? undefined : routeFilter.value;
  // Update store filters for records
  store.updateFilters({ route: route as string });
  await store.fetchUsageRecords();
  // Update analytics
  store.updateAnalyticsFilters({ route: route as string });
  await store.fetchAnalytics();
};

const applyPresetLocal7d = async () => {
  routeFilter.value = 'local';
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = new Date().toISOString().split('T')[0];
  store.updateFilters({ route: 'local' as string, startDate: start, endDate: end });
  await store.fetchUsageRecords();
  store.updateAnalyticsFilters({ route: 'local' as string, startDate: start, endDate: end });
  await store.fetchAnalytics();
};

const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value;
  
  if (autoRefreshEnabled.value) {
    store.startAutoRefresh(30000); // 30 seconds
  } else {
    store.stopAutoRefresh();
  }
};

const formatDuration = (ms: number | null) => {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4
  }).format(amount);
};

const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
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

const getStatusColor = (status: string) => {
  return llmAnalyticsService.getStatusColor(status);
};

// Lifecycle
onMounted(async () => {
  // Initialize store and load overview data
  await store.initialize();
  
  // Set up periodic refresh for overview stats
  store.startAutoRefresh(60000); // 1 minute for stats
});

onUnmounted(() => {
  store.stopAutoRefresh();
});
</script>

<style scoped>
.tab-content {
  padding: 0;
}

.tab-panel {
  min-height: calc(100vh - 120px);
}

.overview-section {
  padding: 16px;
}

.monitoring-section {
  padding: 16px;
}

.quick-stat {
  text-align: center;
  padding: 8px;
}

.route-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.route-label {
  font-weight: 600;
}
.route-values {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.route-count {
  font-size: 1.25rem;
  font-weight: 700;
}
.route-percent {
  color: var(--ion-color-medium);
}

.stat-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.recent-activity {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-color-light-tint);
}

.activity-item.clickable { cursor: pointer; }
.activity-item.clickable:hover { background: var(--ion-color-light-shade); }

.activity-icon {
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.activity-details {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 2px;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.activity-status {
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 8px 0;
  color: var(--ion-color-dark);
}

.active-runs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.active-run-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid var(--ion-color-primary-tint);
  border-radius: 8px;
  background: var(--ion-color-primary-tint);
}

.run-info {
  flex: 1;
}

.run-id {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--ion-color-primary);
  margin-bottom: 4px;
}

.run-details {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.run-status {
  flex-shrink: 0;
}

.health-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.health-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
}

.health-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.health-label {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.health-value {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .activity-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .activity-status {
    align-self: flex-end;
  }
  
  .health-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
