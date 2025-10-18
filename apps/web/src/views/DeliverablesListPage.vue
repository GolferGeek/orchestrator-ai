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
                      <span class="type-icon">{{ getTypeIcon(deliverable.type as string) }}</span>
                      <ion-card-title>{{ deliverable.title }}</ion-card-title>
                    </div>
                  </div>
                  <div class="deliverable-badges">
                    <ion-badge 
                      :color="getTypeColor(deliverable.type as string)"
                      class="type-badge"
                    >
                      {{ getTypeName(deliverable.type as string) }}
                    </ion-badge>
                    <ion-badge 
                      v-if="getVersionNumber(deliverable) > 1"
                      color="medium"
                      class="version-badge"
                    >
                      v{{ getVersionNumber(deliverable) }}
                    </ion-badge>
                  </div>
                </div>
              </ion-card-header>
              <ion-card-content>
                <div class="image-preview" v-if="getImageAssets(deliverable).length">
                  <div class="thumb-grid">
                    <img
                      v-for="(img, idx) in getImageAssets(deliverable).slice(0,3)"
                      :key="idx"
                      class="thumb"
                      :src="img.thumbnailUrl || img.url"
                      :alt="img.altText || 'image'"
                      @click.stop="openImage(img)"
                    />
                    <div v-if="getImageAssets(deliverable).length > 3" class="more-overlay">+{{ getImageAssets(deliverable).length - 3 }}</div>
                  </div>
                </div>
                <div class="deliverable-preview" v-else>
                  <p class="content-preview">{{ getContentPreview(getDeliverableContent(deliverable)) }}</p>
                </div>
                <div class="deliverable-meta">
                  <div class="meta-item" v-if="getCreatedByAgent(deliverable)">
                    <ion-icon :icon="sparklesOutline"></ion-icon>
                    <span>{{ getCreatedByAgent(deliverable) }}</span>
                  </div>
                  <div class="meta-item">
                    <ion-icon :icon="calendarOutline"></ion-icon>
                    <span>{{ formatDate(deliverable.createdAt) }}</span>
                  </div>
                </div>
                <div class="deliverable-tags" v-if="getDeliverableTags(deliverable).length > 0">
                  <ion-chip 
                    v-for="tag in getDeliverableTags(deliverable).slice(0, 3)" 
                    :key="tag"
                    color="primary"
                    outline
                    class="tag-chip"
                  >
                    <ion-label>{{ tag }}</ion-label>
                  </ion-chip>
                  <ion-chip 
                    v-if="getDeliverableTags(deliverable).length > 3"
                    color="medium"
                    outline
                    class="tag-chip"
                  >
                    <ion-label>+{{ getDeliverableTags(deliverable).length - 3 }}</ion-label>
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
                    v-if="getVersionNumber(deliverable) > 1 || hasVersions(deliverable.id)"
                    fill="clear" 
                    size="small"
                    color="secondary"
                    @click.stop="viewVersions(deliverable)"
                  >
                    <ion-icon :icon="gitBranchOutline" slot="start"></ion-icon>
                    Versions ({{ getVersionNumber(deliverable) }})
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
    <!-- Versions Modal -->
    <ion-modal :is-open="showVersionsModal" @will-dismiss="hideVersionsModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Version History</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="hideVersionsModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div v-if="isLoadingVersions" class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading versions...</p>
        </div>
        <div v-else-if="versions.length === 0" class="no-versions">
          <p>No versions found</p>
        </div>
        <div v-else class="versions-list">
          <ion-card 
            v-for="version in versions" 
            :key="version.id"
            class="version-card"
            :class="{ 'latest-version': version.isCurrentVersion }"
          >
            <ion-card-header>
              <ion-card-title>Version {{ version.versionNumber }}</ion-card-title>
              <ion-card-subtitle>
                <div class="version-meta">
                  <ion-chip :color="version.isCurrentVersion ? 'primary' : 'medium'">
                    <ion-icon :icon="gitBranchOutline" />
                    <ion-label>v{{ version.versionNumber }}</ion-label>
                  </ion-chip>
                  <ion-chip v-if="version.isCurrentVersion" color="success">
                    <ion-icon :icon="checkmarkOutline" />
                    <ion-label>Current</ion-label>
                  </ion-chip>
                  <ion-chip color="light">
                    <ion-icon :icon="timeOutline" />
                    <ion-label>{{ formatDate(version.createdAt) }}</ion-label>
                  </ion-chip>
                  <ion-chip v-if="version.metadata?.createdByAgent" color="secondary">
                    <ion-icon :icon="personOutline" />
                    <ion-label>{{ version.metadata.createdByAgent }}</ion-label>
                  </ion-chip>
                </div>
              </ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p class="content-preview">{{ getContentPreview(version.content || '') }}</p>
              <div class="version-actions">
                <ion-button 
                  fill="outline" 
                  size="small"
                  @click="viewVersion(version.id)"
                >
                  <ion-icon :icon="eyeOutline" slot="start" />
                  View
                </ion-button>
                <ion-button 
                  v-if="!version.isCurrentVersion"
                  fill="solid" 
                  size="small"
                  color="primary"
                  @click="makeCurrentVersion(version)"
                >
                  <ion-icon :icon="checkmarkCircleOutline" slot="start" />
                  Make Current
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </ion-content>
    </ion-modal>
    <!-- New Deliverable Dialog -->
    <NewDeliverableDialog
      :is-open="showNewDeliverableDialog"
      @dismiss="showNewDeliverableDialog = false"
      @created="handleDeliverableCreated"
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
  IonModal,
  alertController,
  toastController,
} from '@ionic/vue';
import {
  addOutline,
  documentOutline,
  alertCircleOutline,
  refreshOutline,
  sparklesOutline,
  calendarOutline,
  eyeOutline,
  createOutline,
  gitBranchOutline,
  trashOutline,
  chevronDownOutline,
  closeOutline,
  timeOutline,
  checkmarkOutline,
  checkmarkCircleOutline,
  personOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useDeliverables } from '@/composables/useDeliverables';
