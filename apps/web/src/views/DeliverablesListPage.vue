<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button color="primary"></ion-menu-button>
        </ion-buttons>
        <ion-title>Deliverables</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="createNewDeliverable" fill="clear">
            <ion-icon :icon="addOutline" slot="start"></ion-icon>
            New Deliverable
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Deliverables</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Refresher -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="deliverables-container">
        <!-- Loading state -->
        <div v-if="isLoading" class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading deliverables...</p>
        </div>

        <!-- Error state -->
        <div v-if="error && !isLoading" class="error-container">
          <ion-icon :icon="alertCircleOutline" color="danger" class="error-icon"></ion-icon>
          <h3>Failed to load deliverables</h3>
          <p>{{ error }}</p>
          <ion-button @click="loadDeliverables" fill="outline">
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Retry
          </ion-button>
        </div>

        <!-- Empty state -->
        <div v-if="!isLoading && !error && !hasDeliverables" class="empty-state">
          <ion-icon :icon="documentOutline" class="empty-icon"></ion-icon>
          <h2>No Deliverables Yet</h2>
          <p>Deliverables are automatically created when agents generate content, or you can create them manually. They help you track and version important outputs from your AI conversations.</p>
          <ion-button @click="createNewDeliverable" fill="solid">
            <ion-icon :icon="addOutline" slot="start"></ion-icon>
            Create First Deliverable
          </ion-button>
        </div>

        <!-- Deliverables List -->
        <div v-if="!isLoading && !error && hasDeliverables" class="deliverables-list">
          <!-- Search and Filter Controls -->
          <div class="controls-bar">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search deliverables..."
              :debounce="300"
              @ionInput="handleSearch"
              class="search-bar"
            ></ion-searchbar>
            
            <div class="filter-controls">
              <ion-select 
                v-model="typeFilter" 
                placeholder="All Types"
                interface="popover"
                @ionChange="handleFilter"
              >
                <ion-select-option value="">All Types</ion-select-option>
                <ion-select-option value="document">Documents</ion-select-option>
                <ion-select-option value="analysis">Analysis</ion-select-option>
                <ion-select-option value="report">Reports</ion-select-option>
                <ion-select-option value="plan">Plans</ion-select-option>
                <ion-select-option value="requirements">Requirements</ion-select-option>
              </ion-select>
              
              <ion-select 
                v-model="sortBy" 
                placeholder="Sort by"
                interface="popover"
                @ionChange="handleSort"
              >
                <ion-select-option value="created_desc">Newest First</ion-select-option>
                <ion-select-option value="created_asc">Oldest First</ion-select-option>
                <ion-select-option value="updated_desc">Recently Updated</ion-select-option>
                <ion-select-option value="title_asc">Title A-Z</ion-select-option>
                <ion-select-option value="type_asc">Type</ion-select-option>
              </ion-select>
            </div>
          </div>

          <!-- Deliverables Grid -->
          <div class="deliverables-grid">
            <ion-card 
              v-for="deliverable in displayedDeliverables" 
              :key="deliverable.id"
              @click="viewDeliverable(deliverable)"
              class="deliverable-card"
              button
            >
              <ion-card-header>
                <div class="deliverable-header">
                  <div class="deliverable-title-section">
                    <div class="title-with-icon">
                      <span class="type-icon">{{ getTypeIcon(deliverable.deliverable_type as any) }}</span>
                      <ion-card-title>{{ deliverable.title }}</ion-card-title>
                    </div>
                  </div>
                  <div class="deliverable-badges">
                    <ion-badge 
                      :color="getTypeColor(deliverable.deliverable_type as any)"
                      class="type-badge"
                    >
                      {{ getTypeName(deliverable.deliverable_type as any) }}
                    </ion-badge>
                    <ion-badge 
                      v-if="deliverable.version > 1"
                      color="medium"
                      class="version-badge"
                    >
                      v{{ deliverable.version }}
                    </ion-badge>
                  </div>
                </div>
              </ion-card-header>

              <ion-card-content>
                <div class="deliverable-preview">
                  <p class="content-preview">{{ getContentPreview(deliverable.content_preview || deliverable.content || '') }}</p>
                </div>

                <div class="deliverable-meta">
                  <div class="meta-item" v-if="deliverable.created_by_agent">
                    <ion-icon :icon="sparklesOutline"></ion-icon>
                    <span>{{ deliverable.created_by_agent }}</span>
                  </div>
                  <div class="meta-item">
                    <ion-icon :icon="calendarOutline"></ion-icon>
                    <span>{{ formatDate(deliverable.created_at) }}</span>
                  </div>
                </div>

                <div class="deliverable-tags" v-if="deliverable.tags && deliverable.tags.length > 0">
                  <ion-chip 
                    v-for="tag in deliverable.tags?.slice(0, 3)" 
                    :key="tag"
                    color="primary"
                    outline
                    class="tag-chip"
                  >
                    <ion-label>{{ tag }}</ion-label>
                  </ion-chip>
                  <ion-chip 
                    v-if="(deliverable.tags?.length || 0) > 3"
                    color="medium"
                    outline
                    class="tag-chip"
                  >
                    <ion-label>+{{ (deliverable.tags?.length || 0) - 3 }}</ion-label>
                  </ion-chip>
                </div>

                <!-- Quick Actions -->
                <div class="deliverable-actions">
                  <ion-button 
                    fill="clear" 
                    size="small"
                    @click.stop="viewDeliverable(deliverable)"
                  >
                    <ion-icon :icon="eyeOutline" slot="start"></ion-icon>
                    View
                  </ion-button>
                  <ion-button 
                    fill="clear" 
                    size="small"
                    @click.stop="editDeliverable(deliverable)"
                  >
                    <ion-icon :icon="createOutline" slot="start"></ion-icon>
                    Edit
                  </ion-button>
                  <ion-button 
                    v-if="deliverable.version > 1 || hasVersions(deliverable.id)"
                    fill="clear" 
                    size="small"
                    color="secondary"
                    @click.stop="viewVersions(deliverable)"
                  >
                    <ion-icon :icon="gitBranchOutline" slot="start"></ion-icon>
                    Versions
                  </ion-button>
                  <ion-button 
                    fill="clear" 
                    size="small"
                    color="danger"
                    @click.stop="confirmDelete(deliverable)"
                  >
                    <ion-icon :icon="trashOutline" slot="start"></ion-icon>
                    Delete
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>

          <!-- Load More Button -->
          <div v-if="canLoadMore" class="load-more-container">
            <ion-button 
              @click="loadMoreDeliverables" 
              fill="outline" 
              :disabled="isLoadingMore"
            >
              <ion-spinner v-if="isLoadingMore" name="crescent" slot="start"></ion-spinner>
              <ion-icon v-else :icon="chevronDownOutline" slot="start"></ion-icon>
              {{ isLoadingMore ? 'Loading...' : 'Load More' }}
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>

    <!-- Deliverable Modal -->
    <DeliverableModal
      :is-open="deliverables.showDeliverableModal.value"
      :deliverable="deliverables.selectedDeliverable.value || undefined"
      :mode="deliverables.isCreatingDeliverable.value ? 'create' : 'view'"
      @close="deliverables.hideDeliverable"
      @save="handleSaveDeliverable"
      @enhance="handleEnhanceDeliverable"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonChip,
  IonLabel,
  alertController,
} from '@ionic/vue';
import {
  addOutline,
  documentOutline,
  alertCircleOutline,
  refreshOutline,
  sparklesOutline,
  calendarOutline,
  chatbubbleOutline,
  eyeOutline,
  createOutline,
  gitBranchOutline,
  trashOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useDeliverables } from '@/composables/useDeliverables';
