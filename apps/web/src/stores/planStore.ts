/**
 * Plan Store
 * Manages plans and their versions with strict A2A protocol types
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';
import type { PlanCreateResult, PlanReadResult, PlanEditResult } from '@/services/agent2agent/utils/handlers';

export const usePlanStore = defineStore('plan', () => {
  // State - using Maps for O(1) lookups
  const plans = ref<Map<string, PlanData>>(new Map());
  const planVersions = ref<Map<string, PlanVersionData[]>>(new Map()); // planId -> versions
  const currentVersionId = ref<Map<string, string>>(new Map()); // planId -> versionId
  const plansByConversation = ref<Map<string, string[]>>(new Map()); // conversationId -> planIds

  // Getters
  const planById = (id: string): PlanData | undefined => {
    return plans.value.get(id);
  };

  const currentVersion = (planId: string): PlanVersionData | undefined => {
    const versionId = currentVersionId.value.get(planId);
    if (!versionId) return undefined;

    const versions = planVersions.value.get(planId) || [];
    return versions.find(v => v.id === versionId);
  };

  const versionsByPlanId = (planId: string): PlanVersionData[] => {
    return planVersions.value.get(planId) || [];
  };

  const plansByConversationId = (conversationId: string): PlanData[] => {
    const planIds = plansByConversation.value.get(conversationId) || [];
    return planIds
      .map(id => plans.value.get(id))
      .filter((plan): plan is PlanData => plan !== undefined)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  };

  const allPlans = computed(() => {
    return Array.from(plans.value.values())
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  });

  // Actions - ONLY way to mutate state

  /**
   * Add or update a plan
   * Called by plan handler after create/read/edit responses
   */
  function addPlan(plan: PlanData, version?: PlanVersionData): void {
    plans.value.set(plan.id, plan);

    // Add version if provided
    if (version) {
      addVersion(plan.id, version);
    }
  }

  /**
   * Handle plan create result from handler
   */
  function handlePlanCreate(result: PlanCreateResult, conversationId?: string): void {
    addPlan(result.plan, result.version);

    if (conversationId) {
      associatePlanWithConversation(result.plan.id, conversationId);
    }

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.plan.id, result.version.id);
    }
  }

  /**
   * Handle plan read result from handler
   */
  function handlePlanRead(result: PlanReadResult): void {
    addPlan(result.plan, result.version);

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.plan.id, result.version.id);
    }
  }

  /**
   * Handle plan edit result from handler
   */
  function handlePlanEdit(result: PlanEditResult): void {
    addPlan(result.plan, result.version);

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.plan.id, result.version.id);
    }
  }

  /**
   * Handle plan list result from handler
   */
  function handlePlanList(plans: PlanData[], conversationId?: string): void {
    plans.forEach(plan => {
      addPlan(plan);

      if (conversationId) {
        associatePlanWithConversation(plan.id, conversationId);
      }
    });
  }

  /**
   * Update plan data
   */
  function updatePlan(planId: string, updates: Partial<PlanData>): void {
    const existing = plans.value.get(planId);
    if (existing) {
      plans.value.set(planId, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete plan
   * Called by delete handler
   */
  function deletePlan(planId: string): void {
    plans.value.delete(planId);
    planVersions.value.delete(planId);
    currentVersionId.value.delete(planId);

    // Remove from conversation associations
    plansByConversation.value.forEach((planIds, conversationId) => {
      const filtered = planIds.filter(id => id !== planId);
      if (filtered.length > 0) {
        plansByConversation.value.set(conversationId, filtered);
      } else {
        plansByConversation.value.delete(conversationId);
      }
    });
  }

  /**
   * Add version to a plan
   */
  function addVersion(planId: string, version: PlanVersionData): void {
    const versions = planVersions.value.get(planId) || [];

    // Check if version already exists
    const existingIndex = versions.findIndex(v => v.id === version.id);

    if (existingIndex >= 0) {
      // Update existing version
      versions[existingIndex] = version;
      planVersions.value.set(planId, [...versions]);
    } else {
      // Add new version
      planVersions.value.set(planId, [...versions, version]);
    }
  }

  /**
   * Set current version for a plan
   */
  function setCurrentVersion(planId: string, versionId: string): void {
    currentVersionId.value.set(planId, versionId);
  }

  /**
   * Delete a version
   */
  function deleteVersion(planId: string, versionId: string): void {
    const versions = planVersions.value.get(planId) || [];
    const filtered = versions.filter(v => v.id !== versionId);
    planVersions.value.set(planId, filtered);

    // Clear current version if it was deleted
    if (currentVersionId.value.get(planId) === versionId) {
      currentVersionId.value.delete(planId);

      // Set to latest version if available
      if (filtered.length > 0) {
        const latest = filtered.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        setCurrentVersion(planId, latest.id);
      }
    }
  }

  /**
   * Associate plan with conversation
   */
  function associatePlanWithConversation(planId: string, conversationId: string): void {
    const conversationPlans = plansByConversation.value.get(conversationId) || [];
    if (!conversationPlans.includes(planId)) {
      plansByConversation.value.set(conversationId, [...conversationPlans, planId]);
    }
  }

  /**
   * Clear all plans for a conversation
   */
  function clearPlansByConversation(conversationId: string): void {
    const planIds = plansByConversation.value.get(conversationId) || [];
    planIds.forEach(planId => deletePlan(planId));
    plansByConversation.value.delete(conversationId);
  }

  /**
   * Clear all plans (logout)
   */
  function clearAll(): void {
    plans.value.clear();
    planVersions.value.clear();
    currentVersionId.value.clear();
    plansByConversation.value.clear();
  }

  /**
   * Rerun plan creation with a different LLM
   * Similar to deliverable rerun but for plans
   */
  async function rerunWithDifferentLLM(
    plan: PlanData,
    version: PlanVersionData,
    llmSelection: {
      providerName?: string;
      modelName?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<PlanVersionData> {
    const AGENT_TASK_TIMEOUT_SECONDS = 600; // 10 minutes
    const AGENT_TASK_TIMEOUT_MS = AGENT_TASK_TIMEOUT_SECONDS * 1000;

    try {
      // 1) Use the provided version data
      const sourceVersion = version;
      const planId = plan.id;
      const versionId = version.id;

      const currentNumber = sourceVersion.versionNumber;
      // Conversation is tracked at the plan level
      const conversationId = plan.conversationId;
      // Task that produced this version (may be undefined for manual edits)
      const taskId = (sourceVersion as any).taskId as string | undefined;

      if (!conversationId) {
        throw new Error('Cannot rerun: missing conversationId on plan');
      }

      // 2) Load the task to get original prompt
      const { tasksService } = await import('@/services/tasksService');
      if (!taskId) {
        throw new Error('Cannot rerun: version has no originating taskId');
      }

      const originalTask = await tasksService.getTask(taskId);
      if (!originalTask) {
        throw new Error(`Original task ${taskId} not found`);
      }

      // 3) Extract routing info from the task
      const agentType = originalTask.metadata?.source === 'database' ? 'database' : 'dynamic';
      const agentName = originalTask.metadata?.agentName;
      const namespace = originalTask.metadata?.namespace;

      if (!agentName) {
        throw new Error('Cannot determine agent name from original task');
      }

      // 4) Filter conversation history to exclude the plan response
      let filteredConversationHistory: any[] = [];
      try {
        const { agentConversationsService } = await import('@/services/agentConversationsService');
        const history = await agentConversationsService.getConversationHistory(conversationId);
        if (history && history.length > 0) {
          // Find messages after the task but before the plan response
          const taskIndex = history.findIndex((msg: any) => msg.taskId === taskId);

          filteredConversationHistory = history
            .slice(0, taskIndex >= 0 ? taskIndex : history.length)
            .map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.toISOString(),
              taskId: msg.taskId,
              metadata: msg.metadata
            }));

          console.log(`🔄 Filtered conversation history for plan rerun: ${filteredConversationHistory.length} messages (excluded plan response)`);
        }
      } catch (e) {
        console.warn('Could not load conversation history for filtering, backend will use full history', e);
      }

      // 5) Create new task with plan mode
      const taskResp = await tasksService.createAgentTask(
        agentType,
        agentName,
        {
          method: 'process',
          prompt: originalTask.prompt,
          conversationId,
          llmSelection,
          executionMode: 'immediate',
          timeoutSeconds: AGENT_TASK_TIMEOUT_SECONDS,
          ...(filteredConversationHistory.length > 0 ? { conversationHistory: filteredConversationHistory } : {}),
          // CRITICAL: Use plan mode not build mode
          params: {
            mode: 'plan',
          },
        },
        namespace ? { namespace } : undefined
      );

      // 6) Poll for new plan version
      const start = Date.now();
      const intervalMs = 1000;
      let latest: PlanVersionData | null = null;
      const newTaskId = (taskResp && (taskResp as any).taskId) || undefined;

      while (Date.now() - start < AGENT_TASK_TIMEOUT_MS) {
        if (newTaskId) {
          console.log(`🔍 [Plan LLM Rerun] Checking for plan version with taskId: ${newTaskId}`);

          // Check if new version exists by looking at versions array
          const versions = versionsByPlanId(planId);
          const created = versions.find(v => v.taskId === newTaskId);

          if (created) {
            console.log(`✅ [Plan LLM Rerun] Found new plan version`);
            latest = created;
            break;
          }
        } else {
          // Fallback: detect by version number increment
          console.log(`🔍 [Plan LLM Rerun] Checking for version number increment (current: ${currentNumber})`);
          const versions = versionsByPlanId(planId);
          const maxVersion = versions.reduce(
            (max, v) => (v.versionNumber > max.versionNumber ? v : max),
            versions[0] || sourceVersion
          );

          console.log(`🔍 [Plan LLM Rerun] Max version found: ${maxVersion?.versionNumber}`);
          if (maxVersion && maxVersion.versionNumber > currentNumber) {
            latest = maxVersion;
            break;
          }
        }

        await new Promise(res => setTimeout(res, intervalMs));
      }

      if (!latest) {
        throw new Error('Timed out waiting for new plan version after rerun');
      }

      // 7) Return the new version (already in store from conversation handler)
      return latest;
    } catch (error: any) {
      console.error('Failed to rerun plan with different LLM via agent tasks:', error);
      throw error;
    }
  }

  // Return public API
  return {
    // State (read-only exposure)
    plans: readonly(plans),

    // Getters
    planById,
    currentVersion,
    versionsByPlanId,
    plansByConversationId,
    allPlans,

    // Actions
    addPlan,
    handlePlanCreate,
    handlePlanRead,
    handlePlanEdit,
    handlePlanList,
    updatePlan,
    deletePlan,
    addVersion,
    setCurrentVersion,
    deleteVersion,
    associatePlanWithConversation,
    clearPlansByConversation,
    clearAll,
    rerunWithDifferentLLM,
  };
});
