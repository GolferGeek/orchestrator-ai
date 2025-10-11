import { Injectable } from '@nestjs/common';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { AgentRuntimeAgentMetadata } from '../interfaces/agent-runtime-agent-metadata.interface';

export interface RuntimeMetadataExtras {
  [key: string]: any;
}

export interface RuntimeMetadataEnvelope {
  agent?: AgentRuntimeAgentMetadata;
  [key: string]: any;
}

@Injectable()
export class AgentRuntimeExecutionService {
  getAgentMetadataFromDefinition(
    definition: AgentRuntimeDefinition,
    organizationSlug: string | null,
  ): AgentRuntimeAgentMetadata {
    return {
      id: definition.id ?? null,
      slug: definition.slug,
      displayName: definition.displayName ?? null,
      type: definition.agentType ?? null,
      organizationSlug,
    };
  }

  collectRequestMetadata(request: {
    payload?: { metadata?: Record<string, any> };
    metadata?: Record<string, any>;
  }): Record<string, any> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
  }

  enrichPlanDraft(
    draft: Record<string, any>,
    agent: AgentRuntimeAgentMetadata,
  ): Record<string, any> {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }

    const result = { ...draft };
    const existingMeta = (result as any)._meta ?? {};
    (result as any)._meta = {
      ...existingMeta,
      agent,
    };

    return result;
  }

  buildRunMetadata(
    base: Record<string, any>,
    agent: AgentRuntimeAgentMetadata,
    extras: RuntimeMetadataExtras = {},
  ): Record<string, any> {
    return {
      ...base,
      ...extras,
      agentId: agent.id,
      agentSlug: agent.slug,
      agentType: agent.type,
      organizationSlug: agent.organizationSlug,
    };
  }
}
