import { Test, TestingModule } from '@nestjs/testing';
import { Agent2AgentController } from './agent2agent.controller';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { AgentTaskMode } from './dto/task-request.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TaskResponseDto } from './dto/task-response.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

describe('Agent2AgentController', () => {
  let controller: Agent2AgentController;
  const cardBuilder = {
    build: jest.fn(),
  } as unknown as jest.Mocked<AgentCardBuilderService>;
  const gateway = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<AgentExecutionGateway>;
  beforeEach(async () => {
    const guard = { canActivate: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [Agent2AgentController],
      providers: [
        { provide: AgentCardBuilderService, useValue: cardBuilder },
        { provide: AgentExecutionGateway, useValue: gateway },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(guard)
      .compile();

    controller = module.get(Agent2AgentController);
    jest.clearAllMocks();
  });

  it('returns agent card', async () => {
    cardBuilder.build.mockResolvedValue({ name: 'Card' });
    const _result = await controller.getAgentCard('my-org', 'agent');
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
      conversationId: 'ddeb27fb-d9a0-4624-be4d-4615062daed4',
    } as any;

    const _result = await controller.executeTask('my-org', 'agent', dto);

    expect(gateway.execute).toHaveBeenCalledWith('my-org', 'agent', dto);
    expect('jsonrpc' in (result as any)).toBe(false);
    expect((result as TaskResponseDto).success).toBe(true);
  });

  it('normalizes JSON-RPC payloads and maps method to mode', async () => {
    const jsonRpcPayload = {
      jsonrpc: '2.0',
      method: 'converse',
      id: 'abc-123',
      params: {
        conversationId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
        userMessage: 'hello',
      },
    };

    gateway.execute.mockResolvedValue({
      success: true,
      mode: AgentTaskMode.CONVERSE,
    } as any);

    const _response = await controller.executeTask(
      'global',
      'agent',
      jsonRpcPayload as any,
    );

    expect(gateway.execute).toHaveBeenCalledWith(
      null,
      'agent',
      expect.objectContaining({
        mode: AgentTaskMode.CONVERSE,
        metadata: expect.objectContaining({
          jsonrpc: { id: 'abc-123', method: 'converse' },
        }),
      }),
    );

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'abc-123',
      result: expect.objectContaining({ success: true }),
    });
  });

  it('rejects payloads missing mode information', async () => {
    await expect(
      controller.executeTask('global', 'agent', {
        conversationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.execute).not.toHaveBeenCalled();
  });

  it('returns JSON-RPC error envelope when gateway throws', async () => {
    gateway.execute.mockRejectedValue(
      new UnauthorizedException('Missing API key'),
    );

    const jsonRpcPayload = {
      jsonrpc: '2.0',
      method: 'converse',
      id: 'abc-123',
      params: {
        conversationId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
      },
    };

    const _response = await controller.executeTask(
      'global',
      'agent',
      jsonRpcPayload as any,
    );

    expect(response).toEqual(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 'abc-123',
        error: expect.objectContaining({
          code: -32001,
          message: 'Missing API key',
          data: expect.objectContaining({ statusCode: 401 }),
        }),
      }),
    );
  });

  it('rethrows errors for non JSON-RPC requests', async () => {
    gateway.execute.mockRejectedValue(new BadRequestException('bad request'));
    const dto = {
      mode: AgentTaskMode.CONVERSE,
      conversationId: 'ddeb27fb-d9a0-4624-be4d-4615062daed4',
    } as any;

    await expect(
      controller.executeTask('my-org', 'agent', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
