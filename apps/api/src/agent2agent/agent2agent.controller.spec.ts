import { Test, TestingModule } from '@nestjs/testing';
import { Agent2AgentController } from './agent2agent.controller';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { AgentTaskMode } from './dto/task-request.dto';

describe('Agent2AgentController', () => {
  let controller: Agent2AgentController;
  const cardBuilder = {
    build: jest.fn(),
  } as unknown as jest.Mocked<AgentCardBuilderService>;
  const gateway = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<AgentExecutionGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Agent2AgentController],
      providers: [
        { provide: AgentCardBuilderService, useValue: cardBuilder },
        { provide: AgentExecutionGateway, useValue: gateway },
      ],
    }).compile();

    controller = module.get(Agent2AgentController);
    jest.clearAllMocks();
  });

  it('returns agent card', async () => {
    cardBuilder.build.mockResolvedValue({ name: 'Card' });
    const result = await controller.getAgentCard('my-org', 'agent');
    expect(cardBuilder.build).toHaveBeenCalledWith('my-org', 'agent');
    expect(result).toEqual({ name: 'Card' });
  });

  it('executes task via gateway', async () => {
    gateway.execute.mockResolvedValue({
      success: true,
      mode: AgentTaskMode.CONVERSE,
    } as any);
    const dto = {
      mode: AgentTaskMode.CONVERSE,
      conversationId: 'conv-1',
    } as any;

    const result = await controller.executeTask('my-org', 'agent', dto);
    expect(gateway.execute).toHaveBeenCalledWith('my-org', 'agent', dto);
    expect(result.success).toBe(true);
  });
});
