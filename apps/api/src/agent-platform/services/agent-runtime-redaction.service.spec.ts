import { AgentRuntimeRedactionService } from './agent-runtime-redaction.service';
import { RedactionPatternsRepository } from '../repositories/redaction-patterns.repository';
import { AgentRuntimeDefinition } from '../interfaces/agent.interface';
import { TaskRequestDto } from '@agent2agent/dto/task-request.dto';

describe('AgentRuntimeRedactionService', () => {
  const makeService = (
    patterns: Array<{ pattern: string; flags?: string; replacement?: string }>,
  ) => {
    const repo = {
      listByOrganization: jest.fn().mockResolvedValue(
        patterns.map((p) => ({
          id: '1',
          organization_slug: 'demo',
          agent_slug: null,
          pattern: p.pattern,
          flags: p.flags ?? 'gi',
          replacement: p.replacement ?? '[REDACTED]',
        })),
      ),
    } as jest.Mocked<RedactionPatternsRepository>;
    return new AgentRuntimeRedactionService(repo);
  };

  const definition: AgentRuntimeDefinition = {
    id: 'a1',
    slug: 'agent',
    organizationSlug: 'demo',
    displayName: 'Agent',
    agentType: 'llm',
    modeProfile: 'converse_only',
    metadata: { tags: [] },
    capabilities: [],
    skills: [],
    communication: { inputModes: ['text'], outputModes: ['text'] },
    execution: {
      modeProfile: 'converse_only',
      canConverse: true,
      canPlan: false,
      canBuild: false,
      canOrchestrate: false,
      requiresHumanGate: false,
    },
    prompts: { system: '', plan: '', build: '', human: '' },
    context: null,
    config: { transforms: { redaction: { fields: [] } } },
    record: {},
  };

  it('applies DB regex only on remote (isLocal=false) and always applies secret masking', async () => {
    const service = makeService([{ pattern: 'secret', replacement: '[DB]' }]);
    const request: TaskRequestDto = {
      mode: 'converse',
      userMessage: 'my secret is ALPHA and key sk-ABCDEFGHIJKL',
      payload: {},
    };

    // Local route: DB redaction skipped, secret token masked
    const localRedacted = await service.redact(definition, request, {
      isLocal: true,
      organizationSlug: 'demo',
    });
    expect(localRedacted.userMessage).toContain('secret');
    expect(localRedacted.userMessage).toContain('sk-REDACTED');

    // Remote route: DB redaction applied, secret token masked
    const remoteRedacted = await service.redact(definition, request, {
      isLocal: false,
      organizationSlug: 'demo',
    });
    expect(remoteRedacted.userMessage).toContain('[DB]');
    expect(remoteRedacted.userMessage).not.toContain('secret');
    expect(remoteRedacted.userMessage).toContain('sk-REDACTED');
  });
});
