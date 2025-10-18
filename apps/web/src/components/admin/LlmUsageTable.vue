<template>
  <div class="llm-usage-table">
    <!-- Filters -->
    <div class="filters-section">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="filterOutline" />
            Filters
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-select
                    v-model="localFilters.callerType"
                    placeholder="Caller Type"
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
              
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-select
                    v-model="localFilters.callerName"
                    placeholder="Caller Name"
                    interface="popover"
                    @ion-change="applyFilters"
                  >
                    <ion-select-option value="">All Names</ion-select-option>
                    <ion-select-option 
                      v-for="name in callerNames" 
                      :key="name" 
                      :value="name"
                    >
                      {{ name }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-input
                    v-model="localFilters.startDate"
                    type="date"
                    placeholder="Start Date"
                    @ion-change="applyFilters"
                  />
                </ion-item>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-input
                    v-model="localFilters.endDate"
                    type="date"
                    placeholder="End Date"
                    @ion-change="applyFilters"
                  />
                </ion-item>
              </ion-col>
            </ion-row>
            
            <ion-row>
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-select
                    v-model="localFilters.route"
                    placeholder="Route"
                    interface="popover"
                    @ion-change="applyFilters"
                  >
                    <ion-select-option value="">All Routes</ion-select-option>
                    <ion-select-option value="local">Local</ion-select-option>
                    <ion-select-option value="remote">Remote</ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-item>
                  <ion-input
                    v-model="localFilters.limit"
                    type="number"
                    placeholder="Limit"
                    min="1"
                    max="1000"
                    @ion-change="applyFilters"
                  />
                </ion-item>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-button 
                  fill="outline" 
                  @click="clearFilters"
                  :disabled="loading"
                >
                  <ion-icon :icon="refreshOutline" slot="start" />
                  Clear Filters
                </ion-button>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="3">
                <ion-button 
                  fill="solid" 
                  @click="refreshData"
                  :disabled="loading"
                >
                  <ion-icon :icon="refreshOutline" slot="start" />
                  Refresh
                </ion-button>
              </ion-col>

              <ion-col size="12" size-md="6" size-lg="3">
                <ion-button 
                  fill="outline" 
                  color="secondary"
                  @click="exportCsv"
                  :disabled="loading || usageRecords.length === 0"
                >
                  Export CSV
                </ion-button>
              </ion-col>

              <ion-col size="12" size-md="6" size-lg="3">
                <ion-button 
                  fill="outline" 
                  color="tertiary"
                  @click="applyPresetLocal7d"
                  :disabled="loading"
                >
                  Local last 7 days
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Summary Stats -->
    <div class="stats-section">
      <ion-grid>
        <ion-row>
          <ion-col size="6" size-md="3">
            <ion-card>
              <ion-card-content>
                <div class="stat-item">
                  <div class="stat-value">{{ usageRecords.length }}</div>
                  <div class="stat-label">Total Records</div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card>
              <ion-card-content>
                <div class="stat-item">
                  <div class="stat-value">{{ llmAnalyticsService.formatCost(totalCost) }}</div>
                  <div class="stat-label">Total Cost</div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card>
              <ion-card-content>
                <div class="stat-item">
                  <div class="stat-value">{{ successRate.toFixed(1) }}%</div>
                  <div class="stat-label">Success Rate</div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          
          <ion-col size="6" size-md="3">
            <ion-card>
              <ion-card-content>
                <div class="stat-item">
                  <div class="stat-value">{{ llmAnalyticsService.formatDuration(avgDuration) }}</div>
                  <div class="stat-label">Avg Duration</div>
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ion-spinner name="crescent" />
      <p>Loading usage records...</p>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="error" color="danger">
      <ion-card-content>
        <h3>Error</h3>
        <p>{{ error }}</p>
        <ion-button fill="outline" @click="clearError">
          <ion-icon :icon="closeOutline" slot="start" />
          Dismiss
        </ion-button>
      </ion-card-content>
    </ion-card>

    <!-- Data Table -->
    <div v-else class="table-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="analyticsOutline" />
            LLM Usage Records
          </ion-card-title>
        </ion-card-header>
        
        <ion-card-content>
          <div class="table-wrapper">
            <table class="usage-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Caller</th>
                  <th>Model</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>PII</th>
                  <th>Duration</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in usageRecords" :key="record.id">
                  <td>
                    <div class="time-cell">
                      <div class="date">{{ formatDate(record.started_at) }}</div>
                      <div class="time">{{ formatTime(record.started_at) }}</div>
                    </div>
                  </td>
                  
                  <td>
                    <div class="caller-cell">
                      <ion-icon 
                        :icon="getCallerIcon(record.caller_type)" 
                        :color="getCallerColor(record.caller_type)"
                      />
                      <div>
                        <div class="caller-type">{{ record.caller_type }}</div>
                        <div class="caller-name">{{ record.caller_name }}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td>
                    <div class="model-cell">
                      <div class="provider">{{ record.provider_name }}</div>
                      <div class="model">{{ record.model_name }}</div>
                      <ion-chip 
                        v-if="record.is_local" 
                        color="success" 
                        size="small"
                      >
                        Local
                      </ion-chip>
                    </div>
                  </td>

                  <td>
                    <ion-chip :color="(record.route ?? (record.is_local ? 'local' : 'remote')) === 'local' ? 'success' : 'tertiary'" size="small">
                      {{ (record.route ?? (record.is_local ? 'local' : 'remote')) }}
                    </ion-chip>
                  </td>
                  
                  <td>
                    <ion-chip 
                      :color="llmAnalyticsService.getStatusColor(record.status)"
                      size="small"
                    >
                      {{ record.status }}
                    </ion-chip>
                  </td>
                  
                  <td>
                    <div class="pii-indicators">
                      <ion-badge 
                        v-if="record.pii_detected"
                        color="warning"
                        @click="viewDetails(record)"
                        class="clickable"
                      >
                        <ion-icon :icon="warningOutline" />
                        {{ record.pseudonyms_used || 0 }}P / {{ record.redactions_applied || 0 }}R
                      </ion-badge>
                      <ion-badge 
                        v-else
                        color="success"
                      >
                        <ion-icon :icon="checkmarkCircleOutline" />
                        Clean
                      </ion-badge>
                    </div>
                  </td>
                  
                  <td>{{ llmAnalyticsService.formatDuration(record.duration_ms) }}</td>
                  
                  <td>
                    <div class="tokens-cell">
                      <div v-if="record.input_tokens">
                        In: {{ llmAnalyticsService.formatTokens(record.input_tokens) }}
                      </div>
                      <div v-if="record.output_tokens">
                        Out: {{ llmAnalyticsService.formatTokens(record.output_tokens) }}
                      </div>
                    </div>
                  </td>
                  
                  <td>{{ llmAnalyticsService.formatCost(record.total_cost) }}</td>
                  
                  <td>
                    <ion-button 
                      fill="clear" 
                      size="small"
                      @click="viewDetails(record)"
                      title="Quick View"
                    >
                      <ion-icon :icon="eyeOutline" />
                    </ion-button>
                    <ion-button 
                      fill="clear"
                      size="small"
                      :router-link="{ name: 'LLMUsageDetails', params: { runId: record.run_id } }"
                      title="Open Details Page"
                    >
                      <ion-icon :icon="documentOutline" />
                    </ion-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Empty State -->
          <div v-if="usageRecords.length === 0" class="empty-state">
            <ion-icon :icon="documentOutline" size="large" />
            <h3>No Usage Records</h3>
            <p>No LLM usage records found with the current filters.</p>
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- PII Details Modal -->
    <LLMUsageDetailModal
      :is-open="showDetailsModal"
      :run-id="selectedRecord?.run_id"
      @update:is-open="showDetailsModal = $event"
      @dismiss="closeDetails"
    />
    
    <!-- Old Details Modal (Backup) -->
    <ion-modal v-if="false" :is-open="showDetailsModal" @did-dismiss="closeDetails">
      <ion-header>
        <ion-toolbar>
          <ion-title>Usage Record Details</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeDetails">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content v-if="selectedRecord">
        <ion-list>
          <ion-item>
            <ion-label>
              <h3>Run ID</h3>
              <p>{{ selectedRecord.run_id }}</p>
            </ion-label>
          </ion-item>
          
          <ion-item>
            <ion-label>
              <h3>Conversation ID</h3>
              <p>{{ selectedRecord.conversation_id || 'N/A' }}</p>
            </ion-label>
          </ion-item>
          
          <ion-item>
            <ion-label>
              <h3>Routing Reason</h3>
              <p>{{ selectedRecord.routing_reason || 'N/A' }}</p>
            </ion-label>
          </ion-item>
          
          <ion-item>
            <ion-label>
              <h3>Complexity</h3>
              <p>{{ selectedRecord.complexity_level || 'N/A' }} (Score: {{ selectedRecord.complexity_score || 'N/A' }})</p>
            </ion-label>
          </ion-item>
          
          <ion-item v-if="selectedRecord.error_message">
            <ion-label>
              <h3>Error Message</h3>
              <p class="error-text">{{ selectedRecord.error_message }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonChip,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonList,
  IonLabel,
  IonBadge
} from '@ionic/vue';
import {
  filterOutline,
  refreshOutline,
  closeOutline,
  analyticsOutline,
  documentOutline,
  eyeOutline,
  warningOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { llmAnalyticsService, type LlmUsageRecord } from '@/services/llmAnalyticsService';
import { storeToRefs } from 'pinia';
import LLMUsageDetailModal from './LLMUsageDetailModal.vue';

const store = useLLMAnalyticsStore();

// Reactive data
const localFilters = ref({
  callerType: '',
  callerName: '',
  startDate: '',
  endDate: '',
  limit: 100,
  route: '' as '' | 'local' | 'remote'
});

const showDetailsModal = ref(false);
const selectedRecord = ref<LlmUsageRecord | null>(null);

// Computed - Use storeToRefs to maintain reactivity
const { 
  usageRecords, 
  loading, 
  error, 
  totalCost, 
  successRate, 
  avgDuration,
  callerTypes,
  callerNames 
} = storeToRefs(store);

// Methods
const applyFilters = () => {
  const filters = { ...localFilters.value };
  // Remove empty strings
  Object.keys(filters).forEach(key => {
    if (filters[key] === '') {
      delete filters[key];
    }
  });
  
  store.updateFilters(filters);
  store.fetchUsageRecords();
};

const clearFilters = () => {
  localFilters.value = {
    callerType: '',
    callerName: '',
    startDate: '',
    endDate: '',
    limit: 100,
    route: ''
  };
  store.clearFilters();
  store.fetchUsageRecords();
};

const refreshData = () => {
  store.fetchUsageRecords();
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString();
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

const viewDetails = (record: LlmUsageRecord) => {
  selectedRecord.value = record;
  showDetailsModal.value = true;
};

const closeDetails = () => {
  showDetailsModal.value = false;
  selectedRecord.value = null;
};

const clearError = () => {
  store.clearError();
};

const exportCsv = () => {
  const headers = [
    'started_at',
    'caller_type',
    'caller_name',
    'provider_name',
    'model_name',
    'route',
    'status',
    'duration_ms',
    'input_tokens',
    'output_tokens',
    'total_cost',
    'run_id',
  ];
  const rows = usageRecords.value.map((r) => [
    r.started_at,
    r.caller_type,
    r.caller_name,
    r.provider_name,
    r.model_name,
    (r.route ?? (r.is_local ? 'local' : 'remote')),
    r.status,
    r.duration_ms ?? '',
    r.input_tokens ?? '',
    r.output_tokens ?? '',
    r.total_cost ?? '',
    r.run_id,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm_usage_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const applyPresetLocal7d = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString().split('T')[0];
  const end = new Date().toISOString().split('T')[0];
  localFilters.value.startDate = start;
  localFilters.value.endDate = end;
  localFilters.value.route = 'local';
  applyFilters();
};

// Lifecycle
onMounted(() => {
  store.initialize();
});

onUnmounted(() => {
  store.stopAutoRefresh();
});
</script>

<style scoped>
.llm-usage-table {
  padding: 16px;
}

.filters-section {
  margin-bottom: 16px;
}

.stats-section {
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
}

.table-wrapper {
  overflow-x: auto;
}

.usage-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

.usage-table th,
.usage-table td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid var(--ion-color-light);
}

.usage-table th {
  background-color: var(--ion-color-light);
  font-weight: 600;
  color: var(--ion-color-dark);
}

.time-cell {
  min-width: 120px;
}

.time-cell .date {
  font-weight: 500;
}

.time-cell .time {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.caller-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.caller-cell .caller-type {
  font-weight: 500;
  text-transform: capitalize;
}

.caller-cell .caller-name {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.model-cell {
  min-width: 160px;
}

.model-cell .provider {
  font-weight: 500;
}

.model-cell .model {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.tokens-cell {
  font-size: 0.875rem;
}

.pii-indicators {
  display: flex;
  justify-content: center;
  align-items: center;
}

.pii-indicators ion-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 2px 8px;
}

.pii-indicators ion-badge.clickable {
  cursor: pointer;
}

.pii-indicators ion-badge.clickable:hover {
  opacity: 0.8;
}

.pii-indicators ion-badge ion-icon {
  font-size: 0.875rem;
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

.error-text {
  color: var(--ion-color-danger);
  font-family: monospace;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .usage-table {
    font-size: 0.875rem;
  }
  
  .usage-table th,
  .usage-table td {
    padding: 8px 4px;
  }
}
</style>
