import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { AgentValidationService } from './agent-validation.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentDryRunService } from './agent-dry-run.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { LLMService } from '@/llms/llm.service';

export interface AgentBuilderContext {
  validate: (config: any) => Promise<{ ok: boolean; issues: any[]; dryRun?: any }>;
  create: (config: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  generateFunctionCode: (description: string, inputModes: string[], outputModes: string[]) => Promise<{ code: string; error?: string }>;
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
  async validateAgent(payload: any): Promise<{ ok: boolean; issues: any[]; dryRun?: any }> {
    const type = payload.agent_type;
    const validation = this.validator.validateByType(type, payload);
    const policyIssues = this.policy.check(payload);

    const response: any = {
      ok: validation.ok && policyIssues.length === 0,
      issues: [...validation.issues, ...policyIssues],
    };

    // Run dry-run for function agents
    if (validation.ok && type === 'function') {
      const code = payload?.config?.configuration?.function?.code;
      const timeout = Number(payload?.config?.configuration?.function?.timeout_ms) || 2000;
      if (code && code.length < 50000) {
        response.dryRun = await this.dryRun.runFunction(code, {}, timeout);
      }
    }

    // Run dry-run for API agents
    if (validation.ok && type === 'api') {
      const apiCfg = payload?.config?.configuration?.api?.api_configuration;
      if (apiCfg) {
        const sampleInput = payload?.config?.configuration?.api?.sample_input || { test: 'input' };
        const sampleResp = payload?.config?.configuration?.api?.sample_response || { test: 'output' };
        response.dryRun = await this.dryRun.runApiTransform(apiCfg, sampleInput, sampleResp);
      }
    }

    return response;
  }

  /**
   * Create an agent after validation
   */
  async createAgent(payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Validate first
      const validation = await this.validateAgent(payload);
      if (!validation.ok) {
        return {
          success: false,
          error: `Validation failed: ${validation.issues.map(i => i.message).join(', ')}`,
        };
      }

      // Create the agent
      const record = await this.agents.upsert({
        organization_slug: payload.organization_slug ?? null,
        slug: payload.slug,
        display_name: payload.display_name,
        description: payload.description ?? null,
        agent_type: payload.agent_type,
        mode_profile: payload.mode_profile || 'draft',
        version: null,
        status: 'draft', // Start as draft
        yaml: payload.yaml ?? '',
        agent_card: payload.agent_card ?? null,
        context: payload.context ?? null,
        config: payload.config ?? null,
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
3. Use ctx.services.images.generate() for image generation tasks
4. Input modes: ${inputModes.join(', ')} - the function will receive data in these formats
5. Output modes: ${outputModes.join(', ')} - the function must return data in these formats
6. Always validate input and handle errors gracefully
7. Return the result directly - no need to call callbacks or events
8. Keep code concise but complete

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

      const response = await this.llm.generateResponse(systemPrompt, userPrompt, {
        providerName: 'openai',
        modelName: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
        callerType: 'service',
        callerName: 'agent-builder-code-gen',
      });

      // Extract code if it's wrapped in markdown
      let code = typeof response === 'string' ? response : response.content;
      code = code.trim();

      // Remove markdown code fences if present
      if (code.startsWith('```')) {
        code = code.replace(/^```(?:javascript|js)?\n/, '').replace(/\n```$/, '');
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
