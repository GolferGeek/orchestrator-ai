import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLandingStore } from '../landingStore';
import { useRoute, useRouter } from 'vue-router';

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('LandingStore', () => {
  let store: ReturnType<typeof useLandingStore>;
  let mockRoute: { query: Record<string, unknown> };
  let mockRouter: { replace: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock route
    mockRoute = {
      query: {},
    };
    (useRoute as ReturnType<typeof vi.fn>).mockReturnValue(mockRoute);
    
    // Setup mock router
    mockRouter = {
      replace: vi.fn(),
    };
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);
    
    // Clear localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    
    // Create store instance
    store = useLandingStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Accordion State Management', () => {
    it('should initialize with empty accordion state', () => {
      expect(store.accordionState).toEqual({});
      expect(store.openAccordions).toEqual([]);
    });

    it('should set accordion state correctly', () => {
      store.setAccordionState('section-1', true);
      expect(store.accordionState['section-1']).toBe(true);
      expect(store.isAccordionOpen('section-1')).toBe(true);
      expect(store.openAccordions).toContain('section-1');
    });

    it('should toggle accordion state', () => {
      // Initially closed
      expect(store.isAccordionOpen('section-1')).toBe(false);
      
      // Toggle to open
      store.toggleAccordion('section-1');
      expect(store.isAccordionOpen('section-1')).toBe(true);
      
      // Toggle to closed
      store.toggleAccordion('section-1');
      expect(store.isAccordionOpen('section-1')).toBe(false);
    });

    it('should set multiple accordion states', () => {
      const states = {
        'section-1': true,
        'section-2': false,
        'section-3': true,
      };
      
      store.setMultipleAccordions(states);
      
      expect(store.accordionState).toEqual(states);
      expect(store.openAccordions).toEqual(['section-1', 'section-3']);
    });

    it('should reset accordion state', () => {
      store.setAccordionState('section-1', true);
      store.setAccordionState('section-2', true);
      
      store.resetAccordionState();
      
      expect(store.accordionState).toEqual({});
      expect(store.openAccordions).toEqual([]);
    });
  });

  describe('View Mode Management', () => {
    it('should initialize with landing view mode', () => {
      expect(store.viewMode.mode).toBe('landing');
      expect(store.isMarketingView).toBe(true);
      expect(store.isTechnicalView).toBe(false);
    });

    it('should set view mode correctly', () => {
      store.setViewMode('technical');
      expect(store.viewMode.mode).toBe('technical');
      expect(store.isMarketingView).toBe(false);
      expect(store.isTechnicalView).toBe(true);
    });

    it('should toggle view mode', () => {
      // Initially landing
      expect(store.viewMode.mode).toBe('landing');
      
      // Toggle to technical
      store.toggleViewMode();
      expect(store.viewMode.mode).toBe('technical');
      
      // Toggle back to landing
      store.toggleViewMode();
      expect(store.viewMode.mode).toBe('landing');
    });
  });

  describe('localStorage Persistence', () => {
    it('should save accordion state to localStorage', () => {
      store.setAccordionState('section-1', true);
      store.setAccordionState('section-2', false);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'landingAccordionState',
        JSON.stringify({
          'section-1': true,
          'section-2': false,
        })
      );
    });

    it('should save view mode to localStorage', () => {
      store.setViewMode('technical');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'landingViewMode',
        expect.stringContaining('"mode":"technical"')
      );
    });

    it('should load accordion state from localStorage', () => {
      const savedState = {
        'section-1': true,
        'section-2': false,
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState));
      
      // Create new store instance to test loading
      const newStore = useLandingStore();
      newStore.loadAccordionState();
      
      expect(newStore.accordionState).toEqual(savedState);
    });

    it('should load view mode from localStorage', () => {
      const savedViewMode = {
        mode: 'technical',
        lastUpdated: new Date().toISOString(),
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedViewMode));
      
      // Create new store instance to test loading
      const newStore = useLandingStore();
      newStore.loadViewMode();
      
      expect(newStore.viewMode.mode).toBe('technical');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      // Should not throw error
      expect(() => {
        const newStore = useLandingStore();
        newStore.loadAccordionState();
        newStore.loadViewMode();
      }).not.toThrow();
    });

    it('should handle missing localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      // Should not throw error
      expect(() => {
        const newStore = useLandingStore();
        newStore.loadAccordionState();
        newStore.loadViewMode();
      }).not.toThrow();
    });
  });

  describe('URL Parameter Management', () => {
    it('should update URL parameters when accordion state changes', () => {
      store.setAccordionState('section-1', true);
      store.setAccordionState('section-2', true);
      
      expect(mockRouter.replace).toHaveBeenCalledWith({
        query: {
          view: 'landing',
          accordions: 'section-1,section-2',
        },
      });
    });

    it('should update URL parameters when view mode changes', () => {
      store.setViewMode('technical');
      
      expect(mockRouter.replace).toHaveBeenCalledWith({
        query: {
          view: 'technical',
        },
      });
    });

    it('should parse view mode from URL parameters', () => {
      mockRoute.query = { view: 'technical' };
      
      const newStore = useLandingStore();
      newStore.parseURLParams();
      
      expect(newStore.viewMode.mode).toBe('technical');
    });

    it('should parse accordion state from URL parameters', () => {
      mockRoute.query = { accordions: 'section-1,section-2' };
      
      const newStore = useLandingStore();
      newStore.parseURLParams();
      
      expect(newStore.accordionState).toEqual({
        'section-1': true,
        'section-2': true,
      });
    });

    it('should handle invalid view mode in URL gracefully', () => {
      mockRoute.query = { view: 'invalid' };
      
      const newStore = useLandingStore();
      newStore.parseURLParams();
      
      // Should remain at default
      expect(newStore.viewMode.mode).toBe('landing');
    });

    it('should handle empty accordions parameter gracefully', () => {
      mockRoute.query = { accordions: '' };
      
      const newStore = useLandingStore();
      newStore.parseURLParams();
      
      expect(newStore.accordionState).toEqual({});
    });
  });

  describe('State Initialization', () => {
    it('should initialize state from localStorage and URL', () => {
      // Setup localStorage data
      const savedAccordionState = { 'section-1': true };
      const savedViewMode = { mode: 'technical', lastUpdated: new Date().toISOString() };
      
      localStorageMock.getItem
        .mockReturnValueOnce(JSON.stringify(savedAccordionState))
        .mockReturnValueOnce(JSON.stringify(savedViewMode));
      
      // Setup URL data
      mockRoute.query = { view: 'technical', accordions: 'section-2' };
      
      const newStore = useLandingStore();
      newStore.initializeState();
      
      // URL should override localStorage
      expect(newStore.viewMode.mode).toBe('technical');
      expect(newStore.accordionState).toEqual({ 'section-2': true });
    });

    it('should save final state after initialization', () => {
      mockRoute.query = { view: 'technical', accordions: 'section-1' };
      
      const newStore = useLandingStore();
      newStore.initializeState();
      
      // Should save the final state
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'landingAccordionState',
        JSON.stringify({ 'section-1': true })
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'landingViewMode',
        expect.stringContaining('"mode":"technical"')
      );
    });
  });

  describe('Browser Navigation Handling', () => {
    it('should watch for URL changes and update state', () => {
      const newStore = useLandingStore();
      
      // Simulate URL change
      mockRoute.query = { view: 'technical', accordions: 'section-1' };
      
      // Trigger the watcher
      newStore.parseURLParams();
      
      expect(newStore.viewMode.mode).toBe('technical');
      expect(newStore.accordionState).toEqual({ 'section-1': true });
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw error
      expect(() => {
        store.setAccordionState('section-1', true);
        store.setViewMode('technical');
      }).not.toThrow();
    });

    it('should handle router errors gracefully', () => {
      mockRouter.replace.mockImplementation(() => {
        throw new Error('Navigation failed');
      });
      
      // The store should handle router errors gracefully
      // We'll test that the state is still updated even if router fails
      store.setAccordionState('section-1', true);
      expect(store.accordionState['section-1']).toBe(true);
      
      store.setViewMode('technical');
      expect(store.viewMode.mode).toBe('technical');
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should maintain existing landing store functionality', () => {
      expect(store.foundingPartnerCount).toBe(0);
      expect(store.maxFoundingPartners).toBe(5);
      expect(store.currentSection).toBe(0);
      expect(store.sectionProgress).toEqual({
        heroViewed: false,
        featuresViewed: false,
        pricingViewed: false,
        ctaClicked: false,
      });
    });

    it('should track video analytics correctly', () => {
      store.trackVideoView('video-1');
      expect(store.videoAnalytics).toHaveLength(1);
      expect(store.videoAnalytics[0].videoId).toBe('video-1');
      expect(store.videoAnalytics[0].views).toBe(1);
    });

    it('should track section progress correctly', () => {
      store.trackSectionView('hero');
      expect(store.sectionProgress.heroViewed).toBe(true);
    });
  });
});
