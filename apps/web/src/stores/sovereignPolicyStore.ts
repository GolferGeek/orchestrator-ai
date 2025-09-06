import { defineStore } from 'pinia';
import { 
  SovereignPolicy, 
  SovereignPolicyStatus, 
  PolicyValidationRequest,
  PolicyValidationResponse,
  sovereignPolicyService 
} from '../services/sovereignPolicyService';

export interface SovereignPolicyState {
  // Policy data
  policy: SovereignPolicy | null;
  policyStatus: SovereignPolicyStatus | null;
  
  // Loading states
  loadingPolicy: boolean;
  loadingStatus: boolean;
  loadingValidation: boolean;
  
  // Error states
  policyError: string | null;
  statusError: string | null;
  validationError: string | null;
  
  // User preferences
  userSovereignMode: boolean;
  
  // Cache and polling
  lastFetched: number | null;
  pollingInterval: number | null;
  
  // Validation results
  lastValidation: PolicyValidationResponse | null;
}

export const useSovereignPolicyStore = defineStore('sovereignPolicy', {
  state: (): SovereignPolicyState => ({
    policy: null,
    policyStatus: null,
    loadingPolicy: false,
    loadingStatus: false,
    loadingValidation: false,
    policyError: null,
    statusError: null,
    validationError: null,
    userSovereignMode: false,
    lastFetched: null,
    pollingInterval: null,
    lastValidation: null,
  }),

  getters: {
    /**
     * Get the effective sovereign mode status
     * Considers both organization policy and user preference
     */
    effectiveSovereignMode(): boolean {
      if (this.policy?.enforced) {
        return true; // Organization enforces sovereign mode
      }
      return this.userSovereignMode; // User preference when not enforced
    },

    /**
     * Check if sovereign mode is available for user control
     */
    canUserControlSovereignMode(): boolean {
      return !this.policy?.enforced;
    },

    /**
     * Get allowed providers based on sovereign mode
     */
    allowedProviders(): string[] {
      if (this.effectiveSovereignMode) {
        return ['ollama']; // Only local models in sovereign mode
      }
      return this.policyStatus?.allowedProviders || ['ollama', 'openai', 'anthropic'];
    },

    /**
     * Check if policy data is fresh (less than 10 seconds old)
     */
    isPolicyFresh(): boolean {
      if (!this.lastFetched) return false;
      return Date.now() - this.lastFetched < 10000; // 10 seconds
    },

    /**
     * Get policy warnings
     */
    policyWarnings(): string[] {
      return this.policy?.validation?.warnings || [];
    },

    /**
     * Check if there are any errors
     */
    hasErrors(): boolean {
      return !!(this.policyError || this.statusError || this.validationError);
    },
  },

  actions: {
    /**
     * Fetch the current sovereign mode policy
     */
    async fetchPolicy(): Promise<void> {
      this.loadingPolicy = true;
      this.policyError = null;

      try {
        this.policy = await sovereignPolicyService.getPolicy();
        this.lastFetched = Date.now();
      } catch (error) {
        this.policyError = error instanceof Error ? error.message : 'Failed to fetch policy';
        console.error('Error fetching sovereign policy:', error);
      } finally {
        this.loadingPolicy = false;
      }
    },

    /**
     * Fetch simplified policy status
     */
    async fetchPolicyStatus(): Promise<void> {
      this.loadingStatus = true;
      this.statusError = null;

      try {
        this.policyStatus = await sovereignPolicyService.getPolicyStatus();
        this.lastFetched = Date.now();
      } catch (error) {
        this.statusError = error instanceof Error ? error.message : 'Failed to fetch policy status';
        console.error('Error fetching policy status:', error);
      } finally {
        this.loadingStatus = false;
      }
    },

    /**
     * Validate policy configuration
     */
    async validatePolicy(request: PolicyValidationRequest): Promise<PolicyValidationResponse | null> {
      this.loadingValidation = true;
      this.validationError = null;

      try {
        const result = await sovereignPolicyService.validatePolicy(request);
        this.lastValidation = result;
        return result;
      } catch (error) {
        this.validationError = error instanceof Error ? error.message : 'Failed to validate policy';
        console.error('Error validating policy:', error);
        return null;
      } finally {
        this.loadingValidation = false;
      }
    },

    /**
     * Set user sovereign mode preference
     */
    setUserSovereignMode(enabled: boolean): void {
      this.userSovereignMode = enabled;
      
      // Store in localStorage for persistence
      try {
        localStorage.setItem('userSovereignMode', JSON.stringify(enabled));
      } catch (error) {
        console.warn('Failed to save user sovereign mode preference:', error);
      }
    },

    /**
     * Load user sovereign mode preference from localStorage
     */
    loadUserPreferences(): void {
      try {
        const stored = localStorage.getItem('userSovereignMode');
        if (stored !== null) {
          this.userSovereignMode = JSON.parse(stored);
        }
      } catch (error) {
        console.warn('Failed to load user sovereign mode preference:', error);
        this.userSovereignMode = false;
      }
    },

    /**
     * Start polling for policy updates
     */
    startPolling(intervalMs: number = 5000): void {
      this.stopPolling(); // Clear any existing interval
      
      this.pollingInterval = window.setInterval(async () => {
        // Only fetch if data is not fresh
        if (!this.isPolicyFresh) {
          await Promise.all([
            this.fetchPolicy(),
            this.fetchPolicyStatus()
          ]);
        }
      }, intervalMs);
    },

    /**
     * Stop polling for policy updates
     */
    stopPolling(): void {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    },

    /**
     * Initialize the store - fetch initial data and start polling
     */
    async initialize(): Promise<void> {
      // Load user preferences
      this.loadUserPreferences();
      
      // Fetch initial policy data
      await Promise.all([
        this.fetchPolicy(),
        this.fetchPolicyStatus()
      ]);
      
      // Start polling for updates
      this.startPolling();
    },

    /**
     * Cleanup when store is no longer needed
     */
    cleanup(): void {
      this.stopPolling();
    },

    /**
     * Reset all state
     */
    reset(): void {
      this.cleanup();
      this.$reset();
    },
  },
});
