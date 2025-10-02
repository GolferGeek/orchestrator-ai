export type AgentType = 'function' | 'context' | 'api' | 'orchestrator';

export interface CreateAgentPayload {
  organization_slug?: string | null;
  slug: string;
  display_name: string;
  agent_type: AgentType;
  mode_profile: string;
  yaml?: string;
  description?: string | null;
  agent_card?: Record<string, any> | null;
  context?: Record<string, any> | null;
  config?: Record<string, any> | null;
}

// Common base schema for all agents
export const baseAgentSchema: any = {
  type: 'object',
  properties: {
    organization_slug: { type: 'string', nullable: true, optional: true },
    slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{1,62}$' },
    display_name: { type: 'string' },
    agent_type: { type: 'string', enum: ['function', 'context', 'api', 'orchestrator'] as AgentType[] },
    mode_profile: { type: 'string' },
    yaml: { type: 'string', nullable: true, optional: true },
    description: { type: 'string', nullable: true, optional: true },
    agent_card: { type: 'object', nullable: true, optional: true, additionalProperties: true },
    context: { type: 'object', nullable: true, optional: true, additionalProperties: true },
    config: { type: 'object', nullable: true, optional: true, additionalProperties: true },
  },
  required: ['slug', 'display_name', 'agent_type', 'mode_profile'],
  additionalProperties: true,
};

// Function agent must include configuration.function.code
export const functionAgentSchema: any = {
  ...baseAgentSchema,
  allOf: [
    {
      if: {
        properties: { agent_type: { const: 'function' } },
      },
      then: {
        properties: {
          config: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
            properties: {
              configuration: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
                properties: {
                  function: {
                    type: 'object',
                    nullable: true,
                    additionalProperties: true,
                    properties: {
                      code: { type: 'string', nullable: true },
                      timeout_ms: { type: 'integer', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        // Custom validation note: enforce presence of code via runtime check
      },
    },
  ],
};

// Context agent should provide either `context` object or `yaml`
export const contextAgentSchema: any = {
  ...baseAgentSchema,
};

// API agent expects api_configuration under config
export const apiAgentSchema: any = {
  ...baseAgentSchema,
};

// Orchestrator agent – no extra requireds yet
export const orchestratorAgentSchema: any = {
  ...baseAgentSchema,
};

export function schemaFor(type: AgentType) {
  switch (type) {
    case 'function':
      return functionAgentSchema;
    case 'context':
      return contextAgentSchema;
    case 'api':
      return apiAgentSchema;
    case 'orchestrator':
      return orchestratorAgentSchema;
    default:
      return baseAgentSchema;
  }
}
