<template>
  <div class="pseudonym-dictionary-manager">
    <!-- Header Section -->
    <div class="manager-header">
      <h2>Pseudonym Dictionary Manager</h2>
      <p>Manage replacement words used for PII pseudonymization</p>
    </div>

    <!-- Controls Section -->
    <ion-card>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <!-- Search -->
            <ion-col size="12" size-md="3">
              <ion-searchbar
                v-model="searchQuery"
                placeholder="Search dictionaries..."
                debounce="300"
                @ionInput="handleSearch"
                show-clear-button="focus"
              />
            </ion-col>
            
            <!-- Category Filter -->
            <ion-col size="6" size-md="2">
              <ion-select
                v-model="filters.category"
                placeholder="Category"
                interface="popover"
                @ionChange="applyFilters"
              >
                <ion-select-option value="all">All Categories</ion-select-option>
                <ion-select-option 
                  v-for="category in availableCategories" 
                  :key="category" 
                  :value="category"
                >
                  {{ category }}
                </ion-select-option>
              </ion-select>
            </ion-col>
            
            <!-- Data Type Filter -->
            <ion-col size="6" size-md="2">
              <ion-select
                v-model="filters.dataType"
                placeholder="Data Type"
                interface="popover"
                @ionChange="applyFilters"
              >
                <ion-select-option value="all">All Types</ion-select-option>
                <ion-select-option value="email">Email</ion-select-option>
                <ion-select-option value="phone">Phone</ion-select-option>
                <ion-select-option value="name">Name</ion-select-option>
                <ion-select-option value="address">Address</ion-select-option>
                <ion-select-option value="custom">Custom</ion-select-option>
              </ion-select>
            </ion-col>
            
            <!-- Status Filter -->
            <ion-col size="6" size-md="2">
              <ion-select
                v-model="filters.isActive"
                placeholder="Status"
                interface="popover"
                @ionChange="applyFilters"
              >
                <ion-select-option value="all">All Status</ion-select-option>
                <ion-select-option :value="true">Active</ion-select-option>
                <ion-select-option :value="false">Inactive</ion-select-option>
              </ion-select>
            </ion-col>
            
            <!-- Action Buttons -->
            <ion-col size="12" size-md="3">
              <div class="action-buttons">
                <ion-button
                  fill="solid"
                  size="small"
                  color="primary"
                  @click="openCreateModal"
                  :disabled="isLoading"
                >
                  <ion-icon :icon="addOutline" slot="start" />
                  Add Dictionary
                </ion-button>
                
                <ion-button
                  fill="outline"
                  size="small"
                  @click="openImportModal"
                  :disabled="isLoading"
                >
                  <ion-icon :icon="cloudUploadOutline" slot="start" />
                  Import
                </ion-button>
                
                <ion-button
                  fill="outline"
                  size="small"
                  @click="exportDictionaries"
                  :disabled="isLoading || filteredDictionaries.length === 0"
                >
                  <ion-icon :icon="cloudDownloadOutline" slot="start" />
                  Export
                </ion-button>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>

    <!-- Loading State -->
    <div v-if="store.isLoading" class="loading-container">
      <ion-spinner />
      <p>Loading dictionaries...</p>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="store.error" color="danger">
      <ion-card-content>
        <h3>
          <ion-icon :icon="alertCircleOutline" />
          Error Loading Dictionaries
        </h3>
        <p>{{ store.error }}</p>
        <ion-button fill="outline" @click="store.fetchDictionaries()">
          <ion-icon :icon="refreshOutline" slot="start" />
          Retry
        </ion-button>
      </ion-card-content>
    </ion-card>

    <!-- Empty State -->
    <div v-else-if="filteredDictionaries.length === 0" class="empty-state">
      <ion-icon :icon="libraryOutline" size="large" color="medium" />
      <h3>No Dictionaries Found</h3>
      <p v-if="hasActiveFilters">Try adjusting your filters or search terms.</p>
      <p v-else>Create your first pseudonym dictionary to get started.</p>
      <ion-button 
        fill="solid" 
        color="primary" 
        @click="openCreateModal"
        :disabled="isLoading"
      >
        <ion-icon :icon="addOutline" slot="start" />
        Create First Dictionary
      </ion-button>
    </div>

    <!-- Dictionaries Grid -->
    <ion-grid v-else>
      <ion-row>
        <ion-col
          v-for="dictionary in paginatedDictionaries"
          :key="dictionary.id"
          size="12"
          size-md="6"
          size-lg="4"
        >
          <ion-card class="dictionary-card" :class="{ 'inactive': !dictionary.isActive }">
            <ion-card-header>
              <div class="card-header-content">
                <div class="dictionary-info">
                  <ion-card-title>{{ dictionary.category }}</ion-card-title>
                  <ion-card-subtitle>
                    <ion-chip 
                      :color="getDataTypeColor(dictionary.dataType)" 
                      size="small"
                      outline
                    >
                      {{ dictionary.dataType }}
                    </ion-chip>
                    <ion-chip 
                      :color="dictionary.isActive ? 'success' : 'medium'" 
                      size="small"
                    >
                      {{ dictionary.isActive ? 'Active' : 'Inactive' }}
                    </ion-chip>
                  </ion-card-subtitle>
                </div>
                
                <div class="card-actions">
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="toggleDictionaryStatus(dictionary)"
                    :disabled="isLoading"
                  >
                    <ion-icon 
                      :icon="dictionary.isActive ? pauseOutline : playOutline" 
                      :color="dictionary.isActive ? 'warning' : 'success'"
                    />
                  </ion-button>
                  
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="openEditModal(dictionary)"
                    :disabled="isLoading"
                  >
                    <ion-icon :icon="createOutline" color="primary" />
                  </ion-button>
                  
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="deleteDictionary(dictionary)"
                    :disabled="isLoading"
                  >
                    <ion-icon :icon="trashOutline" color="danger" />
                  </ion-button>
                </div>
              </div>
            </ion-card-header>
            
            <ion-card-content>
              <div class="dictionary-stats">
                <div class="stat-item">
                  <ion-icon :icon="listOutline" color="primary" />
                  <span>{{ dictionary.words.length }} words</span>
                </div>
                
                <div class="stat-item" v-if="dictionary.frequencyWeights">
                  <ion-icon :icon="barChartOutline" color="secondary" />
                  <span>{{ Object.keys(dictionary.frequencyWeights).length }} weighted</span>
                </div>
                
                <div class="stat-item" v-if="dictionary.createdAt">
                  <ion-icon :icon="timeOutline" color="medium" />
                  <span>{{ formatDate(dictionary.createdAt) }}</span>
                </div>
              </div>
              
              <p v-if="dictionary.description" class="dictionary-description">
                {{ dictionary.description }}
              </p>
              
              <!-- Word Preview -->
              <div class="word-preview">
                <h4>Sample Words:</h4>
                <div class="word-chips">
                  <ion-chip 
                    v-for="word in dictionary.words.slice(0, 5)" 
                    :key="word"
                    size="small"
                    outline
                  >
                    {{ word }}
                  </ion-chip>
                  <ion-chip 
                    v-if="dictionary.words.length > 5"
                    size="small"
                    color="medium"
                  >
                    +{{ dictionary.words.length - 5 }} more
                  </ion-chip>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination-container">
      <ion-button
        fill="outline"
        size="small"
        @click="currentPage--"
        :disabled="currentPage === 1"
      >
        <ion-icon :icon="chevronBackOutline" />
        Previous
      </ion-button>
      
      <span class="page-info">
        Page {{ currentPage }} of {{ totalPages }} ({{ filteredDictionaries.length }} total)
      </span>
      
      <ion-button
        fill="outline"
        size="small"
        @click="currentPage++"
        :disabled="currentPage === totalPages"
      >
        Next
        <ion-icon :icon="chevronForwardOutline" />
      </ion-button>
    </div>

    <!-- Dictionary Editor Modal -->
    <ion-modal :is-open="isEditorOpen" @didDismiss="closeEditorModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ editingDictionary ? 'Edit Dictionary' : 'Create Dictionary' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeEditorModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <form @submit.prevent="saveDictionary">
          <ion-item>
            <ion-label position="stacked">Category *</ion-label>
            <ion-input
              v-model="editorForm.category"
              placeholder="e.g., First Names, Companies, Cities"
              required
              :disabled="isLoading"
            />
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">Data Type *</ion-label>
            <ion-select
              v-model="editorForm.dataType"
              interface="popover"
              :disabled="isLoading"
            >
              <ion-select-option value="name">Name</ion-select-option>
              <ion-select-option value="email">Email</ion-select-option>
              <ion-select-option value="phone">Phone</ion-select-option>
              <ion-select-option value="address">Address</ion-select-option>
              <ion-select-option value="custom">Custom</ion-select-option>
            </ion-select>
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea
              v-model="editorForm.description"
              placeholder="Describe this dictionary and its intended use"
              :rows="3"
              :disabled="isLoading"
            />
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">
              Words * (one per line)
              <ion-note>{{ editorForm.words.split('\n').filter(w => w.trim()).length }} words</ion-note>
            </ion-label>
            <ion-textarea
              v-model="editorForm.words"
              placeholder="John&#10;Jane&#10;Michael&#10;Sarah&#10;David"
              :rows="8"
              :disabled="isLoading"
              class="words-textarea"
            />
          </ion-item>
          
          <ion-item>
            <ion-checkbox v-model="editorForm.isActive" :disabled="isLoading" />
            <ion-label class="ion-margin-start">Active (available for pseudonymization)</ion-label>
          </ion-item>
        </form>
      </ion-content>
      
      <ion-footer>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button fill="clear" @click="closeEditorModal" :disabled="isLoading">
              Cancel
            </ion-button>
          </ion-buttons>
          <ion-buttons slot="end">
            <ion-button 
              @click="saveDictionary" 
              fill="solid" 
              color="primary"
              :disabled="!canSave || isLoading"
            >
              <ion-spinner v-if="isLoading" name="crescent" size="small" />
              <span v-else>{{ editingDictionary ? 'Update' : 'Create' }}</span>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    </ion-modal>

    <!-- Import Modal -->
    <ion-modal :is-open="isImportOpen" @didDismiss="closeImportModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Import Dictionaries</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeImportModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <div class="import-options">
          <ion-segment v-model="importType" @ionChange="handleImportTypeChange">
            <ion-segment-button value="csv">
              <ion-label>CSV File</ion-label>
            </ion-segment-button>
            <ion-segment-button value="json">
              <ion-label>JSON File</ion-label>
            </ion-segment-button>
          </ion-segment>
          
          <!-- File Upload -->
          <div class="file-upload-section">
            <input
              ref="fileInputRef"
              type="file"
              :accept="importType === 'csv' ? '.csv' : '.json'"
              @change="handleFileSelect"
              style="display: none"
            />
            
            <ion-button
              fill="outline"
              expand="block"
              @click="fileInputRef?.click()"
              :disabled="isLoading"
            >
              <ion-icon :icon="documentOutline" slot="start" />
              Select {{ importType.toUpperCase() }} File
            </ion-button>
            
            <div v-if="selectedFile" class="selected-file">
              <ion-chip color="primary">
                <ion-icon :icon="documentTextOutline" />
                <ion-label>{{ selectedFile.name }}</ion-label>
                <ion-icon :icon="closeOutline" @click="selectedFile = null" />
              </ion-chip>
            </div>
          </div>
          
          <!-- Preview -->
          <div v-if="importPreview.length > 0" class="import-preview">
            <h3>Preview ({{ importPreview.length }} dictionaries)</h3>
            <ion-list>
              <ion-item v-for="(dict, index) in importPreview.slice(0, 5)" :key="index">
                <ion-label>
                  <h3>{{ dict.category }}</h3>
                  <p>{{ dict.dataType }} • {{ dict.words?.length || 0 }} words</p>
                </ion-label>
              </ion-item>
              <ion-item v-if="importPreview.length > 5">
                <ion-label>
                  <p>... and {{ importPreview.length - 5 }} more dictionaries</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </div>
          
          <!-- Validation Errors -->
          <ion-list v-if="importErrors.length > 0">
            <ion-list-header color="danger">
              <ion-label>Validation Errors</ion-label>
            </ion-list-header>
            <ion-item v-for="(error, index) in importErrors" :key="index" color="danger">
              <ion-icon :icon="alertCircleOutline" slot="start" />
              <ion-label>{{ error }}</ion-label>
            </ion-item>
          </ion-list>
        </div>
      </ion-content>
      
      <ion-footer>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button fill="clear" @click="closeImportModal" :disabled="isLoading">
              Cancel
            </ion-button>
          </ion-buttons>
          <ion-buttons slot="end">
            <ion-button 
              @click="performImport" 
              fill="solid" 
              color="primary"
              :disabled="!canImport || isLoading"
            >
              <ion-spinner v-if="isLoading" name="crescent" size="small" />
              <span v-else>Import {{ importPreview.length }} Dictionaries</span>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonGrid,
  IonRow,
  IonCol,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonSpinner,
  IonChip,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonFooter,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonCheckbox,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonListHeader,
  toastController,
  alertController
} from '@ionic/vue';
import {
  addOutline,
  cloudUploadOutline,
  cloudDownloadOutline,
  alertCircleOutline,
  refreshOutline,
  libraryOutline,
  pauseOutline,
  playOutline,
  createOutline,
  trashOutline,
  listOutline,
  barChartOutline,
  timeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  documentOutline,
  documentTextOutline
} from 'ionicons/icons';
import Papa from 'papaparse';

