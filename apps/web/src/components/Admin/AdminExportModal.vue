<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('dismiss')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Export Evaluation Data</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('dismiss')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Export Format Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Export Format</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-radio-group v-model="exportOptions.format">
            <ion-item>
              <ion-radio slot="start" value="json"></ion-radio>
              <ion-label>
                <h3>JSON Format</h3>
                <p>Complete data structure with all metadata</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-radio slot="start" value="csv"></ion-radio>
              <ion-label>
                <h3>CSV Format</h3>
                <p>Spreadsheet-friendly tabular data</p>
              </ion-label>
            </ion-item>
          </ion-radio-group>
        </ion-card-content>
      </ion-card>
      <!-- Data Range Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Date Range</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6">
                <ion-item>
                  <ion-label position="stacked">Start Date</ion-label>
                  <ion-input 
                    v-model="exportOptions.startDate" 
                    type="date"
                  ></ion-input>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="6">
                <ion-item>
                  <ion-label position="stacked">End Date</ion-label>
                  <ion-input 
                    v-model="exportOptions.endDate" 
                    type="date"
                  ></ion-input>
                </ion-item>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
      <!-- Data Inclusion Options -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Data Options</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-checkbox 
                v-model="exportOptions.includeUserData" 
                slot="start"
              ></ion-checkbox>
              <ion-label>
                <h3>Include User Information</h3>
                <p>Email, name, roles (respects privacy settings)</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-checkbox 
                v-model="exportOptions.includeContent" 
                slot="start"
              ></ion-checkbox>
              <ion-label>
                <h3>Include Full Content</h3>
                <p>Task prompts, responses, and user notes</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-checkbox 
                v-model="exportOptions.includeWorkflows" 
                slot="start"
              ></ion-checkbox>
              <ion-label>
                <h3>Include Workflow Data</h3>
                <p>Step details, durations, and failure points</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-checkbox 
                v-model="exportOptions.includeConstraints" 
                slot="start"
              ></ion-checkbox>
              <ion-label>
                <h3>Include Constraint Data</h3>
                <p>CIDAFM constraints and effectiveness scores</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-checkbox 
                v-model="exportOptions.includeLLMInfo" 
                slot="start"
              ></ion-checkbox>
              <ion-label>
                <h3>Include LLM Metadata</h3>
                <p>Provider, model, costs, and performance metrics</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- User Role Filter -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>User Role Filter</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-select 
              v-model="exportOptions.userRole" 
              placeholder="All Roles"
              multiple
            >
              <ion-select-option value="user">Regular Users</ion-select-option>
              <ion-select-option value="beta-tester">Beta Testers</ion-select-option>
              <ion-select-option value="developer">Developers</ion-select-option>
              <ion-select-option value="admin">Administrators</ion-select-option>
              <ion-select-option value="evaluation-monitor">Evaluation Monitors</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card-content>
      </ion-card>
      <!-- Privacy & Security Notice -->
      <ion-card color="warning">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="shieldCheckmarkOutline" style="margin-right: 8px;"></ion-icon>
            Privacy & Security Notice
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item lines="none">
              <ion-icon :icon="lockClosedOutline" slot="start" color="warning"></ion-icon>
              <ion-label>
                <p>Exported data contains sensitive information</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-icon :icon="eyeOffOutline" slot="start" color="warning"></ion-icon>
              <ion-label>
                <p>User data is anonymized when possible</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-icon :icon="trashOutline" slot="start" color="warning"></ion-icon>
              <ion-label>
                <p>Delete exported files after use</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-icon :icon="businessOutline" slot="start" color="warning"></ion-icon>
              <ion-label>
                <p>Export logged for compliance audit</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Export Preview -->
      <ion-card v-if="showPreview">
        <ion-card-header>
          <ion-card-title>Export Preview</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Estimated Records</h3>
                <p>{{ previewData.estimatedRecords || 'Calculating...' }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Estimated File Size</h3>
                <p>{{ previewData.estimatedSize || 'Calculating...' }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Data Fields</h3>
                <p>{{ getIncludedFields().join(', ') }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      <!-- Action Buttons -->
      <div class="export-actions">
        <ion-button 
          expand="block" 
          fill="outline" 
          @click="generatePreview"
          :disabled="isGeneratingPreview"
        >
          <ion-icon :icon="eyeOutline" slot="start"></ion-icon>
          {{ isGeneratingPreview ? 'Generating Preview...' : 'Preview Export' }}
        </ion-button>
        <ion-button 
          expand="block" 
          color="primary" 
          @click="confirmExport"
          :disabled="isExporting || !isValidExport"
        >
          <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
          {{ isExporting ? 'Exporting...' : 'Export Data' }}
          <ion-spinner v-if="isExporting" name="crescent" slot="end"></ion-spinner>
        </ion-button>
      </div>
      <!-- Export Progress -->
      <ion-card v-if="exportProgress.show" color="primary">
        <ion-card-content>
          <div class="export-progress">
            <h4>{{ exportProgress.message }}</h4>
            <ion-progress-bar 
              :value="exportProgress.percent / 100"
              color="light"
            ></ion-progress-bar>
            <p>{{ exportProgress.percent }}% complete</p>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>
    <!-- Confirmation Alert -->
    <ion-alert
      :is-open="showConfirmation"
      header="Confirm Export"
      :message="confirmationMessage"
      :buttons="[
        { text: 'Cancel', role: 'cancel' },
        { text: 'Export', handler: () => performExport() }
      ]"
      @didDismiss="showConfirmation = false"
    ></ion-alert>
  </ion-modal>
</template>
<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonRadioGroup,
  IonRadio,
  IonItem,
  IonLabel,
  IonInput,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonList,
  IonIcon,
  IonProgressBar,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonAlert
} from '@ionic/vue';
import {
  downloadOutline,
  eyeOutline,
  shieldCheckmarkOutline,
  lockClosedOutline,
  eyeOffOutline,
  trashOutline,
  businessOutline
} from 'ionicons/icons';
import type { ExportConfig } from '@/types/analytics';

interface Props {
  isOpen: boolean;
}
defineProps<Props>();
const emit = defineEmits<{
  dismiss: [];
  export: [options: ExportConfig];
}>();
const exportOptions = reactive({
  format: 'json',
  startDate: '',
  endDate: '',
  includeUserData: true,
  includeContent: true,
  includeWorkflows: true,
  includeConstraints: true,
  includeLLMInfo: true,
  userRole: [] as string[]
});
const showPreview = ref(false);
const isGeneratingPreview = ref(false);
const isExporting = ref(false);
const showConfirmation = ref(false);
const previewData = reactive({
  estimatedRecords: 0,
  estimatedSize: '',
  includedFields: [] as string[]
});
const exportProgress = reactive({
  show: false,
  percent: 0,
  message: ''
});
const isValidExport = computed(() => {
  // Basic validation
  return exportOptions.format && 
         (exportOptions.includeUserData || 
          exportOptions.includeContent || 
          exportOptions.includeWorkflows || 
          exportOptions.includeConstraints || 
          exportOptions.includeLLMInfo);
});
const confirmationMessage = computed(() => {
  const recordCount = previewData.estimatedRecords;
  const fileSize = previewData.estimatedSize;
  const format = exportOptions.format.toUpperCase();
  return `Export ${recordCount} evaluation records as ${format}? 
          Estimated file size: ${fileSize}. 
          This action will be logged for audit purposes.`;
});
function getIncludedFields(): string[] {
  const fields: string[] = ['Basic Evaluation Data'];
  if (exportOptions.includeUserData) fields.push('User Information');
  if (exportOptions.includeContent) fields.push('Content & Notes');
  if (exportOptions.includeWorkflows) fields.push('Workflow Data');
  if (exportOptions.includeConstraints) fields.push('Constraint Data');
  if (exportOptions.includeLLMInfo) fields.push('LLM Metadata');
  return fields;
}
async function generatePreview() {
  isGeneratingPreview.value = true;
  try {
    // API call to get export preview
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Real implementation would fetch actual data from API
    previewData.estimatedRecords = 0; // Would come from actual API call
    previewData.estimatedSize = getEstimatedFileSize();
    previewData.includedFields = getIncludedFields();
    showPreview.value = true;
  } catch {

  } finally {
    isGeneratingPreview.value = false;
  }
}
function getEstimatedFileSize(): string {
  let baseSize = previewData.estimatedRecords * 0.5; // KB per record base
  if (exportOptions.includeContent) baseSize *= 3;
  if (exportOptions.includeWorkflows) baseSize *= 1.5;
  if (exportOptions.includeConstraints) baseSize *= 1.2;
  if (exportOptions.includeLLMInfo) baseSize *= 1.1;
  if (exportOptions.format === 'json') baseSize *= 1.3;
  if (baseSize < 1024) {
    return `${Math.round(baseSize)} KB`;
  } else {
    return `${(baseSize / 1024).toFixed(1)} MB`;
  }
}
function confirmExport() {
  if (!showPreview.value) {
    generatePreview().then(() => {
      showConfirmation.value = true;
    });
  } else {
    showConfirmation.value = true;
  }
}
async function performExport() {
  isExporting.value = true;
  exportProgress.show = true;
  exportProgress.percent = 0;
  exportProgress.message = 'Preparing export...';
  try {
    // Real export progress would be tracked via API calls
    // This would be replaced with actual export API integration
    exportProgress.percent = 0;
    exportProgress.message = 'Export API not yet implemented';
    
    // Real implementation would:
    // const exportResult = await exportService.startExport(exportOptions);
    // Track progress via WebSocket or polling
    // Emit export event with options
    emit('export', exportOptions);
    // Reset state
    setTimeout(() => {
      exportProgress.show = false;
      exportProgress.percent = 0;
      showPreview.value = false;
      emit('dismiss');
    }, 1500);
  } catch {

    exportProgress.message = 'Export failed!';
  } finally {
    isExporting.value = false;
  }
}
</script>
<style scoped>
.export-actions {
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.export-progress {
  text-align: center;
}
.export-progress h4 {
  margin: 0 0 12px 0;
  color: white;
}
.export-progress p {
  margin: 8px 0 0 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}
ion-card {
  margin-bottom: 16px;
}
ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
}
.privacy-notice ion-item {
  --padding-start: 0;
}
.privacy-notice ion-item ion-label p {
  font-size: 0.9rem;
  margin: 0;
}
@media (max-width: 768px) {
  .export-actions {
    margin: 16px 0;
  }
  ion-modal {
    --height: 90%;
  }
}
</style>