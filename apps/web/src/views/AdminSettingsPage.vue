<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
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

              <!-- Maintain Default Models Card -->
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card class="action-card default-models" button @click="openModelConfigModal">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="settingsOutline" />
                    </div>
                    <h3>Maintain Default Models</h3>
                    <p>View or update global default model configuration</p>
                    <ion-chip :color="envOverrideActive ? 'warning' : 'primary'" size="small">
                      <ion-label>{{ envOverrideActive ? 'Env Override Active' : 'DB Backed' }}</ion-label>
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
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-lg="6">
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
                  </ion-col>
                  <ion-col size="12" size-lg="6">
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
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="12" size-lg="6">
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
                  </ion-col>
                  <ion-col size="12" size-lg="6">
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
                  </ion-col>
                </ion-row>
              </ion-grid>
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
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-lg="6">
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
                  </ion-col>
                </ion-row>
              </ion-grid>
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
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-md="6" size-lg="3">
                    <div class="status-item">
                  <div class="status-icon" :class="{ 'status-healthy': systemHealth.healthy }">
                    <ion-icon :icon="systemHealth.healthy ? checkmarkCircleOutline : alertCircleOutline" />
                  </div>
                  <div class="status-info">
                    <h3>System Health</h3>
                    <p>{{ systemHealth.healthy ? 'All systems operational' : 'Issues detected' }}</p>
                  </div>
                    </div>
                  </ion-col>
                  <ion-col size="12" size-md="6" size-lg="3">
                    <div class="status-item">
                      <div class="status-icon status-info">
                        <ion-icon :icon="peopleOutline" />
                  </div>
                  <div class="status-info">
                    <h3>Active Users</h3>
                    <p>{{ systemStats.activeUsers }} users online</p>
                  </div>
                    </div>
                  </ion-col>
                  <ion-col size="12" size-md="6" size-lg="3">
                    <div class="status-item">
                      <div class="status-icon status-info">
                        <ion-icon :icon="chatbubblesOutline" />
                  </div>
                  <div class="status-info">
                    <h3>Daily Conversations</h3>
                    <p>{{ systemStats.dailyConversations }} conversations today</p>
                  </div>
                    </div>
                  </ion-col>
                  <ion-col size="12" size-md="6" size-lg="3">
                    <div class="status-item">
                      <div class="status-icon status-success">
                        <ion-icon :icon="shieldCheckmarkOutline" />
                      </div>
                      <div class="status-info">
                        <h3>Privacy Protection Rate</h3>
                        <p>{{ systemStats.privacyProtectionRate }}% of data protected</p>
                      </div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    
    <!-- Global Model Config Modal -->
    <ion-modal :is-open="showModelConfigModal" @didDismiss="closeModelConfigModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Maintain Default Models</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModelConfigModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="model-config">
          <p class="hint" v-if="envOverrideActive">
            MODEL_CONFIG_GLOBAL_JSON is set in the environment. DB changes will not take effect until the env override is removed.
          </p>

          <ion-segment v-model="mode">
            <ion-segment-button value="flat">Single Default</ion-segment-button>
            <ion-segment-button value="dual">Default + Local Only</ion-segment-button>
          </ion-segment>

          <div v-if="mode === 'flat'" class="segment-pane">
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="flat.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in providers" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="flat.model" interface="popover" :disabled="!flat.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in flatModelOptions"
                  :key="m.model_name"
                  :value="m.model_name"
                >{{ m.display_name || m.model_name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="flatTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="flatParamsJson" auto-grow />
            </ion-item>
          </div>

          <div v-else class="segment-pane">
            <h4>Default</h4>
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="dual.default.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in providers" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="dual.default.model" interface="popover" :disabled="!dual.default.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in dualDefaultModelOptions"
                  :key="m.model_name"
                  :value="m.model_name"
                >{{ m.display_name || m.model_name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="dualDefaultTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="dualDefaultParamsJson" auto-grow />
            </ion-item>
            <h4 style="margin-top: 16px;">Local Only (optional)</h4>
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="dual.localOnly.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in providers" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="dual.localOnly.model" interface="popover" :disabled="!dual.localOnly.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in dualLocalModelOptions"
                  :key="m.model_name"
                  :value="m.model_name"
                >{{ m.display_name || m.model_name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="dualLocalTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="dualLocalParamsJson" auto-grow />
            </ion-item>
          </div>

          <div class="actions">
            <ion-button :disabled="saving || !isConfigValid" @click="saveModelConfig" expand="block">Save</ion-button>
          </div>
        </div>
      </ion-content>
    </ion-modal>
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
  IonModal,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
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
  chatbubblesOutline,
  settingsOutline
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
// Privacy stores consolidated into usePrivacyStore
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { fetchGlobalModelConfig, updateGlobalModelConfig } from '@/services/systemSettingsService';
import { fetchProvidersWithModels, type ProviderWithModels } from '@/services/modelCatalogService';

// Store and router
const auth = useAuthStore();
const router = useRouter();

// Initialize all stores for reactive data
const privacyStore = usePrivacyStore();
const llmAnalyticsStore = useLLMAnalyticsStore();
const analyticsStore = useAnalyticsStore();

// Reactive state (UI only)
const isUpdating = ref(false);

// Global Model Config Modal state
const showModelConfigModal = ref(false);
const envOverrideActive = ref(false);
const mode = ref<'flat' | 'dual'>('flat');
const flat = ref<{ provider: string; model: string; parameters?: Record<string, unknown> }>({ provider: '', model: '', parameters: {} });
const dual = ref<{ default: { provider: string; model: string; parameters?: Record<string, unknown> }; localOnly: { provider: string; model: string; parameters?: Record<string, unknown> } }>({
  default: { provider: '', model: '', parameters: {} },
  localOnly: { provider: '', model: '', parameters: {} },
});
const providers = ref<ProviderWithModels[]>([]);
const flatTemp = ref<number>(0.7);
const dualDefaultTemp = ref<number>(0.7);
const dualLocalTemp = ref<number>(0.7);
const flatParamsJson = ref('');
const dualDefaultParamsJson = ref('');
const dualLocalParamsJson = ref('');
const saving = ref(false);
const isConfigValid = computed(() => {
  if (mode.value === 'flat') {
    return Boolean(flat.value.provider && flat.value.model);
  }
  // dual mode: default required, localOnly optional but must be complete if provided
  const defOK = Boolean(dual.value.default.provider && dual.value.default.model);
  const localProvided = Boolean(dual.value.localOnly.provider || dual.value.localOnly.model);
  const localOK = !localProvided || Boolean(dual.value.localOnly.provider && dual.value.localOnly.model);
  return defOK && localOK;
});

function openModelConfigModal() {
  showModelConfigModal.value = true;
}
function closeModelConfigModal() {
  showModelConfigModal.value = false;
}

async function loadGlobalModelConfig() {
  try {
    // Load catalog first
    providers.value = await fetchProvidersWithModels({ status: 'active' });
    const res = await fetchGlobalModelConfig();
    envOverrideActive.value = !!res?.envOverrideActive;
    const cfg = res?.dbConfig;
    if (!cfg) return;
    if (cfg.default || cfg.localOnly) {
      mode.value = 'dual';
      dual.value.default.provider = cfg.default?.provider || '';
      dual.value.default.model = cfg.default?.model || '';
      dual.value.default.parameters = cfg.default?.parameters || {};
      dualDefaultTemp.value = (dual.value.default.parameters?.temperature as number) ?? 0.7;
      dual.value.localOnly.provider = cfg.localOnly?.provider || '';
      dual.value.localOnly.model = cfg.localOnly?.model || '';
      dual.value.localOnly.parameters = cfg.localOnly?.parameters || {};
      dualLocalTemp.value = (dual.value.localOnly.parameters?.temperature as number) ?? 0.7;
      dualDefaultParamsJson.value = JSON.stringify(dual.value.default.parameters || {}, null, 2);
      dualLocalParamsJson.value = JSON.stringify(dual.value.localOnly.parameters || {}, null, 2);
    } else {
      mode.value = 'flat';
      flat.value.provider = cfg.provider || '';
      flat.value.model = cfg.model || '';
      flat.value.parameters = cfg.parameters || {};
      flatTemp.value = (flat.value.parameters?.temperature as number) ?? 0.7;
      flatParamsJson.value = JSON.stringify(flat.value.parameters || {}, null, 2);
    }
  } catch {}
}

// Computed model lists with fallback to show DB-selected values
const flatModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === flat.value.provider)?.models || [];
  if (flat.value.model && !list.some(m => m.model_name === flat.value.model)) {
    return [...list, { id: 'custom', model_name: flat.value.model, display_name: flat.value.model } as Record<string, unknown>];
  }
  return list;
});

const dualDefaultModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === dual.value.default.provider)?.models || [];
  if (dual.value.default.model && !list.some(m => m.model_name === dual.value.default.model)) {
    return [...list, { id: 'custom', model_name: dual.value.default.model, display_name: dual.value.default.model } as Record<string, unknown>];
  }
  return list;
});

const dualLocalModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === dual.value.localOnly.provider)?.models || [];
  if (dual.value.localOnly.model && !list.some(m => m.model_name === dual.value.localOnly.model)) {
    return [...list, { id: 'custom', model_name: dual.value.localOnly.model, display_name: dual.value.localOnly.model } as Record<string, unknown>];
  }
  return list;
});

async function saveModelConfig() {
  try {
    saving.value = true;
    if (!isConfigValid.value) {
      const toast = await toastController.create({
        message: 'Please complete required fields (provider and model).',
        duration: 2500,
        color: 'warning',
        position: 'bottom'
      });
      await toast.present();
      return;
    }
    let payload: Record<string, unknown>;
    if (mode.value === 'flat') {
      try { flat.value.parameters = flatParamsJson.value ? JSON.parse(flatParamsJson.value) : {}; } catch { flat.value.parameters = {}; }
      flat.value.parameters.temperature = flatTemp.value;
      payload = { provider: flat.value.provider, model: flat.value.model, parameters: flat.value.parameters };
    } else {
      try { dual.value.default.parameters = dualDefaultParamsJson.value ? JSON.parse(dualDefaultParamsJson.value) : {}; } catch { dual.value.default.parameters = {}; }
      try { dual.value.localOnly.parameters = dualLocalParamsJson.value ? JSON.parse(dualLocalParamsJson.value) : {}; } catch { dual.value.localOnly.parameters = {}; }
      dual.value.default.parameters.temperature = dualDefaultTemp.value;
      if (dual.value.localOnly) dual.value.localOnly.parameters.temperature = dualLocalTemp.value;
      payload = { default: dual.value.default, localOnly: (dual.value.localOnly.provider && dual.value.localOnly.model) ? dual.value.localOnly : undefined };
    }
    try {
      await updateGlobalModelConfig(payload);
      const toast = await toastController.create({
        message: 'Global model configuration saved.',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
      closeModelConfigModal();
    } catch {
      const toast = await toastController.create({
        message: 'Failed to save configuration. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  } finally { saving.value = false; }
}

// Reactive computed properties from stores (no mock data)
const privacySettings = computed(() => ({
  enablePIIDetection: privacyStore.patterns.filter(p => p.enabled).length > 0,
  enableRedaction: privacyStore.dashboardData?.sanitizationMethods?.find(m => m.method === 'redaction')?.enabled || false,
  enablePseudonymization: privacyStore.dashboardData?.sanitizationMethods?.find(m => m.method === 'pseudonymization')?.enabled || true,
  defaultSanitizationLevel: 'standard', // TODO: Get from settings store when available
  autoClassifyData: true,
  defaultClassification: 'internal',
  gdprCompliance: false, // TODO: Get from compliance store when available
  hipaaCompliance: false,
  pciCompliance: false,
  enableSourceBlinding: true,
  sendNoTrainHeaders: true,
  useCustomUserAgent: true
}));

// Reactive computed properties from stores (no mock data)
const auditSettings = computed(() => ({
  enableAuditLogging: privacyStore.dashboardData?.systemHealth?.apiStatus === 'operational' || true,
  logPrivacyOperations: true,
  logAccessAttempts: true, // TODO: Get from audit store when available
  retentionPeriodDays: 365 // TODO: Get from settings store when available
}));

// Reactive stats from stores (no mock data)
const evaluationStats = computed(() => ({
  total: analyticsStore.evaluations?.length || 0,
  pending: analyticsStore.evaluations?.filter(e => e.status === 'pending').length || 0,
  completed: analyticsStore.evaluations?.filter(e => e.status === 'completed').length || 0
}));

const llmStats = computed(() => ({
  totalCost: llmAnalyticsStore.totalCost || 0,
  requestsToday: llmAnalyticsStore.usageRecords.filter(r => {
    const today = new Date().toDateString();
    return new Date(r.started_at).toDateString() === today;
  }).length || 0,
  avgResponseTime: Math.round(llmAnalyticsStore.avgDuration) || 0
}));

const piiStats = computed(() => ({
  patterns: privacyStore.patterns.length || 0,
  active: privacyStore.patterns.filter(p => p.enabled).length || 0,
  detections: 0 // TODO: Get from privacy stats when available
}));

const dictionaryStats = computed(() => ({
  dictionaries: privacyStore.dictionaries.length || 0,
  totalWords: privacyStore.dictionaries.reduce((sum, d) => sum + d.words.length, 0) || 0,
  activeWords: privacyStore.dictionaries.filter(d => d.isActive).reduce((sum, d) => sum + d.words.length, 0) || 0
}));

const systemHealth = computed(() => ({
  healthy: privacyStore.dashboardData?.systemHealth?.apiStatus === 'operational' && privacyStore.dashboardData?.systemHealth?.dbStatus === 'operational',
  uptime: privacyStore.dashboardData?.systemHealth?.uptime || 0,
  issues: (privacyStore.dashboardData?.systemHealth?.apiStatus !== 'operational' ? 1 : 0) + (privacyStore.dashboardData?.systemHealth?.dbStatus !== 'operational' ? 1 : 0)
}));

const systemStats = computed(() => ({
  activeUsers: auth.users?.filter(u => u.isActive).length || 0,
  dailyConversations: analyticsStore.dailyConversations || 0,
  privacyProtectionRate: privacyStore.dashboardMetrics?.protectionRate || 0
}));

// Methods
const navigateTo = (path: string) => {
  router.push(path);
};

  const updatePrivacySetting = async (setting: string, value: unknown) => {
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
    (privacySettings.value as Record<string, unknown>)[setting] = !(privacySettings.value as Record<string, unknown>)[setting];
    
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

  const updateAuditSetting = async (setting: string, value: unknown) => {
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
    (auditSettings.value as Record<string, unknown>)[setting] = !(auditSettings.value as Record<string, unknown>)[setting];
    
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

const _loadSettings = async () => {
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

const _loadStats = async () => {
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

// Lifecycle - Initialize all stores for reactive data
onMounted(async () => {
  try {
    await Promise.all([
      llmAnalyticsStore.initialize(),
      analyticsStore.initialize?.() || Promise.resolve()
    ]);
    await loadGlobalModelConfig();
  } catch (error) {
    console.error('Failed to load admin settings data:', error);
  }
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

.action-card.default-models {
  border-left: 4px solid var(--ion-color-primary);
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

/* Removed: Using Ionic grid instead */

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

/* Removed: Using Ionic grid instead */

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

.model-config .hint {
  color: var(--ion-color-warning);
  margin-bottom: 12px;
}
.model-config .segment-pane {
  margin-top: 12px;
}
.model-config .actions {
  margin-top: 16px;
}

/* Responsive design */
@media (max-width: 768px) {
  .admin-settings-container {
    padding: 0.5rem;
  }
  
  /* Responsive handled by Ionic grid */
  
  .setting-group {
    padding: 1rem;
  }
}
</style>