import { DeliverableType, type Deliverable, type DeliverableSearchItem } from '@/services/deliverablesService';
import DeliverableModal from '@/components/DeliverableModal.vue';

const router = useRouter();
const deliverables = useDeliverables();

// Reactive state
const searchQuery = ref('');
const typeFilter = ref('');
const sortBy = ref('created_desc');
const isLoadingMore = ref(false);
const currentOffset = ref(0);
const pageSize = 20;

// Computed properties
const displayedDeliverables = computed(() => {
  let filtered = deliverables.recentDeliverables.value.map((d: any) => ({
    ...d,
    content_preview: (d as any).content_preview || (d.content ? d.content.substring(0, 200) + (d.content.length > 200 ? '...' : '') : '')
  }));
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(deliverable => 
      deliverable.title.toLowerCase().includes(query) ||
      (deliverable.content_preview || deliverable.content || '').toLowerCase().includes(query) ||
      deliverable.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  }
  
  // Apply type filter
  if (typeFilter.value) {
    filtered = filtered.filter(deliverable => 
      deliverable.deliverable_type === typeFilter.value
    );
  }
  
  // Apply sorting
  const [sortField, sortOrder] = sortBy.value.split('_');
  filtered.sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'created':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'updated':
        aValue = new Date(a.updated_at || a.created_at).getTime();
        bValue = new Date(b.updated_at || b.created_at).getTime();
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'type':
        aValue = a.deliverable_type;
        bValue = b.deliverable_type;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });
  
  return filtered;
});

