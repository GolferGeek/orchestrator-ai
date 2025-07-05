import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentDiscoveryService } from './agent-discovery.service';
import { AgentFactoryService } from './agent-factory.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import { LLMService } from './llms/llm.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockAgentDiscoveryService = {
      discoverAndInstantiateAgents: jest.fn().mockResolvedValue([]),
      getAgentInstances: jest.fn().mockReturnValue([]),
      getDiscoveredAgents: jest.fn().mockReturnValue([]),
    };

    const mockLLMService = {
      // Add any methods that might be called during AppService initialization
    };

    const mockAgentFactoryService = {
      createAgentInstance: jest.fn(),
    };

    const mockAgentPoolService = {
      getAgentPool: jest.fn().mockReturnValue([]),
      addAgent: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AgentDiscoveryService,
          useValue: mockAgentDiscoveryService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: AgentFactoryService,
          useValue: mockAgentFactoryService,
        },
        {
          provide: AgentPoolService,
          useValue: mockAgentPoolService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "NestJS A2A Agent Framework - Ready!"', () => {
      expect(appController.getHello()).toBe(
        'NestJS A2A Agent Framework - Ready!',
      );
    });
  });
});
