<template>
  <div class="api-selector">
    <div class="api-selector-header">
      <h3>API Configuration</h3>
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
    <!-- API Endpoint Dropdown -->
    <div class="endpoint-dropdown" v-if="!showAdvanced">
      <ion-item>
        <ion-label>API Endpoint</ion-label>
        <ion-select 
          :value="currentEndpoint.name"
          @ionChange="handleEndpointDropdownChange"
          interface="popover"
          placeholder="Select API Endpoint"
        >
          <ion-select-option 
            v-for="endpoint in availableEndpoints" 
            :key="endpoint.name"
            :value="endpoint.name"
            :disabled="!endpoint.isAvailable"
          >
            {{ formatEndpointLabel(endpoint) }}
            <span v-if="!getEndpointHealth(endpoint.name)?.isHealthy" class="health-indicator">
              (Offline)
            </span>
          </ion-select-option>
        </ion-select>
        <ion-icon 
          :icon="getStatusIcon(currentEndpoint)" 
          :color="getStatusColor(currentEndpoint)"
          slot="end"
        />
      </ion-item>
      <!-- Current endpoint info -->
      <div class="current-endpoint-info">
        <div class="endpoint-badges">
          <ion-badge color="primary">{{ currentEndpoint.version.toUpperCase() }}</ion-badge>
          <ion-badge color="secondary">{{ formatTechnologyName(currentEndpoint.technology) }}</ion-badge>
          <ion-badge :color="getEndpointHealth(currentEndpoint.name)?.isHealthy ? 'success' : 'danger'">
            {{ getEndpointHealth(currentEndpoint.name)?.isHealthy ? 'Online' : 'Offline' }}
          </ion-badge>
        </div>
        <p class="endpoint-description">{{ currentEndpoint.description }}</p>
        <!-- Quick feature list -->
        <div class="quick-features" v-if="currentEndpoint.features.length">
          <ion-chip 
            v-for="feature in currentEndpoint.features.slice(0, 4)" 
            :key="feature"
            size="small"
            color="tertiary"
          >
            {{ formatFeatureName(feature) }}
          </ion-chip>
          <span v-if="currentEndpoint.features.length > 4" class="feature-count">
            +{{ currentEndpoint.features.length - 4 }} more
          </span>
        </div>
      </div>
    </div>
    <!-- Advanced Endpoint Selection -->
    <div class="advanced-selector" v-if="showAdvanced">
      <div class="endpoint-grid">
        <div 
          v-for="endpoint in availableEndpoints" 
          :key="endpoint.name"
          class="endpoint-card"
          :class="{
            'selected': endpoint.name === currentEndpoint.name,
            'healthy': getEndpointHealth(endpoint.name)?.isHealthy,
            'unhealthy': !getEndpointHealth(endpoint.name)?.isHealthy,
            'unavailable': !endpoint.isAvailable
          }"
          @click="selectEndpoint(endpoint)"
        >
          <div class="endpoint-header">
            <h4>{{ endpoint.name }}</h4>
            <div class="endpoint-status">
              <ion-icon 
                :icon="getStatusIcon(endpoint)" 
                :color="getStatusColor(endpoint)"
              />
              <span class="response-time" v-if="getEndpointHealth(endpoint.name)?.responseTime">
                {{ getEndpointHealth(endpoint.name)?.responseTime }}ms
              </span>
            </div>
          </div>
          <p class="endpoint-description">{{ endpoint.description }}</p>
          <div class="endpoint-details">
            <ion-badge color="primary">{{ endpoint.version.toUpperCase() }}</ion-badge>
            <ion-badge color="secondary">{{ endpoint.technology }}</ion-badge>
          </div>
          <div class="endpoint-features">
            <ion-chip 
              v-for="feature in endpoint.features.slice(0, 3)" 
              :key="feature"
              size="small"
              color="tertiary"
            >
              {{ formatFeatureName(feature) }}
            </ion-chip>
            <span v-if="endpoint.features.length > 3" class="feature-count">
              +{{ endpoint.features.length - 3 }} more
            </span>
          </div>
          <div class="endpoint-url" v-if="preferences.showApiMetadata">
            <small>{{ endpoint.baseUrl }}</small>
          </div>
        </div>
      </div>
    </div>
    <!-- Feature Comparison -->
    <div class="feature-comparison" v-if="showFeatureComparison">
      <h4>Feature Comparison</h4>
      <div class="comparison-table">
        <div class="comparison-header">
          <div class="feature-column">Feature</div>
          <div 
            v-for="endpoint in availableEndpoints" 
            :key="endpoint.name"
            class="endpoint-column"
          >
            {{ endpoint.version.toUpperCase() }}
          </div>
        </div>
        <div 
          v-for="feature in allFeatures" 
          :key="feature"
          class="comparison-row"
        >
          <div class="feature-name">{{ formatFeatureName(feature) }}</div>
          <div 
            v-for="endpoint in availableEndpoints" 
            :key="endpoint.name"
            class="feature-support"
          >
            <ion-icon 
              :icon="endpoint.features.includes(feature as any) ? checkmarkCircle : closeCircle"
              :color="endpoint.features.includes(feature as any) ? 'success' : 'medium'"
            />
          </div>
        </div>
      </div>
    </div>
    <!-- Health Status Details -->
    <div class="health-details" v-if="preferences.showHealthStatus">
      <h4>Health Status</h4>
      <div class="health-grid">
        <div 
          v-for="endpoint in availableEndpoints" 
          :key="endpoint.name"
          class="health-item"
        >
          <div class="health-name">{{ endpoint.name }}</div>
          <div class="health-status">
            <ion-icon 
              :icon="getEndpointHealth(endpoint.name)?.isHealthy ? checkmarkCircle : alertCircle"
              :color="getEndpointHealth(endpoint.name)?.isHealthy ? 'success' : 'danger'"
            />
            <span v-if="getEndpointHealth(endpoint.name)?.lastChecked">
              Last checked: {{ formatLastChecked(getEndpointHealth(endpoint.name)?.lastChecked) }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="selector-actions">
      <ion-button 
        fill="clear" 
        @click="toggleAdvancedMode"
        size="small"
      >
        {{ showAdvanced ? 'Simple View' : 'Advanced View' }}
      </ion-button>
      <ion-button 
        fill="clear" 
        @click="showFeatureComparison = !showFeatureComparison"
        size="small"
        v-if="showAdvanced"
      >
        {{ showFeatureComparison ? 'Hide' : 'Show' }} Features
      </ion-button>
      <ion-button 
        @click="performHealthCheck" 
        :disabled="healthCheckInProgress"
        size="small"
      >
        <ion-icon :icon="refresh" slot="start" />
        {{ healthCheckInProgress ? 'Checking...' : 'Check Health' }}
      </ion-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonBadge,
  IonLabel,
  IonIcon,
  IonChip,
  IonButton,
  IonItem,
  IonSelect,
  IonSelectOption
} from '@ionic/vue';
import {
  checkmarkCircle,
  closeCircle,
  alertCircle,
  refresh,
  cloudDone,
  cloudOffline,
  // settings,
  closeOutline
} from 'ionicons/icons';
import { useApiConfigStore } from '../stores/apiConfigStore';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';
import { ApiEndpoint } from '../types/api';
// Props
interface Props {
  showAdvanced?: boolean;
  compact?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  showAdvanced: false,
  compact: false
});
interface HealthCheckResult {
  endpoint: string;
  status: 'success' | 'error';
  responseTime?: number;
  error?: string;
  [key: string]: unknown;
}

