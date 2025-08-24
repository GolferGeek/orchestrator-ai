<template>
  <ion-page class="landing-page">
    <!-- Landing Header -->
    <LandingHeader />
    <ion-content :fullscreen="true" class="landing-content">
      <!-- Hero Section -->
      <HeroSection />
      <!-- Progressive Disclosure Navigation -->
      <ProgressiveDisclosure @section-toggled="handleSectionToggle" />
      <!-- What We've Built Section -->
      <WhatWeBuiltSection v-show="activeSections.includes('what-we-built')" />
      <!-- Small Company Advantage Section -->
      <SmallCompanyAdvantage 
        v-show="activeSections.includes('small-company-advantage')" 
        @scroll-to-pricing="handleScrollToPricing"
      />
      <!-- Anti-Influencer Section -->
      <AntiInfluencerSection 
        v-show="activeSections.includes('anti-influencer')" 
        @scroll-to-pricing="handleScrollToPricing"
      />
      <!-- Pricing Section -->
      <PricingSection v-show="activeSections.includes('pricing') || shouldShowPricing" @schedule-call="handleScheduleCall" />
      <!-- Our Purpose Section -->
      <PurposeSection 
        v-show="activeSections.includes('our-purpose')" 
        @scroll-to-pricing="handleScrollToPricing"
      />
      <!-- CTA Section -->
      <CTASection />
      <!-- Video Gallery Link -->
      <div class="video-gallery-link">
        <ion-button 
          fill="clear" 
          color="primary"
          @click="$router.push('/videos')"
        >
          <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
          See All Demos & Behind-the-Scenes Videos
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { playCircleOutline } from 'ionicons/icons';
// Import landing page components
import LandingHeader from '@/components/landing/LandingHeader.vue';
import HeroSection from '@/components/landing/HeroSection.vue';
import ProgressiveDisclosure from '@/components/landing/ProgressiveDisclosure.vue';
import WhatWeBuiltSection from '@/components/landing/WhatWeBuiltSection.vue';
import SmallCompanyAdvantage from '@/components/landing/SmallCompanyAdvantage.vue';
import AntiInfluencerSection from '@/components/landing/AntiInfluencerSection.vue';
import PricingSection from '@/components/landing/PricingSection.vue';
import PurposeSection from '@/components/landing/PurposeSection.vue';
import CTASection from '@/components/landing/CTASection.vue';
// Landing page store
import { useLandingStore } from '@/stores/landingStore';
const landingStore = useLandingStore();
const activeSections = ref<string[]>([]);
const shouldShowPricing = ref(false);
function handleSectionToggle(sectionId: string, isActive: boolean) {
  if (isActive && !activeSections.value.includes(sectionId)) {
    activeSections.value.push(sectionId);
  } else if (!isActive) {
    activeSections.value = activeSections.value.filter(id => id !== sectionId);
  }
}
function handleScheduleCall() {
  // Scroll to CTA section or trigger Calendly
  const ctaSection = document.getElementById('cta-section');
  if (ctaSection) {
    ctaSection.scrollIntoView({ behavior: 'smooth' });
  }
}
function handleScrollToPricing() {
  // Show pricing section and scroll to it
  shouldShowPricing.value = true;
  if (!activeSections.value.includes('pricing')) {
    activeSections.value.push('pricing');
  }
  // Scroll to pricing section
  setTimeout(() => {
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
}
onMounted(() => {
  // Initialize landing page analytics
  landingStore.trackPageView('landing');
  // Check URL hash for direct navigation
  if (window.location.hash === '#pricing') {
    shouldShowPricing.value = true;
    activeSections.value.push('pricing');
  }
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#pricing') {
      shouldShowPricing.value = true;
      if (!activeSections.value.includes('pricing')) {
        activeSections.value.push('pricing');
      }
    }
  });
});
</script>
<style scoped>
.landing-page {
  --ion-background-color: var(--landing-light);
  --ion-text-color: var(--landing-dark);
}
.landing-content {
  --background: var(--landing-light);
}
.video-gallery-link {
  text-align: center;
  padding: 2rem;
  background: var(--landing-light);
  border-top: 1px solid #e5e7eb;
}
.video-gallery-link ion-button {
  font-size: 1.1rem;
  --color: var(--landing-primary);
}
</style>
