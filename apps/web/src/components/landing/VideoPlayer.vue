<template>
  <div class="video-player-section">
    <!-- Video Player -->
    <div class="video-container">
      <div v-if="currentVideo" class="video-wrapper">
        <iframe 
          :src="currentVideo.videoUrl" 
          frameborder="0" 
          allowfullscreen
          class="video-iframe"
          title="Video Player"
        ></iframe>
      </div>
      <div v-else class="video-placeholder">
        <ion-icon :icon="playCircleOutline" class="placeholder-icon"></ion-icon>
        <h3>Select a video to get started</h3>
        <p>Choose from the options below to watch our demos and learn more about Orchestrator AI</p>
      </div>
    </div>
    
    <!-- Video Info -->
    <div v-if="currentVideo" class="video-info">
      <h3>{{ currentVideo.title }}</h3>
      <p>{{ currentVideo.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { playCircleOutline } from 'ionicons/icons';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

interface Props {
  currentVideo: Video | null;
}

defineProps<Props>();
</script>

<style scoped>
.video-player-section {
  margin-bottom: 3rem;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.video-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 16px;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  min-height: 300px;
}

.placeholder-icon {
  font-size: 4rem;
  color: var(--landing-accent);
  margin-bottom: 1rem;
}

.video-placeholder h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.video-placeholder p {
  font-size: 1rem;
  opacity: 0.8;
  max-width: 400px;
  line-height: 1.5;
}

.video-info {
  text-align: center;
  margin-top: 1.5rem;
  padding: 0 1rem;
}

.video-info h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: white;
}

.video-info p {
  font-size: 1rem;
  opacity: 0.9;
  line-height: 1.5;
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .video-player-section {
    margin-bottom: 2rem;
  }
  
  .video-container {
    max-width: 100%;
    border-radius: 12px;
  }
  
  .video-iframe {
    border-radius: 12px;
  }
  
  .video-placeholder {
    padding: 3rem 1.5rem;
    min-height: 250px;
  }
  
  .placeholder-icon {
    font-size: 3rem;
  }
  
  .video-placeholder h3 {
    font-size: 1.25rem;
  }
  
  .video-placeholder p {
    font-size: 0.9rem;
  }
  
  .video-info h3 {
    font-size: 1.25rem;
  }
  
  .video-info p {
    font-size: 0.9rem;
  }
}
</style>
