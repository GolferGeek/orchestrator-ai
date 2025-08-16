<template>
  <div class="deliverable-display">
    <!-- Document Paper Container -->
    <div class="document-paper">
    <div class="deliverable-header">
      <div class="title-section">
        <h3 class="deliverable-title">{{ deliverable.title }}</h3>
        <div class="metadata">
          <ion-chip v-if="deliverable.type" :color="getTypeColor(deliverable.type)" outline>
            {{ formatType(deliverable.type) }}
          </ion-chip>
          <ion-chip v-if="currentVersion?.format" :color="getFormatColor(currentVersion.format)" outline>
            {{ currentVersion.format.toUpperCase() }}
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
          Version {{ displayVersion?.versionNumber || currentVersion?.versionNumber || 1 }} of {{ totalVersions }}
        </span>
        <span v-if="displayVersion?.createdByType" class="created-by">
          by {{ formatCreationType(displayVersion.createdByType) }}
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
          v-if="selectedVersion && !selectedVersion.isCurrentVersion"
          fill="outline"
          size="small"
          @click="makeCurrentVersion(selectedVersion)"
          color="primary"
        >
          Set as Current
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
            :class="{ 
              active: selectedVersion?.id === version.id,
              current: version.isCurrentVersion 
            }"
            @click="selectVersion(version)"
          >
            <div class="version-marker">
              <div class="version-dot" :class="{ current: version.isCurrentVersion }"></div>
            </div>
            <div class="version-details">
              <div class="version-header">
                <span class="version-number">v{{ version.versionNumber }}</span>
                <span class="version-date">{{ formatDate(version.createdAt) }}</span>
              </div>
              <p class="version-preview">{{ getContentPreview(version.content) }}</p>
              <div class="version-meta">
                <span v-if="version.createdByType" class="creation-type">{{ formatCreationType(version.createdByType) }}</span>
                <ion-chip v-if="version.isCurrentVersion" color="success" size="small">Current</ion-chip>
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
      <div v-else class="content-display" :class="`format-${displayVersion?.format || 'text'}`">
        <!-- Markdown Content -->
        <div 
          v-if="displayVersion?.format === 'markdown'"
          class="markdown-content"
          v-html="renderedMarkdown"
        ></div>
        
        <!-- JSON Content -->
        <pre 
          v-else-if="displayVersion?.format === 'json'"
          class="json-content"
        ><code>{{ formatJson(displayVersion?.content) }}</code></pre>
        
        <!-- HTML Content -->
        <div 
          v-else-if="displayVersion?.format === 'html'"
          class="html-content"
          v-html="sanitizedHtml"
        ></div>
        
        <!-- Plain Text Content -->
        <div 
          v-else
          class="text-content"
        >{{ displayVersion?.content || '' }}</div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="deliverable-footer">
      <div class="timestamps">
        <span class="created">Created {{ formatDate(deliverable.createdAt) }}</span>
        <span v-if="deliverable.updatedAt !== deliverable.createdAt" class="updated">
          Updated {{ formatDate(deliverable.updatedAt) }}
        </span>
        <span v-if="displayVersion && displayVersion.createdAt !== deliverable.createdAt" class="version-created">
          This version: {{ formatDate(displayVersion.createdAt) }}
        </span>
      </div>
      
      <!-- Task Rating (for the work that created this version) -->
      <div class="rating-section" v-if="displayVersion?.taskId">
        <div class="rating-label">Rate the agent's work on this version:</div>
        <div class="rating-context" v-if="displayVersion?.createdByType">
          Created by {{ formatCreationType(displayVersion.createdByType) }}
        </div>
        <TaskRating 
          :task-id="displayVersion.taskId"
          :agent-name="displayVersion.createdByType"
        />
      </div>
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
import TaskRating from './TaskRating.vue';
import type { Deliverable, DeliverableVersion } from '@/types/deliverables';

interface Props {
  deliverable: Deliverable;
  conversationId?: string;
}

interface Emits {
  (e: 'version-changed', version: DeliverableVersion): void;
  (e: 'version-created', version: DeliverableVersion): void;
  (e: 'current-version-changed', version: DeliverableVersion): void;
  (e: 'edit-requested', deliverable: Deliverable): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Store
const deliverablesStore = useDeliverablesStore();

// Reactive state
const showVersionHistory = ref(false);
const versions = ref<DeliverableVersion[]>([]);
const selectedVersion = ref<DeliverableVersion | null>(null);
const isEditing = ref(false);
const editedContent = ref('');
const editedTitle = ref('');
const isSaving = ref(false);
const contentTextarea = ref<any>(null);

// Computed properties
const totalVersions = computed(() => versions.value.length);

const currentVersion = computed(() => {
  return props.deliverable.currentVersion || deliverablesStore.getCurrentVersion(props.deliverable.id);
});

const displayVersion = computed(() => {
  return selectedVersion.value || currentVersion.value;
});

const sortedVersions = computed(() => {
  return [...versions.value].sort((a, b) => b.versionNumber - a.versionNumber);
});

const canGoPrevious = computed(() => {
  if (!selectedVersion.value) return false;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === selectedVersion.value?.id);
  return currentIndex < sortedVersions.value.length - 1;
});

