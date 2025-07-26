<template>
  <ion-card class="services-list-card">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="serverOutline" class="title-icon"></ion-icon>
        MCP Services
      </ion-card-title>
      <ion-card-subtitle>
        {{ mcps.length }} service{{ mcps.length !== 1 ? 's' : '' }} registered
      </ion-card-subtitle>
    </ion-card-header>
    <ion-card-content>
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="circles"></ion-spinner>
        <p>Loading MCP services...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="mcps.length === 0" class="empty-state">
        <ion-icon :icon="layersOutline" class="empty-icon"></ion-icon>
        <h3>No MCP Services Found</h3>
        <p>No MCP services are currently registered. Try discovering services or check your configuration.</p>
        <ion-button @click="$emit('refresh')" fill="outline">
          <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
          Refresh
        </ion-button>
      </div>

      <!-- Services List -->
      <div v-else class="services-list">
        <div 
          v-for="mcp in mcps" 
          :key="mcp.id" 
          class="service-item"
          @click="$emit('view-details', mcp)"
        >
          <!-- Service Header -->
          <div class="service-header">
            <div class="service-info">
              <h3 class="service-name">{{ mcp.name }}</h3>
              <p class="service-description">{{ mcp.description }}</p>
            </div>
            <div class="service-status">
              <ion-badge :color="getStatusColor(mcp.status)" class="status-badge">
                {{ mcp.status }}
              </ion-badge>
            </div>
          </div>

          <!-- Service Metadata -->
          <div class="service-meta">
            <div class="meta-item">
              <ion-icon :icon="businessOutline" class="meta-icon"></ion-icon>
              <span class="meta-label">Type:</span>
              <ion-badge :color="getTypeColor(mcp.type)" fill="outline" class="type-badge">
                {{ mcp.type }}
              </ion-badge>
            </div>
            <div class="meta-item">
              <ion-icon :icon="globeOutline" class="meta-icon"></ion-icon>
              <span class="meta-label">Provider:</span>
              <span class="meta-value">{{ mcp.provider }}</span>
            </div>
            <div class="meta-item">
              <ion-icon :icon="buildOutline" class="meta-icon"></ion-icon>
              <span class="meta-label">Tools:</span>
              <span class="meta-value">{{ mcp.tools.length }}</span>
            </div>
            <div class="meta-item">
              <ion-icon :icon="extensionPuzzleOutline" class="meta-icon"></ion-icon>
              <span class="meta-label">Capabilities:</span>
              <span class="meta-value">{{ mcp.capabilities.length }}</span>
            </div>
          </div>

          <!-- Service Stats (if available) -->
          <div v-if="mcp.metrics" class="service-stats">
            <div class="stat-item">
              <span class="stat-label">Executions:</span>
              <span class="stat-value">{{ mcp.metrics.totalExecutions || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Success Rate:</span>
              <span class="stat-value success-rate">
                {{ formatSuccessRate(mcp.metrics) }}%
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Avg Time:</span>
              <span class="stat-value">{{ formatExecutionTime(mcp.metrics.averageExecutionTime) }}</span>
            </div>
          </div>

          <!-- Last Seen -->
          <div class="service-footer">
            <div class="last-seen">
              <ion-icon :icon="timeOutline" class="time-icon"></ion-icon>
              Last seen: {{ formatLastSeen(mcp.lastHeartbeat || mcp.discoveredAt) }}
            </div>
            <div class="service-actions">
              <ion-button 
                v-if="mcp.tools.length > 0"
                @click.stop="handleQuickTool(mcp)"
                fill="clear" 
                size="small"
                color="primary"
              >
                <ion-icon :icon="playOutline" slot="icon-only"></ion-icon>
              </ion-button>
              <ion-button 
                @click.stop="$emit('view-details', mcp)"
                fill="clear" 
                size="small"
                color="medium"
              >
                <ion-icon :icon="informationCircleOutline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
          </div>

          <!-- Health Indicator -->
          <div class="health-indicator" :class="`health-${getHealthLevel(mcp)}`"></div>
        </div>
      </div>

      <!-- Quick Tool Selection Modal -->
      <ion-modal :is-open="showQuickToolModal" @did-dismiss="showQuickToolModal = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Select Tool - {{ selectedMCP?.name }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showQuickToolModal = false">
                <ion-icon :icon="closeOutline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list>
            <ion-item 
              v-for="tool in selectedMCP?.tools" 
              :key="tool.name"
              button
              @click="handleToolSelection(tool)"
            >
              <ion-label>
                <h2>{{ tool.name }}</h2>
                <p>{{ tool.description }}</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonButton,
  IonSpinner,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonList,
  IonItem,
  IonLabel
} from '@ionic/vue';
import {
  serverOutline,
  layersOutline,
  refreshOutline,
  businessOutline,
  globeOutline,
  buildOutline,
  extensionPuzzleOutline,
  timeOutline,
  playOutline,
  informationCircleOutline,
  closeOutline,
  chevronForwardOutline
} from 'ionicons/icons';

import type { MCPRegistration, MCPTool, MCPMetrics } from '@/types/mcp';

// Props
interface Props {
  mcps: MCPRegistration[];
  loading?: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'execute-tool': [mcp: MCPRegistration, tool: MCPTool];
  'view-details': [mcp: MCPRegistration];
  'refresh': [];
}>();

// Local state
const showQuickToolModal = ref(false);
const selectedMCP = ref<MCPRegistration | null>(null);

// Methods
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online': return 'success';
    case 'offline': return 'danger';
    case 'discovering': return 'warning';
    default: return 'medium';
  }
};

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

