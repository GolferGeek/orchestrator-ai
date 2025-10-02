import { Injectable } from '@nestjs/common';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
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
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
    });
    addFormats(this.ajv);
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

  private formatAjvError(err: ErrorObject): ValidationIssue {
    const msg = err.message || 'validation error';
    return { message: msg, instancePath: err.instancePath };
  }
}

