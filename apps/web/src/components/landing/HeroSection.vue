<template>
  <section class="hero-section">
    <div class="hero-content">
      <!-- Video Player Section -->
      <div class="video-section">
        <h2>AI for Small Business</h2>
        
        <!-- Video Player -->
        <VideoPlayer :current-video="currentVideo" />
        
        <!-- Video Buttons -->
        <div class="video-buttons-grid">
          <button 
            v-for="video in featuredVideos" 
            :key="video.id"
            class="video-button"
            :class="{ active: currentVideo?.id === video.id }"
            @click="selectVideo(video)"
          >
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>{{ video.title }}</span>
          </button>
        </div>
        
        <!-- Demo Highlight Card -->
        <ion-card class="demo-highlight-box">
          <ion-card-header>
            <ion-card-title class="demo-highlight-title">
              🚀 Try the Full App Now
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="demo-highlight-text">
              <strong>Jump right in:</strong> The demo environment is a <span class="highlight">fully functional system</span>—everything you see here (and in the videos) is live and ready for you to explore.
            </p>
            <ul class="demo-highlight-list">
              <li>Log in instantly with the provided demo credentials.</li>
              <li>All agents are active and ready—ask what they do, then try them out!</li>
              <li>Switch between LLM models to see real-time differences in performance.</li>
              <li>This is the exact system we deploy for you, inside your own infrastructure.</li>
            </ul>
            <p class="demo-highlight-text">
              <em>Experience OrchestratorAI hands-on—no waiting, no limitations.</em>
            </p>
            <div class="demo-actions">
              <ion-button size="large" @click="goToDemo">
                Launch Full App
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';
import { 
  playCircleOutline
} from 'ionicons/icons';
import { useLandingStore } from '@/stores/landingStore';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import VideoPlayer from './VideoPlayer.vue';
import { videoService, type Video } from '@/services/videoService';

// Interface for video player (simplified)
interface VideoPlayerVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

const landingStore = useLandingStore();
const router = useRouter();
const authStore = useAuthStore();

// Get featured videos for the hero section
const featuredVideos = computed(() => {
  const videos: VideoPlayerVideo[] = [];
  
  // Get all categories in order
  const categoriesInOrder = videoService.getCategoriesInOrder();
  
  categoriesInOrder.forEach(({ key, category }) => {
    // Get all featured videos from this category
    const featuredVideosInCategory = category.videos.filter(video => video.featured);
    
    featuredVideosInCategory.forEach(video => {
      videos.push({
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl: video.url
      });
    });
  });
  
  return videos;
});

// Current video state
const currentVideo = ref<VideoPlayerVideo | null>(null);

// Emit events to parent (keeping for other sections that still use modal)
const emit = defineEmits<{
  openVideoModal: [video: any];
}>();

function selectVideo(video: VideoPlayerVideo) {
  currentVideo.value = video;
}

function openVideoModal(video: any) {
  emit('openVideoModal', video);
}

function goToDemo() {
  router.push('/login');
}


onMounted(() => {
  // Track hero section view
  landingStore.trackSectionView('hero');
  
  // Set the first video as the default when the page loads
  if (featuredVideos.value.length > 0) {
    currentVideo.value = featuredVideos.value[0];
  }
});
</script>
<style scoped>
.hero-section {
  background: var(--landing-gradient);
  color: white;
  padding: 4rem 0;
  min-height: 60vh;
  display: flex;
  align-items: center;
}

.hero-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 2rem;
  text-align: center;
}

.video-section h2 {
  font-size: 2.5rem;
  margin-bottom: 2rem;
  font-weight: 700;
  color: white;
}

.video-buttons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.video-button {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  backdrop-filter: blur(10px);
}

.video-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.video-button.active {
  background: var(--landing-accent);
  border-color: var(--landing-accent);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);
}

.video-button ion-icon {
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
    min-height: 50vh;
  }
  
  .video-section h2 {
    font-size: 2rem;
    margin-bottom: 1.5rem;
  }
  
  .video-buttons-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .video-button {
    padding: 0.875rem 1rem;
    font-size: 0.9rem;
  }
}

.trust-signals {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 3rem;
  flex-wrap: wrap;
}
.trust-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  font-weight: 500;
}
.trust-item ion-icon {
  font-size: 1.2rem;
  color: var(--landing-accent);
}
/* Match other CTA buttons on the page */
.demo-actions ion-button {
  --background: var(--landing-accent);
  --color: white;
  --border-radius: 8px;
  font-weight: 600;
  width: 100%;
}

.demo-actions ion-button:hover {
  --background: var(--landing-accent-light);
  transform: translateY(-2px);
  transition: var(--transition-smooth);
}
/* Video Carousel Styles */
.video-carousel {
  position: relative;
  margin: 2rem 0;
}

.video-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}

.nav-arrow {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.nav-arrow:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.video-indicators {
  display: flex;
  gap: 0.5rem;
}

.indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: var(--transition-smooth);
}

.indicator.active {
  background: var(--landing-accent);
  transform: scale(1.2);
}

.indicator:hover {
  background: rgba(255, 255, 255, 0.6);
}

.video-title {
  text-align: center;
  margin-top: 1rem;
  color: white;
}

.video-title h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.video-title p {
  font-size: 0.9rem;
  opacity: 0.8;
  margin: 0;
}

@media (max-width: 768px) {
  .trust-signals {
    gap: 1rem;
  }
  .trust-item {
    font-size: 0.8rem;
  }
  .cta-button {
    display: block;
    width: 100%;
    margin: 0.5rem 0;
  }
  .video-navigation {
    gap: 0.5rem;
  }
  .nav-arrow {
    width: 35px;
    height: 35px;
  }
  .video-title h3 {
    font-size: 1rem;
  }
  .video-title p {
    font-size: 0.8rem;
  }
}

/* Demo Highlight Card Styles */
.demo-highlight-box {
  margin: 2rem auto;
  max-width: 800px;
  --background: rgba(255, 255, 255, 0.95);
  --color: var(--landing-dark);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.demo-highlight-title {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0;
  text-align: center;
}

.demo-highlight-text {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--landing-dark);
  margin: 1rem 0;
}

.demo-highlight-text .highlight {
  background: linear-gradient(120deg, var(--landing-accent) 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: var(--font-weight-semibold);
}

.demo-highlight-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  text-align: left;
}

.demo-highlight-list li {
  padding: 0.25rem 0;
  position: relative;
  padding-left: 1.5rem;
  color: var(--landing-dark);
  font-size: var(--text-sm);
}

.demo-highlight-list li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--landing-primary);
  font-weight: bold;
}

.demo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}


@media (max-width: 768px) {
  .demo-highlight-box {
    margin: 1rem auto;
    max-width: 800px;
  }
  
  .demo-highlight-title {
    font-size: 1.5rem;
  }
  
  .demo-highlight-list {
    text-align: center;
  }
  
  .demo-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
