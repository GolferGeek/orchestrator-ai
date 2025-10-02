import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AgentValidationService } from './agent-validation.service';
import { AgentDryRunService } from './agent-dry-run.service';
import { AgentPolicyService } from './agent-policy.service';

describe('Seed payloads (local smoke without HTTP)', () => {
  const validator = new AgentValidationService();
  const dry = new AgentDryRunService();
  const policy = new AgentPolicyService();

  const root = resolve(__dirname, '../../../../../');
  const blogPath = resolve(root, 'docs/feature/matt/payloads/blog_post_writer.json');
  const hrPath = resolve(root, 'docs/feature/matt/payloads/hr_assistant.json');
  const builderPath = resolve(root, 'docs/feature/matt/payloads/agent_builder_orchestrator.json');

  it('validates Blog Post Writer and dry-runs function code', async () => {
    const blog = JSON.parse(readFileSync(blogPath, 'utf8'));
    const v = validator.validateByType(blog.agent_type, blog);
    const p = policy.check(blog);
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);
    const code = blog?.config?.configuration?.function?.code as string;
    const res = await dry.runFunction(code, { title: 'Test Title', outline: ['Intro', 'Body', 'Conclusion'] }, 1000);
    expect(res.ok).toBe(true);
    expect(String(res.result?.format)).toContain('markdown');
    expect(String(res.result?.content)).toContain('# Test Title');
  });

  it('validates HR Assistant (context agent)', async () => {
    const hr = JSON.parse(readFileSync(hrPath, 'utf8'));
    const v = validator.validateByType(hr.agent_type, hr);
    const p = policy.check(hr);
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);
  });

  it('validates Agent Builder Orchestrator and dry-runs function code', async () => {
    const builder = JSON.parse(readFileSync(builderPath, 'utf8'));
    const v = validator.validateByType(builder.agent_type, builder);
    const p = policy.check(builder);
    expect(v.ok).toBe(true);
    expect(p.length).toBe(0);

    const code = builder?.config?.configuration?.function?.code as string;
    const res = await dry.runFunction(
      code,
      { step: 'intent', data: { agentType: 'function', purpose: 'Test agent' } },
      10000
    );
    expect(res.ok).toBe(true);
    expect(res.result?.state?.step).toBe('basic_info');
    expect(res.result?.content).toContain('Organization slug');
  });
});

