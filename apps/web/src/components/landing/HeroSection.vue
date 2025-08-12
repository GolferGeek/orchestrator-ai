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

      <!-- Hero Video -->
      <div class="video-container" v-if="heroVideoId">
        <iframe 
          :src="`https://www.loom.com/embed/${heroVideoId}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`"
          frameborder="0" 
          webkitallowfullscreen 
          mozallowfullscreen 
          allowfullscreen
          loading="lazy"
          @load="trackVideoView('hero')"
        ></iframe>
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
  peopleOutline 
} from 'ionicons/icons';
import { useLandingStore } from '@/stores/landingStore';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const landingStore = useLandingStore();
const router = useRouter();
const authStore = useAuthStore();

// Hero video ID (will be set when video is recorded)
const heroVideoId = ref(''); // Set this to your Loom video ID when ready

// Computed properties from store
const foundingPartnerCount = computed(() => landingStore.foundingPartnerCount);
const maxFoundingPartners = computed(() => landingStore.maxFoundingPartners);
const foundingPartnersRemaining = computed(() => landingStore.foundingPartnersRemaining);
const progressPercentage = computed(() => landingStore.progressPercentage);

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
}
</style>
