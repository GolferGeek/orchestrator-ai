<template>
  <div class="deliverable-display">
    <div class="deliverable-header">
      <div class="title-section">
        <h3 class="deliverable-title">{{ deliverable.title }}</h3>
        <div class="metadata">
          <ion-chip :color="getTypeColor(deliverable.deliverable_type)" outline>
            {{ formatType(deliverable.deliverable_type) }}
          </ion-chip>
          <ion-chip :color="getFormatColor(deliverable.format)" outline>
            {{ deliverable.format.toUpperCase() }}
          </ion-chip>
        </div>
      </div>
      
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="showVersionHistory = !showVersionHistory">
          <ion-icon :icon="timeOutline" />
        </ion-button>
        <ion-button 
          v-if="!isEditing"
          fill="clear" 
          size="small" 
          @click="startEditing"
        >
          <ion-icon :icon="createOutline" />
          Edit
        </ion-button>
        
        <!-- Edit Mode Controls -->
        <div v-if="isEditing" class="edit-controls">
          <ion-button 
            fill="clear" 
            size="small" 
            @click="cancelEditing"
            color="medium"
          >
            <ion-icon :icon="closeOutline" />
            Cancel
          </ion-button>
          <ion-button 
            fill="solid" 
            size="small" 
            @click="saveEdits"
            color="primary"
            :disabled="!hasUnsavedChanges || isSaving"
          >
            <ion-icon :icon="saveOutline" />
            {{ isSaving ? 'Saving...' : 'Save' }}
          </ion-button>
        </div>
        <ion-button fill="clear" size="small" @click="downloadDeliverable">
          <ion-icon :icon="downloadOutline" />
        </ion-button>
      </div>
    </div>

    <!-- Version Navigation -->
    <div class="version-section" v-if="versions.length > 1 || showVersionHistory">
      <div class="version-info">
        <span class="version-label">
          Version {{ deliverable.version }} of {{ totalVersions }}
        </span>
        <span v-if="deliverable.created_by_agent" class="created-by">
          by {{ deliverable.created_by_agent }}
        </span>
      </div>
      
      <div class="version-controls">
        <ion-button
          fill="clear"
          size="small"
          :disabled="!canGoPrevious"
          @click="goToPreviousVersion"
        >
          <ion-icon :icon="chevronBackOutline" />
        </ion-button>
        
        <ion-button
          v-if="!deliverable.is_latest_version"
          fill="outline"
          size="small"
          @click="$emit('merge-requested', deliverable)"
          color="primary"
        >
          Merge Changes
        </ion-button>
        
        <ion-button
          fill="clear"
          size="small"
          :disabled="!canGoNext"
          @click="goToNextVersion"
        >
          <ion-icon :icon="chevronForwardOutline" />
        </ion-button>
      </div>
    </div>

    <!-- Version History Timeline -->
    <ion-accordion-group v-if="showVersionHistory" class="version-history">
      <ion-accordion value="versions">
        <ion-item slot="header">
          <ion-icon :icon="gitBranchOutline" slot="start" />
          <ion-label>Version History ({{ totalVersions }})</ion-label>
        </ion-item>
        
        <div slot="content" class="version-timeline">
          <div 
            v-for="version in sortedVersions"
            :key="version.id"
            class="version-item"
            :class="{ active: version.id === deliverable.id }"
            @click="selectVersion(version)"
          >
            <div class="version-marker">
              <div class="version-dot" :class="{ latest: version.is_latest_version }"></div>
            </div>
            <div class="version-details">
              <div class="version-header">
                <span class="version-number">v{{ version.version }}</span>
                <span class="version-date">{{ formatDate(version.created_at) }}</span>
              </div>
              <p class="version-preview">{{ version.content_preview }}</p>
              <div class="version-meta">
                <span v-if="version.created_by_agent" class="agent-name">{{ version.created_by_agent }}</span>
                <ion-chip v-if="version.is_latest_version" color="success" size="small">Latest</ion-chip>
              </div>
            </div>
          </div>
        </div>
      </ion-accordion>
    </ion-accordion-group>

    <!-- Content Display -->
    <div class="content-section">
      <!-- Edit Mode -->
      <div v-if="isEditing" class="edit-mode-content">
        <!-- Title Editing -->
        <div class="edit-field">
          <label class="edit-label">Title</label>
          <ion-textarea
            v-model="editedTitle"
            placeholder="Enter deliverable title"
            :rows="1"
            fill="outline"
            class="title-editor"
          />
        </div>
        
        <!-- Content Editing -->
        <div class="edit-field">
          <label class="edit-label">Content</label>
          
          <!-- Markdown Toolbar -->
          <div class="markdown-toolbar">
            <div class="toolbar-group">
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('**', '**', 'Bold text')"
                title="Bold"
              >
                <ion-icon :icon="textOutline" />
                <strong>B</strong>
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('*', '*', 'Italic text')"
                title="Italic"
              >
                <ion-icon :icon="textOutline" />
                <em>I</em>
              </ion-button>
            </div>
            
            <div class="toolbar-group">
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('# ', '', 'Header 1')"
                title="Header 1"
              >
                H1
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('## ', '', 'Header 2')"
                title="Header 2"
              >
                H2
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('### ', '', 'Header 3')"
                title="Header 3"
              >
                H3
              </ion-button>
            </div>
            
            <div class="toolbar-group">
              <ion-button
                fill="clear"
                size="small"
                @click="insertList('bullet')"
                title="Bullet List"
              >
                <ion-icon :icon="listOutline" />
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertList('numbered')"
                title="Numbered List"
              >
                1.
              </ion-button>
            </div>
            
            <div class="toolbar-group">
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('[', '](url)', 'Link text')"
                title="Link"
              >
                <ion-icon :icon="linkOutline" />
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('`', '`', 'code')"
                title="Inline Code"
              >
                <ion-icon :icon="codeSlashOutline" />
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertCodeBlock()"
                title="Code Block"
              >
                ```
              </ion-button>
            </div>
            
            <div class="toolbar-group">
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('> ', '', 'Quote text')"
                title="Quote"
              >
                <ion-icon :icon="chatboxOutline" />
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="insertMarkdown('---\n', '', '')"
                title="Horizontal Rule"
              >
                <ion-icon :icon="removeOutline" />
              </ion-button>
            </div>
          </div>
          
          <ion-textarea
            ref="contentTextarea"
            v-model="editedContent"
            placeholder="Enter deliverable content (supports Markdown)"
            :rows="20"
            fill="outline"
            class="content-editor"
          />
        </div>
        
        <!-- Edit Help Text -->
        <div class="edit-help">
          <ion-icon :icon="informationCircleOutline" />
          <span>You can use Markdown formatting in the content area</span>
        </div>
      </div>
      
      <!-- Read-Only Mode -->
      <div v-else class="content-display" :class="`format-${deliverable.format}`">
        <!-- Markdown Content -->
        <div 
          v-if="deliverable.format === 'markdown'"
          class="markdown-content"
          v-html="renderedMarkdown"
        ></div>
        
        <!-- JSON Content -->
        <pre 
          v-else-if="deliverable.format === 'json'"
          class="json-content"
        ><code>{{ formatJson(deliverable.content) }}</code></pre>
        
        <!-- HTML Content -->
        <div 
          v-else-if="deliverable.format === 'html'"
          class="html-content"
          v-html="sanitizedHtml"
        ></div>
        
        <!-- Plain Text Content -->
        <div 
          v-else
          class="text-content"
        >{{ deliverable.content }}</div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="deliverable-footer">
      <div class="timestamps">
        <span class="created">Created {{ formatDate(deliverable.created_at) }}</span>
        <span v-if="deliverable.updated_at !== deliverable.created_at" class="updated">
          Updated {{ formatDate(deliverable.updated_at) }}
        </span>
      </div>
      
      <!-- Tags -->
      <div v-if="deliverable.tags && deliverable.tags.length" class="tags-section">
        <ion-chip
          v-for="tag in deliverable.tags"
          :key="tag"
          size="small"
          color="light"
        >
          {{ tag }}
        </ion-chip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  IonChip,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonAccordion,
  IonAccordionGroup,
  IonTextarea,
} from '@ionic/vue';
import {
  timeOutline,
  createOutline,
  downloadOutline,
  chevronBackOutline,
  chevronForwardOutline,
  gitBranchOutline,
  closeOutline,
  saveOutline,
  informationCircleOutline,
  textOutline,
  listOutline,
  linkOutline,
  codeSlashOutline,
  chatboxOutline,
  removeOutline,
} from 'ionicons/icons';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Props {
  deliverable: any;
  conversationId?: string;
}

interface Emits {
  (e: 'version-changed', version: any): void;
  (e: 'merge-requested', deliverable: any): void;
  (e: 'edit-requested', deliverable: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Store
const deliverablesStore = useDeliverablesStore();

// Reactive state
const showVersionHistory = ref(false);
const versions = ref<any[]>([]);
const isEditing = ref(false);
const editedContent = ref('');
const editedTitle = ref('');
const isSaving = ref(false);
const contentTextarea = ref<any>(null);

// Computed properties
const totalVersions = computed(() => versions.value.length);

const sortedVersions = computed(() => {
  return [...versions.value].sort((a, b) => b.version - a.version);
});

const canGoPrevious = computed(() => {
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  return currentIndex > 0;
});

const canGoNext = computed(() => {
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  return currentIndex < versions.value.length - 1 && currentIndex !== -1;
});

const hasUnsavedChanges = computed(() => {
  return isEditing.value && (
    editedContent.value !== props.deliverable.content ||
    editedTitle.value !== props.deliverable.title
  );
});

const renderedMarkdown = computed(() => {
  if (props.deliverable.format !== 'markdown') return '';
  try {
    return marked(props.deliverable.content);
  } catch (error) {
    console.error('Failed to render markdown:', error);
    return props.deliverable.content;
  }
});

const sanitizedHtml = computed(() => {
  if (props.deliverable.format !== 'html') return '';
  return DOMPurify.sanitize(props.deliverable.content);
});

// Methods
const getTypeColor = (type: string) => {
  const colors = {
    document: 'primary',
    analysis: 'secondary',
    report: 'tertiary',
    plan: 'warning',
    requirements: 'success',
  };
  return colors[type as keyof typeof colors] || 'medium';
};

const getFormatColor = (format: string) => {
  const colors = {
    markdown: 'primary',
    html: 'secondary',
    json: 'tertiary',
    text: 'medium',
  };
  return colors[format as keyof typeof colors] || 'medium';
};

const formatType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

const startEditing = () => {
  isEditing.value = true;
  editedContent.value = props.deliverable.content;
  editedTitle.value = props.deliverable.title;
};

const cancelEditing = () => {
  isEditing.value = false;
  editedContent.value = '';
  editedTitle.value = '';
};

const saveEdits = async () => {
  if (!hasUnsavedChanges.value || isSaving.value) return;
  
  try {
    isSaving.value = true;
    
    const updatedData: any = {};
    if (editedTitle.value !== props.deliverable.title) {
      updatedData.title = editedTitle.value;
    }
    if (editedContent.value !== props.deliverable.content) {
      updatedData.content = editedContent.value;
    }
    
    await deliverablesStore.updateDeliverable(props.deliverable.id, updatedData);
    
    isEditing.value = false;
    editedContent.value = '';
    editedTitle.value = '';
  } catch (error) {
    console.error('Failed to save deliverable:', error);
    // TODO: Show error toast
  } finally {
    isSaving.value = false;
  }
};

// Markdown toolbar methods
const insertMarkdown = (before: string, after: string, placeholder: string) => {
  const ionTextarea = contentTextarea.value;
  const textarea = ionTextarea?.$el?.querySelector('textarea') || ionTextarea?.querySelector?.('textarea');
  if (!textarea) return;
  
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const selectedText = editedContent.value.substring(start, end);
  
  const textToInsert = selectedText || placeholder;
  const newText = before + textToInsert + after;
  
  editedContent.value = 
    editedContent.value.substring(0, start) + 
    newText + 
    editedContent.value.substring(end);
  
  // Move cursor to the right position
  nextTick(() => {
    const newStart = start + before.length;
    const newEnd = newStart + textToInsert.length;
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
  });
};

const insertList = (type: 'bullet' | 'numbered') => {
  const ionTextarea = contentTextarea.value;
  const textarea = ionTextarea?.$el?.querySelector('textarea') || ionTextarea?.querySelector?.('textarea');
  if (!textarea) return;
  
  const start = textarea.selectionStart || 0;
  const prefix = type === 'bullet' ? '- ' : '1. ';
  const listItem = `${prefix}List item`;
  
  // If we're at the start of a line or the previous character is a newline
  const needsNewline = start === 0 || editedContent.value.charAt(start - 1) !== '\n';
  const insertion = (needsNewline ? '\n' : '') + listItem;
  
  editedContent.value = 
    editedContent.value.substring(0, start) + 
    insertion + 
    editedContent.value.substring(start);
  
  nextTick(() => {
    const newPos = start + insertion.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
  });
};

const insertCodeBlock = () => {
  const ionTextarea = contentTextarea.value;
  const textarea = ionTextarea?.$el?.querySelector('textarea') || ionTextarea?.querySelector?.('textarea');
  if (!textarea) return;
  
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const selectedText = editedContent.value.substring(start, end);
  
  const codeBlock = selectedText 
    ? `\n\`\`\`\n${selectedText}\n\`\`\`\n`
    : `\n\`\`\`\ncode here\n\`\`\`\n`;
  
  editedContent.value = 
    editedContent.value.substring(0, start) + 
    codeBlock + 
    editedContent.value.substring(end);
  
  nextTick(() => {
    const newStart = start + 5; // Position after ```\n
    textarea.focus();
    textarea.setSelectionRange(newStart, newStart + (selectedText || 'code here').length);
  });
};

