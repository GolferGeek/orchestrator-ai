/**
 * Plan actions for Pinia store
 * Handles all plan operations using mode × action architecture
 */

import type { AgentConversation } from './types';
import { createPlansService } from './plans';

export const planActions = {
  /**
   * Load current plan for active conversation
   */
  async loadCurrentPlan(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.readPlan(conversation.id);

    if (result) {
      conversation.currentPlan = result;
    }
  },

  /**
   * Load plan version history for active conversation
   */
  async loadPlanVersions(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.listPlanVersions(conversation.id);

    if (result) {
      conversation.currentPlan = result.plan;
      conversation.planVersions = result.versions;
    }
  },

  /**
   * Edit plan (creates new version)
   */
  async editPlan(this: any, content: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.editPlan(conversation.id, content);

    if (result) {
      conversation.currentPlan = result.plan;
      // Reload versions to show new version
      await this.loadPlanVersions();
    }
  },

  /**
   * Set current plan version
   */
  async setCurrentPlanVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.setCurrentVersion(conversation.id, versionId);

    if (result) {
      conversation.currentPlan = result.plan;
      // Reload versions to update current markers
      await this.loadPlanVersions();
    }
  },

  /**
   * Merge plan versions
   */
  async mergePlanVersions(
    this: any,
    versionIds: string[],
    mergePrompt: string,
  ) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.mergeVersions(
      conversation.id,
      versionIds,
      mergePrompt,
    );

    if (result) {
      conversation.currentPlan = result.plan;
      // Reload versions to show merged version
      await this.loadPlanVersions();
    }
  },

  /**
   * Copy plan version
   */
  async copyPlanVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const result = await plansService.copyVersion(conversation.id, versionId);

    if (result) {
      conversation.currentPlan = result.plan;
      // Reload versions to show copied version
      await this.loadPlanVersions();
    }
  },

  /**
   * Delete plan version
   */
  async deletePlanVersion(this: any, versionId: string) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const plansService = createPlansService(conversation.agent.name);
    const success = await plansService.deleteVersion(conversation.id, versionId);

    if (success) {
      // Reload versions to update list
      await this.loadPlanVersions();
    }
  },
};