const canGoNext = computed(() => {
  if (!selectedVersion.value) return false;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === selectedVersion.value?.id);
  return currentIndex > 0;
});

const hasUnsavedChanges = computed(() => {
  return isEditing.value && (
    editedContent.value !== (displayVersion.value?.content || '') ||
    editedTitle.value !== props.deliverable.title
  );
});

const renderedMarkdown = computed(() => {
  if (displayVersion.value?.format !== 'markdown') return '';
  if (!displayVersion.value?.content || typeof displayVersion.value.content !== 'string') {
    return '';
  }
  try {
    return marked(displayVersion.value.content);
  } catch (error) {
    console.error('Failed to render markdown:', error);
    return displayVersion.value.content || '';
  }
});

const sanitizedHtml = computed(() => {
  if (displayVersion.value?.format !== 'html') return '';
  if (!displayVersion.value?.content || typeof displayVersion.value.content !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(displayVersion.value.content);
});

// Methods
const getTypeColor = (type: string) => {
  if (!type || typeof type !== 'string') {
    return 'medium'; // Default fallback
  }
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
  if (!format || typeof format !== 'string') {
    return 'medium'; // Default fallback
  }
  const colors = {
    markdown: 'primary',
    html: 'secondary',
    json: 'tertiary',
    text: 'medium',
  };
  return colors[format as keyof typeof colors] || 'medium';
};

const formatType = (type: string) => {
  if (!type || typeof type !== 'string') {
    return 'Document'; // Default fallback
  }
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
  editedContent.value = props.deliverable.content || '';
  editedTitle.value = props.deliverable.title || '';
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
    
    // Create a new version instead of updating in-place
    const newVersion = await deliverablesStore.createVersion(props.deliverable.id, {
      title: editedTitle.value,
      content: editedContent.value,
      created_by_agent: 'manual_edit',
      metadata: {
        editReason: 'user_edit',
        editedAt: new Date().toISOString(),
        previousVersion: props.deliverable.version
      }
    });
    
    // Emit an event to notify parent component that a new version was created
    emit('version-created', newVersion);
    
    isEditing.value = false;
    editedContent.value = '';
    editedTitle.value = '';
  } catch (error: any) {
    console.error('Failed to save deliverable:', {
      error,
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data,
      parentId: props.deliverable.id,
      title: editedTitle.value,
      contentLength: editedContent.value.length
    });
    
    // Show error message to user
    alert(`Failed to save deliverable: ${error.message || 'Unknown error'}`);
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
  if (!content || typeof content !== 'string') {
    return '';
  }
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

const goToPreviousVersion = async () => {
  if (!canGoPrevious.value) return;
  
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  const previousVersion = versions.value[currentIndex - 1];
  
  if (previousVersion) {
    await loadAndEmitFullVersion(previousVersion.id);
  }
};

const goToNextVersion = async () => {
  if (!canGoNext.value) return;
  
  const currentIndex = versions.value.findIndex(v => v.id === props.deliverable.id);
  const nextVersion = versions.value[currentIndex + 1];
  
  if (nextVersion) {
    await loadAndEmitFullVersion(nextVersion.id);
  }
};

const selectVersion = async (version: any) => {
  if (version.id !== props.deliverable.id) {
    await loadAndEmitFullVersion(version.id);
  }
};

const loadAndEmitFullVersion = async (versionId: string) => {
  try {
    // Fetch the full deliverable for this version
    const fullVersion = await deliverablesStore.getDeliverable(versionId);
    if (fullVersion) {
      emit('version-changed', fullVersion);
    }
  } catch (error) {
    console.error('Failed to load full version:', error);
    // Fallback: still emit the limited version data
    const limitedVersion = versions.value.find(v => v.id === versionId);
    if (limitedVersion) {
      emit('version-changed', limitedVersion);
    }
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
  background: #f8fafc;
  padding: 20px;
  overflow-y: auto;
}

.document-paper {
  background: white;
  border-radius: 12px;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.05),
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  min-height: calc(100% - 40px);
  max-width: 100%;
  margin: 0 auto;
  position: relative;
}

/* Add subtle paper texture */
.document-paper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    linear-gradient(90deg, transparent 79px, rgba(0,0,0,0.02) 79px, rgba(0,0,0,0.02) 81px, transparent 81px),
    repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,0.01) 24px, rgba(0,0,0,0.01) 25px);
  pointer-events: none;
  border-radius: 12px;
}