import { DeliverableType, type Deliverable, deliverablesService } from '@/services/deliverablesService';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { deleteDeliverable as deleteDeliverableAction, setCurrentVersion } from '@/services/agent2agent/actions';
import NewDeliverableDialog from '@/components/NewDeliverableDialog.vue';
const router = useRouter();
const deliverables = useDeliverables();
const deliverablesStore = useDeliverablesStore();
// Reactive state
const searchQuery = ref('');
const typeFilter = ref('');
const sortBy = ref('created_desc');
const isLoadingMore = ref(false);
const currentOffset = ref(0);
const pageSize = 20;
// Versions modal state
const showVersionsModal = ref(false);
const versions = ref<Record<string, unknown>[]>([]);
const isLoadingVersions = ref(false);
const selectedDeliverableId = ref<string | null>(null);
// Computed properties
const displayedDeliverables = computed(() => {
  let filtered = deliverables.recentDeliverables.value.map((d: Record<string, unknown>) => d);
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(deliverable => 
      deliverable.title.toLowerCase().includes(query) ||
      getDeliverableContent(deliverable).toLowerCase().includes(query) ||
      getDeliverableTags(deliverable)?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  }
  // Apply type filter
  if (typeFilter.value) {
    filtered = filtered.filter(deliverable => 
      deliverable.type === typeFilter.value
    );
  }
  // Apply sorting
  const [sortField, sortOrder] = sortBy.value.split('_');
  filtered.sort((a, b) => {
    let aValue: unknown, bValue: unknown;
    switch (sortField) {
      case 'created':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'updated':
        aValue = new Date(a.updatedAt || a.createdAt).getTime();
        bValue = new Date(b.updatedAt || b.createdAt).getTime();
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'type':
        aValue = a.type;
        bValue = b.type;
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
    deliverablesStore.setLoading(true);
    deliverablesStore.clearError();

    const result = await deliverablesService.getDeliverables({
      limit: 100,
      offset: 0,
      latestOnly: true,
    });

    // Clear existing
    deliverablesStore.clearAll();

    // Fetch full deliverable objects
    const deliverablePromises = result.items.map(async (searchItem) => {
      try {
        return await deliverablesService.getDeliverable(searchItem.id);
      } catch (error) {
        console.error(`Failed to load deliverable ${searchItem.id}:`, error);
        return null;
      }
    });

    const loadedDeliverables = (await Promise.all(deliverablePromises)).filter(Boolean) as Deliverable[];

    // Update store
    loadedDeliverables.forEach((deliverable) => {
      deliverablesStore.addDeliverable(deliverable);
    });
  } catch (err: unknown) {
    console.error('Failed to load deliverables:', err);
    deliverablesStore.setError(err.message);
  } finally {
    deliverablesStore.setLoading(false);
  }
};
const handleRefresh = async (event: CustomEvent) => {
  await loadDeliverables();
  event.detail.complete();
};
const handleSearch = async () => {
  if (searchQuery.value.trim()) {
    await deliverables.search(searchQuery.value, {
      type: typeFilter.value as string || undefined,
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
      type: typeFilter.value as string || undefined,
      limit: pageSize,
      offset: 0
    });
  } else {
    await loadDeliverables();
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
        type: typeFilter.value as string || undefined,
        limit: pageSize,
        offset: newOffset
      });
    } else {
      await loadDeliverables();
    }
    currentOffset.value = newOffset;
  } finally {
    isLoadingMore.value = false;
  }
};
const showNewDeliverableDialog = ref(false);
const createNewDeliverable = () => {
  showNewDeliverableDialog.value = true;
};
const handleDeliverableCreated = (_deliverableId: string) => {
  // Refresh the deliverables list
  loadDeliverables();
  showNewDeliverableDialog.value = false;
};

