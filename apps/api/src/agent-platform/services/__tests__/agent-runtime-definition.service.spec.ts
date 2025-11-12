import { AgentRuntimeDefinitionService } from '../agent-runtime-definition.service';
import type { AgentRecord } from '../../interfaces/agent.interface';
import type { AgentConfigDefinition } from '../../interfaces/agent.interface';
import type { JsonObject } from '@orchestrator-ai/transport-types';

describe('AgentRuntimeDefinitionService', () => {
  const service = new AgentRuntimeDefinitionService();
  const now = new Date().toISOString();

  const createRecord = (overrides: Partial<AgentRecord> = {}): AgentRecord => ({
    id: 'agent-123',
    organization_slug: 'demo-org',
    slug: 'demo-agent',
    display_name: 'Demo Agent',
    description: 'Demo description',
    agent_type: 'specialist',
    mode_profile: 'autonomous_build',
    version: '1.0.0',
    status: 'active',
    yaml: '{}',
    function_code: null,
    agent_card: null,
    context: null,
    config: null,
    plan_structure: null,
    deliverable_structure: null,
    io_schema: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  it('builds runtime definition with guarded descriptor data', () => {
    const descriptor = {
      metadata: {
        displayName: 'Descriptor Name',
        description: 'Descriptor description',
        provider: 'openai',
        tags: ['descriptor', 'demo'],
      },
      hierarchy: {
        level: 'senior',
        reportsTo: 'orchestrator',
      },
      capabilities: ['plan', 'build'],
      skills: [
        {
          id: 'planning',
          name: 'Planning',
          tags: ['strategy'],
          metadata: {
            confidence: 0.9,
          },
        },
        null,
      ],
      configuration: {
        execution_capabilities: {
          can_plan: false,
          can_build: true,
        },
        timeout_seconds: 120,
      },
      api_configuration: {
        endpoint: 'https://example.com/api',
        method: 'post',
        timeout: 5000,
        headers: {
          'X-Test': 'value',
        },
        authentication: {
          type: 'bearer',
        },
        request_transform: {
          kind: 'template',
        },
        response_transform: {
          kind: 'json',
        },
      },
      prompts: {
        system: 'You are the descriptor system prompt.',
        plan: 'Descriptor plan prompt.',
      },
      context: {
        system_prompt: 'Descriptor context prompt.',
        nested: {
          fromDescriptor: true,
        },
      },
      schemas: {
        plan: {
          type: 'object',
          properties: {
            goal: { type: 'string' },
          },
        },
        deliverable: {
          type: 'object',
        },
        io: {
          type: 'object',
          additionalProperties: true,
        },
      },
    } satisfies JsonObject;

    const recordConfig: AgentConfigDefinition = {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-opus',
      },
      execution_capabilities: {
        can_plan: true,
        can_build: true,
      },
      execution_profile: 'autonomous_build',
    };

    const recordContext: JsonObject = {
      fromRecord: true,
      system_prompt: 'Record context prompt.',
    };

    const record = createRecord({
      yaml: JSON.stringify(descriptor),
      context: recordContext,
      config: recordConfig,
    });

    const definition = service.buildDefinition(record);

    expect(definition.metadata.displayName).toBe('Descriptor Name');
    expect(definition.metadata.tags).toEqual(['descriptor', 'demo']);
    expect(definition.hierarchy?.level).toBe('senior');
    expect(definition.skills).toHaveLength(1);
    expect(definition.skills[0]?.metadata).toEqual({ confidence: 0.9 });

    expect(definition.execution.canPlan).toBe(false);
    expect(definition.execution.timeoutSeconds).toBe(120);

    const transport = definition.transport;

    expect(transport).toBeDefined();
    if (!transport) {
      throw new Error('Expected transport definition to be present');
    }

    expect(transport.api?.endpoint).toBe('https://example.com/api');
    expect(transport.api?.headers).toEqual({ 'X-Test': 'value' });
    expect(transport.api?.authentication).toEqual({ type: 'bearer' });
    expect(transport.api?.requestTransform).toEqual({ kind: 'template' });

    expect(definition.context).toEqual({
      nested: { fromDescriptor: true },
      fromRecord: true,
      system_prompt: 'Record context prompt.',
    });

    expect(definition.prompts.system).toBe(
      'You are the descriptor system prompt.',
    );
    expect(definition.prompts.plan).toBe('Descriptor plan prompt.');

    expect(definition.planStructure).toEqual(descriptor.schemas.plan);
    expect(definition.deliverableStructure).toEqual(
      descriptor.schemas.deliverable,
    );
    expect(definition.ioSchema).toEqual(descriptor.schemas.io);
    expect(definition.rawDescriptor).toEqual(descriptor);
  });

  it('falls back to record configuration when descriptor shapes are unsafe', () => {
    const descriptor = {
      context: 'not-an-object',
      configuration: 'invalid',
      api_configuration: ['not', 'an', 'object'],
    } satisfies JsonObject;

    const recordPlan: JsonObject = {
      type: 'object',
      title: 'From Record',
    };

    const record = createRecord({
      yaml: JSON.stringify(descriptor),
      context: { fromRecordOnly: true } as JsonObject,
      config: {
        execution_capabilities: {
          can_plan: true,
          can_build: true,
        },
      } as AgentConfigDefinition,
      plan_structure: recordPlan,
    });

    const definition = service.buildDefinition(record);

    expect(definition.context).toEqual({ fromRecordOnly: true });
    expect(definition.config).toMatchObject({
      execution_capabilities: {
        can_plan: true,
        can_build: true,
      },
    });
    expect(definition.transport).toBeUndefined();
    expect(definition.planStructure).toEqual(recordPlan);
  });
});