import { usePrivacyStore } from '@/stores/privacyStore';
import type { 
  PseudonymDictionaryEntry, 
  PseudonymDictionaryImportData,
  PIIDataType 
} from '@/types/pii';

// Store
const store = usePrivacyStore();

// Reactive state
const searchQuery = ref('');
const isLoading = ref(false);
const currentPage = ref(1);
const itemsPerPage = 12;

// Filter state
const filters = ref({
  category: 'all' as string | 'all',
  dataType: 'all' as PIIDataType | 'all',
  isActive: 'all' as boolean | 'all'
});

// Modal state
const isEditorOpen = ref(false);
const editingDictionary = ref<PseudonymDictionaryEntry | null>(null);
const editorForm = ref({
  category: '',
  dataType: 'name' as PIIDataType,
  description: '',
  words: '',
  isActive: true
});

// Import modal state
const isImportOpen = ref(false);
const importType = ref<'csv' | 'json'>('csv');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement>();
const importPreview = ref<PseudonymDictionaryImportData[]>([]);
const importErrors = ref<string[]>([]);

// Computed
const filteredDictionaries = computed(() => {
  let result = [...store.filteredAndSortedDictionaries];
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(dict => 
      dict.category.toLowerCase().includes(query) ||
      dict.description?.toLowerCase().includes(query) ||
      dict.words.some(word => word.toLowerCase().includes(query))
    );
  }
  
  return result;
});