const canLoadMore = computed(() => {
  // This would be based on the total count from the search results
  // For now, just return false as we don't have pagination implemented
  return false;
});

// Methods
const loadDeliverables = async () => {
  try {
    await deliverables.initialize();
  } catch (err) {
    console.error('Failed to load deliverables:', err);
  }
};

const handleRefresh = async (event: CustomEvent) => {
  await loadDeliverables();
  event.detail.complete();
};

const handleSearch = async () => {
  if (searchQuery.value.trim()) {
    await deliverables.search(searchQuery.value, {
      type: typeFilter.value as any || undefined,
      limit: pageSize,
      offset: 0
    });
  } else {
    await loadDeliverables();
  }
  currentOffset.value = 0;
};

const handleFilter = async () => {
  if (searchQuery.value.trim()) {
    await deliverables.search(searchQuery.value, {
      type: typeFilter.value as any || undefined,
      limit: pageSize,
      offset: 0
    });
  } else {
    await deliverables.store.loadDeliverables();
  }
  currentOffset.value = 0;
};

const handleSort = () => {
  // Sorting is handled by computed property
};

const loadMoreDeliverables = async () => {
  isLoadingMore.value = true;
  try {
    const newOffset = currentOffset.value + pageSize;
    
    if (searchQuery.value.trim()) {
      await deliverables.search(searchQuery.value, {
        type: typeFilter.value as any || undefined,
        limit: pageSize,
        offset: newOffset
      });
    } else {
      await deliverables.store.loadDeliverables();
    }
    
    currentOffset.value = newOffset;
  } finally {
    isLoadingMore.value = false;
  }
};

const createNewDeliverable = () => {
  deliverables.startCreating();
};

const viewDeliverable = async (deliverable: any) => {
  // Fetch full deliverable details and show in modal
  const fullDeliverable = await deliverables.store.getDeliverable(deliverable.id);
  if (fullDeliverable) {
    deliverables.showDeliverable(fullDeliverable as any);
  }
};

const editDeliverable = async (deliverable: any) => {
  // Fetch full deliverable details and show in modal for editing
  const fullDeliverable = await deliverables.store.getDeliverable(deliverable.id);
  if (fullDeliverable) {
    deliverables.showDeliverable(fullDeliverable as any);
    // The modal will detect that it's in edit mode
  }
};

const viewVersions = async (deliverable: any) => {
  try {
    const versions = await deliverables.getVersions(deliverable.id);
    // Show versions in a modal or navigate to versions page
    console.log('Versions for deliverable:', versions);
    // TODO: Implement versions modal or page
  } catch (err) {
    console.error('Failed to load versions:', err);
  }
};

