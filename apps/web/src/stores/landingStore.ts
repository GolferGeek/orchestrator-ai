import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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

interface AccordionState {
  [sectionId: string]: boolean;
}

interface ViewModeState {
  mode: 'landing' | 'technical';
  lastUpdated: Date;
}
export const useLandingStore = defineStore('landing', () => {
  const route = useRoute();
  const router = useRouter();

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

  // Accordion state management
  const accordionState = ref<AccordionState>({});
  const viewMode = ref<ViewModeState>({
    mode: 'landing',
    lastUpdated: new Date()
  });

  // Storage keys
  const ACCORDION_STATE_KEY = 'landingAccordionState';
  const VIEW_MODE_KEY = 'landingViewMode';
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

  // Accordion and view mode computed properties
  const isMarketingView = computed(() => viewMode.value.mode === 'landing');
  const isTechnicalView = computed(() => viewMode.value.mode === 'technical');
  const openAccordions = computed(() => 
    Object.keys(accordionState.value).filter(id => accordionState.value[id])
  );

  // Accordion state management actions
  function setAccordionState(sectionId: string, isOpen: boolean) {
    accordionState.value[sectionId] = isOpen;
    saveAccordionState();
    updateURLParams();
  }

  function toggleAccordion(sectionId: string) {
    const currentState = accordionState.value[sectionId] || false;
    setAccordionState(sectionId, !currentState);
  }

  function isAccordionOpen(sectionId: string): boolean {
    return accordionState.value[sectionId] || false;
  }

  function setMultipleAccordions(states: AccordionState) {
    accordionState.value = { ...accordionState.value, ...states };
    saveAccordionState();
    updateURLParams();
  }

  function resetAccordionState() {
    accordionState.value = {};
    saveAccordionState();
    updateURLParams();
  }

  // View mode management actions
  function setViewMode(mode: 'landing' | 'technical') {
    viewMode.value = {
      mode,
      lastUpdated: new Date()
    };
    saveViewMode();
    updateURLParams();
  }

  function toggleViewMode() {
    const newMode = viewMode.value.mode === 'landing' ? 'technical' : 'landing';
    setViewMode(newMode);
  }

  // Persistence actions
  function saveAccordionState() {
    try {
      localStorage.setItem(ACCORDION_STATE_KEY, JSON.stringify(accordionState.value));
    } catch (error) {
      console.warn('Failed to save accordion state to localStorage:', error);
    }
  }

  function loadAccordionState() {
    try {
      const stored = localStorage.getItem(ACCORDION_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          accordionState.value = parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load accordion state from localStorage:', error);
    }
  }

  function saveViewMode() {
    try {
      localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(viewMode.value));
    } catch (error) {
      console.warn('Failed to save view mode to localStorage:', error);
    }
  }

  function loadViewMode() {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.mode === 'string' && ['landing', 'technical'].includes(parsed.mode)) {
          viewMode.value = {
            mode: parsed.mode,
            lastUpdated: new Date(parsed.lastUpdated || Date.now())
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load view mode from localStorage:', error);
    }
  }

  // URL parameter management
  function updateURLParams() {
    try {
      const query: Record<string, string> = {};
      
      // Add view mode
      query.view = viewMode.value.mode;
      
      // Add open accordions
      const openAccordionsList = openAccordions.value;
      if (openAccordionsList.length > 0) {
        query.accordions = openAccordionsList.join(',');
      }
      
      // Update URL without triggering navigation
      router.replace({ query });
    } catch (error) {
      console.warn('Failed to update URL parameters:', error);
    }
  }

  function parseURLParams() {
    // Parse view mode from URL
    const urlViewMode = route.query.view as string;
    if (urlViewMode && ['landing', 'technical'].includes(urlViewMode)) {
      viewMode.value.mode = urlViewMode as 'landing' | 'technical';
    }

    // Parse accordion state from URL
    const urlAccordions = route.query.accordions as string;
    if (urlAccordions) {
      const accordionIds = urlAccordions.split(',').filter(id => id.trim());
      const newAccordionState: AccordionState = {};
      accordionIds.forEach(id => {
        newAccordionState[id.trim()] = true;
      });
      accordionState.value = newAccordionState;
    }
  }

  function initializeState() {
    // Load from localStorage first
    loadAccordionState();
    loadViewMode();
    
    // Then override with URL params if present
    parseURLParams();
    
    // Save the final state
    saveAccordionState();
    saveViewMode();
  }

  // Watch for URL changes to sync state
  watch(
    () => route.query,
    () => {
      parseURLParams();
    },
    { deep: true }
  );

  // Actions
  function trackPageView(page: string) {
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
    accordionState,
    viewMode,
    // Computed
    foundingPartnersRemaining,
    progressPercentage,
    isFoundingPartnerAvailable,
    isMarketingView,
    isTechnicalView,
    openAccordions,
    // Accordion actions
    setAccordionState,
    toggleAccordion,
    isAccordionOpen,
    setMultipleAccordions,
    resetAccordionState,
    // View mode actions
    setViewMode,
    toggleViewMode,
    // Persistence actions
    saveAccordionState,
    loadAccordionState,
    saveViewMode,
    loadViewMode,
    // URL management
    updateURLParams,
    parseURLParams,
    initializeState,
    // Original actions
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
