<template>
  <div class="api-info-panel">
    <div class="api-info-header">
      <h3>API Information</h3>
      <div class="header-actions">
        <ion-badge 
          :color="currentEndpointHealth?.isHealthy ? 'success' : 'danger'"
          class="health-badge"
        >
          {{ currentEndpointHealth?.isHealthy ? 'Healthy' : 'Unhealthy' }}
        </ion-badge>
        <ion-button fill="clear" size="small" @click="$emit('close')">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </div>
    </div>

    <!-- Current API Information (Read-only) -->
    <div class="current-api-info">
      <div class="api-header">
        <h4>{{ currentEndpoint.name }}</h4>
        <div class="api-status">
          <ion-icon 
            :icon="getStatusIcon(currentEndpoint)" 
            :color="getStatusColor(currentEndpoint)"
          />
          <span class="response-time" v-if="currentEndpointHealth?.responseTime">
            {{ currentEndpointHealth?.responseTime }}ms
          </span>
        </div>
      </div>
      
      <p class="api-description">{{ currentEndpoint.description }}</p>
      
      <div class="api-details">
        <ion-badge color="primary">{{ currentEndpoint.version.toUpperCase() }}</ion-badge>
        <ion-badge color="secondary">{{ formatTechnologyName(currentEndpoint.technology) }}</ion-badge>
        <ion-badge :color="currentEndpointHealth?.isHealthy ? 'success' : 'danger'">
          {{ currentEndpointHealth?.isHealthy ? 'Online' : 'Offline' }}
        </ion-badge>
      </div>

      <!-- Features List -->
      <div class="api-features" v-if="currentEndpoint.features.length">
        <h5>Available Features</h5>
        <div class="features-grid">
          <ion-chip 
            v-for="feature in currentEndpoint.features" 
            :key="feature"
            size="small"
            color="tertiary"
          >
            {{ formatFeatureName(feature) }}
          </ion-chip>
        </div>
      </div>

      <!-- API URL Info -->
      <div class="api-url" v-if="preferences.showApiMetadata">
        <h5>Base URL</h5>
        <code class="url-code">{{ currentEndpoint.baseUrl }}</code>
      </div>
    </div>

    <!-- Health Status Details -->
    <div class="health-details" v-if="preferences.showHealthStatus">
      <h4>Health Status</h4>
      <div class="health-item">
        <div class="health-name">{{ currentEndpoint.name }}</div>
        <div class="health-status">
          <ion-icon 
            :icon="currentEndpointHealth?.isHealthy ? checkmarkCircle : alertCircle"
            :color="currentEndpointHealth?.isHealthy ? 'success' : 'danger'"
          />
          <span v-if="currentEndpointHealth?.lastChecked">
            Last checked: {{ formatLastChecked(currentEndpointHealth?.lastChecked) }}
          </span>
        </div>
        <div v-if="currentEndpointHealth?.error" class="health-error">
          <small>{{ currentEndpointHealth.error }}</small>
        </div>
      </div>
    </div>

    <!-- Version Information -->
    <div class="version-info">
      <h4>Version Information</h4>
      <div class="version-details">
        <div class="version-item">
          <span class="version-label">API Version:</span>
          <span class="version-value">{{ currentEndpoint.version.toUpperCase() }}</span>
        </div>
        <div class="version-item">
          <span class="version-label">Technology:</span>
          <span class="version-value">{{ formatTechnologyName(currentEndpoint.technology) }}</span>
        </div>
        <div class="version-item">
          <span class="version-label">Environment:</span>
          <span class="version-value">{{ getEnvironmentName() }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="panel-actions">
      <ion-button 
        @click="performHealthCheck" 
        :disabled="healthCheckInProgress"
        size="small"
        fill="outline"
      >
        <ion-icon :icon="refresh" slot="start" />
        {{ healthCheckInProgress ? 'Checking...' : 'Refresh Health' }}
      </ion-button>
      
      <ion-button 
        fill="clear" 
        @click="toggleHealthStatus"
        size="small"
      >
        {{ preferences.showHealthStatus ? 'Hide' : 'Show' }} Details
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonBadge,
  IonLabel,
  IonIcon,
  IonChip,
  IonButton
} from '@ionic/vue';
import {
  checkmarkCircle,
  alertCircle,
  refresh,
  cloudDone,
  cloudOffline,
  closeOutline
} from 'ionicons/icons';

