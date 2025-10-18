<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleClose"
    :can-dismiss="!isLoading"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ isEditMode ? 'Edit PII Pattern' : 'Add New PII Pattern' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            fill="clear" 
            @click="handleClose"
            :disabled="isLoading"
          >
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="handleSubmit">
        <ion-grid>
          <ion-row>
            <!-- Pattern Name -->
            <ion-col size="12" size-md="6">
              <ion-item 
                :class="{ 'ion-invalid': validationErrors.name }"
                fill="outline"
              >
                <ion-label position="stacked">
                  Pattern Name *
                  <ion-note v-if="validationErrors.name" color="danger">
                    {{ validationErrors.name }}
                  </ion-note>
                </ion-label>
                <ion-input
                  v-model="formData.name"
                  placeholder="e.g., US Social Security Number"
                  @ionInput="validateName"
                  @ionBlur="validateName"
                  :disabled="isLoading"
                />
              </ion-item>
            </ion-col>

            <!-- Data Type -->
            <ion-col size="12" size-md="6">
              <ion-item fill="outline">
                <ion-label position="stacked">Data Type *</ion-label>
                <ion-select
                  v-model="formData.dataType"
                  placeholder="Select data type"
                  interface="popover"
                  :disabled="isLoading"
                  @ionChange="updateSampleText"
                >
                  <ion-select-option value="email">Email</ion-select-option>
                  <ion-select-option value="phone">Phone Number</ion-select-option>
                  <ion-select-option value="ssn">Social Security Number</ion-select-option>
                  <ion-select-option value="credit_card">Credit Card</ion-select-option>
                  <ion-select-option value="address">Address</ion-select-option>
                  <ion-select-option value="name">Personal Name</ion-select-option>
                  <ion-select-option value="date_of_birth">Date of Birth</ion-select-option>
                  <ion-select-option value="custom">Custom</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>

            <!-- Priority -->
            <ion-col size="12" size-md="6">
              <ion-item fill="outline">
                <ion-label position="stacked">Priority</ion-label>
                <ion-select
                  v-model="formData.priority"
                  placeholder="Select priority"
                  interface="popover"
                  :disabled="isLoading"
                >
                  <ion-select-option value="high">High</ion-select-option>
                  <ion-select-option value="medium">Medium</ion-select-option>
                  <ion-select-option value="low">Low</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>

            <!-- Category -->
            <ion-col size="12" size-md="6">
              <ion-item fill="outline">
                <ion-label position="stacked">Category</ion-label>
                <ion-input
                  v-model="formData.category"
                  placeholder="e.g., Financial, Personal, Medical"
                  :disabled="isLoading"
                />
              </ion-item>
            </ion-col>

            <!-- Description -->
            <ion-col size="12">
              <ion-item fill="outline">
                <ion-label position="stacked">Description</ion-label>
                <ion-textarea
                  v-model="formData.description"
                  placeholder="Describe what this pattern detects and when to use it"
                  :rows="3"
                  :disabled="isLoading"
                />
              </ion-item>
            </ion-col>

            <!-- Regex Pattern -->
            <ion-col size="12">
              <ion-item 
                :class="{ 
                  'ion-invalid': validationErrors.regex,
                  'ion-valid': isRegexValid && formData.regex
                }"
                fill="outline"
              >
                <ion-label position="stacked">
                  Regular Expression Pattern *
                  <ion-note v-if="validationErrors.regex" color="danger">
                    {{ validationErrors.regex }}
                  </ion-note>
                  <ion-note v-else-if="isRegexValid && formData.regex" color="success">
                    Valid regex pattern
                  </ion-note>
                </ion-label>
                <ion-textarea
                  v-model="formData.regex"
                  placeholder="e.g., \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
                  :rows="3"
                  @ionInput="validateRegex"
                  @ionBlur="validateRegex"
                  :disabled="isLoading"
                  class="regex-input"
                />
              </ion-item>
            </ion-col>

            <!-- Live Preview Section -->
            <ion-col size="12" v-if="formData.regex">
              <div class="preview-section">
                <h3>Live Preview</h3>
                
                <!-- Sample Text Input -->
                <ion-item fill="outline">
                  <ion-label position="stacked">Sample Text for Testing</ion-label>
                  <ion-textarea
                    v-model="sampleText"
                    :placeholder="getSampleTextPlaceholder()"
                    :rows="4"
                    @ionInput="updatePreview"
                    :disabled="isLoading"
                  />
                </ion-item>

                <!-- Preview Results -->
                <div class="preview-results" v-if="sampleText && isRegexValid">
                  <ion-label>
                    <strong>Matches Found:</strong>
                    <ion-chip 
                      :color="previewMatches.length > 0 ? 'success' : 'warning'"
                      size="small"
                    >
                      {{ previewMatches.length }}
                    </ion-chip>
                  </ion-label>
                  
                  <div class="highlighted-text">{{ sampleText }}</div>
                  
                  <div v-if="previewMatches.length > 0" class="matches-list">
                    <ion-label><strong>Extracted Matches:</strong></ion-label>
                    <ion-chip 
                      v-for="(match, index) in previewMatches" 
                      :key="index"
                      color="primary"
                      outline
                    >
                      {{ match }}
                    </ion-chip>
                  </div>
                </div>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </form>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button 
            fill="clear" 
            @click="handleClose"
            :disabled="isLoading"
          >
            Cancel
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button 
            @click="handleSubmit"
            :disabled="!canSubmit || isLoading"
            fill="solid"
            color="primary"
          >
            <ion-spinner v-if="isLoading" name="crescent" size="small"></ion-spinner>
            <span v-else>{{ isEditMode ? 'Update Pattern' : 'Create Pattern' }}</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
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
  IonFooter,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonChip,
  IonSpinner,
  toastController
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { usePrivacyStore } from '@/stores/privacyStore';
import type { PIIPattern, PIIPatternCreate, PIIPatternUpdate } from '@/types/pii';

