<template>
  <ion-modal :is-open="isOpen" @will-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ displayTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            v-if="isEditing"
            @click="saveChanges"
            :disabled="!hasChanges"
            fill="solid"
            color="primary"
          >
            <ion-icon :icon="saveOutline" slot="start" />
            Save
          </ion-button>
          <ion-button 
            v-if="!isEditing && canEdit"
            @click="startEditing" 
            fill="clear"
          >
            <ion-icon :icon="createOutline" />
          </ion-button>
          <ion-button @click="handleClose">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Edit Mode -->
      <div v-if="isEditing" class="deliverable-edit">
        <ion-item>
          <ion-label position="stacked">Title</ion-label>
          <ion-input 
            v-model="editForm.title" 
            placeholder="Enter deliverable title"
          ></ion-input>
        </ion-item>
        
        <ion-item v-if="canEdit">
          <ion-label position="stacked">Description</ion-label>
          <ion-textarea 
            v-model="editForm.description" 
            placeholder="Optional description"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Content</ion-label>
          <ion-textarea 
            v-model="editForm.content" 
            placeholder="Enter content"
            :rows="15"
            class="content-textarea"
          ></ion-textarea>
        </ion-item>

        <div v-if="canEdit" class="edit-actions">
          <ion-button @click="cancelEditing" fill="outline" color="medium">
            Cancel
          </ion-button>
          <ion-button @click="saveChanges" :disabled="!hasChanges" fill="solid">
            Save Changes
          </ion-button>
        </div>
      </div>

      <!-- View Mode -->
      <div v-else-if="displayDeliverable" class="deliverable-content">
        <div class="deliverable-header">
          <div class="deliverable-meta">
            <ion-chip :color="getTypeColor(getDeliverableType(displayDeliverable))">
              <ion-icon :icon="getTypeIcon(getDeliverableType(displayDeliverable))" />
              <ion-label>{{ getDeliverableType(displayDeliverable).toUpperCase() }}</ion-label>
            </ion-chip>
            <ion-chip color="medium">
              <ion-icon :icon="documentOutline" />
              <ion-label>{{ (displayDeliverable.format).toUpperCase() }}</ion-label>
            </ion-chip>
            <ion-chip color="light">
              <ion-icon :icon="timeOutline" />
              <ion-label>{{ formatDate(getDeliverableDate(displayDeliverable)) }}</ion-label>
            </ion-chip>
            <ion-chip v-if="getVersionNumber(displayDeliverable) > 1" color="secondary">
              <ion-icon :icon="gitBranchOutline" />
              <ion-label>v{{ getVersionNumber(displayDeliverable) }}</ion-label>
            </ion-chip>
          </div>
          
          <div class="deliverable-actions">
            <ion-button 
              v-if="isDownloadable(displayDeliverable)" 
              fill="outline" 
              @click="downloadDeliverable"
            >
              <ion-icon :icon="downloadOutline" slot="start" />
              Download
            </ion-button>
            <ion-button fill="outline" @click="copyToClipboard">
              <ion-icon :icon="copyOutline" slot="start" />
              Copy
            </ion-button>
            <ion-button 
              v-if="canEdit && hasId(displayDeliverable)"
              fill="outline" 
              @click="enhanceDeliverable"
              color="success"
            >
              <ion-icon :icon="sparklesOutline" slot="start" />
              Enhance
            </ion-button>
          </div>
        </div>

        <div class="deliverable-body">
          <div 
            v-if="displayDeliverable.format === 'markdown'" 
            class="markdown-content"
            v-html="renderedMarkdown"
          ></div>
          <div 
            v-else-if="displayDeliverable.format === 'html'" 
            class="html-content"
            v-html="displayDeliverable.content"
          ></div>
          <pre 
            v-else-if="displayDeliverable.format === 'json'" 
            class="json-content"
          >{{ formattedJson }}</pre>
          <div 
            v-else 
            class="text-content"
          >{{ displayDeliverable.content }}</div>
        </div>

        <!-- Tags -->
        <div v-if="getTags(displayDeliverable).length > 0" class="deliverable-tags">
          <h4>Tags</h4>
          <div class="tags-container">
            <ion-chip 
              v-for="tag in getTags(displayDeliverable)" 
              :key="tag"
              color="primary"
              outline
            >
              <ion-label>{{ tag }}</ion-label>
            </ion-chip>
          </div>
        </div>

        <!-- Metadata -->
        <div v-if="displayDeliverable.metadata && Object.keys(displayDeliverable.metadata).length > 0" class="deliverable-metadata">
          <h4>Metadata</h4>
          <div class="metadata-grid">
            <div 
              v-for="(value, key) in displayDeliverable.metadata" 
              :key="key"
              class="metadata-item"
            >
              <span class="metadata-key">{{ formatMetadataKey(key) }}</span>
              <span class="metadata-value">{{ formatMetadataValue(value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits, ref, watch } from 'vue';
import { marked } from 'marked';
import { 
  IonModal, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonButton, 
  IonIcon, 
  IonContent,
  IonChip,
  IonLabel,
  IonItem,
  IonInput,
  IonTextarea,
  toastController
} from '@ionic/vue';
import { 
  closeOutline,
  downloadOutline,
  copyOutline,
  documentOutline,
  timeOutline,
  documentTextOutline,
  analyticsOutline,
  clipboardOutline,
  constructOutline,
  listOutline,
  createOutline,
  saveOutline,
  sparklesOutline,
  gitBranchOutline
} from 'ionicons/icons';
import { useDeliverables } from '@/composables/useDeliverables';
import type { Deliverable } from '@/types/deliverables';

// Legacy interface for backward compatibility
interface WorkflowDeliverable {
  id?: string;
  title: string;
  content: string;
  deliverableType: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  format: 'markdown' | 'text' | 'json' | 'html';
  metadata?: Record<string, any>;
  downloadable?: boolean;
  timestamp: Date;
  tags?: string[];
  version?: number;
  created_at?: string;
}

// Union type for both new and legacy deliverables
type DeliverableItem = Deliverable | WorkflowDeliverable;

const props = defineProps<{
  isOpen: boolean;
  deliverable?: DeliverableItem;
  mode?: 'view' | 'edit' | 'create';
}>();

const emit = defineEmits<{
  close: [];
  download: [deliverable: DeliverableItem];
  save: [deliverable: Partial<Deliverable>];
  enhance: [deliverable: Deliverable];
}>();

const deliverables = useDeliverables();

// Edit state
const isEditing = ref(false);
const editForm = ref({
  title: '',
  content: '',
  description: ''
});

// Computed properties
const displayDeliverable = computed(() => props.deliverable);
const displayTitle = computed(() => {
  if (isEditing.value) {
    return editForm.value.title || 'Edit Deliverable';
  }
  return displayDeliverable.value?.title || 'Deliverable';
});

const canEdit = computed(() => {
  // Can edit if it's a new Deliverable (has id) or if we're creating
  return !!(displayDeliverable.value && hasId(displayDeliverable.value)) || props.mode === 'create';
});

const hasChanges = computed(() => {
  if (!displayDeliverable.value) return false;
  return editForm.value.title !== displayDeliverable.value.title ||
         editForm.value.content !== displayDeliverable.value.content ||
         editForm.value.description !== (displayDeliverable.value as Deliverable).description;
});

const renderedMarkdown = computed(() => {
  const content = isEditing.value ? editForm.value.content : displayDeliverable.value?.content;
  const format = displayDeliverable.value?.format;
  if (!content || format !== 'markdown') return '';
  return marked.parse(content, { breaks: true, gfm: true });
});

const formattedJson = computed(() => {
  const content = isEditing.value ? editForm.value.content : displayDeliverable.value?.content;
  const format = displayDeliverable.value?.format;
  if (!content || format !== 'json') return '';
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
});

// Watchers
watch(() => props.deliverable, (newDeliverable) => {
  if (newDeliverable) {
    resetEditForm();
  }
});

watch(() => props.mode, (newMode) => {
  if (newMode === 'edit' || newMode === 'create') {
    startEditing();
  } else {
    isEditing.value = false;
  }
});

// Methods
const resetEditForm = () => {
  if (displayDeliverable.value) {
    editForm.value = {
      title: displayDeliverable.value.title || '',
      content: displayDeliverable.value.content || '',
      description: 'description' in displayDeliverable.value ? displayDeliverable.value.description || '' : ''
    };
  }
};

const startEditing = () => {
  resetEditForm();
  isEditing.value = true;
};

const cancelEditing = () => {
  resetEditForm();
  isEditing.value = false;
};

const handleClose = () => {
  if (isEditing.value && hasChanges.value) {
    // Show confirmation dialog
    const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
    if (!confirmClose) return;
  }
  
  isEditing.value = false;
  emit('close');
};

const saveChanges = async () => {
  if (!hasChanges.value || !displayDeliverable.value) return;
  
  try {
    const updates = {
      title: editForm.value.title,
      content: editForm.value.content,
      description: editForm.value.description
    };
    
    if ('id' in displayDeliverable.value && displayDeliverable.value.id) {
      // Update existing deliverable
      await deliverables.store.updateDeliverable(displayDeliverable.value.id, updates);
      
      const toast = await toastController.create({
        message: 'Deliverable updated successfully',
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    } else if (props.mode === 'create') {
      // Create new deliverable
      emit('save', updates);
    }
    
    isEditing.value = false;
  } catch (error) {
    const toast = await toastController.create({
      message: 'Failed to save deliverable',
      duration: 2000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
};

const enhanceDeliverable = () => {
  if (displayDeliverable.value && 'id' in displayDeliverable.value) {
    emit('enhance', displayDeliverable.value as Deliverable);
    emit('close');
  }
};

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'document':
      return 'primary';
    case 'analysis':
      return 'secondary';
    case 'report':
      return 'tertiary';
    case 'plan':
      return 'success';
    case 'requirements':
      return 'warning';
    default:
      return 'medium';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'document':
      return documentTextOutline;
    case 'analysis':
      return analyticsOutline;
    case 'report':
      return clipboardOutline;
    case 'plan':
      return constructOutline;
    case 'requirements':
      return listOutline;
    default:
      return documentOutline;
  }
};

const formatDate = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
};

const formatMetadataKey = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const formatMetadataValue = (value: any): string => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const downloadDeliverable = () => {
  if (!displayDeliverable.value) return;
  
  const content = isEditing.value ? editForm.value.content : displayDeliverable.value.content;
  const title = isEditing.value ? editForm.value.title : displayDeliverable.value.title;
  
  const blob = new Blob([content], { 
    type: getContentType(displayDeliverable.value.format) 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.${getFileExtension(displayDeliverable.value.format)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  emit('download', displayDeliverable.value);
};

const copyToClipboard = async () => {
  if (!displayDeliverable.value) return;
  
  const content = isEditing.value ? editForm.value.content : displayDeliverable.value.content;
  
  try {
    await navigator.clipboard.writeText(content);
    const toast = await toastController.create({
      message: 'Content copied to clipboard',
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: 'Failed to copy content',
      duration: 2000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
};

const getContentType = (format: string): string => {
  switch (format) {
    case 'markdown':
      return 'text/markdown';
    case 'html':
      return 'text/html';
    case 'json':
      return 'application/json';
    default:
      return 'text/plain';
  }
};

const getFileExtension = (format: string): string => {
  switch (format) {
    case 'markdown':
      return 'md';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    default:
      return 'txt';
  }
};

// Helper functions for type compatibility
const getDeliverableType = (deliverable: DeliverableItem): string => {
  return ('deliverable_type' in deliverable) 
    ? deliverable.deliverable_type 
    : deliverable.deliverableType;
};

const getDeliverableDate = (deliverable: DeliverableItem): Date | string => {
  return ('created_at' in deliverable) 
    ? deliverable.created_at || new Date()
    : deliverable.timestamp;
};

const getVersionNumber = (deliverable: DeliverableItem): number => {
  return deliverable.version || 1;
};

const isDownloadable = (deliverable: DeliverableItem): boolean => {
  return ('downloadable' in deliverable) 
    ? deliverable.downloadable !== false
    : true; // New deliverables are downloadable by default
};

const hasId = (deliverable: DeliverableItem): boolean => {
  return !!deliverable.id;
};

const getTags = (deliverable: DeliverableItem): string[] => {
  return deliverable.tags || [];
};
</script>

<style scoped>
.deliverable-content {
  max-width: 100%;
}

.deliverable-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.deliverable-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.deliverable-actions {
  display: flex;
  gap: 8px;
}

.deliverable-body {
  margin-bottom: 20px;
}

.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: var(--ion-color-primary);
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 1em 0;
  padding-left: 2em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5em;
}

.markdown-content :deep(pre) {
  background: var(--ion-color-light);
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
  border: 1px solid var(--ion-color-light-shade);
}

.markdown-content :deep(code) {
  background: var(--ion-color-light);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--ion-color-primary);
  padding-left: 1em;
  margin: 1em 0;
  color: var(--ion-color-medium);
}

.html-content {
  line-height: 1.6;
}

.json-content {
  background: var(--ion-color-light);
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
  border: 1px solid var(--ion-color-light-shade);
  font-family: monospace;
  font-size: 0.9em;
}

.text-content {
  white-space: pre-wrap;
  line-height: 1.6;
  font-family: monospace;
  background: var(--ion-color-light);
  padding: 1em;
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}

.deliverable-metadata {
  padding-top: 20px;
  border-top: 1px solid var(--ion-color-light-shade);
}

.deliverable-metadata h4 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
  font-size: 1.1em;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 8px;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--ion-color-light);
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}

.metadata-key {
  font-weight: 600;
  color: var(--ion-color-medium);
}

.metadata-value {
  color: var(--ion-color-dark);
  text-align: right;
  word-break: break-word;
}

@media (max-width: 768px) {
  .deliverable-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .deliverable-actions {
    justify-content: stretch;
  }
  
  .metadata-grid {
    grid-template-columns: 1fr;
  }
  
  .metadata-item {
    flex-direction: column;
    gap: 4px;
  }
  
  .metadata-value {
    text-align: left;
  }
}

/* Edit Mode Styles */
.deliverable-edit {
  padding: 0;
}

.deliverable-edit ion-item {
  --padding-start: 0;
  --padding-end: 0;
  margin-bottom: 1rem;
}

.content-textarea {
  font-family: monospace;
  font-size: 0.9rem;
}

.edit-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-step-150);
}

.deliverable-tags {
  margin-bottom: 1.5rem;
}

.deliverable-tags h4 {
  margin: 0 0 0.75rem 0;
  color: var(--ion-color-primary);
  font-size: 1.1em;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Enhanced responsive design */
@media (max-width: 768px) {
  .edit-actions {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .tags-container {
    justify-content: flex-start;
  }
}
</style>