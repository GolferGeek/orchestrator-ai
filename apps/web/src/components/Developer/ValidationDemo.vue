<template>
  <div class="validation-demo">
    <ion-card>
      <ion-card-header>
        <ion-card-title>Frontend Input Validation Demo</ion-card-title>
        <ion-card-subtitle>
          Comprehensive validation system with security patterns, PII detection, and real-time feedback
        </ion-card-subtitle>
      </ion-card-header>
      
      <ion-card-content>
        <!-- Validation Configuration -->
        <div class="demo-section">
          <h3>Validation Configuration</h3>
          <div class="config-grid">
            <ion-item>
              <ion-label>Strict Mode</ion-label>
              <ion-checkbox 
                v-model="config.strictMode"
                @ionChange="updateValidationConfig"
              />
            </ion-item>
            
            <ion-item>
              <ion-label>Sanitize Inputs</ion-label>
              <ion-checkbox 
                v-model="config.sanitizeInputs"
                @ionChange="updateValidationConfig"
              />
            </ion-item>
            
            <ion-item>
              <ion-label>Validate on Change</ion-label>
              <ion-checkbox 
                v-model="config.validateOnChange"
                @ionChange="updateValidationConfig"
              />
            </ion-item>
          </div>
        </div>
        
        <!-- Text Input Validation -->
        <div class="demo-section">
          <h3>Text Input Validation</h3>
          <ion-item>
            <ion-label position="stacked">Sample Text (10-500 chars, no XSS)</ion-label>
            <ion-textarea
              v-model="formData.sampleText"
              :class="{ 'ion-invalid': getFieldStatus('sampleText') === 'error' }"
              placeholder="Enter text to validate..."
              rows="4"
              @ionInput="handleTextInput"
              @ionBlur="handleTextBlur"
            />
          </ion-item>
          <ValidationMessage 
            :errors="validationStore.getFieldErrors('sampleText')"
            :warnings="validationStore.getFieldWarnings('sampleText')"
            :is-validating="validationStore.isFieldValidating('sampleText')"
            :show-details="showDetails"
            show-actions
            dismissible
            @retry="validateField('sampleText')"
          />
        </div>
        
        <!-- Email Validation -->
        <div class="demo-section">
          <h3>Email Validation</h3>
          <ion-item>
            <ion-label position="stacked">Email Address</ion-label>
            <ion-input
              v-model="formData.email"
              type="email"
              :class="{ 'ion-invalid': getFieldStatus('email') === 'error' }"
              placeholder="user@example.com"
              @ionInput="handleEmailInput"
              @ionBlur="handleEmailBlur"
            />
          </ion-item>
          <ValidationMessage 
            :errors="validationStore.getFieldErrors('email')"
            :warnings="validationStore.getFieldWarnings('email')"
            :is-validating="validationStore.isFieldValidating('email')"
            inline
          />
        </div>
        
        <!-- Regex Pattern Validation -->
        <div class="demo-section">
          <h3>Regex Pattern Validation</h3>
          <ion-item>
            <ion-label position="stacked">Regular Expression Pattern</ion-label>
            <ion-input
              v-model="formData.regexPattern"
              :class="{ 'ion-invalid': getFieldStatus('regexPattern') === 'error' }"
              placeholder="/^[a-zA-Z0-9]+$/"
              @ionInput="handleRegexInput"
              @ionBlur="handleRegexBlur"
            />
          </ion-item>
          <ValidationMessage 
            :errors="validationStore.getFieldErrors('regexPattern')"
            :warnings="validationStore.getFieldWarnings('regexPattern')"
            :is-validating="validationStore.isFieldValidating('regexPattern')"
            :show-details="showDetails"
          />
          
          <!-- Regex Test -->
          <div v-if="formData.regexPattern && getFieldStatus('regexPattern') === 'valid'" class="regex-test">
            <ion-item>
              <ion-label position="stacked">Test String</ion-label>
              <ion-input
                v-model="regexTestString"
                placeholder="Enter text to test against pattern..."
                @ionInput="testRegexPattern"
              />
            </ion-item>
            <div v-if="regexTestResult !== null" class="regex-result">
              <ion-chip :color="regexTestResult ? 'success' : 'danger'">
                <ion-icon :icon="regexTestResult ? checkmarkOutline : closeOutline" />
                <ion-label>{{ regexTestResult ? 'Match' : 'No Match' }}</ion-label>
              </ion-chip>
            </div>
          </div>
        </div>
        
        <!-- Security Testing -->
        <div class="demo-section">
          <h3>Security Validation Testing</h3>
          <div class="security-tests">
            <ion-button 
              v-for="test in securityTests"
              :key="test.name"
              :color="test.result === null ? 'medium' : test.result ? 'danger' : 'success'"
              size="small"
              fill="outline"
              @click="runSecurityTest(test)"
            >
              <ion-icon 
                :icon="test.result === null ? playOutline : test.result ? alertOutline : checkmarkOutline" 
                slot="start" 
              />
              {{ test.name }}
            </ion-button>
          </div>
          
          <div v-if="lastSecurityTest" class="security-result">
            <ValidationMessage 
              :type="lastSecurityTest.result ? 'error' : 'success'"
              :message="lastSecurityTest.message"
              :context="lastSecurityTest.context"
              :show-details="showDetails"
            />
          </div>
        </div>
        
        <!-- PII Detection Demo -->
        <div class="demo-section">
          <h3>PII Detection</h3>
          <ion-item>
            <ion-label position="stacked">Text with Potential PII</ion-label>
            <ion-textarea
              v-model="piiTestText"
              placeholder="Enter text that might contain PII (emails, phone numbers, SSN, etc.)..."
              rows="3"
              @ionInput="detectPII"
            />
          </ion-item>
          
          <div v-if="piiMatches.length > 0" class="pii-results">
            <h4>Detected PII Patterns:</h4>
            <div class="pii-matches">
              <ion-chip 
                v-for="match in piiMatches" 
                :key="`${match.type}-${match.start}`"
                color="warning"
              >
                <ion-icon :icon="eyeOutline" />
                <ion-label>{{ match.type.toUpperCase() }}: {{ match.match }}</ion-label>
              </ion-chip>
            </div>
          </div>
        </div>
        
        <!-- Validation Summary -->
        <div class="demo-section">
          <h3>Validation Summary</h3>
          <div class="validation-summary">
            <div class="summary-stats">
              <div class="stat">
                <ion-icon :icon="checkmarkCircleOutline" color="success" />
                <span>Valid Fields: {{ validationSummary.validFields }}</span>
              </div>
              <div class="stat">
                <ion-icon :icon="alertCircleOutline" color="danger" />
                <span>Invalid Fields: {{ validationSummary.invalidFields }}</span>
              </div>
              <div class="stat">
                <ion-icon :icon="warningOutline" color="warning" />
                <span>Warnings: {{ validationSummary.totalWarnings }}</span>
              </div>
              <div class="stat">
                <ion-icon :icon="speedometerOutline" color="primary" />
                <span>Validation Rate: {{ validationSummary.validationRate.toFixed(1) }}%</span>
              </div>
            </div>
            
            <div class="form-status">
              <ion-chip 
                :color="validationSummary.invalidFields === 0 ? 'success' : 'danger'"
                class="status-chip"
              >
                <ion-icon 
                  :icon="validationSummary.invalidFields === 0 ? checkmarkCircleOutline : alertCircleOutline" 
                />
                <ion-label>
                  Form {{ validationSummary.invalidFields === 0 ? 'Valid' : 'Invalid' }}
                </ion-label>
              </ion-chip>
            </div>
          </div>
        </div>
        
        <!-- Debug Controls -->
        <div class="demo-section">
          <h3>Debug Controls</h3>
          <div class="debug-controls">
            <ion-button 
              size="small" 
              fill="outline" 
              @click="showDetails = !showDetails"
            >
              <ion-icon :icon="codeSlashOutline" slot="start" />
              {{ showDetails ? 'Hide' : 'Show' }} Details
            </ion-button>
            
            <ion-button 
              size="small" 
              fill="outline" 
              @click="clearAllValidation"
            >
              <ion-icon :icon="refreshOutline" slot="start" />
              Clear All
            </ion-button>
            
            <ion-button 
              size="small" 
              fill="outline" 
              @click="exportValidationState"
            >
              <ion-icon :icon="downloadOutline" slot="start" />
              Export State
            </ion-button>
            
            <ion-button 
              size="small" 
              fill="outline" 
              @click="showAnalytics = !showAnalytics"
            >
              <ion-icon :icon="analyticsOutline" slot="start" />
              {{ showAnalytics ? 'Hide' : 'Show' }} Analytics
            </ion-button>
          </div>
        </div>
        
        <!-- Analytics Panel -->
        <div v-if="showAnalytics" class="demo-section">
          <h3>Validation Analytics</h3>
          <div class="analytics-panel">
            <pre class="analytics-data">{{ JSON.stringify(validationAnalytics, null, 2) }}</pre>
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonTextarea,
  IonInput,
  IonCheckbox,
  IonButton,
  IonChip,
  IonIcon,
} from '@ionic/vue';
import {
  checkmarkOutline,
  closeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  warningOutline,
  alertOutline,
  playOutline,
  eyeOutline,
  speedometerOutline,
  codeSlashOutline,
  refreshOutline,
  downloadOutline,
  analyticsOutline,
} from 'ionicons/icons';