function getImageAssets(deliverable: Record<string, unknown>) {
  try {
    const current = deliverablesStore.getCurrentVersion(deliverable.id);
    const images = (current?.fileAttachments?.images || []) as string[];
    return Array.isArray(images) ? images : [];
  } catch {
    return [];
  }
}
function openImage(img: Record<string, unknown>) {
  try {
    window.open(img.url, '_blank');
  } catch {}
}
const viewDeliverable = async (deliverable: Record<string, unknown>) => {
  // Create a viewing conversation for this deliverable
  try {
    deliverablesStore.setLoading(true);

    // Create conversation with "view" intent
    const result = await deliverablesService.createEditingConversation(
      deliverable.id,
      {
        action: 'discuss',
        agentName: deliverable.agentName || 'blog_post', // Fallback to blog post writer
        initialMessage: `Please show me this deliverable: "${deliverable.title}"`
      }
    );

    // Update store with new conversation link
    const updatedDeliverable = deliverablesStore.getDeliverableById(deliverable.id);
    if (updatedDeliverable) {
      updatedDeliverable.conversationId = result.conversationId;
      deliverablesStore.addDeliverable(updatedDeliverable);
    }

    deliverablesStore.setLoading(false);
    // Navigate to split view with conversation and deliverable
    await router.push({
      name: 'Home',
      query: {
        conversationId: result.conversationId,
        deliverableId: deliverable.id,
        mode: 'view'
      }
    });
  } catch (error) {

    // Show error toast
    const toast = await toastController.create({
      message: 'Failed to open deliverable: ' + error.message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
};
const editDeliverable = async (deliverable: Record<string, unknown>) => {
  try {
    // Create editing conversation for this deliverable
    const result = await deliverablesService.createEditingConversation(
      deliverable.id,
      {
        action: 'edit',
        agentName: deliverable.agentName || 'blog_post', // Fallback to blog post writer
        initialMessage: `I want to edit this deliverable: "${deliverable.title}"`
      }
    );
    // Navigate to split view with conversation and deliverable
    await router.push({
      name: 'Home',
      query: {
        conversationId: result.conversationId,
        deliverableId: deliverable.id,
        mode: 'edit'
      }
    });
  } catch (err: unknown) {

    // Show error toast
    const toast = await toastController.create({
      message: 'Failed to start editing: ' + err.message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
};
const viewVersions = async (deliverable: Record<string, unknown>) => {
  try {
    isLoadingVersions.value = true;
    selectedDeliverableId.value = deliverable.id;
    showVersionsModal.value = true;

    // Load versions from service
    const versionList = await deliverablesService.getVersionHistory(deliverable.id);

    // Update store
    versionList.forEach(version => {
      deliverablesStore.addVersion(deliverable.id, version);
    });

    versions.value = versionList;
  } catch (err) {
    console.error('Failed to load versions:', err);
  } finally {
    isLoadingVersions.value = false;
  }
};
const confirmDelete = async (deliverable: Record<string, unknown>) => {
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
const deleteDeliverable = async (deliverable: Record<string, unknown>) => {
  try {
    await deleteDeliverableAction(
      deliverable.agentName || 'blog_post_writer',
      deliverable.id
    );
    // Show success toast
    const toast = await toastController.create({
      message: 'Deliverable deleted successfully',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    // Refresh the list
    await loadDeliverables();
  } catch {

    // Show error toast
    const toast = await toastController.create({
      message: 'Failed to delete deliverable',
      duration: 2000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
};
// Helper functions for new data structure
const getVersionNumber = (deliverable: Record<string, unknown>): number => {
  return deliverable.currentVersion?.versionNumber || 1;
};
const getDeliverableContent = (deliverable: Record<string, unknown>): string => {
  return deliverable.currentVersion?.content || '';
};
const getCreatedByAgent = (deliverable: Record<string, unknown>): string | null => {
  return deliverable.currentVersion?.metadata?.createdByAgent || null;
};
const getDeliverableTags = (deliverable: Record<string, unknown>): string[] => {
  return deliverable.currentVersion?.metadata?.tags || [];
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
  // Check if there are cached versions for this deliverable
  const deliverable = deliverablesStore.getDeliverableById(deliverableId);
  return deliverable ? getVersionNumber(deliverable) > 1 : false;
};
const hideVersionsModal = () => {
  showVersionsModal.value = false;
  versions.value = [];
  selectedDeliverableId.value = null;
};
const viewVersion = async (_versionId: string) => {
  try {
    // Navigate to view the specific version
    // TODO: Implement navigation to version view
    // router.push(`/deliverables/version/${versionId}`);
    hideVersionsModal();
  } catch {

  }
};
const makeCurrentVersion = async (version: Record<string, unknown>) => {
  try {
    // Show confirmation dialog
    const alert = await alertController.create({
      header: 'Make Current Version',
      message: `Are you sure you want to make version ${version.versionNumber} the current version? This will change which version is displayed by default.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Make Current',
          role: 'confirm',
          handler: async () => {
            try {
              // Get deliverable to find agentSlug
              const deliverable = deliverablesStore.getDeliverableById(selectedDeliverableId.value!);
              if (!deliverable) throw new Error('Deliverable not found');

              // Set the selected version as the current version using action
              await setCurrentVersion(
                deliverable.agentName || 'blog_post_writer',
                selectedDeliverableId.value!,
                version.id
              );

              // Refresh the deliverables list to show the new current version
              await loadDeliverables();

              // Refresh the versions list in the modal
              const versionList = await deliverablesService.getVersionHistory(selectedDeliverableId.value!);
              versionList.forEach(v => {
                deliverablesStore.addVersion(selectedDeliverableId.value!, v);
              });
              versions.value = versionList;
              // Show success toast
              const toast = await toastController.create({
                message: `Version ${version.versionNumber} is now the current version`,
                duration: 3000,
                position: 'bottom',
                color: 'success'
              });
              await toast.present();
            } catch {

              // Show error toast
              const toast = await toastController.create({
                message: 'Failed to set current version. Please try again.',
                duration: 3000,
                position: 'bottom',
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  } catch {

  }
};
// Watchers
watch(() => deliverables.error.value, (newError) => {
  if (newError) {

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
.image-preview {
  margin-bottom: 1rem;
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
}
.more-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 6px;
  font-weight: 600;
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
/* Versions Modal Styles */
.versions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.version-card {
  margin: 0;
}
.version-card.latest-version {
  border-left: 4px solid var(--ion-color-success);
  background: var(--ion-color-success-tint);
}
.version-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.version-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: flex-end;
}
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
}
.no-versions {
  text-align: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}
</style>
