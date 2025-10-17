<template>
  <div class="pii-pattern-table">
    <!-- Search and Filter Controls -->
    <div class="table-controls">
      <ion-grid>
        <ion-row>
          <!-- Search Input -->
          <ion-col size="12" size-md="4">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search patterns..."
              debounce="300"
              @ionInput="handleSearch"
              show-clear-button="focus"
            />
          </ion-col>
          
          <!-- Filter Controls -->
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
              <ion-select-option value="ip_address">IP Address</ion-select-option>
              <ion-select-option value="username">Username</ion-select-option>
              <ion-select-option value="credit_card">Credit Card</ion-select-option>
              <ion-select-option value="ssn">SSN</ion-select-option>
              <ion-select-option value="custom">Custom</ion-select-option>
            </ion-select>
          </ion-col>
          
          <ion-col size="6" size-md="2">
            <ion-select
              v-model="filters.enabled"
              placeholder="Status"
              interface="popover"
              @ionChange="applyFilters"
            >
              <ion-select-option value="all">All Status</ion-select-option>
              <ion-select-option :value="true">Enabled</ion-select-option>
              <ion-select-option :value="false">Disabled</ion-select-option>
            </ion-select>
          </ion-col>
          
          <ion-col size="6" size-md="2">
            <ion-select
              v-model="filters.isBuiltIn"
              placeholder="Type"
              interface="popover"
              @ionChange="applyFilters"
            >
              <ion-select-option value="all">All Patterns</ion-select-option>
              <ion-select-option :value="true">Built-in</ion-select-option>
              <ion-select-option :value="false">Custom</ion-select-option>
            </ion-select>
          </ion-col>
          
          <!-- Bulk Actions -->
          <ion-col size="6" size-md="2">
            <ion-button
              v-if="selectedPatterns.length > 0"
              fill="outline"
              size="small"
              @click="showBulkActions = true"
            >
              <ion-icon :icon="ellipsisVerticalOutline" slot="start" />
              Actions ({{ selectedPatterns.length }})
            </ion-button>
          </ion-col>
          
          <!-- Add New Pattern Button -->
          <ion-col size="12" size-md="2">
            <ion-button
              fill="solid"
              size="small"
              color="primary"
              @click="emit('create-pattern')"
              :disabled="isLoading"
              expand="block"
            >
              <ion-icon :icon="addOutline" slot="start" />
              Add Pattern
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Loading State -->
    <div v-if="piiStore.isLoading" class="loading-container">
      <ion-spinner />
      <p>Loading PII patterns...</p>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="piiStore.error" color="danger">
      <ion-card-content>
        <ion-icon :icon="alertCircleOutline" />
        <p>{{ piiStore.error }}</p>
        <ion-button fill="outline" @click="piiStore.fetchPatterns()">
          Retry
        </ion-button>
      </ion-card-content>
    </ion-card>

    <!-- Table -->
    <div v-else class="table-container">
      <!-- Table Header -->
      <ion-grid class="table-header">
        <ion-row>
          <ion-col size="1">
            <ion-checkbox
              v-model="selectAll"
              @ionChange="handleSelectAll"
              :indeterminate="isIndeterminate"
            />
          </ion-col>
          <ion-col size="2">
            <ion-button
              fill="clear"
              size="small"
              @click="sortBy('name')"
              class="sort-button"
            >
              Name
              <ion-icon
                :icon="getSortIcon('name')"
                slot="end"
                v-if="sortOptions.field === 'name'"
              />
            </ion-button>
          </ion-col>
          <ion-col size="2">
            <ion-button
              fill="clear"
              size="small"
              @click="sortBy('dataType')"
              class="sort-button"
            >
              Data Type
              <ion-icon
                :icon="getSortIcon('dataType')"
                slot="end"
                v-if="sortOptions.field === 'dataType'"
              />
            </ion-button>
          </ion-col>
          <ion-col size="2">
            <ion-button
              fill="clear"
              size="small"
              @click="sortBy('enabled')"
              class="sort-button"
            >
              Status
              <ion-icon
                :icon="getSortIcon('enabled')"
                slot="end"
                v-if="sortOptions.field === 'enabled'"
              />
            </ion-button>
          </ion-col>
          <ion-col size="2">Type</ion-col>
          <ion-col size="2">
            <ion-button
              fill="clear"
              size="small"
              @click="sortBy('priority')"
              class="sort-button"
            >
              Priority
              <ion-icon
                :icon="getSortIcon('priority')"
                slot="end"
                v-if="sortOptions.field === 'priority'"
              />
            </ion-button>
          </ion-col>
          <ion-col size="1">Actions</ion-col>
        </ion-row>
      </ion-grid>

      <!-- Table Rows -->
      <div class="table-body">
        <ion-grid
          v-for="pattern in filteredPatterns"
          :key="pattern.id || pattern.name"
          class="table-row"
          :class="{ 'selected': isSelected(pattern) }"
        >
          <ion-row>
            <!-- Checkbox -->
            <ion-col size="1">
              <ion-checkbox
                :checked="isSelected(pattern)"
                @ionChange="toggleSelection(pattern)"
              />
            </ion-col>
            
            <!-- Name -->
            <ion-col size="2">
              <div class="pattern-name">
                <strong>{{ pattern.name }}</strong>
                <p class="pattern-description">{{ pattern.description }}</p>
              </div>
            </ion-col>
            
            <!-- Data Type -->
            <ion-col size="2">
              <ion-chip :color="getDataTypeColor(pattern.dataType)" outline>
                {{ formatDataType(pattern.dataType) }}
              </ion-chip>
            </ion-col>
            
            <!-- Status -->
            <ion-col size="2">
              <ion-chip :color="pattern.enabled ? 'success' : 'medium'" outline>
                <ion-icon
                  :icon="pattern.enabled ? checkmarkCircleOutline : closeCircleOutline"
                  slot="start"
                />
                {{ pattern.enabled ? 'Enabled' : 'Disabled' }}
              </ion-chip>
            </ion-col>
            
            <!-- Built-in/Custom -->
            <ion-col size="2">
              <ion-chip :color="pattern.isBuiltIn ? 'primary' : 'secondary'" outline>
                <ion-icon
                  :icon="pattern.isBuiltIn ? shieldCheckmarkOutline : hammerOutline"
                  slot="start"
                />
                {{ pattern.isBuiltIn ? 'Built-in' : 'Custom' }}
              </ion-chip>
            </ion-col>
            
            <!-- Priority -->
            <ion-col size="2">
              <ion-badge :color="getPriorityColor(pattern.priority || 5)">
                {{ pattern.priority || 5 }}
              </ion-badge>
            </ion-col>
            
            <!-- Actions -->
            <ion-col size="1">
              <ion-button
                fill="clear"
                size="small"
                @click="showPatternActions(pattern)"
              >
                <ion-icon :icon="ellipsisVerticalOutline" slot="icon-only" />
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>

      <!-- Empty State -->
      <div v-if="filteredPatterns.length === 0" class="empty-state">
        <ion-icon :icon="documentTextOutline" size="large" color="medium" />
        <h3>No patterns found</h3>
        <p>Try adjusting your search or filter criteria.</p>
      </div>
    </div>

    <!-- Bulk Actions Modal -->
    <ion-modal :is-open="showBulkActions" @did-dismiss="showBulkActions = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Bulk Actions</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showBulkActions = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item button @click="performBulkAction('enable')">
            <ion-icon :icon="checkmarkCircleOutline" slot="start" color="success" />
            <ion-label>Enable Selected ({{ selectedPatterns.length }})</ion-label>
          </ion-item>
          <ion-item button @click="performBulkAction('disable')">
            <ion-icon :icon="closeCircleOutline" slot="start" color="medium" />
            <ion-label>Disable Selected ({{ selectedPatterns.length }})</ion-label>
          </ion-item>
          <ion-item button @click="performBulkAction('delete')" color="danger">
            <ion-icon :icon="trashOutline" slot="start" color="danger" />
            <ion-label>Delete Selected ({{ selectedPatterns.length }})</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonCheckbox,
  IonChip,
  IonBadge,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  alertController
} from '@ionic/vue';
import {
  ellipsisVerticalOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  shieldCheckmarkOutline,
  hammerOutline,
  documentTextOutline,
  closeOutline,
  trashOutline,
  chevronUpOutline,
  chevronDownOutline,
  addOutline
} from 'ionicons/icons';
import { usePrivacyStore } from '@/stores/privacyStore';
import { PIIPattern, PIIDataType } from '@/types/pii';

