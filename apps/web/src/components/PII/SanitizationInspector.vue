<template>
  <div class="sanitization-inspector">
    <div class="inspector-header">
      <h3>Sanitization Process Inspector</h3>
      <div class="header-controls">
        <ion-button 
          fill="outline" 
          size="small"
          @click="resetInspection"
        >
          <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
          Reset
        </ion-button>
        <ion-button 
          fill="clear" 
          size="small"
          @click="showReversibilityDemo = !showReversibilityDemo"
        >
          <ion-icon :icon="eyeOutline" slot="start"></ion-icon>
          {{ showReversibilityDemo ? 'Hide' : 'Show' }} Reversibility
        </ion-button>
      </div>
    </div>

    <!-- Input Section -->
    <div class="input-section" v-if="!sanitizationStore.hasResult || processingError">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Text Input</ion-card-title>
          <ion-card-subtitle>Enter text to analyze through the sanitization process</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="input-controls">
            <ion-textarea
              v-model="inputTextLocal"
              placeholder="Enter text to sanitize (e.g., 'Contact John Doe at john@email.com')"
              rows="3"
              :disabled="isProcessing"
            ></ion-textarea>
            
            <div class="input-actions">
              <ion-button 
                expand="block"
                @click="processSanitization"
                :disabled="!inputTextLocal.trim() || isProcessing"
              >
                <ion-spinner v-if="isProcessing" name="crescent" slot="start"></ion-spinner>
                <ion-icon v-else :icon="playOutline" slot="start"></ion-icon>
                {{ isProcessing ? 'Processing...' : 'Analyze Text' }}
              </ion-button>
            </div>
            
            <div v-if="processingError" class="error-message">
              <ion-note color="danger">
                <ion-icon :icon="warningOutline"></ion-icon>
                {{ processingError }}
              </ion-note>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Phase Navigation -->
    <div class="phase-navigation">
      <div class="phase-steps">
        <div 
          v-for="(phase, index) in sanitizationPhases" 
          :key="phase.id"
          class="phase-step"
          :class="{ 
            'active': currentPhaseIndex === index,
            'completed': index < currentPhaseIndex,
            'processing': index === currentPhaseIndex && isProcessing
          }"
          @click="navigateToPhase(index)"
        >
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-info">
            <div class="step-title">{{ phase.title }}</div>
            <div class="step-subtitle">{{ phase.subtitle }}</div>
          </div>
          <div class="step-status">
            <ion-icon 
              v-if="index < currentPhaseIndex" 
              :icon="checkmarkCircleOutline"
              class="status-complete"
            ></ion-icon>
            <ion-spinner 
              v-else-if="index === currentPhaseIndex && isProcessing"
              name="crescent"
              class="status-processing"
            ></ion-spinner>
            <ion-icon 
              v-else
              :icon="ellipseOutline"
              class="status-pending"
            ></ion-icon>
          </div>
        </div>
      </div>

      <!-- Phase Progress Bar -->
      <div class="phase-progress">
        <div 
          class="progress-bar"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Current Phase Content -->
    <div class="phase-content">
      <ion-card v-if="currentPhase">
        <ion-card-header>
          <div class="phase-header">
            <div class="phase-title-section">
              <ion-card-title>{{ currentPhase.title }}</ion-card-title>
              <ion-card-subtitle>{{ currentPhase.subtitle }}</ion-card-subtitle>
            </div>
            <div class="phase-metrics" v-if="currentPhase.metrics">
              <div class="metric-item">
                <span class="metric-label">Processing Time:</span>
                <span class="metric-value">{{ currentPhase.metrics.processingTimeMs }}ms</span>
              </div>
              <div class="metric-item" v-if="currentPhase.metrics.detectedCount !== undefined">
                <span class="metric-label">Items Detected:</span>
                <span class="metric-value">{{ currentPhase.metrics.detectedCount }}</span>
              </div>
            </div>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- Text Visualization -->
          <div class="text-visualization">
            <div class="text-section">
              <h4>{{ currentPhase.inputLabel || 'Input Text' }}</h4>
              <div class="text-content">{{ currentPhase?.inputText || '' }}</div>
            </div>
            
            <div class="transformation-arrow">
              <ion-icon :icon="arrowForwardOutline"></ion-icon>
            </div>
            
            <div class="text-section">
              <h4>{{ currentPhase.outputLabel || 'Output Text' }}</h4>
              <div class="text-content">{{ currentPhase?.outputText || '' }}</div>
            </div>
          </div>

          <!-- Pattern Matches -->
          <div v-if="currentPhase.patterns && currentPhase.patterns.length > 0" class="pattern-matches">
            <h4>Detected Patterns</h4>
            <ion-grid>
              <ion-row>
                <ion-col 
                  v-for="pattern in currentPhase.patterns" 
                  :key="pattern.id"
                  size="12" 
                  size-md="6" 
                  size-lg="4"
                >
                  <div 
                    class="pattern-item"
                    :class="`pattern-${pattern.type}`"
                  >
                <div class="pattern-header">
                  <span class="pattern-type">{{ formatPatternType(pattern.type) }}</span>
                  <ion-badge :color="getPatternColor(pattern.type)">{{ pattern.type }}</ion-badge>
                </div>
                <div class="pattern-details">
                  <div class="pattern-match">
                    <span class="original">{{ pattern.originalValue }}</span>
                    <ion-icon :icon="arrowForwardOutline" class="arrow"></ion-icon>
                    <span class="replacement" :class="`replacement-${pattern.type}`">{{ pattern.replacementValue }}</span>
                  </div>
                  <div class="pattern-info">
                    <span class="pattern-description">{{ pattern.description }}</span>
                  </div>
                  </div>
                </div></ion-col>
              </ion-row>
            </ion-grid>
          </div>

          <!-- Performance Metrics Chart -->
          <div v-if="currentPhase.performanceData" class="performance-metrics">
            <h4>Performance Metrics</h4>
            <div class="metrics-chart">
              <div class="chart-bars">
                <div 
                  v-for="metric in currentPhase.performanceData" 
                  :key="metric.label"
                  class="metric-bar"
                >
                  <div class="bar-container">
                    <div 
                      class="bar-fill"
                      :style="{ 
                        height: `${metric.percentage}%`,
                        backgroundColor: metric.color 
                      }"
                    ></div>
                  </div>
                  <div class="bar-label">{{ metric.label }}</div>
                  <div class="bar-value">{{ metric.value }}{{ metric.unit }}</div>
                </div>
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Reversibility Demo Modal -->
    <ion-modal :is-open="showReversibilityDemo" @didDismiss="showReversibilityDemo = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Reversibility Demonstration</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showReversibilityDemo = false">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content>
        <div class="reversibility-demo">
          <div class="demo-section">
            <h3>Sanitization Process</h3>
            <p>This demonstration shows how the sanitization process can be reversed for certain operations:</p>
            
            <div class="demo-flow">
              <div class="demo-step">
                <h4>1. Original Text</h4>
                <div class="demo-text original">{{ currentResult?.originalText || 'No data processed yet. Enter text above to see sanitization results.' }}</div>
              </div>
              
              <div class="demo-step">
                <h4>2. After Redaction (Irreversible)</h4>
                <div class="demo-text redacted">{{ getRedactedText() || 'Process text to see redaction results' }}</div>
                <ion-note color="warning">
                  <ion-icon :icon="warningOutline"></ion-icon>
                  Secrets are permanently redacted for security
                </ion-note>
              </div>
              
              <div class="demo-step">
                <h4>3. After Pseudonymization (Reversible)</h4>
                <div class="demo-text pseudonymized">{{ getPseudonymizedText() || 'Process text to see pseudonymization results' }}</div>
                <ion-note color="success">
                  <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
                  PII is pseudonymized and can be reversed
                </ion-note>
              </div>
              
              <div class="demo-step">
                <h4>4. Reversed Text</h4>
                <div class="demo-text reversed">{{ getReversedText() || 'Process text to see reversibility results' }}</div>
                <ion-note color="primary">
                  <ion-icon :icon="refreshOutline"></ion-icon>
                  Pseudonyms restored to original PII
                </ion-note>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Control Panel -->
    <div class="control-panel">
      <div class="control-section">
        <ion-button 
          expand="block" 
          fill="solid" 
          :disabled="currentPhaseIndex === 0"
          @click="previousPhase"
        >
          <ion-icon :icon="chevronBackOutline" slot="start"></ion-icon>
          Previous Phase
        </ion-button>
      </div>
      
      <div class="control-section">
        <ion-button 
          expand="block" 
          fill="solid" 
          :disabled="currentPhaseIndex >= sanitizationPhases.length - 1"
          @click="nextPhase"
        >
          Next Phase
          <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
        </ion-button>
      </div>
      
      <div class="control-section">
        <ion-button 
          expand="block" 
          fill="outline" 
          @click="playAnimation"
          :disabled="isProcessing"
        >
          <ion-icon :icon="playOutline" slot="start"></ion-icon>
          {{ isProcessing ? 'Processing...' : 'Play Animation' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonNote,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  IonBadge
} from '@ionic/vue';
import {
  refreshOutline,
  eyeOutline,
  checkmarkCircleOutline,
  ellipseOutline,
  arrowForwardOutline,
  closeOutline,
  warningOutline,
  shieldCheckmarkOutline,
  chevronBackOutline,
  chevronForwardOutline,
  playOutline
} from 'ionicons/icons';
import { useSanitizationStore } from '@/stores/sanitizationStore';

// Props
interface Props {
  inputText?: string;
  autoProcess?: boolean;
  autoPlay?: boolean;
  animationSpeed?: number;
  sanitizationOptions?: {
    enableRedaction?: boolean;
    enablePseudonymization?: boolean;
    context?: string;
  };
}

const props = withDefaults(defineProps<Props>(), {
  inputText: undefined,
  autoProcess: false,
  autoPlay: false,
  animationSpeed: 2000,
  sanitizationOptions: () => ({
    enableRedaction: true,
    enablePseudonymization: true,
    context: 'sanitization-inspector'
  })
});

// Emits
const emit = defineEmits<{
  'phase-changed': [phase: number];
  'animation-complete': [];
  'processing-started': [];
  'processing-complete': [result: Record<string, unknown>];
  'processing-error': [error: string];
}>();

// Store
const sanitizationStore = useSanitizationStore();

// Reactive state
const currentPhaseIndex = ref(0);
const showReversibilityDemo = ref(false);
const inputTextLocal = ref('');

// Computed properties for store integration
const sanitizationPhases = computed(() => {
  if (sanitizationStore.currentResult && sanitizationStore.currentResult.phases.length > 0) {
    return sanitizationStore.currentResult.phases;
  }
  
  // Return default phases if no result
  return [
    {
      id: 'input',
      title: 'Input Text',
      subtitle: 'Original text before processing',
      inputLabel: 'Raw Input',
      outputLabel: 'Validated Input',
      inputText: inputTextLocal.value,
      outputText: inputTextLocal.value,
      patterns: [],
      metrics: null,
      performanceData: null
    },
    {
      id: 'pii-detection',
      title: 'PII Detection',
      subtitle: 'Scanning for personally identifiable information',
      inputLabel: 'Input Text',
      outputLabel: 'Detected PII Patterns',
      inputText: inputTextLocal.value,
      outputText: inputTextLocal.value,
      patterns: [],
      metrics: { processingTimeMs: 0, detectedCount: 0 },
      performanceData: []
    },
    {
      id: 'secret-redaction',
      title: 'Secret Redaction',
      subtitle: 'Removing API keys and sensitive secrets',
      inputLabel: 'Text with Secrets',
      outputLabel: 'Redacted Text',
      inputText: inputTextLocal.value,
      outputText: inputTextLocal.value,
      patterns: [],
      metrics: { processingTimeMs: 0, detectedCount: 0 },
      performanceData: []
    },
    {
      id: 'pseudonymization',
      title: 'Pseudonymization',
      subtitle: 'Replacing PII with reversible pseudonyms',
      inputLabel: 'Text with PII',
      outputLabel: 'Pseudonymized Text',
      inputText: inputTextLocal.value,
      outputText: inputTextLocal.value,
      patterns: [],
      metrics: { processingTimeMs: 0, detectedCount: 0 },
      performanceData: []
    },
    {
      id: 'final-output',
      title: 'Final Output',
      subtitle: 'Sanitized text ready for LLM processing',
      inputLabel: 'Processed Text',
      outputLabel: 'Final Sanitized Text',
      inputText: inputTextLocal.value,
      outputText: inputTextLocal.value,
      patterns: [],
      metrics: { processingTimeMs: 0 },
      performanceData: []
    }
  ];
});

const isProcessing = computed(() => sanitizationStore.isProcessing);
const processingError = computed(() => sanitizationStore.error);

// Reactive data from store (no mock/demo data)
const currentResult = computed(() => sanitizationStore.currentResult);
// const processingHistory = computed(() => sanitizationStore.processingHistory);
// const hasResult = computed(() => sanitizationStore.hasResult);
// const processingStats = computed(() => sanitizationStore.processingStats);

// Computed properties
const currentPhase = computed(() => {
  return sanitizationPhases.value[currentPhaseIndex.value];
});

const progressPercentage = computed(() => {
  return ((currentPhaseIndex.value + 1) / sanitizationPhases.value.length) * 100;
});

// const highlightedInputText = computed(() => {
//   if (!currentPhase.value) return '';
//   return highlightPIIInText(currentPhase.value.inputText || '');
// });

// const highlightedOutputText = computed(() => {
//   if (!currentPhase.value) return '';
//   return highlightPIIInText(currentPhase.value.outputText || '');
// });

// Methods
const navigateToPhase = (index: number) => {
  if (index >= 0 && index < sanitizationPhases.value.length) {
    currentPhaseIndex.value = index;
    emit('phase-changed', index);
  }
};

const nextPhase = () => {
  if (currentPhaseIndex.value < sanitizationPhases.value.length - 1) {
    currentPhaseIndex.value++;
    emit('phase-changed', currentPhaseIndex.value);
  }
};

const previousPhase = () => {
  if (currentPhaseIndex.value > 0) {
    currentPhaseIndex.value--;
    emit('phase-changed', currentPhaseIndex.value);
  }
};

const resetInspection = () => {
  currentPhaseIndex.value = 0;
  sanitizationStore.clearResult();
  emit('phase-changed', 0);
};

const playAnimation = async () => {
  if (!sanitizationStore.hasResult) {
    // Process text first if no result
    await processSanitization();
  }
  
  for (let i = 0; i < sanitizationPhases.value.length; i++) {
    currentPhaseIndex.value = i;
    emit('phase-changed', i);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, props.animationSpeed));
  }
  
  emit('animation-complete');
};