const paginatedDictionaries = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredDictionaries.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredDictionaries.value.length / itemsPerPage);
});

const hasActiveFilters = computed(() => {
  return filters.value.category !== 'all' ||
         filters.value.dataType !== 'all' ||
         filters.value.isActive !== 'all' ||
         searchQuery.value.trim() !== '';
});

const availableCategories = computed(() => {
  const categories = new Set(store.dictionaries.map(d => d.category));
  return Array.from(categories).sort();
});

const canSave = computed(() => {
  return editorForm.value.category.trim() &&
         editorForm.value.dataType &&
         editorForm.value.words.trim() &&
         editorForm.value.words.split('\n').filter(w => w.trim()).length > 0;
});

const canImport = computed(() => {
  return importPreview.value.length > 0 && importErrors.value.length === 0;
});

// Methods
const handleSearch = () => {
  currentPage.value = 1;
};

const applyFilters = () => {
  store.updateFilters(filters.value);
  currentPage.value = 1;
};

const openCreateModal = () => {
  editingDictionary.value = null;
  editorForm.value = {
    category: '',
    dataType: 'name',
    description: '',
    words: '',
    isActive: true
  };
  isEditorOpen.value = true;
};

const openEditModal = (dictionary: PseudonymDictionaryEntry) => {
  editingDictionary.value = dictionary;
  editorForm.value = {
    category: dictionary.category,
    dataType: dictionary.dataType,
    description: dictionary.description || '',
    words: dictionary.words.join('\n'),
    isActive: dictionary.isActive
  };
  isEditorOpen.value = true;
};

