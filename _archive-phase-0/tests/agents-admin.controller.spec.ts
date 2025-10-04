import { Test, TestingModule } from '@nestjs/testing';
import { AgentsAdminController } from './agents-admin.controller';
import { SupabaseService } from '@/supabase/supabase.service';
import { AgentValidationService } from '../services/agent-validation.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentDryRunService } from '../services/agent-dry-run.service';
import { AgentPolicyService } from '../services/agent-policy.service';
import { AgentType, CreateAgentDto, UpdateAgentDto } from '../dto/agent-admin.dto';

describe('AgentsAdminController', () => {
  let controller: AgentsAdminController;
  let mockSupabaseService: jest.Mocked<Partial<SupabaseService>>;
  let mockValidator: jest.Mocked<Partial<AgentValidationService>>;
  let mockAgentsRepo: jest.Mocked<Partial<AgentsRepository>>;
  let mockDryRun: jest.Mocked<Partial<AgentDryRunService>>;
  let mockPolicy: jest.Mocked<Partial<AgentPolicyService>>;

  beforeEach(async () => {
    // Create mocks
    const mockServiceClient: any = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockServiceClient),
    };

    mockValidator = {
      validateByType: jest.fn().mockReturnValue({ ok: true, issues: [] }),
    };

    mockAgentsRepo = {
      upsert: jest.fn().mockResolvedValue({
        id: 'test-id',
        slug: 'test-agent',
        agent_type: 'function',
      }),
    };

    mockDryRun = {
      runFunction: jest.fn().mockResolvedValue({ ok: true, result: {} }),
      runApiTransform: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockPolicy = {
      check: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsAdminController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AgentValidationService, useValue: mockValidator },
        { provide: AgentsRepository, useValue: mockAgentsRepo },
        { provide: AgentDryRunService, useValue: mockDryRun },
        { provide: AgentPolicyService, useValue: mockPolicy },
      ],
    }).compile();

    controller = module.get<AgentsAdminController>(AgentsAdminController);
  });

  describe('upsert', () => {
    it('should create a new agent when validation passes', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test-agent',
        display_name: 'Test Agent',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: 'module.exports = async (input) => ({ ok: true });',
            },
          },
        },
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockValidator.validateByType).toHaveBeenCalledWith('function', dto);
      expect(mockPolicy.check).toHaveBeenCalledWith(dto);
      expect(mockAgentsRepo.upsert).toHaveBeenCalled();
    });

    it('should return issues when validation fails', async () => {
      mockValidator.validateByType = jest.fn().mockReturnValue({
        ok: false,
        issues: [{ message: 'Missing required field' }],
      });

      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'invalid-agent',
        display_name: 'Invalid Agent',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
      expect(mockAgentsRepo.upsert).not.toHaveBeenCalled();
    });

    it('should return issues when policy check fails', async () => {
      mockPolicy.check = jest.fn().mockReturnValue([
        { message: 'Missing input_modes', path: 'input_modes' },
      ]);

      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'policy-fail',
        display_name: 'Policy Fail',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.some((i) => i.message.includes('input_modes'))).toBe(true);
      expect(mockAgentsRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should validate agent without dry-run', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test-agent',
        display_name: 'Test Agent',
        agent_type: AgentType.CONTEXT,
        mode_profile: 'conversation_only',
        yaml: "input_modes: ['text/plain']\noutput_modes: ['text/markdown']\n",
        context: {
          system: 'You are helpful',
        },
      };

      const result = await controller.validate(dto);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.dryRun).toBeUndefined();
      expect(mockDryRun.runFunction).not.toHaveBeenCalled();
    });

    it('should perform dry-run for function agents when requested', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test-function',
        display_name: 'Test Function',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 2000,
              code: 'module.exports = async (input) => ({ ok: true, result: "test" });',
            },
          },
        },
      };

      const result = await controller.validate(dto, 'true');

      expect(result.success).toBe(true);
      expect(result.dryRun).toBeDefined();
      expect(result.dryRun.ok).toBe(true);
      expect(mockDryRun.runFunction).toHaveBeenCalled();
    });

    it('should perform dry-run for API agents when requested', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test-api',
        display_name: 'Test API',
        agent_type: AgentType.API,
        mode_profile: 'active',
        yaml: "input_modes: ['application/json']\noutput_modes: ['application/json']\n",
        config: {
          configuration: {
            api: {
              api_configuration: {
                endpoint: 'https://api.example.com',
                method: 'POST',
              },
              sample_input: { test: 'input' },
              sample_response: { test: 'output' },
            },
          },
        },
      };

      const result = await controller.validate(dto, 'true');

      expect(result.success).toBe(true);
      expect(result.dryRun).toBeDefined();
      expect(mockDryRun.runApiTransform).toHaveBeenCalled();
    });
  });

  describe('patch', () => {
    it('should update agent and re-validate', async () => {
      const existingAgent = {
        id: 'test-id',
        organization_slug: 'my-org',
        slug: 'existing-agent',
        display_name: 'Existing Agent',
        agent_type: 'function',
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: 'module.exports = async () => ({ ok: true });',
            },
          },
        },
        description: null,
        agent_card: null,
        context: null,
      };

      const mockServiceClient: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: existingAgent, error: null }),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...existingAgent, display_name: 'Updated Agent' }, error: null }),
      };

      mockSupabaseService.getServiceClient = jest.fn().mockReturnValue(mockServiceClient);

      const updateDto: UpdateAgentDto = {
        display_name: 'Updated Agent',
      };

      const result = await controller.patch('test-id', updateDto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockValidator.validateByType).toHaveBeenCalled();
      expect(mockPolicy.check).toHaveBeenCalled();
    });

    it('should fail validation if patched agent violates policy', async () => {
      const existingAgent = {
        id: 'test-id',
        organization_slug: 'my-org',
        slug: 'existing-agent',
        display_name: 'Existing Agent',
        agent_type: 'function',
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: 'module.exports = async () => ({ ok: true });',
            },
          },
        },
        description: null,
        agent_card: null,
        context: null,
      };

      const mockServiceClient: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: existingAgent, error: null }),
      };

      mockSupabaseService.getServiceClient = jest.fn().mockReturnValue(mockServiceClient);
      mockPolicy.check = jest.fn().mockReturnValue([
        { message: 'Timeout exceeds limit', path: 'config.configuration.function.timeout_ms' },
      ]);

      const updateDto: UpdateAgentDto = {
        config: {
          configuration: {
            function: {
              timeout_ms: 60000,
              code: 'module.exports = async () => ({ ok: true });',
            },
          },
        },
      };

      const result = await controller.patch('test-id', updateDto);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.some((i) => i.message.includes('Timeout'))).toBe(true);
    });
  });

  describe('list', () => {
    it('should list all agents', async () => {
      const mockData = [
        { id: '1', slug: 'agent1', agent_type: 'function' },
        { id: '2', slug: 'agent2', agent_type: 'context' },
      ];

      const mockServiceClient: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      // Mock the promise chain for the list query
      mockServiceClient.select.mockResolvedValue({ data: mockData, error: null });

      mockSupabaseService.getServiceClient = jest.fn().mockReturnValue(mockServiceClient);

      const result = await controller.list();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should filter agents by type', async () => {
      const mockData = [{ id: '1', slug: 'agent1', agent_type: 'function' }];

      const mockServiceClient: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockServiceClient.eq.mockResolvedValue({ data: mockData, error: null });

      mockSupabaseService.getServiceClient = jest.fn().mockReturnValue(mockServiceClient);

      const result = await controller.list('function');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockServiceClient.eq).toHaveBeenCalledWith('agent_type', 'function');
    });
  });
});
