import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerRegistryService } from './agent-runner-registry.service';
import { IAgentRunner } from '../interfaces/agent-runner.interface';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentTaskMode } from '../dto/task-request.dto';

// Mock runner for testing
class MockAgentRunner implements IAgentRunner {
  constructor(private readonly name: string) {}

  async execute(): Promise<TaskResponseDto> {
    return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      content: { message: `Response from ${this.name}` },
      metadata: {},
    });
  }
}

describe('AgentRunnerRegistryService', () => {
  let service: AgentRunnerRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRunnerRegistryService],
    }).compile();

    service = module.get<AgentRunnerRegistryService>(
      AgentRunnerRegistryService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerRunner', () => {
    it('should register a runner for an agent type', () => {
      const mockRunner = new MockAgentRunner('context');

      service.registerRunner('context', mockRunner);

      expect(service.hasRunner('context')).toBe(true);
      expect(service.getRunner('context')).toBe(mockRunner);
    });

    it('should allow overwriting an existing runner', () => {
      const mockRunner1 = new MockAgentRunner('context-v1');
      const mockRunner2 = new MockAgentRunner('context-v2');

      service.registerRunner('context', mockRunner1);
      service.registerRunner('context', mockRunner2);

      const runner = service.getRunner('context');
      expect(runner).toBe(mockRunner2);
    });

    it('should register multiple runners for different types', () => {
      const contextRunner = new MockAgentRunner('context');
      const toolRunner = new MockAgentRunner('tool');
      const apiRunner = new MockAgentRunner('api');

      service.registerRunner('context', contextRunner);
      service.registerRunner('tool', toolRunner);
      service.registerRunner('api', apiRunner);

      expect(service.getRunnerCount()).toBe(3);
      expect(service.getRunner('context')).toBe(contextRunner);
      expect(service.getRunner('tool')).toBe(toolRunner);
      expect(service.getRunner('api')).toBe(apiRunner);
    });
  });

  describe('getRunner', () => {
    it('should return the runner for a registered type', () => {
      const mockRunner = new MockAgentRunner('context');
      service.registerRunner('context', mockRunner);

      const runner = service.getRunner('context');

      expect(runner).toBe(mockRunner);
    });

    it('should return null for an unregistered type', () => {
      const runner = service.getRunner('unknown-type');

      expect(runner).toBeNull();
    });
  });

  describe('hasRunner', () => {
    it('should return true for a registered type', () => {
      const mockRunner = new MockAgentRunner('context');
      service.registerRunner('context', mockRunner);

      expect(service.hasRunner('context')).toBe(true);
    });

    it('should return false for an unregistered type', () => {
      expect(service.hasRunner('unknown-type')).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return an empty array when no runners are registered', () => {
      const types = service.getRegisteredTypes();

      expect(types).toEqual([]);
    });

    it('should return all registered agent types', () => {
      service.registerRunner('context', new MockAgentRunner('context'));
      service.registerRunner('tool', new MockAgentRunner('tool'));
      service.registerRunner('api', new MockAgentRunner('api'));

      const types = service.getRegisteredTypes();

      expect(types).toContain('context');
      expect(types).toContain('tool');
      expect(types).toContain('api');
      expect(types.length).toBe(3);
    });
  });

  describe('getRunnerCount', () => {
    it('should return 0 when no runners are registered', () => {
      expect(service.getRunnerCount()).toBe(0);
    });

    it('should return the correct count of registered runners', () => {
      service.registerRunner('context', new MockAgentRunner('context'));
      expect(service.getRunnerCount()).toBe(1);

      service.registerRunner('tool', new MockAgentRunner('tool'));
      expect(service.getRunnerCount()).toBe(2);

      service.registerRunner('api', new MockAgentRunner('api'));
      expect(service.getRunnerCount()).toBe(3);
    });
  });
});