const closeEditorModal = () => {
  isEditorOpen.value = false;
  editingDictionary.value = null;
};

const saveDictionary = async () => {
  if (!canSave.value) return;
  
  isLoading.value = true;
  
  try {
    const words = editorForm.value.words
      .split('\n')
      .map(w => w.trim())
      .filter(w => w);
    
    const dictionaryData = {
      category: editorForm.value.category.trim(),
      dataType: editorForm.value.dataType,
      description: editorForm.value.description.trim() || undefined,
      words,
      isActive: editorForm.value.isActive
    };
    
    if (editingDictionary.value) {
      await store.updateDictionary(editingDictionary.value.id!, dictionaryData);
      showToast('Dictionary updated successfully!', 'success');
    } else {
      await store.createDictionary(dictionaryData);
      showToast('Dictionary created successfully!', 'success');
    }
    
    closeEditorModal();
  } catch (error) {
    console.error('Error saving dictionary:', error);
    showToast('Failed to save dictionary. Please try again.', 'danger');
  } finally {
    isLoading.value = false;
  }
};

const toggleDictionaryStatus = async (dictionary: PseudonymDictionaryEntry) => {
  try {
    await store.updateDictionary(dictionary.id!, { isActive: !dictionary.isActive });
    showToast(
      `Dictionary ${dictionary.isActive ? 'deactivated' : 'activated'} successfully!`,
      'success'
    );
  } catch (error) {
    console.error('Error toggling dictionary status:', error);
    showToast('Failed to update dictionary status.', 'danger');
  }
};

