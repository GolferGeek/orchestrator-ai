import { AgentValidationService } from './agent-validation.service';
import type { CreateAgentPayload } from '@/agent-platform/dto/agent.dto';

describe('AgentValidationService', () => {
  const svc = new AgentValidationService();

  it('requires function code for function agents', () => {
    const payload: Partial<CreateAgentPayload> = {
      slug: 'test-fn',
      display_name: 'Test Fn',
      agent_type: 'function',
      mode_profile: 'draft',
      config: { configuration: { function: {} } },
    };
    const res = svc.validateByType('function', payload as never);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.message.includes('function_code'))).toBe(
      true,
    );
  });

  it('accepts valid function agent payload', () => {
    const payload: Partial<CreateAgentPayload> = {
      slug: 'ok-fn',
      display_name: 'OK Fn',
      agent_type: 'function',
      mode_profile: 'draft',
      config: {
        configuration: {
          function: { code: 'module.exports=async()=>({ok:true})' },
        },
      },
    };
    const res = svc.validateByType('function', payload as never);
    expect(res.ok).toBe(true);
  });
});
