import { AgentRuntimeNormalizationService } from './agent-runtime-normalization.service';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';

describe('AgentRuntimeNormalizationService', () => {
  const service = new AgentRuntimeNormalizationService();
  const definition: any = { config: { transforms: { expected: { input: { content_type: 'application/json', strict: true } } } } };

  function reqFromUserMessage(userMessage: string): TaskRequestDto {
    return { mode: AgentTaskMode.BUILD, userMessage, payload: {} } as any;
  }

  it('extracts fenced JSON from markdown', () => {
    const req = reqFromUserMessage('Here:\n```json\n{"a":1}\n```');
    const res = service.normalize(definition, req, AgentTaskMode.BUILD);
    expect(res.ok).toBe(true);
    expect(res.request?.payload?.normalized).toEqual({ a: 1 });
  });

  it('parses YAML to JSON when expected JSON', () => {
    const req = reqFromUserMessage('- a: 1\n- b: 2');
    const res = service.normalize(definition, req, AgentTaskMode.BUILD);
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.request?.payload?.normalized)).toBe(true);
  });

  it('parses CSV to JSON when expected JSON', () => {
    const req = reqFromUserMessage('name,score\njack,10\njill,12');
    const res = service.normalize(definition, req, AgentTaskMode.BUILD);
    expect(res.ok).toBe(true);
    expect(res.request?.payload?.normalized?.[0]).toEqual({ name: 'jack', score: '10' });
  });
});

