<template>
  <div class="pii-testing-interface">
    <!-- Header Section -->
    <div class="testing-header">
      <h2>PII Detection Testing</h2>
      <p>Test your PII patterns in real-time and see detection results instantly</p>
    </div>

    <!-- Main Testing Area -->
    <ion-grid>
      <ion-row>
        <!-- Input Section -->
        <ion-col size="12" size-lg="6">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="documentTextOutline" />
                Test Input
              </ion-card-title>
              <ion-card-subtitle>
                Type or paste text to test PII detection
              </ion-card-subtitle>
            </ion-card-header>
            
            <ion-card-content>
              <!-- Test Options -->
              <div class="test-options">
                <ion-item lines="none">
                  <ion-checkbox 
                    v-model="testOptions.enableRedaction" 
                    @ionChange="scheduleDetection"
                  />
                  <ion-label class="ion-margin-start">Enable Redaction</ion-label>
                </ion-item>
                
                <ion-item lines="none">
                  <ion-checkbox 
                    v-model="testOptions.enablePseudonymization" 
                    @ionChange="scheduleDetection"
                  />
                  <ion-label class="ion-margin-start">Enable Pseudonymization</ion-label>
                </ion-item>
              </div>

              <!-- Simplified Text Input Area -->
              <div class="input-container">
                <!-- Simple textarea without highlighting overlay -->
                <ion-textarea
                  ref="textareaRef"
                  v-model="inputText"
                  placeholder="Enter text to test PII detection...

