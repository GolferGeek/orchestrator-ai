import { defineStore } from 'pinia';
import { 
  SovereignPolicy, 
  SovereignPolicyStatus, 
  sovereignPolicyService 
} from '../services/sovereignPolicyService';

export interface SovereignPolicyState {
  // Corporate policy (read-only, set once on app load)
  policy: SovereignPolicy | null;
  
  // User preference (can be toggled ON if corporate allows)
  userSovereignMode: boolean;
  
  // Loading states
  loading: boolean;
  
  // Error state
  error: string | null;
  
  // Initialization flag
  initialized: boolean;
}

export const useSovereignPolicyStore = defineStore('sovereignPolicy', {
  state: (): SovereignPolicyState => ({
    policy: null,
    userSovereignMode: false,
    loading: false,
    error: null,
    initialized: false,
  }),

  getters: {
    // Corporate policy enforces sovereign mode for everyone
    isEnforced: (state) => state.policy?.enforced ?? false,
    
    // User can control sovereign mode if corporate doesn't enforce it
    canUserControlSovereignMode: (state) => !state.policy?.enforced,
    
    // Effective sovereign mode: corporate enforced OR user enabled
    effectiveSovereignMode: (state) => {
      return state.policy?.enforced || state.userSovereignMode;
    },
    
    // Policy warnings (for UI messaging)
    policyWarnings: (state) => {
      const warnings: string[] = [];
      
      if (state.policy?.enforced && !state.userSovereignMode) {
        warnings.push('Organization policy requires sovereign mode to be enabled');
      }
      
      return warnings;
    },
    
    // Allowed providers based on effective sovereign mode
    allowedProviders: (state) => {
      const effectiveMode = state.policy?.enforced || state.userSovereignMode;
      return effectiveMode ? ['ollama'] : ['ollama', 'openai', 'anthropic'];
    },
  },

  actions: {
    // Initialize: fetch corporate policy once on app startup
    async initialize() {
      if (this.initialized) return;
      
      this.loading = true;
      this.error = null;
      
      try {
        // Fetch corporate policy from backend
        this.policy = await sovereignPolicyService.getPolicy();
        
        // Load user preference from localStorage
        const savedPreference = localStorage.getItem('userSovereignMode');
        if (savedPreference !== null) {
          this.userSovereignMode = JSON.parse(savedPreference);
        }
        
        this.initialized = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load sovereign policy';
        console.error('Failed to initialize sovereign policy:', error);
      } finally {
        this.loading = false;
      }
    },

    // Update user preference (can only enable, not disable if corporate enforces)
    async updateUserPreference(enabled: boolean) {
      // If corporate enforces sovereign mode, user can't disable it
      if (this.policy?.enforced && !enabled) {
        throw new Error('Cannot disable sovereign mode - required by organization policy');
      }
      
      this.loading = true;
      this.error = null;
      
      try {
        // Update backend (optional - could be just localStorage)
        // await sovereignPolicyService.updateUserPreference(enabled);
        
        // Update local state
        this.userSovereignMode = enabled;
        
        // Persist to localStorage
        localStorage.setItem('userSovereignMode', JSON.stringify(enabled));
        
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update preference';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // Clear error state
    clearError() {
      this.error = null;
    },

    // Reset store (for testing or logout)
    reset() {
      this.$reset();
      localStorage.removeItem('userSovereignMode');
    },
  },
});