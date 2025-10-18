<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/admin/llm-usage"></ion-back-button>
        </ion-buttons>
        <ion-title>LLM Call Details</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div v-if="loading" class="loading">
        Loading usage details...
      </div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="details" class="details">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Request</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <strong>Run ID:</strong>
                  <div class="mono">{{ details.run_id }}</div>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <strong>Status:</strong>
                  <ion-chip :color="statusColor(details.status)" size="small">{{ details.status }}</ion-chip>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <strong>Provider / Model:</strong>
                  <div>{{ details.provider_name }} / {{ details.model_name }}</div>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <strong>Caller:</strong>
                  <div>{{ details.caller_name }} ({{ details.caller_type }})</div>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <strong>Started:</strong>
                  <div>{{ formatDate(details.started_at) }}</div>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <strong>Completed:</strong>
                  <div>{{ formatDate(details.completed_at) || '—' }}</div>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <strong>Route:</strong>
                  <ion-chip :color="(details.route ?? (details.is_local ? 'local' : 'remote')) === 'local' ? 'success' : 'tertiary'" size="small">
                    {{ details.route ?? (details.is_local ? 'local' : 'remote') }}
                  </ion-chip>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <strong>Conversation ID:</strong>
                  <div class="mono">{{ details.conversation_id || '—' }}</div>
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

        <ion-card>
          <ion-card-header>
            <ion-card-title>Usage</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="12" size-md="4"><strong>Input tokens:</strong> {{ details.input_tokens ?? 0 }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Output tokens:</strong> {{ details.output_tokens ?? 0 }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Duration:</strong> {{ formatDuration(details.duration_ms) }}</ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" size-md="4"><strong>Cost (in):</strong> {{ formatCurrency(details.input_cost) }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Cost (out):</strong> {{ formatCurrency(details.output_cost) }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Total:</strong> {{ formatCurrency(details.total_cost) }}</ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>PII & Sanitization</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="12" size-md="4"><strong>PII Detected:</strong> {{ details.pii_detected ? 'Yes' : 'No' }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Pseudonyms Used:</strong> {{ details.pseudonyms_used ?? 0 }}</ion-col>
                <ion-col size="12" size-md="4"><strong>Redactions Applied:</strong> {{ details.redactions_applied ?? 0 }}</ion-col>
              </ion-row>
              <!-- Show detailed pseudonym mappings when available -->
              <ion-row v-if="details.pseudonym_mappings?.length">
                <ion-col size="12">
                  <strong>Pseudonym Mappings:</strong>
                  <div class="mapping-table-wrapper">
                    <table class="mapping-table">
                      <thead>
                        <tr>
                          <th>Original</th>
                          <th>Pseudonym</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(m, idx) in details.pseudonym_mappings" :key="idx">
                          <td class="mono">{{ m.original }}</td>
                          <td class="mono">{{ m.pseudonym }}</td>
                          <td>
                            <ion-chip size="small">{{ m.dataType }}</ion-chip>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </ion-col>
              </ion-row>
              <!-- Fallback to type chips if no mappings -->
              <ion-row v-else-if="details.pseudonym_types?.length">
                <ion-col size="12">
                  <strong>Pseudonym Types:</strong>
                  <ion-chip v-for="t in details.pseudonym_types" :key="t" size="small">{{ t }}</ion-chip>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip,
  IonGrid, IonRow, IonCol
} from '@ionic/vue';
import { llmAnalyticsService, type LlmUsageDetail } from '@/services/llmAnalyticsService';

const route = useRoute();
const details = ref<LlmUsageDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  const runId = route.params.runId as string;
  if (!runId) return;
  loading.value = true;
  try {
    const resp = await llmAnalyticsService.getUsageDetails(runId);
    details.value = resp;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load usage details';
  } finally {
    loading.value = false;
  }
});

function statusColor(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'completed': return 'success';
    case 'failed':
    case 'error': return 'danger';
    case 'running':
    case 'in_progress': return 'warning';
    default: return 'medium';
  }
}

function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString();
}

function formatDuration(ms?: number | null): string {
  if (!ms && ms !== 0) return '-';
  if ((ms as number) < 1000) return `${ms}ms`;
  return `${((ms as number)/1000).toFixed(2)}s`;
}

function formatCurrency(amount?: number | null): string {
  const n = amount ?? 0;
  return `$${n.toFixed(4)}`;
}

function copyJson() {
  if (!details.value) return;
  const text = JSON.stringify(details.value, null, 2);
  navigator.clipboard?.writeText(text).catch(() => {});
}

function downloadJson() {
  if (!details.value) return;
  const blob = new Blob([JSON.stringify(details.value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm_usage_${details.value.run_id || 'details'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.loading, .error { padding: 16px; }
.mapping-table-wrapper { overflow-x: auto; margin-top: 8px; }
.mapping-table { width: 100%; border-collapse: collapse; }
.mapping-table th, .mapping-table td { border-bottom: 1px solid var(--ion-color-light); padding: 8px; text-align: left; }
.mapping-table th { background: var(--ion-color-light); font-weight: 600; }
</style>
