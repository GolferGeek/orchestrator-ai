import { Injectable } from '@nestjs/common';
import * as vm from 'vm';

type DryRunResult = {
  ok: boolean;
  result?: any;
  error?: string;
  logs?: string[];
};

@Injectable()
export class AgentDryRunService {
  async runFunction(
    code: string,
    input: any = {},
    timeoutMs = 2000,
  ): Promise<DryRunResult> {
    const logs: string[] = [];
    const consoleStub: {
      log: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      error: (...args: any[]) => void;
      info: (...args: any[]) => void;
    } = {
      log: (...args: any[]) => logs.push(args.map(String).join(' ')),
      warn: (...args: any[]) =>
        logs.push('[warn] ' + args.map(String).join(' ')),
      error: (...args: any[]) =>
        logs.push('[error] ' + args.map(String).join(' ')),
      info: (...args: any[]) =>
        logs.push('[info] ' + args.map(String).join(' ')),
    };

    // Very limited sandbox; no require/process. This is a best-effort guard.
    const context = vm.createContext({
      module: { exports: undefined as unknown },
      exports: {} as Record<string, unknown>,
      console: consoleStub,
      require: undefined,
      process: undefined,
      global: {},
      Buffer: undefined,
    });

    try {
      const script = new vm.Script(String(code));
      script.runInContext(context, { timeout: Math.min(timeoutMs, 1000) });
      const handler: unknown = context.module.exports || context.exports;
      if (typeof handler !== 'function') {
        return {
          ok: false,
          error:
            'Function code must export a handler (module.exports = async (input, ctx) => { ... })',
          logs,
        };
      }

      const ctx = { services: {} };
      const exec = Promise.resolve().then(() => handler(input, ctx));
      const timed = this.withTimeout(exec, timeoutMs);
      const result: unknown = await timed;
      return { ok: true, result, logs };
    } catch (err: unknown) {
      const message: string =
        err instanceof Error ? err.message : 'dry-run error';
      return { ok: false, error: message, logs };
    }
  }

  runApiTransform(
    apiConfig: any,
    input: any = {},
    mockResponse?: any,
  ): {
    ok: boolean;
    request?: { format?: string; body?: string };
    response?: { format?: string; extracted?: any };
    error?: string;
  } {
    try {
      const reqT: unknown =
        apiConfig?.request_transform || apiConfig?.requestTransform;
      const resT: unknown =
        apiConfig?.response_transform || apiConfig?.responseTransform;

      let body: string | undefined;
      if (
        typeof reqT === 'object' &&
        reqT !== null &&
        'format' in reqT &&
        reqT.format === 'custom' &&
        'template' in reqT &&
        typeof reqT.template === 'string'
      ) {
        body = this.renderTemplate(reqT.template, input);
      } else if (typeof reqT === 'object') {
        // Best-effort stringify
        body = JSON.stringify(reqT);
      }

      let extracted: unknown = undefined;
      if (
        typeof resT === 'object' &&
        resT !== null &&
        'format' in resT &&
        resT.format === 'field_extraction' &&
        'field' in resT &&
        typeof resT.field === 'string'
      ) {
        const src: unknown = mockResponse ?? {};
        extracted = this.getByPath(src, resT.field);
      }

      const reqFormat: string | undefined =
        typeof reqT === 'object' &&
        reqT !== null &&
        'format' in reqT &&
        typeof reqT.format === 'string'
          ? reqT.format
          : undefined;
      const resFormat: string | undefined =
        typeof resT === 'object' &&
        resT !== null &&
        'format' in resT &&
        typeof resT.format === 'string'
          ? resT.format
          : undefined;

      return {
        ok: true,
        request: { format: reqFormat, body },
        response: { format: resFormat, extracted },
      };
    } catch (err: unknown) {
      const message: string =
        err instanceof Error ? err.message : 'api dry-run error';
      return { ok: false, error: message };
    }
  }

  private renderTemplate(tpl: string, ctx: any): string {
    return String(tpl).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, p1) => {
      const v = this.getByPath(ctx, String(p1).trim());
      return v == null ? '' : String(v);
    });
  }

  private getByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return String(path)
      .split('.')
      .reduce(
        (acc: any, key: string) => (acc != null ? acc[key] : undefined),
        obj,
      );
  }
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('dry-run timeout')),
        Math.max(1, ms),
      );
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e instanceof Error ? e : new Error(String(e)));
        },
      );
    });
  }
}
