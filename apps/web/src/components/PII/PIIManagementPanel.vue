<template>
  <div class="pii-management-panel">
    <!-- Header -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="shieldCheckmarkOutline" />
          PII Management
        </ion-card-title>
        <ion-card-subtitle>
          Manage PII patterns and pseudonym dictionaries
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <!-- Auto-refresh toggle -->
        <ion-item>
          <ion-toggle 
            v-model="isAutoRefreshEnabled" 
            @ionChange="toggleAutoRefresh"
          >
            Auto-refresh data
          </ion-toggle>
        </ion-item>
        
        <!-- Last refresh time -->
        <ion-item v-if="lastRefreshTime">
          <ion-label>
            <p>Last updated: {{ formatTime(lastRefreshTime) }}</p>
          </ion-label>
        </ion-item>
      </ion-card-content>
    </ion-card>

    <!-- System Status -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>System Status</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-item>
                <ion-label>
                  <h3>PII Patterns</h3>
                  <p :class="getStatusColor(!piiPatternsStore.error)">
                    {{ piiPatternsStore.error ? 'Error' : 'Healthy' }}
                  </p>
                </ion-label>
                <ion-badge 
                  :color="piiPatternsStore.error ? 'danger' : 'success'"
                  slot="end"
                >
                  {{ piiPatternsStore.patterns.length }}
                </ion-badge>
              </ion-item>
            </ion-col>
            <ion-col size="6">
              <ion-item>
                <ion-label>
                  <h3>Pseudonym Dictionaries</h3>
                  <p :class="getStatusColor(!pseudonymStore.error)">
                    {{ pseudonymStore.error ? 'Error' : 'Healthy' }}
                  </p>
                </ion-label>
                <ion-badge 
                  :color="pseudonymStore.error ? 'danger' : 'success'"
                  slot="end"
                >
                  {{ pseudonymStore.dictionaries.length }}
                </ion-badge>
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- PII Detection Test -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="searchOutline" />
          PII Detection Test
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-textarea
            v-model="testInput"
            placeholder="Enter text to test for PII detection..."
            :rows="4"
            label="Test Input"
            label-placement="stacked"
          />
        </ion-item>
        
        <ion-button 
          expand="block" 
          @click="runPIITest"
          :disabled="!testInput.trim() || isTestingPII"
        >
          <ion-spinner v-if="isTestingPII" name="crescent" />
          {{ isTestingPII ? 'Testing...' : 'Test PII Detection' }}
        </ion-button>
        
        <!-- Test Results -->
        <div v-if="testResults" class="test-results">
          <ion-item>
            <ion-label>
              <h3>Detection Results</h3>
              <p>
                <ion-badge 
                  :color="testResults.hasPII ? 'warning' : 'success'"
                >
                  {{ testResults.hasPII ? `${testResults.matches.length} PII items found` : 'No PII detected' }}
                </ion-badge>
              </p>
            </ion-label>
          </ion-item>
          
          <!-- Detected PII Items -->
          <div v-if="testResults.hasPII">
            <ion-list>
              <ion-item 
                v-for="(match, index) in testResults.matches" 
                :key="index"
              >
                <ion-label>
                  <h3>{{ match.value }}</h3>
                  <p>Type: {{ match.dataType }}</p>
                  <p>Pattern: {{ match.patternName }}</p>
                </ion-label>
                <ion-badge :color="getDataTypeColor(match.dataType)" slot="end">
                  {{ match.confidence }}% confidence
                </ion-badge>
              </ion-item>
            </ion-list>
            
            <!-- Sanitized text -->
            <ion-item>
              <ion-label>
                <h3>Sanitized Text:</h3>
                <p class="sanitized-text">{{ testResults.sanitizedText }}</p>
              </ion-label>
            </ion-item>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Pseudonymization Test -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="swapHorizontalOutline" />
          Pseudonymization Test
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-textarea
            v-model="pseudonymInput"
            placeholder="Enter text to pseudonymize..."
            :rows="4"
            label="Text to Pseudonymize"
            label-placement="stacked"
          />
        </ion-item>
        
        <ion-item>
          <ion-toggle v-model="preserveFormat">
            Preserve original format
          </ion-toggle>
        </ion-item>
        
        <ion-button 
          expand="block" 
          @click="runPseudonymTest"
          :disabled="!pseudonymInput.trim() || isPseudonymizing"
        >
          <ion-spinner v-if="isPseudonymizing" name="crescent" />
          {{ isPseudonymizing ? 'Processing...' : 'Generate Pseudonyms' }}
        </ion-button>
        
        <!-- Pseudonym Results -->
        <div v-if="pseudonymResults" class="pseudonym-results">
          <ion-item>
            <ion-label>
              <h3>Pseudonymization Results</h3>
              <p>
                <ion-badge :color="pseudonymResults.hasChanges ? 'primary' : 'medium'">
                  {{ pseudonymResults.hasChanges ? `${pseudonymResults.replacements.length} replacements made` : 'No changes needed' }}
                </ion-badge>
              </p>
            </ion-label>
          </ion-item>
          
          <!-- Replacements -->
          <div v-if="pseudonymResults.hasChanges">
            <ion-list>
              <ion-item 
                v-for="(replacement, index) in pseudonymResults.replacements" 
                :key="index"
              >
                <ion-label>
                  <h3>{{ replacement.original }} → {{ replacement.pseudonym }}</h3>
                  <p>Type: {{ replacement.type }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            
            <!-- Final pseudonymized text -->
            <ion-item>
              <ion-label>
                <h3>Pseudonymized Text:</h3>
                <p class="pseudonymized-text">{{ pseudonymResults.pseudonymizedText }}</p>
              </ion-label>
            </ion-item>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Statistics -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="statsChartOutline" />
          Statistics
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h2>{{ piiPatternsStore.patterns.length }}</h2>
                  <p>Total Patterns</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h2>{{ piiPatternsStore.enabledPatterns.length }}</h2>
                  <p>Enabled Patterns</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h2>{{ pseudonymStore.dictionaries.length }}</h2>
                  <p>Dictionaries</p>
                </ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-item>
                <ion-label class="ion-text-center">
                  <h2>{{ pseudonymStore.totalWords }}</h2>
                  <p>Total Words</p>
                </ion-label>
              </ion-item>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Error Display -->
    <ion-card v-if="hasError" color="danger">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="alertCircleOutline" />
          Error
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p>{{ firstError }}</p>
        <ion-button fill="outline" @click="clearAllErrors">
          Clear Errors
        </ion-button>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonItem,
  IonLabel,
  IonButton,
  IonToggle,
  IonTextarea,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonList
} from '@ionic/vue';
import {
  shieldCheckmarkOutline,
  searchOutline,
  swapHorizontalOutline,
  statsChartOutline,
  alertCircleOutline
} from 'ionicons/icons';
import { usePrivacyStore } from '@/stores/privacyStore';
import { privacyService } from '@/services/privacyService';
import { useStoreAutoRefresh } from '@/composables/useStoreIntegration';
// import RecentLLMCalls from '@/components/PII/RecentLLMCalls.vue';