const confirmDelete = async (deliverable: any) => {
  const alert = await alertController.create({
    header: 'Delete Deliverable',
    message: `Are you sure you want to delete "${deliverable.title}"? This action cannot be undone.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: () => deleteDeliverable(deliverable)
      }
    ]
  });
  await alert.present();
};

const deleteDeliverable = async (deliverable: any) => {
  try {
    await deliverables.store.deleteDeliverable(deliverable.id);
    // Show success toast
    console.log('Deliverable deleted successfully');
    // Refresh the list
    await loadDeliverables();
  } catch (err) {
    console.error('Failed to delete deliverable:', err);
  }
};

const handleSaveDeliverable = async (updates: Partial<Deliverable>) => {
  if (deliverables.isCreatingDeliverable.value) {
    // Create new deliverable
    try {
      await deliverables.createDeliverable(
        updates.title || 'New Deliverable',
        updates.content || '',
        {
          description: updates.description,
          type: DeliverableType.DOCUMENT, // Default type
        }
      );
      deliverables.hideDeliverable();
    } catch (err) {
      console.error('Failed to create deliverable:', err);
    }
  }
};

const handleEnhanceDeliverable = async (deliverable: Deliverable) => {
  // Start enhancement workflow
  deliverables.store.startEnhancement(deliverable.id);
  
  // TODO: Navigate to chat or show enhancement dialog
  console.log('Starting enhancement for deliverable:', deliverable.id);
};

// Utility methods
const getContentPreview = (content: string): string => {
  const stripped = content.replace(/[#*`_~]/g, '').trim();
  return stripped.length > 150 ? stripped.substring(0, 150) + '...' : stripped;
};

const getTypeIcon = (type: DeliverableType): string => {
  return deliverables.getTypeIcon(type);
};

const getTypeName = (type: DeliverableType): string => {
  return deliverables.getTypeName(type);
};

const getTypeColor = (type: DeliverableType): string => {
  const colors = {
    [DeliverableType.DOCUMENT]: 'primary',
    [DeliverableType.ANALYSIS]: 'secondary',
    [DeliverableType.REPORT]: 'tertiary',
    [DeliverableType.PLAN]: 'success',
    [DeliverableType.REQUIREMENTS]: 'warning'
  };
  return colors[type] || 'medium';
};

const formatDate = (date: string | Date): string => {
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  return deliverables.formatDate(dateStr);
};

const hasVersions = (deliverableId: string): boolean => {
  // For now, assume deliverables with version > 1 have versions
  // This could be enhanced to cache version info
  return false; // TODO: Implement version caching if needed
};

// Watchers
watch(() => deliverables.error.value, (newError) => {
  if (newError) {
    console.error('Deliverables error:', newError);
  }
});

// Lifecycle
onMounted(() => {
  loadDeliverables();
});

// Re-export computed properties for template
const {
  hasDeliverables,
  isLoading,
  error
} = deliverables;
</script>

<style scoped>
.deliverables-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-container,
.error-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.error-icon,
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-icon {
  color: var(--ion-color-medium);
}

.empty-state h2 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--ion-color-medium);
  margin-bottom: 2rem;
  max-width: 500px;
  line-height: 1.6;
}

.controls-bar {
  margin-bottom: 1.5rem;
}

.search-bar {
  margin-bottom: 1rem;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-controls ion-select {
  min-width: 140px;
}

.deliverables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
}

.deliverable-card {
  margin: 0;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: fit-content;
}

.deliverable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.deliverable-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.deliverable-title-section {
  flex: 1;
  min-width: 0;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.type-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.deliverable-badges {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
  flex-shrink: 0;
}

.type-badge,
.version-badge {
  font-size: 0.7rem;
  font-weight: 600;
}

.deliverable-preview {
  margin-bottom: 1rem;
}

.content-preview {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.deliverable-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.meta-item ion-icon {
  font-size: 1rem;
}

.deliverable-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.tag-chip {
  font-size: 0.75rem;
  height: 1.5rem;
}

.deliverable-actions {
  display: flex;
  gap: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ion-color-step-150);
  flex-wrap: wrap;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .deliverables-container {
    padding: 0.5rem;
  }
  
  .deliverables-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-controls ion-select {
    min-width: auto;
  }
  
  .deliverable-actions {
    flex-direction: column;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .deliverable-card:hover {
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
  }
  
  .deliverable-actions {
    border-top-color: var(--ion-color-step-200);
  }
}
</style>