import { apiManager } from '../services/apiManager';
import { useApiConfigStore } from '../stores/apiConfigStore';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';
import { ApiEndpoint } from '../types/api';

// Props
interface Props {
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
});

// Emits
const emit = defineEmits<{
  healthCheckCompleted: [results: any];
  close: [];
}>();

// Stores
const apiConfigStore = useApiConfigStore();
const userPreferencesStore = useUserPreferencesStore();

// Local state
const healthCheckInProgress = ref(false);

// Computed properties
const currentEndpoint = computed(() => apiManager.currentEndpoint);
const preferences = computed(() => userPreferencesStore.preferences);

const currentEndpointHealth = computed(() => 
  apiConfigStore.getEndpointHealth(currentEndpoint.value.name)
);

// Methods
const getEndpointHealth = (endpointName: string) => {
  return apiConfigStore.getEndpointHealth(endpointName);
};

const getStatusIcon = (endpoint: ApiEndpoint) => {
  const health = getEndpointHealth(endpoint.name);
  if (!endpoint.isAvailable) return cloudOffline;
  if (health?.isHealthy) return cloudDone;
  return alertCircle;
};

const getStatusColor = (endpoint: ApiEndpoint) => {
  const health = getEndpointHealth(endpoint.name);
  if (!endpoint.isAvailable) return 'medium';
  if (health?.isHealthy) return 'success';
  return 'danger';
};

const formatFeatureName = (feature: string) => {
  return feature.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

const formatTechnologyName = (technology: string) => {
  return technology.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatLastChecked = (date: Date | undefined) => {
  if (!date) return 'Never';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
};

const getEnvironmentName = () => {
  const url = currentEndpoint.value.baseUrl;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'Development';
  if (url.includes('staging')) return 'Staging';
  return 'Production';
};

const performHealthCheck = async () => {
  healthCheckInProgress.value = true;
  
  try {
    await apiConfigStore.performHealthChecks();
    emit('healthCheckCompleted', apiConfigStore.state.endpointHealthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
  } finally {
    healthCheckInProgress.value = false;
  }
};

const toggleHealthStatus = () => {
  userPreferencesStore.updatePreference('showHealthStatus', !preferences.value.showHealthStatus);
};
</script>

<style scoped>
.api-info-panel {
  padding: 20px;
  max-width: 100%;
}

.api-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ion-color-light);
}

.api-info-header h3 {
  margin: 0;
  color: var(--ion-color-primary);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-badge {
  font-size: 0.75rem;
}

.current-api-info {
  margin-bottom: 24px;
}

.api-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.api-header h4 {
  margin: 0;
  color: var(--ion-color-dark);
  font-weight: 500;
}

.api-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.response-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.api-description {
  color: var(--ion-color-medium);
  margin: 8px 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.api-details {
  display: flex;
  gap: 8px;
  margin: 12px 0;
  flex-wrap: wrap;
}

.api-features {
  margin: 16px 0;
}

.api-features h5 {
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
  font-weight: 500;
  font-size: 0.9rem;
}

.features-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.api-url {
  margin: 16px 0;
}

.api-url h5 {
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
  font-weight: 500;
  font-size: 0.9rem;
}

.url-code {
  background: var(--ion-color-light);
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--ion-color-dark);
  display: block;
  word-break: break-all;
  border: 1px solid var(--ion-color-light-shade);
}

.health-details {
  margin: 20px 0;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.health-details h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-dark);
  font-weight: 500;
  font-size: 1rem;
}

.health-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-name {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.health-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.health-error {
  color: var(--ion-color-danger);
  font-size: 0.8rem;
}

.version-info {
  margin: 20px 0;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.version-info h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-dark);
  font-weight: 500;
  font-size: 1rem;
}

.version-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-label {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.version-value {
  color: var(--ion-color-dark);
  font-weight: 500;
  font-size: 0.9rem;
}

.panel-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light);
}

@media (max-width: 768px) {
  .api-info-panel {
    padding: 16px;
  }
  
  .panel-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .panel-actions ion-button {
    width: 100%;
  }
}

/* Dark theme support */
.theme-dark .api-info-panel {
  background: var(--ion-color-dark-shade);
}

.theme-dark .health-details,
.theme-dark .version-info {
  background: var(--ion-color-dark);
}

.theme-dark .url-code {
  background: var(--ion-color-dark);
  border-color: var(--ion-color-medium-shade);
  color: var(--ion-color-light);
}
</style> 