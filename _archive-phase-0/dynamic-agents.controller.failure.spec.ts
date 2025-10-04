import { DynamicAgentsController } from './dynamic-agents.controller';

describe('DynamicAgentsController - standardized failure payload', () => {
  function makeController() {
    const agentDiscovery: any = {};
    const appService: any = {};
    const tasksService: any = {
      createTask: jest.fn().mockResolvedValue({ id: 'task-1', agentConversationId: 'conv-1' }),
    };
    const agentConversationsService: any = {
      setPrimaryWorkProduct: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService: any = {
      failTask: jest.fn().mockResolvedValue(undefined),
    };
    const contextOptimizationService: any = {
      optimizeContext: jest.fn().mockRejectedValue(new Error('boom: sk-SECRET TOKEN')),
    };
    const centralizedRoutingService: any = {};
    const piiService: any = {
      checkPolicy: jest.fn().mockResolvedValue({ metadata: { showstopperDetected: false } }),
    };
    const speechService: any = {};
    const authService: any = {};
    const agentRegistry: any = {
      getAgent: jest.fn().mockResolvedValue(null),
      listAgents: jest.fn().mockResolvedValue([]),
    };
    const agentGateway: any = {};

    const controller = new DynamicAgentsController(
      agentDiscovery,
      appService,
      tasksService,
      agentConversationsService,
      taskStatusService,
      contextOptimizationService,
      centralizedRoutingService,
      piiService,
      speechService,
      authService,
      agentRegistry,
      agentGateway,
    ) as any;

    // Bypass internals to reach failure path deterministically
    controller.resolveNamespaceContext = jest.fn().mockResolvedValue({ activeNamespace: null });
    controller.findDatabaseAgentRecord = jest.fn().mockResolvedValue(null);
    controller.isBase64Audio = jest.fn().mockReturnValue(false);
    controller.findAgentInstance = jest.fn().mockReturnValue({ getAgentCard: jest.fn().mockResolvedValue({ timeout: 60 }) });

    return { controller, services: { tasksService, taskStatusService, contextOptimizationService } };
  }

  it('returns standardized failed payload with redacted message', async () => {
    const { controller, services } = makeController();
    const currentUser: any = { id: 'user-1' };
    const req: any = { headers: {}, activeNamespace: null };

    const result = await controller.handleTasks(
      'demo',
      'echo',
      { method: 'converse', prompt: 'hello' },
      currentUser,
      req,
    );

    expect(services.tasksService.createTask).toHaveBeenCalled();
    expect(services.taskStatusService.failTask).toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('agent_execution_error');
    // Ensure secret redacted
    expect(String(result.error?.message || '').toLowerCase()).not.toContain('sk-secret');
  });
});

