<template>
  <div class="error-demo">
    <ion-header>
      <ion-toolbar>
        <ion-title>Error Handling Demo</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="clearAllErrors" fill="clear">
            <ion-icon :icon="trashOutline" />
            Clear All
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    
    <ion-content class="ion-padding">
      <!-- Error Statistics -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Error Statistics</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="6">
                <div class="stat-item">
                  <div class="stat-number">{{ errorStats.total }}</div>
                  <div class="stat-label">Total Errors</div>
                </div>
              </ion-col>
              <ion-col size="6">
                <div class="stat-item">
                  <div class="stat-number critical">{{ errorStats.critical }}</div>
                  <div class="stat-label">Critical</div>
                </div>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6">
                <div class="stat-item">
                  <div class="stat-number">{{ errorStats.unresolved }}</div>
                  <div class="stat-label">Unresolved</div>
                </div>
              </ion-col>
              <ion-col size="6">
                <div class="stat-item">
                  <div class="stat-number">{{ errorStats.recent }}</div>
                  <div class="stat-label">Recent (1h)</div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>

      <!-- Error Testing Buttons -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Test Error Scenarios</ion-card-title>
          <ion-card-subtitle>Click buttons to simulate different types of errors</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="test-buttons">
            <ion-button 
              @click="testComponentError" 
              color="danger" 
              fill="outline"
              expand="block"
            >
              <ion-icon :icon="bugOutline" slot="start" />
              Component Error
            </ion-button>
            
            <ion-button 
              @click="testPromiseRejection" 
              color="warning" 
              fill="outline"
              expand="block"
            >
              <ion-icon :icon="alertTriangleOutline" slot="start" />
              Promise Rejection
            </ion-button>
            
            <ion-button 
              @click="testNetworkError" 
              color="primary" 
              fill="outline"
              expand="block"
            >
              <ion-icon :icon="cloudOfflineOutline" slot="start" />
              Network Error
            </ion-button>
            
            <ion-button 
              @click="testApiError" 
              color="secondary" 
              fill="outline"
              expand="block"
            >
              <ion-icon :icon="serverOutline" slot="start" />
              API Error
            </ion-button>
            
            <ion-button 
              @click="testChunkError" 
              color="tertiary" 
              fill="outline"
              expand="block"
            >
              <ion-icon :icon="documentOutline" slot="start" />
              Chunk Load Error
            </ion-button>
            
            <ion-button 
              @click="testCriticalError" 
              color="danger" 
              fill="solid"
              expand="block"
            >
              <ion-icon :icon="warningOutline" slot="start" />
              Critical Error
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Recent Errors List -->
      <ion-card v-if="recentErrors.length > 0">
        <ion-card-header>
          <ion-card-title>Recent Errors</ion-card-title>
          <ion-card-subtitle>Last {{ recentErrors.length }} errors</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="error in recentErrors" 
              :key="error.id"
              :class="{ 'error-resolved': error.resolved }"
            >
              <ion-icon 
                :icon="getErrorIcon(error.type)" 
                :color="getErrorColor(error.severity)"
                slot="start" 
              />
              <ion-label>
                <h3>{{ error.type }} - {{ error.severity }}</h3>
                <p>{{ error.message }}</p>
                <p class="error-timestamp">
                  {{ formatTimestamp(error.timestamp) }}
                  <span v-if="error.retryCount && error.retryCount > 0">
                    • Retried {{ error.retryCount }} time(s)
                  </span>
                  <span v-if="error.reportSent" class="reported-badge">
                    • Reported
                  </span>
                </p>
              </ion-label>
              <ion-buttons slot="end">
                <ion-button 
                  v-if="!error.resolved"
                  @click="resolveError(error.id)"
                  fill="clear"
                  size="small"
                  color="success"
                >
                  <ion-icon :icon="checkmarkOutline" />
                </ion-button>
                <ion-button 
                  @click="reportError(error.id)"
                  fill="clear"
                  size="small"
                  color="medium"
                >
                  <ion-icon :icon="shareOutline" />
                </ion-button>
                <ion-button 
                  @click="removeError(error.id)"
                  fill="clear"
                  size="small"
                  color="danger"
                >
                  <ion-icon :icon="trashOutline" />
                </ion-button>
              </ion-buttons>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Error Boundary Demo -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Error Boundary Demo</ion-card-title>
          <ion-card-subtitle>Component with error boundary protection</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ErrorBoundary 
            :show-details="true"
            :max-retries="2"
            @error="onBoundaryError"
            @retry="onBoundaryRetry"
          >
            <template #error="{ error, retry, clear }">
              <!-- Custom error UI -->
              <div class="custom-error-ui">
                <ion-icon :icon="alertCircleOutline" color="danger" />
                <h3>Oops! Something went wrong in this component</h3>
                <p>{{ error?.message }}</p>
                <div class="custom-error-actions">
                  <ion-button @click="retry" color="primary" size="small">
                    Try Again
                  </ion-button>
                  <ion-button @click="clear" color="medium" fill="clear" size="small">
                    Dismiss
                  </ion-button>
                </div>
              </div>
            </template>
            
            <!-- Component that can throw errors -->
            <div class="boundary-demo-content">
              <ion-button 
                @click="throwBoundaryError" 
                color="warning"
                fill="outline"
              >
                <ion-icon :icon="flashOutline" slot="start" />
                Trigger Boundary Error
              </ion-button>
              
              <p v-if="!hasBoundaryError" class="success-message">
                ✅ Component is working normally
              </p>
            </div>
          </ErrorBoundary>
        </ion-card-content>
      </ion-card>

      <!-- Logger Status -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Error Logger Status</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Logging Enabled</h3>
                <p>{{ loggerStatus.enabled ? 'Yes' : 'No' }}</p>
              </ion-label>
              <ion-toggle 
                :checked="loggerStatus.enabled"
                @ionChange="toggleLogging"
                slot="end"
              />
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Retry Queue</h3>
                <p>{{ loggerStatus.retryQueue.count }} pending operations</p>
              </ion-label>
              <ion-button 
                v-if="loggerStatus.retryQueue.count > 0"
                @click="processRetryQueue"
                fill="clear"
                size="small"
                slot="end"
              >
                Process
              </ion-button>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonToggle
} from '@ionic/vue';
import {
  bugOutline,
  alertTriangleOutline,
  cloudOfflineOutline,
  serverOutline,
  documentOutline,
  warningOutline,
  alertCircleOutline,
  checkmarkOutline,
  shareOutline,
  trashOutline,
  flashOutline
} from 'ionicons/icons';
import ErrorBoundary from '@/components/common/ErrorBoundary.vue';
import { useErrorStore } from '@/stores/errorStore';
import { useGlobalErrorHandler } from '@/composables/useGlobalErrorHandler';

