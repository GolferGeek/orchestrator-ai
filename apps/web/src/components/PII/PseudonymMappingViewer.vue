<template>
  <div class="pseudonym-mapping-viewer">
    <div class="viewer-header">
      <div class="header-content">
        <h2 class="viewer-title">
          <ion-icon :icon="libraryOutline" />
          Pseudonym Mapping Viewer
        </h2>
        <p class="viewer-subtitle">
          Visualize PII to pseudonym mappings and usage history
        </p>
      </div>
      
      <div class="header-actions">
        <ion-button 
          fill="outline" 
          size="small"
          @click="refreshMappings"
          :disabled="isLoading"
        >
          <ion-icon :icon="refreshOutline" slot="start" />
          Refresh
        </ion-button>
        
        <ion-button 
          fill="outline" 
          size="small"
          @click="showReversibilityDemo = !showReversibilityDemo"
          :color="showReversibilityDemo ? 'primary' : 'medium'"
        >
          <ion-icon :icon="eyeOutline" slot="start" />
          {{ showReversibilityDemo ? 'Hide' : 'Show' }} Demo
        </ion-button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-section">
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ totalMappings }}</div>
                <div class="stat-label">Total Mappings</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ totalUsage }}</div>
                <div class="stat-label">Total Usage</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ activeDataTypes }}</div>
                <div class="stat-label">Data Types</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ averageUsage }}</div>
                <div class="stat-label">Avg Usage</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Filters and Search -->
    <div class="filters-section">
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="4">
            <ion-searchbar
              v-model="searchTerm"
              placeholder="Search mappings..."
              :debounce="300"
              @ionInput="filterMappings"
              show-clear-button="focus"
            />
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-select
              v-model="selectedDataType"
              placeholder="Filter by Data Type"
              @ionChange="filterMappings"
            >
              <ion-select-option value="all">All Types</ion-select-option>
              <ion-select-option 
                v-for="type in availableDataTypes" 
                :key="type" 
                :value="type"
              >
                {{ formatDataType(type) }}
              </ion-select-option>
            </ion-select>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-select
              v-model="sortField"
              placeholder="Sort by"
              @ionChange="sortMappings"
            >
              <ion-select-option value="usageCount">Usage Count</ion-select-option>
              <ion-select-option value="lastUsedAt">Last Used</ion-select-option>
              <ion-select-option value="createdAt">Created Date</ion-select-option>
              <ion-select-option value="dataType">Data Type</ion-select-option>
            </ion-select>
          </ion-col>
          <ion-col size="12" size-md="2">
            <ion-button 
              fill="clear" 
              @click="toggleSortDirection"
              :color="sortDirection === 'desc' ? 'primary' : 'medium'"
            >
              <ion-icon :icon="sortDirection === 'desc' ? arrowDownOutline : arrowUpOutline" />
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-section">
      <ion-spinner name="crescent" />
      <p>Loading pseudonym mappings...</p>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="error" class="error-card">
      <ion-card-content>
        <div class="error-content">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <div>
            <h3>Error Loading Mappings</h3>
            <p>{{ error }}</p>
            <ion-button fill="outline" size="small" @click="refreshMappings">
              Try Again
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Mappings Table -->
    <ion-card v-else class="mappings-table-card">
      <ion-card-header>
        <ion-card-title>
          Pseudonym Mappings
          <ion-badge color="primary">{{ filteredMappings.length }}</ion-badge>
        </ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <div v-if="filteredMappings.length === 0" class="empty-state">
          <ion-icon :icon="documentOutline" />
          <h3>No Mappings Found</h3>
          <p>{{ searchTerm || selectedDataType !== 'all' ? 'Try adjusting your filters' : 'No pseudonym mappings have been created yet' }}</p>
        </div>
        
        <div v-else class="mappings-table">
          <div class="table-header">
            <div class="header-cell data-type">Data Type</div>
            <div class="header-cell pseudonym">Pseudonym</div>
            <div class="header-cell usage">Usage Count</div>
            <div class="header-cell last-used">Last Used</div>
            <div class="header-cell status">Status</div>
            <div class="header-cell actions">Actions</div>
          </div>
          
          <div class="table-body">
            <div 
              v-for="mapping in paginatedMappings" 
              :key="mapping.id"
              class="table-row"
              :class="{ 'high-usage': mapping.usageCount >= 10, 'recent': isRecentlyUsed(mapping) }"
            >
              <div class="table-cell data-type">
                <ion-chip 
                  :color="getDataTypeColor(mapping.dataType)"
                  size="small"
                >
                  <ion-icon :icon="getDataTypeIcon(mapping.dataType)" />
                  <ion-label>{{ formatDataType(mapping.dataType) }}</ion-label>
                </ion-chip>
              </div>
              
              <div class="table-cell pseudonym">
                <div class="pseudonym-display">
                  <span class="pseudonym-value">{{ mapping.pseudonym }}</span>
                  <ion-chip 
                    v-if="mapping.context"
                    size="small"
                    color="light"
                    class="context-chip"
                  >
                    {{ mapping.context }}
                  </ion-chip>
                </div>
              </div>
              
              <div class="table-cell usage">
                <div class="usage-display">
                  <span class="usage-count">{{ mapping.usageCount }}</span>
                  <div class="usage-bar">
                    <div 
                      class="usage-fill"
                      :style="{ width: `${getUsagePercentage(mapping.usageCount)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div class="table-cell last-used">
                <div class="date-display">
                  <span class="date-value">{{ formatDate(mapping.lastUsedAt) }}</span>
                  <span class="date-relative">{{ formatRelativeTime(mapping.lastUsedAt) }}</span>
                </div>
              </div>
              
              <div class="table-cell status">
                <ion-chip 
                  :color="getMappingStatusColor(mapping)"
                  size="small"
                >
                  <ion-icon :icon="getMappingStatusIcon(mapping)" />
                  <ion-label>{{ getMappingStatus(mapping) }}</ion-label>
                </ion-chip>
              </div>
              
              <div class="table-cell actions">
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click="showMappingDetails(mapping)"
                >
                  <ion-icon :icon="informationCircleOutline" />
                </ion-button>
                
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click="demonstrateReversibility(mapping)"
                  v-if="showReversibilityDemo"
                >
                  <ion-icon :icon="swapHorizontalOutline" />
                </ion-button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination -->
        <div v-if="filteredMappings.length > pageSize" class="pagination">
          <ion-button 
            fill="outline" 
            size="small"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            <ion-icon :icon="chevronBackOutline" />
            Previous
          </ion-button>
          
          <span class="pagination-info">
            Page {{ currentPage }} of {{ totalPages }}
            ({{ filteredMappings.length }} total)
          </span>
          
          <ion-button 
            fill="outline" 
            size="small"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next
            <ion-icon :icon="chevronForwardOutline" />
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Reversibility Demo Modal -->
    <ion-modal :is-open="reversibilityModalOpen" @didDismiss="reversibilityModalOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Reversibility Demonstration</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="reversibilityModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <div v-if="selectedMapping" class="reversibility-demo">
          <div class="demo-section">
            <h3>Mapping Information</h3>
            <div class="mapping-info">
              <div class="info-item">
                <strong>Data Type:</strong> {{ formatDataType(selectedMapping.dataType) }}
              </div>
              <div class="info-item">
                <strong>Pseudonym:</strong> {{ selectedMapping.pseudonym }}
              </div>
              <div class="info-item">
                <strong>Usage Count:</strong> {{ selectedMapping.usageCount }}
              </div>
              <div class="info-item">
                <strong>Context:</strong> {{ selectedMapping.context || 'None' }}
              </div>
            </div>
          </div>
          
          <div class="demo-section">
            <h3>Reversibility Demo</h3>
            <ion-card class="demo-card">
              <ion-card-content>
                <div class="demo-content">
                  <ion-icon :icon="warningOutline" color="warning" />
                  <div>
                    <h4>Demo Mode</h4>
                    <p>
                      This is a safe demonstration using mock data. In a real scenario, 
                      reversibility would only be available through secure, audited processes 
                      with proper authorization.
                    </p>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
            
            <div class="reversibility-flow">
              <div class="flow-step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>Pseudonym Input</h4>
                  <ion-chip color="secondary">{{ selectedMapping.pseudonym }}</ion-chip>
                </div>
              </div>
              
              <ion-icon :icon="arrowForwardOutline" class="flow-arrow" />
              
              <div class="flow-step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>Lookup Process</h4>
                  <p>Secure hash lookup in mapping database</p>
                </div>
              </div>
              
              <ion-icon :icon="arrowForwardOutline" class="flow-arrow" />
              
              <div class="flow-step">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>Result (Demo)</h4>
                  <ion-chip color="success">[DEMO: Original Value]</ion-chip>
                  <p class="demo-note">Actual value never displayed in production</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Mapping Details Modal -->
    <ion-modal :is-open="detailsModalOpen" @didDismiss="detailsModalOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Mapping Details</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="detailsModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <div v-if="selectedMapping" class="mapping-details">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Mapping Information</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                <ion-item>
                  <ion-label>
                    <h3>Data Type</h3>
                    <p>{{ formatDataType(selectedMapping.dataType) }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Pseudonym</h3>
                    <p>{{ selectedMapping.pseudonym }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Usage Count</h3>
                    <p>{{ selectedMapping.usageCount }} times</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Context</h3>
                    <p>{{ selectedMapping.context || 'No context specified' }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Created</h3>
                    <p>{{ formatDate(selectedMapping.createdAt) }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Last Used</h3>
                    <p>{{ formatDate(selectedMapping.lastUsedAt) }} ({{ formatRelativeTime(selectedMapping.lastUsedAt) }})</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Last Updated</h3>
                    <p>{{ formatDate(selectedMapping.updatedAt) }}</p>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonBadge,
  toastController
} from '@ionic/vue';
import {
  libraryOutline,
  refreshOutline,
  eyeOutline,
  alertCircleOutline,
  documentOutline,
  informationCircleOutline,
  swapHorizontalOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  warningOutline,
  arrowForwardOutline,
  arrowDownOutline,
  arrowUpOutline,
  personOutline,
  mailOutline,
  callOutline,
  locationOutline,
  globeOutline,
  cardOutline,
  keyOutline,
  documentTextOutline
} from 'ionicons/icons';

import { PseudonymMapping, PIIDataType } from '@/types/pii';
import { usePseudonymMappingsStore } from '@/stores/pseudonymMappingsStore';

// Pinia store
const mappingsStore = usePseudonymMappingsStore();

// Local component state
const searchTerm = ref('');
const selectedDataType = ref<string>('all');
const sortField = ref<string>('usageCount');
const sortDirection = ref<'asc' | 'desc'>('desc');

// Pagination
const currentPage = ref(1);
const pageSize = ref(10);

// Modals
const showReversibilityDemo = ref(false);
const reversibilityModalOpen = ref(false);
const detailsModalOpen = ref(false);
const selectedMapping = ref<PseudonymMapping | null>(null);

// Computed properties using store data
const availableDataTypes = computed(() => mappingsStore.availableDataTypes);
const totalMappings = computed(() => mappingsStore.totalMappings);
const totalUsage = computed(() => mappingsStore.totalUsage);
const activeDataTypes = computed(() => mappingsStore.availableDataTypes.length);
const averageUsage = computed(() => mappingsStore.averageUsage);
const isLoading = computed(() => mappingsStore.isLoading);
const error = computed(() => mappingsStore.error);

// Filtered mappings with local search and filters
const filteredMappings = computed(() => {
  let filtered = mappingsStore.mappings;

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(mapping => 
      mapping.pseudonym.toLowerCase().includes(search) ||
      mapping.dataType.toLowerCase().includes(search) ||
      (mapping.context && mapping.context.toLowerCase().includes(search))
    );
  }

  // Apply data type filter
  if (selectedDataType.value !== 'all') {
    filtered = filtered.filter(mapping => mapping.dataType === selectedDataType.value);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortField.value) {
      case 'usageCount':
        aVal = a.usageCount;
        bVal = b.usageCount;
        break;
      case 'lastUsedAt':
        aVal = new Date(a.lastUsedAt);
        bVal = new Date(b.lastUsedAt);
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
        break;
      case 'dataType':
        aVal = a.dataType;
        bVal = b.dataType;
        break;
      default:
        return 0;
    }

    if (sortDirection.value === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    } else {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
  });

  return filtered;
});

const paginatedMappings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredMappings.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredMappings.value.length / pageSize.value);
});

