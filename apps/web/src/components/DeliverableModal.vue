<template>
  <ion-modal :is-open="isOpen" @will-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ deliverable?.title || 'Deliverable' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="deliverable" class="deliverable-content">
        <div class="deliverable-header">
          <div class="deliverable-meta">
            <ion-chip :color="getTypeColor(deliverable.deliverableType)">
              <ion-icon :icon="getTypeIcon(deliverable.deliverableType)" />
              <ion-label>{{ deliverable.deliverableType.toUpperCase() }}</ion-label>
            </ion-chip>
            <ion-chip color="medium">
              <ion-icon :icon="documentOutline" />
              <ion-label>{{ deliverable.format.toUpperCase() }}</ion-label>
            </ion-chip>
            <ion-chip color="light">
              <ion-icon :icon="timeOutline" />
              <ion-label>{{ formatDate(deliverable.timestamp) }}</ion-label>
            </ion-chip>
          </div>
          
          <div class="deliverable-actions">
            <ion-button 
              v-if="deliverable.downloadable" 
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
          </div>
        </div>

        <div class="deliverable-body">
          <div 
            v-if="deliverable.format === 'markdown'" 
            class="markdown-content"
            v-html="renderedMarkdown"
          ></div>
          <div 
            v-else-if="deliverable.format === 'html'" 
            class="html-content"
            v-html="deliverable.content"
          ></div>
          <pre 
            v-else-if="deliverable.format === 'json'" 
            class="json-content"
          >{{ formattedJson }}</pre>
          <div 
            v-else 
            class="text-content"
          >{{ deliverable.content }}</div>
        </div>

        <div v-if="deliverable.metadata && Object.keys(deliverable.metadata).length > 0" class="deliverable-metadata">
          <h4>Metadata</h4>
          <div class="metadata-grid">
            <div 
              v-for="(value, key) in deliverable.metadata" 
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
import { computed, defineProps, defineEmits } from 'vue';
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
  listOutline
} from 'ionicons/icons';

interface WorkflowDeliverable {
  title: string;
  content: string;
  deliverableType: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  format: 'markdown' | 'text' | 'json' | 'html';
  metadata?: Record<string, any>;
  downloadable?: boolean;
  timestamp: Date;
}

const props = defineProps<{
  isOpen: boolean;
  deliverable?: WorkflowDeliverable;
}>();

const emit = defineEmits<{
  close: [];
  download: [deliverable: WorkflowDeliverable];
}>();

const renderedMarkdown = computed(() => {
  if (!props.deliverable || props.deliverable.format !== 'markdown') return '';
  return marked.parse(props.deliverable.content, { breaks: true, gfm: true });
});

const formattedJson = computed(() => {
  if (!props.deliverable || props.deliverable.format !== 'json') return '';
  try {
    const parsed = JSON.parse(props.deliverable.content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return props.deliverable.content;
  }
});

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

const formatDate = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleString();
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
  if (!props.deliverable) return;
  
  const blob = new Blob([props.deliverable.content], { 
    type: getContentType(props.deliverable.format) 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.deliverable.title}.${getFileExtension(props.deliverable.format)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  emit('download', props.deliverable);
};

const copyToClipboard = async () => {
  if (!props.deliverable) return;
  
  try {
    await navigator.clipboard.writeText(props.deliverable.content);
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
</style>