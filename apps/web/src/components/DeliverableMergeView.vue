<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>Merge Deliverable Versions</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="$emit('merge-cancelled')">Cancel</ion-button>
        <ion-button 
          :disabled="!hasChanges" 
          color="primary" 
          @click="completeMerge"
        >
          Save Merge
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content class="merge-content">
    <div class="merge-container">
      <!-- Version Selection -->
      <div class="version-selector">
        <div class="version-option">
          <ion-label>
            <h3>Current Version (v{{ currentVersion.version }})</h3>
            <p>{{ formatDate(currentVersion.created_at) }}</p>
          </ion-label>
          <ion-radio-group v-model="baseVersion" value="current">
            <ion-radio value="current" />
          </ion-radio-group>
        </div>
        <div class="version-option">
          <ion-label>
            <h3>Latest Version (v{{ latestVersion.version }})</h3>
            <p>{{ formatDate(latestVersion.created_at) }}</p>
          </ion-label>
          <ion-radio-group v-model="baseVersion" value="latest">
            <ion-radio value="latest" />
          </ion-radio-group>
        </div>
        <div class="version-option" v-if="previousVersion">
          <ion-label>
            <h3>Previous Version (v{{ previousVersion.version }})</h3>
            <p>{{ formatDate(previousVersion.created_at) }}</p>
          </ion-label>
          <ion-radio-group v-model="baseVersion" value="previous">
            <ion-radio value="previous" />
          </ion-radio-group>
        </div>
      </div>
      <!-- Merge Mode Selection -->
      <div class="merge-mode-section">
        <ion-segment v-model="mergeMode" @ionChange="handleModeChange">
          <ion-segment-button value="visual">
            <ion-icon :icon="eyeOutline" />
            <ion-label>Visual Diff</ion-label>
          </ion-segment-button>
          <ion-segment-button value="text">
            <ion-icon :icon="documentTextOutline" />
            <ion-label>Text Diff</ion-label>
          </ion-segment-button>
          <ion-segment-button value="manual">
            <ion-icon :icon="constructOutline" />
            <ion-label>Manual Edit</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>
      <!-- Visual Diff Mode -->
      <div v-if="mergeMode === 'visual'" class="visual-diff-container">
        <div class="diff-panes">
          <div class="diff-pane">
            <h4>{{ getVersionLabel(baseVersion) }}</h4>
            <div class="content-display">
              <div 
                v-for="(section, index) in baseSections"
                :key="`base-${index}`"
                class="content-section"
                :class="getSectionClass(section, 'base')"
                @click="toggleSectionSelection(index, 'base')"
              >
                <div class="section-header">
                  <ion-checkbox 
                    :checked="isSectionSelected(index, 'base')"
                    @ionChange="toggleSectionSelection(index, 'base')"
                  />
                  <span class="section-label">{{ section.type }}</span>
                </div>
                <div class="section-content">{{ section.content }}</div>
              </div>
            </div>
          </div>
          <div class="diff-pane">
            <h4>{{ getVersionLabel(compareVersion) }}</h4>
            <div class="content-display">
              <div 
                v-for="(section, index) in compareSections"
                :key="`compare-${index}`"
                class="content-section"
                :class="getSectionClass(section, 'compare')"
                @click="toggleSectionSelection(index, 'compare')"
              >
                <div class="section-header">
                  <ion-checkbox 
                    :checked="isSectionSelected(index, 'compare')"
                    @ionChange="toggleSectionSelection(index, 'compare')"
                  />
                  <span class="section-label">{{ section.type }}</span>
                </div>
                <div class="section-content">{{ section.content }}</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Merge Preview -->
        <div class="merge-preview">
          <h4>Merged Result Preview</h4>
          <div class="preview-content">{{ mergedContent }}</div>
        </div>
      </div>
      <!-- Text Diff Mode -->
      <div v-if="mergeMode === 'text'" class="text-diff-container">
        <div class="diff-display">
          <pre class="diff-content">{{ textDiffContent }}</pre>
        </div>
        <div class="merge-controls">
          <ion-button fill="outline" @click="acceptAllChanges">
            Accept All Changes
          </ion-button>
          <ion-button fill="outline" @click="rejectAllChanges">
            Reject All Changes
          </ion-button>
        </div>
      </div>
      <!-- Manual Edit Mode -->
      <div v-if="mergeMode === 'manual'" class="manual-edit-container">
        <div class="edit-controls">
          <ion-button fill="outline" size="small" @click="insertFromBase">
            Insert from {{ getVersionLabel(baseVersion) }}
          </ion-button>
          <ion-button fill="outline" size="small" @click="insertFromCompare">
            Insert from {{ getVersionLabel(compareVersion) }}
          </ion-button>
          <ion-button fill="clear" size="small" @click="undoEdit" :disabled="!canUndo">
            <ion-icon :icon="arrowUndoOutline" />
          </ion-button>
          <ion-button fill="clear" size="small" @click="redoEdit" :disabled="!canRedo">
            <ion-icon :icon="arrowRedoOutline" />
          </ion-button>
        </div>
        <div class="editor-container">
          <ion-textarea
            v-model="manualEditContent"
            placeholder="Edit the merged content manually..."
            :rows="20"
            fill="outline"
            @ionInput="handleManualEdit"
          />
        </div>
      </div>
      <!-- Merge Actions -->
      <div class="merge-actions">
        <div class="action-info">
          <ion-icon :icon="informationCircleOutline" color="primary" />
          <span>{{ getActionInfo() }}</span>
        </div>
        <div class="action-buttons">
          <ion-button fill="clear" @click="resetMerge">
            Reset
          </ion-button>
          <ion-button 
            fill="solid" 
            color="primary" 
            :disabled="!hasChanges"
            @click="completeMerge"
          >
            Create Merged Version
          </ion-button>
        </div>
      </div>
    </div>
  </ion-content>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonCheckbox,
  IonTextarea,
} from '@ionic/vue';
import {
  eyeOutline,
  documentTextOutline,
  constructOutline,
  informationCircleOutline,
  arrowUndoOutline,
  arrowRedoOutline,
} from 'ionicons/icons';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import * as diff from 'diff';
// import { marked } from 'marked';
import type { Deliverable } from '@/types/deliverable';

