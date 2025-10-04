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
      // Function code can be in function_code column (database format) or config.configuration.function.code (payload format)
      const functionCode = (payload as any)?.function_code || (payload as any)?.config?.configuration?.function?.code;

      if (!functionCode || typeof functionCode !== 'string' || functionCode.trim().length === 0) {
        issues.push({ message: 'function_code is required for function agents' });
      }
    }

    if (type === 'api') {
      const api = (payload as any)?.config?.configuration?.api?.api_configuration;
      if (!api) {
        issues.push({ message: 'config.configuration.api.api_configuration is required for api agents' });
      } else {
        const rt = api.request_transform;
        const rstr = api.response_transform;
        if (rt && typeof rt !== 'object') issues.push({ message: 'api.request_transform must be an object' });
        if (rstr && typeof rstr !== 'object') issues.push({ message: 'api.response_transform must be an object' });
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