import { useValidationStore } from '@/stores/validationStore';
import { useFormValidation } from '@/composables/useValidation';
import { ValidationRules } from '@/composables/useValidation';
import { ValidationHelpers } from '@/utils/validationHelpers';
import ValidationMessage from '@/components/common/ValidationMessage.vue';

// =====================================
// SETUP
// =====================================

const validationStore = useValidationStore();
const validation = useFormValidation();

// =====================================
// STATE
// =====================================

const showDetails = ref(false);
const showAnalytics = ref(false);

const config = reactive({
  strictMode: false,
  sanitizeInputs: true,
  validateOnChange: true,
});

const formData = reactive({
  sampleText: '',
  email: '',
  regexPattern: '',
});

const regexTestString = ref('');
const regexTestResult = ref<boolean | null>(null);

const piiTestText = ref('');
const piiMatches = ref<Array<{ type: string; match: string; start: number; end: number }>>([]);

const securityTests = ref([
  {
    name: 'XSS Test',
    input: '<script>alert("XSS")</script>',
    result: null as boolean | null,
    message: '',
    context: {},
  },
  {
    name: 'SQL Injection',
    input: "'; DROP TABLE users; --",
    result: null as boolean | null,
    message: '',
    context: {},
  },
  {
    name: 'Path Traversal',
    input: '../../../etc/passwd',
    result: null as boolean | null,
    message: '',
    context: {},
  },
]);

