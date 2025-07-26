<template>
  <ion-card class="health-card" :class="healthStatusClass">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="healthIcon" class="health-icon"></ion-icon>
        MCP Pool Health
      </ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div class="health-grid">
        <!-- Overall Status -->
        <div class="health-item">
          <div class="health-label">Status</div>
          <div class="health-value" :class="`status-${health?.status}`">
            {{ formatStatus(health?.status) }}
          </div>
        </div>

        <!-- Health Score -->
        <div class="health-item">
          <div class="health-label">Health Score</div>
          <div class="health-value">
            {{ health?.healthScore || 0 }}%
          </div>
        </div>

        <!-- Pool Size -->
        <div class="health-item">
          <div class="health-label">Total MCPs</div>
          <div class="health-value">
            {{ health?.poolSize || 0 }}
          </div>
        </div>

        <!-- Online MCPs -->
        <div class="health-item">
          <div class="health-label">Online</div>
          <div class="health-value online-count">
            {{ health?.onlineMCPs || 0 }}
          </div>
        </div>

        <!-- Offline MCPs -->
        <div class="health-item" v-if="stats">
          <div class="health-label">Offline</div>
          <div class="health-value offline-count">
            {{ stats.offline || 0 }}
          </div>
        </div>

        <!-- Total Tools -->
        <div class="health-item" v-if="stats">
          <div class="health-label">Total Tools</div>
          <div class="health-value">
            {{ stats.totalTools || 0 }}
          </div>
        </div>
      </div>

      <!-- Health Progress Bar -->
      <div class="health-progress-container">
        <div class="health-progress-label">
          Health Score: {{ health?.healthScore || 0 }}%
        </div>
        <ion-progress-bar 
          :value="healthPercentage" 
          :color="healthColor"
          class="health-progress"
        ></ion-progress-bar>
      </div>

      <!-- Last Check Time -->
      <div class="last-check">
        Last checked: {{ formatLastCheck(health?.lastCheck) }}
      </div>

      <!-- Quick Actions -->
      <div class="health-actions">
        <ion-button 
          @click="$emit('refresh')" 
          fill="clear" 
          size="small"
          color="medium"
        >
          <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
          Refresh
        </ion-button>
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
  IonButton,
  IonProgressBar
} from '@ionic/vue';
import {
  checkmarkCircleOutline,
  warningOutline,
  closeCircleOutline,
  refreshOutline
} from 'ionicons/icons';

import type { MCPHealthInfo, MCPPoolStats } from '@/types/mcp';

// Props
interface Props {
  health?: MCPHealthInfo | null;
  stats?: MCPPoolStats | null;
}

const props = defineProps<Props>();

// Emits
defineEmits<{
  refresh: [];
}>();

// Computed properties
const healthIcon = computed(() => {
  switch (props.health?.status) {
    case 'healthy': return checkmarkCircleOutline;
    case 'degraded': return warningOutline;
    case 'offline': return closeCircleOutline;
    default: return warningOutline;
  }
});

const healthStatusClass = computed(() => {
  return `health-${props.health?.status || 'unknown'}`;
});

const healthPercentage = computed(() => {
  return (props.health?.healthScore || 0) / 100;
});

const healthColor = computed(() => {
  const score = props.health?.healthScore || 0;
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
});

// Methods
const formatStatus = (status?: string): string => {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'degraded': return 'Degraded';
    case 'offline': return 'Offline';
    default: return 'Unknown';
  }
};

const formatLastCheck = (lastCheck?: Date): string => {
  if (!lastCheck) return 'Never';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - lastCheck.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  } else {
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  }
};
</script>

<style scoped>
.health-card {
  margin-bottom: 16px;
}

.health-card.health-healthy {
  border-left: 4px solid var(--ion-color-success);
}

.health-card.health-degraded {
  border-left: 4px solid var(--ion-color-warning);
}

.health-card.health-offline {
  border-left: 4px solid var(--ion-color-danger);
}

.health-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.health-item {
  text-align: center;
}

.health-label {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.health-value {
  font-size: 1.4em;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.health-value.status-healthy {
  color: var(--ion-color-success);
}

.health-value.status-degraded {
  color: var(--ion-color-warning);
}

.health-value.status-offline {
  color: var(--ion-color-danger);
}

.online-count {
  color: var(--ion-color-success);
}

.offline-count {
  color: var(--ion-color-danger);
}

.health-progress-container {
  margin: 16px 0;
}

.health-progress-label {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
  text-align: center;
}

.health-progress {
  height: 8px;
  border-radius: 4px;
}

.last-check {
  text-align: center;
  font-size: 0.85em;
  color: var(--ion-color-medium);
  margin: 12px 0;
}

.health-actions {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

@media (max-width: 480px) {
  .health-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>