const processSanitization = async () => {
  if (!inputTextLocal.value.trim()) {
    // No fallback mock data - require user input
    return;
  }
  
  try {
    emit('processing-started');
    
    const result = await sanitizationStore.processText(
      inputTextLocal.value,
      props.sanitizationOptions
    );
    
    emit('processing-complete', result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing failed';
    emit('processing-error', errorMessage);
  }
};

// const highlightPIIInText = (text: string): string => {
//   if (!text) return '';
//   
//   // Define PII highlighting patterns with colors
//   const piiPatterns = [
//     { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, color: '#10b981' },
//     { type: 'phone', pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, color: '#3b82f6' },
//     { type: 'name', pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, color: '#8b5cf6' },
//     { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, color: '#ef4444' },
//     { type: 'api_key', pattern: /sk-[a-zA-Z0-9]{48}/g, color: '#f59e0b' },
//     { type: 'pseudonym', pattern: /\b(PersonAlpha|PersonBeta|PersonGamma|email\.beta|domain\.com)\b/g, color: '#06b6d4' }
//   ];
//   
//   let highlightedText = text;
//   
//   piiPatterns.forEach(({ type, pattern, color }) => {
//     highlightedText = highlightedText.replace(pattern, (match) => {
//       return `<span class="pii-highlight pii-${type}" style="background-color: ${color}20; color: ${color}; border: 0.0625rem solid ${color}40; border-radius: 0.1875rem; padding: 0.0625rem 0.1875rem;">${match}</span>`;
//     });
//   });
//   
//   return highlightedText;
// };

const formatPatternType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'email': 'Email Address',
    'phone': 'Phone Number',
    'name': 'Person Name',
    'ssn': 'Social Security Number',
    'api_key': 'API Key',
    'pseudonym': 'Pseudonym'
  };
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

const getPatternColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    'email': 'success',
    'phone': 'primary',
    'name': 'secondary',
    'ssn': 'danger',
    'api_key': 'warning',
    'pseudonym': 'tertiary'
  };
  return colorMap[type] || 'medium';
};

// Helper to add processing control button
// const addProcessButton = () => {
//   return !sanitizationStore.hasResult && inputTextLocal.value.trim();
// };

// Methods for reactive data extraction from store (no mock data)
const getRedactedText = (): string => {
  if (!currentResult.value?.phases) return '';
  const redactionPhase = currentResult.value.phases.find(p => p.title.toLowerCase().includes('redact'));
  return redactionPhase?.outputText || currentResult.value.sanitizedText || '';
};

const getPseudonymizedText = (): string => {
  if (!currentResult.value?.phases) return '';
  const pseudonymPhase = currentResult.value.phases.find(p => p.title.toLowerCase().includes('pseudonym'));
  return pseudonymPhase?.outputText || '';
};

const getReversedText = (): string => {
  if (!currentResult.value?.phases) return '';
  // For demonstration, show the original text as "reversed"
  return currentResult.value.originalText || '';
};

// Lifecycle hooks
onMounted(() => {
  // Initialize with input text from props only (no mock data)
  if (props.inputText) {
    inputTextLocal.value = props.inputText;
  }
  // No fallback mock data - component will show empty state until user provides input
  
  // Auto-process if requested
  if (props.autoProcess) {
    processSanitization();
  }
  
  // Auto-play animation if requested
  if (props.autoPlay) {
    playAnimation();
  }
});

