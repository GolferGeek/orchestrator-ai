<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Admin Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <div class="admin-settings-container">
        <!-- Header Section -->
        <div class="settings-header">
          <h1>System Administration</h1>
          <p>Manage privacy settings, system configuration, and access controls</p>
        </div>

        <!-- Quick Actions Grid -->
        <div class="quick-actions-section">
          <h2>Quick Actions</h2>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/evaluations')" class="action-card evaluations">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="analyticsOutline" />
                    </div>
                    <h3>Admin Evaluations</h3>
                    <p>View and manage all user evaluations</p>
                    <ion-chip color="primary" size="small">
                      <ion-label>{{ evaluationStats.total }} total</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/llm-usage')" class="action-card llm-usage">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="barChartOutline" />
                    </div>
                    <h3>LLM Usage Analytics</h3>
                    <p>Monitor AI model usage and costs</p>
                    <ion-chip color="success" size="small">
                      <ion-label>${{ llmStats.totalCost.toFixed(2) }} today</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pii-patterns')" class="action-card pii-patterns">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="shieldCheckmarkOutline" />
                    </div>
                    <h3>PII Patterns</h3>
                    <p>Manage PII detection patterns</p>
                    <ion-chip color="warning" size="small">
                      <ion-label>{{ piiStats.patterns }} patterns</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pii-testing')" class="action-card pii-testing">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="flaskOutline" />
                    </div>
                    <h3>PII Testing</h3>
                    <p>Test PII detection in real-time</p>
                    <ion-chip color="tertiary" size="small">
                      <ion-label>Live Testing</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pseudonym-dictionary')" class="action-card dictionary">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="libraryOutline" />
                    </div>
                    <h3>Pseudonym Dictionary</h3>
                    <p>Manage replacement dictionaries</p>
                    <ion-chip color="secondary" size="small">
                      <ion-label>{{ dictionaryStats.dictionaries }} dictionaries</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card class="action-card system-health" :class="{ 'health-warning': !systemHealth.healthy }">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="systemHealth.healthy ? checkmarkCircleOutline : alertCircleOutline" />
                    </div>
                    <h3>System Health</h3>
                    <p>{{ systemHealth.healthy ? 'All systems operational' : 'Issues detected' }}</p>
                    <ion-chip :color="systemHealth.healthy ? 'success' : 'danger'" size="small">
                      <ion-label>{{ systemHealth.healthy ? 'Healthy' : 'Warning' }}</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- Privacy & Data Protection Settings -->
        <div class="privacy-settings-section">
          <h2>
            <ion-icon :icon="lockClosedOutline" />
            Privacy & Data Protection
          </h2>
          
          <ion-card>
            <ion-card-header>
              <ion-card-title>Global Privacy Controls</ion-card-title>
              <ion-card-subtitle>Configure system-wide privacy and data protection settings</ion-card-subtitle>
            </ion-card-header>
            
            <ion-card-content>
              <div class="settings-grid">
                <!-- PII Detection Settings -->
                <div class="setting-group">
                  <h3>PII Detection & Sanitization</h3>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Enable PII Detection</h3>
                      <p>Automatically detect personally identifiable information</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.enablePIIDetection"
                      @ionChange="updatePrivacySetting('enablePIIDetection', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Enable Redaction</h3>
                      <p>Automatically redact sensitive information</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.enableRedaction"
                      @ionChange="updatePrivacySetting('enableRedaction', $event.detail.checked)"
                      :disabled="isUpdating || !privacySettings.enablePIIDetection"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Enable Pseudonymization</h3>
                      <p>Replace PII with pseudonyms for privacy</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.enablePseudonymization"
                      @ionChange="updatePrivacySetting('enablePseudonymization', $event.detail.checked)"
                      :disabled="isUpdating || !privacySettings.enablePIIDetection"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Default Sanitization Level</h3>
                      <p>Default protection level for new conversations</p>
                    </ion-label>
                    <ion-select
                      v-model="privacySettings.defaultSanitizationLevel"
                      interface="popover"
                      @ionChange="updatePrivacySetting('defaultSanitizationLevel', $event.detail.value)"
                      :disabled="isUpdating"
                    >
                      <ion-select-option value="none">None</ion-select-option>
                      <ion-select-option value="basic">Basic</ion-select-option>
                      <ion-select-option value="standard">Standard</ion-select-option>
                      <ion-select-option value="strict">Strict</ion-select-option>
                    </ion-select>
                  </ion-item>
                </div>

                <!-- Data Classification Settings -->
                <div class="setting-group">
                  <h3>Data Classification</h3>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Auto-Classify Data</h3>
                      <p>Automatically classify data sensitivity levels</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.autoClassifyData"
                      @ionChange="updatePrivacySetting('autoClassifyData', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Default Classification</h3>
                      <p>Default classification for unclassified data</p>
                    </ion-label>
                    <ion-select
                      v-model="privacySettings.defaultClassification"
                      interface="popover"
                      @ionChange="updatePrivacySetting('defaultClassification', $event.detail.value)"
                      :disabled="isUpdating"
                    >
                      <ion-select-option value="public">Public</ion-select-option>
                      <ion-select-option value="internal">Internal</ion-select-option>
                      <ion-select-option value="confidential">Confidential</ion-select-option>
                      <ion-select-option value="restricted">Restricted</ion-select-option>
                    </ion-select>
                  </ion-item>
                </div>

                <!-- Compliance Settings -->
                <div class="setting-group">
                  <h3>Compliance & Regulations</h3>
                  
                  <ion-item>
                    <ion-label>
                      <h3>GDPR Compliance Mode</h3>
                      <p>Enable GDPR-specific privacy protections</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.gdprCompliance"
                      @ionChange="updatePrivacySetting('gdprCompliance', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>HIPAA Compliance Mode</h3>
                      <p>Enable HIPAA-specific healthcare protections</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.hipaaCompliance"
                      @ionChange="updatePrivacySetting('hipaaCompliance', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>PCI DSS Compliance Mode</h3>
                      <p>Enable PCI DSS payment data protections</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.pciCompliance"
                      @ionChange="updatePrivacySetting('pciCompliance', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                </div>

                <!-- Source Protection Settings -->
                <div class="setting-group">
                  <h3>Source Protection</h3>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Enable Source Blinding</h3>
                      <p>Hide source information from external providers</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.enableSourceBlinding"
                      @ionChange="updatePrivacySetting('enableSourceBlinding', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Send No-Train Headers</h3>
                      <p>Request providers not to train on your data</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.sendNoTrainHeaders"
                      @ionChange="updatePrivacySetting('sendNoTrainHeaders', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Custom User Agent</h3>
                      <p>Use custom user agent for external requests</p>
                    </ion-label>
                    <ion-toggle
                      v-model="privacySettings.useCustomUserAgent"
                      @ionChange="updatePrivacySetting('useCustomUserAgent', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Audit & Logging Settings -->
        <div class="audit-settings-section">
          <h2>
            <ion-icon :icon="documentTextOutline" />
            Audit & Logging
          </h2>
          
          <ion-card>
            <ion-card-header>
              <ion-card-title>Audit Trail Configuration</ion-card-title>
              <ion-card-subtitle>Configure audit logging and compliance tracking</ion-card-subtitle>
            </ion-card-header>
            
            <ion-card-content>
              <div class="settings-grid">
                <div class="setting-group">
                  <h3>Audit Logging</h3>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Enable Audit Logging</h3>
                      <p>Log all administrative actions and privacy operations</p>
                    </ion-label>
                    <ion-toggle
                      v-model="auditSettings.enableAuditLogging"
                      @ionChange="updateAuditSetting('enableAuditLogging', $event.detail.checked)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Log Privacy Operations</h3>
                      <p>Log PII detection, redaction, and pseudonymization</p>
                    </ion-label>
                    <ion-toggle
                      v-model="auditSettings.logPrivacyOperations"
                      @ionChange="updateAuditSetting('logPrivacyOperations', $event.detail.checked)"
                      :disabled="isUpdating || !auditSettings.enableAuditLogging"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Log Access Attempts</h3>
                      <p>Log all admin panel access attempts</p>
                    </ion-label>
                    <ion-toggle
                      v-model="auditSettings.logAccessAttempts"
                      @ionChange="updateAuditSetting('logAccessAttempts', $event.detail.checked)"
                      :disabled="isUpdating || !auditSettings.enableAuditLogging"
                    />
                  </ion-item>
                  
                  <ion-item>
                    <ion-label>
                      <h3>Audit Retention Period</h3>
                      <p>How long to keep audit logs (days)</p>
                    </ion-label>
                    <ion-input
                      v-model.number="auditSettings.retentionPeriodDays"
                      type="number"
                      min="30"
                      max="2555"
                      @ionBlur="updateAuditSetting('retentionPeriodDays', auditSettings.retentionPeriodDays)"
                      :disabled="isUpdating"
                    />
                  </ion-item>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- System Status -->
        <div class="system-status-section">
          <h2>
            <ion-icon :icon="hardwareChipOutline" />
            System Status
          </h2>
          
          <ion-card>
            <ion-card-content>
              <div class="status-grid">
                <div class="status-item">
                  <div class="status-icon" :class="{ 'status-healthy': systemHealth.healthy }">
                    <ion-icon :icon="systemHealth.healthy ? checkmarkCircleOutline : alertCircleOutline" />
                  </div>
                  <div class="status-info">
                    <h3>System Health</h3>
                    <p>{{ systemHealth.healthy ? 'All systems operational' : 'Issues detected' }}</p>
                  </div>
                </div>
                
                <div class="status-item">
                  <div class="status-icon status-info">
                    <ion-icon :icon="peopleOutline" />
                  </div>
                  <div class="status-info">
                    <h3>Active Users</h3>
                    <p>{{ systemStats.activeUsers }} users online</p>
                  </div>
                </div>
                
                <div class="status-item">
                  <div class="status-icon status-info">
                    <ion-icon :icon="chatbubblesOutline" />
                  </div>
                  <div class="status-info">
                    <h3>Daily Conversations</h3>
                    <p>{{ systemStats.dailyConversations }} conversations today</p>
                  </div>
                </div>
                
                <div class="status-item">
                  <div class="status-icon status-success">
                    <ion-icon :icon="shieldCheckmarkOutline" />
                  </div>
                  <div class="status-info">
                    <h3>Privacy Protection Rate</h3>
                    <p>{{ systemStats.privacyProtectionRate }}% of data protected</p>
                  </div>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonChip,
  IonLabel,
  IonItem,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonInput,
  toastController
} from '@ionic/vue';
import {
  analyticsOutline,
  barChartOutline,
  shieldCheckmarkOutline,
  flaskOutline,
  libraryOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  lockClosedOutline,
  documentTextOutline,
  hardwareChipOutline,
  peopleOutline,
  chatbubblesOutline
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';

// Store and router
const auth = useAuthStore();
const router = useRouter();

// Reactive state
const isUpdating = ref(false);

// Privacy settings state
const privacySettings = ref({
  enablePIIDetection: true,
  enableRedaction: false,
  enablePseudonymization: true,
  defaultSanitizationLevel: 'standard',
  autoClassifyData: true,
  defaultClassification: 'internal',
  gdprCompliance: false,
  hipaaCompliance: false,
  pciCompliance: false,
  enableSourceBlinding: true,
  sendNoTrainHeaders: true,
  useCustomUserAgent: true
});

// Audit settings state
const auditSettings = ref({
  enableAuditLogging: true,
  logPrivacyOperations: true,
  logAccessAttempts: true,
  retentionPeriodDays: 365
});

// Mock stats (in real app, these would come from API/stores)
const evaluationStats = ref({
  total: 1247,
  pending: 23,
  completed: 1224
});

const llmStats = ref({
  totalCost: 45.67,
  requestsToday: 892,
  avgResponseTime: 1.2
});

const piiStats = ref({
  patterns: 24,
  active: 18,
  detections: 156
});

const dictionaryStats = ref({
  dictionaries: 8,
  totalWords: 2451,
  activeWords: 2298
});

const systemHealth = ref({
  healthy: true,
  uptime: 99.9,
  issues: 0
});

const systemStats = ref({
  activeUsers: 12,
  dailyConversations: 89,
  privacyProtectionRate: 94.2
});

// Methods
const navigateTo = (path: string) => {
  router.push(path);
};

const updatePrivacySetting = async (setting: string, value: any) => {
  if (isUpdating.value) return;
  
  isUpdating.value = true;
  
  try {
    // In real app, this would call an API to update backend settings
    console.log(`Updating privacy setting: ${setting} = ${value}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Show success toast
    const toast = await toastController.create({
      message: `Privacy setting updated: ${setting}`,
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
    
  } catch (error) {
    console.error('Error updating privacy setting:', error);
    
    // Revert the change
    (privacySettings.value as any)[setting] = !(privacySettings.value as any)[setting];
    
    // Show error toast
    const toast = await toastController.create({
      message: 'Failed to update privacy setting',
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  } finally {
    isUpdating.value = false;
  }
};

const updateAuditSetting = async (setting: string, value: any) => {
  if (isUpdating.value) return;
  
  isUpdating.value = true;
  
  try {
    // In real app, this would call an API to update backend settings
    console.log(`Updating audit setting: ${setting} = ${value}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Show success toast
    const toast = await toastController.create({
      message: `Audit setting updated: ${setting}`,
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
    
  } catch (error) {
    console.error('Error updating audit setting:', error);
    
    // Revert the change
    (auditSettings.value as any)[setting] = !(auditSettings.value as any)[setting];
    
    // Show error toast
    const toast = await toastController.create({
      message: 'Failed to update audit setting',
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  } finally {
    isUpdating.value = false;
  }
};

const loadSettings = async () => {
  try {
    // In real app, this would load settings from API/environment variables
    console.log('Loading admin settings...');
    
    // Load privacy settings from environment or API
    // privacySettings.value = await api.getPrivacySettings();
    // auditSettings.value = await api.getAuditSettings();
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

const loadStats = async () => {
  try {
    // In real app, this would load stats from various APIs
    console.log('Loading system stats...');
    
    // Load stats from APIs
    // evaluationStats.value = await api.getEvaluationStats();
    // llmStats.value = await api.getLLMStats();
    // etc.
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadSettings(),
    loadStats()
  ]);
});
</script>

<style scoped>
.admin-settings-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.settings-header {
  text-align: center;
  margin-bottom: 2rem;
}

.settings-header h1 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.settings-header p {
  color: var(--ion-color-medium);
  font-size: 1.1rem;
}

.quick-actions-section,
.privacy-settings-section,
.audit-settings-section,
.system-status-section {
  margin-bottom: 3rem;
}

.quick-actions-section h2,
.privacy-settings-section h2,
.audit-settings-section h2,
.system-status-section h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
}

.action-card {
  height: 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-card.health-warning {
  border-left: 4px solid var(--ion-color-danger);
}

.card-icon {
  text-align: center;
  margin-bottom: 1rem;
}

.card-icon ion-icon {
  font-size: 2.5rem;
  color: var(--ion-color-primary);
}

.action-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.action-card p {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.settings-grid {
  display: grid;
  gap: 2rem;
}

.setting-group {
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--ion-color-light-tint);
}

.setting-group h3 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
  font-size: 1.1rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-color-light-tint);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ion-color-medium-tint);
}

.status-icon ion-icon {
  font-size: 1.5rem;
  color: var(--ion-color-medium);
}

.status-icon.status-healthy {
  background: var(--ion-color-success-tint);
}

.status-icon.status-healthy ion-icon {
  color: var(--ion-color-success);
}

.status-icon.status-info {
  background: var(--ion-color-primary-tint);
}

.status-icon.status-info ion-icon {
  color: var(--ion-color-primary);
}

.status-icon.status-success {
  background: var(--ion-color-success-tint);
}

.status-icon.status-success ion-icon {
  color: var(--ion-color-success);
}

.status-info h3 {
  margin: 0 0 0.25rem 0;
  color: var(--ion-color-primary);
  font-size: 1rem;
}

.status-info p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .admin-settings-container {
    padding: 0.5rem;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .setting-group {
    padding: 1rem;
  }
}
</style>