interface Props {
  deliverable: Deliverable;
}
interface Emits {
  (e: 'merge-completed', mergedDeliverable: Deliverable): void;
  (e: 'merge-cancelled'): void;
}
const props = defineProps<Props>();
const emit = defineEmits<Emits>();
// Store
const deliverablesStore = useDeliverablesStore();
// Reactive state
const baseVersion = ref<'current' | 'latest' | 'previous'>('current');
const compareVersion = ref<'current' | 'latest' | 'previous'>('latest');
const mergeMode = ref<'visual' | 'text' | 'manual'>('visual');
const selectedSections = ref<Map<string, boolean>>(new Map());
const manualEditContent = ref('');
const editHistory = ref<string[]>([]);
const editHistoryIndex = ref(-1);
const versions = ref<Deliverable[]>([]);
// Computed properties
const currentVersion = computed(() => props.deliverable);
const latestVersion = computed(() => versions.value.find(v => v.is_latest_version) || currentVersion.value);
const previousVersion = computed(() => {
  const sorted = [...versions.value].sort((a, b) => a.version - b.version);
  const currentIndex = sorted.findIndex(v => v.id === currentVersion.value.id);
  return currentIndex > 0 ? sorted[currentIndex - 1] : null;
});
const hasChanges = computed(() => {
  return selectedSections.value.size > 0 || 
         manualEditContent.value !== currentVersion.value.content;
});
const canUndo = computed(() => editHistoryIndex.value > 0);
const canRedo = computed(() => editHistoryIndex.value < editHistory.value.length - 1);
const baseSections = computed(() => {
  const version = getVersionByType(baseVersion.value);
  return parseContentIntoSections(version?.content || '');
});
const compareSections = computed(() => {
  const version = getVersionByType(compareVersion.value);
  return parseContentIntoSections(version?.content || '');
});
const textDiffContent = computed(() => {
  const baseContent = getVersionByType(baseVersion.value)?.content || '';
  const compareContent = getVersionByType(compareVersion.value)?.content || '';
  const diffResult = diff.diffLines(baseContent, compareContent);
  return diffResult.map(part => {
    const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
    return prefix + part.value;
  }).join('');
});
const mergedContent = computed(() => {
  const selectedBaseSections = baseSections.value.filter((_, index) => 
    isSectionSelected(index, 'base')
  );
  const selectedCompareSections = compareSections.value.filter((_, index) => 
    isSectionSelected(index, 'compare')
  );
  const allSelected = [...selectedBaseSections, ...selectedCompareSections];
  return allSelected.map(section => section.content).join('\n\n');
});
// Methods
const loadVersions = async () => {
  try {
    const parentId = currentVersion.value.parent_deliverable_id || currentVersion.value.id;
    versions.value = await deliverablesStore.getDeliverableVersions(parentId);
  } catch {
    versions.value = [currentVersion.value];
  }
};
const getVersionByType = (type: 'current' | 'latest' | 'previous') => {
  switch (type) {
    case 'current':
      return currentVersion.value;
    case 'latest':
      return latestVersion.value;
    case 'previous':
      return previousVersion.value;
    default:
      return currentVersion.value;
  }
};
const getVersionLabel = (type: string) => {
  const labels = {
    current: `Current (v${currentVersion.value.version})`,
    latest: `Latest (v${latestVersion.value.version})`,
    previous: previousVersion.value ? `Previous (v${previousVersion.value.version})` : 'Previous',
  };
  return labels[type as keyof typeof labels] || type;
};
const parseContentIntoSections = (content: string) => {
  if (currentVersion.value.format === 'markdown') {
    // Parse markdown sections (headings, paragraphs, lists, etc.)
    const lines = content.split('\n');
    const sections: Array<{ type: string; content: string; lines: string[]; level?: number }> = [];
    let currentSection: { type: string; content: string; lines: string[]; level?: number } = { type: 'paragraph', content: '', lines: [] as string[] };
    for (const line of lines) {
      if (line.startsWith('#')) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          type: 'heading',
          content: line,
          lines: [line],
          level: (line.match(/^#+/) || [''])[0].length,
        };
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\./)) {
        if (currentSection.type !== 'list') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'list', content: line, lines: [line] };
        } else {
          currentSection.content += '\n' + line;
          currentSection.lines.push(line);
        }
      } else if (line.trim() === '') {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
          currentSection = { type: 'paragraph', content: '', lines: [] };
        }
      } else {
        if (currentSection.type === 'heading' || currentSection.type === 'list') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'paragraph', content: line, lines: [line] };
        } else {
          currentSection.content += (currentSection.content ? '\n' : '') + line;
          currentSection.lines.push(line);
        }
      }
    }
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }
    return sections;
  } else {
    // For non-markdown, split by paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    return paragraphs.map((p, index) => ({
      type: 'paragraph',
      content: p,
      lines: p.split('\n'),
      index,
    }));
  }
};
// renderSection function removed - not used in template
const getSectionClass = (section: { type: string; content: string; lines: string[]; level?: number }, pane: 'base' | 'compare') => {
  const key = `${pane}-${section.type}-${section.content.substring(0, 50)}`;
  const isSelected = selectedSections.value.get(key);
  return {
    'selected': isSelected,
    [`section-${section.type}`]: true,
    'has-changes': pane === 'compare' && hasContentChanges(section),
  };
};
const isSectionSelected = (index: number, pane: 'base' | 'compare') => {
  const sections = pane === 'base' ? baseSections.value : compareSections.value;
  const section = sections[index];
  if (!section) return false;
  const key = `${pane}-${index}-${section.content.substring(0, 50)}`;
  return selectedSections.value.get(key) || false;
};
const toggleSectionSelection = (index: number, pane: 'base' | 'compare') => {
  const sections = pane === 'base' ? baseSections.value : compareSections.value;
  const section = sections[index];
  if (!section) return;
  const key = `${pane}-${index}-${section.content.substring(0, 50)}`;
  const currentValue = selectedSections.value.get(key) || false;
  const newMap = new Map(selectedSections.value);
  newMap.set(key, !currentValue);
  selectedSections.value = newMap;
};
const hasContentChanges = (section: { type: string; content: string; lines: string[]; level?: number }) => {
  // Simple heuristic to detect if section has changes
  const baseContent = getVersionByType(baseVersion.value)?.content || '';
  return !baseContent.includes(section.content);
};
const handleModeChange = (event: CustomEvent) => {
  mergeMode.value = event.detail.value;
  if (mergeMode.value === 'manual' && !manualEditContent.value) {
    manualEditContent.value = currentVersion.value.content;
    addToEditHistory(manualEditContent.value);
  }
};
const handleManualEdit = () => {
  addToEditHistory(manualEditContent.value);
};
const addToEditHistory = (content: string) => {
  // Remove any history after current index
  editHistory.value = editHistory.value.slice(0, editHistoryIndex.value + 1);
  // Add new content
  editHistory.value.push(content);
  editHistoryIndex.value = editHistory.value.length - 1;
  // Limit history to 50 items
  if (editHistory.value.length > 50) {
    editHistory.value = editHistory.value.slice(-50);
    editHistoryIndex.value = editHistory.value.length - 1;
  }
};
const undoEdit = () => {
  if (canUndo.value) {
    editHistoryIndex.value--;
    manualEditContent.value = editHistory.value[editHistoryIndex.value];
  }
};
const redoEdit = () => {
  if (canRedo.value) {
    editHistoryIndex.value++;
    manualEditContent.value = editHistory.value[editHistoryIndex.value];
  }
};
const insertFromBase = () => {
  const baseContent = getVersionByType(baseVersion.value)?.content || '';
  const cursorPos = 0; // TODO: Get actual cursor position
  const before = manualEditContent.value.substring(0, cursorPos);
  const after = manualEditContent.value.substring(cursorPos);
  manualEditContent.value = before + '\n' + baseContent + '\n' + after;
  addToEditHistory(manualEditContent.value);
};
const insertFromCompare = () => {
  const compareContent = getVersionByType(compareVersion.value)?.content || '';
  const cursorPos = 0; // TODO: Get actual cursor position
  const before = manualEditContent.value.substring(0, cursorPos);
  const after = manualEditContent.value.substring(cursorPos);
  manualEditContent.value = before + '\n' + compareContent + '\n' + after;
  addToEditHistory(manualEditContent.value);
};
const acceptAllChanges = () => {
  const compareContent = getVersionByType(compareVersion.value)?.content || '';
  manualEditContent.value = compareContent;
  addToEditHistory(manualEditContent.value);
};
const rejectAllChanges = () => {
  const baseContent = getVersionByType(baseVersion.value)?.content || '';
  manualEditContent.value = baseContent;
  addToEditHistory(manualEditContent.value);
};
const resetMerge = () => {
  selectedSections.value = new Map();
  manualEditContent.value = currentVersion.value.content;
  editHistory.value = [manualEditContent.value];
  editHistoryIndex.value = 0;
};
const getActionInfo = () => {
  if (mergeMode.value === 'visual') {
    const selectedCount = selectedSections.value.size;
    return `${selectedCount} sections selected for merge`;
  } else if (mergeMode.value === 'text') {
    return 'Review and accept/reject changes line by line';
  } else {
    return 'Manually edit the merged content';
  }
};
const completeMerge = async () => {
  try {
    let mergedContent = '';
    if (mergeMode.value === 'visual') {
      // Combine selected sections
      const selectedFromBase = baseSections.value.filter((_, index) => 
        isSectionSelected(index, 'base')
      );
      const selectedFromCompare = compareSections.value.filter((_, index) => 
        isSectionSelected(index, 'compare')
      );
      mergedContent = [...selectedFromBase, ...selectedFromCompare]
        .map(section => section.content)
        .join('\n\n');
    } else if (mergeMode.value === 'manual') {
      mergedContent = manualEditContent.value;
    } else {
      // For text diff mode, use the latest version content for now
      mergedContent = latestVersion.value.content;
    }
    // Create new version with merged content
    const newVersion = await deliverablesStore.createVersion(
      currentVersion.value.parent_deliverable_id || currentVersion.value.id,
      {
        title: `${currentVersion.value.title} (Merged)`,
        content: mergedContent,
        created_by_agent: 'merge_tool',
        metadata: {
          merge_source: `v${currentVersion.value.version} + v${latestVersion.value.version}`,
          merge_mode: mergeMode.value,
          merged_at: new Date().toISOString(),
        }
      }
    );
    emit('merge-completed', newVersion);
  } catch {
    // TODO: Show error toast
  }
};
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
// Initialize
onMounted(() => {
  loadVersions();
  manualEditContent.value = currentVersion.value.content;
  addToEditHistory(manualEditContent.value);
});
</script>
<style scoped>
.merge-content {
  --background: var(--ion-color-step-25);
}
.merge-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}
.version-selector {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.version-option {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 2px solid var(--ion-color-light);
  border-radius: 8px;
  transition: all 0.2s ease;
}
.version-option:hover {
  border-color: var(--ion-color-primary);
}
.merge-mode-section {
  margin-bottom: 24px;
}
.visual-diff-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.diff-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 400px;
}
.diff-pane {
  border-right: 1px solid var(--ion-color-light);
  overflow-y: auto;
}
.diff-pane:last-child {
  border-right: none;
}
.diff-pane h4 {
  margin: 0;
  padding: 16px;
  background: var(--ion-color-step-50);
  border-bottom: 1px solid var(--ion-color-light);
  font-weight: 600;
}
.content-display {
  padding: 16px;
}
.content-section {
  margin-bottom: 16px;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.content-section:hover {
  background: var(--ion-color-step-50);
  border-color: var(--ion-color-primary-tint);
}
.content-section.selected {
  background: #e3f2fd;
  border-color: var(--ion-color-primary);
}
.content-section.has-changes {
  border-left: 4px solid var(--ion-color-warning);
}
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.section-label {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: capitalize;
}
.section-content {
  font-size: 0.95em;
  line-height: 1.5;
}
.merge-preview {
  border-top: 1px solid var(--ion-color-light);
  padding: 16px;
  background: var(--ion-color-step-25);
}
.merge-preview h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  color: var(--ion-color-dark);
}
.preview-content {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--ion-color-light);
  max-height: 300px;
  overflow-y: auto;
}
.text-diff-container {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.diff-display {
  margin-bottom: 16px;
}
.diff-content {
  background: var(--ion-color-step-50);
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}
.merge-controls {
  display: flex;
  gap: 12px;
}
.manual-edit-container {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.edit-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}
.editor-container {
  border-radius: 8px;
  overflow: hidden;
}
.merge-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.action-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.action-buttons {
  display: flex;
  gap: 12px;
}
/* Diff highlighting */
.diff-content :deep(.diff-added) {
  background: #d4edda;
  color: #155724;
  text-decoration: none;
}
.diff-content :deep(.diff-removed) {
  background: #f8d7da;
  color: #721c24;
  text-decoration: line-through;
}
.diff-content :deep(.diff-unchanged) {
  color: var(--ion-color-dark);
}
/* Section type styling */
.section-heading .section-content {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--ion-color-primary);
}
.section-list .section-content {
  font-family: monospace;
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .merge-container {
    --background: var(--ion-color-dark);
  }
  .version-selector,
  .visual-diff-container,
  .text-diff-container,
  .manual-edit-container,
  .merge-actions {
    background: var(--ion-color-dark-shade);
  }
  .version-option {
    border-color: var(--ion-color-dark-tint);
  }
  .diff-pane {
    border-color: var(--ion-color-dark-tint);
  }
  .diff-pane h4 {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  .content-section.selected {
    background: #1e3a8a;
    border-color: #3b82f6;
  }
  .preview-content {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  .diff-content {
    background: var(--ion-color-dark);
  }
}
/* Mobile responsive */
@media (max-width: 768px) {
  .version-selector {
    flex-direction: column;
  }
  .diff-panes {
    grid-template-columns: 1fr;
  }
  .diff-pane {
    border-right: none;
    border-bottom: 1px solid var(--ion-color-light);
  }
  .diff-pane:last-child {
    border-bottom: none;
  }
  .merge-actions {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  .action-buttons {
    justify-content: center;
  }
}
</style>