Examples to try:
• Email: john.doe@example.com
• Phone: (555) 123-4567
• SSN: 123-45-6789
• Credit Card: 4532-1234-5678-9012"
                  :rows="12"
                  @ionFocus="isInputFocused = true"
                  @ionBlur="isInputFocused = false"
                  :disabled="isDetecting"
                />
                
                <!-- Show highlighting results below instead of overlay -->
                <div v-if="detectionResult?.matches.length > 0" class="detection-results">
                  <h4>Detected PII:</h4>
                  <div v-for="match in detectionResult.matches" :key="match.startIndex" class="pii-match">
                    <ion-chip :color="getDataTypeColor(match.dataType)">
                      <ion-label>{{ match.dataType }}: {{ inputText.slice(match.startIndex, match.endIndex) }}</ion-label>
                    </ion-chip>
                  </div>
                </div>
                
                <!-- Performance Indicator -->
                <div class="performance-indicator" v-if="lastDetectionTime">
                  <ion-chip 
                    :color="getPerformanceColor(lastDetectionTime)"
                    size="small"
                  >
                    <ion-icon :icon="timeOutline" />
                    <ion-label>{{ lastDetectionTime }}ms</ion-label>
                  </ion-chip>
                  
                  <ion-chip 
                    color="medium" 
                    size="small"
                    v-if="detectionResult?.patternsChecked"
                  >
                    <ion-icon :icon="searchOutline" />
                    <ion-label>{{ detectionResult.patternsChecked }} patterns checked</ion-label>
                  </ion-chip>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>

        <!-- Results Section -->
        <ion-col size="12" size-lg="6">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="analyticsOutline" />
                Detection Results
                <ion-spinner 
                  v-if="isDetecting" 
                  name="crescent" 
                  size="small"
                  class="detection-spinner"
                />
              </ion-card-title>
              <ion-card-subtitle v-if="detectionResult">
                {{ detectionResult.matches.length }} PII entities detected
              </ion-card-subtitle>
            </ion-card-header>
            
            <ion-card-content>
              <!-- No Results State -->
              <div v-if="!inputText.trim()" class="empty-state">
                <ion-icon :icon="documentOutline" size="large" color="medium" />
                <p>Enter text in the input area to see detection results</p>
              </div>
              
              <!-- Detection Results -->
              <div v-else-if="detectionResult" class="results-content">
                <!-- Matched Patterns -->
                <div class="matches-section" v-if="detectionResult.matches.length > 0">
                  <h3>
                    <ion-icon :icon="shieldCheckmarkOutline" />
                    Detected PII Entities
                  </h3>
                  
                  <div class="matches-list">
                    <ion-item 
                      v-for="(match, index) in detectionResult.matches" 
                      :key="index"
                      class="match-item"
                    >
                      <ion-icon 
                        :icon="getDataTypeIcon(match.dataType)" 
                        :color="getDataTypeColor(match.dataType)"
                        slot="start" 
                      />
                      
                      <ion-label>
                        <h3>{{ match.patternName }}</h3>
                        <p>
                          <strong>{{ match.value }}</strong>
                          <ion-chip 
                            :color="getDataTypeColor(match.dataType)" 
                            size="small"
                            outline
                          >
                            {{ match.dataType }}
                          </ion-chip>
                        </p>
                        <p class="match-details">
                          Position: {{ match.startIndex }}-{{ match.endIndex }} | 
                          Confidence: {{ Math.round(match.confidence * 100) }}%
                        </p>
                      </ion-label>
                      
                      <ion-badge 
                        :color="getConfidenceColor(match.confidence)"
                        slot="end"
                      >
                        {{ Math.round(match.confidence * 100) }}%
                      </ion-badge>
                    </ion-item>
                  </div>
                </div>
                
                <!-- No Matches State -->
                <div v-else class="no-matches">
                  <ion-icon :icon="checkmarkCircleOutline" size="large" color="success" />
                  <h3>No PII Detected</h3>
                  <p>The text appears to be clean of personally identifiable information.</p>
                </div>
              </div>
              
              <!-- Error State -->
              <div v-else-if="detectionError" class="error-state">
                <ion-icon :icon="alertCircleOutline" size="large" color="danger" />
                <h3>Detection Error</h3>
                <p>{{ detectionError }}</p>
                <ion-button 
                  fill="outline" 
                  size="small" 
                  @click="retryDetection"
                >
                  Retry Detection
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
      
      <!-- Before/After Comparison -->
      <ion-row v-if="detectionResult && (testOptions.enableRedaction || testOptions.enablePseudonymization)">
        <ion-col size="12">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="gitCompareOutline" />
                Before vs After Comparison
              </ion-card-title>
              <ion-card-subtitle>
                See how the text changes after sanitization
              </ion-card-subtitle>
            </ion-card-header>
            
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <!-- Original Text -->
                  <ion-col size="12" size-md="6">
                    <div class="comparison-section">
                      <h4>
                        <ion-icon :icon="documentOutline" color="primary" />
                        Original Text
                      </h4>
                      <div class="comparison-text original-text">
                        {{ detectionResult.originalText || inputText }}
                      </div>
                      <div class="text-stats">
                        Length: {{ (detectionResult.originalText || inputText).length }} characters
                      </div>
                    </div>
                  </ion-col>
                  
                  <!-- Sanitized Text -->
                  <ion-col size="12" size-md="6">
                    <div class="comparison-section">
                      <h4>
                        <ion-icon :icon="shieldOutline" color="success" />
                        Sanitized Text
                      </h4>
                      <div class="comparison-text sanitized-text">
                        {{ detectionResult.sanitizedText || 'No changes applied' }}
                      </div>
                      <div class="text-stats">
                        Length: {{ (detectionResult.sanitizedText || '').length }} characters
                        <ion-chip 
                          v-if="detectionResult.sanitizedText && detectionResult.sanitizedText !== inputText"
                          color="warning"
                          size="small"
                        >
                          Modified
                        </ion-chip>
                      </div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonTextarea,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonIcon,
  IonChip,
  IonBadge,
  IonButton,
  IonSpinner,
  toastController
} from '@ionic/vue';
import {
  documentTextOutline,
  analyticsOutline,
  documentOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  gitCompareOutline,
  shieldOutline,
  timeOutline,
  searchOutline,
  mailOutline,
  callOutline,
  personOutline,
  locationOutline,
  globeOutline,
  cardOutline,
  keyOutline,
  fingerPrintOutline
} from 'ionicons/icons';

