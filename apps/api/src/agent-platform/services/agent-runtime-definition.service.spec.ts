import { AgentRuntimeDefinitionService } from './agent-runtime-definition.service';
import { AgentRecord } from '../interfaces/agent-record.interface';

const sampleYaml = `
metadata:
  name: "Rules of Golf Expert"
  displayName: "Golf Rules Agent"
  category: "golf"
  version: "1.0.0"
  description: "Expert on official golf rules."
  tags: ["golf", "rules"]
hierarchy:
  level: specialist
  reportsTo: specialists_manager_orchestrator
  department: specialists
capabilities:
  - golf_rules_expertise
  - penalty_assessment
skills:
  - id: rules
    name: "Rules Interpretation"
    description: "Interpret golf rules"
    tags: ["rules"]
    examples: ["My ball is in water"]
    input_modes: ["text/plain"]
    output_modes: ["text/plain"]
input_modes: ["text/plain"]
output_modes: ["text/plain"]
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.4
  max_tokens: 1500
  system_prompt: "You are a golf rules expert."
api_configuration:
  endpoint: "https://example.com/rules"
  method: POST
  timeout: 30000
  headers:
    Content-Type: application/json
configuration:
  execution_profile: conversation_only
  execution_capabilities:
    can_plan: false
    can_build: false
    requires_human_gate: false
  timeout_seconds: 45
`;

const baseRecord: AgentRecord = {
  id: 'agent-123',
  organization_slug: 'demo',
  slug: 'golf_rules_agent',
  display_name: 'Golf Rules Agent',
  description: 'Expert on golf rules.',
  agent_type: 'api',
  mode_profile: 'conversation_only',
  version: '1.0.0',
  status: 'active',
  yaml: sampleYaml,
  agent_card: null,
  context: { system_prompt: 'You are a golf rules expert.' },
  config: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('AgentRuntimeDefinitionService', () => {
  let service: AgentRuntimeDefinitionService;

  beforeEach(() => {
    service = new AgentRuntimeDefinitionService();
  });

  it('builds runtime definition from YAML descriptor', () => {
    const definition = service.buildDefinition(baseRecord);

    expect(definition.slug).toBe('golf_rules_agent');
    expect(definition.metadata.displayName).toBe('Golf Rules Agent');
    expect(definition.metadata.tags).toEqual(['golf', 'rules']);
    expect(definition.capabilities).toEqual([
      'golf_rules_expertise',
      'penalty_assessment',
    ]);
    expect(definition.skills).toHaveLength(1);
    expect(definition.skills[0]?.name).toBe('Rules Interpretation');
    expect(definition.communication.inputModes).toEqual(['text/plain']);
    expect(definition.llm?.provider).toBe('anthropic');
    expect(definition.prompts.system).toContain('golf rules expert');
    expect(definition.transport?.kind).toBe('api');
    expect(definition.transport?.api?.endpoint).toBe(
      'https://example.com/rules',
    );
    expect(definition.execution.canPlan).toBe(false);
    expect(definition.execution.canBuild).toBe(false);
    expect(definition.execution.requiresHumanGate).toBe(false);
    expect(definition.execution.timeoutSeconds).toBe(45);
  });

  it('merges record context and configuration when present', () => {
    const record: AgentRecord = {
      ...baseRecord,
      context: { system_prompt: 'Primary prompt', foo: 'bar' },
      config: { execution_profile: 'custom', nested: { enabled: true } },
    };

    const definition = service.buildDefinition(record);

    expect(definition.context).toMatchObject({
      system_prompt: 'Primary prompt',
      foo: 'bar',
    });
    expect(definition.config).toMatchObject({
      execution_profile: 'custom',
      nested: { enabled: true },
    });
  });

  it('handles missing yaml gracefully', () => {
    const record: AgentRecord = {
      ...baseRecord,
      yaml: '',
    };

    const definition = service.buildDefinition(record);

    expect(definition.metadata.displayName).toBe('Golf Rules Agent');
    expect(definition.capabilities).toEqual([]);
    expect(definition.transport).toBeUndefined();
  });
});
