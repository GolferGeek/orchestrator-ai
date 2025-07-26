<template>
  <div class="discovery-results">
    <!-- Results Summary -->
    <div class="results-summary">
      <div class="summary-stats">
        <div class="stat-item success">
          <ion-icon :icon="checkmarkCircleOutline" class="stat-icon"></ion-icon>
          <div class="stat-content">
            <div class="stat-value">{{ results?.totalFound || 0 }}</div>
            <div class="stat-label">Found</div>
          </div>
        </div>
        <div class="stat-item success">
          <ion-icon :icon="addCircleOutline" class="stat-icon"></ion-icon>
          <div class="stat-content">
            <div class="stat-value">{{ results?.successfulRegistrations || 0 }}</div>
            <div class="stat-label">Registered</div>
          </div>
        </div>
        <div class="stat-item error">
          <ion-icon :icon="alertCircleOutline" class="stat-icon"></ion-icon>
          <div class="stat-content">
            <div class="stat-value">{{ results?.errors?.length || 0 }}</div>
            <div class="stat-label">Errors</div>
          </div>
        </div>
      </div>
      
      <div class="discovery-time">
        <ion-icon :icon="timeOutline" class="time-icon"></ion-icon>
        Discovered at: {{ formatDiscoveryTime(results?.discoveredAt) }}
      </div>
    </div>

    <!-- Discovered Services -->
    <div v-if="results?.discovered && results.discovered.length > 0" class="discovered-section">
      <h3 class="section-title">
        <ion-icon :icon="layersOutline" class="section-icon"></ion-icon>
        Discovered Services
      </h3>
      <div class="discovered-list">
        <div 
          v-for="service in results.discovered" 
          :key="service.id"
          class="discovered-item"
        >
          <div class="service-header">
            <div class="service-info">
              <h4 class="service-name">{{ service.name }}</h4>
              <p class="service-description">{{ service.description }}</p>
            </div>
            <div class="service-badges">
              <ion-badge :color="getTypeColor(service.type)" fill="outline">
                {{ service.type }}
              </ion-badge>
              <ion-badge color="success" v-if="service.status === 'online'">
                {{ service.status }}
              </ion-badge>
            </div>
          </div>
          
          <div class="service-details">
            <div class="detail-item">
              <span class="detail-label">Provider:</span>
              <span class="detail-value">{{ service.provider }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Tools:</span>
              <span class="detail-value">{{ service.tools?.length || 0 }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Capabilities:</span>
              <span class="detail-value">{{ service.capabilities?.length || 0 }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Version:</span>
              <span class="detail-value">{{ service.version }}</span>
            </div>
          </div>

          <!-- Service URL -->
          <div class="service-url">
            <ion-icon :icon="linkOutline" class="url-icon"></ion-icon>
            <span class="url-text">{{ service.url }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Discovery Errors -->
    <div v-if="results?.errors && results.errors.length > 0" class="errors-section">
      <h3 class="section-title error">
        <ion-icon :icon="warningOutline" class="section-icon"></ion-icon>
        Discovery Errors
      </h3>
      <div class="errors-list">
        <div 
          v-for="(error, index) in results.errors" 
          :key="index"
          class="error-item"
        >
          <div class="error-header">
            <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
            <div class="error-source">{{ error.source }}</div>
            <ion-badge v-if="error.retryable" color="warning" fill="outline">
              Retryable
            </ion-badge>
          </div>
          <div class="error-message">{{ error.error }}</div>
          <div class="error-time">
            {{ formatErrorTime(error.timestamp) }}
          </div>
        </div>
      </div>
    </div>

    <!-- No Results -->
    <div v-if="!results || (results.totalFound === 0 && results.errors.length === 0)" class="no-results">
      <ion-icon :icon="searchOutline" class="no-results-icon"></ion-icon>
      <h3>No Discovery Results</h3>
      <p>No new MCP services were discovered and no errors occurred.</p>
    </div>

    <!-- Actions -->
    <div class="actions-section">
      <ion-button 
        @click="$emit('close')" 
        fill="outline"
        color="medium"
      >
        Close
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IonIcon,
  IonBadge,
  IonButton
} from '@ionic/vue';
import {
  checkmarkCircleOutline,
  addCircleOutline,
  alertCircleOutline,
  timeOutline,
  layersOutline,
  warningOutline,
  linkOutline,
  searchOutline
} from 'ionicons/icons';

import type { MCPDiscoveryResult } from '@/types/mcp';

// Props
interface Props {
  results?: MCPDiscoveryResult | null;
}

const props = defineProps<Props>();

// Emits
defineEmits<{
  close: [];
}>();

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

const formatDiscoveryTime = (date?: Date): string => {
  if (!date) return 'Unknown';
  return date.toLocaleString();
};

const formatErrorTime = (date: Date): string => {
  return date.toLocaleString();
};
</script>

<style scoped>
.discovery-results {
  padding: 16px;
}

.results-summary {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
}

.stat-item.success {
  background: var(--ion-color-success-tint);
}

.stat-item.error {
  background: var(--ion-color-danger-tint);
}

.stat-icon {
  font-size: 24px;
  color: var(--ion-color-success);
}

.stat-item.error .stat-icon {
  color: var(--ion-color-danger);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.4em;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.stat-label {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.discovery-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
  justify-content: center;
}

.time-icon {
  font-size: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 1.1em;
  color: var(--ion-color-dark);
}

.section-title.error {
  color: var(--ion-color-danger);
}

.section-icon {
  font-size: 20px;
}

.discovered-section,
.errors-section {
  margin-bottom: 24px;
}

.discovered-list,
.errors-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discovered-item {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
  background: var(--ion-color-light);
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
  font-size: 1em;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.service-description {
  margin: 0;
  font-size: 0.85em;
  color: var(--ion-color-medium);
  line-height: 1.3;
}

.service-badges {
  display: flex;
  gap: 8px;
  flex-direction: column;
  align-items: flex-end;
}

.service-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--ion-color-light-tint);
  border-radius: 6px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
}

.detail-label {
  color: var(--ion-color-medium);
}

.detail-value {
  color: var(--ion-color-dark);
  font-weight: 500;
}

.service-url {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8em;
  color: var(--ion-color-medium);
  padding: 8px;
  background: var(--ion-color-light-tint);
  border-radius: 6px;
  word-break: break-all;
}

.url-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.error-item {
  border: 1px solid var(--ion-color-danger-tint);
  border-radius: 8px;
  padding: 16px;
  background: var(--ion-color-danger-tint);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.error-icon {
  color: var(--ion-color-danger);
  font-size: 18px;
}

.error-source {
  flex: 1;
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.9em;
}

.error-message {
  color: var(--ion-color-dark);
  margin-bottom: 8px;
  line-height: 1.4;
}

.error-time {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-results-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-results h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}

.actions-section {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light-shade);
}

@media (max-width: 768px) {
  .summary-stats {
    grid-template-columns: 1fr;
  }
  
  .service-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .service-badges {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .service-details {
    grid-template-columns: 1fr;
  }
}
</style>