// Props
interface Props {
  isOpen: boolean;
  pattern?: PIIPattern | null;
}

const props = withDefaults(defineProps<Props>(), {
  pattern: null
});

// Emits
const emit = defineEmits<{
  close: [];
  saved: [pattern: PIIPattern];
}>();

// Store
const piiStore = usePrivacyStore();

// Reactive state
const isLoading = ref(false);
const validationErrors = ref<Record<string, string>>({});
const isRegexValid = ref(false);
const sampleText = ref('');
const previewMatches = ref<string[]>([]);
const highlightedText = ref('');

// Form data
const formData = ref<PIIPatternCreate>({
  name: '',
  regex: '',
  dataType: 'email',
  description: '',
  priority: 'medium',
  category: '',
  enabled: true
});

// Computed
const isEditMode = computed(() => !!props.pattern);

const canSubmit = computed(() => {
  return formData.value.name.trim() &&
         formData.value.regex.trim() &&
         formData.value.dataType &&
         isRegexValid.value &&
         !validationErrors.value.name &&
         !validationErrors.value.regex &&
         !isLoading.value;
});

// Reactive sample text templates (test fixtures for pattern validation)
const sampleTexts = computed(() => {
  // These are legitimate test fixtures for regex validation, not mock business data
  // TODO: Could be enhanced with real examples from store when available
  return {
    email: 'Contact us at support@example.com or sales@company.org for assistance. You can also reach john.doe@gmail.com directly.',
    phone: 'Call us at (555) 123-4567 or +1-800-555-0123. International: +44 20 7946 0958. Mobile: 555.987.6543',
    ssn: 'SSN: 123-45-6789, 987-65-4321, or 555 44 3333. Some use format 123456789.',
    credit_card: 'Visa: 4532-1234-5678-9012, MasterCard: 5555 5555 5555 4444, Amex: 3782-822463-10005',
    address: '123 Main St, Apt 4B, New York, NY 10001. Also: 456 Oak Avenue, Suite 789, Los Angeles, CA 90210',
    name: 'John Smith, Mary Johnson-Williams, Dr. Sarah O\'Connor, and José García-López attended the meeting.',
    date_of_birth: 'Born on 03/15/1985, 12-25-1990, or January 1st, 1995. DOB: 1985-03-15, 25/12/1990',
    custom: 'Enter your own sample text here to test your custom regex pattern.'
  };
});

// Methods
const resetForm = () => {
  formData.value = {
    name: '',
    regex: '',
    dataType: 'email',
    description: '',
    priority: 'medium',
    category: '',
    enabled: true
  };
  validationErrors.value = {};
  isRegexValid.value = false;
  sampleText.value = '';
  previewMatches.value = [];
  highlightedText.value = '';
};

const loadPattern = (pattern: PIIPattern) => {
  formData.value = {
    name: pattern.name,
    regex: pattern.regex,
    dataType: pattern.dataType,
    description: pattern.description || '',
    priority: pattern.priority || 'medium',
    category: pattern.category || '',
    enabled: pattern.enabled
  };
  
  // Set sample text based on data type
  sampleText.value = sampleTexts.value[pattern.dataType] || sampleTexts.value.custom;
  
  // Validate regex and update preview
  nextTick(() => {
    validateRegex();
    updatePreview();
  });
};

