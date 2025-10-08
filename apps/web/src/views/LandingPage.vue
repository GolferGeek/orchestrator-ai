<template>
  <ion-page class="landing-page">
    <!-- Landing Header -->
    <LandingHeader />
    
    <!-- Section Navigation -->
    <SectionNavigation @section-toggled="handleSectionToggle" />
    
    <ion-content :fullscreen="true" class="landing-content">
      <!-- Hero Section -->
      <HeroSection @open-video-modal="handleOpenVideoModal" />
      <!-- What We've Built Section -->
      <WhatWeBuiltSection 
        id="what-we-built"
        @open-video-modal="handleSectionVideoModal"
      />
      <!-- Small Company Advantage Section -->
      <SmallCompanyAdvantage 
        id="small-company-advantage"
        @scroll-to-pricing="handleScrollToPricing"
        @open-video-modal="handleSectionVideoModal"
      />
      <!-- Anti-Influencer Section -->
      <AntiInfluencerSection 
        id="anti-influencer"
        @scroll-to-pricing="handleScrollToPricing"
        @open-video-modal="handleSectionVideoModal"
      />
      <!-- Pricing Section -->
      <PricingSection 
        id="pricing"
        @schedule-call="handleScheduleCall"
        @open-video-modal="handleSectionVideoModal"
      />
      <!-- Our Purpose Section -->
      <PurposeSection 
        id="our-purpose"
        @scroll-to-pricing="handleScrollToPricing"
        @open-video-modal="handleSectionVideoModal"
      />
      <!-- CTA Section -->
      <CTASection @open-video-modal="handleSectionVideoModal" />
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
    
    <!-- Video Modal -->
    <VideoModal 
      :is-open="isVideoModalOpen"
      :video-title="currentVideo?.title || ''"
      :video-description="currentVideo?.description || ''"
      :video-url="currentVideo?.url"
      @close="closeVideoModal"
    />
  </ion-page>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { playCircleOutline } from 'ionicons/icons';
// Import landing page components
import LandingHeader from '@/components/landing/LandingHeader.vue';
import SectionNavigation from '@/components/landing/SectionNavigation.vue';
import HeroSection from '@/components/landing/HeroSection.vue';
import WhatWeBuiltSection from '@/components/landing/WhatWeBuiltSection.vue';
import SmallCompanyAdvantage from '@/components/landing/SmallCompanyAdvantage.vue';
import AntiInfluencerSection from '@/components/landing/AntiInfluencerSection.vue';
import PricingSection from '@/components/landing/PricingSection.vue';
import PurposeSection from '@/components/landing/PurposeSection.vue';
import CTASection from '@/components/landing/CTASection.vue';
import VideoModal from '@/components/landing/VideoModal.vue';
// Landing page store
import { useLandingStore } from '@/stores/landingStore';
// Video service
import { videoService, type Video } from '@/services/videoService';
const landingStore = useLandingStore();

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<Video | null>(null);

function handleSectionToggle(sectionId: string, isActive: boolean) {
  // Scroll to the section when button is clicked
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  // Scroll to pricing section
  const pricingSection = document.getElementById('pricing');
  if (pricingSection) {
    pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function handleOpenVideoModal(video: Video) {
  currentVideo.value = video;
  isVideoModalOpen.value = true;
}

function handleSectionVideoModal(sectionId: string) {
  // Map section IDs to video categories
  const sectionVideoMap: Record<string, string> = {
    'what-we-built': 'introduction',
    'small-company-advantage': 'how-we-work',
    'anti-influencer': 'introduction',
    'pricing': 'how-we-work',
    'our-purpose': 'introduction'
  };
  
  const categoryKey = sectionVideoMap[sectionId] || 'introduction';
  
  // Get the featured video from the specified category
  const category = videoService.getCategory(categoryKey);
  if (category) {
    const featuredVideo = category.videos.find(video => video.featured);
    if (featuredVideo) {
      handleOpenVideoModal(featuredVideo);
    }
  }
}

function closeVideoModal() {
  isVideoModalOpen.value = false;
  currentVideo.value = null;
}
onMounted(() => {
  // Initialize landing page analytics
  landingStore.trackPageView('landing');
  
  // Check URL hash for direct navigation
  if (window.location.hash) {
    const sectionId = window.location.hash.substring(1); // Remove the #
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    if (window.location.hash) {
      const sectionId = window.location.hash.substring(1);
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  border-top: 1px solid var(--ion-color-light-shade);
}
.video-gallery-link ion-button {
  font-size: 1.1rem;
  --color: var(--landing-primary);
}
</style>