const formatJson = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    return content;
  }
};

const loadVersions = async () => {
  try {
    if (props.deliverable.parent_deliverable_id) {
      // This is a version, load all versions of the parent
      versions.value = await deliverablesStore.getDeliverableVersions(
        props.deliverable.parent_deliverable_id
      );
    } else {
      // This is the parent, load all its versions
      versions.value = await deliverablesStore.getDeliverableVersions(props.deliverable.id);
    }
  } catch (error) {
    console.error('Failed to load versions:', error);
    versions.value = [props.deliverable]; // Fallback to current only
  }
};

const goToPreviousVersion = () => {
  if (!canGoPrevious.value) return;
  
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  const previousVersion = versions.value[currentIndex - 1];
  
  if (previousVersion) {
    emit('version-changed', previousVersion);
  }
};

const goToNextVersion = () => {
  if (!canGoNext.value) return;
  
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  const nextVersion = versions.value[currentIndex + 1];
  
  if (nextVersion) {
    emit('version-changed', nextVersion);
  }
};

const selectVersion = (version: any) => {
  if (version.id !== props.deliverable.id) {
    emit('version-changed', version);
  }
};

const downloadDeliverable = () => {
  const content = props.deliverable.content;
  const filename = `${props.deliverable.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${getFileExtension()}`;
  
  const blob = new Blob([content], { type: getMimeType() });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getFileExtension = () => {
  const extensions = {
    markdown: 'md',
    html: 'html',
    json: 'json',
    text: 'txt',
  };
  return extensions[props.deliverable.format as keyof typeof extensions] || 'txt';
};

const getMimeType = () => {
  const mimeTypes = {
    markdown: 'text/markdown',
    html: 'text/html',
    json: 'application/json',
    text: 'text/plain',
  };
  return mimeTypes[props.deliverable.format as keyof typeof mimeTypes] || 'text/plain';
};

// Watch for deliverable changes and reload versions
watch(() => props.deliverable?.id, () => {
  if (props.deliverable) {
    loadVersions();
  }
}, { immediate: true });
</script>

<style scoped>
.deliverable-display {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.deliverable-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
}

.title-section {
  flex: 1;
}

.deliverable-title {
  margin: 0 0 8px 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.3;
}

.metadata {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 4px;
  margin-left: 16px;
}

.version-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-step-50);
}