// Watchers
watch(() => props.inputText, (newText) => {
  if (newText && newText !== inputTextLocal.value) {
    inputTextLocal.value = newText;
    
    if (props.autoProcess) {
      processSanitization();
    }
  }
});

watch(() => sanitizationStore.currentResult, (newResult) => {
  if (newResult) {
    // Reset to first phase when new result is available
    currentPhaseIndex.value = 0;
    emit('phase-changed', 0);
  }
});

watch(processingError, (error) => {
  if (error) {
    emit('processing-error', error);
  }
});
</script>

<style scoped>
.sanitization-inspector {
  padding: 1rem;
  max-width: 75rem;
  margin: 0 auto;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.input-section {
  margin-bottom: 1.5rem;
}

.input-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-actions {
  display: flex;
  gap: 0.75rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--ion-color-danger-tint);
  border: 0.0625rem solid var(--ion-color-danger);
  border-radius: 0.5rem;
}

.error-message ion-icon {
  color: var(--ion-color-danger);
}

.inspector-header h3 {
  margin: 0;
  color: var(--ion-color-primary);
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

.phase-navigation {
  margin-bottom: 1.5rem;
}

.phase-steps {
  display: flex;
  gap: 1rem;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.phase-step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 12px 16px;
  border-radius: 0.5rem;
  background: var(--ion-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 12.5rem;
  border: 0.125rem solid transparent;
}

.phase-step:hover {
  background: var(--ion-color-light-shade);
}

.phase-step.active {
  background: var(--ion-color-primary-tint);
  border-color: var(--ion-color-primary);
}

.phase-step.completed {
  background: var(--ion-color-success-tint);
  border-color: var(--ion-color-success);
}

.phase-step.processing {
  background: var(--ion-color-warning-tint);
  border-color: var(--ion-color-warning);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.step-number {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--ion-color-medium);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.875rem;
}

.phase-step.active .step-number {
  background: var(--ion-color-primary);
}

.phase-step.completed .step-number {
  background: var(--ion-color-success);
}

.step-info {
  flex: 1;
}

.step-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ion-color-dark);
}