import { piiService } from '@/services/piiService';
import type { PIITestRequest, PIITestResponse, PIIDetectionResult, PIIDataType } from '@/types/pii';

// Reactive state
const inputText = ref('');
const isDetecting = ref(false);
const isInputFocused = ref(false);
const detectionResult = ref<PIIDetectionResult | null>(null);
const detectionError = ref<string | null>(null);
const lastDetectionTime = ref<number | null>(null);
const textareaRef = ref();

// Test options
const testOptions = ref({
  enableRedaction: false,
  enablePseudonymization: false
});

// Debouncing
let detectionTimeout: NodeJS.Timeout | null = null;

// Computed
// const highlightedText = computed(() => {
//   if (!inputText.value || !detectionResult.value?.matches.length) {
//     return inputText.value.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
//   }

//   let highlighted = inputText.value;
//   const matches = [...detectionResult.value.matches].sort((a, b) => b.startIndex - a.startIndex);

//   matches.forEach(match => {
//     const before = highlighted.slice(0, match.startIndex);
//     const matchText = highlighted.slice(match.startIndex, match.endIndex);
//     const after = highlighted.slice(match.endIndex);
    
//     const color = getDataTypeColor(match.dataType);
//     highlighted = before + 
//       `<mark class="pii-highlight pii-${match.dataType}" style="background-color: var(--ion-color-${color}-tint); border-bottom: 2px solid var(--ion-color-${color});" title="${match.patternName} (${Math.round(match.confidence * 100)}%)">${matchText}</mark>` + 
//       after;
//   });

//   return highlighted.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
// });

// Watch for input changes with proper debouncing
watch(inputText, () => {
  scheduleDetection();
}, { flush: 'post' });

// Methods

const scheduleDetection = () => {
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
  }
  
  detectionError.value = null;
  
  if (!inputText.value.trim()) {
    detectionResult.value = null;
    lastDetectionTime.value = null;
    return;
  }
  
  // Debounce detection by 2000ms to allow smooth typing
  detectionTimeout = setTimeout(() => {
    performDetection();
  }, 2000);
};

const performDetection = async () => {
  if (!inputText.value.trim()) return;
  
  isDetecting.value = true;
  detectionError.value = null;
  
  const startTime = performance.now();
  
  try {
    const request: PIITestRequest = {
      text: inputText.value,
      enableRedaction: testOptions.value.enableRedaction,
      enablePseudonymization: testOptions.value.enablePseudonymization,
      context: 'testing-interface'
    };
    
    // Always call detection first
    const detectionResponse: PIITestResponse = await piiService.testPIIDetection(request);
    
    let sanitizationResponse: PIITestResponse | null = null;
    
    // If sanitization options are enabled, also call sanitization endpoint
    if (testOptions.value.enableRedaction || testOptions.value.enablePseudonymization) {
      sanitizationResponse = await piiService.sanitizeText(request);
    }
    
    const endTime = performance.now();
    const detectionTime = Math.round(endTime - startTime);
    lastDetectionTime.value = detectionTime;
    
    if (detectionResponse.success && detectionResponse.detectionResult) {
      // Use detection results for PII matches
      detectionResult.value = detectionResponse.detectionResult;
      
      // If we have sanitization results, add them to the detection result
      if (sanitizationResponse?.success && sanitizationResponse.sanitizedText) {
        detectionResult.value.sanitizedText = sanitizationResponse.sanitizedText;
        detectionResult.value.sanitizationApplied = true;
      } else {
        detectionResult.value.sanitizedText = inputText.value; // No changes
        detectionResult.value.sanitizationApplied = false;
      }
      
      // Show performance warning if > 2 seconds
      if (detectionTime > 2000) {
        showPerformanceWarning(detectionTime);
      }
    } else {
      detectionError.value = detectionResponse.message || 'Unknown detection error';
    }
  } catch (error) {
    const endTime = performance.now();
    lastDetectionTime.value = Math.round(endTime - startTime);
    
    detectionError.value = error instanceof Error ? error.message : 'Failed to perform PII detection';
    console.error('PII detection error:', error);
  } finally {
    isDetecting.value = false;
  }
};

