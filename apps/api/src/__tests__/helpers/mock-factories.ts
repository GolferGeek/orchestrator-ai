/**
 * Mock Factories for Test Data
 *
 * Provides factory methods to create test data objects with sensible defaults.
 * Each factory accepts optional overrides for customization.
 *
 * Usage:
 * ```typescript
 * const agent = MockFactories.createAgent({ slug: 'test-agent' });
 * const orchestration = MockFactories.createOrchestrationDefinition();
 * ```
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Agent {
  id: string;
  organization_slug: string;
  slug: string;
  display_name: string;
  description: string;
  agent_type: 'context' | 'api' | 'tool' | 'function' | 'orchestrator';
  runner_type: string;
  mode_profile: string;
  version: string;
  status: string;
  yaml: string;
  agent_card: Record<string, unknown>;
  context: Record<string, unknown>;
  configuration: Record<string, unknown>;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface OrchestrationDefinition {
  id: string;
  organization_slug: string;
  slug: string;
  display_name: string;
  description: string;
  owner_agent_slug: string;
  version: number;
  is_active: boolean;
  configuration: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface OrchestrationRun {
  id: string;
  organization_slug: string;
  orchestration_definition_id: string;
  orchestration_definition_slug: string;
  orchestration_version: number;
  conversation_id: string;
  task_id: string;
  status:
    | 'pending'
    | 'planning'
    | 'running'
    | 'checkpoint'
    | 'completed'
    | 'failed'
    | 'aborted'
    | 'in_progress';
  parameters: Record<string, unknown>;
  metadata: Record<string, unknown>;
  parent_run_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrchestrationStep {
  id: string;
  orchestration_run_id: string;
  step_index: number;
  step_name: string;
  step_order: number;
  agent_slug: string;
  conversation_id: string | null;
  task_id: string | null;
  deliverable_id: string | null;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'cancelled';
  depends_on: number[];
  checkpoint_after: boolean;
  attempt: number;
  parent_step_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  organization_slug: string;
  user_id: string;
  agent_slug: string;
  title: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Deliverable {
  id: string;
  conversation_id: string;
  task_id: string;
  content: string;
  content_type: string;
  version: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  conversation_id: string;
  user_message: string;
  status: string;
  task_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Mock Factories
// ============================================================================

export class MockFactories {
  // --------------------------------------------------------------------------
  // Agent Factories
  // --------------------------------------------------------------------------

  /**
   * Create a generic agent with default values
   */
  static createAgent(overrides: Partial<Agent> = {}): Agent {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      slug: 'test-agent',
      display_name: 'Test Agent',
      description: 'A test agent for automated testing',
      agent_type: 'context',
      runner_type: 'openai',
      mode_profile: 'context_full',
      version: '1.0.0',
      status: 'active',
      yaml: JSON.stringify({
        metadata: {
          name: 'test-agent',
          version: '1.0.0',
        },
      }),
      agent_card: { protocol: 'a2a' },
      context: { prompt: 'You are a helpful test agent' },
      configuration: {
        model: 'gpt-4o',
        temperature: 0.7,
      },
      config: {
        capabilities: [],
      },
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create a context agent (summarization, analysis)
   */
  static createContextAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      slug: 'context-agent',
      agent_type: 'context',
      mode_profile: 'context_full',
      runner_type: 'openai',
      context: {
        prompt_prefix: 'You analyze and summarize information',
      },
      configuration: {
        model: 'gpt-4o',
        temperature: 0.6,
        streaming: true,
      },
      ...overrides,
    });
  }

  /**
   * Create an API agent (external service calls)
   */
  static createApiAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      slug: 'api-agent',
      agent_type: 'api',
      mode_profile: 'api_full',
      runner_type: 'openai',
      configuration: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
      },
      ...overrides,
    });
  }

  /**
   * Create a tool agent (MCP tools)
   */
  static createToolAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      slug: 'tool-agent',
      agent_type: 'tool',
      mode_profile: 'tool_full',
      configuration: {
        tools: ['mcp_tool_example'],
      },
      ...overrides,
    });
  }

  /**
   * Create a function agent (custom code execution)
   */
  static createFunctionAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      slug: 'function-agent',
      agent_type: 'function',
      mode_profile: 'function_full',
      runner_type: 'custom',
      configuration: {
        code: 'function handler(input) { return { result: input }; }',
      },
      ...overrides,
    });
  }

  /**
   * Create an orchestrator agent (coordinates other agents)
   */
  static createOrchestratorAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      slug: 'orchestrator-agent',
      agent_type: 'orchestrator',
      mode_profile: 'orchestrator_full',
      runner_type: 'orchestrator',
      configuration: {
        orchestration_slug: 'test-orchestration',
      },
      ...overrides,
    });
  }

  // --------------------------------------------------------------------------
  // Orchestration Factories
  // --------------------------------------------------------------------------

  /**
   * Create an orchestration definition
   */
  static createOrchestrationDefinition(
    overrides: Partial<OrchestrationDefinition> = {},
  ): OrchestrationDefinition {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      slug: 'test-orchestration',
      display_name: 'Test Orchestration',
      description: 'A test orchestration for automated testing',
      owner_agent_slug: 'test-orchestrator',
      version: 1,
      is_active: true,
      configuration: {
        steps: [
          { name: 'step1', agent_slug: 'agent1' },
          { name: 'step2', agent_slug: 'agent2' },
        ],
      },
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create an orchestration run
   */
  static createOrchestrationRun(
    overrides: Partial<OrchestrationRun> = {},
  ): OrchestrationRun {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      orchestration_definition_id: uuidv4(),
      orchestration_definition_slug: 'test-orchestration',
      orchestration_version: 1,
      conversation_id: uuidv4(),
      task_id: uuidv4(),
      status: 'pending',
      parameters: {},
      metadata: {},
      parent_run_id: null,
      started_at: null,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create an orchestration step
   */
  static createOrchestrationStep(
    overrides: Partial<OrchestrationStep> = {},
  ): OrchestrationStep {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      orchestration_run_id: uuidv4(),
      step_index: 0,
      step_name: 'test-step',
      step_order: 0,
      agent_slug: 'test-agent',
      conversation_id: null,
      task_id: null,
      deliverable_id: null,
      status: 'pending',
      depends_on: [],
      checkpoint_after: false,
      attempt: 1,
      parent_step_id: null,
      started_at: null,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Supporting Entity Factories
  // --------------------------------------------------------------------------

  /**
   * Create a conversation
   */
  static createConversation(
    overrides: Partial<Conversation> = {},
  ): Conversation {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      user_id: uuidv4(),
      agent_slug: 'test-agent',
      title: 'Test Conversation',
      status: 'active',
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create a deliverable
   */
  static createDeliverable(overrides: Partial<Deliverable> = {}): Deliverable {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      conversation_id: uuidv4(),
      task_id: uuidv4(),
      content: 'Test deliverable content',
      content_type: 'text/plain',
      version: 1,
      status: 'completed',
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create a task
   */
  static createTask(overrides: Partial<Task> = {}): Task {
    const timestamp = new Date();
    return {
      id: uuidv4(),
      conversation_id: uuidv4(),
      user_message: 'Test task message',
      status: 'pending',
      task_type: 'user_request',
      description: 'Test task description',
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Batch Factories
  // --------------------------------------------------------------------------

  /**
   * Create a complete orchestration test scenario:
   * - Orchestration definition
   * - Orchestration run
   * - Multiple steps
   */
  static createOrchestrationScenario(
    stepCount: number = 2,
    overrides?: { organizationSlug?: string; orchestrationSlug?: string },
  ) {
    const definition = MockFactories.createOrchestrationDefinition({
      organization_slug: overrides?.organizationSlug,
      slug: overrides?.orchestrationSlug,
    });
    const run = MockFactories.createOrchestrationRun({
      orchestration_definition_id: definition.id,
      orchestration_definition_slug: definition.slug,
      organization_slug: overrides?.organizationSlug,
    });
    const steps = Array.from({ length: stepCount }, (_, index) =>
      MockFactories.createOrchestrationStep({
        orchestration_run_id: run.id,
        step_index: index,
        step_order: index,
        depends_on: index > 0 ? [index - 1] : [],
      }),
    );

    return { definition, run, steps };
  }

  /**
   * Create a conversation with associated task and deliverable
   */
  static createConversationWithDeliverable(overrides?: {
    conversationOverrides?: Partial<Conversation>;
    deliverableOverrides?: Partial<Deliverable>;
  }) {
    const conversation = MockFactories.createConversation(
      overrides?.conversationOverrides,
    );
    const task = MockFactories.createTask({
      conversation_id: conversation.id,
    });
    const deliverable = MockFactories.createDeliverable({
      conversation_id: conversation.id,
      task_id: task.id,
      ...overrides?.deliverableOverrides,
    });

    return { conversation, task, deliverable };
  }
}
