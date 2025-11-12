<template>
  <div class="plan-display">
    <!-- Document Paper Container -->
    <div class="document-paper">
      <!-- Compact Header -->
      <div class="plan-header compact">
        <div class="title-section">
          <h3 class="plan-title">{{ displayTitle }}</h3>
          <!-- LLM Information in Main Header -->
          <div v-if="getVersionLLMInfo(displayVersion)" class="llm-info-header">
            <ion-chip color="primary" size="small">
              <ion-icon :icon="hardwareChipOutline" />
              {{ getVersionLLMInfo(displayVersion) }}
            </ion-chip>
            <span v-if="getVersionCost(displayVersion)" class="cost-info">
              ${{ getVersionCost(displayVersion) }}
            </span>
          </div>
        </div>
        <div class="header-actions">
          <!-- Edit Mode Controls (when editing) -->
          <div v-if="isEditing" class="edit-controls">
            <ion-button
              fill="clear"
              size="small"
              @click="cancelEditing"
              color="medium"
            >
              <ion-icon :icon="closeOutline" />
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
          <!-- Normal Mode Actions -->
          <div v-else class="normal-actions">
            <!-- Actions Dropdown -->
            <ion-button
              fill="clear"
              size="small"
              @click="showActionsMenu = !showActionsMenu"
              id="plan-actions-trigger"
            >
              <ion-icon :icon="ellipsisVerticalOutline" />
            </ion-button>
            <!-- Quick Edit -->
            <ion-button
              fill="clear"
              size="small"
              @click="startEditing"
            >
              <ion-icon :icon="createOutline" />
            </ion-button>
            <!-- Quick Download -->
            <ion-button
              fill="clear"
              size="small"
              @click="downloadPlan"
            >
              <ion-icon :icon="downloadOutline" />
            </ion-button>
          </div>
        </div>
      </div>

      <!-- Version Navigation (always visible) -->
      <div class="version-section">
        <div class="version-info">
          <span class="version-label">
            Version {{ displayVersion?.versionNumber || currentVersion?.versionNumber || 1 }} of {{ totalVersions }}
          </span>
          <span v-if="getVersionLLMInfo(displayVersion)" class="llm-used">
            ({{ getVersionLLMInfo(displayVersion) }})
          </span>
          <ion-chip v-if="isViewingNewest && !displayVersion?.isCurrentVersion" color="tertiary" size="small" class="viewing-indicator">
            Viewing new version
          </ion-chip>
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
            @click="makeCurrentVersion"
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
          <ion-chip v-if="previousVersion" :color="showDiff ? 'primary' : 'medium'" outline @click="showDiff = !showDiff" style="margin-left:8px;">
            {{ showDiff ? 'Hide Changes' : 'View Changes vs Previous' }}
          </ion-chip>
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
                  <!-- LLM Information -->
                  <div v-if="getVersionLLMInfo(version)" class="llm-info">
                    <ion-chip color="primary" size="small">
                      <ion-icon :icon="hardwareChipOutline" />
                      {{ getVersionLLMInfo(version) }}
                    </ion-chip>
                    <span v-if="getVersionCost(version)" class="cost-info">
                      ${{ getVersionCost(version) }}
                    </span>
                  </div>
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
              placeholder="Enter plan title"
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
              placeholder="Enter plan content (supports Markdown)"
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
          <template v-if="showDiff && previousVersion">
            <div class="diff-view">
              <div v-for="(line, idx) in diffLines" :key="idx" :class="['diff-line', `diff-${line.type}`]">
                <span class="diff-prefix">{{ line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ' }}</span>
                <span class="diff-text">{{ line.text }}</span>
              </div>
            </div>
          </template>
          <template v-else>
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
            <!-- Plain Text Content -->
            <div
              v-else
              class="text-content"
            >{{ displayVersion?.content || '' }}</div>
          </template>
        </div>
      </div>

      <!-- Compact Footer -->
      <div class="plan-footer compact">
        <div class="version-info">
          <span class="version-badge">v{{ displayVersion?.versionNumber || currentVersion?.versionNumber || 1 }} of {{ totalVersions }}</span>
          <span v-if="getVersionLLMInfo(displayVersion)" class="llm-used">
            ({{ getVersionLLMInfo(displayVersion) }})
          </span>
          <span v-if="getVersionCost(displayVersion)" class="cost-info">
            ${{ getVersionCost(displayVersion) }}
          </span>
        </div>
        <div class="footer-actions">
          <!-- Run with different LLM Button -->
          <ion-button
            fill="clear"
            size="small"
            @click="runWithDifferentLLM"
            color="primary"
          >
            Run with different LLM
          </ion-button>
          <!-- Inline Rating (if available) -->
          <div v-if="displayVersion?.taskId" class="inline-rating">
            <TaskRating
              :task-id="displayVersion.taskId"
              :agent-name="plan.agentName"
            />
          </div>
          <!-- Settings/More Button -->
          <ion-button
            fill="clear"
            size="small"
            @click="showFooterMenu = !showFooterMenu"
          >
            <ion-icon :icon="settingsOutline" />
          </ion-button>
        </div>
      </div>

      <!-- Actions Dropdown Menu -->
      <ion-popover
        :is-open="showActionsMenu"
        trigger="plan-actions-trigger"
        @didDismiss="showActionsMenu = false"
      >
        <ion-content>
          <ion-list>
            <ion-item button @click="showVersionHistory = !showVersionHistory">
              <ion-icon :icon="gitBranchOutline" slot="start" />
              <ion-label>{{ showVersionHistory ? 'Hide' : 'Show' }} Version History</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import {
  IonChip,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonAccordion,
  IonAccordionGroup,
  IonTextarea,
  IonPopover,
  IonContent,
  IonList,
} from '@ionic/vue';
import {
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
  settingsOutline,
  ellipsisVerticalOutline,
  hardwareChipOutline,
} from 'ionicons/icons';
import { marked } from 'marked';
import TaskRating from './TaskRating.vue';
import type { Plan, PlanVersion } from '@/services/agent2agent/types';
import { usePlanStore } from '@/stores/planStore';

interface Props {
  plan: Plan & { currentVersion?: PlanVersion };
  conversationId?: string;
  agentSlug?: string;
}

interface Emits {
  (e: 'version-changed', version: PlanVersion): void;
  (e: 'version-created', version: PlanVersion): void;
  (e: 'current-version-changed', version: PlanVersion): void;
  (e: 'run-with-different-llm', data: { plan: Plan; version: PlanVersion }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Store
const planStore = usePlanStore();

// Reactive state
const showVersionHistory = ref(false);
const showDiff = ref(false);
const showActionsMenu = ref(false);
const showFooterMenu = ref(false);
const selectedVersion = ref<PlanVersion | null>(null);
const isEditing = ref(false);
const editedContent = ref('');
const editedTitle = ref('');
const isSaving = ref(false);
const contentTextarea = ref<HTMLTextAreaElement | null>(null);

// Computed - get versions from store for reactivity
const versions = computed(() => {
  // This will trigger whenever the store state changes
  return planStore.versionsByPlanId(props.plan.id);
});

const displayTitle = computed(() => props.plan.title || 'Untitled Plan');
const totalVersions = computed(() => {
  const count = versions.value.length || 1;
  console.log('[PlanDisplay] totalVersions:', count, 'versions:', versions.value);
  return count;
});
const currentVersion = computed(() => {
  // Get current version from the versions in the store
  // This is reactive and will update when the store changes
  const current = versions.value.find(v => v.isCurrentVersion) || versions.value[0];
  console.log('[PlanDisplay] currentVersion:', current, 'from', versions.value.length, 'versions');
  return current;
});
const displayVersion = computed(() => {
  if (selectedVersion.value) return selectedVersion.value;
  const version = currentVersion.value;
  console.log('[PlanDisplay] displayVersion:', version);
  return version;
});

const previousVersion = computed(() => {
  const list = [...versions.value].sort((a, b) => b.versionNumber - a.versionNumber);
  if (!displayVersion.value) return null;
  const idx = list.findIndex(v => v.id === displayVersion.value!.id);
  return idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null;
});

const sortedVersions = computed(() => {
  return [...versions.value].sort((a, b) => b.versionNumber - a.versionNumber);
});

const isViewingNewest = computed(() => {
  const latest = sortedVersions.value[0];
  return !!(displayVersion.value && latest && displayVersion.value.id === latest.id);
});

const canGoPrevious = computed(() => {
  const currentDisplayVersion = displayVersion.value || currentVersion.value;
  if (!currentDisplayVersion || sortedVersions.value.length <= 1) return false;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === currentDisplayVersion.id);
  return currentIndex < sortedVersions.value.length - 1;
});

const canGoNext = computed(() => {
  const currentDisplayVersion = displayVersion.value || currentVersion.value;
  if (!currentDisplayVersion || sortedVersions.value.length <= 1) return false;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === currentDisplayVersion.id);
  return currentIndex > 0;
});

const hasUnsavedChanges = computed(() => {
  return isEditing.value && (
    editedContent.value !== (displayVersion.value?.content || '') ||
    editedTitle.value !== displayTitle.value
  );
});

const renderedMarkdown = computed(() => {
  if (displayVersion.value?.format !== 'markdown') return '';
  if (!displayVersion.value?.content || typeof displayVersion.value.content !== 'string') {
    return '';
  }
  try {
    let content = displayVersion.value.content;

    // Strip markdown code fences if present (```markdown ... ```)
    const codeBlockMatch = content.match(/^```(?:markdown)?\n([\s\S]*?)\n```$/);
    if (codeBlockMatch) {
      content = codeBlockMatch[1];
    }

    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    return marked(content);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return displayVersion.value.content || '';
  }
});

const diffLines = computed(() => {
  if (!showDiff.value) return [] as Array<{ type: 'same' | 'add' | 'del'; text: string }>;
  const curr = (displayVersion.value?.content || '').split('\n');
  const prev = (previousVersion.value?.content || '').split('\n');
  const maxLen = Math.max(curr.length, prev.length);
  const out: Array<{ type: 'same' | 'add' | 'del'; text: string }> = [];
  for (let i = 0; i < maxLen; i++) {
    const a = curr[i] ?? '';
    const b = prev[i] ?? '';
    if (a === b) out.push({ type: 'same', text: a });
    else {
      if (b) out.push({ type: 'del', text: b });
      if (a) out.push({ type: 'add', text: a });
    }
  }
  return out;
});

// Methods
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 1) return 'Just now';
  else if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
  else if (diffInHours < 48) return 'Yesterday';
  else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

const formatCreationType = (creationType: string) => {
  if (!creationType || typeof creationType !== 'string') return 'Unknown';
  const typeMap = {
    agent: 'AI Assistant',
    user: 'Manual Edit',
  };
  return typeMap[creationType as keyof typeof typeMap] || creationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getContentPreview = (content: string) => {
  if (!content || typeof content !== 'string') return 'No content available';
  const cleanContent = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '[code block]')
    .trim();
  return cleanContent.length > 150
    ? cleanContent.substring(0, 147) + '...'
    : cleanContent;
};

const startEditing = () => {
  isEditing.value = true;
  editedContent.value = displayVersion.value?.content || '';
  editedTitle.value = displayTitle.value || '';
};

const cancelEditing = () => {
  isEditing.value = false;
  editedContent.value = '';
  editedTitle.value = '';
};

const runWithDifferentLLM = () => {
  const version = displayVersion.value;
  if (!version) {
    console.error('No version available to rerun');
    return;
  }
  emit('run-with-different-llm', {
    plan: props.plan,
    version: version
  });
};

const saveEdits = async () => {
  if (!hasUnsavedChanges.value || isSaving.value) return;

  if (!props.agentSlug) {
    alert('Cannot save: Agent information not available');
    return;
  }

  try {
    isSaving.value = true;
    // Create a new version via manual edit through A2A protocol
    const { createPlanVersion } = await import('@/stores/helpers/planActions');

    if (!currentVersion.value?.id) {
      throw new Error('No current version to edit from');
    }

    await createPlanVersion(
      props.agentSlug!,
      props.plan.id,
      currentVersion.value.id,
      editedContent.value,
      {
        editReason: 'user_edit',
        previousVersionNumber: currentVersion.value.versionNumber
      }
    );

    // Reset editing state
    isEditing.value = false;
    editedContent.value = '';
    editedTitle.value = '';
  } catch (error: unknown) {
    alert(`Failed to save plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const newStart = start + 5;
    textarea.focus();
    textarea.setSelectionRange(newStart, newStart + (selectedText || 'code here').length);
  });
};

const formatJson = (content: string) => {
  if (!content || typeof content !== 'string') return '';
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
};

const goToPreviousVersion = async () => {
  if (!canGoPrevious.value) return;
  const currentDisplayVersion = displayVersion.value || currentVersion.value;
  if (!Array.isArray(sortedVersions.value) || !currentDisplayVersion) return;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === currentDisplayVersion.id);
  if (currentIndex < sortedVersions.value.length - 1) {
    const previousVersion = sortedVersions.value[currentIndex + 1];
    await selectAndDisplayVersion(previousVersion);
  }
};

const goToNextVersion = async () => {
  if (!canGoNext.value) return;
  const currentDisplayVersion = displayVersion.value || currentVersion.value;
  const currentIndex = sortedVersions.value.findIndex(v => v.id === currentDisplayVersion?.id);
  if (currentIndex > 0) {
    const nextVersion = sortedVersions.value[currentIndex - 1];
    await selectAndDisplayVersion(nextVersion);
  }
};

const selectVersion = async (version: PlanVersion) => {
  selectedVersion.value = version;
  await selectAndDisplayVersion(version);
};

const selectAndDisplayVersion = async (version: PlanVersion) => {
  selectedVersion.value = version;
  // TODO: Load full version if needed
};

const makeCurrentVersion = async () => {
  if (!selectedVersion.value) return;

  if (!props.agentSlug) {
    alert('Cannot set current version: Agent information not available');
    return;
  }

  try {
    const { setCurrentPlanVersion } = await import('@/services/agent2agent/actions');
    await setCurrentPlanVersion(
      props.agentSlug,
      props.plan.id,
      selectedVersion.value.id
    );

    // Reload versions to get updated current version status
    const planStore = usePlanStore();
    const updatedVersions = planStore.planVersions(props.plan.id);

    // Update local state
    selectedVersion.value.isCurrentVersion = true;
    emit('current-version-changed', selectedVersion.value);
  } catch (error: unknown) {
    alert(`Failed to set current version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const downloadPlan = () => {
  const content = displayVersion.value?.content || '';
  const filename = `${displayTitle.value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${getFileExtension()}`;
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
  const format = displayVersion.value?.format || 'text';
  const extensions = {
    markdown: 'md',
    json: 'json',
    text: 'txt',
  };
  return extensions[format as keyof typeof extensions] || 'txt';
};

const getMimeType = () => {
  const format = displayVersion.value?.format || 'text';
  const mimeTypes = {
    markdown: 'text/markdown',
    json: 'application/json',
    text: 'text/plain',
  };
  return mimeTypes[format as keyof typeof mimeTypes] || 'text/plain';
};

const getVersionLLMInfo = (version: Record<string, unknown>): string | null => {
  if (!version?.metadata) return null;

  const metadata = version.metadata as Record<string, unknown>;

  // Check for llmRerunInfo (from rerun operations)
  if (metadata.llmRerunInfo?.provider && metadata.llmRerunInfo?.model) {
    return `${metadata.llmRerunInfo.provider}/${metadata.llmRerunInfo.model}`;
  }

  // Check for general LLM metadata
  if (metadata.llmMetadata) {
    if (metadata.llmMetadata.provider && metadata.llmMetadata.model) {
      return `${metadata.llmMetadata.provider}/${metadata.llmMetadata.model}`;
    }

    if (metadata.llmMetadata.originalLLMSelection) {
      const selection = metadata.llmMetadata.originalLLMSelection;
      if (selection.providerName && selection.modelName) {
        return `${selection.providerName}/${selection.modelName}`;
      }
    }
  }

  // Check top-level provider/model
  if (metadata.provider && metadata.model) {
    return `${metadata.provider}/${metadata.model}`;
  }

  return null;
};

const getVersionCost = (version: Record<string, unknown>): string | null => {
  if (!version?.metadata) return null;

  const cost = version.metadata.llmMetadata?.cost ||
               version.metadata.llmMetadata?.originalLLMSelection?.cost ||
               version.metadata.usage?.cost ||
               version.metadata.costCalculation?.cost;

  if (typeof cost === 'number' && cost > 0) {
    return cost.toFixed(4);
  }

  return null;
};

// Versions are now loaded reactively from the store via computed property
// No need to manually watch for plan changes
</script>

<style scoped>
/* Reuse DeliverableDisplay styles */
.plan-display {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-color-step-50);
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

.plan-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 24px 16px 24px;
  border-bottom: 2px solid var(--ion-color-light);
  background: linear-gradient(to bottom, var(--ion-color-light-tint), #ffffff);
  border-radius: 12px 12px 0 0;
  position: relative;
  z-index: 1;
}

@media (min-width: 768px) {
  .plan-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
}

.title-section {
  flex: 1;
}

.plan-title {
  margin: 0 0 8px 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.3;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}

.llm-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.cost-info {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.header-actions ion-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
}

.edit-controls,
.normal-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
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
  background: var(--ion-color-primary-tint);
  margin: 0 -16px;
  padding: 12px 16px;
  border-radius: 8px;
  border-color: var(--ion-color-primary);
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

.version-dot.current {
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

.diff-view {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9rem;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 8px 12px;
}

.diff-line {
  display: flex;
  gap: 8px;
  white-space: pre-wrap;
}

.diff-prefix {
  width: 1em;
  display: inline-block;
}

.diff-same {
  color: var(--ion-color-dark);
}

.diff-add {
  color: #0a7a0a;
  background: rgba(14, 159, 110, 0.08);
}

.diff-del {
  color: #933;
  background: rgba(220, 53, 69, 0.08);
  text-decoration: line-through;
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

.plan-footer {
  padding: 20px 24px;
  border-top: 2px solid #e2e8f0;
  background: linear-gradient(to top, #fafbfc, #ffffff);
  border-radius: 0 0 12px 12px;
  position: relative;
  z-index: 1;
}

.plan-footer.compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 24px 16px 24px;
  border-top: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-step-25);
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.plan-footer.compact .version-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.version-badge {
  background: var(--ion-color-primary);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
}

.footer-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.inline-rating {
  margin-right: 8px;
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

.title-editor,
.content-editor {
  --background: white;
  --color: var(--ion-color-dark);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  line-height: 1.5;
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

.plan-header.compact {
  padding: 16px 24px 12px 24px;
  gap: 12px;
}

.plan-header.compact .plan-title {
  font-size: 1.1em;
  margin: 0;
}
</style>
