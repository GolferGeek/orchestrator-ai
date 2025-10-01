import { AgentApprovalsActionsController } from './agent-approvals-actions.controller';

describe('AgentApprovalsActionsController', () => {
  it('approves and continues using stored request, annotates response', async () => {
    const approvals = {
      get: jest.fn().mockResolvedValue({
        id: 'appr-1',
        organization_slug: 'global',
        agent_slug: 'demo_agent',
        conversation_id: 'conv-1',
        metadata: { request: { userMessage: 'Proceed?', payload: { foo: 'bar' } } },
      }),
      setStatus: jest.fn().mockResolvedValue({ id: 'appr-1', status: 'approved' }),
    } as any;

    const gateway = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        mode: 'build',
        payload: { content: { status: 'build_completed', output: 'ok' }, metadata: { streamId: 'stream-xyz' } },
      }),
    } as any;

    const controller = new AgentApprovalsActionsController(gateway, approvals);

    const req: any = { user: { id: 'user-1' } };
    const result = await controller.approveAndContinue('global', 'demo_agent', 'appr-1', req, { options: { stream: true }, metadata: { stream: true, streamId: 'client-sid' } });

    expect(approvals.get).toHaveBeenCalledWith('appr-1');
    expect(approvals.setStatus).toHaveBeenCalledWith('appr-1', 'approved', 'user-1');
    expect(gateway.execute).toHaveBeenCalledWith(
      'global',
      'demo_agent',
      expect.objectContaining({ mode: 'build', metadata: expect.objectContaining({ streamId: 'client-sid' }) })
    );
    expect(result.success).toBe(true);
    expect(result.payload?.metadata?.approvalId).toBe('appr-1');
    expect(result.payload?.metadata?.approvalStatus).toBe('approved');
  });
});
