/**
 * Agent Store
 * Manages agent configurations, capabilities, and status
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { AgentTaskMode } from '@orchestrator-ai/transport-types';

// Types
export interface Agent {
  id: string;
  name: string;
  type: string;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface AgentCapability {
  mode: AgentTaskMode;
  actions: string[];
  metadata?: Record<string, any>;
}

export type AgentStatusType = 'idle' | 'busy' | 'error' | 'offline';

export interface AgentStatus {
  agentId: string;
  status: AgentStatusType;
  currentTaskId?: string;
  lastActiveAt: string;
  error?: string;
}

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref<Map<string, Agent>>(new Map());
  const agentCapabilities = ref<Map<string, AgentCapability[]>>(new Map()); // agentId -> capabilities
  const agentStatus = ref<Map<string, AgentStatus>>(new Map()); // agentId -> status

  // Getters
  const agentById = (id: string): Agent | undefined => {
    return agents.value.get(id);
  };

  const statusByAgentId = (id: string): AgentStatus | undefined => {
    return agentStatus.value.get(id);
  };

  const capabilitiesByAgentId = (id: string): AgentCapability[] => {
    return agentCapabilities.value.get(id) || [];
  };

  const availableAgents = computed(() => {
    return Array.from(agents.value.values())
      .filter(agent => agent.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const agentsByCapability = (mode: AgentTaskMode, action?: string): Agent[] => {
    return Array.from(agents.value.values()).filter(agent => {
      const capabilities = agentCapabilities.value.get(agent.id) || [];

      return capabilities.some(cap => {
        if (cap.mode !== mode) return false;
        if (action && !cap.actions.includes(action)) return false;
        return true;
      });
    });
  };

  const idleAgents = computed(() => {
    return Array.from(agents.value.values()).filter(agent => {
      const status = agentStatus.value.get(agent.id);
      return status?.status === 'idle' && agent.isActive;
    });
  });

  const busyAgents = computed(() => {
    return Array.from(agents.value.values()).filter(agent => {
      const status = agentStatus.value.get(agent.id);
      return status?.status === 'busy' && agent.isActive;
    });
  });

  const activeAgents = computed(() => {
    return Array.from(agents.value.values()).filter(agent => agent.isActive);
  });

  const offlineAgents = computed(() => {
    return Array.from(agents.value.values()).filter(agent => {
      const status = agentStatus.value.get(agent.id);
      return status?.status === 'offline' || !agent.isActive;
    });
  });

  // Actions - ONLY way to mutate state

  /**
   * Register a new agent
   */
  function registerAgent(agent: Agent, capabilities: AgentCapability[]): void {
    agents.value.set(agent.id, agent);
    agentCapabilities.value.set(agent.id, capabilities);

    // Initialize status as idle
    agentStatus.value.set(agent.id, {
      agentId: agent.id,
      status: 'idle',
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Update agent configuration
   */
  function updateAgent(agentId: string, updates: Partial<Agent>): void {
    const existing = agents.value.get(agentId);
    if (existing) {
      agents.value.set(agentId, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Deactivate agent
   */
  function deactivateAgent(agentId: string): void {
    const existing = agents.value.get(agentId);
    if (existing) {
      agents.value.set(agentId, {
        ...existing,
        isActive: false,
        updatedAt: new Date().toISOString(),
      });

      // Set status to offline
      updateAgentStatus(agentId, {
        status: 'offline',
        lastActiveAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Activate agent
   */
  function activateAgent(agentId: string): void {
    const existing = agents.value.get(agentId);
    if (existing) {
      agents.value.set(agentId, {
        ...existing,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      // Set status to idle
      updateAgentStatus(agentId, {
        status: 'idle',
        lastActiveAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Update agent status
   */
  function updateAgentStatus(agentId: string, statusUpdate: Omit<AgentStatus, 'agentId'>): void {
    agentStatus.value.set(agentId, {
      agentId,
      ...statusUpdate,
    });
  }

  /**
   * Set agent as busy with a task
   */
  function setAgentBusy(agentId: string, taskId: string): void {
    updateAgentStatus(agentId, {
      status: 'busy',
      currentTaskId: taskId,
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Set agent as idle
   */
  function setAgentIdle(agentId: string): void {
    updateAgentStatus(agentId, {
      status: 'idle',
      currentTaskId: undefined,
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Set agent error state
   */
  function setAgentError(agentId: string, error: string): void {
    updateAgentStatus(agentId, {
      status: 'error',
      error,
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Set agent capabilities
   */
  function setCapabilities(agentId: string, capabilities: AgentCapability[]): void {
    agentCapabilities.value.set(agentId, capabilities);
  }

  /**
   * Add capability to agent
   */
  function addCapability(agentId: string, capability: AgentCapability): void {
    const existing = agentCapabilities.value.get(agentId) || [];

    // Check if capability already exists for this mode
    const hasExisting = existing.some(cap => cap.mode === capability.mode);

    if (hasExisting) {
      // Merge actions if mode exists
      const updated = existing.map(cap => {
        if (cap.mode === capability.mode) {
          const mergedActions = Array.from(new Set([...cap.actions, ...capability.actions]));
          return {
            ...cap,
            actions: mergedActions,
            metadata: { ...cap.metadata, ...capability.metadata },
          };
        }
        return cap;
      });
      agentCapabilities.value.set(agentId, updated);
    } else {
      // Add new capability
      agentCapabilities.value.set(agentId, [...existing, capability]);
    }
  }

  /**
   * Remove capability from agent
   */
  function removeCapability(agentId: string, mode: AgentTaskMode): void {
    const existing = agentCapabilities.value.get(agentId) || [];
    const filtered = existing.filter(cap => cap.mode !== mode);
    agentCapabilities.value.set(agentId, filtered);
  }

  /**
   * Clear all agents (logout or reset)
   */
  function clearAll(): void {
    agents.value.clear();
    agentCapabilities.value.clear();
    agentStatus.value.clear();
  }

  // Return public API
  return {
    // State (read-only exposure)
    agents: readonly(agents),

    // Getters
    agentById,
    statusByAgentId,
    capabilitiesByAgentId,
    availableAgents,
    agentsByCapability,
    idleAgents,
    busyAgents,
    activeAgents,
    offlineAgents,

    // Actions
    registerAgent,
    updateAgent,
    deactivateAgent,
    activateAgent,
    updateAgentStatus,
    setAgentBusy,
    setAgentIdle,
    setAgentError,
    setCapabilities,
    addCapability,
    removeCapability,
    clearAll,
  };
});
