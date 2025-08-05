import { defineStore } from 'pinia';
import { AgentInfo } from '../types/chat';
import { apiService } from '../services/apiService'; // Import the API service

export interface AgentsState {
  availableAgents: AgentInfo[];
  agentHierarchy: any | null;
  isLoading: boolean;
  error: string | null;
}

export const useAgentsStore = defineStore('agents', {
  state: (): AgentsState => ({
    availableAgents: [],
    agentHierarchy: null,
    isLoading: false,
    error: null,
  }),
  actions: {
    // Action to set agents, e.g., after fetching from an API
    setAgents(agents: AgentInfo[]) {
      this.availableAgents = agents;
      this.error = null;
    },
    setHierarchy(hierarchy: any) {
      this.agentHierarchy = hierarchy;
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
        const agents = await apiService.getAvailableAgents(); // Call the actual API service
        this.setAgents(agents);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to fetch agents';
        this.setError(errorMessage);
        this.setAgents([]); // Clear agents on error
      } finally {
        this.setLoading(false);
      }
    },
    async fetchAgentHierarchy() {
      this.setLoading(true);
      this.setError(null); // Clear previous errors
      try {
        const hierarchy = await apiService.getAgentHierarchy();
        this.setHierarchy(hierarchy);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to fetch agent hierarchy';
        this.setError(errorMessage);
        this.setHierarchy(null); // Clear hierarchy on error
      } finally {
        this.setLoading(false);
      }
    }
  },
  getters: {
    getAvailableAgents: (state): AgentInfo[] => state.availableAgents,
    getAgentHierarchy: (state): any => state.agentHierarchy,
    isLoadingAgents: (state): boolean => state.isLoading,
    getAgentError: (state): string | null => state.error,
  },
}); 