const getHealthLevel = (mcp: MCPRegistration): string => {
  if (mcp.status === 'offline') return 'poor';
  if (mcp.status === 'discovering') return 'fair';
  
  // Calculate health based on metrics and heartbeat
  if (mcp.metrics?.errorRate && mcp.metrics.errorRate > 0.2) return 'fair';
  if (mcp.lastHeartbeat) {
    const minutesAgo = (Date.now() - mcp.lastHeartbeat.getTime()) / (1000 * 60);
    if (minutesAgo > 10) return 'fair';
  }
  
  return 'good';
};

const formatSuccessRate = (metrics: MCPMetrics): string => {
  if (!metrics.totalExecutions) return '100';
  const successRate = ((metrics.totalExecutions - (metrics.failedExecutions || 0)) / metrics.totalExecutions) * 100;
  return Math.round(successRate).toString();
};

const formatExecutionTime = (avgTime?: number): string => {
  if (!avgTime) return 'N/A';
  if (avgTime < 1000) return `${Math.round(avgTime)}ms`;
  return `${(avgTime / 1000).toFixed(1)}s`;
};

const formatLastSeen = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }
};

const handleQuickTool = (mcp: MCPRegistration) => {
  selectedMCP.value = mcp;
  showQuickToolModal.value = true;
};

const handleToolSelection = (tool: MCPTool) => {
  if (selectedMCP.value) {
    showQuickToolModal.value = false;
    // Emit the execute-tool event
    emit('execute-tool', selectedMCP.value, tool);
  }
};

</script>

<style scoped>
.services-list-card {
  height: 100%;
}

.title-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.loading-container ion-spinner {
  margin-bottom: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-item {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  background: var(--ion-color-light);
}

.service-item:hover {
  border-color: var(--ion-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.service-info {
  flex: 1;
}

.service-name {
  margin: 0 0 4px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.service-description {
  margin: 0;
  font-size: 0.9em;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.service-status {
  margin-left: 12px;
}

.status-badge {
  text-transform: capitalize;
}

.service-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
}

.meta-icon {
  font-size: 1em;
  color: var(--ion-color-medium);
}

.meta-label {
  color: var(--ion-color-medium);
  min-width: 40px;
}

.meta-value {
  color: var(--ion-color-dark);
  font-weight: 500;
}

.type-badge {
  text-transform: capitalize;
  font-size: 0.8em;
}

.service-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
  font-size: 0.85em;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  color: var(--ion-color-medium);
  font-size: 0.8em;
  margin-bottom: 2px;
}

.stat-value {
  color: var(--ion-color-dark);
  font-weight: 600;
}

.success-rate {
  color: var(--ion-color-success);
}

.service-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ion-color-light-shade);
}

.last-seen {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.time-icon {
  font-size: 1em;
}

.service-actions {
  display: flex;
  gap: 4px;
}

.health-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.health-good {
  background-color: var(--ion-color-success);
}

.health-fair {
  background-color: var(--ion-color-warning);
}

.health-poor {
  background-color: var(--ion-color-danger);
}

@media (max-width: 768px) {
  .service-meta {
    grid-template-columns: 1fr 1fr;
  }
  
  .service-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .stat-item {
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>