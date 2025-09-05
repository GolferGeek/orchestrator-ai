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
              <div class="text-content" v-html="highlightedInputText"></div>
            </div>
            
            <div class="transformation-arrow">
              <ion-icon :icon="arrowForwardOutline"></ion-icon>
            </div>
            
            <div class="text-section">
              <h4>{{ currentPhase.outputLabel || 'Output Text' }}</h4>
              <div class="text-content" v-html="highlightedOutputText"></div>
            </div>
          </div>

          <!-- Pattern Matches -->
          <div v-if="currentPhase.patterns && currentPhase.patterns.length > 0" class="pattern-matches">
            <h4>Detected Patterns</h4>
            <div class="patterns-grid">
              <div 
                v-for="pattern in currentPhase.patterns" 
                :key="pattern.id"
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
              </div>
            </div>
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
                <div class="demo-text original">{{ demoData.originalText }}</div>
              </div>
              
              <div class="demo-step">
                <h4>2. After Redaction (Irreversible)</h4>
                <div class="demo-text redacted">{{ demoData.redactedText }}</div>
                <ion-note color="warning">
                  <ion-icon :icon="warningOutline"></ion-icon>
                  Secrets are permanently redacted for security
                </ion-note>
              </div>
              
              <div class="demo-step">
                <h4>3. After Pseudonymization (Reversible)</h4>
                <div class="demo-text pseudonymized">{{ demoData.pseudonymizedText }}</div>
                <ion-note color="success">
                  <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
                  PII is pseudonymized and can be reversed
                </ion-note>
              </div>
              
              <div class="demo-step">
                <h4>4. Reversed Text</h4>
                <div class="demo-text reversed">{{ demoData.reversedText }}</div>
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

// Props
interface Props {
  sanitizationData?: any;
  autoPlay?: boolean;
  animationSpeed?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoPlay: false,
  animationSpeed: 2000
});

// Emits
const emit = defineEmits<{
  'phase-changed': [phase: number];
  'animation-complete': [];
}>();

// Reactive state
const currentPhaseIndex = ref(0);
const isProcessing = ref(false);
const showReversibilityDemo = ref(false);

// Sanitization phases structure
const sanitizationPhases = ref([
  {
    id: 'input',
    title: 'Input Text',
    subtitle: 'Original text before processing',
    inputLabel: 'Raw Input',
    outputLabel: 'Validated Input',
    inputText: '',
    outputText: '',
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
    inputText: '',
    outputText: '',
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
    inputText: '',
    outputText: '',
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
    inputText: '',
    outputText: '',
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
    inputText: '',
    outputText: '',
    patterns: [],
    metrics: { processingTimeMs: 0 },
    performanceData: []
  }
]);

// Demo data for reversibility demonstration
const demoData = ref({
  originalText: 'Contact John Doe at john.doe@email.com or call (555) 123-4567. API key: sk-abc123xyz.',
  redactedText: 'Contact John Doe at john.doe@email.com or call (555) 123-4567. API key: sk-[REDACTED].',
  pseudonymizedText: 'Contact PersonAlpha at email.beta@domain.com or call (555) 987-6543. API key: sk-[REDACTED].',
  reversedText: 'Contact John Doe at john.doe@email.com or call (555) 123-4567. API key: sk-[REDACTED].'
});

// Computed properties
const currentPhase = computed(() => {
  return sanitizationPhases.value[currentPhaseIndex.value];
});

const progressPercentage = computed(() => {
  return ((currentPhaseIndex.value + 1) / sanitizationPhases.value.length) * 100;
});

const highlightedInputText = computed(() => {
  if (!currentPhase.value) return '';
  return highlightPIIInText(currentPhase.value.inputText || '');
});

const highlightedOutputText = computed(() => {
  if (!currentPhase.value) return '';
  return highlightPIIInText(currentPhase.value.outputText || '');
});

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
  isProcessing.value = false;
  emit('phase-changed', 0);
};

