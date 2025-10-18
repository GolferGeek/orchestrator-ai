<template>
  <ion-modal :is-open="isOpen" @did-dismiss="handleDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>LLM Usage Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleDismiss">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    
    <ion-content class="ion-padding">
      <div v-if="loading" class="loading-container">
        <ion-spinner />
        <p>Loading details...</p>
      </div>
      
      <div v-else-if="usageDetails">
        <!-- Basic Information -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Request Information</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Run ID</p>
                      <h3>{{ usageDetails.run_id }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Status</p>
                      <h3>
                        <ion-badge :color="getStatusColor(usageDetails.status)">
                          {{ usageDetails.status }}
                        </ion-badge>
                      </h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Provider</p>
                      <h3>{{ usageDetails.provider }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Model</p>
                      <h3>{{ usageDetails.model }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Caller Type</p>
                      <h3>{{ usageDetails.caller_type || 'N/A' }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Caller Name</p>
                      <h3>{{ usageDetails.caller_name || 'N/A' }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Route</p>
                      <h3>
                        <ion-chip :color="(usageDetails.route ?? (usageDetails.is_local ? 'local' : 'remote')) === 'local' ? 'success' : 'tertiary'" size="small">
                          {{ usageDetails.route ?? (usageDetails.is_local ? 'local' : 'remote') }}
                        </ion-chip>
                      </h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Conversation</p>
                      <h3 class="mono">{{ usageDetails.conversation_id || '—' }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <!-- Actions -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Actions</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-button size="small" fill="outline" @click="copyJson">Copy JSON</ion-button>
            <ion-button size="small" fill="outline" color="secondary" @click="downloadJson">Download JSON</ion-button>
          </ion-card-content>
        </ion-card>

        <!-- PII Detection Summary -->
        <ion-card v-if="hasPIIData">
          <ion-card-header>
            <ion-card-title>
              <ion-icon :icon="shieldCheckmarkOutline" />
              PII Detection & Sanitization
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="pii-summary">
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-md="4">
                    <div class="pii-stat">
                      <ion-icon 
                        :icon="usageDetails.pii_detected ? warningOutline : checkmarkCircleOutline"
                        :color="usageDetails.pii_detected ? 'warning' : 'success'"
                        size="large"
                      />
                      <div class="pii-stat-content">
                        <h3>{{ usageDetails.pii_detected ? 'PII Detected' : 'No PII Detected' }}</h3>
                        <p>{{ usageDetails.sanitization_level || 'None' }} sanitization</p>
                      </div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="12" size-md="4">
                    <div class="pii-stat">
                      <ion-icon :icon="peopleOutline" color="primary" size="large" />
                      <div class="pii-stat-content">
                        <h3>{{ usageDetails.pseudonyms_used || 0 }} Pseudonyms</h3>
                        <p>{{ getPseudonymTypesText() }}</p>
                      </div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="12" size-md="4">
                    <div class="pii-stat">
                      <ion-icon :icon="eyeOffOutline" color="danger" size="large" />
                      <div class="pii-stat-content">
                        <h3>{{ usageDetails.redactions_applied || 0 }} Redactions</h3>
                        <p>{{ getRedactionTypesText() }}</p>
                      </div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </div>

            <!-- PII Types Detected -->
            <div v-if="usageDetails.pii_types?.length" class="pii-types-section">
              <h4>PII Types Detected</h4>
              <div class="pii-badges">
                <ion-badge 
                  v-for="piiType in usageDetails.pii_types" 
                  :key="piiType"
                  :color="getPIITypeColor(piiType)"
                  class="pii-badge"
                >
                  <ion-icon :icon="getPIITypeIcon(piiType)" />
                  {{ formatPIIType(piiType) }}
                </ion-badge>
              </div>
            </div>

            <!-- Pseudonym Mappings -->
            <div v-if="pseudonymMappings?.length" class="mappings-section">
              <h4>Pseudonym Mappings</h4>
              <ion-list>
                <ion-item v-for="mapping in pseudonymMappings" :key="mapping.id" lines="full">
                  <ion-label>
                    <p>{{ mapping.data_type }}</p>
                    <h3>{{ mapping.original_value }}</h3>
                    <p class="pseudonym-value">→ {{ mapping.pseudonym_value }}</p>
                  </ion-label>
                  <ion-badge slot="end" color="medium">
                    {{ mapping.context }}
                  </ion-badge>
                </ion-item>
              </ion-list>
            </div>

            <!-- Redaction Patterns -->
            <div v-if="usageDetails.redaction_types?.length" class="redaction-section">
              <h4>Redaction Patterns Applied</h4>
              <div class="redaction-badges">
                <ion-badge 
                  v-for="pattern in usageDetails.redaction_types" 
                  :key="pattern"
                  color="danger"
                  class="redaction-badge"
                >
                  {{ formatRedactionPattern(pattern) }}
                </ion-badge>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Token Usage -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Token Usage & Cost</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="6" size-md="3">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Input Tokens</p>
                      <h3>{{ usageDetails.input_tokens || 0 }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Output Tokens</p>
                      <h3>{{ usageDetails.output_tokens || 0 }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Total Cost</p>
                      <h3>${{ ((usageDetails.input_cost || 0) + (usageDetails.output_cost || 0)).toFixed(6) }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-item lines="none">
                    <ion-label>
                      <p>Duration</p>
                      <h3>{{ usageDetails.duration_ms || 0 }}ms</h3>
                    </ion-label>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <!-- Timing Information -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Timing</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item lines="none">
              <ion-label>
                <p>Started At</p>
                <h3>{{ formatDateTime(usageDetails.started_at) }}</h3>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                <p>Completed At</p>
                <h3>{{ formatDateTime(usageDetails.completed_at) }}</h3>
              </ion-label>
            </ion-item>
            <ion-item lines="none" v-if="usageDetails.sanitization_time_ms">
              <ion-label>
                <p>Sanitization Time</p>
                <h3>{{ usageDetails.sanitization_time_ms }}ms</h3>
              </ion-label>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- Error Information -->
        <ion-card v-if="usageDetails.error_message" color="danger">
          <ion-card-header>
            <ion-card-title>Error</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <pre>{{ usageDetails.error_message }}</pre>
          </ion-card-content>
        </ion-card>
      </div>
      
      <div v-else class="no-data">
        <ion-icon :icon="alertCircleOutline" size="large" />
        <p>No usage details found</p>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonList,
} from '@ionic/vue';
import {
  closeOutline,
  shieldCheckmarkOutline,
  warningOutline,
  checkmarkCircleOutline,
  peopleOutline,
  eyeOffOutline,
  alertCircleOutline,
  personOutline,
  businessOutline,
  locationOutline,
  mailOutline,
  callOutline,
  cardOutline,
  keyOutline,
  lockClosedOutline,
  globeOutline,
} from 'ionicons/icons';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { usePrivacyStore } from '@/stores/privacyStore';

interface Props {
  isOpen: boolean;
  runId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:isOpen', 'dismiss']);

interface UsageDetails {
  run_id: string;
  status: string;
  pii_detected: boolean;
  pseudonyms_used: number;
  redactions_applied: number;
  [key: string]: unknown;
}

interface PseudonymMapping {
  original: string;
  pseudonym: string;
  [key: string]: unknown;
}

const loading = ref(false);
const usageDetails = ref<UsageDetails | null>(null);
const pseudonymMappings = ref<PseudonymMapping[]>([]);

const hasPIIData = computed(() => {
  return usageDetails.value?.pii_detected || 
         usageDetails.value?.pseudonyms_used > 0 || 
         usageDetails.value?.redactions_applied > 0;
});

watch(() => props.runId, async (newRunId) => {
  if (newRunId && props.isOpen) {
    await loadUsageDetails(newRunId);
  }
});

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.runId) {
    await loadUsageDetails(props.runId);
  }
});

async function loadUsageDetails(runId: string) {
  loading.value = true;
  const llmAnalyticsStore = useLLMAnalyticsStore();
  const pseudonymMappingsStore = usePrivacyStore();

  try {
    // Load usage details
    const details = await llmAnalyticsStore.getLLMUsageDetails(runId);
    usageDetails.value = details;
    
    // Load pseudonym mappings if there are pseudonyms
    if (details?.pseudonyms_used > 0) {
      const mappings = await pseudonymMappingsStore.getMappingsByRunId(runId);
      pseudonymMappings.value = mappings;
    }
  } catch (error) {
    console.error('Error loading usage details:', error);
  } finally {
    loading.value = false;
  }
}

function handleDismiss() {
  emit('update:isOpen', false);
  emit('dismiss');
}

function copyJson() {
  if (!usageDetails.value) return;
  const text = JSON.stringify(usageDetails.value, null, 2);
  navigator.clipboard?.writeText(text).catch(() => {});
}

function downloadJson() {
  if (!usageDetails.value) return;
  const blob = new Blob([JSON.stringify(usageDetails.value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm_usage_${usageDetails.value.run_id || 'details'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'success';
    case 'failed': return 'danger';
    case 'pending': return 'warning';
    default: return 'medium';
  }
}

function getPIITypeColor(type: string): string {
  switch (type) {
    case 'email': return 'primary';
    case 'phone': return 'secondary';
    case 'ssn': return 'danger';
    case 'credit_card': return 'warning';
    case 'ip_address': return 'tertiary';
    case 'url': return 'medium';
    default: return 'light';
  }
}

function getPIITypeIcon(type: string) {
  switch (type) {
    case 'email': return mailOutline;
    case 'phone': return callOutline;
    case 'ssn': return cardOutline;
    case 'credit_card': return cardOutline;
    case 'api_key': return keyOutline;
    case 'password': return lockClosedOutline;
    case 'ip_address': return globeOutline;
    case 'url': return globeOutline;
    case 'person_name': return personOutline;
    case 'organization': return businessOutline;
    case 'location': return locationOutline;
    default: return shieldCheckmarkOutline;
  }
}

function formatPIIType(type: string): string {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function formatRedactionPattern(pattern: string): string {
  return pattern.split(/(?=[A-Z])/).join(' ').toLowerCase()
    .split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getPseudonymTypesText(): string {
  if (!usageDetails.value?.pseudonym_types?.length) {
    return 'No types specified';
  }
  return usageDetails.value.pseudonym_types.slice(0, 3).join(', ') + 
    (usageDetails.value.pseudonym_types.length > 3 ? '...' : '');
}

function getRedactionTypesText(): string {
  if (!usageDetails.value?.redaction_types?.length) {
    return 'No patterns specified';
  }
  return usageDetails.value.redaction_types.slice(0, 3).join(', ') + 
    (usageDetails.value.redaction_types.length > 3 ? '...' : '');
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString();
}
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 1rem;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 1rem;
  color: var(--ion-color-medium);
}

.pii-summary {
  margin: 1rem 0;
}

.pii-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.pii-stat-content h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.pii-stat-content p {
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.pii-types-section,
.mappings-section,
.redaction-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.pii-types-section h4,
.mappings-section h4,
.redaction-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.pii-badges,
.redaction-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pii-badge,
.redaction-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}

.pii-badge ion-icon,
.redaction-badge ion-icon {
  font-size: 1rem;
}

.pseudonym-value {
  color: var(--ion-color-primary);
  font-family: monospace;
  margin-top: 0.25rem;
}

ion-card {
  margin-bottom: 1rem;
}

ion-item ion-label p {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.25rem;
}

ion-item ion-label h3 {
  font-size: 1rem;
  font-weight: 500;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 0.875rem;
  margin: 0;
}
</style>
