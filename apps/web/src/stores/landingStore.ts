import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
interface VideoAnalytics {
  videoId: string;
  views: number;
  completions: number;
  lastViewed: Date;
}
interface SectionProgress {
  heroViewed: boolean;
  featuresViewed: boolean;
  pricingViewed: boolean;
  ctaClicked: boolean;
}
export const useLandingStore = defineStore('landing', () => {
  // State
  const foundingPartnerCount = ref(0);
  const maxFoundingPartners = ref(5);
  const currentSection = ref(0);
  const sectionProgress = ref<SectionProgress>({
    heroViewed: false,
    featuresViewed: false,
    pricingViewed: false,
    ctaClicked: false
  });
  const videoAnalytics = ref<VideoAnalytics[]>([]);
  const emailCaptures = ref<string[]>([]);
  const calendarBookings = ref(0);
  // Computed
  const foundingPartnersRemaining = computed(() => 
    maxFoundingPartners.value - foundingPartnerCount.value
  );
  const progressPercentage = computed(() => 
    (foundingPartnerCount.value / maxFoundingPartners.value) * 100
  );
  const isFoundingPartnerAvailable = computed(() => 
    foundingPartnerCount.value < maxFoundingPartners.value
  );
  // Actions
  function trackPageView(_page: string) {
    // Analytics tracking
    // Track with your analytics service
    // gtag('event', 'page_view', { page_title: page });
  }
  function trackSectionView(section: string) {
    // Update section progress
    if (section === 'hero') sectionProgress.value.heroViewed = true;
    if (section === 'features') sectionProgress.value.featuresViewed = true;
    if (section === 'pricing') sectionProgress.value.pricingViewed = true;
  }
  function trackVideoView(videoId: string) {
    const existing = videoAnalytics.value.find(v => v.videoId === videoId);
    if (existing) {
      existing.views++;
      existing.lastViewed = new Date();
    } else {
      videoAnalytics.value.push({
        videoId,
        views: 1,
        completions: 0,
        lastViewed: new Date()
      });
    }
  }
  function trackVideoCompletion(videoId: string) {
    const existing = videoAnalytics.value.find(v => v.videoId === videoId);
    if (existing) {
      existing.completions++;
    }
  }
  function captureEmail(email: string) {
    if (!emailCaptures.value.includes(email)) {
      emailCaptures.value.push(email);
      // Send to your email service
    }
  }
  function trackCalendarBooking() {
    calendarBookings.value++;
    sectionProgress.value.ctaClicked = true;
  }
  function updateFoundingPartnerCount(count: number) {
    foundingPartnerCount.value = Math.min(count, maxFoundingPartners.value);
  }
  function advanceSection() {
    if (currentSection.value < 5) {
      currentSection.value++;
    }
  }
  function resetProgress() {
    currentSection.value = 0;
    sectionProgress.value = {
      heroViewed: false,
      featuresViewed: false,
      pricingViewed: false,
      ctaClicked: false
    };
  }
  return {
    // State
    foundingPartnerCount,
    maxFoundingPartners,
    currentSection,
    sectionProgress,
    videoAnalytics,
    emailCaptures,
    calendarBookings,
    // Computed
    foundingPartnersRemaining,
    progressPercentage,
    isFoundingPartnerAvailable,
    // Actions
    trackPageView,
    trackSectionView,
    trackVideoView,
    trackVideoCompletion,
    captureEmail,
    trackCalendarBooking,
    updateFoundingPartnerCount,
    advanceSection,
    resetProgress
  };
});
