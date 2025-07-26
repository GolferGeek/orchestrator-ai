<template>
  <ion-card class="pool-stats-card">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="statsChartOutline" class="title-icon"></ion-icon>
        Pool Statistics
      </ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="circles"></ion-spinner>
      </div>

      <!-- Stats Content -->
      <div v-else-if="stats" class="stats-content">
        <!-- Overview Stats -->
        <div class="stats-overview">
          <div class="stat-item total">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">Total MCPs</div>
          </div>
          <div class="stat-item online">
            <div class="stat-value">{{ stats.online }}</div>
            <div class="stat-label">Online</div>
          </div>
          <div class="stat-item offline">
            <div class="stat-value">{{ stats.offline }}</div>
            <div class="stat-label">Offline</div>
          </div>
        </div>

        <!-- Tools and Capabilities -->
        <div class="secondary-stats">
          <div class="secondary-stat">
            <ion-icon :icon="buildOutline" class="stat-icon"></ion-icon>
            <span class="stat-text">{{ stats.totalTools }} Tools</span>
          </div>
          <div class="secondary-stat">
            <ion-icon :icon="extensionPuzzleOutline" class="stat-icon"></ion-icon>
            <span class="stat-text">{{ stats.totalCapabilities }} Capabilities</span>
          </div>
        </div>

        <!-- Health Score -->
        <div class="health-score-section">
          <div class="health-score-label">Overall Health Score</div>
          <div class="health-score-container">
            <ion-progress-bar 
              :value="healthPercentage" 
              :color="healthColor"
              class="health-progress"
            ></ion-progress-bar>
            <span class="health-score-value">{{ stats.healthScore }}%</span>
          </div>
        </div>

        <!-- By Type Breakdown -->
        <div class="breakdown-section">
          <h4 class="breakdown-title">
            <ion-icon :icon="layersOutline" class="breakdown-icon"></ion-icon>
            By Type
          </h4>
          <div class="breakdown-grid">
            <div 
              v-for="(count, type) in stats.byType" 
              :key="type"
              class="breakdown-item"
              :class="{ 'clickable': count > 0 }"
              @click="count > 0 && $emit('type-filter', type)"
            >
              <ion-badge :color="getTypeColor(type)" class="type-badge">
                {{ formatTypeName(type) }}
              </ion-badge>
              <span class="breakdown-count">{{ count }}</span>
            </div>
          </div>
        </div>

        <!-- By Provider Breakdown -->
        <div v-if="hasProviders" class="breakdown-section">
          <h4 class="breakdown-title">
            <ion-icon :icon="businessOutline" class="breakdown-icon"></ion-icon>
            By Provider
          </h4>
          <div class="breakdown-grid">
            <div 
              v-for="(count, provider) in stats.byProvider" 
              :key="provider"
              class="breakdown-item clickable"
              @click="$emit('provider-filter', provider)"
            >
              <ion-badge color="tertiary" class="provider-badge">
                {{ formatProviderName(provider) }}
              </ion-badge>
              <span class="breakdown-count">{{ count }}</span>
            </div>
          </div>
        </div>

        <!-- Status Distribution Chart -->
        <div class="status-chart">
          <h4 class="breakdown-title">Status Distribution</h4>
          <div class="chart-container">
            <div class="chart-bar">
              <div class="chart-segment online" :style="{ width: onlinePercentage + '%' }"></div>
              <div class="chart-segment offline" :style="{ width: offlinePercentage + '%' }"></div>
              <div class="chart-segment discovering" :style="{ width: discoveringPercentage + '%' }"></div>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <div class="legend-color online"></div>
                <span>Online ({{ stats.online }})</span>
              </div>
              <div class="legend-item">
                <div class="legend-color offline"></div>
                <span>Offline ({{ stats.offline }})</span>
              </div>
              <div class="legend-item">
                <div class="legend-color discovering"></div>
                <span>Discovering ({{ stats.discovering || 0 }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="no-data">
        <ion-icon :icon="barChartOutline" class="no-data-icon"></ion-icon>
        <p>No statistics available</p>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonProgressBar
} from '@ionic/vue';
import {
  statsChartOutline,
  buildOutline,
  extensionPuzzleOutline,
  layersOutline,
  businessOutline,
  barChartOutline
} from 'ionicons/icons';

import type { MCPPoolStats } from '@/types/mcp';

// Props
interface Props {
  stats?: MCPPoolStats | null;
  loading?: boolean;
}

const props = defineProps<Props>();

// Emits
defineEmits<{
  'type-filter': [type: string];
  'provider-filter': [provider: string];
}>();

// Computed properties
const healthPercentage = computed(() => {
  return (props.stats?.healthScore || 0) / 100;
});

const healthColor = computed(() => {
  const score = props.stats?.healthScore || 0;
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
});

const hasProviders = computed(() => {
  return props.stats?.byProvider && Object.keys(props.stats.byProvider).length > 0;
});

const onlinePercentage = computed(() => {
  if (!props.stats || props.stats.total === 0) return 0;
  return (props.stats.online / props.stats.total) * 100;
});

const offlinePercentage = computed(() => {
  if (!props.stats || props.stats.total === 0) return 0;
  return (props.stats.offline / props.stats.total) * 100;
});

const discoveringPercentage = computed(() => {
  if (!props.stats || props.stats.total === 0) return 0;
  return ((props.stats.discovering || 0) / props.stats.total) * 100;
});

// Methods
const getTypeColor = (type: string): string => {
  switch (type) {
    case 'database': return 'primary';
    case 'api': return 'secondary';
    case 'file': return 'tertiary';
    case 'communication': return 'success';
    case 'computation': return 'warning';
    case 'external': return 'medium';
    default: return 'dark';
  }
};

const formatTypeName = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatProviderName = (provider: string): string => {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};
</script>

<style scoped>
.pool-stats-card {
  height: fit-content;
}

.title-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  text-align: center;
}

