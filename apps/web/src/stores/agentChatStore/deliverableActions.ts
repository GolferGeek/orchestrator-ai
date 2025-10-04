/**
 * Deliverable actions for Pinia store
 * Handles all deliverable operations using mode × action architecture
 */

import type { AgentConversation } from './types';
import { deliverableApi } from '@/services/agent2agent';

export const deliverableActions = {
  /**
   * Load current deliverable for active conversation
   */
  async loadCurrentDeliverable(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const result = await deliverableApi.read(conversation.id);

    if (result.success) {
      conversation.currentDeliverable = result.data;
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

    const result = await deliverableApi.list(conversation.id);

    if (result.success) {
      conversation.currentDeliverable = result.data.deliverable;
      conversation.deliverableVersions = result.data.versions;
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

    const result = await deliverableApi.edit(conversation.id, content);

    if (result.success) {
      conversation.currentDeliverable = result.data.deliverable;
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

    const result = await deliverableApi.rerun(
      conversation.id,
      versionId,
      provider,
      model,
    );

    if (result.success) {
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

    const result = await deliverableApi.setCurrent(conversation.id, versionId);

    if (result.success) {
      conversation.currentDeliverable = result.data.deliverable;
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

    const result = await deliverableApi.mergeVersions(
      conversation.id,
      versionIds,
      mergePrompt,
    );

    if (result.success) {
      conversation.currentDeliverable = result.data.deliverable;
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

    const result = await deliverableApi.copyVersion(conversation.id, versionId);

    if (result.success) {
      conversation.currentDeliverable = result.data.deliverable;
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

    const result = await deliverableApi.deleteVersion(
      conversation.id,
      versionId,
    );

    if (result.success) {
      // Reload versions to update list
      await this.loadDeliverableVersions();
    }
  },
};
