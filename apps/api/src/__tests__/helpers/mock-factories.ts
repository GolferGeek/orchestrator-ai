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
  mode_profile: string;
  version: string;
  status: string;
  yaml: string;
  agent_card: Record<string, any>;
  context: Record<string, any>;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationDefinition {
  id: string;
  organization_slug: string;
  slug: string;
  display_name: string;
  description: string;
  owner_agent_slug: string;
  version: string;
  status: string;
  definition: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationRun {
  id: string;
  organization_slug: string;
  orchestration_definition_id: string;
  orchestration_slug: string;
  conversation_id: string;
  task_id: string;
  status:
    | 'planning'
    | 'running'
    | 'checkpoint'
    | 'completed'
    | 'failed'
    | 'aborted';
  parameters: Record<string, any>;
  parent_run_id: string | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationStep {
  id: string;
  orchestration_run_id: string;
  step_index: number;
  agent_slug: string;
  conversation_id: string;
  task_id: string | null;
  deliverable_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  depends_on: number[];
  checkpoint_after: boolean;
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_slug: string;
  user_id: string;
  agent_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  conversation_id: string;
  task_id: string;
  content: string;
  content_type: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  conversation_id: string;
  user_message: string;
  status: string;
  created_at: string;
  updated_at: string;
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
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      slug: `test-agent-${Date.now()}`,
      display_name: 'Test Agent',
      description: 'A test agent for automated testing',
      agent_type: 'context',
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
      config: { capabilities: [] },
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
      agent_type: 'context',
      mode_profile: 'context_full',
      slug: `context-agent-${Date.now()}`,
      display_name: 'Context Agent',
      context: {
        prompt_prefix: 'You analyze and summarize information',
      },
      config: {
        supported_modes: ['converse', 'build'],
        streaming: { enabled: true },
      },
      ...overrides,
    });
  }

  /**
   * Create an API agent (external service calls)
   */
  static createApiAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      agent_type: 'api',
      mode_profile: 'api_full',
      slug: `api-agent-${Date.now()}`,
      display_name: 'API Agent',
      config: {
        api: {
          endpoint: 'http://localhost:8055/test',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        supported_modes: ['build'],
      },
      ...overrides,
    });
  }

  /**
   * Create a tool agent (MCP tools)
   */
  static createToolAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      agent_type: 'tool',
      mode_profile: 'tool_full',
      slug: `tool-agent-${Date.now()}`,
      display_name: 'Tool Agent',
      config: {
        mcp: {
          server: 'sandbox',
          tools: ['noop'],
        },
        supported_modes: ['converse', 'build'],
      },
      ...overrides,
    });
  }

  /**
   * Create a function agent (custom code execution)
   */
  static createFunctionAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      agent_type: 'function',
      mode_profile: 'function_full',
      slug: `function-agent-${Date.now()}`,
      display_name: 'Function Agent',
      config: {
        function: {
          code: 'module.exports = async (input) => ({ result: input });',
        },
        supported_modes: ['build'],
      },
      ...overrides,
    });
  }

  /**
   * Create an orchestrator agent (coordinates other agents)
   */
  static createOrchestratorAgent(overrides: Partial<Agent> = {}): Agent {
    return MockFactories.createAgent({
      agent_type: 'orchestrator',
      mode_profile: 'orchestrator_full',
      slug: `orchestrator-agent-${Date.now()}`,
      display_name: 'Orchestrator Agent',
      config: {
        orchestrations: ['kpi-tracking'],
        supported_modes: ['converse', 'plan', 'build'],
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
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      slug: `test-orchestration-${Date.now()}`,
      display_name: 'Test Orchestration',
      description: 'A test orchestration for automated testing',
      owner_agent_slug: 'test-orchestrator',
      version: '1.0.0',
      status: 'active',
      definition: {
        steps: [
          {
            agent_slug: 'step-1-agent',
            depends_on: [],
            checkpoint_after: false,
          },
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
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      orchestration_definition_id: uuidv4(),
      orchestration_slug: `test-orchestration-${Date.now()}`,
      conversation_id: uuidv4(),
      task_id: uuidv4(),
      status: 'planning',
      parameters: {},
      parent_run_id: null,
      started_at: timestamp,
      completed_at: null,
      error: null,
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
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      orchestration_run_id: uuidv4(),
      step_index: 0,
      agent_slug: `test-agent-${Date.now()}`,
      conversation_id: uuidv4(),
      task_id: null,
      deliverable_id: null,
      status: 'pending',
      depends_on: [],
      checkpoint_after: false,
      attempt: 1,
      started_at: null,
      completed_at: null,
      error: null,
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
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      organization_slug: 'test-org',
      user_id: uuidv4(),
      agent_id: uuidv4(),
      title: 'Test Conversation',
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create a deliverable
   */
  static createDeliverable(overrides: Partial<Deliverable> = {}): Deliverable {
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      conversation_id: uuidv4(),
      task_id: uuidv4(),
      content: 'Test deliverable content',
      content_type: 'text/markdown',
      version: 1,
      status: 'completed',
      created_at: timestamp,
      updated_at: timestamp,
      ...overrides,
    };
  }

  /**
   * Create a task
   */
  static createTask(overrides: Partial<Task> = {}): Task {
    const timestamp = new Date().toISOString();
    return {
      id: uuidv4(),
      conversation_id: uuidv4(),
      user_message: 'Test task message',
      status: 'pending',
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
  static createOrchestrationScenario(stepCount: number = 2) {
    const definition = MockFactories.createOrchestrationDefinition();
    const run = MockFactories.createOrchestrationRun({
      orchestration_definition_id: definition.id,
      orchestration_slug: definition.slug,
    });
    const steps = Array.from({ length: stepCount }, (_, index) =>
      MockFactories.createOrchestrationStep({
        orchestration_run_id: run.id,
        step_index: index,
        depends_on: index > 0 ? [index - 1] : [],
      }),
    );

    return { definition, run, steps };
  }

  /**
   * Create a conversation with associated task and deliverable
   */
  static createConversationWithDeliverable() {
    const conversation = MockFactories.createConversation();
    const task = MockFactories.createTask({
      conversation_id: conversation.id,
    });
    const deliverable = MockFactories.createDeliverable({
      conversation_id: conversation.id,
      task_id: task.id,
    });

    return { conversation, task, deliverable };
  }
}
