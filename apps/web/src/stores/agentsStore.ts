import { defineStore } from 'pinia';
import { AgentInfo } from '../types/chat';
import { getAvailableAgents } from '../services/apiService'; // Import the API function

export interface AgentsState {
  availableAgents: AgentInfo[];
  isLoading: boolean;
  error: string | null;
}

export const useAgentsStore = defineStore('agents', {
  state: (): AgentsState => ({
    availableAgents: [],
    isLoading: false,
    error: null,
  }),
  actions: {
    // Action to set agents, e.g., after fetching from an API
    setAgents(agents: AgentInfo[]) {
      this.availableAgents = agents;
      this.error = null;
    },
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },
    setError(error: string | null) {
      this.error = error;
    },
    // Example: Fetch agents from a (mocked) API
    async fetchAvailableAgents() {
      this.setLoading(true);
      this.setError(null); // Clear previous errors
      try {
        const agents = await getAvailableAgents(); // Call the actual API service
        this.setAgents(agents);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to fetch agents';
        this.setError(errorMessage);
        this.setAgents([]); // Clear agents on error
        console.error("Error in fetchAvailableAgents action:", e);
      } finally {
        this.setLoading(false);
      }
    }
  },
  getters: {
    getAvailableAgents: (state): AgentInfo[] => state.availableAgents,
    isLoadingAgents: (state): boolean => state.isLoading,
    getAgentError: (state): string | null => state.error,
  },
}); 