/**
 * Plan Actions
 * Orchestrates plan operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - tasksService (send requests)
 * - Store mutations (update state)
 */

import { tasksService } from '@/services/tasksService';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { usePlanStore } from '@/stores/planStore';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';

/**
 * Create a new plan
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreatePlan() {
 *   createPlan(agentName, conversationId, message);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param userMessage - User's message requesting the plan
 * @returns The created plan and initial version (mainly for testing/logging)
 */
export async function createPlan(
  agentName: string,
  conversationId: string,
  userMessage: string,
): Promise<{ plan: PlanData; version: PlanVersionData; isNew: boolean }> {
  console.log('🔨 [Plan Create Action] Starting', { agentName, conversationId });

  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();
  const llmStore = useLLMPreferencesStore();
  const planStore = usePlanStore();

  try {
    // 1. Mark as sending
    chatUiStore.setIsSendingMessage(true);

    // 2. Add user message to conversation
    const conversation = conversationsStore.conversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversationsStore.addMessage(conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // 3. Build conversation history
    const messages = conversationsStore.messagesByConversation(conversationId);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 4. Build LLM selection from preferences store
    const llmSelection = llmStore.selectedProvider && llmStore.selectedModel ? {
      providerName: llmStore.selectedProvider.name,
      modelName: llmStore.selectedModel.modelName,
    } : undefined;

    // 5. Call tasksService to create and execute the plan task
    console.log('📤 [Plan Create Action] Calling tasksService.createAgentTask');

    const result = await tasksService.createAgentTask(
      conversation.agentType || 'custom',
      agentName,
      {
        method: 'plan',
        prompt: userMessage,
        conversationId,
        conversationHistory,
        llmSelection,
        executionMode: chatUiStore.executionMode || 'polling',
      },
      { namespace: conversation.organizationSlug || 'global' }
    );

    console.log('📥 [Plan Create Action] Task response:', result);

    // 6. Parse result to extract plan
    let parsedResult = result.result;
    if (typeof parsedResult === 'string') {
      try {
        parsedResult = JSON.parse(parsedResult);
      } catch (e) {
        // If direct parsing fails, try to find JSON in the text
        const jsonMatch = parsedResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResult = JSON.parse(jsonMatch[0]);
            console.log('📦 [Plan Action] Extracted JSON from text response');
          } catch (e2) {
            // Still not valid JSON, use as-is
          }
        }
      }
    }

    // Extract thinking content - if original result was a string with thinking before JSON, extract it
    let extractedThinking: string | undefined;
    if (typeof result.result === 'string') {
      const jsonMatch = result.result.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch.index !== undefined && jsonMatch.index > 0) {
        extractedThinking = result.result.substring(0, jsonMatch.index).trim();
        console.log('🧠 [Plan Action] Extracted thinking from before JSON:', extractedThinking.substring(0, 100));
      }
    }

    // Extract thinking content separately (if available in structured response)
    const thinkingContent =
      extractedThinking ||
      (parsedResult as any)?.payload?.thinking ||
      (parsedResult as any)?.thinking ||
      (parsedResult as any)?.payload?.content?.thinking;

    // Extract the actual message content
    let assistantContent =
      (parsedResult as any)?.payload?.content?.message ||
      (parsedResult as any)?.content?.message ||
      (parsedResult as any)?.message ||
      'Plan created successfully';

    // Strip <thinking> tags from message content if they exist
    if (typeof assistantContent === 'string') {
      const thinkingTagRegex = /<thinking>[\s\S]*?<\/thinking>/gi;
      const strippedContent = assistantContent.replace(thinkingTagRegex, '').trim();

      // If we stripped thinking tags and don't have separate thinking content, extract it
      if (!thinkingContent && thinkingTagRegex.test(assistantContent)) {
        const thinkingMatch = assistantContent.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        if (thinkingMatch && thinkingMatch[1]) {
          (parsedResult as any).extractedThinking = thinkingMatch[1].trim();
        }
      }

      // Try to detect untagged thinking at the start of the response
      // Common patterns: "Let me think...", "I need to...", "First, I'll...", etc.
      if (!thinkingContent && strippedContent.length > 200) {
        const thinkingPatterns = [
          /^(Let me think|I need to|First,? I'?ll?|I'?ll? need to|My approach|I should|To (create|plan|develop))[\s\S]{100,}?(?=\n\n[A-Z#]|\n\n\*)/i,
          /^[\s\S]{50,}?(?=\n\n#{1,3}\s)/,  // Text before markdown headers
        ];

        for (const pattern of thinkingPatterns) {
          const match = strippedContent.match(pattern);
          if (match) {
            (parsedResult as any).extractedThinking = match[0].trim();
            assistantContent = strippedContent.substring(match[0].length).trim();
            console.log('🧠 [Plan Action] Detected untagged thinking, extracted:', (parsedResult as any).extractedThinking.substring(0, 100));
            break;
          }
        }
      }

      assistantContent = strippedContent || 'Plan created successfully';
    }

    // Extract plan from response
    const plan = (parsedResult as any)?.payload?.plan ||
                 (parsedResult as any)?.plan;
    const version = (parsedResult as any)?.payload?.version ||
                   (parsedResult as any)?.version ||
                   plan?.currentVersion;

    if (!plan) {
      throw new Error('No plan in response');
    }

    console.log('✅ [Plan Create Action] Plan extracted:', { plan, version });

    // 7. Update plan store
    planStore.addPlan(plan, version);
    planStore.associatePlanWithConversation(plan.id, conversationId);

    if (version) {
      planStore.setCurrentVersion(plan.id, version.id);
    }

    // 8. Add assistant message to conversation
    conversationsStore.addMessage(conversationId, {
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
      planId: plan.id,
      metadata: {
        taskId: result.taskId,
        planId: plan.id,
        thinking: thinkingContent || (parsedResult as any).extractedThinking,
        provider: (parsedResult as any)?.payload?.metadata?.provider ||
                 (parsedResult as any)?.metadata?.provider,
        model: (parsedResult as any)?.payload?.metadata?.model ||
              (parsedResult as any)?.metadata?.model,
      },
    });

    console.log('💾 [Plan Create Action] Complete');

    chatUiStore.setIsSendingMessage(false);

    return {
      plan,
      version,
      isNew: true,
    };
  } catch (error) {
    console.error('❌ [Plan Create Action] Error:', error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(error instanceof Error ? error.message : 'Failed to create plan');
    throw error;
  }
}

/**
 * Rerun plan with different LLM
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleRerunPlan() {
 *   rerunPlan(agentName, conversationId, versionId, llmConfig);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param versionId - Version ID to rerun
 * @param llmConfig - LLM configuration for rerun
 * @returns The new plan version (mainly for testing/logging)
 */
export async function rerunPlan(
  agentName: string,
  conversationId: string,
  versionId: string,
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<{ plan: PlanData; version: PlanVersionData }> {
  console.log('🔄 [Plan Rerun Action] Starting', { agentName, conversationId, versionId, llmConfig });

  // 1. Get existing plan from store (for context)
  const planStore = usePlanStore();
  const existingPlans = planStore.plansByConversationId(conversationId);

  console.log('📚 [Plan Rerun Action] Existing plans:', existingPlans.length);

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build and send request
  console.log('📤 [Plan Rerun Action] Sending rerun request');
  const response = await api.plans.rerun(conversationId, versionId, llmConfig);

  console.log('📥 [Plan Rerun Action] Response received:', JSON.stringify(response, null, 2));

  // 4. Validate and extract using handler
  // Check if it's a JSON-RPC response
  if (response.jsonrpc === '2.0' && response.result) {
    // JSON-RPC format - check the result
    if (!response.result.success) {
      console.error('❌ [Plan Rerun Action] Request failed:', response.result);
      throw new Error(response.result.payload?.metadata?.reason || 'Failed to rerun plan');
    }
  } else if (response.success === false) {
    // Direct format - check success
    console.error('❌ [Plan Rerun Action] Request failed:', response);
    throw new Error(response.error?.message || 'Failed to rerun plan');
  }

  const result: PlanRerunResult = planResponseHandler.handleRerun(response);

  console.log('✅ [Plan Rerun Action] Response validated:', result);
  console.log('🔍 [Plan Rerun Action] Plan ID:', result.plan.id, 'Version ID:', result.version.id, 'Version #:', result.version.versionNumber);

  // 5. Update store
  // Add the new version to the store
  console.log('📝 [Plan Rerun Action] Calling addVersion...');
  planStore.addVersion(result.plan.id, result.version);
  console.log('📝 [Plan Rerun Action] addVersion completed');

  // Set the new version as current (optional - depends on UX preference)
  console.log('📝 [Plan Rerun Action] Calling setCurrentVersion...');
  planStore.setCurrentVersion(result.plan.id, result.version.id);
  console.log('📝 [Plan Rerun Action] setCurrentVersion completed');

  console.log('💾 [Plan Rerun Action] Store updated with new version');

  // 6. Return the result
  return {
    plan: result.plan,
    version: result.version,
  };
}
