import { AgentRuntimeDeliverablesAdapter } from './agent-runtime-deliverables.adapter';
import { AgentTaskMode } from '@agent2agent/dto/task-request.dto';

describe('AgentRuntimeDeliverablesAdapter', () => {
  it('creates a new version when deliverableId is provided', async () => {
    const deliverables = { create: jest.fn() } as any;
    const versions = { createVersion: jest.fn().mockResolvedValue({ id: 'v2' }) } as any;
    const adapter = new AgentRuntimeDeliverablesAdapter(deliverables, versions);

    const ctx = {
      organizationSlug: null,
      agentSlug: 'demo-agent',
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      content: 'Hello',
    };
    const request: any = {
      payload: { deliverableId: 'deliv-1' },
      metadata: { userId: 'user-1' },
      taskId: 'task-1',
    };

    const result = await adapter.maybeCreateFromBuild(ctx, request);
    expect(result).toBeNull();
    expect(versions.createVersion).toHaveBeenCalledWith(
      'deliv-1',
      expect.objectContaining({ content: 'Hello', taskId: 'task-1' }),
      'user-1',
    );
    expect(deliverables.create).not.toHaveBeenCalled();
  });

  it('applies title template tokens when creating a new deliverable', async () => {
    const deliverables = { create: jest.fn().mockResolvedValue({ id: 'd1' }) } as any;
    const versions = { createVersion: jest.fn() } as any;
    const adapter = new AgentRuntimeDeliverablesAdapter(deliverables, versions);

    const ctx = {
      organizationSlug: 'org1',
      agentSlug: 'demo-agent',
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      content: 'Hello',
      titleTemplate: 'Report by {agent} on {date}',
    };
    const request: any = {
      payload: {},
      metadata: { userId: 'user-1' },
      taskId: 'task-1',
    };

    await adapter.maybeCreateFromBuild(ctx, request);
    const call = deliverables.create.mock.calls[0][0];
    expect(call.title).toContain('Report by demo-agent on ');
    expect(call.initialContent).toBe('Hello');
  });
});