// Store integration - unified privacy store
const privacyStore = usePrivacyStore();

// Computed properties - aliased for backward compatibility
const piiPatternsStore = computed(() => ({
  isLoading: privacyStore.patternsLoading,
  error: privacyStore.patternsError,
  patterns: privacyStore.patterns,
  enabledPatterns: privacyStore.enabledPatterns,
  fetchPatterns: () => privacyService.loadPatterns(),
  testPIIDetection: privacyService.testPIIDetection,
  clearError: () => privacyStore.setPatternsError(null),
}));

const pseudonymStore = computed(() => ({
  isLoading: privacyStore.dictionariesLoading,
  error: privacyStore.dictionariesError,
  dictionaries: privacyStore.dictionaries,
  totalWords: privacyStore.dictionaries.reduce((sum, d) => sum + d.words.length, 0),
  fetchDictionaries: () => privacyService.loadDictionaries(),
  clearError: () => privacyStore.setDictionariesError(null),
}));

// Computed properties for unified interface
// const isLoading = computed(() => privacyStore.patternsLoading || privacyStore.dictionariesLoading);
const hasError = computed(() => !!privacyStore.patternsError || !!privacyStore.dictionariesError);
const firstError = computed(() => privacyStore.patternsError || privacyStore.dictionariesError);

// Methods
const refreshAll = async () => {
  await Promise.all([
    privacyService.loadPatterns(true),
    privacyService.loadDictionaries(true)
  ]);
};

const clearAllErrors = () => {
  privacyStore.setPatternsError(null);
  privacyStore.setDictionariesError(null);
};

// PII Tools functionality
const detectPII = async (text: string) => {
  return await privacyService.testPIIDetection({ text });
};

const pseudonymizeText = async (text: string) => {
  // This would need to be implemented based on your pseudonymization logic
  return text; // Placeholder
};

// Auto-refresh setup
const { 
  isAutoRefreshEnabled, 
  toggleAutoRefresh, 
  lastRefreshTime 
} = useStoreAutoRefresh([refreshAll], 30000);

// PII Testing
const testInput = ref('');
const isTestingPII = ref(false);
const testResults = ref<Record<string, unknown> | null>(null);

// Pseudonymization Testing
const pseudonymInput = ref('');
const preserveFormat = ref(true);
const isPseudonymizing = ref(false);
const pseudonymResults = ref<Record<string, unknown> | null>(null);

// Methods
const runPIITest = async () => {
  if (!testInput.value.trim()) return;
  
  isTestingPII.value = true;
  testResults.value = null;
  
  try {
    testResults.value = await detectPII(testInput.value);
  } catch (error) {
    console.error('PII test error:', error);
  } finally {
    isTestingPII.value = false;
  }
};

const runPseudonymTest = async () => {
  if (!pseudonymInput.value.trim()) return;
  
  isPseudonymizing.value = true;
  pseudonymResults.value = null;
  
  try {
    pseudonymResults.value = await pseudonymizeText(pseudonymInput.value, preserveFormat.value);
  } catch (error) {
    console.error('Pseudonym test error:', error);
  } finally {
    isPseudonymizing.value = false;
  }
};

const getStatusColor = (isHealthy: boolean) => {
  return isHealthy ? 'color: var(--ion-color-success)' : 'color: var(--ion-color-danger)';
};

const getDataTypeColor = (dataType: string) => {
  const colors: Record<string, string> = {
    'email': 'primary',
    'phone': 'secondary',
    'name': 'tertiary',
    'address': 'warning',
    'ssn': 'danger',
    'credit_card': 'danger',
    'ip_address': 'medium',
    'username': 'dark'
  };
  return colors[dataType] || 'medium';
};

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

// Initialize on mount
onMounted(async () => {
  await refreshAll();
});
</script>

<style scoped>
.pii-management-panel {
  padding: 1rem;
}

.test-results,
.pseudonym-results {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light-shade);
}

.sanitized-text,
.pseudonymized-text {
  font-family: monospace;
  background-color: var(--ion-color-light);
  padding: 0.5rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}

ion-badge {
  margin-left: 0.5rem;
}

.ion-text-center h2 {
  font-size: 2rem;
  font-weight: bold;
  margin: 0;
}

.ion-text-center p {
  margin: 0;
  color: var(--ion-color-medium);
}
</style>