.stat-item {
  padding: 12px;
  border-radius: 8px;
}

.stat-item.total {
  background: var(--ion-color-primary-tint);
}

.stat-item.online {
  background: var(--ion-color-success-tint);
}

.stat-item.offline {
  background: var(--ion-color-danger-tint);
}

.stat-value {
  font-size: 1.8em;
  font-weight: bold;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.secondary-stats {
  display: flex;
  justify-content: space-around;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.secondary-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--ion-color-dark);
}

.stat-icon {
  color: var(--ion-color-medium);
}

.health-score-section {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.health-score-label {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
  text-align: center;
}

.health-score-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.health-progress {
  flex: 1;
  height: 8px;
  border-radius: 4px;
}

.health-score-value {
  font-weight: bold;
  color: var(--ion-color-dark);
  min-width: 40px;
}

.breakdown-section {
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 16px;
}

.breakdown-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 1em;
  color: var(--ion-color-dark);
}

.breakdown-icon {
  color: var(--ion-color-medium);
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--ion-color-light);
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.breakdown-item.clickable {
  cursor: pointer;
}

.breakdown-item.clickable:hover {
  background: var(--ion-color-light-shade);
}

.type-badge,
.provider-badge {
  font-size: 0.8em;
  text-transform: capitalize;
}

.breakdown-count {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.status-chart {
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 16px;
}

.chart-container {
  margin-top: 12px;
}

.chart-bar {
  display: flex;
  height: 20px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ion-color-light-shade);
  margin-bottom: 12px;
}

.chart-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.chart-segment.online {
  background: var(--ion-color-success);
}

.chart-segment.offline {
  background: var(--ion-color-danger);
}

.chart-segment.discovering {
  background: var(--ion-color-warning);
}

.chart-legend {
  display: flex;
  justify-content: space-around;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.online {
  background: var(--ion-color-success);
}

.legend-color.offline {
  background: var(--ion-color-danger);
}

.legend-color.discovering {
  background: var(--ion-color-warning);
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

@media (max-width: 480px) {
  .stats-overview {
    grid-template-columns: 1fr;
  }
  
  .secondary-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-legend {
    flex-direction: column;
    align-items: center;
  }
}
</style>