const retryDetection = () => {
  performDetection();
};

const showPerformanceWarning = async (detectionTime: number) => {
  const toast = await toastController.create({
    message: `Detection took ${detectionTime}ms. Consider optimizing for better performance.`,
    duration: 4000,
    color: 'warning',
    position: 'bottom',
    buttons: [
      {
        text: 'Dismiss',
        role: 'cancel'
      }
    ]
  });
  await toast.present();
};

// Utility functions
const getDataTypeIcon = (dataType: PIIDataType) => {
  const icons = {
    email: mailOutline,
    phone: callOutline,
    name: personOutline,
    address: locationOutline,
    ip_address: globeOutline,
    username: personOutline,
    credit_card: cardOutline,
    ssn: keyOutline,
    custom: fingerPrintOutline
  };
  return icons[dataType] || fingerPrintOutline;
};

const getDataTypeColor = (dataType: PIIDataType) => {
  const colors = {
    email: 'primary',
    phone: 'secondary',
    name: 'tertiary',
    address: 'success',
    ip_address: 'warning',
    username: 'danger',
    credit_card: 'dark',
    ssn: 'medium',
    custom: 'light'
  };
  return colors[dataType] || 'medium';
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'danger';
};

const getPerformanceColor = (time: number) => {
  if (time < 500) return 'success';
  if (time < 1000) return 'warning';
  if (time < 2000) return 'danger';
  return 'dark';
};

// Lifecycle
watch(() => inputText.value, () => {
  if (!inputText.value.trim()) {
    detectionResult.value = null;
    lastDetectionTime.value = null;
    detectionError.value = null;
  }
});
</script>

<style scoped>
.pii-testing-interface {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.testing-header {
  text-align: center;
  margin-bottom: 2rem;
}

.testing-header h2 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.testing-header p {
  color: var(--ion-color-medium);
  font-size: 1.1rem;
}

.test-options {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.input-container {
  position: relative;
}

.highlighted-textarea-container {
  position: relative;
  border: 2px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-background-color);
  transition: border-color 0.3s ease;
}

.highlighted-textarea-container.has-matches {
  border-color: var(--ion-color-warning);
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.transparent-textarea {
  position: relative;
  z-index: 2;
  background: transparent;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
}

.transparent-textarea textarea {
  background: transparent !important;
  color: var(--ion-text-color);
}

.performance-indicator {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  align-items: center;
}

.detection-spinner {
  margin-left: 0.5rem;
}

.empty-state,
.no-matches,
.error-state {
  text-align: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.no-matches {
  color: var(--ion-color-success);
}

.error-state {
  color: var(--ion-color-danger);
}

.matches-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
}

.matches-list {
  max-height: 400px;
  overflow-y: auto;
}

.match-item {
  margin-bottom: 0.5rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
}

.match-details {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0.25rem 0;
}

.comparison-section {
  height: 100%;
}

.comparison-section h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.comparison-text {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 200px;
  max-height: 300px;
  overflow-y: auto;
}

.original-text {
  border-left: 4px solid var(--ion-color-primary);
}

.sanitized-text {
  border-left: 4px solid var(--ion-color-success);
}

.text-stats {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* PII Highlighting Styles */
:deep(.pii-highlight) {
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: bold;
  cursor: help;
  transition: all 0.2s ease;
}

:deep(.pii-highlight:hover) {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .pii-testing-interface {
    padding: 0.5rem;
  }
  
  .testing-header h2 {
    font-size: 1.5rem;
  }
  
  .comparison-text {
    font-size: 0.8rem;
    min-height: 150px;
  }
  
  .matches-list {
    max-height: 300px;
  }
}
</style>
