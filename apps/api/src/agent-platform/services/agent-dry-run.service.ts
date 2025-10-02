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
  async runFunction(code: string, input: any = {}, timeoutMs = 2000): Promise<DryRunResult> {
    const logs: string[] = [];
    const consoleStub: any = {
      log: (...args: any[]) => logs.push(args.map(String).join(' ')),
      warn: (...args: any[]) => logs.push('[warn] ' + args.map(String).join(' ')),
      error: (...args: any[]) => logs.push('[error] ' + args.map(String).join(' ')),
      info: (...args: any[]) => logs.push('[info] ' + args.map(String).join(' ')),
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
      const handler = (context.module as any).exports || context.exports;
      if (typeof handler !== 'function') {
        return { ok: false, error: 'Function code must export a handler (module.exports = async (input, ctx) => { ... })', logs };
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

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('dry-run timeout')), Math.max(1, ms));
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }
}