const errorStore = useErrorStore();
const { 
  handleApiError,
  handleNetworkError,
  handleChunkError,
  reportError: reportErrorToService,
  getErrorSummary,
  errorLoggerService
} = useGlobalErrorHandler();

// Component state
const hasBoundaryError = ref(false);

// Computed properties
const errorStats = computed(() => errorStore.errorStats);
const recentErrors = computed(() => errorStore.errors.slice(0, 10));

const loggerStatus = computed(() => ({
  enabled: errorLoggerService.isLoggingEnabled(),
  retryQueue: errorLoggerService.getRetryQueueStatus()
}));

// Error testing methods
const testComponentError = () => {
  console.log('🧪 Testing component error...');
  throw new Error('Test component error - this is intentional');
};

const testPromiseRejection = () => {
  console.log('🧪 Testing promise rejection...');
  Promise.reject(new Error('Test promise rejection - this is intentional'));
};

const testNetworkError = () => {
  console.log('🧪 Testing network error...');
  const networkError = new Error('Network request failed');
  networkError.name = 'NetworkError';
  handleNetworkError(networkError, 'https://api.example.com/test');
};

const testApiError = () => {
  console.log('🧪 Testing API error...');
  const apiError = new Error('API request failed with status 500');
  handleApiError(apiError, '/api/test', 'GET');
};

