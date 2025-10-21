<template>
  <div class="version-management-panel">
    <!-- Action Buttons -->
    <div class="version-actions">
      <ion-button
        @click="createNewVersion"
        fill="outline"
        size="small"
        color="primary"
      >
        <ion-icon :icon="addOutline" slot="start" />
        New Version from Task
      </ion-button>
      <ion-button
        @click="showMergeDialog = true"
        fill="outline"
        size="small"
        color="secondary"
        :disabled="versions.length < 2"
      >
        <ion-icon :icon="gitMergeOutline" slot="start" />
        Merge Versions
      </ion-button>
    </div>
    <!-- Version Selection List -->
    <div class="version-list" v-if="versions.length > 0">
      <div class="list-header">
        <h4>Select Versions</h4>
        <ion-button 
          fill="clear" 
          size="small" 
          @click="clearSelection"
          v-if="selectedVersions.length > 0"
        >
          Clear Selection
        </ion-button>
      </div>
      <div 
        v-for="version in sortedVersions"
        :key="version.id"
        class="version-item"
        :class="{
          'current': version.isCurrentVersion,
          'selected': selectedVersions.includes(version.id)
        }"
        @click="toggleVersionSelection(version.id)"
      >
        <ion-checkbox
          :checked="selectedVersions.includes(version.id)"
          :disabled="version.isCurrentVersion && isDeleteMode"
          @click.stop="toggleVersionSelection(version.id)"
        />
        <div class="version-info">
          <div class="version-header">
            <span class="version-number">v{{ version.versionNumber }}</span>
            <ion-chip v-if="version.isCurrentVersion" color="success" size="small">
              Current
            </ion-chip>
          </div>
          <div class="version-meta">
            <span class="version-date">{{ formatDate(version.createdAt) }}</span>
            <span class="version-type">{{ getVersionTypeLabel(version.createdByType) }}</span>
          </div>
          <div class="version-preview">
            {{ getContentPreview(version.content) }}
          </div>
        </div>
        <ion-button
          v-if="!version.isCurrentVersion"
          fill="clear"
          size="small"
          color="primary"
          @click.stop="copySpecificVersion(version.id)"
          class="delete-single-btn"
          style="right: 44px;"
        >
          Copy
        </ion-button>
        <ion-button
          v-if="!version.isCurrentVersion"
          fill="clear"
          size="small"
          color="danger"
          @click.stop="deleteVersion(version.id)"
          class="delete-single-btn"
        >
          <ion-icon :icon="trashOutline" />
        </ion-button>
      </div>
    </div>
    <!-- Empty State -->
    <div v-else class="empty-state">
      <ion-icon :icon="documentTextOutline" />
      <p>No versions available</p>
    </div>
    <!-- Delete Confirmation Dialog -->
    <ion-alert
      :is-open="showDeleteDialog"
      header="Delete Selected Versions"
      :message="deleteConfirmationMessage"
      :buttons="deleteAlertButtons"
      @didDismiss="showDeleteDialog = false"
    />
    <!-- Merge Versions Dialog -->
    <ion-modal :is-open="showMergeDialog" @will-dismiss="showMergeDialog = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Merge Versions</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showMergeDialog = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="merge-dialog-content">
        <div class="merge-instructions">
          <h4>Select versions to merge:</h4>
          <div class="merge-version-list">
            <ion-item v-for="version in versions" :key="version.id">
              <ion-checkbox
                :checked="mergeSelectedVersions.includes(version.id)"
                @ionChange="toggleMergeSelection(version.id)"
              />
              <ion-label>
                <h3>Version {{ version.versionNumber }}</h3>
                <p>{{ formatDate(version.createdAt) }}</p>
                <p class="content-preview">{{ getContentPreview(version.content) }}</p>
              </ion-label>
            </ion-item>
          </div>
          <div class="merge-prompt-section">
            <h4>Merge Instructions:</h4>
            <ion-textarea
              v-model="mergePrompt"
              placeholder="Enter instructions for how to merge these versions (e.g., 'keep the intro from version 1 and technical details from version 3')..."
              :rows="3"
            />
          </div>
          <div class="merge-actions">
            <ion-button
              @click="executeMerge"
              :disabled="mergeSelectedVersions.length < 2 || !mergePrompt.trim()"
              color="primary"
            >
              <ion-icon :icon="gitMergeOutline" slot="start" />
              Merge Versions
            </ion-button>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonButton,
  IonIcon,
  IonCheckbox,
  IonChip,
  IonAlert,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonItem,
  IonLabel,
  IonTextarea,
} from '@ionic/vue';
import {
  addOutline,
  trashOutline,
  gitMergeOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { useContextStore } from '@/stores/contextStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import type { DeliverableVersion } from '@/services/deliverablesService';
// Props
interface Props {
  deliverableId: string;
  versions: DeliverableVersion[];
  currentVersionId?: string;
  agentSlug?: string;
}
const props = defineProps<Props>();
// Stores
const contextStore = useContextStore();
const chatUiStore = useChatUiStore();
// Reactive state
const selectedVersions = ref<string[]>([]);
const mergeSelectedVersions = ref<string[]>([]);
const showDeleteDialog = ref(false);
const showMergeDialog = ref(false);
const mergePrompt = ref('');
const isDeleteMode = ref(false);
// Computed properties
const sortedVersions = computed(() => 
  [...props.versions].sort((a, b) => b.versionNumber - a.versionNumber)
);
const isCurrentVersionSelected = computed(() => 
  selectedVersions.value.includes(props.currentVersionId || '')
);
const deleteConfirmationMessage = computed(() => {
  const count = selectedVersions.value.length;
  if (count === 1) {
    return 'Are you sure you want to delete this version? This action cannot be undone.';
  }
  return `Are you sure you want to delete ${count} versions? This action cannot be undone.`;
});
const deleteAlertButtons = computed(() => [
  {
    text: 'Cancel',
    role: 'cancel',
    handler: () => {
      showDeleteDialog.value = false;
    }
  },
  {
    text: 'Delete',
    role: 'destructive',
    handler: () => {
      executeDelete();
    }
  }
]);
// Methods
const toggleVersionSelection = (versionId: string) => {
  const index = selectedVersions.value.indexOf(versionId);
  if (index >= 0) {
    selectedVersions.value.splice(index, 1);
  } else {
    selectedVersions.value.push(versionId);
  }
};
const toggleMergeSelection = (versionId: string) => {
  const index = mergeSelectedVersions.value.indexOf(versionId);
  if (index >= 0) {
    mergeSelectedVersions.value.splice(index, 1);
  } else {
    mergeSelectedVersions.value.push(versionId);
  }
};
const clearSelection = () => {
  selectedVersions.value = [];
};
const createNewVersion = () => {
  // Set deliverable context and focus the prompt input
  contextStore.setDeliverableContext(props.deliverableId);
  // The context-aware prompt input will now be in deliverable mode
  // User can type their modification request there
};
const deleteVersion = async (versionId: string) => {
  if (!props.deliverableId || !props.agentSlug) {
    console.error('Missing deliverableId or agentSlug');
    return;
  }

  try {
    const { deleteVersion: deleteVersionAction } = await import('@/services/agent2agent/actions');
    await deleteVersionAction(props.agentSlug, props.deliverableId, versionId);

    // Show success toast
    const { toastController } = await import('@ionic/vue');
    const toast = await toastController.create({
      message: `Version ${getVersionNumber(versionId)} deleted`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Failed to delete version:', error);
    const { toastController } = await import('@ionic/vue');
    const toast = await toastController.create({
      message: `Failed to delete version: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
};
const copySpecificVersion = async (versionId: string) => {
  try {
    const { useDeliverablesStore } = await import('@/stores/deliverablesStore');
    const store = useDeliverablesStore();
    const newVersion = await store.copyVersion(versionId);
    try {
      const { toastController } = await import('@ionic/vue');
      const oldNum = getVersionNumber(versionId);
      const msg = oldNum
        ? `Copied v${oldNum} → v${newVersion.versionNumber}`
        : `Copied to v${newVersion.versionNumber}`;
      const toast = await toastController.create({ message: msg, duration: 2000, color: 'success' });
      await toast.present();
    } catch {
      // Ignore toast errors
    }
  } catch (e) {
    console.warn('Failed to copy version', e);
  }
};
const executeMerge = async () => {
  if (mergeSelectedVersions.value.length < 2 || !mergePrompt.value.trim()) return;

  try {
    const { default: deliverablesService } = await import('@/services/deliverablesService');

    // Call the merge API directly
    const result = await deliverablesService.mergeVersions(
      props.deliverableId,
      mergeSelectedVersions.value,
      mergePrompt.value
    );

    // Show success toast
    try {
      const { toastController } = await import('@ionic/vue');
      const toast = await toastController.create({
        message: `Successfully merged ${mergeSelectedVersions.value.length} versions into v${result.newVersion.versionNumber}`,
        duration: 3000,
        color: 'success',
      });
      await toast.present();
    } catch {
      // Ignore toast errors
    }

    // Emit event to refresh versions list
    // The parent component should be listening for this and refresh the deliverable data
    window.dispatchEvent(new CustomEvent('deliverable-updated', {
      detail: { deliverableId: props.deliverableId }
    }));

  } catch (error) {
    console.error('Failed to merge versions:', error);
    try {
      const { toastController } = await import('@ionic/vue');
      const toast = await toastController.create({
        message: error instanceof Error ? error.message : 'Failed to merge versions',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } catch {
      // Ignore toast errors
    }
  } finally {
    mergeSelectedVersions.value = [];
    mergePrompt.value = '';
    showMergeDialog.value = false;
  }
};
// Helper methods
const getVersionNumber = (versionId: string): number => {
  const version = props.versions.find(v => v.id === versionId);
  return version?.versionNumber || 0;
};
const getVersionTypeLabel = (type: string): string => {
  switch (type) {
    case 'conversation_task':
      return 'Task-Based';
    case 'conversation_merge':
      return 'Merged';
    case 'ai_response':
      return 'AI Generated';
    case 'manual_edit':
      return 'Manual Edit';
    default:
      return 'Standard';
  }
};
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};
const getContentPreview = (content?: string): string => {
  if (!content) return 'No content';
  return content.length > 100 ? content.substring(0, 100) + '...' : content;
};
</script>
<style scoped>
.version-management-panel {
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
}
.version-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.list-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.version-list {
  max-height: 300px;
  overflow-y: auto;
}
.version-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}
.version-item:hover {
  background: var(--ion-color-light-tint);
}
.version-item.selected {
  background: var(--ion-color-primary-tint);
  border-color: var(--ion-color-primary);
}
.version-item.current {
  border-color: var(--ion-color-success);
  background: var(--ion-color-success-tint);
}
.version-info {
  flex: 1;
}
.version-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.version-number {
  font-weight: 600;
  font-size: 14px;
}
.version-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--ion-color-medium);
}
.version-preview {
  font-size: 12px;
  color: var(--ion-color-dark);
  line-height: 1.4;
}
.delete-single-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}
.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--ion-color-medium);
}
.empty-state ion-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.merge-dialog-content {
  padding: 16px;
}
.merge-instructions h4 {
  margin: 16px 0 8px 0;
}
.merge-version-list {
  margin-bottom: 16px;
}
.merge-prompt-section {
  margin-bottom: 16px;
}
.merge-actions {
  display: flex;
  justify-content: flex-end;
}
.content-preview {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
/* Responsive design */
@media (max-width: 768px) {
  .version-actions {
    flex-direction: column;
  }
  .version-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