// Emits
const emit = defineEmits<{
  endpointChanged: [endpoint: ApiEndpoint];
  healthCheckCompleted: [results: HealthCheckResult[]];
  close: [];
}>();
// Stores
const apiConfigStore = useApiConfigStore();
const userPreferencesStore = useUserPreferencesStore();
// Local state
const showAdvanced = ref(props.showAdvanced);
const showFeatureComparison = ref(false);
const healthCheckInProgress = ref(false);
// Computed properties
const currentEndpoint = computed(() => apiConfigStore.allEndpoints[0]);
const availableEndpoints = computed(() => {
  // Show all configured endpoints, not just healthy ones
  // This allows users to see and test endpoints even if health checks haven't run
  return apiConfigStore.allEndpoints;
});
const preferences = computed(() => userPreferencesStore.preferences);
const currentEndpointHealth = computed(() => 
  apiConfigStore.getEndpointHealth(currentEndpoint.value.name)
);
const allFeatures = computed(() => {
  const features = new Set<string>();
  availableEndpoints.value.forEach(endpoint => {
    endpoint.features.forEach(feature => features.add(feature));
  });
  return Array.from(features).sort();
});
// Methods
// const getHealthyEndpointsForVersion = (version: string) => {
//   return availableEndpoints.value.filter(ep => ep.version === version);
// };
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
// Removed unused function
const formatFeatureName = (feature: string) => {
  return feature.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
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
// Removed unused function
const selectEndpoint = async (endpoint: ApiEndpoint) => {
  if (!endpoint.isAvailable) return;
  try {
    // For unified API, endpoint switching is simplified
    emit('endpointChanged', endpoint);
    // Update user preferences if enabled
    if (preferences.value.rememberApiSelection) {
      await userPreferencesStore.setApiVersion(endpoint.version);
    }
  } catch {
    // Could show toast notification here
  }
};
const toggleAdvancedMode = () => {
  showAdvanced.value = !showAdvanced.value;
  userPreferencesStore.updatePreference('showAdvancedOptions', showAdvanced.value);
};
const performHealthCheck = async () => {
  healthCheckInProgress.value = true;
  try {
    await apiConfigStore.performHealthChecks();
    emit('healthCheckCompleted', apiConfigStore.state.endpointHealthStatus);
  } catch {
  } finally {
    healthCheckInProgress.value = false;
  }
};
const handleEndpointDropdownChange = (event: CustomEvent) => {
  const endpointName = event.detail.value;
  const endpoint = availableEndpoints.value.find(ep => ep.name === endpointName);
  if (endpoint) {
    selectEndpoint(endpoint);
  }
};
const formatEndpointLabel = (endpoint: ApiEndpoint) => {
  // Create cleaner labels combining version and technology
  const versionLabel = endpoint.version.toUpperCase();
  const techLabel = endpoint.technology === 'typescript-nestjs' ? 'NestJS' : 
                   endpoint.technology === 'typescript-nestjs' ? 'TypeScript' : 
                   formatTechnologyName(endpoint.technology);
  return `${versionLabel} ${techLabel}`;
};
const formatTechnologyName = (technology: string) => {
  return technology.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};
// Lifecycle
onMounted(async () => {
  showAdvanced.value = preferences.value.showAdvancedOptions;
  // Initialize the API config store and perform health checks
  await apiConfigStore.initializeConfiguration();
  // Perform initial health check to detect running APIs
  await performHealthCheck();
});
</script>
<style scoped>
.api-selector {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
}
.api-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: var(--ion-color-light-shade);
}
.api-selector-header h3 {
  margin: 0;
  color: var(--ion-color-dark);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.health-badge {
  margin-right: 8px;
}
.endpoint-dropdown {
  margin-bottom: 16px;
}
.endpoint-dropdown ion-item {
  --padding-start: 0;
  --padding-end: 0;
}
.endpoint-dropdown ion-label {
  font-weight: bold;
}
.endpoint-dropdown ion-select {
  --padding-start: 0;
  --padding-end: 0;
}
.endpoint-dropdown ion-select option {
  --padding-start: 0;
  --padding-end: 0;
}
.health-indicator {
  color: var(--ion-color-danger);
  font-size: 0.9em;
  font-style: italic;
}
.current-endpoint-info {
  margin-top: 16px;
}
.endpoint-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.endpoint-description {
  margin: 8px 0;
  color: var(--ion-color-medium);
  font-size: 0.9em;
}
.quick-features {
  margin-top: 8px;
}
.endpoint-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.endpoint-card {
  padding: 16px;
  border: 2px solid var(--ion-color-medium);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}
.endpoint-card:hover {
  border-color: var(--ion-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.endpoint-card.selected {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
}
.endpoint-card.healthy {
  border-left: 4px solid var(--ion-color-success);
}
.endpoint-card.unhealthy {
  border-left: 4px solid var(--ion-color-danger);
}
.endpoint-card.unavailable {
  opacity: 0.5;
  cursor: not-allowed;
}
.endpoint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.endpoint-header h4 {
  margin: 0;
  font-size: 1.1em;
  color: var(--ion-color-dark);
}
.endpoint-status {
  display: flex;
  align-items: center;
  gap: 4px;
}
.response-time {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}
.endpoint-details {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}
.endpoint-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin: 8px 0;
}
.feature-count {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}
.endpoint-url {
  margin-top: 8px;
  padding: 4px 8px;
  background: var(--ion-color-light);
  border-radius: 4px;
  font-family: monospace;
}
.feature-comparison {
  margin: 16px 0;
}
.comparison-table {
  border: 1px solid var(--ion-color-medium);
  border-radius: 8px;
  overflow: hidden;
}
.comparison-header {
  display: grid;
  grid-template-columns: 2fr repeat(auto-fit, 1fr);
  background: var(--ion-color-dark);
  color: white;
  font-weight: bold;
}
.comparison-header > div {
  padding: 12px;
  text-align: center;
}
.feature-column {
  text-align: left !important;
}
.comparison-row {
  display: grid;
  grid-template-columns: 2fr repeat(auto-fit, 1fr);
  border-bottom: 1px solid var(--ion-color-light);
}
.comparison-row:last-child {
  border-bottom: none;
}
.comparison-row > div {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.feature-name {
  text-align: left !important;
  justify-content: flex-start !important;
  font-weight: 500;
}
.health-details {
  margin: 16px 0;
}
.health-grid {
  display: grid;
  gap: 8px;
}
.health-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid var(--ion-color-light);
}
.health-name {
  font-weight: 500;
}
.health-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.selector-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light);
}
/* Responsive design */
@media (max-width: 768px) {
  .endpoint-grid {
    grid-template-columns: 1fr;
  }
  .comparison-header,
  .comparison-row {
    grid-template-columns: 1fr;
  }
  .endpoint-column,
  .feature-support {
    display: none;
  }
  .selector-actions {
    flex-direction: column;
  }
}
/* Dark theme support */
.theme-dark .api-selector {
  background: var(--ion-color-dark-shade);
}
.theme-dark .endpoint-card {
  background: var(--ion-color-dark);
  border-color: var(--ion-color-medium-shade);
}
.theme-dark .endpoint-card.selected {
  background: var(--ion-color-primary-shade);
}
</style> 