const testChunkError = () => {
  console.log('🧪 Testing chunk load error...');
  const chunkError = new Error('Loading chunk 1 failed');
  chunkError.name = 'ChunkLoadError';
  handleChunkError(chunkError);
};

const testCriticalError = () => {
  console.log('🧪 Testing critical error...');
  const criticalError = new Error('Critical system failure - application cannot continue');
  criticalError.name = 'CriticalError';
  errorStore.addError(criticalError, {
    component: 'ErrorDemo',
    additionalContext: { testError: true }
  });
};

const throwBoundaryError = () => {
  console.log('🧪 Testing error boundary...');
  hasBoundaryError.value = true;
  // This will be caught by the ErrorBoundary component
  throw new Error('Test error boundary - this should be caught');
};

// Error management methods
const resolveError = (errorId: string) => {
  console.log('✅ Resolving error:', errorId);
  errorStore.resolveError(errorId);
};

const removeError = (errorId: string) => {
  console.log('🗑️ Removing error:', errorId);
  errorStore.removeError(errorId);
};

const reportError = async (errorId: string) => {
  console.log('📤 Reporting error:', errorId);
  const success = await reportErrorToService(
    errorId,
    'User reported error from demo page',
    'User clicked report button in error demo',
    'Error should be handled gracefully'
  );
  
  if (success) {
    console.log('✅ Error reported successfully');
  } else {
    console.log('❌ Failed to report error');
  }
};

const clearAllErrors = () => {
  console.log('🧹 Clearing all errors');
  errorStore.clearErrors();
};

// Logger management
const toggleLogging = (event: CustomEvent) => {
  const enabled = event.detail.checked;
  console.log(`${enabled ? '🟢' : '🔴'} Error logging ${enabled ? 'enabled' : 'disabled'}`);
  errorLoggerService.setEnabled(enabled);
};

const processRetryQueue = async () => {
  console.log('⚡ Processing error logger retry queue');
  await errorLoggerService.processRetryQueue();
};

// Error boundary event handlers
const onBoundaryError = (error: Error) => {
  console.log('🚨 Error boundary caught error:', error);
  hasBoundaryError.value = true;
};

const onBoundaryRetry = (attempt: number) => {
  console.log(`🔄 Error boundary retry attempt ${attempt}`);
  hasBoundaryError.value = false;
};

// Utility methods
const getErrorIcon = (type: string) => {
  switch (type) {
    case 'api': return serverOutline;
    case 'network': return cloudOfflineOutline;
    case 'chunk-load': return documentOutline;
    case 'component': return bugOutline;
    case 'validation': return alertTriangleOutline;
    default: return warningOutline;
  }
};

const getErrorColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'primary';
    case 'low': return 'medium';
    default: return 'medium';
  }
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// Initialize
onMounted(() => {
  console.log('🎭 Error Handling Demo initialized');
  console.log('📊 Current error summary:', getErrorSummary());
});
</script>

<style scoped>
.error-demo {
  height: 100%;
}

.stat-item {
  text-align: center;
  padding: 16px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.stat-number.critical {
  color: var(--ion-color-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.test-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-resolved {
  opacity: 0.6;
}

.error-timestamp {
  font-size: 11px;
  color: var(--ion-color-medium);
}

.reported-badge {
  color: var(--ion-color-success);
  font-weight: 500;
}

.custom-error-ui {
  text-align: center;
  padding: 24px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border: 1px solid var(--ion-color-danger);
}

.custom-error-ui ion-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.custom-error-ui h3 {
  margin: 0 0 8px 0;
  color: var(--ion-color-danger);
}

.custom-error-ui p {
  margin: 0 0 16px 0;
  color: var(--ion-color-medium);
}

.custom-error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.boundary-demo-content {
  padding: 16px;
  text-align: center;
}

.success-message {
  margin-top: 16px;
  color: var(--ion-color-success);
  font-weight: 500;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .custom-error-ui {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-danger-tint);
  }
}
</style>