const deleteDictionary = async (dictionary: PseudonymDictionaryEntry) => {
  const alert = await alertController.create({
    header: 'Confirm Deletion',
    message: `Are you sure you want to delete the "${dictionary.category}" dictionary? This action cannot be undone.`,
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          try {
            await store.deleteDictionary(dictionary.id!);
            showToast('Dictionary deleted successfully!', 'success');
          } catch (error) {
            console.error('Error deleting dictionary:', error);
            showToast('Failed to delete dictionary.', 'danger');
          }
        }
      }
    ]
  });
  
  await alert.present();
};

const openImportModal = () => {
  isImportOpen.value = true;
  selectedFile.value = null;
  importPreview.value = [];
  importErrors.value = [];
};

const closeImportModal = () => {
  isImportOpen.value = false;
  selectedFile.value = null;
  importPreview.value = [];
  importErrors.value = [];
};

const handleImportTypeChange = () => {
  selectedFile.value = null;
  importPreview.value = [];
  importErrors.value = [];
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  selectedFile.value = file;
  importPreview.value = [];
  importErrors.value = [];
  
  try {
    if (importType.value === 'csv') {
      await parseCSVFile(file);
    } else {
      await parseJSONFile(file);
    }
  } catch (error) {
    console.error('Error parsing file:', error);
    importErrors.value = ['Failed to parse file. Please check the format and try again.'];
  }
};

