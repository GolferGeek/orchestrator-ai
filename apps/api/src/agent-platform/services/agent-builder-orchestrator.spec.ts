import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AgentDryRunService } from './agent-dry-run.service';

interface AgentBuilderResult {
  content?: string | { success?: boolean; agentId?: string };
  needsInput?: boolean;
  state?: {
    step?: string;
    agentConfig?: {
      agent_type?: string;
      slug?: string;
      yaml?: string;
      display_name?: string;
      context?: {
        system?: string;
        [key: string]: unknown;
      };
      config?: {
        configuration?: {
          function?: {
            timeout_ms?: number;
            code?: string;
            [key: string]: unknown;
          };
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    validationResults?: unknown;
  };
  format?: string;
  action?: string;
}

interface DryRunResult {
  ok: boolean;
  result?: AgentBuilderResult;
  error?: string;
  logs?: string[];
}

describe('Agent Builder Orchestrator (Full Flow)', () => {
  const dry = new AgentDryRunService();
  const root = resolve(__dirname, '../../../../../');
  const builderPath = resolve(
    root,
    'docs/feature/matt/payloads/agent_builder_orchestrator.json',
  );
  const builder = JSON.parse(readFileSync(builderPath, 'utf8')) as {
    config?: {
      configuration?: {
        function?: {
          code?: string;
        };
      };
    };
  };
  const code = builder?.config?.configuration?.function?.code ?? '';

  describe('Step 1: Intent Collection', () => {
    it('should prompt for agent type and purpose when no data provided', async () => {
      const res = await dry.runFunction(code, { step: 'intent' }, 10000);
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.content).toContain('What type of agent');
      expect(result?.needsInput).toBe(true);
      expect(result?.state?.step).toBe('intent');
    });

    it('should collect intent and move to basic_info', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'intent',
          data: { agentType: 'function', purpose: 'Process documents' },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.state?.step).toBe('basic_info');
      expect(result?.state?.agentConfig?.agent_type).toBe('function');
      expect(result?.content).toContain('Organization slug');
    });
  });

  describe('Step 2: Basic Info', () => {
    it('should require slug and displayName', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'basic_info',
          conversationState: {
            step: 'basic_info',
            agentConfig: { agent_type: 'function' },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.content).toContain('required fields');
      expect(result?.needsInput).toBe(true);
    });

    it('should collect basic info and move to io_contract', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'basic_info',
          data: {
            slug: 'doc_processor',
            displayName: 'Document Processor',
            description: 'Processes PDF documents',
          },
          conversationState: {
            step: 'basic_info',
            agentConfig: { agent_type: 'function' },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.state?.step).toBe('io_contract');
      expect(result?.state?.agentConfig?.slug).toBe('doc_processor');
      expect(result?.content).toContain('IO Contract');
    });
  });

  describe('Step 3: IO Contract', () => {
    it('should require both input and output modes', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'io_contract',
          data: { inputModes: ['application/json'] },
          conversationState: {
            step: 'io_contract',
            agentConfig: { agent_type: 'function', slug: 'test_agent' },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.content).toContain('both inputModes and outputModes');
    });

    it('should collect IO contract and move to agent_config', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'io_contract',
          data: {
            inputModes: ['application/json'],
            outputModes: ['text/markdown'],
          },
          conversationState: {
            step: 'io_contract',
            agentConfig: { agent_type: 'function', slug: 'test_agent' },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.state?.step).toBe('agent_config');
      expect(result?.state?.agentConfig?.yaml).toContain('input_modes');
      expect(result?.content).toContain('Function Configuration');
    });

    it('should show context prompt for context agents', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'io_contract',
          data: {
            inputModes: ['text/plain'],
            outputModes: ['text/markdown'],
          },
          conversationState: {
            step: 'io_contract',
            agentConfig: { agent_type: 'context', slug: 'test_context' },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.content).toContain('Context Configuration');
      expect(result?.content).toContain('system prompt');
    });
  });

  describe('Step 4: Agent Configuration', () => {
    it('should require code and timeout for function agents', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'agent_config',
          data: { code: 'test' },
          conversationState: {
            step: 'agent_config',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              yaml: 'input_modes: ["application/json"]',
            },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.content).toContain('both code and timeoutMs');
    });

    it('should collect function config and move to validate', async () => {
      const res = await dry.runFunction(
        code,
        {
          step: 'agent_config',
          data: {
            code: 'module.exports = async (input) => ({ ok: true });',
            timeoutMs: 5000,
          },
          conversationState: {
            step: 'agent_config',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              yaml: 'input_modes: ["application/json"]',
            },
          },
        },
        10000,
      );
      const result = res.result as AgentBuilderResult;

      expect(res.ok).toBe(true);
      expect(result?.state?.step).toBe('validate');
      expect(
        result?.state?.agentConfig?.config?.configuration?.function?.timeout_ms,
      ).toBe(5000);
      expect(result?.content).toContain('Validation');
    });

    it('should collect context config for context agents', async () => {
      const res = (await dry.runFunction(
        code,
        {
          step: 'agent_config',
          data: {
            systemPrompt: 'You are a helpful assistant',
          },
          conversationState: {
            step: 'agent_config',
            agentConfig: {
              agent_type: 'context',
              slug: 'test_context',
              yaml: 'input_modes: ["text/plain"]',
            },
          },
        },
        10000,
      )) as DryRunResult;

      expect(res.ok).toBe(true);
      expect(res.result?.state?.step).toBe('validate');
      expect(res.result?.state?.agentConfig?.context?.system).toBe(
        'You are a helpful assistant',
      );
    });
  });

  describe('Step 5: Validation', () => {
    it('should run validation and show results', async () => {
      const res = (await dry.runFunction(
        code,
        {
          step: 'validate',
          conversationState: {
            step: 'validate',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              display_name: 'Test Agent',
              config: {
                configuration: {
                  function: {
                    timeout_ms: 5000,
                    code: 'module.exports = async () => ({ ok: true });',
                  },
                },
              },
            },
          },
        },
        10000,
      )) as DryRunResult;

      expect(res.ok).toBe(true);
      expect(res.result?.state?.step).toBe('review');
      expect(res.result?.state?.validationResults).toBeDefined();
      expect(res.result?.content).toContain('Validation Results');
      expect(res.result?.content).toContain('✅');
    });
  });

  describe('Step 6: Review & Approval', () => {
    it('should require approval confirmation', async () => {
      const res = (await dry.runFunction(
        code,
        {
          step: 'review',
          data: { approved: false },
          conversationState: {
            step: 'review',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              display_name: 'Test Agent',
            },
            validationResults: { schemaValid: true, policyValid: true },
          },
        },
        10000,
      )) as DryRunResult;

      expect(res.ok).toBe(true);
      expect(res.result?.content).toContain('confirm approval');
    });

    it('should proceed to create when approved', async () => {
      const res = (await dry.runFunction(
        code,
        {
          step: 'review',
          data: { approved: true },
          conversationState: {
            step: 'review',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              display_name: 'Test Agent',
            },
            validationResults: { schemaValid: true, policyValid: true },
          },
        },
        10000,
      )) as DryRunResult;

      expect(res.ok).toBe(true);
      expect(res.result?.state?.step).toBe('create');
      expect(res.result?.action).toBe('create');
    });
  });

  describe('Step 7: Create', () => {
    it('should create agent and return success', async () => {
      const res = (await dry.runFunction(
        code,
        {
          step: 'create',
          conversationState: {
            step: 'create',
            agentConfig: {
              agent_type: 'function',
              slug: 'test_agent',
              display_name: 'Test Agent',
              config: {
                configuration: {
                  function: {
                    timeout_ms: 5000,
                    code: 'module.exports = async () => ({ ok: true });',
                  },
                },
              },
            },
          },
        },
        10000,
      )) as DryRunResult;

      expect(res.ok).toBe(true);
      expect(res.result?.format).toBe('application/json');
      expect(res.result?.state?.step).toBe('complete');
    });
  });

  describe('Full Flow Integration', () => {
    it('should complete entire flow from intent to creation', async () => {
      // Step 1: Intent
      let res = (await dry.runFunction(
        code,
        { step: 'intent', data: { agentType: 'function', purpose: 'Test' } },
        10000,
      )) as DryRunResult;
      expect(res.result?.state?.step).toBe('basic_info');
      let state: AgentBuilderResult['state'] = (
        res.result as AgentBuilderResult
      )?.state;

      // Step 2: Basic Info
      res = (await dry.runFunction(
        code,
        {
          step: 'basic_info',
          data: { slug: 'test_flow', displayName: 'Test Flow Agent' },
          conversationState: state as Record<string, unknown>,
        },
        10000,
      )) as DryRunResult;
      expect(res.result?.state?.step).toBe('io_contract');
      state = res.result?.state;

      // Step 3: IO Contract
      res = await dry.runFunction(
        code,
        {
          step: 'io_contract',
          data: {
            inputModes: ['application/json'],
            outputModes: ['text/markdown'],
          },
          conversationState: state as Record<string, unknown>,
        },
        10000,
      );
      expect(res.result?.state?.step).toBe('agent_config');
      state = res.result?.state;

      // Step 4: Agent Config
      res = await dry.runFunction(
        code,
        {
          step: 'agent_config',
          data: {
            code: 'module.exports = async () => ({ ok: true });',
            timeoutMs: 5000,
          },
          conversationState: state as Record<string, unknown>,
        },
        10000,
      );
      expect(res.result?.state?.step).toBe('validate');
      state = res.result?.state;

      // Step 5: Validate
      res = await dry.runFunction(
        code,
        {
          step: 'validate',
          conversationState: state as Record<string, unknown>,
        },
        10000,
      );
      expect(res.result?.state?.step).toBe('review');
      state = res.result?.state;

      // Step 6: Review
      res = await dry.runFunction(
        code,
        {
          step: 'review',
          data: { approved: true },
          conversationState: state as Record<string, unknown>,
        },
        10000,
      );
      expect(res.result?.state?.step).toBe('create');
      state = res.result?.state;

      // Step 7: Create
      res = await dry.runFunction(
        code,
        { step: 'create', conversationState: state as Record<string, unknown> },
        10000,
      );
      expect(res.result?.state?.step).toBe('complete');
      expect(res.result?.content?.success).toBe(true);
      expect(res.result?.content?.agentId).toBeDefined();
    });
  });
});