// Store
const piiStore = usePrivacyStore();

// Reactive state
const searchQuery = ref('');
const showBulkActions = ref(false);

// Computed
const filters = computed(() => piiStore.filters);
const sortOptions = computed(() => piiStore.sortOptions);
const filteredPatterns = computed(() => piiStore.filteredAndSortedPatterns);
const selectedPatterns = computed(() => piiStore.selectedPatterns);
const isLoading = computed(() => piiStore.isLoading);

// Selection state
const selectAll = computed({
  get: () => filteredPatterns.value.length > 0 && selectedPatterns.value.length === filteredPatterns.value.length,
  set: (value: boolean) => {
    if (value) {
      piiStore.selectAllPatterns(filteredPatterns.value.map(p => p.id || p.name));
    } else {
      piiStore.clearSelection();
    }
  }
});

const isIndeterminate = computed(() => 
  selectedPatterns.value.length > 0 && selectedPatterns.value.length < filteredPatterns.value.length
);

// Methods
const handleSearch = () => {
  piiStore.updateFilters({ search: searchQuery.value });
};

const applyFilters = () => {
  // Filters are reactive through the store
};

const sortBy = (field: string) => {
  piiStore.updateSort({
    field,
    direction: sortOptions.value.field === field && sortOptions.value.direction === 'asc' ? 'desc' : 'asc'
  });
};

