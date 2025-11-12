<template>
  <div class="preferences-panel">
    <div class="panel-header">
      <h2>Settings & Preferences</h2>
      <div class="header-actions">
        <ion-button 
          fill="outline" 
          size="small" 
          @click="exportSettings"
        >
          <ion-icon :icon="download" slot="start" />
          Export
        </ion-button>
        <ion-button 
          fill="outline" 
          size="small" 
          @click="triggerImport"
        >
          <ion-icon :icon="cloudUpload" slot="start" />
          Import
        </ion-button>
      </div>
    </div>
    <!-- Category Tabs -->
    <ion-segment 
      v-model="activeCategory" 
      @ionChange="handleCategoryChange"
      class="category-segment"
    >
      <ion-segment-button value="api">
        <ion-icon :icon="cloudDone" />
        <ion-label>API</ion-label>
      </ion-segment-button>
      <ion-segment-button value="ui">
        <ion-icon :icon="colorPalette" />
        <ion-label>Interface</ion-label>
      </ion-segment-button>
      <ion-segment-button value="chat">
        <ion-icon :icon="chatbubbles" />
        <ion-label>Chat</ion-label>
      </ion-segment-button>
      <ion-segment-button value="execution">
        <ion-icon :icon="playCircle" />
        <ion-label>Task Execution</ion-label>
      </ion-segment-button>
      <ion-segment-button value="performance">
        <ion-icon :icon="speedometer" />
        <ion-label>Performance</ion-label>
      </ion-segment-button>
      <ion-segment-button value="accessibility">
        <ion-icon :icon="accessibility" />
        <ion-label>Accessibility</ion-label>
      </ion-segment-button>
      <ion-segment-button value="developer" v-if="isAdvancedUser">
        <ion-icon :icon="code" />
        <ion-label>Developer</ion-label>
      </ion-segment-button>
    </ion-segment>
    <!-- API Preferences -->
    <div v-if="activeCategory === 'api'" class="preference-section">
      <h3>API Configuration</h3>
      <div class="preference-item">
        <ion-label>
          <h4>Preferred API Version</h4>
          <p>Choose your default API version</p>
        </ion-label>
        <ion-select 
          v-model="preferences.preferredApiVersion"
          @ionChange="updatePreference('preferredApiVersion', $event.detail.value)"
          interface="popover"
        >
          <ion-select-option value="v1">V1 (Stable)</ion-select-option>
          <ion-select-option value="v2">V2 (Enhanced)</ion-select-option>
        </ion-select>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Technology Stack</h4>
          <p>Preferred backend technology</p>
        </ion-label>
        <ion-select 
          v-model="preferences.preferredTechnology"
          @ionChange="updatePreference('preferredTechnology', $event.detail.value)"
          interface="popover"
        >
          <ion-select-option value="typescript-nestjs">TypeScript NestJS</ion-select-option>
        </ion-select>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.autoSwitchToHealthyEndpoint"
          @ionChange="updatePreference('autoSwitchToHealthyEndpoint', $event.detail.checked)"
        />
        <ion-label>
          <h4>Auto-switch to healthy endpoints</h4>
          <p>Automatically switch to available endpoints when current one fails</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.rememberApiSelection"
          @ionChange="updatePreference('rememberApiSelection', $event.detail.checked)"
        />
        <ion-label>
          <h4>Remember API selection</h4>
          <p>Save and restore your API version preference</p>
        </ion-label>
      </div>
    </div>
    <!-- UI Preferences -->
    <div v-if="activeCategory === 'ui'" class="preference-section">
      <h3>Interface Settings</h3>
      <div class="preference-item">
        <ion-label>
          <h4>Theme</h4>
          <p>Choose your preferred color scheme</p>
        </ion-label>
        <ion-segment 
          v-model="preferences.theme"
          @ionChange="updatePreference('theme', $event.detail.value)"
        >
          <ion-segment-button value="light">
            <ion-icon :icon="sunny" />
            <ion-label>Light</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dark">
            <ion-icon :icon="moon" />
            <ion-label>Dark</ion-label>
          </ion-segment-button>
          <ion-segment-button value="auto">
            <ion-icon :icon="contrast" />
            <ion-label>Auto</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Language</h4>
          <p>Interface language</p>
        </ion-label>
        <ion-select 
          v-model="preferences.language"
          @ionChange="updatePreference('language', $event.detail.value)"
          interface="popover"
        >
          <ion-select-option value="en">English</ion-select-option>
          <ion-select-option value="es">Español</ion-select-option>
          <ion-select-option value="fr">Français</ion-select-option>
          <ion-select-option value="de">Deutsch</ion-select-option>
        </ion-select>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.showAdvancedOptions"
          @ionChange="updatePreference('showAdvancedOptions', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show advanced options</h4>
          <p>Display developer and advanced user features</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableDebugMode"
          @ionChange="updatePreference('enableDebugMode', $event.detail.checked)"
        />
        <ion-label>
          <h4>Debug mode</h4>
          <p>Show additional debugging information</p>
        </ion-label>
      </div>
    </div>
    <!-- Chat Preferences -->
    <div v-if="activeCategory === 'chat'" class="preference-section">
      <h3>Chat Settings</h3>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableAutoScroll"
          @ionChange="updatePreference('enableAutoScroll', $event.detail.checked)"
        />
        <ion-label>
          <h4>Auto-scroll</h4>
          <p>Automatically scroll to new messages</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.showTimestamps"
          @ionChange="updatePreference('showTimestamps', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show timestamps</h4>
          <p>Display message timestamps</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableSoundNotifications"
          @ionChange="updatePreference('enableSoundNotifications', $event.detail.checked)"
        />
        <ion-label>
          <h4>Sound notifications</h4>
          <p>Play sound for new messages</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Message History</h4>
          <p>Number of messages to keep in history: {{ preferences.messageHistory }}</p>
        </ion-label>
        <ion-range
          :model-value="preferences.messageHistory"
          @ionChange="updatePreference('messageHistory', Number($event.detail.value))"
          :min="10"
          :max="500"
          :step="10"
          pin
          color="primary"
        />
      </div>
    </div>
    <!-- Task Execution Preferences -->
    <div v-if="activeCategory === 'execution'" class="preference-section">
      <h3>Task Execution Settings</h3>
      <div class="preference-item">
        <ion-label>
          <h4>Default Execution Mode</h4>
          <p>How tasks should be executed by default</p>
        </ion-label>
        <ion-select 
          v-model="preferences.defaultExecutionMode"
          @ionChange="updatePreference('defaultExecutionMode', $event.detail.value)"
          interface="popover"
        >
          <ion-select-option value="immediate">Immediate (Wait for completion)</ion-select-option>
          <ion-select-option value="polling">Polling (Check status periodically)</ion-select-option>
          <ion-select-option value="real-time">Real-time (SSE streaming)</ion-select-option>
          <ion-select-option value="auto">Auto (Let agent choose best mode)</ion-select-option>
        </ion-select>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.autoSwitchToWebSocketForWorkflows"
          @ionChange="updatePreference('autoSwitchToWebSocketForWorkflows', $event.detail.checked)"
        />
        <ion-label>
          <h4>Auto-switch to WebSocket for workflows</h4>
          <p>Automatically use real-time updates for multi-step tasks</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableProgressIndicators"
          @ionChange="updatePreference('enableProgressIndicators', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show progress indicators</h4>
          <p>Display progress bars and step indicators</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.showExecutionModeIndicator"
          @ionChange="updatePreference('showExecutionModeIndicator', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show execution mode indicator</h4>
          <p>Display current execution mode in chat interface</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableQuickModeToggle"
          @ionChange="updatePreference('enableQuickModeToggle', $event.detail.checked)"
        />
        <ion-label>
          <h4>Enable quick mode toggle</h4>
          <p>Show quick toggle buttons in chat header</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Polling Interval</h4>
          <p>How often to check for updates (1-60 seconds)</p>
        </ion-label>
        <ion-range
          v-model="preferences.pollingInterval"
          @ionChange="updatePreference('pollingInterval', $event.detail.value)"
          :min="1"
          :max="60"
          :pin="true"
          :snaps="true"
          :ticks="true"
          color="primary"
        >
          <ion-label slot="start">1s</ion-label>
          <ion-label slot="end">60s</ion-label>
        </ion-range>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Immediate Mode Timeout</h4>
          <p>Maximum wait time for immediate responses (5-300 seconds)</p>
        </ion-label>
        <ion-range
          v-model="preferences.immediateTimeoutDuration"
          @ionChange="updatePreference('immediateTimeoutDuration', $event.detail.value)"
          :min="5"
          :max="300"
          :pin="true"
          :snaps="true"
          :step="5"
          color="primary"
        >
          <ion-label slot="start">5s</ion-label>
          <ion-label slot="end">5min</ion-label>
        </ion-range>
      </div>
    </div>
    <!-- Performance Preferences -->
    <div v-if="activeCategory === 'performance'" class="preference-section">
      <h3>Performance Settings</h3>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableCaching"
          @ionChange="updatePreference('enableCaching', $event.detail.checked)"
        />
        <ion-label>
          <h4>Enable caching</h4>
          <p>Cache API responses for better performance</p>
        </ion-label>
      </div>
      <div class="preference-item" v-if="preferences.enableCaching">
        <ion-label>
          <h4>Cache Duration</h4>
          <p>How long to cache responses: {{ preferences.cacheDuration }} minutes</p>
        </ion-label>
        <ion-range
          :model-value="preferences.cacheDuration"
          @ionChange="updatePreference('cacheDuration', Number($event.detail.value))"
          :min="1"
          :max="120"
          :step="5"
          pin
          color="primary"
        />
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableOfflineMode"
          @ionChange="updatePreference('enableOfflineMode', $event.detail.checked)"
        />
        <ion-label>
          <h4>Offline mode</h4>
          <p>Enable offline functionality when available</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Auto-save Interval</h4>
          <p>Automatically save preferences: {{ preferences.autoSaveInterval }} seconds</p>
        </ion-label>
        <ion-range
          :model-value="preferences.autoSaveInterval"
          @ionChange="updatePreference('autoSaveInterval', Number($event.detail.value))"
          :min="0"
          :max="300"
          :step="10"
          pin
          color="primary"
        />
      </div>
    </div>
    <!-- Accessibility Preferences -->
    <div v-if="activeCategory === 'accessibility'" class="preference-section">
      <h3>Accessibility Settings</h3>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableHighContrast"
          @ionChange="updatePreference('enableHighContrast', $event.detail.checked)"
        />
        <ion-label>
          <h4>High contrast mode</h4>
          <p>Increase contrast for better visibility</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-label>
          <h4>Font Size</h4>
          <p>Choose your preferred text size</p>
        </ion-label>
        <ion-segment 
          v-model="preferences.fontSize"
          @ionChange="updatePreference('fontSize', $event.detail.value)"
        >
          <ion-segment-button value="small">
            <ion-label>Small</ion-label>
          </ion-segment-button>
          <ion-segment-button value="medium">
            <ion-label>Medium</ion-label>
          </ion-segment-button>
          <ion-segment-button value="large">
            <ion-label>Large</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableScreenReader"
          @ionChange="updatePreference('enableScreenReader', $event.detail.checked)"
        />
        <ion-label>
          <h4>Screen reader support</h4>
          <p>Optimize interface for screen readers</p>
        </ion-label>
      </div>
    </div>
    <!-- Developer Preferences -->
    <div v-if="activeCategory === 'developer' && isAdvancedUser" class="preference-section">
      <h3>Developer Settings</h3>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.showApiMetadata"
          @ionChange="updatePreference('showApiMetadata', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show API metadata</h4>
          <p>Display API endpoints, versions, and technical details</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.enableRequestLogging"
          @ionChange="updatePreference('enableRequestLogging', $event.detail.checked)"
        />
        <ion-label>
          <h4>Request logging</h4>
          <p>Log all API requests and responses to console</p>
        </ion-label>
      </div>
      <div class="preference-item">
        <ion-checkbox 
          v-model="preferences.showHealthStatus"
          @ionChange="updatePreference('showHealthStatus', $event.detail.checked)"
        />
        <ion-label>
          <h4>Show health status</h4>
          <p>Display API endpoint health monitoring</p>
        </ion-label>
      </div>
    </div>
    <!-- Action Buttons -->
    <div class="panel-actions">
      <ion-button 
        expand="block" 
        fill="outline" 
        @click="resetCategory"
        color="medium"
      >
        Reset {{ activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1) }} Settings
      </ion-button>
      <ion-button 
        expand="block" 
        fill="outline" 
        @click="resetAllPreferences"
        color="danger"
      >
        Reset All Settings
      </ion-button>
    </div>
    <!-- Hidden file input for import -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonRange,
  alertController
} from '@ionic/vue';
import {
  download,
  cloudUpload,
  cloudDone,
  colorPalette,
  chatbubbles,
  speedometer,
  accessibility,
  code,
  sunny,
  moon,
  contrast,
  playCircle
} from 'ionicons/icons';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';
// Props
interface Props {
  initialCategory?: string;
}
const props = withDefaults(defineProps<Props>(), {
  initialCategory: 'api'
});
// Emits
const emit = defineEmits<{
  preferencesChanged: [category: string, preferences: Record<string, unknown>];
  preferencesReset: [category: string];
}>();
// Store
const userPreferencesStore = useUserPreferencesStore();
// Local state
const activeCategory = ref(props.initialCategory);
const fileInput = ref<HTMLInputElement>();
// Computed properties
const preferences = computed(() => userPreferencesStore.preferences);
const isAdvancedUser = computed(() => userPreferencesStore.isAdvancedUser);
// Methods
const handleCategoryChange = (event: CustomEvent) => {
  activeCategory.value = event.detail.value;
};
const updatePreference = (key: string, value: unknown) => {
  userPreferencesStore.updatePreference(key as string, value);
  emit('preferencesChanged', activeCategory.value, preferences.value);
};
const resetCategory = async () => {
  const alert = await alertController.create({
    header: 'Reset Settings',
    message: `Are you sure you want to reset all ${activeCategory.value} settings to their default values?`,
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Reset',
        role: 'destructive',
        handler: () => {
          // Note: resetToDefaults needs to be implemented in the store
          // userPreferencesStore.resetToDefaults(activeCategory.value);
          emit('preferencesReset', activeCategory.value);
        }
      }
    ]
  });
  await alert.present();
};
const resetAllPreferences = async () => {
  const alert = await alertController.create({
    header: 'Reset All Settings',
    message: 'Are you sure you want to reset ALL settings to their default values? This action cannot be undone.',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Reset All',
        role: 'destructive',
        handler: () => {
          userPreferencesStore.resetPreferences();
          emit('preferencesReset', 'all');
        }
      }
    ]
  });
  await alert.present();
};
const exportSettings = () => {
  const data = userPreferencesStore.exportPreferences();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preferences-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const triggerImport = () => {
  fileInput.value?.click();
};
const handleFileImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    userPreferencesStore.importPreferences(data);
    const alert = await alertController.create({
      header: 'Import Successful',
      message: 'Your preferences have been imported successfully.',
      buttons: ['OK']
    });
    await alert.present();
  } catch {
    const alert = await alertController.create({
      header: 'Import Failed',
      message: 'Failed to import preferences. Please check the file format and try again.',
      buttons: ['OK']
    });
    await alert.present();
  }
};
</script>
<style scoped>
.preferences-panel {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ion-color-light);
}
.panel-header h2 {
  margin: 0;
  color: var(--ion-color-dark);
}
.header-actions {
  display: flex;
  gap: 8px;
}
.category-segment {
  margin-bottom: 24px;
}
.preference-section {
  margin-bottom: 32px;
}
.preference-section h3 {
  margin: 0 0 16px 0;
  color: var(--ion-color-dark);
  font-size: 1.2em;
  font-weight: 600;
}
.preference-item {
  display: flex;
  align-items: center;
  padding: 16px;
  margin-bottom: 8px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--ion-color-light);
  gap: 16px;
}
.preference-item ion-label {
  flex: 1;
}
.preference-item ion-label h4 {
  margin: 0 0 4px 0;
  font-size: 1em;
  font-weight: 500;
  color: var(--ion-color-dark);
}
.preference-item ion-label p {
  margin: 0;
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.preference-item ion-select,
.preference-item ion-segment,
.preference-item ion-range {
  min-width: 200px;
}
.preference-item ion-checkbox {
  margin-right: 16px;
}
.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--ion-color-light);
}
/* Responsive design */
@media (max-width: 768px) {
  .preference-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .preference-item ion-checkbox {
    margin-right: 0;
    order: -1;
  }
  .preference-item ion-select,
  .preference-item ion-segment,
  .preference-item ion-range {
    min-width: unset;
  }
  .panel-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  .header-actions {
    justify-content: center;
  }
}
/* Dark theme support */
.theme-dark .preference-item {
  background: var(--ion-color-dark);
  border-color: var(--ion-color-medium-shade);
}
.theme-dark .panel-header,
.theme-dark .panel-actions {
  border-color: var(--ion-color-medium-shade);
}
</style> 