.deliverable-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 16px 24px;
  border-bottom: 2px solid #e2e8f0;
  background: linear-gradient(to bottom, #fafbfc, #ffffff);
  border-radius: 12px 12px 0 0;
  position: relative;
  z-index: 1;
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
  padding: 24px 32px;
  background: white;
  position: relative;
  z-index: 1;
}

.markdown-content {
  line-height: 1.7;
  color: #1f2937;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
  padding: 20px 24px;
  border-top: 2px solid #e2e8f0;
  background: linear-gradient(to top, #fafbfc, #ffffff);
  border-radius: 0 0 12px 12px;
  position: relative;
  z-index: 1;
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
  margin-bottom: 16px;
}

.rating-section {
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 16px;
}

.rating-label {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.rating-context {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
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
@media (prefers-color-scheme: dark), 
html[data-theme="dark"] {
  .deliverable-display {
    background: #0f172a;
    color: #e2e8f0;
  }
  
  .document-paper {
    background: #1e293b;
    box-shadow: 
      0 4px 6px rgba(0, 0, 0, 0.2),
      0 1px 3px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }
  
  .document-paper::before {
    background: 
      linear-gradient(90deg, transparent 79px, rgba(255,255,255,0.03) 79px, rgba(255,255,255,0.03) 81px, transparent 81px),
      repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.02) 24px, rgba(255,255,255,0.02) 25px);
  }
  
  .deliverable-header {
    background: linear-gradient(to bottom, #334155, #1e293b);
    border-color: #475569;
    color: #f7fafc;
  }
  
  .content-display {
    background: #1e293b;
  }
  
  .deliverable-header h2 {
    color: #f7fafc;
  }
  
  .deliverable-meta {
    color: #a0aec0;
  }
  
  .version-section {
    background: #2d3748;
    border-color: #4a5568;
  }
  
  .version-item {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }
  
  .version-item:hover {
    background: #4b5563;
  }
  
  .version-item.active {
    background: #1e40af;
    border-color: #3b82f6;
    color: #dbeafe;
  }
  
  .deliverable-content {
    background: #1a202c;
    color: #e2e8f0;
  }
  
  .markdown-content {
    color: #e2e8f0;
  }
  
  .markdown-content :deep(h1),
  .markdown-content :deep(h2),
  .markdown-content :deep(h3),
  .markdown-content :deep(h4),
  .markdown-content :deep(h5),
  .markdown-content :deep(h6) {
    color: #f7fafc;
  }
  
  .markdown-content :deep(strong),
  .markdown-content :deep(b) {
    color: #f7fafc;
  }
  
  .markdown-content :deep(pre) {
    background: #111827;
    color: #e5e7eb;
    border: 1px solid #374151;
  }
  
  .markdown-content :deep(code) {
    background: #111827;
    color: #68d391;
    border: 1px solid #374151;
  }
  
  .markdown-content :deep(blockquote) {
    border-left-color: #4b5563;
    background-color: rgba(255, 255, 255, 0.02);
    color: #cbd5e0;
  }
  
  .markdown-content :deep(a) {
    color: #63b3ed;
  }
  
  .json-content {
    background: #111827;
    color: #e5e7eb;
    border: 1px solid #374151;
  }
  
  .deliverable-footer {
    background: linear-gradient(to top, #334155, #1e293b);
    border-color: #475569;
    color: #a0aec0;
  }
  
  .rating-label {
    color: #f7fafc;
  }
  
  .rating-context {
    color: #a0aec0;
  }
  
  .title-editor,
  .content-editor {
    --background: #374151;
    --color: #e2e8f0;
    --border-color: #4a5568;
  }
  
  .edit-help {
    background: #2d3748;
    color: #a0aec0;
  }
  
  .markdown-toolbar {
    background: #2d3748;
    border-color: #4a5568;
  }
  
  .toolbar-group:not(:last-child)::after {
    background: #4a5568;
  }
  
  .markdown-toolbar ion-button {
    --color: #d1d5db;
  }
  
  .markdown-toolbar ion-button:hover {
    --color: #60a5fa;
    --background: #374151;
  }
}

html[data-theme="dark"] .rating-label {
  color: #f7fafc;
}

html[data-theme="dark"] .rating-context {
  color: #a0aec0;
}
</style>