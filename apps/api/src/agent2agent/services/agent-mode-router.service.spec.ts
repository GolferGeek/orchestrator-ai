import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';

describe('AgentModeRouterService', () => {
  const service = new AgentModeRouterService();
  const baseContext = {
    agent: { slug: 'agent-1', mode_profile: 'full_cycle' },
    routingMetadata: { route: 'default' },
  } as any;

  it('handles converse mode', async () => {
    const dto: TaskRequestDto = {
      mode: AgentTaskMode.CONVERSE,
      conversationId: 'conv-1',
      payload: {},
      userMessage: 'hello',
    } as any;

    const result = await service.execute({ ...baseContext, request: dto });
    expect(result.success).toBe(true);
    expect(result.mode).toBe(AgentTaskMode.CONVERSE);
  });

  it('handles plan mode', async () => {
    const dto: TaskRequestDto = {
      mode: AgentTaskMode.PLAN,
      conversationId: 'conv-1',
      payload: {},
    } as any;

    const result = await service.execute({ ...baseContext, request: dto });
    expect(result.mode).toBe(AgentTaskMode.PLAN);
  });

  it('handles build mode', async () => {
    const dto: TaskRequestDto = {
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      payload: {},
    } as any;

    const result = await service.execute({ ...baseContext, request: dto });
    expect(result.mode).toBe(AgentTaskMode.BUILD);
  });

  it('provides human response directly', async () => {
    const dto: TaskRequestDto = {
      mode: AgentTaskMode.HUMAN_RESPONSE,
      conversationId: 'conv-1',
    } as any;

    const result = await service.execute({ ...baseContext, request: dto });
    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(result.humanResponse?.message).toBeDefined();
  });
});
