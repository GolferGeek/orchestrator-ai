import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AgentValidationService } from './agent-validation.service';
import { AgentDryRunService } from './agent-dry-run.service';
import { AgentPolicyService } from './agent-policy.service';
import type { CreateAgentPayload } from '../schemas/agent-schemas';
import type { AgentPolicyPayload } from './agent-policy.service';

describe('Seed payloads (local smoke without HTTP)', () => {
  const validator = new AgentValidationService();
  const dry = new AgentDryRunService();
  const policy = new AgentPolicyService();

  const root = resolve(__dirname, '../../../../../');
  const blogPath = resolve(
    root,
    'docs/feature/matt/payloads/blog_post_writer.json',
  );
  const hrPath = resolve(root, 'docs/feature/matt/payloads/hr_assistant.json');
  const builderPath = resolve(
    root,
    'docs/feature/matt/payloads/agent_builder_orchestrator.json',
  );
  const chatBuilderPath = resolve(
    root,
    'docs/feature/matt/payloads/agent_builder_chat.json',
  );

  it('validates Blog Post Writer (context agent)', () => {
    const blog = JSON.parse(
      readFileSync(blogPath, 'utf8'),
    ) as CreateAgentPayload;
    const v = validator.validateByType(blog.agent_type, blog);
    const p = policy.check(blog as AgentPolicyPayload);
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);
    // Context agent - no function code to dry-run
    expect(blog.agent_type).toBe('context');
  });

  it('validates HR Assistant (context agent)', () => {
    const hr = JSON.parse(readFileSync(hrPath, 'utf8')) as CreateAgentPayload;
    const v = validator.validateByType(hr.agent_type, hr);
    const p = policy.check(hr as AgentPolicyPayload);
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);
  });

  it('validates Agent Builder Orchestrator and dry-runs function code', async () => {
    const builder = JSON.parse(
      readFileSync(builderPath, 'utf8'),
    ) as CreateAgentPayload;
    const v = validator.validateByType(builder.agent_type, builder);
    const p = policy.check(builder as AgentPolicyPayload);
    if (!v.ok) {
      console.log('Agent Builder Orchestrator validation errors:', v.issues);
    }
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);

    const configObj = builder?.config as
      | Record<string, unknown>
      | null
      | undefined;
    const configurationObj = configObj?.configuration as
      | Record<string, unknown>
      | null
      | undefined;
    const functionConfig = configurationObj?.function as
      | Record<string, unknown>
      | null
      | undefined;
    const code =
      functionConfig && typeof functionConfig.code === 'string'
        ? functionConfig.code
        : '';
    const res = await dry.runFunction(
      code,
      {
        step: 'intent',
        data: { agentType: 'function', purpose: 'Test agent' },
      },
      10000,
    );
    expect(res.ok).toBe(true);
    const result = res.result as
      | { state?: { step?: string }; content?: string }
      | undefined;
    expect(result?.state?.step).toBe('basic_info');
    expect(result?.content).toContain('Organization slug');
  });

  it('validates Agent Builder Chat payload', () => {
    const chatBuilder = JSON.parse(
      readFileSync(chatBuilderPath, 'utf8'),
    ) as CreateAgentPayload;
    const v = validator.validateByType(chatBuilder.agent_type, chatBuilder);
    const p = policy.check(chatBuilder as AgentPolicyPayload);
    if (!v.ok) {
      console.log('Agent Builder Chat validation errors:', v.issues);
    }
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);
    const chatConfigObj = chatBuilder.config as
      | Record<string, unknown>
      | null
      | undefined;
    const chatConfigurationObj = chatConfigObj?.configuration as
      | Record<string, unknown>
      | null
      | undefined;
    const chatFunctionConfig = chatConfigurationObj?.function as
      | Record<string, unknown>
      | null
      | undefined;
    const hasCode = chatFunctionConfig && 'code' in chatFunctionConfig;
    const hasTimeout = chatFunctionConfig && 'timeout_ms' in chatFunctionConfig;
    expect(hasCode).toBe(true);
    expect(
      hasTimeout && typeof chatFunctionConfig.timeout_ms === 'number'
        ? chatFunctionConfig.timeout_ms
        : null,
    ).toBe(15000);
  });
});