.version-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.version-label {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.created-by {
  font-size: 0.9em;
  color: var(--ion-color-medium);
}

.version-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.version-history {
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.version-timeline {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.version-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--ion-color-light-shade);
  cursor: pointer;
  transition: all 0.2s ease;
}

.version-item:last-child {
  border-bottom: none;
}

.version-item:hover {
  background: var(--ion-color-step-50);
  margin: 0 -16px;
  padding: 12px 16px;
  border-radius: 8px;
}

.version-item.active {
  background: #e3f2fd;
  margin: 0 -16px;
  padding: 12px 16px;
  border-radius: 8px;
  border-color: #bbdefb;
}

.version-marker {
  margin-right: 12px;
  margin-top: 4px;
}

.version-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ion-color-medium);
  border: 2px solid white;
  box-shadow: 0 0 0 2px var(--ion-color-medium);
}

.version-dot.latest {
  background: var(--ion-color-success);
  box-shadow: 0 0 0 2px var(--ion-color-success);
}

.version-details {
  flex: 1;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.version-number {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.version-date {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.version-preview {
  margin: 4px 0;
  font-size: 0.9em;
  color: var(--ion-color-dark);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.version-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.agent-name {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.content-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-display {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.markdown-content {
  line-height: 1.6;
  color: var(--ion-color-dark);
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  color: var(--ion-color-dark);
  margin-top: 24px;
  margin-bottom: 12px;
}

.markdown-content :deep(h1):first-child,
.markdown-content :deep(h2):first-child,
.markdown-content :deep(h3):first-child {
  margin-top: 0;
}

.markdown-content :deep(pre) {
  background: var(--ion-color-step-100);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-content :deep(code) {
  background: var(--ion-color-step-100);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--ion-color-primary);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--ion-color-medium);
}

.json-content,
.text-content {
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--ion-color-dark);
}

.json-content {
  background: var(--ion-color-step-50);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.html-content {
  line-height: 1.6;
  color: var(--ion-color-dark);
}

.deliverable-footer {
  padding: 16px;
  border-top: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
}

.timestamps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.created,
.updated {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Edit Mode Styles */
.edit-mode-content {
  padding: 16px;
}

.edit-field {
  margin-bottom: 16px;
}

.edit-label {
  display: block;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
}

.title-editor {
  --background: white;
  --color: var(--ion-color-dark);
}

.content-editor {
  --background: white;
  --color: var(--ion-color-dark);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

.edit-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.edit-help {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--ion-color-step-100);
  border-radius: 6px;
}

.edit-help ion-icon {
  font-size: 1.1em;
}

.markdown-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  background: var(--ion-color-step-100);
  border: 1px solid var(--ion-color-light);
  border-radius: 6px;
  margin-bottom: 8px;
}

.toolbar-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.toolbar-group:not(:last-child)::after {
  content: '';
  width: 1px;
  height: 20px;
  background: var(--ion-color-light);
  margin-left: 4px;
}

.markdown-toolbar ion-button {
  --color: var(--ion-color-medium);
  --padding-start: 6px;
  --padding-end: 6px;
  min-width: 32px;
  height: 32px;
  font-size: 0.85em;
  font-weight: 600;
}

.markdown-toolbar ion-button:hover {
  --color: var(--ion-color-primary);
  --background: var(--ion-color-primary-tint);
}

.markdown-toolbar ion-button ion-icon {
  font-size: 0.9em;
  margin-right: 2px;
}

.markdown-toolbar ion-button strong,
.markdown-toolbar ion-button em {
  font-size: 0.9em;
  margin-left: 2px;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .deliverable-display {
    background: var(--ion-color-dark-shade);
  }
  
  .deliverable-header {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .version-section {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .version-item.active {
    background: #1e3a8a;
    border-color: #3730a3;
  }
  
  .json-content {
    background: var(--ion-color-dark);
  }
  
  .deliverable-footer {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .markdown-content :deep(pre) {
    background: var(--ion-color-dark);
  }
  
  .markdown-content :deep(code) {
    background: var(--ion-color-dark);
  }
  
  .title-editor,
  .content-editor {
    --background: var(--ion-color-dark-shade);
    --color: var(--ion-color-light);
  }
  
  .edit-help {
    background: var(--ion-color-dark);
  }
  
  .markdown-toolbar {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .toolbar-group:not(:last-child)::after {
    background: var(--ion-color-dark-tint);
  }
  
  .markdown-toolbar ion-button {
    --color: var(--ion-color-light-shade);
  }
  
  .markdown-toolbar ion-button:hover {
    --color: var(--ion-color-primary-tint);
    --background: var(--ion-color-dark-shade);
  }
}
</style>