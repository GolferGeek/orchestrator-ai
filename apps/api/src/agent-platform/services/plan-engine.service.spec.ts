import { PlanEngineService } from './plan-engine.service';
import { ConversationPlansRepository } from '../repositories/conversation-plans.repository';

describe('PlanEngineService', () => {
  const repo = {
    createDraft: jest.fn(),
    updateStatus: jest.fn(),
    getById: jest.fn(),
    listByConversation: jest.fn(),
  } as unknown as jest.Mocked<ConversationPlansRepository>;

  const service = new PlanEngineService(repo);

  afterEach(() => jest.resetAllMocks());

  it('creates plan draft', async () => {
    repo.createDraft.mockResolvedValue({ id: 'plan-1' } as any);

    const result = await service.generateDraft({
      conversationId: 'conv-1',
      organizationSlug: 'my-org',
      agentSlug: 'agent-1',
      draftPlan: { phases: [] },
    });

    expect(repo.createDraft).toHaveBeenCalled();
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
