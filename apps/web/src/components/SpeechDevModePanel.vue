<template>
  <div v-if="uiStore.showSpeechDevMode" class="speech-dev-panel">
    <div class="dev-mode-header">
      <span class="dev-mode-title">🎤 Speech Mode (Dev)</span>
      <ion-button
        fill="clear"
        size="small"
        color="medium"
        @click="uiStore.toggleSpeechDevMode()"
        class="close-button"
      >
        <ion-icon :icon="closeOutline" slot="icon-only"></ion-icon>
      </ion-button>
    </div>

    <div class="speech-mode-controls">
      <ion-segment
        :value="uiStore.speechMode"
        @ionChange="handleModeChange"
        class="speech-mode-segment"
      >
        <ion-segment-button value="frontend">
          <ion-label>
            <div class="mode-label">Frontend</div>
            <div class="mode-description">Browser → Deepgram → AI → Eleven Labs</div>
          </ion-label>
        </ion-segment-button>

        <ion-segment-button value="backend">
          <ion-label>
            <div class="mode-label">Backend</div>
            <div class="mode-description">Audio → Server Processing → Audio</div>
          </ion-label>
        </ion-segment-button>

        <ion-segment-button value="hybrid">
          <ion-label>
            <div class="mode-label">Hybrid</div>
            <div class="mode-description">Try Both → Use Best Result</div>
          </ion-label>
        </ion-segment-button>
      </ion-segment>
    </div>

    <div class="current-mode-info">
      <span class="current-mode-text">
        Active: <strong>{{ getModeDisplayName() }}</strong> - {{ getModeDescription() }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { useUiStore, type SpeechMode } from '../stores/uiStore';

const uiStore = useUiStore();

const handleModeChange = (event: CustomEvent) => {
  const newMode = event.detail.value as SpeechMode;
  uiStore.setSpeechMode(newMode);
};

const getModeDisplayName = (): string => {
  switch (uiStore.speechMode) {
    case 'frontend': return 'Frontend Processing';
    case 'backend': return 'Backend Processing';
    case 'hybrid': return 'Hybrid Processing';
    default: return 'Backend Processing';
  }
};

const getModeDescription = (): string => {
  switch (uiStore.speechMode) {
    case 'frontend': return 'Browser calls Deepgram/Eleven Labs directly';
    case 'backend': return 'Server handles all speech processing';
    case 'hybrid': return 'Tries both approaches, uses best result';
    default: return 'Server handles all speech processing';
  }
};
</script>

<style scoped>
.speech-dev-panel {
  background: linear-gradient(135deg, var(--ion-color-light-tint) 0%, var(--ion-color-light-shade) 100%);
  border: 1px solid var(--ion-color-light);
  border-radius: 12px;
  margin: 8px 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(var(--ion-color-dark-rgb), 0.1);
  font-size: 0.9rem;
}

.dev-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dev-mode-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.95rem;
}

.close-button {
  --padding-start: 4px;
  --padding-end: 4px;
  height: 24px;
  width: 24px;
}

.speech-mode-controls {
  margin-bottom: 10px;
}

.speech-mode-segment {
  --background: var(--ion-background-color);
  --color-checked: var(--ion-color-primary);
  --indicator-color: var(--ion-color-primary);
  --border-radius: 8px;
  font-size: 0.8rem;
}

.mode-label {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 2px;
}

.mode-description {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-mode-info {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-radius: 6px;
  border-left: 3px solid var(--ion-color-primary);
}

.current-mode-text {
  font-size: 0.8rem;
  color: var(--ion-color-dark);
}

.current-mode-text strong {
  color: var(--ion-color-primary);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .speech-dev-panel {
    margin: 6px 8px;
    padding: 10px;
    font-size: 0.85rem;
  }

  .mode-description {
    font-size: 0.65rem;
  }

  .speech-mode-segment {
    font-size: 0.75rem;
  }

  .mode-label {
    font-size: 0.8rem;
  }
}
</style>
