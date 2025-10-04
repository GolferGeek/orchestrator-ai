import { AgentRuntimeDispatchService } from './agent-runtime-dispatch.service';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { HttpService } from '@nestjs/axios';
import { AgentRuntimeMetricsService } from './agent-runtime-metrics.service';

describe('AgentRuntimeDispatchService - redaction and header allowlist', () => {
  const makeService = () => {
    const llmFactory = {} as unknown as LLMServiceFactory;
    const http = {} as unknown as HttpService;
    const metrics = { record: jest.fn(), snapshot: jest.fn() } as any;
    return new AgentRuntimeDispatchService(llmFactory, http, metrics);
  };

  it('redacts secrets from error messages', () => {
    const svc = makeService();
    const input = `Bearer sk-THISISASECRET api_key=abc123 "authorization":"Bearer XYZ987"`;
    const redacted = (svc as any).redactString(input) as string;
    expect(redacted).not.toContain('THISISASECRET');
    expect(redacted).toContain('Bearer REDACTED');
    expect(redacted).toContain('sk-REDACTED');
    expect(redacted.toLowerCase()).toContain('authorization="redacted"');
  });

  it('applies header allowlist including env extensions', () => {
    const svc = makeService();
    const original = process.env.AGENT_EXTERNAL_HEADER_ALLOWLIST;
    process.env.AGENT_EXTERNAL_HEADER_ALLOWLIST = 'x-custom-one';
    try {
      const headers = {
        Authorization: 'Bearer token',
        'X-API-KEY': 'abc',
        'X-Custom-One': 'yes',
        'X-Forbidden': 'no',
        'Content-Type': 'application/json',
      } as Record<string, any>;
      const filtered = (svc as any).sanitizeForwardHeaders(headers) as Record<string, any>;
      const keys = Object.keys(filtered);
      expect(keys).toContain('authorization');
      expect(keys).toContain('x-api-key');
      expect(keys).toContain('x-custom-one');
      expect(keys).toContain('content-type');
      expect(keys).not.toContain('x-forbidden');
    } finally {
      process.env.AGENT_EXTERNAL_HEADER_ALLOWLIST = original;
    }
  });
});

