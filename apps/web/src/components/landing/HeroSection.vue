<template>
  <section class="hero-section">
    <div class="hero-content">
      <!-- Founding Partner Counter -->
      <div class="counter-container">
        <div class="counter-label">Founding Partners</div>
        <div class="partner-counter">{{ foundingPartnerCount }} of {{ maxFoundingPartners }}</div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
        <div class="counter-sublabel">
          {{ foundingPartnersRemaining }} spots remaining for exclusive early access
        </div>
      </div>
      <!-- Main Hero Content -->
      <h1 class="hero-title">
        AI Workforce for Small Businesses
        <br />
        <span style="color: var(--landing-accent);">Building Together</span>
      </h1>
      <p class="hero-subtitle">
        39 specialized AI agents. On-premise deployment. Zero clients yet.<br />
        <strong>Let's build something real together.</strong>
      </p>
      <!-- Hero Video Carousel -->
      <div class="video-carousel" v-if="heroVideos.length > 0">
        <div class="video-container">
          <iframe 
            :src="`https://www.loom.com/embed/${currentVideoId}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`"
            frameborder="0" 
            webkitallowfullscreen 
            mozallowfullscreen 
            allowfullscreen
            loading="lazy"
            @load="trackVideoView('hero')"
          ></iframe>
        </div>
        <!-- Video Navigation -->
        <div class="video-navigation" v-if="heroVideos.length > 1">
          <button 
            class="nav-arrow nav-prev" 
            @click="previousVideo"
            :disabled="currentVideoIndex === 0"
          >
            <ion-icon :icon="chevronBackOutline"></ion-icon>
          </button>
          <div class="video-indicators">
            <span 
              v-for="(video, index) in heroVideos" 
              :key="index"
              class="indicator"
              :class="{ active: index === currentVideoIndex }"
              @click="goToVideo(index)"
            ></span>
          </div>
          <button 
            class="nav-arrow nav-next" 
            @click="nextVideo"
            :disabled="currentVideoIndex === heroVideos.length - 1"
          >
            <ion-icon :icon="chevronForwardOutline"></ion-icon>
          </button>
        </div>
        <!-- Video Title -->
        <div class="video-title">
          <h3>{{ currentVideo.title }}</h3>
          <p>{{ currentVideo.description }}</p>
        </div>
      </div>
      <div class="video-placeholder" v-else>
        <h3>🎬 "Here's What We Built" Demo</h3>
        <p>Dashboard tour + 3 agent demos (2 min)</p>
        <p><em>Video recording in progress...</em></p>
      </div>
      <!-- CTA Buttons -->
      <div class="hero-cta">
        <ion-button 
          size="large" 
          class="cta-button primary"
          @click="scrollToSection('pricing')"
        >
          <ion-icon slot="start" :icon="rocketOutline"></ion-icon>
          Become a Founding Partner
        </ion-button>
        <ion-button 
          size="large" 
          fill="outline" 
          class="cta-button secondary"
          @click="scrollToSection('what-we-built')"
        >
          <ion-icon slot="start" :icon="eyeOutline"></ion-icon>
          See What We've Built
        </ion-button>
        <ion-button 
          size="large" 
          fill="clear" 
          class="cta-button app-access"
          @click="navigateToApp"
        >
          <ion-icon slot="start" :icon="appsOutline"></ion-icon>
          Enter App
        </ion-button>
      </div>
      <!-- Trust Signals -->
      <div class="trust-signals">
        <div class="trust-item">
          <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
          <span>On-Premise Deployment</span>
        </div>
        <div class="trust-item">
          <ion-icon :icon="speedometerOutline"></ion-icon>
          <span>Bi-Weekly Updates</span>
        </div>
        <div class="trust-item">
          <ion-icon :icon="peopleOutline"></ion-icon>
          <span>Direct Access to Founder</span>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { 
  rocketOutline, 
  eyeOutline, 
  appsOutline,
  shieldCheckmarkOutline, 
  speedometerOutline, 
  peopleOutline,
  chevronBackOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { useLandingStore } from '@/stores/landingStore';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
const landingStore = useLandingStore();
const router = useRouter();
const authStore = useAuthStore();
// Hero videos array
const heroVideos = ref([
  {
    id: 'debf7736e3104891aa8014b65fab9d2f',
    title: '🎬 "Here\'s What We Built" Demo',
    description: 'Dashboard tour + 3 agent demos (2 min)'
  },
  {
    id: 'ff5bc018a69148dfa42ad733831bdb6c',
    title: '🎬 Additional Demo',
    description: 'More features and capabilities'
  }
]);

// Current video index
const currentVideoIndex = ref(0);

// Computed properties
const currentVideo = computed(() => heroVideos.value[currentVideoIndex.value]);
const currentVideoId = computed(() => currentVideo.value.id);
// Computed properties from store
const foundingPartnerCount = computed(() => landingStore.foundingPartnerCount);
const maxFoundingPartners = computed(() => landingStore.maxFoundingPartners);
const foundingPartnersRemaining = computed(() => landingStore.foundingPartnersRemaining);
const progressPercentage = computed(() => landingStore.progressPercentage);
// Video navigation methods
function nextVideo() {
  if (currentVideoIndex.value < heroVideos.value.length - 1) {
    currentVideoIndex.value++;
  }
}

function previousVideo() {
  if (currentVideoIndex.value > 0) {
    currentVideoIndex.value--;
  }
}

function goToVideo(index: number) {
  currentVideoIndex.value = index;
}

// Methods
function scrollToSection(sectionId: string) {
  // For pricing, scroll to that section
  if (sectionId === 'pricing') {
    setTimeout(() => {
      const element = document.getElementById('pricing');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }
  // For what-we-built, trigger the progressive disclosure
  if (sectionId === 'what-we-built') {
    const button = document.querySelector('[data-section="what-we-built"]') as HTMLElement;
    if (button) {
      button.click();
    }
  }
  // Track interaction
  landingStore.trackSectionView(sectionId);
}
function trackVideoView(videoId: string) {
  landingStore.trackVideoView(videoId);
}
function navigateToApp() {
  // Check if user is already authenticated
  if (authStore.isAuthenticated) {
    // Go directly to the app
    router.push('/app');
  } else {
    // Go to login page with redirect back to app
    router.push('/login?redirect=/app');
  }
  // Track the interaction
  landingStore.trackSectionView('app-access');
}
onMounted(() => {
  // Track hero section view
  landingStore.trackSectionView('hero');
  // Animate progress bar
  setTimeout(() => {
    const progressFill = document.querySelector('.progress-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = progressPercentage.value + '%';
    }
  }, 500);
});
</script>
<style scoped>
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
