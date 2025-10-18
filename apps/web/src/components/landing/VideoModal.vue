<template>
  <ion-modal 
    :is-open="isOpen" 
    @did-dismiss="closeModal"
    :backdrop-dismiss="true"
    class="video-modal"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ videoTitle }}</h2>
        <ion-button 
          fill="clear" 
          @click="closeModal"
          class="close-button"
        >
          <ion-icon :icon="closeOutline"></ion-icon>
        </ion-button>
      </div>
      
      <div class="video-container">
        <div v-if="videoUrl" class="video-wrapper">
          <iframe 
            :src="videoUrl" 
            frameborder="0" 
            allowfullscreen
            class="video-iframe"
          ></iframe>
        </div>
        <div v-else class="video-placeholder">
          <ion-icon :icon="playCircleOutline" class="placeholder-icon"></ion-icon>
          <p>Video coming soon...</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <p class="video-description">{{ videoDescription }}</p>
        <div class="modal-actions">
          <ion-button 
            fill="outline" 
            @click="closeModal"
            class="action-button"
          >
            Close
          </ion-button>
          <ion-button 
            @click="navigateToVideos"
            class="action-button primary"
          >
            <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
            See All Videos
          </ion-button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonButton, IonIcon } from '@ionic/vue';
import { closeOutline, playCircleOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';

interface Props {
  isOpen: boolean;
  videoTitle: string;
  videoDescription: string;
  videoUrl?: string;
}

const _props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();

function closeModal() {
  emit('close');
}

function navigateToVideos() {
  closeModal();
  router.push('/videos');
}
</script>

<style scoped>
.video-modal {
  --width: 90%;
  --max-width: 800px;
  --height: 80%;
  --border-radius: 16px;
}

.modal-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: var(--landing-gradient);
  color: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  --color: white;
  --background: rgba(255, 255, 255, 0.1);
  --border-radius: 50%;
  width: 40px;
  height: 40px;
}

.video-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #f8fafc;
}

.video-wrapper {
  width: 100%;
  height: 100%;
  max-height: 400px;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.video-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.video-placeholder {
  text-align: center;
  color: #6b7280;
}

.placeholder-icon {
  font-size: 4rem;
  color: var(--landing-primary);
  margin-bottom: 1rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.video-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.action-button {
  --border-radius: 8px;
  font-weight: 500;
}

.action-button.primary {
  --background: var(--landing-primary);
  --color: white;
}

@media (max-width: 768px) {
  .video-modal {
    --width: 95%;
    --height: 85%;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-header h2 {
    font-size: 1.25rem;
  }
  
  .modal-footer {
    padding: 1rem;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
}
</style>