const validateName = async () => {
  const name = formData.value.name.trim();
  
  if (!name) {
    validationErrors.value.name = 'Pattern name is required';
    return;
  }

  if (name.length < 3) {
    validationErrors.value.name = 'Pattern name must be at least 3 characters';
    return;
  }

  // Check uniqueness (skip if editing the same pattern)
  const existingPattern = piiStore.patterns.find(p => 
    p.name.toLowerCase() === name.toLowerCase() && 
    (!isEditMode.value || p.id !== props.pattern?.id)
  );
  
  if (existingPattern) {
    validationErrors.value.name = 'A pattern with this name already exists';
    return;
  }

  delete validationErrors.value.name;
};

const validateRegex = () => {
  const regex = formData.value.regex.trim();
  
  if (!regex) {
    validationErrors.value.regex = 'Regular expression is required';
    isRegexValid.value = false;
    return;
  }

  try {
    new RegExp(regex);
    delete validationErrors.value.regex;
    isRegexValid.value = true;
    updatePreview();
  } catch {
    validationErrors.value.regex = `Invalid regex`;
    isRegexValid.value = false;
    previewMatches.value = [];
    highlightedText.value = '';
  }
};

const getSampleTextPlaceholder = () => {
  return sampleTexts.value[formData.value.dataType] || sampleTexts.value.custom;
};

const updateSampleText = () => {
  if (!sampleText.value || sampleText.value === getSampleTextPlaceholder()) {
    sampleText.value = sampleTexts.value[formData.value.dataType] || sampleTexts.value.custom;
    updatePreview();
  }
};

const updatePreview = () => {
  if (!sampleText.value || !formData.value.regex || !isRegexValid.value) {
    previewMatches.value = [];
    highlightedText.value = '';
    return;
  }

  try {
    const regex = new RegExp(formData.value.regex, 'gi');
    const matches = Array.from(sampleText.value.matchAll(regex));
    
    previewMatches.value = matches.map(match => match[0]);
    
    // Create highlighted version
    if (matches.length > 0) {
      let highlighted = sampleText.value;
      const sortedMatches = matches.sort((a, b) => b.index! - a.index!);
      
      sortedMatches.forEach(match => {
        const start = match.index!;
        const end = start + match[0].length;
        highlighted = highlighted.slice(0, start) + 
                     `<mark class="pii-match">${match[0]}</mark>` + 
                     highlighted.slice(end);
      });
      
      highlightedText.value = highlighted;
    } else {
      highlightedText.value = sampleText.value;
    }
  } catch {
    previewMatches.value = [];
    highlightedText.value = sampleText.value;
  }
};

const presentToast = async (message: string, color: 'success' | 'danger' = 'success') => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color,
    position: 'bottom'
  });
  await toast.present();
};

const handleSubmit = async () => {
  // Validate all fields
  await validateName();
  validateRegex();

  if (!canSubmit.value) {
    return;
  }

  isLoading.value = true;

  try {
    let savedPattern: PIIPattern;

    if (isEditMode.value && props.pattern) {
      // Update existing pattern
      const updateData: PIIPatternUpdate = {
        ...formData.value,
        id: props.pattern.id
      };
      savedPattern = await piiStore.updatePattern(props.pattern.id, updateData);
      await presentToast('Pattern updated successfully!');
    } else {
      // Create new pattern
      savedPattern = await piiStore.createPattern(formData.value);
      await presentToast('Pattern created successfully!');
    }

    emit('saved', savedPattern);
    handleClose();
  } catch {
    console.error('Error saving pattern');
    await presentToast(
      `Failed to ${isEditMode.value ? 'update' : 'create'} pattern. Please try again.`,
      'danger'
    );
  } finally {
    isLoading.value = false;
  }
};

const handleClose = () => {
  if (!isLoading.value) {
    emit('close');
  }
};

// Watchers
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    if (props.pattern) {
      loadPattern(props.pattern);
    } else {
      resetForm();
      sampleText.value = sampleTexts.value.email;
    }
  }
});

watch(() => formData.value.dataType, () => {
  updateSampleText();
});
</script>

<style scoped>
.preview-section {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-color-light-tint);
}

.preview-section h3 {
  margin-top: 0;
  color: var(--ion-color-primary);
  font-size: 1.1rem;
}

.preview-results {
  margin-top: 1rem;
}

.highlighted-text {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.highlighted-text :deep(mark.pii-match) {
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: bold;
}

.matches-list {
  margin-top: 1rem;
}

.matches-list ion-chip {
  margin: 0.25rem 0.25rem 0.25rem 0;
}

.regex-input {
  font-family: monospace;
  font-size: 0.9rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .preview-section {
    padding: 0.75rem;
  }
  
  .highlighted-text {
    font-size: 0.8rem;
    padding: 0.75rem;
  }
}
</style>
