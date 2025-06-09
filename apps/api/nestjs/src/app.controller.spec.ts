import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentDiscoveryService } from './agent-discovery.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockAgentDiscoveryService = {
      discoverAndInstantiateAgents: jest.fn().mockResolvedValue([]),
      getAgentInstances: jest.fn().mockReturnValue([]),
      getDiscoveredAgents: jest.fn().mockReturnValue([]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AgentDiscoveryService,
          useValue: mockAgentDiscoveryService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "NestJS A2A Agent Framework - Ready!"', () => {
      expect(appController.getHello()).toBe('NestJS A2A Agent Framework - Ready!');
    });
  });
});