const playAnimation = async () => {
  isProcessing.value = true;
  
  for (let i = 0; i < sanitizationPhases.value.length; i++) {
    currentPhaseIndex.value = i;
    emit('phase-changed', i);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, props.animationSpeed));
  }
  
  isProcessing.value = false;
  emit('animation-complete');
};

const highlightPIIInText = (text: string): string => {
  if (!text) return '';
  
  // Define PII highlighting patterns with colors
  const piiPatterns = [
    { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, color: '#10b981' },
    { type: 'phone', pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, color: '#3b82f6' },
    { type: 'name', pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, color: '#8b5cf6' },
    { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, color: '#ef4444' },
    { type: 'api_key', pattern: /sk-[a-zA-Z0-9]{48}/g, color: '#f59e0b' },
    { type: 'pseudonym', pattern: /\b(PersonAlpha|PersonBeta|PersonGamma|email\.beta|domain\.com)\b/g, color: '#06b6d4' }
  ];
  
  let highlightedText = text;
  
  piiPatterns.forEach(({ type, pattern, color }) => {
    highlightedText = highlightedText.replace(pattern, (match) => {
      return `<span class="pii-highlight pii-${type}" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40; border-radius: 3px; padding: 1px 3px;">${match}</span>`;
    });
  });
  
  return highlightedText;
};

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

// Initialize with sample data
const initializeSampleData = () => {
  const sampleText = 'Hello John Doe, please contact us at john.doe@email.com or (555) 123-4567. API Key: sk-abc123xyz456789.';
  
  sanitizationPhases.value[0].inputText = sampleText;
  sanitizationPhases.value[0].outputText = sampleText;
  
  sanitizationPhases.value[1].inputText = sampleText;
  sanitizationPhases.value[1].outputText = sampleText;
  sanitizationPhases.value[1].patterns = [
    {
      id: '1',
      type: 'name',
      originalValue: 'John Doe',
      replacementValue: 'PersonAlpha',
      description: 'Person name detected using pattern matching'
    },
    {
      id: '2',
      type: 'email',
      originalValue: 'john.doe@email.com',
      replacementValue: 'email.beta@domain.com',
      description: 'Email address identified and flagged for pseudonymization'
    },
    {
      id: '3',
      type: 'phone',
      originalValue: '(555) 123-4567',
      replacementValue: '(555) 987-6543',
      description: 'Phone number pattern matched'
    }
  ];
  sanitizationPhases.value[1].metrics = { processingTimeMs: 45, detectedCount: 3 };
  
  sanitizationPhases.value[2].inputText = sampleText;
  sanitizationPhases.value[2].outputText = 'Hello John Doe, please contact us at john.doe@email.com or (555) 123-4567. API Key: sk-[REDACTED].';
  sanitizationPhases.value[2].patterns = [
    {
      id: '4',
      type: 'api_key',
      originalValue: 'sk-abc123xyz456789',
      replacementValue: 'sk-[REDACTED]',
      description: 'API key detected and redacted for security'
    }
  ];
  sanitizationPhases.value[2].metrics = { processingTimeMs: 12, detectedCount: 1 };
  
  sanitizationPhases.value[3].inputText = 'Hello John Doe, please contact us at john.doe@email.com or (555) 123-4567. API Key: sk-[REDACTED].';
  sanitizationPhases.value[3].outputText = 'Hello PersonAlpha, please contact us at email.beta@domain.com or (555) 987-6543. API Key: sk-[REDACTED].';
  sanitizationPhases.value[3].patterns = [
    {
      id: '5',
      type: 'pseudonym',
      originalValue: 'John Doe → PersonAlpha',
      replacementValue: 'PersonAlpha',
      description: 'Name pseudonymized with reversible mapping'
    },
    {
      id: '6',
      type: 'pseudonym',
      originalValue: 'john.doe@email.com → email.beta@domain.com',
      replacementValue: 'email.beta@domain.com',
      description: 'Email pseudonymized with reversible mapping'
    }
  ];
  sanitizationPhases.value[3].metrics = { processingTimeMs: 67, detectedCount: 2 };
  
  sanitizationPhases.value[4].inputText = 'Hello PersonAlpha, please contact us at email.beta@domain.com or (555) 987-6543. API Key: sk-[REDACTED].';
  sanitizationPhases.value[4].outputText = 'Hello PersonAlpha, please contact us at email.beta@domain.com or (555) 987-6543. API Key: sk-[REDACTED].';
  sanitizationPhases.value[4].metrics = { processingTimeMs: 124 };
};

