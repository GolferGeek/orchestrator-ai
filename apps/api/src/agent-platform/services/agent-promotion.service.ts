import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AgentsRepository } from '../repositories/agents.repository';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import {
  AgentValidationService,
  ValidationIssue,
} from './agent-validation.service';
import { AgentPolicyService } from './agent-policy.service';
import type { AgentType, CreateAgentPayload } from '../schemas/agent-schemas';
import type { AgentRecord } from '../interfaces/agent.interface';

export interface PromotionRequirements {
  requiresApproval: boolean;
  requiresValidation: boolean;
  requiresDryRun: boolean;
  customChecks?: Array<{ name: string; passed: boolean; message?: string }>;
}

export interface PromotionResult {
  success: boolean;
  agentId: string;
  previousStatus: string;
  newStatus: string;
  approvalId?: string;
  validationResults?: { ok: boolean; issues: ValidationIssue[] };
  error?: string;
  requiresApproval?: boolean;
}

@Injectable()
export class AgentPromotionService {
  private readonly logger = new Logger(AgentPromotionService.name);

  constructor(
    private readonly agents: AgentsRepository,
    private readonly approvals: HumanApprovalsRepository,
    private readonly validator: AgentValidationService,
    private readonly policy: AgentPolicyService,
  ) {}

  /**
   * Request promotion from draft → active with optional HITL approval
   */
  async requestPromotion(
    agentId: string,
    options?: {
      requireApproval?: boolean;
      requestedBy?: string;
      skipValidation?: boolean;
    },
  ): Promise<PromotionResult> {
    try {
      // 1. Fetch agent
      const agent = await this.agents.getById(agentId);
      if (!agent) {
        throw new BadRequestException(`Agent ${agentId} not found`);
      }

      // 2. Check current status
      if (agent.status === 'active') {
        return {
          success: false,
          agentId,
          previousStatus: agent.status,
          newStatus: agent.status,
          error: 'Agent is already active',
        };
      }

      if (agent.status !== 'draft') {
        throw new BadRequestException(
          `Cannot promote agent with status '${agent.status}'. Only draft agents can be promoted.`,
        );
      }

      // 3. Validate agent (unless explicitly skipped)
      if (!options?.skipValidation) {
        const validation = this.validator.validateByType(
          agent.agent_type as AgentType,
          {
            agent_type: agent.agent_type as AgentType,
            slug: agent.slug,
            display_name: agent.display_name,
            mode_profile: agent.mode_profile,
            description: agent.description,
            yaml: agent.yaml,
            context: agent.context,
            config: agent.config,
          } as CreateAgentPayload,
        );

        const policyIssues = this.policy.check({
          agent_type: agent.agent_type,
          config: agent.config as unknown as Parameters<
            typeof this.policy.check
          >[0]['config'],
          context: agent.context ?? undefined,
        });

        if (!validation.ok || policyIssues.length > 0) {
          const allIssues = [...validation.issues, ...policyIssues];
          this.logger.warn(
            `Agent ${agentId} failed validation: ${allIssues.map((i) => i.message).join(', ')}`,
          );
          return {
            success: false,
            agentId,
            previousStatus: agent.status || 'unknown',
            newStatus: agent.status || 'unknown',
            error: `Validation failed: ${allIssues.map((i) => i.message).join(', ')}`,
            validationResults: { ok: false, issues: allIssues },
          };
        }
      }

      // 4. Determine if approval is required
      const requiresApproval =
        options?.requireApproval ?? this.requiresApproval(agent);

      if (requiresApproval) {
        // Create approval request
        const approval = await this.approvals.create({
          organizationSlug: agent.organization_slug,
          agentSlug: agent.slug,
          mode: 'agent_promotion',
          metadata: {
            agentId: agent.id,
            agentType: agent.agent_type,
            displayName: agent.display_name,
            requestedBy: options?.requestedBy,
            requestedAt: new Date().toISOString(),
            fromStatus: 'draft',
            toStatus: 'active',
          },
        });

        this.logger.log(
          `Approval request created for agent ${agent.slug}: ${approval.id}`,
        );

        return {
          success: true,
          agentId,
          previousStatus: agent.status || 'draft',
          newStatus: agent.status || 'draft', // Status unchanged, pending approval
          approvalId: approval.id,
          requiresApproval: true,
        };
      }

      // 5. Auto-promote (no approval required)
      await this.agents.updateStatus(agentId, 'active');
      this.logger.log(`Agent ${agent.slug} promoted to active (auto-approved)`);

      return {
        success: true,
        agentId,
        previousStatus: agent.status || 'draft',
        newStatus: 'active',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Promotion failed for agent ${agentId}: ${message}`);
      throw error;
    }
  }

  /**
   * Complete promotion after HITL approval
   */
  async completePromotionAfterApproval(
    approvalId: string,
  ): Promise<PromotionResult> {
    try {
      // 1. Fetch approval
      const approval = await this.approvals.get(approvalId);
      if (!approval) {
        throw new BadRequestException(`Approval ${approvalId} not found`);
      }

      // 2. Check approval status
      if (approval.status !== 'approved') {
        throw new ForbiddenException(
          `Cannot promote: approval status is '${approval.status}'`,
        );
      }

      // 3. Get agent ID from metadata
      const agentIdValue = approval.metadata?.agentId;
      const agentId =
        typeof agentIdValue === 'string' ? agentIdValue.trim() : '';
      if (!agentId) {
        throw new BadRequestException('Approval metadata missing agentId');
      }

      // 4. Fetch agent
      const agent = await this.agents.getById(agentId);
      if (!agent) {
        throw new BadRequestException(`Agent ${agentId} not found`);
      }

      // 5. Verify still in draft status
      if (agent.status !== 'draft') {
        throw new BadRequestException(
          `Agent status is '${agent.status}', expected 'draft'`,
        );
      }

      // 6. Promote
      await this.agents.updateStatus(agentId, 'active');

      this.logger.log(
        `Agent ${agent.slug} promoted to active via approval ${approvalId} by ${approval.approved_by}`,
      );

      return {
        success: true,
        agentId,
        previousStatus: 'draft',
        newStatus: 'active',
        approvalId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Approval-based promotion failed for approval ${approvalId}: ${message}`,
      );
      throw error;
    }
  }