const lastSecurityTest = ref<any>(null);

// =====================================
// COMPUTED
// =====================================

const validationSummary = computed(() => validationStore.validationSummary);
const validationAnalytics = computed(() => validationStore.getAnalytics());

// =====================================
// SETUP VALIDATION RULES
// =====================================

onMounted(() => {
  // Sample text validation
  validation.addRule('sampleText', ValidationRules.required('Sample text is required'));
  validation.addRule('sampleText', ValidationRules.minLength(10, 'Text must be at least 10 characters'));
  validation.addRule('sampleText', ValidationRules.maxLength(500, 'Text must not exceed 500 characters'));
  validation.addRule('sampleText', ValidationRules.security('Potentially unsafe content detected'));
  validation.addRule('sampleText', ValidationRules.sanitize());
  
  // Email validation
  validation.addRule('email', ValidationRules.required('Email is required'));
  validation.addRule('email', ValidationRules.email('Please enter a valid email address'));
  validation.addRule('email', ValidationRules.security());
  
  // Regex pattern validation
  validation.addRule('regexPattern', ValidationRules.required('Pattern is required'));
  validation.addRule('regexPattern', ValidationRules.regexPattern('Invalid regular expression'));
  validation.addRule('regexPattern', ValidationRules.maxLength(1000, 'Pattern is too complex'));
});

// =====================================
// METHODS
// =====================================

function getFieldStatus(field: string) {
  return validationStore.getFieldStatus(field);
}

async function validateField(field: string) {
  const value = formData[field as keyof typeof formData];
  const result = await validation.validate(field, value);
  validationStore.addValidationResult(field, result, 'ValidationDemo');
}