// Lifecycle hooks
onMounted(() => {
  initializeSampleData();
  
  if (props.autoPlay) {
    playAnimation();
  }
});

// Watchers
watch(() => props.sanitizationData, (newData) => {
  if (newData) {
    // Process real sanitization data when provided
    // This will be implemented when connecting to the API
    console.log('Processing sanitization data:', newData);
  }
});
</script>

<style scoped>
.sanitization-inspector {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.inspector-header h3 {
  margin: 0;
  color: var(--ion-color-primary);
}

.header-controls {
  display: flex;
  gap: 8px;
}

.phase-navigation {
  margin-bottom: 24px;
}

.phase-steps {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.phase-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--ion-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
  border: 2px solid transparent;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-color-medium);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
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
  font-size: 14px;
  color: var(--ion-color-dark);
}

.step-subtitle {
  font-size: 12px;
  color: var(--ion-color-medium-shade);
  margin-top: 2px;
}

.step-status {
  display: flex;
  align-items: center;
}

.status-complete {
  color: var(--ion-color-success);
  font-size: 20px;
}

.status-processing {
  color: var(--ion-color-warning);
}

.status-pending {
  color: var(--ion-color-medium);
  font-size: 16px;
}

.phase-progress {
  height: 4px;
  background: var(--ion-color-light-shade);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-primary), var(--ion-color-secondary));
  transition: width 0.3s ease;
}

.phase-content {
  margin-bottom: 24px;
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
  min-width: 200px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
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
  gap: 24px;
  align-items: center;
  margin-bottom: 24px;
}

.text-section {
  flex: 1;
}

.text-section h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
  font-size: 16px;
}

.text-content {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border: 1px solid var(--ion-color-light-shade);
  min-height: 80px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.transformation-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
}

.transformation-arrow ion-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.pattern-matches {
  margin-bottom: 24px;
}

.pattern-matches h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.pattern-item {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--ion-color-light-shade);
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
  gap: 8px;
}

.pattern-match {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
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
  font-size: 16px;
}

.pattern-info {
  font-size: 12px;
  color: var(--ion-color-medium-shade);
}

.performance-metrics h4 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

.metrics-chart {
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 16px;
}

.chart-bars {
  display: flex;
  gap: 16px;
  align-items: end;
  height: 150px;
}

.metric-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bar-container {
  flex: 1;
  width: 40px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  position: relative;
  display: flex;
  align-items: end;
}

.bar-fill {
  width: 100%;
  border-radius: 4px;
  transition: height 0.3s ease;
  min-height: 4px;
}

.bar-label {
  font-size: 12px;
  color: var(--ion-color-medium-shade);
  text-align: center;
}

.bar-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.reversibility-demo {
  padding: 16px;
}

.demo-section h3 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
}

.demo-flow {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.demo-step h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-dark);
}

.demo-text {
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.demo-text.original {
  background: var(--ion-color-light);
  border: 1px solid var(--ion-color-medium);
}

.demo-text.redacted {
  background: var(--ion-color-warning-tint);
  border: 1px solid var(--ion-color-warning);
}

.demo-text.pseudonymized {
  background: var(--ion-color-primary-tint);
  border: 1px solid var(--ion-color-primary);
}

.demo-text.reversed {
  background: var(--ion-color-success-tint);
  border: 1px solid var(--ion-color-success);
}

.control-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.control-section {
  display: flex;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .text-visualization {
    flex-direction: column;
    gap: 16px;
  }
  
  .transformation-arrow {
    transform: rotate(90deg);
  }
  
  .phase-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .phase-metrics {
    min-width: unset;
    width: 100%;
  }
  
  .patterns-grid {
    grid-template-columns: 1fr;
  }
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
