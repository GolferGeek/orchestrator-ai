/**
 * Plan Store
 * Manages plans and their versions with strict A2A protocol types
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';
import type { PlanCreateResult, PlanReadResult, PlanEditResult } from '@/services/agent2agent/utils/handlers';
import { apiService } from '@/services/apiService';

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

  // Orchestration methods removed - now handled by plan.actions.ts
  // - handlePlanCreate → createPlan action
  // - handlePlanRead → readPlan action
  // - handlePlanEdit → editPlan action
  // - handlePlanList → listPlans action

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
    console.log('📝 [planStore.addVersion] Adding version:', { planId, versionId: version.id, versionNumber: version.versionNumber });

    const versions = planVersions.value.get(planId) || [];
    console.log('📝 [planStore.addVersion] Existing versions:', versions.length);

    // Check if version already exists
    const existingIndex = versions.findIndex(v => v.id === version.id);

    if (existingIndex >= 0) {
      // Update existing version
      console.log('📝 [planStore.addVersion] Updating existing version at index', existingIndex);
      versions[existingIndex] = version;
      planVersions.value.set(planId, [...versions]);
    } else {
      // Add new version
      console.log('📝 [planStore.addVersion] Adding new version (total will be:', versions.length + 1, ')');
      planVersions.value.set(planId, [...versions, version]);
    }

    console.log('📝 [planStore.addVersion] Total versions now:', planVersions.value.get(planId)?.length);
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
   * Load plans by conversation ID from the API
   */
  async function loadPlansByConversation(conversationId: string): Promise<PlanData | null> {
    try {
      const response = await apiService.get(`/plans/conversation/${conversationId}`);

      if (!response || !response.id) {
        console.log('[planStore.loadPlansByConversation] No plan found for conversation:', conversationId);
        return null;
      }

      // Map the API response to PlanData
      const plan: PlanData = {
        id: response.id,
        conversationId: response.conversationId,
        agentName: response.agentName,
        namespace: response.namespace,
        title: response.title,
        createdAt: new Date(response.createdAt),
        updatedAt: new Date(response.updatedAt),
      };

      // Add the plan to the store
      addPlan(plan);

      // Add versions if they exist
      if (response.versions && Array.isArray(response.versions)) {
        response.versions.forEach((versionData: any) => {
          const version: PlanVersionData = {
            id: versionData.id,
            planId: versionData.plan_id,
            versionNumber: versionData.version_number,
            content: versionData.content,
            format: versionData.format,
            createdAt: new Date(versionData.created_at),
            isCurrentVersion: versionData.is_current_version,
            metadata: versionData.metadata,
          };
          addVersion(plan.id, version);

          // Set as current version if flagged
          if (version.isCurrentVersion) {
            setCurrentVersion(plan.id, version.id);
          }
        });
      }

      // Associate with conversation
      associatePlanWithConversation(plan.id, conversationId);

      console.log('[planStore.loadPlansByConversation] Loaded plan:', plan.id, 'with', response.versions?.length || 0, 'versions');
      return plan;
    } catch (error) {
      console.error('[planStore.loadPlansByConversation] Error loading plan:', error);
      return null;
    }
  }

  /**
   * Rerun plan creation with a different LLM
   * Uses the plan rerun action via agent2agent API
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
    try {
      const conversationId = plan.conversationId;
      const versionId = version.id;

      if (!conversationId) {
        throw new Error('Cannot rerun: missing conversationId on plan');
      }

      // Call the rerun API
      const { createAgent2AgentApi } = await import('@/services/agent2agent/api/agent2agent.api');
      const api = createAgent2AgentApi(plan.agentName);

      console.log('🔄 [Plan Rerun] Calling rerun API:', {
        conversationId,
        versionId,
        llmConfig: llmSelection
      });

      const response = await api.plans.rerun(conversationId, versionId, {
        provider: llmSelection.providerName!,
        model: llmSelection.modelName!,
        temperature: llmSelection.temperature,
        maxTokens: llmSelection.maxTokens,
      });

      console.log('✅ [Plan Rerun] Response received:', response);

      // Handle the response
      if (!response.success || !response.data) {
        console.error('❌ [Plan Rerun] Failed:', response.error);
        throw new Error(response.error?.message || 'Failed to rerun plan');
      }

      // Extract the new version from the response
      const newVersion = response.data.version;

      if (!newVersion) {
        console.error('❌ [Plan Rerun] No version in response:', response.data);
        throw new Error('Rerun succeeded but did not return a version');
      }

      // Add the new version to the store
      console.log('✅ [Plan Rerun] Adding new version to store:', newVersion);
      addVersion(plan.id, newVersion);

      return newVersion;
    } catch (error: any) {
      console.error('Failed to rerun plan with different LLM:', error);
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

    // Simple mutations only (orchestration moved to plan.actions.ts)
    addPlan,
    updatePlan,
    deletePlan,
    addVersion,
    setCurrentVersion,
    deleteVersion,
    associatePlanWithConversation,
    clearPlansByConversation,
    clearAll,
    loadPlansByConversation,
    rerunWithDifferentLLM, // TODO: Move to plan.actions.ts
  };
});