// Methods
const refreshMappings = async () => {
  await mappingsStore.refreshData();
};

const filterMappings = () => {
  currentPage.value = 1; // Reset to first page when filtering
};

const sortMappings = () => {
  currentPage.value = 1; // Reset to first page when sorting
};

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc';
  sortMappings();
};

const showMappingDetails = (mapping: PseudonymMapping) => {
  selectedMapping.value = mapping;
  detailsModalOpen.value = true;
};

const demonstrateReversibility = (mapping: PseudonymMapping) => {
  selectedMapping.value = mapping;
  reversibilityModalOpen.value = true;
};

// Utility functions
const formatDataType = (dataType: PIIDataType): string => {
  const typeMap: Record<PIIDataType, string> = {
    email: 'Email',
    phone: 'Phone',
    name: 'Name',
    address: 'Address',
    ip_address: 'IP Address',
    username: 'Username',
    credit_card: 'Credit Card',
    ssn: 'SSN',
    custom: 'Custom'
  };
  return typeMap[dataType] || dataType;
};

const getDataTypeColor = (dataType: PIIDataType): string => {
  const colorMap: Record<PIIDataType, string> = {
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
  return colorMap[dataType] || 'medium';
};

const getDataTypeIcon = (dataType: PIIDataType) => {
  const iconMap: Record<PIIDataType, any> = {
    email: mailOutline,
    phone: callOutline,
    name: personOutline,
    address: locationOutline,
    ip_address: globeOutline,
    username: personOutline,
    credit_card: cardOutline,
    ssn: keyOutline,
    custom: documentTextOutline
  };
  return iconMap[dataType] || documentTextOutline;
};

const getUsagePercentage = (usageCount: number): number => {
  const maxUsage = Math.max(...mappingsStore.mappings.map(m => m.usageCount));
  return maxUsage > 0 ? (usageCount / maxUsage) * 100 : 0;
};

const isRecentlyUsed = (mapping: PseudonymMapping): boolean => {
  const lastUsed = new Date(mapping.lastUsedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 7; // Consider recent if used within 7 days
};

const getMappingStatus = (mapping: PseudonymMapping): string => {
  if (isRecentlyUsed(mapping)) {
    return 'Active';
  } else if (mapping.usageCount >= 10) {
    return 'Frequent';
  } else if (mapping.usageCount === 1) {
    return 'New';
  } else {
    return 'Occasional';
  }
};

const getMappingStatusColor = (mapping: PseudonymMapping): string => {
  const status = getMappingStatus(mapping);
  const colorMap: Record<string, string> = {
    'Active': 'success',
    'Frequent': 'primary',
    'New': 'tertiary',
    'Occasional': 'medium'
  };
  return colorMap[status] || 'medium';
};

const getMappingStatusIcon = (mapping: PseudonymMapping) => {
  const status = getMappingStatus(mapping);
  const iconMap: Record<string, any> = {
    'Active': refreshOutline,
    'Frequent': arrowUpOutline,
    'New': documentOutline,
    'Occasional': arrowDownOutline
  };
  return iconMap[status] || documentOutline;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}w ago`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  }
};

// Initialize component
onMounted(async () => {
  // Load data from store on component mount
  await mappingsStore.fetchMappings();
  await mappingsStore.fetchStats();
});
</script>

<style scoped>
.pseudonym-mapping-viewer {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-content {
  flex: 1;
  min-width: 300px;
}

.viewer-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-dark);
}

.viewer-subtitle {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stat-card {
  text-align: center;
  margin: 0;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.filters-section {
  margin-bottom: 1.5rem;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
  color: var(--ion-color-medium);
}

.error-card {
  margin-bottom: 1.5rem;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-content ion-icon {
  font-size: 2rem;
}

.mappings-table-card {
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.mappings-table {
  overflow-x: auto;
}

.table-header {
  display: grid;
  grid-template-columns: 120px 1fr 120px 140px 120px 100px;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}

.table-body {
  border: 1px solid var(--ion-color-light);
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 120px 1fr 120px 140px 120px 100px;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  align-items: center;
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background: var(--ion-color-light-tint);
}

.table-row.high-usage {
  border-left: 3px solid var(--ion-color-primary);
}

.table-row.recent {
  background: var(--ion-color-success-tint);
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
}

.pseudonym-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.pseudonym-value {
  font-weight: 500;
  word-break: break-word;
}

.context-chip {
  align-self: flex-start;
}

.usage-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.usage-count {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.usage-bar {
  height: 4px;
  background: var(--ion-color-light-shade);
  border-radius: 2px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.date-display {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.date-value {
  font-size: 0.85rem;
}

.date-relative {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

/* Reversibility Demo Styles */
.reversibility-demo {
  padding: 1rem;
}

.demo-section {
  margin-bottom: 2rem;
}

.demo-section h3 {
  margin-bottom: 1rem;
  color: var(--ion-color-dark);
}

.mapping-info {
  display: grid;
  gap: 0.5rem;
}

.info-item {
  padding: 0.5rem;
  background: var(--ion-color-light);
  border-radius: 4px;
  font-size: 0.9rem;
}

.demo-card {
  margin-bottom: 1.5rem;
}

.demo-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.demo-content ion-icon {
  font-size: 2rem;
}

.reversibility-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 150px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.step-content h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
}

.step-content p {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.demo-note {
  font-style: italic;
  color: var(--ion-color-warning) !important;
}

.flow-arrow {
  font-size: 1.5rem;
  color: var(--ion-color-medium);
}

/* Mapping Details Styles */
.mapping-details {
  padding: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .viewer-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: stretch;
  }

  .header-actions ion-button {
    flex: 1;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .table-cell {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--ion-color-light-shade);
  }

  .table-cell:last-child {
    border-bottom: none;
  }

  .table-cell::before {
    content: attr(data-label);
    font-weight: 600;
    margin-right: 0.5rem;
    color: var(--ion-color-medium);
    font-size: 0.8rem;
  }

  .pagination {
    flex-direction: column;
    gap: 1rem;
  }

  .reversibility-flow {
    flex-direction: column;
  }

  .flow-arrow {
    transform: rotate(90deg);
  }
}
</style>
