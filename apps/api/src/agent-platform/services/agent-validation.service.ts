import { Injectable } from '@nestjs/common';
import * as AjvNS from 'ajv';
import {
  AgentType,
  baseAgentSchema,
  schemaFor,
  CreateAgentPayload,
} from '../schemas/agent-schemas';

export type ValidationIssue = {
  message: string;
  instancePath?: string;
};

@Injectable()
export class AgentValidationService {
  private ajv: any;

  constructor() {
    const AjvCtor: any = (AjvNS as any).default ?? (AjvNS as any);
    this.ajv = new AjvCtor({ allErrors: true, strict: false } as any);
  }

  validateByType(type: AgentType, payload: CreateAgentPayload): {
    ok: boolean;
    issues: ValidationIssue[];
  } {
    const schema = schemaFor(type);
    const validate = this.ajv.compile(schema);
    const valid = validate(payload as any);
    const issues = (validate.errors || []).map(this.formatAjvError);

    // Additional runtime checks per type
    if (type === 'function') {
      const code = (payload as any)?.config?.configuration?.function?.code;
      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        issues.push({ message: 'config.configuration.function.code is required for function agents' });
      }
    }

    return { ok: issues.length === 0 && !!valid, issues };
  }

  private formatAjvError(err: AjvNS.ErrorObject | any): ValidationIssue {
    const msg = err?.message || 'validation error';
    const instancePath = (err && (err.instancePath || err.dataPath)) || undefined;
    return { message: msg, instancePath };
  }
}