const parseCSVFile = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as Record<string, unknown>[];
          const dictionaries: PseudonymDictionaryImportData[] = [];
          
          data.forEach((row) => {
            const dict: PseudonymDictionaryImportData = {
              category: row.category || '',
              dataType: row.dataType || row.data_type || 'custom',
              words: row.words ? row.words.split('|').map((w: string) => w.trim()).filter((w: string) => w) : [],
              description: row.description || ''
            };
            
            if (dict.category && dict.words.length > 0) {
              dictionaries.push(dict);
            }
          });
          
          importPreview.value = dictionaries;
          validateImportData();
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      error: reject
    });
  });
};

const parseJSONFile = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          importPreview.value = data;
        } else if (data.dictionaries && Array.isArray(data.dictionaries)) {
          importPreview.value = data.dictionaries;
        } else {
          throw new Error('Invalid JSON format');
        }
        
        validateImportData();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const validateImportData = () => {
  importErrors.value = [];
  
  importPreview.value.forEach((dict, index) => {
    if (!dict.category) {
      importErrors.value.push(`Row ${index + 1}: Category is required`);
    }
    if (!dict.dataType) {
      importErrors.value.push(`Row ${index + 1}: Data type is required`);
    }
    if (!dict.words || dict.words.length === 0) {
      importErrors.value.push(`Row ${index + 1}: At least one word is required`);
    }
  });
};

const performImport = async () => {
  if (!canImport.value) return;
  
  isLoading.value = true;
  
  try {
    const result = await store.importFromJSON(importPreview.value);
    
    if (result.success) {
      showToast(`Successfully imported ${result.imported} dictionaries!`, 'success');
      closeImportModal();
    } else {
      showToast('Import completed with some errors. Check the results.', 'warning');
    }
  } catch (error) {
    console.error('Error importing dictionaries:', error);
    showToast('Failed to import dictionaries. Please try again.', 'danger');
  } finally {
    isLoading.value = false;
  }
};

const exportDictionaries = async () => {
  try {
    const data = await store.exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pseudonym-dictionaries-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    showToast('Dictionaries exported successfully!', 'success');
  } catch (error) {
    console.error('Error exporting dictionaries:', error);
    showToast('Failed to export dictionaries.', 'danger');
  }
};

const showToast = async (message: string, color: 'success' | 'warning' | 'danger' = 'success') => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color,
    position: 'bottom'
  });
  await toast.present();
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

// Watchers
watch(() => filters.value, () => {
  applyFilters();
}, { deep: true });

watch(() => currentPage.value, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = 1;
  }
});

// Lifecycle
onMounted(async () => {
  await store.fetchDictionaries();
});
</script>

<style scoped>
.pseudonym-dictionary-manager {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.manager-header {
  text-align: center;
  margin-bottom: 2rem;
}

.manager-header h2 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.manager-header p {
  color: var(--ion-color-medium);
  font-size: 1.1rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.loading-container {
  text-align: center;
  padding: 3rem;
  color: var(--ion-color-medium);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--ion-color-medium);
}

.empty-state h3 {
  margin: 1rem 0 0.5rem 0;
}

.dictionary-card {
  height: 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dictionary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dictionary-card.inactive {
  opacity: 0.7;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.dictionary-info {
  flex: 1;
}

.card-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.dictionary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.dictionary-description {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 1rem 0;
  line-height: 1.4;
}

.word-preview h4 {
  font-size: 0.9rem;
  margin: 0.5rem 0;
  color: var(--ion-color-primary);
}

.word-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding: 1rem;
}

.page-info {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.words-textarea {
  font-family: monospace;
  font-size: 0.9rem;
}

.import-options {
  margin-top: 1rem;
}

.file-upload-section {
  margin: 2rem 0;
}

.selected-file {
  margin-top: 1rem;
}

.import-preview {
  margin: 2rem 0;
}

.import-preview h3 {
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .pseudonym-dictionary-manager {
    padding: 0.5rem;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons ion-button {
    width: 100%;
  }
  
  .card-header-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .card-actions {
    align-self: flex-end;
  }
  
  .pagination-container {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