  /**
   * Demote agent from active → draft (for fixes/updates)
   */
  async demote(agentId: string, reason?: string): Promise<PromotionResult> {
    try {
      const agent = await this.agents.getById(agentId);
      if (!agent) {
        throw new BadRequestException(`Agent ${agentId} not found`);
      }

      if (agent.status !== 'active') {
        return {
          success: false,
          agentId,
          previousStatus: agent.status || 'unknown',
          newStatus: agent.status || 'unknown',
          error: `Agent is not active (status: ${agent.status})`,
        };
      }

      await this.agents.updateStatus(agentId, 'draft');

      this.logger.log(
        `Agent ${agent.slug} demoted to draft. Reason: ${reason || 'N/A'}`,
      );

      return {
        success: true,
        agentId,
        previousStatus: 'active',
        newStatus: 'draft',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Demotion failed for agent ${agentId}: ${message}`);
      throw error;
    }
  }

  /**
   * Archive agent (soft delete)
   */
  async archive(agentId: string, reason?: string): Promise<PromotionResult> {
    try {
      const agent = await this.agents.getById(agentId);
      if (!agent) {
        throw new BadRequestException(`Agent ${agentId} not found`);
      }

      if (agent.status === 'archived') {
        return {
          success: false,
          agentId,
          previousStatus: agent.status || 'archived',
          newStatus: agent.status || 'archived',
          error: 'Agent is already archived',
        };
      }

      const previousStatus = agent.status || 'unknown';
      await this.agents.updateStatus(agentId, 'archived');

      this.logger.log(
        `Agent ${agent.slug} archived. Reason: ${reason || 'N/A'}`,
      );

      return {
        success: true,
        agentId,
        previousStatus,
        newStatus: 'archived',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Archival failed for agent ${agentId}: ${message}`);
      throw error;
    }
  }

  /**
   * Determine if agent requires approval based on type and configuration
   */
  private requiresApproval(agent: AgentRecord): boolean {
    // Function agents with complex code always require approval
    if (agent.agent_type === 'function') {
      const config = agent.config as {
        configuration?: { function?: { code?: string } };
      } | null;
      const code: string = config?.configuration?.function?.code || '';
      // Require approval for long/complex functions
      if (code.length > 5000) return true;
      // Require approval if uses external services
      if (
        code.includes('fetch(') ||
        code.includes('axios') ||
        code.includes('http')
      ) {
        return true;
      }
    }

    // API agents calling external endpoints require approval
    if (agent.agent_type === 'api') {
      return true;
    }

    // Orchestrators coordinating multiple agents require approval
    if (agent.agent_type === 'orchestrator') {
      return true;
    }

    // Simple context agents can auto-promote
    return false;
  }

  /**
   * Get promotion requirements for an agent
   */
  async getPromotionRequirements(
    agentId: string,
  ): Promise<PromotionRequirements> {
    const agent = await this.agents.getById(agentId);
    if (!agent) {
      throw new BadRequestException(`Agent ${agentId} not found`);
    }

    const requiresApproval = this.requiresApproval(agent);
    const requiresValidation = true; // Always validate
    const requiresDryRun =
      agent.agent_type === 'function' || agent.agent_type === 'api';

    return {
      requiresApproval,
      requiresValidation,
      requiresDryRun,
      customChecks: [],
    };
  }
}
