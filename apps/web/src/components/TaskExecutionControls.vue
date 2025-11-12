<template>
  <div class="task-execution-controls" v-if="showControls">
    <!-- Execution Mode Indicator -->
    <div class="execution-mode-indicator" v-if="userPreferences.showExecutionModeIndicator">
      <ion-chip 
        :color="getModeColor(currentMode)" 
        size="small"
        @click="showModeSelector = !showModeSelector"
      >
        <ion-icon :icon="getModeIcon(currentMode)" />
        <ion-label>{{ getModeLabel(currentMode) }}</ion-label>
        <ion-icon :icon="chevronDown" v-if="userPreferences.enableQuickModeToggle" />
      </ion-chip>
    </div>
    <!-- Quick Mode Toggle Buttons -->
    <div class="quick-mode-toggle" v-if="userPreferences.enableQuickModeToggle && showModeSelector">
      <ion-segment 
        :value="currentMode" 
        @ionChange="handleModeChange"
        size="small"
      >
        <ion-segment-button 
          value="immediate" 
          v-if="supportedModes.includes('immediate')"
          :disabled="isSingleModeAgent"
        >
          <ion-icon :icon="flash" />
          <ion-label>Immediate</ion-label>
        </ion-segment-button>
        <ion-segment-button 
          value="polling" 
          v-if="supportedModes.includes('polling')"
          :disabled="isSingleModeAgent"
        >
          <ion-icon :icon="refresh" />
          <ion-label>Polling</ion-label>
        </ion-segment-button>
        <ion-segment-button 
          value="real-time" 
          v-if="supportedModes.includes('real-time')"
          :disabled="isSingleModeAgent"
        >
          <ion-icon :icon="wifi" />
          <ion-label>Real-time</ion-label>
        </ion-segment-button>
        <ion-segment-button 
          value="auto" 
          v-if="supportedModes.includes('auto')"
          :disabled="isSingleModeAgent"
        >
          <ion-icon :icon="speedometer" />
          <ion-label>Auto</ion-label>
        </ion-segment-button>
      </ion-segment>
      <!-- Reset button if overridden -->
      <ion-button 
        v-if="isExecutionModeOverride"
        fill="clear" 
        size="small" 
        @click="resetToDefault"
      >
        <ion-icon :icon="refresh" slot="icon-only" />
      </ion-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonChip,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonButton,
} from '@ionic/vue';
import {
  flash,
  refresh,
  wifi,
  chevronDown,
  speedometer,
} from 'ionicons/icons';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
// Store instances
const chatUiStore = useChatUiStore();
const userPreferencesStore = useUserPreferencesStore();
// Local state
const showModeSelector = ref(false);
// Computed properties
const userPreferences = computed(() => userPreferencesStore.preferences);
const currentMode = computed(() => chatUiStore.effectiveExecutionMode);
const activeConversation = computed(() => chatUiStore.activeConversation);
const isExecutionModeOverride = computed(() => activeConversation.value?.isExecutionModeOverride || false);
const supportedModes = computed(() => {
  return activeConversation.value?.supportedExecutionModes || ['immediate'];
});
const isSingleModeAgent = computed(() => {
  const modes = supportedModes.value;
  return modes.length === 1;
});
const showControls = computed(() => {
  console.log('[TaskExecutionControls] Debug:', {
    hasConversation: !!activeConversation.value,
    hasAgent: !!activeConversation.value?.agent,
    supportedModes: activeConversation.value?.supportedExecutionModes,
    executionMode: activeConversation.value?.executionMode,
    showIndicator: userPreferences.value.showExecutionModeIndicator,
    enableToggle: userPreferences.value.enableQuickModeToggle,
  });
  return activeConversation.value?.agent &&
         (userPreferences.value.showExecutionModeIndicator ||
          userPreferences.value.enableQuickModeToggle);
});
// Helper functions
const getModeColor = (mode: string) => {
  switch (mode) {
    case 'immediate': return 'warning';
    case 'polling': return 'medium'; 
    case 'real-time': return 'success';
    case 'auto': return 'primary';
    default: return 'medium';
  }
};
const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'immediate': return flash;
    case 'polling': return refresh;
    case 'real-time': return wifi;
    case 'auto': return speedometer;
    default: return speedometer;
  }
};
const getModeLabel = (mode: string) => {
  switch (mode) {
    case 'immediate': return 'Immediate';
    case 'polling': return 'Polling';
    case 'real-time': return 'Real-time';
    case 'auto': return 'Auto';
    default: return mode;
  }
};
// Event handlers
const handleModeChange = (event: CustomEvent) => {
  const newMode = event.detail.value as 'immediate' | 'polling' | 'real-time' | 'auto';
  console.log('[TaskExecutionControls] 🔄 Changing execution mode:', {
    from: currentMode.value,
    to: newMode,
    conversationId: activeConversation.value?.id,
  });
  chatUiStore.setExecutionMode(newMode);
  console.log('[TaskExecutionControls] ✅ Mode changed, new effective mode:', chatUiStore.effectiveExecutionMode);
  showModeSelector.value = false;
};
const resetToDefault = () => {
  chatUiStore.resetExecutionMode();
  showModeSelector.value = false;
};
</script>
<style scoped>
.task-execution-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}
.execution-mode-indicator {
  display: flex;
  align-items: center;
}
.execution-mode-indicator ion-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}
.execution-mode-indicator ion-chip:hover {
  transform: scale(1.05);
}
.quick-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border: 1px solid var(--ion-color-medium);
  min-width: 300px;
}
.quick-mode-toggle ion-segment {
  flex: 1;
}
/* Animation for mode selector */
.quick-mode-toggle {
  animation: slideDown 0.2s ease-out;
}
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Dark theme support */
.theme-dark .quick-mode-toggle {
  background: var(--ion-color-dark);
  border-color: var(--ion-color-medium-shade);
}
/* Mobile responsive */
@media (max-width: 768px) {
  .quick-mode-toggle {
    min-width: 250px;
  }
  .quick-mode-toggle ion-segment-button ion-label {
    font-size: 0.8rem;
  }
}
</style>