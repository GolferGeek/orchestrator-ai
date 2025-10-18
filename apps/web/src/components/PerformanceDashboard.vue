<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-title>Performance Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshMetrics">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
          <ion-button @click="closeModal">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Core Web Vitals -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Core Web Vitals</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="vitals-grid">
            <div class="vital-metric">
              <div class="metric-value" :class="getLCPClass(coreVitals.lcp)">
                {{ formatTime(coreVitals.lcp) }}
              </div>
              <div class="metric-label">LCP (Largest Contentful Paint)</div>
            </div>
            <div class="vital-metric">
              <div class="metric-value" :class="getFCPClass(coreVitals.fcp)">
                {{ formatTime(coreVitals.fcp) }}
              </div>
              <div class="metric-label">FCP (First Contentful Paint)</div>
            </div>
            <div class="vital-metric">
              <div class="metric-value" :class="getTTFBClass(coreVitals.ttfb)">
                {{ formatTime(coreVitals.ttfb) }}
              </div>
              <div class="metric-label">TTFB (Time to First Byte)</div>
            </div>
            <div class="vital-metric">
              <div class="metric-value" :class="getCLSClass(coreVitals.cls)">
                {{ formatCLS(coreVitals.cls) }}
              </div>
              <div class="metric-label">CLS (Cumulative Layout Shift)</div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Performance Summary -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Performance Summary</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-row>
            <ion-col size="6">
              <div class="summary-metric">
                <div class="metric-value">{{ formatTime(summary.averageRenderTime) }}</div>
                <div class="metric-label">Avg Render Time</div>
              </div>
            </ion-col>
            <ion-col size="6">
              <div class="summary-metric">
                <div class="metric-value">{{ formatTime(summary.averageAPITime) }}</div>
                <div class="metric-label">Avg API Time</div>
              </div>
            </ion-col>
          </ion-row>
        </ion-card-content>
      </ion-card>

      <!-- Slowest Operations -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Slowest Operations</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-segment v-model="selectedTab" @ion-change="onSegmentChange">
            <ion-segment-button value="renders">
              <ion-label>Renders</ion-label>
            </ion-segment-button>
            <ion-segment-button value="apis">
              <ion-label>API Calls</ion-label>
            </ion-segment-button>
            <ion-segment-button value="metrics">
              <ion-label>Metrics</ion-label>
            </ion-segment-button>
          </ion-segment>

          <!-- Renders Tab -->
          <div v-if="selectedTab === 'renders'" class="tab-content">
            <div v-if="summary.slowestRenders.length === 0" class="no-data">
              No render data available
            </div>
            <ion-list v-else>
              <ion-item v-for="render in summary.slowestRenders.slice(0, 10)" :key="render.timestamp">
                <ion-label>
                  <h3>{{ render.component }}</h3>
                  <p>{{ formatTime(render.renderTime) }}</p>
                </ion-label>
                <ion-badge 
                  slot="end" 
                  :color="render.renderTime > 16 ? 'danger' : render.renderTime > 8 ? 'warning' : 'success'"
                >
                  {{ render.renderTime.toFixed(1) }}ms
                </ion-badge>
              </ion-item>
            </ion-list>
          </div>

          <!-- APIs Tab -->
          <div v-if="selectedTab === 'apis'" class="tab-content">
            <div v-if="summary.slowestAPIs.length === 0" class="no-data">
              No API data available
            </div>
            <ion-list v-else>
              <ion-item v-for="api in summary.slowestAPIs.slice(0, 10)" :key="api.timestamp">
                <ion-label>
                  <h3>{{ api.method }} {{ api.endpoint }}</h3>
                  <p>{{ formatTime(api.responseTime) }} - Status: {{ api.status }}</p>
                </ion-label>
                <ion-badge 
                  slot="end" 
                  :color="getAPIBadgeColor(api.responseTime, api.status)"
                >
                  {{ api.responseTime.toFixed(0) }}ms
                </ion-badge>
              </ion-item>
            </ion-list>
          </div>

          <!-- Metrics Tab -->
          <div v-if="selectedTab === 'metrics'" class="tab-content">
            <div v-if="summary.slowestMetrics.length === 0" class="no-data">
              No metric data available
            </div>
            <ion-list v-else>
              <ion-item v-for="metric in summary.slowestMetrics.slice(0, 10)" :key="metric.startTime">
                <ion-label>
                  <h3>{{ metric.name }}</h3>
                  <p>{{ formatTime(metric.duration || 0) }}</p>
                  <p v-if="metric.details" class="metric-details">
                    {{ JSON.stringify(metric.details) }}
                  </p>
                </ion-label>
                <ion-badge 
                  slot="end" 
                  :color="(metric.duration || 0) > 100 ? 'danger' : (metric.duration || 0) > 50 ? 'warning' : 'success'"
                >
                  {{ (metric.duration || 0).toFixed(1) }}ms
                </ion-badge>
              </ion-item>
            </ion-list>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Actions -->
      <ion-card>
        <ion-card-content>
          <ion-button expand="block" @click="clearMetrics" color="warning">
            Clear All Metrics
          </ion-button>
          <ion-button expand="block" @click="exportMetrics" color="primary">
            Export Performance Data
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonRow, IonCol, IonSegment, IonSegmentButton, IonLabel,
  IonList, IonItem, IonBadge
} from '@ionic/vue';
import { refreshOutline, closeOutline } from 'ionicons/icons';
import { usePerformanceTracking } from '../utils/performanceMonitor';

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { getPerformanceSummary, measureCoreWebVitals } = usePerformanceTracking();

