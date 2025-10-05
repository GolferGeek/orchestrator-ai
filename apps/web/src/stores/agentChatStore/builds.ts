/**
 * Builds service for managing build/deliverable operations in agent chat
 * Integrates with the new mode × action architecture
 * Copied from plans.ts - identical pattern for build mode
 */

import { createAgent2AgentApi, type Agent2AgentApi } from '@/services/agent2agent/api/agent2agent.api';
import type { Deliverable, DeliverableVersion } from '@/services/agent2agent/types';

/**
 * Service for managing build/deliverable operations
 */
export class BuildsService {
  private api: Agent2AgentApi;

  constructor(agentSlug: string) {
    this.api = createAgent2AgentApi(agentSlug);
  }

  /**
   * Create or execute a build
   */
  async createBuild(
    conversationId: string,
    message: string,
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion; isNew: boolean } | null> {
    try {
      const response = await this.api.deliverables.create(conversationId, message);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to create build:', response.error);
      return null;
    } catch (error) {
      console.error('Error creating build:', error);
      return null;
    }
  }

  /**
   * Read current deliverable
   */
  async readBuild(conversationId: string): Promise<Deliverable | null> {
    try {
      const response = await this.api.deliverables.read(conversationId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to read build:', response.error);
      return null;
    } catch (error) {
      console.error('Error reading build:', error);
      return null;
    }
  }

  /**
   * Get deliverable version history
   */
  async listBuildVersions(
    conversationId: string,
  ): Promise<{ deliverable: Deliverable; versions: DeliverableVersion[] } | null> {
    try {
      const response = await this.api.deliverables.list(conversationId);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to list build versions:', response.error);
      return null;
    } catch (error) {
      console.error('Error listing build versions:', error);
      return null;
    }
  }

  /**
   * Edit deliverable (manual edit, creates new version)
   */
  async editBuild(
    conversationId: string,
    editedContent: string,
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion } | null> {
    try {
      const response = await this.api.deliverables.edit(conversationId, editedContent);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to edit build:', response.error);
      return null;
    } catch (error) {
      console.error('Error editing build:', error);
      return null;
    }
  }

  /**
   * Rerun build with different LLM configuration
   */
  async rerunBuild(
    conversationId: string,
    versionId: string,
    rerunConfig: object,
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion } | null> {
    try {
      const response = await this.api.deliverables.rerun(conversationId, versionId, rerunConfig);

      if (response.success) {
        return response.data;
      }

      console.error('Failed to rerun build:', response.error);
      return null;
    } catch (error) {
      console.error('Error rerunning build:', error);
      return null;
    }
  }

  /**
   * Set a specific version as current
   */
  async setCurrentVersion(
    conversationId: string,
    versionId: string,
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion } | null> {
    try {
      const response = await this.api.deliverables.setCurrent(conversationId, versionId);

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
      const response = await this.api.deliverables.deleteVersion(conversationId, versionId);

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
    deliverable: Deliverable;
    newVersion: DeliverableVersion;
    conflictSummary?: string;
  } | null> {
    try {
      const response = await this.api.deliverables.mergeVersions(
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
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion } | null> {
    try {
      const response = await this.api.deliverables.copyVersion(conversationId, versionId);

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
   * Delete entire deliverable
   */
  async deleteBuild(conversationId: string): Promise<boolean> {
    try {
      const response = await this.api.deliverables.delete(conversationId);

      if (response.success) {
        return true;
      }

      console.error('Failed to delete build:', response.error);
      return false;
    } catch (error) {
      console.error('Error deleting build:', error);
      return false;
    }
  }
}

/**
 * Factory function to create a BuildsService instance for a specific agent
 */
export function createBuildsService(agentSlug: string): BuildsService {
  return new BuildsService(agentSlug);
}
