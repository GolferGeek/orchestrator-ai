<template>
  <ion-page class="video-gallery-page">
    <ion-header>
      <ion-toolbar>
        <ion-title>Video Gallery - Building AI Together</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="$router.push('/')">
            <ion-icon :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="gallery-intro">
        <h1>Video Library</h1>
        <p>All our demos and behind-the-scenes videos in one place.</p>
      </div>

      <!-- Video Links -->
      <div class="video-links">
        <div class="video-link-item">
          <button @click="openVideoModal('introduction')">
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>Introduction</span>
          </button>
        </div>
        <div class="video-link-item">
          <button @click="openVideoModal('privacy-security')">
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>Privacy and Security</span>
          </button>
        </div>
        <div class="video-link-item">
          <button @click="openVideoModal('how-we-work')">
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>How We Work Together</span>
          </button>
        </div>
        <div class="video-link-item">
          <button @click="openVideoModal('evaluations')">
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>Evaluations</span>
          </button>
        </div>
        <div class="video-link-item">
          <button @click="openVideoModal('what-were-working-on-next')">
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>What We're Working On Next</span>
          </button>
        </div>
      </div>
    </ion-content>

    <!-- Video Modal -->
    <VideoModal 
      :is-open="isVideoModalOpen"
      :video-title="currentVideo?.title || ''"
      :video-description="currentVideo?.description || ''"
      :video-url="currentVideo?.videoUrl"
      @close="closeVideoModal"
    />
  </ion-page>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon } from '@ionic/vue';
import { arrowBackOutline, playCircleOutline } from 'ionicons/icons';
import VideoModal from '@/components/landing/VideoModal.vue';

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<any>(null);

// Video data
const videoTopics = [
  {
    id: 'introduction',
    title: 'Introduction',
    description: 'Get to know Orchestrator AI and our mission to build AI workforce solutions for small businesses.',
    videoUrl: 'https://www.loom.com/embed/debf7736e3104891aa8014b65fab9d2f'
  },
  {
    id: 'privacy-security',
    title: 'Privacy & Security',
    description: 'Learn about our on-premise deployment and privacy-first approach to AI workforce management.',
    videoUrl: 'https://www.loom.com/embed/ff5bc018a69148dfa42ad733831bdb6c'
  },
  {
    id: 'how-we-work',
    title: 'How We Work Together',
    description: 'Discover our collaborative approach and how we customize solutions for your specific business needs.',
    videoUrl: 'https://www.loom.com/embed/3031a8bea61f408186cdf2e088cb4c92'
  },
  {
    id: 'evaluations',
    title: 'Evaluations',
    description: 'See how our AI agents evaluate and improve their performance through continuous learning.',
    videoUrl: 'https://www.loom.com/embed/592bc517179247bd8e7a3c38e0a4413c'
  },
  {
    id: 'what-were-working-on-next',
    title: 'What We\'re Working On Next',
    description: 'See what exciting features and improvements we\'re building for the future.',
    videoUrl: 'https://www.loom.com/embed/b449f8d3a0f8470389facea3e30aaf87'
  }
];

function openVideoModal(videoId: string) {
  const video = videoTopics.find(v => v.id === videoId);
  if (video) {
    currentVideo.value = video;
    isVideoModalOpen.value = true;
  }
}

function closeVideoModal() {
  isVideoModalOpen.value = false;
  currentVideo.value = null;
}
</script>
<style scoped>
.video-gallery-page {
  --ion-background-color: var(--landing-light);
}
.gallery-intro {
  text-align: center;
  margin-bottom: 3rem;
}
.gallery-intro h1 {
  font-size: 2.5rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
}
.gallery-intro p {
  font-size: 1.1rem;
  color: var(--ion-color-medium);
  max-width: 600px;
  margin: 0 auto;
}

/* Video Links Styles */
.video-links {
  max-width: 600px;
  margin: 0 auto;
}

.video-link-item {
  margin-bottom: 1rem;
}

.video-link-item button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: white;
  border: 2px solid var(--ion-color-light-shade);
  border-radius: 12px;
  color: var(--landing-dark);
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
  text-align: left;
}

.video-link-item button:hover {
  border-color: var(--landing-primary);
  background: var(--landing-primary-50);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.video-link-item button ion-icon {
  font-size: 1.3rem;
  color: var(--landing-primary);
}

.video-link-item button span {
  flex: 1;
}
.category-section {
  margin-bottom: 3rem;
}
.category-section h2 {
  color: var(--landing-primary);
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--landing-primary);
  padding-bottom: 0.5rem;
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}
.video-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: var(--transition-smooth);
}
.video-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}
.video-placeholder {
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, var(--ion-color-light-tint), var(--ion-color-light-shade));
  border: 2px dashed var(--ion-color-light-shade);
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.video-placeholder h3 {
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}
.video-placeholder p {
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
}
.video-placeholder em {
  color: var(--landing-primary);
  font-style: italic;
}
.gallery-cta {
  text-align: center;
  padding: 3rem 0;
  background: var(--landing-gradient);
  border-radius: 16px;
  color: white;
  margin-top: 3rem;
}
.gallery-cta h2 {
  margin-bottom: 1.5rem;
}
.gallery-cta ion-button {
  --background: var(--landing-accent);
  --color: white;
  font-weight: 600;
}
</style>
