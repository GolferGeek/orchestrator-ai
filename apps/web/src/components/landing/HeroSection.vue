<template>
  <section class="hero-section">
    <div class="hero-content">
      <!-- Video Buttons Section -->
      <div class="video-buttons-section">
        <h2>Let's Build Something Together</h2>
        <div class="video-buttons-grid">
          <button 
            v-for="video in videoTopics" 
            :key="video.id"
            class="video-button"
            @click="openVideoModal(video)"
          >
            <ion-icon :icon="playCircleOutline"></ion-icon>
            <span>{{ video.title }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { 
  playCircleOutline
} from 'ionicons/icons';
import { useLandingStore } from '@/stores/landingStore';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
const landingStore = useLandingStore();
const router = useRouter();
const authStore = useAuthStore();

// Video topics for the hero section
const videoTopics = ref([
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
    id: 'comparing-llms',
    title: 'Comparing LLMs',
    description: 'Understand how we help you choose the right AI models for your specific use cases.',
    videoUrl: 'https://www.loom.com/embed/debf7736e3104891aa8014b65fab9d2f'
  }
]);

// Emit events to parent
const emit = defineEmits<{
  openVideoModal: [video: any];
}>();

function openVideoModal(video: any) {
  emit('openVideoModal', video);
}

onMounted(() => {
  // Track hero section view
  landingStore.trackSectionView('hero');
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

.video-buttons-section h2 {
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

.video-button ion-icon {
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
    min-height: 50vh;
  }
  
  .video-buttons-section h2 {
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
.cta-button {
  margin: 0 0.5rem;
  font-weight: 600;
  --border-radius: 8px;
}
.cta-button.primary {
  --background: var(--landing-accent);
  --color: white;
  --box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
}
.cta-button.secondary {
  --color: white;
  --border-color: rgba(255, 255, 255, 0.5);
}
.cta-button.app-access {
  --color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.cta-button.app-access:hover {
  --color: white;
}
.cta-button:hover {
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
</style>
