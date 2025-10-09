import { Test, TestingModule } from '@nestjs/testing';
import { RequirementsWriterService } from './agent-service';
import { FunctionAgentServicesContextModule } from '@agents/base/services/function-agent-services-context.module';

describe('RequirementsWriterService', () => {
  let service: RequirementsWriterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [FunctionAgentServicesContextModule],
      providers: [RequirementsWriterService],
    }).compile();

    service = module.get<RequirementsWriterService>(RequirementsWriterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('agent metadata', () => {
    it('should return correct agent name', () => {
      expect(service['getAgentName']()).toBe('requirements_writer');
    });

    it('should return correct agent type', () => {
      expect(service['getAgentType']()).toBe('engineering');
    });
  });

  describe('inheritance', () => {
    it('should expose function-agent capabilities', () => {
      expect(typeof (service as any).setAgentFunction).toBe('function');
      expect(typeof (service as any).executeTask).toBe('function');
    });
  });

  describe('service configuration', () => {
    it('should be injectable and properly configured', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RequirementsWriterService);
    });

    it('should have access to required dependencies', () => {
      // Verify that all required dependencies are available through the service container
      expect(service['services'].llmService).toBeDefined();
      expect(service['services'].httpService).toBeDefined();
      expect(service['services'].taskProgressGateway).toBeDefined();
      expect(service['services'].tasksService).toBeDefined();
      expect(service['services'].taskStatusService).toBeDefined();
      expect(service['services'].deliverablesService).toBeDefined();
    });

    it('should configure workflow steps for progress tracking', () => {
      expect((service as any).totalSteps).toBe(6);
    });
  });
});
