/**
 * Orchestrate Actions
 * Orchestrates orchestration operations following the Plan/Build pattern
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - Builders (create request payloads)
 * - API (send requests)
 * - Handlers (validate and extract responses)
 * - Store mutations (update state)
 */

import { createAgent2AgentApi } from '../api/agent2agent.api';
import { useOrchestratorStore } from '@/stores/orchestratorStore';
import type {
  OrchestrateCreatePayload,
  OrchestrateExecutePayload,
  OrchestrateContinuePayload,
  OrchestrateSaveRecipePayload,
  OrchestrateCreateResponseContent,
  OrchestrateExecuteResponseContent,
} from '@orchestrator-ai/transport-types/modes/orchestrate.types';

/**
 * Create a new orchestration
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreateOrchestration() {
 *   createOrchestration(agentName, conversationId, parameters);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the orchestrator agent to use
 * @param conversationId - Conversation ID
 * @param parameters - Orchestration parameters
 * @returns The created orchestration
 */
export async function createOrchestration(
  agentName: string,
  conversationId: string,
  parameters?: Record<string, unknown>,
): Promise<OrchestrateCreateResponseContent> {
  console.log('🔨 [Orchestrate Create Action] Starting', { agentName, conversationId });

  // 1. Get orchestrator store
  const orchestratorStore = useOrchestratorStore();

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build payload
  const payload: OrchestrateCreatePayload = {
    action: 'create',
    parameters,
  };

  // 4. Send request
  console.log('📤 [Orchestrate Create Action] Sending request');
  const response = await api.orchestrate.create(conversationId, payload);

  console.log('📥 [Orchestrate Create Action] Response received:', response);

  // 5. Validate response
  if (!response.success) {
    console.error('❌ [Orchestrate Create Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create orchestration');
  }

  const content = response.content as OrchestrateCreateResponseContent;

  console.log('✅ [Orchestrate Create Action] Response validated:', content);

  // 6. Update store
  if (content.orchestration && content.orchestrationRunId) {
    const { orchestration } = content;

    // Map backend response to store format
    const steps = orchestration.steps?.map((step: Record<string, unknown>, index: number) => ({
      stepNumber: index,
      mode: step.mode || 'build',
      action: step.action || 'create',
      agentId: step.agent,
      status: 'pending' as const,
    })) || [];

    orchestratorStore.startOrchestration(
      content.orchestrationRunId,
      conversationId,
      orchestration.name || 'orchestration',
      steps,
      {
        displayName: orchestration.displayName,
        description: orchestration.description,
        version: orchestration.version,
        definitionId: content.orchestrationDefinitionId,
      }
    );

    orchestratorStore.setActiveOrchestration(content.orchestrationRunId);
  }

  console.log('💾 [Orchestrate Create Action] Store updated');

  // 7. Return the result
  return content;
}

/**
 * Execute an orchestration
 *
 * @param agentName - Name of the orchestrator agent
 * @param conversationId - Conversation ID
 * @param orchestrationRunId - ID of the orchestration run to execute
 * @param parameters - Execution parameters
 * @returns The execution result
 */
export async function executeOrchestration(
  agentName: string,
  conversationId: string,
  orchestrationRunId: string,
  parameters?: Record<string, any>,
): Promise<OrchestrateExecuteResponseContent> {
  console.log('🔨 [Orchestrate Execute Action] Starting', { agentName, orchestrationRunId });

  // 1. Get orchestrator store
  const orchestratorStore = useOrchestratorStore();

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build payload
  const payload: OrchestrateExecutePayload = {
    action: 'execute',
    orchestrationRunId,
    parameters,
  };

  // 4. Send request
  console.log('📤 [Orchestrate Execute Action] Sending request');
  const response = await api.orchestrate.execute(conversationId, payload);

  console.log('📥 [Orchestrate Execute Action] Response received:', response);

  // 5. Validate response
  if (!response.success) {
    console.error('❌ [Orchestrate Execute Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to execute orchestration');
  }

  const content = response.content as OrchestrateExecuteResponseContent;

  console.log('✅ [Orchestrate Execute Action] Response validated:', content);

  // 6. Update store
  if (content.status) {
    // Map backend status to store status
    const statusMap: Record<string, string> = {
      'running': 'running',
      'completed': 'completed',
      'failed': 'failed',
      'paused': 'paused',
      'cancelled': 'cancelled',
    };
    const storeStatus = statusMap[content.status] || 'running';

    orchestratorStore.updateOrchestrationStatus(orchestrationRunId, storeStatus);

    // Update step statuses if provided
    if (content.currentStep) {
      orchestratorStore.updateStepStatus(
        orchestrationRunId,
        content.currentStep.id,
        content.currentStep.status as 'pending' | 'running' | 'completed' | 'failed'
      );
    }
  }

  console.log('💾 [Orchestrate Execute Action] Store updated');

  // 7. Return the result
  return content;
}

/**
 * Continue an orchestration
 *
 * @param agentName - Name of the orchestrator agent
 * @param conversationId - Conversation ID
 * @param orchestrationRunId - ID of the orchestration run to continue
 * @param context - Additional context for continuation
 * @returns The continuation result
 */
export async function continueOrchestration(
  agentName: string,
  conversationId: string,
  orchestrationRunId: string,
  context?: Record<string, unknown>,
): Promise<unknown> {
  console.log('🔨 [Orchestrate Continue Action] Starting', { agentName, orchestrationRunId });

  // 1. Create API client
  const api = createAgent2AgentApi(agentName);

  // 2. Build payload
  const payload: OrchestrateContinuePayload = {
    action: 'continue',
    orchestrationRunId,
    context,
  };

  // 3. Send request
  console.log('📤 [Orchestrate Continue Action] Sending request');
  const response = await api.orchestrate.continue(conversationId, payload);

  console.log('📥 [Orchestrate Continue Action] Response received:', response);

  // 4. Validate response
  if (!response.success) {
    console.error('❌ [Orchestrate Continue Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to continue orchestration');
  }

  console.log('✅ [Orchestrate Continue Action] Response validated');

  // 5. Return the result
  return response.content;
}

/**
 * Save orchestration as recipe
 *
 * @param agentName - Name of the orchestrator agent
 * @param conversationId - Conversation ID
 * @param orchestrationRunId - ID of the orchestration run to save
 * @param recipeName - Name for the recipe
 * @param description - Recipe description
 * @returns The saved recipe
 */
export async function saveOrchestrationRecipe(
  agentName: string,
  conversationId: string,
  orchestrationRunId: string,
  recipeName: string,
  description?: string,
): Promise<unknown> {
  console.log('🔨 [Orchestrate Save Recipe Action] Starting', { agentName, recipeName });

  // 1. Create API client
  const api = createAgent2AgentApi(agentName);

  // 2. Build payload
  const payload: OrchestrateSaveRecipePayload = {
    action: 'save_recipe',
    orchestrationRunId,
    recipeName,
    description,
  };

  // 3. Send request
  console.log('📤 [Orchestrate Save Recipe Action] Sending request');
  const response = await api.orchestrate.saveRecipe(conversationId, payload);

  console.log('📥 [Orchestrate Save Recipe Action] Response received:', response);

  // 4. Validate response
  if (!response.success) {
    console.error('❌ [Orchestrate Save Recipe Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to save recipe');
  }

  console.log('✅ [Orchestrate Save Recipe Action] Response validated');

  // 5. Return the result
  return response.content;
}