const selectedTab = ref('renders');
const summary = ref({
  slowestMetrics: [],
  slowestRenders: [],
  slowestAPIs: [],
  averageRenderTime: 0,
  averageAPITime: 0
});

const coreVitals = ref({
  lcp: null as number | null,
  fid: null as number | null,
  cls: null as number | null,
  fcp: null as number | null,
  ttfb: null as number | null
});

const closeModal = () => {
  emit('close');
};

const refreshMetrics = async () => {
  summary.value = getPerformanceSummary();
  coreVitals.value = await measureCoreWebVitals();
};

const clearMetrics = () => {
  // Clear metrics through the performance monitor
  summary.value = {
    slowestMetrics: [],
    slowestRenders: [],
    slowestAPIs: [],
    averageRenderTime: 0,
    averageAPITime: 0
  };
};

const exportMetrics = () => {
  const data = {
    timestamp: new Date().toISOString(),
    coreVitals: coreVitals.value,
    summary: summary.value
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-metrics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const onSegmentChange = (event: CustomEvent) => {
  selectedTab.value = event.detail.value;
};

// Formatting functions
const formatTime = (time: number | null): string => {
  if (time === null || time === undefined) return 'N/A';
  return `${time.toFixed(1)}ms`;
};

const formatCLS = (cls: number | null): string => {
  if (cls === null || cls === undefined) return 'N/A';
  return cls.toFixed(3);
};

// Core Web Vitals scoring
const getLCPClass = (lcp: number | null): string => {
  if (lcp === null) return 'metric-unknown';
  if (lcp <= 2500) return 'metric-good';
  if (lcp <= 4000) return 'metric-needs-improvement';
  return 'metric-poor';
};

const getFCPClass = (fcp: number | null): string => {
  if (fcp === null) return 'metric-unknown';
  if (fcp <= 1800) return 'metric-good';
  if (fcp <= 3000) return 'metric-needs-improvement';
  return 'metric-poor';
};

const getTTFBClass = (ttfb: number | null): string => {
  if (ttfb === null) return 'metric-unknown';
  if (ttfb <= 600) return 'metric-good';
  if (ttfb <= 1200) return 'metric-needs-improvement';
  return 'metric-poor';
};

const getCLSClass = (cls: number | null): string => {
  if (cls === null) return 'metric-unknown';
  if (cls <= 0.1) return 'metric-good';
  if (cls <= 0.25) return 'metric-needs-improvement';
  return 'metric-poor';
};

const getAPIBadgeColor = (responseTime: number, status: number): string => {
  if (status >= 400) return 'danger';
  if (responseTime > 1000) return 'danger';
  if (responseTime > 500) return 'warning';
  return 'success';
};

onMounted(async () => {
  if (props.isOpen) {
    await refreshMetrics();
  }
});
</script>

<style scoped>
.vitals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.vital-metric {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: var(--ion-color-light);
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.metric-good {
  color: var(--ion-color-success);
}

.metric-needs-improvement {
  color: var(--ion-color-warning);
}

.metric-poor {
  color: var(--ion-color-danger);
}

.metric-unknown {
  color: var(--ion-color-medium);
}

.summary-metric {
  text-align: center;
  padding: 12px;
}

.tab-content {
  margin-top: 16px;
}

.no-data {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 24px;
}

.metric-details {
  font-size: 10px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
</style>