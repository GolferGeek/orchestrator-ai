/**
 * Plans service for managing plan operations in agent chat
 * Integrates with the new mode × action architecture
 */

import { planApi } from '@/services/agent2agent';
import type { Plan, PlanVersion } from '@/services/agent2agent/types';

/**
 * Service for managing plan operations
 */
export class PlansService {
  /**
   * Create or refine a plan
   */
  async createPlan(
    conversationId: string,
    title: string,
    content: string,
  ): Promise<{ plan: Plan; version: PlanVersion; isNew: boolean } | null> {
    try {
      const response = await planApi.create(conversationId, title, content);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to create plan:', response.error);
      return null;
    } catch (error) {
      console.error('Error creating plan:', error);
      return null;
    }
  }

  /**
   * Read current plan
   */
  async readPlan(conversationId: string): Promise<Plan | null> {
    try {
      const response = await planApi.read(conversationId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to read plan:', response.error);
      return null;
    } catch (error) {
      console.error('Error reading plan:', error);
      return null;
    }
  }

  /**
   * Get plan version history
   */
  async listPlanVersions(
    conversationId: string,
  ): Promise<{ plan: Plan; versions: PlanVersion[] } | null> {
    try {
      const response = await planApi.list(conversationId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to list plan versions:', response.error);
      return null;
    } catch (error) {
      console.error('Error listing plan versions:', error);
      return null;
    }
  }

  /**
   * Edit plan (manual edit, creates new version)
   */
  async editPlan(
    conversationId: string,
    content: string,
  ): Promise<{ plan: Plan; version: PlanVersion } | null> {
    try {
      const response = await planApi.edit(conversationId, content);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to edit plan:', response.error);
      return null;
    } catch (error) {
      console.error('Error editing plan:', error);
      return null;
    }
  }

  /**
   * Set a specific version as current
   */
  async setCurrentVersion(
    conversationId: string,
    versionId: string,
  ): Promise<{ plan: Plan; version: PlanVersion } | null> {
    try {
      const response = await planApi.setCurrent(conversationId, versionId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to set current version:', response.error);
      return null;
    } catch (error) {
      console.error('Error setting current version:', error);
      return null;
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(
    conversationId: string,
    versionId: string,
  ): Promise<boolean> {
    try {
      const response = await planApi.deleteVersion(conversationId, versionId);

      if (response.success) {
        return true;
      }

      console.error('Failed to delete version:', response.error);
      return false;
    } catch (error) {
      console.error('Error deleting version:', error);
      return false;
    }
  }

  /**
   * Merge multiple versions
   */
  async mergeVersions(
    conversationId: string,
    versionIds: string[],
    mergePrompt: string,
  ): Promise<{
    plan: Plan;
    newVersion: PlanVersion;
    conflictSummary?: string;
  } | null> {
    try {
      const response = await planApi.mergeVersions(
        conversationId,
        versionIds,
        mergePrompt,
      );

      if (response.success) {
        return response.data;
      }

      console.error('Failed to merge versions:', response.error);
      return null;
    } catch (error) {
      console.error('Error merging versions:', error);
      return null;
    }
  }

  /**
   * Copy a version to create a new version
   */
  async copyVersion(
    conversationId: string,
    versionId: string,
  ): Promise<{ plan: Plan; version: PlanVersion } | null> {
    try {
      const response = await planApi.copyVersion(conversationId, versionId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to copy version:', response.error);
      return null;
    } catch (error) {
      console.error('Error copying version:', error);
      return null;
    }
  }

  /**
   * Delete entire plan
   */
  async deletePlan(conversationId: string): Promise<boolean> {
    try {
      const response = await planApi.delete(conversationId);

      if (response.success) {
        return true;
      }

      console.error('Failed to delete plan:', response.error);
      return false;
    } catch (error) {
      console.error('Error deleting plan:', error);
      return false;
    }
  }
}

// Export singleton instance
export const plans = new PlansService();
