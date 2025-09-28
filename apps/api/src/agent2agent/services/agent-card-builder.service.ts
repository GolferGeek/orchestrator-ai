import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';

export interface AgentCardOptions {
  includePrivateFields?: boolean;
}

@Injectable()
export class AgentCardBuilderService {
  constructor(private readonly agentsRepository: AgentsRepository) {}

  async build(
    organizationSlug: string | null,
    agentSlug: string,
    options: AgentCardOptions = {},
  ): Promise<any> {
    const agent = await this.agentsRepository.findBySlug(organizationSlug, agentSlug);

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.agent_card && options.includePrivateFields !== false) {
      return agent.agent_card;
    }

    // Minimal card fallback using stored metadata when cached card missing.
    return {
      name: agent.display_name,
      description: agent.description,
      protocol: 'google/a2a',
      version: agent.version ?? '1.0.0',
      type: agent.agent_type,
      capabilities: agent.config?.capabilities ?? [],
      defaultInputModes: agent.context?.input_modes ?? ['text/plain'],
      defaultOutputModes: agent.context?.output_modes ?? ['text/plain'],
      metadata: {
        slug: agent.slug,
        organization: agent.organization_slug,
      },
    };
  }
}
