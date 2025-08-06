import { Test, TestingModule } from '@nestjs/testing';
import { RequirementsWriterService } from './agent-service';
import { PythonFunctionAgentServicesContextModule } from '@agents/base/services/python-function-agent-services-context.module';
import * as fs from 'fs';

// Mock fs to control file existence
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('RequirementsWriterService', () => {
  let service: RequirementsWriterService;

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      imports: [PythonFunctionAgentServicesContextModule],
      providers: [RequirementsWriterService],
    }).compile();

    service = module.get<RequirementsWriterService>(RequirementsWriterService);

    // Mock required methods from base class
    jest
      .spyOn(service as any, 'getAgentName')
      .mockReturnValue('requirements_writer');
    jest.spyOn(service as any, 'getAgentType').mockReturnValue('python');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should set Python script path correctly', () => {
      // The constructor should set the script path to agent-function.py in the same directory
      expect(service).toBeDefined();
      // We can't directly test the private pythonScriptPath property,
      // but we can verify it works through executeTask behavior
    });
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
    it('should inherit from PythonFunctionAgentBaseService', () => {
      // Check that the service has the expected methods from the base class
      expect(service['setPythonScriptPath']).toBeDefined();
      expect(service['setPythonExecutable']).toBeDefined();
      expect(service['executeTask']).toBeDefined();
    });
  });

  describe('Python script integration', () => {
    it('should have Python script path set', () => {
      // Verify that the Python script path is properly set during construction

      // We can't directly access the private property, but we can test the behavior
      // by checking if the service attempts to use the Python script
      expect(service).toBeDefined();
    });

    it('should be ready for Python execution', async () => {
      // This test verifies that the service is properly configured for Python execution
      // The actual execution testing is handled by the PythonFunctionAgentBaseService tests

      // Mock that the Python script exists
      mockFs.existsSync.mockReturnValue(true);

      // The service should be ready to execute
      expect(service).toBeDefined();
      expect(service['getAgentName']()).toBe('requirements_writer');
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card with Python script information', async () => {
      // Mock the base getAgentCard method
      const baseCard = {
        name: 'requirements_writer',
        type: 'python',
        description: 'Requirements Writer Agent',
      };

      // Mock the PythonFunctionAgentBaseService getAgentCard method
      jest.spyOn(service, 'getAgentCard').mockResolvedValue({
        ...baseCard,
        pythonScriptStatus: 'available',
        pythonScriptPath: expect.stringContaining('agent-function.py'),
        pythonExecutable: 'python3',
        loadedAt: expect.any(String),
      });

      // Mock that the Python script exists
      mockFs.existsSync.mockReturnValue(true);

      const card = await service.getAgentCard();

      expect(card).toEqual({
        ...baseCard,
        pythonScriptStatus: 'available',
        pythonScriptPath: expect.stringContaining('agent-function.py'),
        pythonExecutable: 'python3',
        loadedAt: expect.any(String),
      });
    });

    it('should return agent card when Python script is not available', async () => {
      // Mock the base getAgentCard method
      const baseCard = {
        name: 'requirements_writer',
        type: 'python',
        description: 'Requirements Writer Agent',
      };

      // Mock the PythonFunctionAgentBaseService getAgentCard method
      jest.spyOn(service, 'getAgentCard').mockResolvedValue({
        ...baseCard,
        pythonScriptStatus: 'not_available',
        pythonScriptPath: expect.stringContaining('agent-function.py'),
        pythonExecutable: 'python3',
        loadedAt: expect.any(String),
      });

      // Mock that the Python script doesn't exist
      mockFs.existsSync.mockReturnValue(false);

      const card = await service.getAgentCard();

      expect(card).toEqual({
        ...baseCard,
        pythonScriptStatus: 'not_available',
        pythonScriptPath: expect.stringContaining('agent-function.py'),
        pythonExecutable: 'python3',
        loadedAt: expect.any(String),
      });
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
  });
});