function updateValidationConfig() {
  validationStore.updateConfig(config);
}

// Input handlers
async function handleTextInput() {
  if (config.validateOnChange) {
    await validateField('sampleText');
  }
}

async function handleTextBlur() {
  await validateField('sampleText');
}

async function handleEmailInput() {
  if (config.validateOnChange) {
    await validateField('email');
  }
}

async function handleEmailBlur() {
  await validateField('email');
}

async function handleRegexInput() {
  if (config.validateOnChange) {
    await validateField('regexPattern');
  }
  testRegexPattern();
}

async function handleRegexBlur() {
  await validateField('regexPattern');
}

function testRegexPattern() {
  if (!formData.regexPattern || !regexTestString.value) {
    regexTestResult.value = null;
    return;
  }
  
  try {
    const regex = new RegExp(formData.regexPattern);
    regexTestResult.value = regex.test(regexTestString.value);
  } catch {
    regexTestResult.value = null;
  }
}

function runSecurityTest(test: any) {
  const hasXSS = ValidationHelpers.containsXSS(test.input);
  const hasSQL = ValidationHelpers.containsSQLInjection(test.input);
  const hasPath = ValidationHelpers.containsPathTraversal(test.input);
  
  test.result = hasXSS || hasSQL || hasPath;
  
  if (test.result) {
    test.message = `Security violation detected in ${test.name.toLowerCase()}`;
    test.context = {
      input: test.input,
      xss: hasXSS,
      sql: hasSQL,
      pathTraversal: hasPath,
    };
  } else {
    test.message = `No security issues detected in ${test.name.toLowerCase()}`;
    test.context = { input: test.input };
  }
  
  lastSecurityTest.value = test;
}

function detectPII() {
  if (!piiTestText.value) {
    piiMatches.value = [];
    return;
  }
  
  piiMatches.value = ValidationHelpers.extractPIIMatches(piiTestText.value);
}

function clearAllValidation() {
  validationStore.clearAll();
  formData.sampleText = '';
  formData.email = '';
  formData.regexPattern = '';
  regexTestString.value = '';
  regexTestResult.value = null;
  piiTestText.value = '';
  piiMatches.value = [];
  securityTests.value.forEach(test => {
    test.result = null;
    test.message = '';
    test.context = {};
  });
  lastSecurityTest.value = null;
}

function exportValidationState() {
  const state = validationStore.exportState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'validation-state.json';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.validation-demo {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.demo-section {
  margin: 24px 0;
  padding: 16px 0;
  border-bottom: 1px solid #e2e8f0;
}

.demo-section:last-child {
  border-bottom: none;
}

.demo-section h3 {
  margin: 0 0 16px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.security-tests {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.security-result {
  margin-top: 12px;
}

.regex-test {
  margin-top: 16px;
  padding: 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.regex-result {
  margin-top: 8px;
}

.pii-results {
  margin-top: 16px;
  padding: 16px;
  background-color: #fffbeb;
  border-radius: 8px;
  border: 1px solid #fed7aa;
}

.pii-results h4 {
  margin: 0 0 12px 0;
  color: #92400e;
  font-size: 14px;
  font-weight: 600;
}

.pii-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.validation-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.stat ion-icon {
  font-size: 20px;
}

.stat span {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-status {
  display: flex;
  justify-content: center;
}

.status-chip {
  font-size: 16px;
  font-weight: 600;
}

.debug-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.analytics-panel {
  margin-top: 16px;
}

.analytics-data {
  background-color: #1f2937;
  color: #e5e7eb;
  padding: 16px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .demo-section h3 {
    color: #f1f5f9;
  }
  
  .regex-test {
    background-color: #1e293b;
    border-color: #475569;
  }
  
  .pii-results {
    background-color: #1e293b;
    border-color: #d97706;
  }
  
  .pii-results h4 {
    color: #fbbf24;
  }
  
  .stat {
    background-color: #1e293b;
    border-color: #475569;
  }
  
  .stat span {
    color: #e5e7eb;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .validation-demo {
    padding: 8px;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .summary-stats {
    grid-template-columns: 1fr;
  }
  
  .security-tests {
    flex-direction: column;
  }
  
  .debug-controls {
    flex-direction: column;
  }
}
</style>