const getSortIcon = (field: string) => {
  if (sortOptions.value.field !== field) return null;
  return sortOptions.value.direction === 'asc' ? chevronUpOutline : chevronDownOutline;
};

const isSelected = (pattern: PIIPattern) => {
  return selectedPatterns.value.some(p => (p.id || p.name) === (pattern.id || pattern.name));
};

const toggleSelection = (pattern: PIIPattern) => {
  const id = pattern.id || pattern.name;
  if (isSelected(pattern)) {
    piiStore.deselectPattern(id);
  } else {
    piiStore.selectPattern(pattern);
  }
};

const handleSelectAll = () => {
  // Handled by the computed selectAll setter
};

const showPatternActions = async (pattern: PIIPattern) => {
  const alert = await alertController.create({
    header: 'Pattern Actions',
    subHeader: pattern.name,
    buttons: [
      {
        text: 'Edit',
        handler: () => {
          // Emit edit event
          emit('edit-pattern', pattern);
        }
      },
      {
        text: pattern.enabled ? 'Disable' : 'Enable',
        handler: async () => {
          try {
            await piiStore.updatePattern(pattern.id || pattern.name, {
              ...pattern,
              enabled: !pattern.enabled
            });
          } catch (error) {
            console.error('Failed to toggle pattern:', error);
          }
        }
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          const confirmAlert = await alertController.create({
            header: 'Confirm Delete',
            message: `Are you sure you want to delete "${pattern.name}"?`,
            buttons: [
              { text: 'Cancel', role: 'cancel' },
              {
                text: 'Delete',
                role: 'destructive',
                handler: async () => {
                  try {
                    await piiStore.deletePattern(pattern.id || pattern.name);
                  } catch (error) {
                    console.error('Failed to delete pattern:', error);
                  }
                }
              }
            ]
          });
          await confirmAlert.present();
        }
      },
      {
        text: 'Cancel',
        role: 'cancel'
      }
    ]
  });
  await alert.present();
};

const performBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
  const selectedIds = selectedPatterns.value.map(p => p.id || p.name);
  
  try {
    await piiStore.bulkOperation({
      operation: action,
      patternIds: selectedIds
    });
    showBulkActions.value = false;
    piiStore.clearSelection();
  } catch (error) {
    console.error(`Failed to perform bulk ${action}:`, error);
  }
};

// Utility functions
const getDataTypeColor = (dataType: PIIDataType) => {
  const colors: Record<PIIDataType, string> = {
    email: 'primary',
    phone: 'secondary',
    name: 'tertiary',
    address: 'warning',
    ip_address: 'medium',
    username: 'dark',
    credit_card: 'danger',
    ssn: 'danger',
    custom: 'success'
  };
  return colors[dataType] || 'medium';
};

const formatDataType = (dataType: PIIDataType) => {
  return dataType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getPriorityColor = (priority: number) => {
  if (priority <= 2) return 'danger';
  if (priority <= 4) return 'warning';
  if (priority <= 6) return 'primary';
  return 'medium';
};

// Events
const emit = defineEmits<{
  'edit-pattern': [pattern: PIIPattern];
  'create-pattern': [];
}>();

// Lifecycle
onMounted(async () => {
  await piiStore.fetchPatterns();
});

// Watch for search changes
watch(searchQuery, (newValue) => {
  piiStore.updateFilters({ search: newValue });
});
</script>

<style scoped>
.pii-pattern-table {
  padding: 1rem;
}

.table-controls {
  margin-bottom: 1rem;
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-header {
  background: var(--ion-color-light-shade);
  border-bottom: 1px solid var(--ion-color-light-tint);
  font-weight: 600;
}

.table-header ion-col {
  padding: 0.75rem 0.5rem;
}

.sort-button {
  --color: var(--ion-color-dark);
  font-weight: 600;
  justify-content: flex-start;
  width: 100%;
}

.table-row {
  border-bottom: 1px solid var(--ion-color-light);
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background: var(--ion-color-light-tint);
}

.table-row.selected {
  background: var(--ion-color-primary-tint);
}

.table-row ion-col {
  padding: 1rem 0.5rem;
  display: flex;
  align-items: center;
}

.pattern-name strong {
  display: block;
  margin-bottom: 0.25rem;
}

.pattern-description {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--ion-color-medium);
}

.empty-state h3 {
  margin: 1rem 0 0.5rem 0;
}

.empty-state p {
  margin: 0;
}

ion-chip {
  font-size: 0.75rem;
}

ion-badge {
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .table-header,
  .table-row {
    font-size: 0.875rem;
  }
  
  .pattern-description {
    font-size: 0.75rem;
  }
  
  ion-chip {
    font-size: 0.625rem;
  }
}
</style>
