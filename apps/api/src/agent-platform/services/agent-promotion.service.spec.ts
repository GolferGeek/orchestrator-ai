import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AgentPromotionService } from './agent-promotion.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { AgentValidationService } from './agent-validation.service';
import { AgentPolicyService } from './agent-policy.service';

describe('AgentPromotionService', () => {
  let service: AgentPromotionService;
  let agentsRepo: jest.Mocked<AgentsRepository>;
  let approvalsRepo: jest.Mocked<HumanApprovalsRepository>;
  let validator: jest.Mocked<AgentValidationService>;

  beforeEach(async () => {
    const mockAgentsRepo = {
      getById: jest.fn(),
      updateStatus: jest.fn(),
    };

    const mockApprovalsRepo = {
      create: jest.fn(),
      get: jest.fn(),
      setStatus: jest.fn(),
    };

    const mockValidator = {
      validateByType: jest.fn().mockReturnValue({ ok: true, issues: [] }),
    };

    const mockPolicy = {
      check: jest.fn().mockReturnValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentPromotionService,
        { provide: AgentsRepository, useValue: mockAgentsRepo },
        { provide: HumanApprovalsRepository, useValue: mockApprovalsRepo },
        { provide: AgentValidationService, useValue: mockValidator },
        { provide: AgentPolicyService, useValue: mockPolicy },
      ],
    }).compile();

    service = moduleRef.get<AgentPromotionService>(AgentPromotionService);
    agentsRepo = moduleRef.get(AgentsRepository);
    approvalsRepo = moduleRef.get(HumanApprovalsRepository);
    validator = moduleRef.get(AgentValidationService);
  });

  describe('requestPromotion', () => {
    it('should auto-promote simple context agent without approval', async () => {
      const agent = {
        id: 'agent-1',
        slug: 'simple-context',
        agent_type: 'context',
        status: 'draft',
        organization_slug: 'my-org',
        display_name: 'Simple Context Agent',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      agentsRepo.updateStatus.mockResolvedValue({
        ...agent,
        status: 'active',
      } as never);

      const result = await service.requestPromotion('agent-1');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('active');
      expect(result.requiresApproval).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(agentsRepo.updateStatus).toHaveBeenCalledWith('agent-1', 'active');
    });

    it('should require approval for complex function agent', async () => {
      const agent = {
        id: 'agent-2',
        slug: 'complex-function',
        agent_type: 'function',
        status: 'draft',
        organization_slug: 'my-org',
        display_name: 'Complex Function',
        config: {
          configuration: {
            function: {
              code: 'a'.repeat(6000), // Long code > 5000 chars
            },
          },
        },
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      approvalsRepo.create.mockResolvedValue({
        id: 'approval-1',
        agent_slug: agent.slug,
        status: 'pending',
      } as never);

      const result = await service.requestPromotion('agent-2', {
        requestedBy: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('draft'); // Still draft, pending approval
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalId).toBe('approval-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(approvalsRepo.create).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(agentsRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should require approval for API agent', async () => {
      const agent = {
        id: 'agent-3',
        slug: 'api-agent',
        agent_type: 'api',
        status: 'draft',
        organization_slug: 'my-org',
        display_name: 'API Agent',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      approvalsRepo.create.mockResolvedValue({
        id: 'approval-2',
        agent_slug: agent.slug,
        status: 'pending',
      } as never);

      const result = await service.requestPromotion('agent-3');

      expect(result.requiresApproval).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(approvalsRepo.create).toHaveBeenCalled();
    });

    it('should fail if agent is already active', async () => {
      const agent = {
        id: 'agent-4',
        slug: 'already-active',
        agent_type: 'context',
        status: 'active',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);

      const result = await service.requestPromotion('agent-4');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already active');
    });

    it('should fail validation and return errors', async () => {
      const agent = {
        id: 'agent-5',
        slug: 'invalid-agent',
        agent_type: 'function',
        status: 'draft',
        config: {},
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      validator.validateByType.mockReturnValue({
        ok: false,
        issues: [{ message: 'Missing function code' }],
      });

      const result = await service.requestPromotion('agent-5');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing function code');
    });

    it('should skip validation when requested', async () => {
      const agent = {
        id: 'agent-6',
        slug: 'skip-validation',
        agent_type: 'context',
        status: 'draft',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      agentsRepo.updateStatus.mockResolvedValue({
        ...agent,
        status: 'active',
      } as never);

      await service.requestPromotion('agent-6', { skipValidation: true });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(validator.validateByType).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(agentsRepo.updateStatus).toHaveBeenCalled();
    });
  });

  describe('completePromotionAfterApproval', () => {
    it('should promote agent after approval', async () => {
      const approval = {
        id: 'approval-1',
        status: 'approved',
        mode: 'agent_promotion',
        approved_by: 'user-123',
        metadata: { agentId: 'agent-1' },
      };

      const agent = {
        id: 'agent-1',
        slug: 'test-agent',
        status: 'draft',
      };

      approvalsRepo.get.mockResolvedValue(approval as never);
      agentsRepo.getById.mockResolvedValue(agent as never);
      agentsRepo.updateStatus.mockResolvedValue({
        ...agent,
        status: 'active',
      } as never);

      const result = await service.completePromotionAfterApproval('approval-1');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('active');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(agentsRepo.updateStatus).toHaveBeenCalledWith('agent-1', 'active');
    });

    it('should fail if approval is not approved', async () => {
      const approval = {
        id: 'approval-2',
        status: 'pending',
        mode: 'agent_promotion',
        metadata: { agentId: 'agent-2' },
      };

      approvalsRepo.get.mockResolvedValue(approval as never);

      await expect(
        service.completePromotionAfterApproval('approval-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('demote', () => {
    it('should demote active agent to draft', async () => {
      const agent = {
        id: 'agent-7',
        slug: 'active-agent',
        status: 'active',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      agentsRepo.updateStatus.mockResolvedValue({
        ...agent,
        status: 'draft',
      } as never);

      const result = await service.demote('agent-7', 'Needs fixes');

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('active');
      expect(result.newStatus).toBe('draft');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(agentsRepo.updateStatus).toHaveBeenCalledWith('agent-7', 'draft');
    });

    it('should fail if agent is not active', async () => {
      const agent = {
        id: 'agent-8',
        slug: 'draft-agent',
        status: 'draft',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);

      const result = await service.demote('agent-8');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('archive', () => {
    it('should archive an agent', async () => {
      const agent = {
        id: 'agent-9',
        slug: 'to-archive',
        status: 'active',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);
      agentsRepo.updateStatus.mockResolvedValue({
        ...agent,
        status: 'archived',
      } as never);

      const result = await service.archive('agent-9', 'No longer needed');

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('active');
      expect(result.newStatus).toBe('archived');
    });
  });

  describe('getPromotionRequirements', () => {
    it('should return requirements for function agent', async () => {
      const agent = {
        id: 'agent-10',
        agent_type: 'function',
        config: { configuration: { function: { code: 'simple code' } } },
      };

      agentsRepo.getById.mockResolvedValue(agent as never);

      const requirements = await service.getPromotionRequirements('agent-10');

      expect(requirements.requiresValidation).toBe(true);
      expect(requirements.requiresDryRun).toBe(true);
    });

    it('should indicate approval requirement for orchestrator', async () => {
      const agent = {
        id: 'agent-11',
        agent_type: 'orchestrator',
      };

      agentsRepo.getById.mockResolvedValue(agent as never);

      const requirements = await service.getPromotionRequirements('agent-11');

      expect(requirements.requiresApproval).toBe(true);
    });
  });
});
