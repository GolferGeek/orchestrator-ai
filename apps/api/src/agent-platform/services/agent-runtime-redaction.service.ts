import { Injectable } from '@nestjs/common';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { TaskRequestDto } from '@agent2agent/dto/task-request.dto';

@Injectable()
export class AgentRuntimeRedactionService {
  redact(definition: AgentRuntimeDefinition, request: TaskRequestDto): TaskRequestDto {
    const cfg = (definition.config as any) || {};
    const fields: string[] = ((cfg.transforms?.redaction?.fields as any) || [])
      .filter((f: any) => typeof f === 'string');

    let next: TaskRequestDto = request;

    // Redact userMessage for obvious secrets
    if (typeof request.userMessage === 'string') {
      const masked = this.redactString(request.userMessage);
      if (masked !== request.userMessage) {
        next = { ...next, userMessage: masked };
      }
    }

    // Redact specific fields from payload.normalized if configured
    if (fields.length && next.payload?.normalized && typeof next.payload.normalized === 'object') {
      const copy = JSON.parse(JSON.stringify(next.payload.normalized));
      for (const path of fields) {
        this.maskPath(copy, path, 'REDACTED');
      }
      next = { ...next, payload: { ...(next.payload || {}), normalized: copy } };
    }

    return next;
  }

  private redactString(input: string): string {
    let s = input;
    const patterns: Array<[RegExp, string]> = [
      [/sk-[A-Za-z0-9-_]{10,}/g, 'sk-REDACTED'],
      [/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer REDACTED'],
      [/\b\d{13,19}\b/g, '[REDACTED_NUMBER]'],
    ];
    for (const [re, rep] of patterns) s = s.replace(re, rep);
    return s;
  }

  private maskPath(obj: any, path: string, value: any) {
    const parts: Array<string|number> = [];
    const re = /([^\.\[\]]+)|(\[(\d+)\])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(path))) {
      if (m[1]) parts.push(m[1]);
      else if (m[3]) parts.push(parseInt(m[3], 10));
    }
    if (!parts.length) return;
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur == null) return;
      cur = typeof p === 'number' ? cur[p] : cur[p];
      if (cur == null) return;
    }
    const last = parts[parts.length - 1];
    if (cur != null) {
      if (typeof last === 'number') {
        if (Array.isArray(cur) && last < cur.length) cur[last] = value;
      } else if (Object.prototype.hasOwnProperty.call(cur, last)) {
        cur[last] = value;
      }
    }
  }
}

