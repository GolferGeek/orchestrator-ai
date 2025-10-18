import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { AgentValidationService } from './agent-validation.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentDryRunService } from './agent-dry-run.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { LLMService } from '@/llms/llm.service';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { AgentType } from '../dto/agent-admin.dto';

interface ValidationIssue {
  message: string;
  [key: string]: unknown;
}

interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  dryRun?: unknown;
}

interface CreateResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentBuilderContext {
  validate: (config: JsonObject) => Promise<ValidationResult>;
  create: (config: JsonObject) => Promise<CreateResult>;
  generateFunctionCode: (
    description: string,
    inputModes: string[],
    outputModes: string[],
  ) => Promise<{ code: string; error?: string }>;
}

@Injectable()
export class AgentBuilderService {
  constructor(
    private readonly validator: AgentValidationService,
    private readonly policy: AgentPolicyService,
    private readonly dryRun: AgentDryRunService,
    private readonly agents: AgentsRepository,
    @Inject(forwardRef(() => LLMService))
    private readonly llm: LLMService,
  ) {}

  /**
   * Validate an agent configuration
   */
  async validateAgent(payload: JsonObject): Promise<ValidationResult> {
    const type = payload.agent_type as AgentType;
    const validation = this.validator.validateByType(
      type,
      payload as unknown as Parameters<typeof this.validator.validateByType>[1],
    );
    const policyIssues = this.policy.check(
      payload as unknown as Parameters<typeof this.policy.check>[0],
    );

    const response: ValidationResult = {
      ok: validation.ok && policyIssues.length === 0,
      issues: [...validation.issues, ...policyIssues],
    };

    // Run dry-run for function agents
    if (validation.ok && type === AgentType.FUNCTION) {
      const config = payload?.config;
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        const configuration = (config as Record<string, unknown>).configuration;
        if (
          configuration &&
          typeof configuration === 'object' &&
          !Array.isArray(configuration)
        ) {
          const functionConfig = (configuration as Record<string, unknown>)
            .function;
          if (
            functionConfig &&
            typeof functionConfig === 'object' &&
            !Array.isArray(functionConfig)
          ) {
            const code = (functionConfig as Record<string, unknown>).code;
            const timeout =
              Number((functionConfig as Record<string, unknown>).timeout_ms) ||
              2000;
            if (typeof code === 'string' && code.length < 50000) {
              response.dryRun = await this.dryRun.runFunction(
                code,
                {},
                timeout,
              );
            }
          }
        }
      }
    }

    // Run dry-run for API agents
    if (validation.ok && type === AgentType.API) {
      const config = payload?.config;
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        const configuration = (config as Record<string, unknown>).configuration;
        if (
          configuration &&
          typeof configuration === 'object' &&
          !Array.isArray(configuration)
        ) {
          const apiConfig = (configuration as Record<string, unknown>).api;
          if (
            apiConfig &&
            typeof apiConfig === 'object' &&
            !Array.isArray(apiConfig)
          ) {
            const apiCfg = (apiConfig as Record<string, unknown>)
              .api_configuration;
            if (apiCfg) {
              const sampleInput = (apiConfig as Record<string, unknown>)
                .sample_input || { test: 'input' };
              const sampleResp = (apiConfig as Record<string, unknown>)
                .sample_response || { test: 'output' };
              response.dryRun = this.dryRun.runApiTransform(
                apiCfg,
                sampleInput,
                sampleResp,
              );
            }
          }
        }
      }
    }

    return response;
  }

  /**
   * Create an agent after validation
   */
  async createAgent(payload: JsonObject): Promise<CreateResult> {
    try {
      // Validate first
      const validation = await this.validateAgent(payload);
      if (!validation.ok) {
        return {
          success: false,
          error: `Validation failed: ${validation.issues.map((i) => i.message).join(', ')}`,
        };
      }

      // Create the agent
      const record = await this.agents.upsert({
        organization_slug:
          typeof payload.organization_slug === 'string'
            ? payload.organization_slug
            : null,
        slug: typeof payload.slug === 'string' ? payload.slug : '',
        display_name:
          typeof payload.display_name === 'string' ? payload.display_name : '',
        description:
          typeof payload.description === 'string' ? payload.description : null,
        agent_type:
          typeof payload.agent_type === 'string' ? payload.agent_type : '',
        mode_profile:
          typeof payload.mode_profile === 'string'
            ? payload.mode_profile
            : 'draft',
        version: null,
        status: 'draft', // Start as draft
        yaml: typeof payload.yaml === 'string' ? payload.yaml : '',
        context:
          payload.context &&
          typeof payload.context === 'object' &&
          !Array.isArray(payload.context)
            ? payload.context
            : null,
      });

      return { success: true, data: record };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate function code using LLM based on description and IO contract
   */
  async generateFunctionCode(
    description: string,
    inputModes: string[],
    outputModes: string[],
  ): Promise<{ code: string; error?: string }> {
    try {
      const systemPrompt = `You are a JavaScript code generator for function agents. Generate clean, production-ready JavaScript code based on the user's requirements.

IMPORTANT RULES:
1. Return ONLY the JavaScript code - no markdown, no explanations, no code fences
2. The function must be named "handler" and accept (input, ctx) parameters
3. Call external APIs directly (e.g., const axios = ctx.require('axios')) and never rely on internal services
4. Persist outputs using ctx.deliverables.create(...) and ctx.assets.saveBuffer(...) when creating deliverables or files
5. Input modes: ${inputModes.join(', ')} - the function will receive data in these formats
6. Output modes: ${outputModes.join(', ')} - the function must return data in these formats
7. Always validate input and handle errors gracefully
8. Return the result directly - no need to call callbacks or events
9. Keep code concise but complete

Example structure:
async function handler(input, ctx) {
  // Validate input
  if (!input || !input.text) {
    throw new Error('Missing required input.text');
  }

  // Process the input
  const result = /* your logic here */;

  // Return result matching output modes
  return { text: result };
}`;

      const userPrompt = `Generate a function agent that does the following:

${description}

The function will receive input in these modes: ${inputModes.join(', ')}
The function must return output in these modes: ${outputModes.join(', ')}

Generate the complete handler function. Return ONLY the code, nothing else.`;

      const response = await this.llm.generateResponse(
        systemPrompt,
        userPrompt,
        {
          providerName: 'openai',
          modelName: 'gpt-4o-mini',
          temperature: 0.3,
          maxTokens: 2000,
          callerType: 'service',
          callerName: 'agent-builder-code-gen',
        },
      );

      // Extract code if it's wrapped in markdown
      let code = typeof response === 'string' ? response : response.content;
      code = code.trim();

      // Remove markdown code fences if present
      if (code.startsWith('```')) {
        code = code
          .replace(/^```(?:javascript|js)?\n/, '')
          .replace(/\n```$/, '');
      }

      return { code };
    } catch (error) {
      return {
        code: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the service context to inject into function agents
   */
  getContext(): AgentBuilderContext {
    return {
      validate: this.validateAgent.bind(this),
      create: this.createAgent.bind(this),
      generateFunctionCode: this.generateFunctionCode.bind(this),
    };
  }
}
