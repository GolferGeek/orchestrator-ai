/**
 * Deliverable actions for Pinia store
 * Handles all deliverable operations using mode × action architecture
 */

import type { AgentConversation } from './types';
import { createBuildsService } from './builds';

export const deliverableActions = {
  /**
   * Load current deliverable for active conversation
   */
  async loadCurrentDeliverable(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.readBuild(conversation.id);

    if (result) {
      conversation.currentDeliverable = result;
    }
  },

  /**
   * Load deliverable version history for active conversation
   */
  async loadDeliverableVersions(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.listBuildVersions(conversation.id);

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      conversation.deliverableVersions = result.versions;
    }
  },

  /**
   * Edit deliverable (creates new version)
   */
  async editDeliverable(this: any, content: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.editBuild(conversation.id, content);

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      // Reload versions to show new version
      await this.loadDeliverableVersions();
    }
  },

  /**
   * Rerun deliverable with different LLM
   */
  async rerunDeliverable(
    this: any,
    versionId: string,
    provider: string,
    model: string,
  ) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.rerunBuild(
      conversation.id,
      versionId,
      { provider, model },
    );

    if (result) {
      // Reload versions to show new rerun version
      await this.loadDeliverableVersions();
    }
  },

  /**
   * Set current deliverable version
   */
  async setCurrentDeliverableVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.setCurrentVersion(conversation.id, versionId);

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      // Reload versions to update current markers
      await this.loadDeliverableVersions();
    }
  },

  /**
   * Merge deliverable versions
   */
  async mergeDeliverableVersions(
    this: any,
    versionIds: string[],
    mergePrompt: string,
  ) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.mergeVersions(
      conversation.id,
      versionIds,
      mergePrompt,
    );

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      // Reload versions to show merged version
      await this.loadDeliverableVersions();
    }
  },

  /**
   * Copy deliverable version
   */
  async copyDeliverableVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const result = await buildsService.copyVersion(conversation.id, versionId);

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      // Reload versions to show copied version
      await this.loadDeliverableVersions();
    }
  },

  /**
   * Delete deliverable version
   */
  async deleteDeliverableVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const buildsService = createBuildsService(conversation.agent.name);
    const success = await buildsService.deleteVersion(
      conversation.id,
      versionId,
    );

    if (success) {
      // Reload versions to update list
      await this.loadDeliverableVersions();
    }
  },
};
