/**
 * Orchestrator Store
 * Manages orchestrations and workflow coordination
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { AgentTaskMode } from '@orchestrator-ai/transport-types';

// Types
export type OrchestrationStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type OrchestrationStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Orchestration {
  id: string;
  conversationId: string;
  type: string;
  status: OrchestrationStatus;
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface OrchestrationStep {
  id: string;
  orchestrationId: string;
  stepNumber: number;
  mode: AgentTaskMode;
  action: string;
  agentId?: string;
  taskId?: string;
  status: OrchestrationStepStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestrationProgress {
  current: number;
  total: number;
  percentage: number;
  completedSteps: number;
  failedSteps: number;
  pendingSteps: number;
}

export const useOrchestratorStore = defineStore('orchestrator', () => {
  // State
  const orchestrations = ref<Map<string, Orchestration>>(new Map());
  const orchestrationSteps = ref<Map<string, OrchestrationStep[]>>(new Map()); // orchestrationId -> steps
  const activeOrchestrationId = ref<string | null>(null);

  // Getters
  const activeOrchestration = computed(() => {
    if (!activeOrchestrationId.value) return null;
    return orchestrations.value.get(activeOrchestrationId.value) || null;
  });

  const orchestrationById = (id: string): Orchestration | undefined => {
    return orchestrations.value.get(id);
  };

  const stepsByOrchestrationId = (id: string): OrchestrationStep[] => {
    return orchestrationSteps.value.get(id) || [];
  };

  const currentStep = (orchestrationId: string): OrchestrationStep | undefined => {
    const orchestration = orchestrations.value.get(orchestrationId);
    if (!orchestration) return undefined;

    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    return steps.find(step => step.stepNumber === orchestration.currentStepIndex);
  };

  const orchestrationProgress = (id: string): OrchestrationProgress => {
    const steps = orchestrationSteps.value.get(id) || [];
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const pendingSteps = steps.filter(s => s.status === 'pending').length;
    const total = steps.length;
    const current = completedSteps + failedSteps;

    return {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      completedSteps,
      failedSteps,
      pendingSteps,
    };
  };

  const runningOrchestrations = computed(() => {
    return Array.from(orchestrations.value.values())
      .filter(o => o.status === 'running')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  const completedOrchestrations = computed(() => {
    return Array.from(orchestrations.value.values())
      .filter(o => o.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  // Actions - ONLY way to mutate state

  /**
   * Start a new orchestration
   */
  function startOrchestration(
    id: string,
    conversationId: string,
    type: string,
    steps: Omit<OrchestrationStep, 'id' | 'orchestrationId' | 'status' | 'createdAt' | 'updatedAt'>[],
    metadata?: Record<string, any>
  ): Orchestration {
    const now = new Date().toISOString();

    const orchestration: Orchestration = {
      id,
      conversationId,
      type,
      status: 'pending',
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      metadata,
    };

    orchestrations.value.set(id, orchestration);

    // Create steps
    const orchestrationStepsList: OrchestrationStep[] = steps.map((step, index) => ({
      ...step,
      id: `${id}-step-${index}`,
      orchestrationId: id,
      status: 'pending' as OrchestrationStepStatus,
      createdAt: now,
      updatedAt: now,
    }));

    orchestrationSteps.value.set(id, orchestrationStepsList);

    return orchestration;
  }

  /**
   * Update orchestration status
   */
  function updateOrchestrationStatus(orchestrationId: string, status: OrchestrationStatus): void {
    const orchestration = orchestrations.value.get(orchestrationId);
    if (orchestration) {
      orchestrations.value.set(orchestrationId, {
        ...orchestration,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Advance to next step
   */
  function advanceToNextStep(orchestrationId: string): void {
    const orchestration = orchestrations.value.get(orchestrationId);
    if (!orchestration) return;

    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const nextStepIndex = orchestration.currentStepIndex + 1;

    if (nextStepIndex < steps.length) {
      orchestrations.value.set(orchestrationId, {
        ...orchestration,
        currentStepIndex: nextStepIndex,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // No more steps - mark as completed
      updateOrchestrationStatus(orchestrationId, 'completed');
    }
  }

  /**
   * Set active orchestration
   */
  function setActiveOrchestration(orchestrationId: string | null): void {
    if (orchestrationId === null || orchestrations.value.has(orchestrationId)) {
      activeOrchestrationId.value = orchestrationId;
    }
  }

  /**
   * Update step status
   */
  function updateStepStatus(
    orchestrationId: string,
    stepId: string,
    status: OrchestrationStepStatus
  ): void {
    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex >= 0) {
      const updatedStep = {
        ...steps[stepIndex],
        status,
        updatedAt: new Date().toISOString(),
      };
      steps[stepIndex] = updatedStep;
      orchestrationSteps.value.set(orchestrationId, [...steps]);
    }
  }

  /**
   * Set step output
   */
  function setStepOutput(
    orchestrationId: string,
    stepId: string,
    output: Record<string, any>
  ): void {
    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex >= 0) {
      const updatedStep = {
        ...steps[stepIndex],
        output,
        updatedAt: new Date().toISOString(),
      };
      steps[stepIndex] = updatedStep;
      orchestrationSteps.value.set(orchestrationId, [...steps]);
    }
  }

  /**
   * Set step error
   */
  function setStepError(
    orchestrationId: string,
    stepId: string,
    error: string
  ): void {
    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex >= 0) {
      const updatedStep = {
        ...steps[stepIndex],
        status: 'failed' as OrchestrationStepStatus,
        error,
        updatedAt: new Date().toISOString(),
      };
      steps[stepIndex] = updatedStep;
      orchestrationSteps.value.set(orchestrationId, [...steps]);

      // Mark orchestration as failed
      updateOrchestrationStatus(orchestrationId, 'failed');
    }
  }

  /**
   * Assign step to agent and task
   */
  function assignStepToAgent(
    orchestrationId: string,
    stepId: string,
    agentId: string,
    taskId: string
  ): void {
    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex >= 0) {
      const updatedStep = {
        ...steps[stepIndex],
        agentId,
        taskId,
        updatedAt: new Date().toISOString(),
      };
      steps[stepIndex] = updatedStep;
      orchestrationSteps.value.set(orchestrationId, [...steps]);
    }
  }

  /**
   * Pause orchestration
   */
  function pauseOrchestration(orchestrationId: string): void {
    updateOrchestrationStatus(orchestrationId, 'paused');
  }

  /**
   * Resume orchestration
   */
  function resumeOrchestration(orchestrationId: string): void {
    updateOrchestrationStatus(orchestrationId, 'running');
  }

  /**
   * Cancel orchestration
   */
  function cancelOrchestration(orchestrationId: string): void {
    updateOrchestrationStatus(orchestrationId, 'cancelled');

    // Mark all pending/running steps as skipped
    const steps = orchestrationSteps.value.get(orchestrationId) || [];
    const updatedSteps = steps.map(step => {
      if (step.status === 'pending' || step.status === 'running') {
        return {
          ...step,
          status: 'skipped' as OrchestrationStepStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return step;
    });
    orchestrationSteps.value.set(orchestrationId, updatedSteps);
  }

  /**
   * Clear orchestration data
   */
  function clearOrchestration(orchestrationId: string): void {
    orchestrations.value.delete(orchestrationId);
    orchestrationSteps.value.delete(orchestrationId);

    if (activeOrchestrationId.value === orchestrationId) {
      activeOrchestrationId.value = null;
    }
  }

  /**
   * Clear all orchestrations (logout)
   */
  function clearAll(): void {
    orchestrations.value.clear();
    orchestrationSteps.value.clear();
    activeOrchestrationId.value = null;
  }

  // Return public API
  return {
    // State (read-only exposure)
    orchestrations: readonly(orchestrations),
    activeOrchestrationId: readonly(activeOrchestrationId),

    // Getters
    activeOrchestration,
    orchestrationById,
    stepsByOrchestrationId,
    currentStep,
    orchestrationProgress,
    runningOrchestrations,
    completedOrchestrations,

    // Actions
    startOrchestration,
    updateOrchestrationStatus,
    advanceToNextStep,
    setActiveOrchestration,
    updateStepStatus,
    setStepOutput,
    setStepError,
    assignStepToAgent,
    pauseOrchestration,
    resumeOrchestration,
    cancelOrchestration,
    clearOrchestration,
    clearAll,
  };
});
