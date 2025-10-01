import { Injectable } from '@nestjs/common';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';

export interface NormalizationResult {
  ok: boolean;
  strict: boolean;
  expected?: string | null;
  provided?: string | null;
  reason?: string;
  request?: TaskRequestDto;
}

@Injectable()
export class AgentRuntimeNormalizationService {
  normalize(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    mode: AgentTaskMode,
  ): NormalizationResult {
    const expected = this.resolveExpected(definition, mode);
    const provided = this.detectProvided(request);
    const strict = Boolean(expected?.strict);

    // If no expected type, pass through
    if (!expected?.input) {
      return { ok: true, strict, expected: null, provided, request };
    }

    const exp = expected.input;
    if (exp === provided) {
      return { ok: true, strict, expected: exp, provided, request };
    }

    // Try to adapt
    const adapted = this.adapt(request, provided, exp, definition);
    if (adapted) {
      return { ok: true, strict, expected: exp, provided, request: adapted };
    }

    const reason = `Expected ${exp}, received ${provided}`;
    if (strict) {
      return { ok: false, strict, expected: exp, provided, reason };
    }
    // permissive: pass through
    return { ok: true, strict, expected: exp, provided, request };
  }

  private resolveExpected(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
  ): { input?: string; output?: string; strict?: boolean } | null {
    const cfg = (definition.config as any) || {};
    const transforms = (cfg.transforms as any) || {};
    const expected = (transforms.expected as any) || {};
    const byMode = (transforms.by_mode as any) || {};
    const forMode = (byMode[this.modeKey(mode)] as any) || {};

    const input = forMode.input?.content_type || expected.input?.content_type;
    const output = forMode.output?.content_type || expected.output?.content_type;
    const strict = Boolean(forMode.input?.strict ?? expected.input?.strict);
    if (!input && !output && !strict) return null;
    return { input, output, strict };
  }

  private detectProvided(request: TaskRequestDto): string | null {
    // If caller specified a contentType, honor it
    const hinted = (request.payload as any)?.options?.contentType;
    if (typeof hinted === 'string' && hinted.trim()) return hinted.trim();

    if (typeof request.userMessage === 'string' && request.userMessage.trim()) {
      return 'text/markdown';
    }
    // If payload is an object with keys (excluding options/metadata), assume JSON
    const payload = request.payload || {};
    const keys = Object.keys(payload).filter(
      (k) => !['options', 'metadata'].includes(k),
    );
    if (keys.length > 0) {
      return 'application/json';
    }
    return null;
  }

  private adapt(
    request: TaskRequestDto,
    provided: string | null,
    expected: string,
    definition: AgentRuntimeDefinition,
  ): TaskRequestDto | null {
    // JSON -> Markdown
    if (provided === 'application/json' && expected.startsWith('text/')) {
      const template = this.resolveAdapterTemplate(definition, 'json_to_markdown');
      const json = this.safeStringify((request.payload as any) ?? {});
      const rendered = template
        ? template.replace('{{ json }}', json)
        : `\n\n\u003c!-- structured input --\u003e\n\n\u0060\u0060\u0060json\n${json}\n\u0060\u0060\u0060\n`;
      const clone: TaskRequestDto = {
        ...request,
        userMessage: [request.userMessage, rendered].filter(Boolean).join('\n\n'),
      };
      return clone;
    }

    // Markdown -> JSON (extract fenced JSON)
    if (provided?.startsWith('text/') && expected === 'application/json') {
      const extracted = this.extractFencedJson(request.userMessage || '');
      if (extracted) {
        const clone: TaskRequestDto = {
          ...request,
          payload: { ...(request.payload || {}), normalized: extracted },
        };
        return clone;
      }
      // no adapter, cannot adapt
      return null;
    }

    return null;
  }

  private resolveAdapterTemplate(
    definition: AgentRuntimeDefinition,
    adapterKey: string,
  ): string | null {
    const cfg = (definition.config as any) || {};
    const adapters = (cfg.transforms as any)?.adapters || {};
    const candidate = adapters?.[adapterKey]?.template;
    return typeof candidate === 'string' && candidate.trim() ? candidate : null;
  }

  private extractFencedJson(text: string): any | null {
    const re = /```json\s*([\s\S]*?)\s*```/i;
    const m = re.exec(text);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  private safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  private modeKey(mode: AgentTaskMode): string {
    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return 'converse';
      case AgentTaskMode.PLAN:
        return 'plan';
      case AgentTaskMode.BUILD:
        return 'build';
      default:
        return String(mode).toLowerCase();
    }
  }
}

