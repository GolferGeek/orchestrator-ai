import { PlanEngineService } from './plan-engine.service';
import { ConversationPlansRepository } from '../repositories/conversation-plans.repository';
import { AgentRuntimeExecutionService } from './agent-runtime-execution.service';

describe('PlanEngineService', () => {
  const repo = {
    createDraft: jest.fn(),
    updateStatus: jest.fn(),
    getById: jest.fn(),
    listByConversation: jest.fn(),
  } as unknown as jest.Mocked<ConversationPlansRepository>;

  const runtimeExecution = new AgentRuntimeExecutionService();
  const service = new PlanEngineService(repo, runtimeExecution);

  afterEach(() => jest.resetAllMocks());

  it('creates plan draft', async () => {
    repo.createDraft.mockResolvedValue({ id: 'plan-1' } as any);

    const result = await service.generateDraft({
      conversationId: 'conv-1',
      organizationSlug: 'my-org',
      agentSlug: 'agent-1',
      agentMetadata: {
        id: 'agent-123',
        slug: 'agent-1',
        displayName: 'Agent One',
        type: 'specialist',
        organizationSlug: 'my-org',
      },
      draftPlan: { phases: [] },
    });

    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_json: expect.objectContaining({
          _meta: {
            agent: {
              id: 'agent-123',
              displayName: 'Agent One',
              slug: 'agent-1',
              agentType: 'specialist',
              organizationSlug: 'my-org',
            },
          },
        }),
      }),
    );
    expect(result.id).toBe('plan-1');
  });

  it('updates plan status', async () => {
    repo.updateStatus.mockResolvedValue({
      id: 'plan-1',
      status: 'approved',
    } as any);

    const result = await service.updateStatus({
      planId: 'plan-1',
      status: 'approved',
    });

    expect(repo.updateStatus).toHaveBeenCalled();
    expect(result.status).toBe('approved');
  });
});