.step-subtitle {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  margin-top: 0.125rem;
}

.step-status {
  display: flex;
  align-items: center;
}

.status-complete {
  color: var(--ion-color-success);
  font-size: 1.25rem;
}

.status-processing {
  color: var(--ion-color-warning);
}

.status-pending {
  color: var(--ion-color-medium);
  font-size: 1rem;
}

.phase-progress {
  height: 0.25rem;
  background: var(--ion-color-light-shade);
  border-radius: 0.125rem;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-primary), var(--ion-color-secondary));
  transition: width 0.3s ease;
}

.phase-content {
  margin-bottom: 1.5rem;
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.phase-title-section {
  flex: 1;
}

.phase-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 12.5rem;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.metric-label {
  color: var(--ion-color-medium-shade);
}

.metric-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.text-visualization {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.text-section {
  flex: 1;
}

.text-section h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
  font-size: 1rem;
}

.text-content {
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 0.5rem;
  border: 0.0625rem solid var(--ion-color-light-shade);
  min-height: 5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.transformation-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
}

.transformation-arrow ion-icon {
  font-size: 1.5rem;
  color: var(--ion-color-primary);
}

.pattern-matches {
  margin-bottom: 1.5rem;
}

.pattern-matches h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

/* Removed: Using Ionic grid instead */

.pattern-item {
  padding: 1rem;
  border-radius: 0.5rem;
  border: 0.0625rem solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.pattern-type {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.pattern-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pattern-match {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.original {
  color: var(--ion-color-danger);
  text-decoration: line-through;
}

.replacement {
  color: var(--ion-color-success);
  font-weight: 600;
}

.arrow {
  color: var(--ion-color-medium);
  font-size: 1rem;
}

.pattern-info {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
}

.performance-metrics h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

.metrics-chart {
  background: var(--ion-color-light);
  border-radius: 0.5rem;
  padding: 1rem;
}

.chart-bars {
  display: flex;
  gap: 1rem;
  align-items: end;
  height: 9.375rem;
}

.metric-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.bar-container {
  flex: 1;
  width: 2.5rem;
  background: var(--ion-color-light-shade);
  border-radius: 0.25rem;
  position: relative;
  display: flex;
  align-items: end;
}

.bar-fill {
  width: 100%;
  border-radius: 0.25rem;
  transition: height 0.3s ease;
  min-height: 0.25rem;
}

.bar-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  text-align: center;
}

.bar-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.reversibility-demo {
  padding: 1rem;
}

.demo-section h3 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

.demo-flow {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.demo-step h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-dark);
}

.demo-text {
  padding: 1rem;
  border-radius: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.5rem;
}

.demo-text.original {
  background: var(--ion-color-light);
  border: 0.0625rem solid var(--ion-color-medium);
}

.demo-text.redacted {
  background: var(--ion-color-warning-tint);
  border: 0.0625rem solid var(--ion-color-warning);
}

.demo-text.pseudonymized {
  background: var(--ion-color-primary-tint);
  border: 0.0625rem solid var(--ion-color-primary);
}

.demo-text.reversed {
  background: var(--ion-color-success-tint);
  border: 0.0625rem solid var(--ion-color-success);
}

.control-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.control-section {
  display: flex;
}

/* Mobile responsive */
@media (max-width: 48rem) {
  .text-visualization {
    flex-direction: column;
    gap: 1rem;
  }
  
  .transformation-arrow {
    transform: rotate(90deg);
  }
  
  .phase-header {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .phase-metrics {
    min-width: unset;
    width: 100%;
  }
  
  /* Responsive handled by Ionic grid */
}

/* PII Highlighting Styles */
.pii-highlight {
  font-weight: 600;
  transition: all 0.2s ease;
}

.pii-highlight:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
