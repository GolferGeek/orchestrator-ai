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
    const consoleStub: any = {
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
      module: { exports: undefined as any },
      exports: {},
      console: consoleStub,
      require: undefined,
      process: undefined,
      global: {},
      Buffer: undefined,
    });

    try {
      const script = new vm.Script(String(code));
      script.runInContext(context, { timeout: Math.min(timeoutMs, 1000) });
      const handler = context.module.exports || context.exports;
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
      const result = await timed;
      return { ok: true, result, logs };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'dry-run error', logs };
    }
  }

  async runApiTransform(
    apiConfig: any,
    input: any = {},
    mockResponse?: any,
  ): Promise<{
    ok: boolean;
    request?: { format?: string; body?: string };
    response?: { format?: string; extracted?: any };
    error?: string;
  }> {
    try {
      const reqT = apiConfig?.request_transform || apiConfig?.requestTransform;
      const resT =
        apiConfig?.response_transform || apiConfig?.responseTransform;

      let body: string | undefined;
      if (reqT?.format === 'custom' && typeof reqT?.template === 'string') {
        body = this.renderTemplate(reqT.template, input);
      } else if (typeof reqT === 'object') {
        // Best-effort stringify
        body = JSON.stringify(reqT);
      }

      let extracted: any = undefined;
      if (
        resT?.format === 'field_extraction' &&
        typeof resT?.field === 'string'
      ) {
        const src = mockResponse ?? {};
        extracted = this.getByPath(src, resT.field);
      }

      return {
        ok: true,
        request: { format: reqT?.format, body },
        response: { format: resT?.format, extracted },
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'api dry-run error' };
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
