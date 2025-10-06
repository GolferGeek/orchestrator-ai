/**
 * Deliverable Store
 * Manages deliverables (builds) and their versions with strict A2A protocol types
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { DeliverableData, DeliverableVersionData } from '@orchestrator-ai/transport-types';
import type {
  BuildExecuteResult,
  BuildReadResult,
  BuildRerunResult,
  BuildEditResult,
} from '@/services/agent2agent/utils/handlers';

export const useDeliverableStore = defineStore('deliverable', () => {
  // State - using Maps for O(1) lookups
  const deliverables = ref<Map<string, DeliverableData>>(new Map());
  const deliverableVersions = ref<Map<string, DeliverableVersionData[]>>(new Map()); // deliverableId -> versions
  const currentVersionId = ref<Map<string, string>>(new Map()); // deliverableId -> versionId
  const deliverablesByPlan = ref<Map<string, string[]>>(new Map()); // planId -> deliverableIds

  // Getters
  const deliverableById = (id: string): DeliverableData | undefined => {
    return deliverables.value.get(id);
  };

  const currentVersion = (deliverableId: string): DeliverableVersionData | undefined => {
    const versionId = currentVersionId.value.get(deliverableId);
    if (!versionId) return undefined;

    const versions = deliverableVersions.value.get(deliverableId) || [];
    return versions.find(v => v.id === versionId);
  };

  const versionsByDeliverableId = (deliverableId: string): DeliverableVersionData[] => {
    return deliverableVersions.value.get(deliverableId) || [];
  };

  const deliverablesByPlanId = (planId: string): DeliverableData[] => {
    const deliverableIds = deliverablesByPlan.value.get(planId) || [];
    return deliverableIds
      .map(id => deliverables.value.get(id))
      .filter((deliverable): deliverable is DeliverableData => deliverable !== undefined)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  };

  const allDeliverables = computed(() => {
    return Array.from(deliverables.value.values())
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  });

  // Actions - ONLY way to mutate state

  /**
   * Add or update a deliverable
   * Called by build handler after execute/read/rerun/edit responses
   */
  function addDeliverable(deliverable: DeliverableData, version?: DeliverableVersionData): void {
    deliverables.value.set(deliverable.id, deliverable);

    // Add version if provided
    if (version) {
      addVersion(deliverable.id, version);
    }
  }

  /**
   * Handle build execute result from handler
   */
  function handleBuildExecute(result: BuildExecuteResult, planId?: string): void {
    addDeliverable(result.deliverable, result.version);

    if (planId) {
      associateDeliverableWithPlan(result.deliverable.id, planId);
    }

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.deliverable.id, result.version.id);
    }
  }

  /**
   * Handle build read result from handler
   */
  function handleBuildRead(result: BuildReadResult): void {
    addDeliverable(result.deliverable, result.version);

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.deliverable.id, result.version.id);
    }
  }

  /**
   * Handle build rerun result from handler
   */
  function handleBuildRerun(result: BuildRerunResult): void {
    addDeliverable(result.deliverable, result.version);

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.deliverable.id, result.version.id);
    }
  }

  /**
   * Handle build edit result from handler
   */
  function handleBuildEdit(result: BuildEditResult): void {
    addDeliverable(result.deliverable, result.version);

    // Set this version as current
    if (result.version) {
      setCurrentVersion(result.deliverable.id, result.version.id);
    }
  }

  /**
   * Handle build list result from handler
   */
  function handleBuildList(deliverables: DeliverableData[], planId?: string): void {
    deliverables.forEach(deliverable => {
      addDeliverable(deliverable);

      if (planId) {
        associateDeliverableWithPlan(deliverable.id, planId);
      }
    });
  }

  /**
   * Update deliverable data
   */
  function updateDeliverable(deliverableId: string, updates: Partial<DeliverableData>): void {
    const existing = deliverables.value.get(deliverableId);
    if (existing) {
      deliverables.value.set(deliverableId, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete deliverable
   * Called by delete handler
   */
  function deleteDeliverable(deliverableId: string): void {
    deliverables.value.delete(deliverableId);
    deliverableVersions.value.delete(deliverableId);
    currentVersionId.value.delete(deliverableId);

    // Remove from plan associations
    deliverablesByPlan.value.forEach((deliverableIds, planId) => {
      const filtered = deliverableIds.filter(id => id !== deliverableId);
      if (filtered.length > 0) {
        deliverablesByPlan.value.set(planId, filtered);
      } else {
        deliverablesByPlan.value.delete(planId);
      }
    });
  }

  /**
   * Add version to a deliverable
   */
  function addVersion(deliverableId: string, version: DeliverableVersionData): void {
    const versions = deliverableVersions.value.get(deliverableId) || [];

    // Check if version already exists
    const existingIndex = versions.findIndex(v => v.id === version.id);

    if (existingIndex >= 0) {
      // Update existing version
      versions[existingIndex] = version;
      deliverableVersions.value.set(deliverableId, [...versions]);
    } else {
      // Add new version
      deliverableVersions.value.set(deliverableId, [...versions, version]);
    }
  }

  /**
   * Set current version for a deliverable
   */
  function setCurrentVersion(deliverableId: string, versionId: string): void {
    currentVersionId.value.set(deliverableId, versionId);
  }

  /**
   * Delete a version
   */
  function deleteVersion(deliverableId: string, versionId: string): void {
    const versions = deliverableVersions.value.get(deliverableId) || [];
    const filtered = versions.filter(v => v.id !== versionId);
    deliverableVersions.value.set(deliverableId, filtered);

    // Clear current version if it was deleted
    if (currentVersionId.value.get(deliverableId) === versionId) {
      currentVersionId.value.delete(deliverableId);

      // Set to latest version if available
      if (filtered.length > 0) {
        const latest = filtered.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        setCurrentVersion(deliverableId, latest.id);
      }
    }
  }

  /**
   * Update execution status for a version
   */
  function updateExecutionStatus(
    deliverableId: string,
    versionId: string,
    status: string
  ): void {
    const versions = deliverableVersions.value.get(deliverableId) || [];
    const versionIndex = versions.findIndex(v => v.id === versionId);

    if (versionIndex >= 0) {
      const updatedVersion = {
        ...versions[versionIndex],
        status,
        updatedAt: new Date().toISOString(),
      };
      versions[versionIndex] = updatedVersion;
      deliverableVersions.value.set(deliverableId, [...versions]);
    }
  }

  /**
   * Associate deliverable with plan
   */
  function associateDeliverableWithPlan(deliverableId: string, planId: string): void {
    const planDeliverables = deliverablesByPlan.value.get(planId) || [];
    if (!planDeliverables.includes(deliverableId)) {
      deliverablesByPlan.value.set(planId, [...planDeliverables, deliverableId]);
    }
  }

  /**
   * Clear all deliverables for a plan
   */
  function clearDeliverablesByPlan(planId: string): void {
    const deliverableIds = deliverablesByPlan.value.get(planId) || [];
    deliverableIds.forEach(deliverableId => deleteDeliverable(deliverableId));
    deliverablesByPlan.value.delete(planId);
  }

  /**
   * Clear all deliverables (logout)
   */
  function clearAll(): void {
    deliverables.value.clear();
    deliverableVersions.value.clear();
    currentVersionId.value.clear();
    deliverablesByPlan.value.clear();
  }

  // Return public API
  return {
    // State (read-only exposure)
    deliverables: readonly(deliverables),

    // Getters
    deliverableById,
    currentVersion,
    versionsByDeliverableId,
    deliverablesByPlanId,
    allDeliverables,

    // Actions
    addDeliverable,
    handleBuildExecute,
    handleBuildRead,
    handleBuildRerun,
    handleBuildEdit,
    handleBuildList,
    updateDeliverable,
    deleteDeliverable,
    addVersion,
    setCurrentVersion,
    deleteVersion,
    updateExecutionStatus,
    associateDeliverableWithPlan,
    clearDeliverablesByPlan,
    clearAll,
  };
});
