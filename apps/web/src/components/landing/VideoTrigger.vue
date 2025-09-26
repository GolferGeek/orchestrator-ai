<template>
  <div class="video-trigger">
    <button 
      @click="handleClick"
      class="video-trigger-button"
      :aria-label="`Watch video: ${video.title}`"
      type="button"
    >
      <div class="video-thumbnail">
        <ion-icon :icon="playCircleOutline" class="play-icon"></ion-icon>
        <div class="video-overlay">
          <span class="duration">{{ video.duration }}</span>
        </div>
      </div>
      <div v-if="!hideInfo" class="video-info">
        <h4 class="video-title">{{ video.title }}</h4>
        <p class="video-description">{{ video.description }}</p>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { playCircleOutline } from 'ionicons/icons';
import type { Video } from '@/services/videoService';

interface Props {
  video: Video;
  hideInfo?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  play: [video: Video];
}>();

function handleClick() {
  emit('play', props.video);
}
</script>

<style scoped>
.video-trigger {
  margin: 1rem 0;
}

.video-trigger-button {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  min-height: 44px; /* Accessibility requirement */
}

.video-trigger-button:has(.video-info) {
  /* Default layout when video info is present */
}

.video-trigger-button:not(:has(.video-info)) {
  /* Layout when only thumbnail is present */
  justify-content: center;
  padding: 0.5rem;
}

.video-trigger-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.video-trigger-button:focus {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

.video-thumbnail {
  position: relative;
  flex-shrink: 0;
  width: 120px;
  height: 68px;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-secondary));
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.play-icon {
  font-size: 2rem;
  color: white;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.video-overlay {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.video-info {
  flex: 1;
  min-width: 0;
}

.video-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.3;
}

.video-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .video-trigger-button {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  
  .video-thumbnail {
    width: 100%;
    height: 120px;
  }
  
  .play-icon {
    font-size: 2.5rem;
  }
  
  .video-title {
    font-size: 0.9rem;
  }
  
  .video-description {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .video-trigger-button {
    padding: 0.5rem;
  }
  
  .video-thumbnail {
    height: 100px;
  }
  
  .play-icon {
    font-size: 2rem;
  }
}
</style>
