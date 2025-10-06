import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import {
  GenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
} from '@llm/services/llm-interfaces';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { PromptPayload } from './agent-runtime-prompt.service';
import { TaskRequestDto, AgentTaskMode } from '@agent2agent/dto/task-request.dto';
import { AgentRuntimeMetricsService } from './agent-runtime-metrics.service';

export interface AgentRuntimeDispatchOptions {
  definition: AgentRuntimeDefinition;
  routingDecision: RoutingDecision;
  prompt: PromptPayload;
  request: TaskRequestDto;
  stream?: boolean;
  onStreamChunk?: (chunk: AgentRuntimeStreamChunk) => void;
  overrides?: {
    config?: Partial<LLMServiceConfig>;
    options?: Partial<GenerateResponseParams['options']>;
  };
}

export interface AgentRuntimeStreamChunk {
  type: 'partial' | 'final';
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentRuntimeDispatchResult {
  response: LLMResponse;
  config: LLMServiceConfig;
  params: GenerateResponseParams;
  routingDecision: RoutingDecision;
}

export interface AgentRuntimeStreamingResult {
  response: Promise<AgentRuntimeDispatchResult>;
  stream: AsyncIterable<AgentRuntimeStreamChunk>;
  cancel: () => void;
}

interface StreamController {
  push: (chunk: AgentRuntimeStreamChunk) => void;
  close: () => void;
  error: (error: any) => void;
  iterator: AsyncIterable<AgentRuntimeStreamChunk>;
}

@Injectable()
export class AgentRuntimeDispatchService {
  private readonly logger = new Logger(AgentRuntimeDispatchService.name);
  constructor(
    private readonly llmFactory: LLMServiceFactory,
    private readonly http: HttpService,
    private readonly metrics: AgentRuntimeMetricsService,
  ) {}

  async dispatch(
    options: AgentRuntimeDispatchOptions,
  ): Promise<AgentRuntimeDispatchResult> {
    const transport = options.definition.transport?.kind;
    if (transport === 'api') {
      return this.dispatchApi(options);
    }
    if (transport === 'external') {
      return this.dispatchExternal(options);
    }

    const config = this.buildConfig(
      options.definition,
      options.routingDecision,
      options.overrides?.config,
    );

    const params = this.buildParams(options, config);

    const response = await this.llmFactory.generateResponse(config, params);

    if (options.onStreamChunk) {
      options.onStreamChunk({
        type: 'final',
        content: response.content,
        metadata: response.metadata,
      });
    }

    return {
      response,
      config,
      params,
      routingDecision: options.routingDecision,
    };
  }

  dispatchStream(options: AgentRuntimeDispatchOptions): AgentRuntimeStreamingResult {
    const controller = this.createStreamController();
    const transport = options.definition.transport?.kind;
    if (transport === 'api' || transport === 'external') {
      // Best-effort streaming: perform single request and push as one chunk
      const responsePromise = this.dispatch(options)
        .then((result) => {
          controller.push({
            type: 'final',
            content: result.response.content,
            metadata: result.response.metadata,
          });
          controller.close();
          return result;
        })
        .catch((error) => {
          controller.error(error);
          throw error;
        });

      return {
        response: responsePromise,
        stream: controller.iterator,
        cancel: () => controller.close(),
      };
    }
    const mergedOptions: AgentRuntimeDispatchOptions = {
      ...options,
      stream: true,
      overrides: {
        ...(options.overrides ?? {}),
        options: {
          ...(options.overrides?.options ?? {}),
          stream: true,
        },
      },
      onStreamChunk: (chunk) => {
        options.onStreamChunk?.(chunk);
        controller.push(chunk);
      },
    };

    const responsePromise = this.dispatch(mergedOptions)
      .then((result) => {
        controller.close();
        return result;
      })
      .catch((error) => {
        controller.error(error);
        throw error;
      });

    return {
      response: responsePromise,
      stream: controller.iterator,
      cancel: () => controller.close(),
    };
  }

  private buildConfig(
    definition: AgentRuntimeDefinition,
    decision: RoutingDecision,
    overrides: Partial<LLMServiceConfig> | undefined,
  ): LLMServiceConfig {
    const decisionExtras = decision as Record<string, any>;

    return {
      provider: decision.provider ?? definition.llm?.provider ?? 'openai',
      model: decision.model ?? definition.llm?.model ?? 'gpt-4o-mini',
      temperature:
        overrides?.temperature ??
        (decisionExtras.temperature as number | undefined) ??
        definition.llm?.temperature,
      maxTokens:
        overrides?.maxTokens ??
        (decisionExtras.maxTokens as number | undefined) ??
        definition.llm?.maxTokens,
      apiKey: overrides?.apiKey ?? (decisionExtras.apiKey as string | undefined),
      baseUrl:
        overrides?.baseUrl ?? (decisionExtras.baseUrl as string | undefined),
      timeout:
        overrides?.timeout ?? (decisionExtras.timeout as number | undefined),
    };
  }

  private buildParams(
    options: AgentRuntimeDispatchOptions,
    config: LLMServiceConfig,
  ): GenerateResponseParams {
    const { request, prompt, routingDecision, overrides } = options;
    const payload = request.payload ?? {};
    const rawOptions = { ...(payload.options ?? {}) };
    const { metadata: _ignoredMetadata, stream, ...restOptions } = rawOptions;

    const overrideOptions = overrides?.options ?? {};

    const finalOptions: NonNullable<GenerateResponseParams['options']> = {
      callerType: 'agent',
      callerName: options.definition.displayName ?? options.definition.slug,
      temperature: config.temperature,
      piiMetadata: routingDecision.piiMetadata,
      routingDecision,
      preferLocal: routingDecision.isLocal,
      organizationSlug: options.definition.organizationSlug ?? null,
      agentSlug: options.definition.slug,
      maxComplexity:
        overrideOptions.maxComplexity ??
        prompt.metadata?.maxComplexity ??
        undefined,
      ...restOptions,
      ...overrideOptions,
      stream: overrideOptions.stream ?? options.stream ?? stream ?? false,
      metadata: {
        ...prompt.optionMetadata,
      },
    };

    return {
      systemPrompt: prompt.systemPrompt,
      userMessage: prompt.userMessage,
      config,
      conversationId: prompt.conversationId,
      sessionId: prompt.sessionId,
      userId: prompt.userId ?? undefined,
      options: finalOptions,
    };
  }

  private createStreamController(): StreamController {
    const queue: AgentRuntimeStreamChunk[] = [];
    const pending: Array<{
      resolve: (value: IteratorResult<AgentRuntimeStreamChunk>) => void;
      reject: (error: any) => void;
    }> = [];
    let closed = false;
    let error: any = null;

    const flush = () => {
      while (queue.length && pending.length) {
        const chunk = queue.shift()!;
        const { resolve } = pending.shift()!;
        resolve({ value: chunk, done: false });
      }

      if (error) {
        while (pending.length) {
          const { reject } = pending.shift()!;
          reject(error);
        }
        return;
      }

      if (closed) {
        while (pending.length) {
          const { resolve } = pending.shift()!;
          resolve({ value: undefined as any, done: true });
        }
      }
    };

    const iterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next(): Promise<IteratorResult<AgentRuntimeStreamChunk>> {
        if (error) {
          return Promise.reject(error);
        }
        if (queue.length) {
          const chunk = queue.shift()!;
          return Promise.resolve({ value: chunk, done: false });
        }
        if (closed) {
          return Promise.resolve({ value: undefined as any, done: true });
        }
        return new Promise((resolve, reject) => {
          pending.push({ resolve, reject });
        });
      },
    } as AsyncIterable<AgentRuntimeStreamChunk> & {
      next: () => Promise<IteratorResult<AgentRuntimeStreamChunk>>;
    };

    return {
      iterator,
      push: (chunk) => {
        if (closed || error) {
          return;
        }
        queue.push(chunk);
        flush();
      },
      close: () => {
        if (closed || error) {
          return;
        }
        closed = true;
        flush();
      },
      error: (err) => {
        if (closed || error) {
          return;
        }
        error = err;
        flush();
      },
    };
  }

  private async dispatchApi(
    options: AgentRuntimeDispatchOptions,
  ): Promise<AgentRuntimeDispatchResult> {
    const api = options.definition.transport!.api!;
    const method = (api.method || 'POST').toUpperCase();
    const url = api.endpoint;

    const mergedHeaders: Record<string, any> = {
      'content-type': 'application/json',
      ...(api.headers ?? {}),
      ...((options.request.payload?.options?.headers as Record<string, any>) || {}),
    };
    const headers = this.sanitizeForwardHeaders(mergedHeaders);

    const body = this.buildApiRequestBody(api, options);

    const start = Date.now();
    const defaultTimeout = this.resolveDefaultTimeout('api');
    let res;
    try {
      res = await this.performWithRetry(() =>
        this.http.axiosRef.request({
          url,
          method: method as any,
          headers,
          timeout: api.timeout ?? defaultTimeout,
          data: body,
          validateStatus: () => true,
        })
      );
    } catch (err: any) {
      const end = Date.now();
      const status = err?.response?.status ?? -1;
      this.safeLog('api', url, status, end - start);
      this.metrics.record('api', options.definition.slug, false, end - start, status);
      throw err;
    }

    const end = Date.now();
    // Normalize content (apply response transform if configured)
    const content = this.extractApiResponseContent(api, res.data);
    const isOk = res.status >= 200 && res.status < 300;
    const response = {
      content,
      metadata: {
        provider: 'external_api',
        model: 'api_endpoint',
        requestId: res.headers['x-request-id'] || '',
        timestamp: new Date(end).toISOString(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        timing: { startTime: start, endTime: end, duration: end - start },
        tier: 'external',
        status: isOk ? 'completed' : 'error',
        providerSpecific: { status: res.status },
        ...(isOk
          ? {}
          : { errorMessage: this.buildHttpErrorMessage(res.status, res.data) }),
      },
    } as const;

    // Observability: log sanitized outcome
    this.safeLog('api', url, res.status, end - start);
    this.metrics.record('api', options.definition.slug, isOk, end - start, res.status);

    if (options.onStreamChunk) {
      options.onStreamChunk({ type: 'final', content: response.content, metadata: response.metadata });
    }

    return {
      response,
      config: {
        provider: 'external_api',
        model: 'api_endpoint',
        timeout: api.timeout ?? 30_000,
        baseUrl: url,
      },
      params: {
        systemPrompt: options.prompt.systemPrompt,
        userMessage: options.prompt.userMessage,
        config: { provider: 'external_api', model: 'api_endpoint' },
      },
      routingDecision: options.routingDecision,
    };
  }

  private async dispatchExternal(
    options: AgentRuntimeDispatchOptions,
  ): Promise<AgentRuntimeDispatchResult> {
    const external = options.definition.transport!.external!;
    const url = external.endpoint;

    const mergedHeaders: Record<string, any> = {
      'content-type': 'application/json',
      ...(external.authentication?.headers ?? {}),
      ...((options.request.payload?.options?.headers as Record<string, any>) || {}),
    };
    const headers = this.sanitizeForwardHeaders(mergedHeaders);

    const methodName = this.mapModeToMethod(options.request.mode!);
    const id = Date.now();
    const params = {
      conversationId: options.request.conversationId,
      sessionId: options.request.sessionId,
      userMessage: options.prompt.userMessage,
      messages: options.request.messages ?? [],
      metadata: options.prompt.metadata,
      payload: options.request.payload ?? {},
      options: options.request.payload?.options ?? {},
    };

    const body = {
      jsonrpc: '2.0',
      id,
      method: methodName,
      params,
    };

    const start = Date.now();
    const defaultTimeout = this.resolveDefaultTimeout('external');
    let res;
    try {
      res = await this.performWithRetry(() =>
        this.http.axiosRef.post(url, body, {
          headers,
          timeout: external.timeout ?? defaultTimeout,
          validateStatus: () => true,
        })
      );
    } catch (err: any) {
      const end = Date.now();
      const status = err?.response?.status ?? -1;
      this.safeLog('external', url, status, end - start);
      this.metrics.record('external', options.definition.slug, false, end - start, status);
      throw err;
    }
    const end = Date.now();

    const hasRpcError = res.data && typeof res.data === 'object' && 'error' in res.data && res.data.error;
    const envelope = hasRpcError
      ? res.data.error
      : res.data && res.data.result
        ? res.data.result
        : res.data;
    const content = this.stringifyContent(envelope);

    const isOk = res.status >= 200 && res.status < 300 && !hasRpcError;
    const response = {
      content,
      metadata: {
        provider: 'external_a2a',
        model: 'a2a',
        requestId: res.headers['x-request-id'] || String(id),
        timestamp: new Date(end).toISOString(),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        timing: { startTime: start, endTime: end, duration: end - start },
        tier: 'external',
        status: isOk ? 'completed' : 'error',
        providerSpecific: { status: res.status },
        ...(isOk
          ? {}
          : { errorMessage: this.buildRpcErrorMessage(res.data?.error, res.status) }),
      },
    } as const;

    // Observability: log sanitized outcome
    this.safeLog('external', url, res.status, end - start);
    this.metrics.record('external', options.definition.slug, isOk, end - start, res.status);

    if (options.onStreamChunk) {
      options.onStreamChunk({ type: 'final', content: response.content, metadata: response.metadata });
    }

    return {
      response,
      config: { provider: 'external_a2a', model: 'a2a', timeout: external.timeout ?? 30_000, baseUrl: url },
      params: {
        systemPrompt: options.prompt.systemPrompt,
        userMessage: options.prompt.userMessage,
        config: { provider: 'external_a2a', model: 'a2a' },
      },
      routingDecision: options.routingDecision,
    };
  }

  private mapModeToMethod(mode: AgentTaskMode): string {
    switch (mode) {
      case AgentTaskMode.PLAN:
        return 'plan';
      case AgentTaskMode.BUILD:
        return 'build';
      default:
        return 'converse';
    }
  }

  private stringifyContent(value: any): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      if (typeof value.message === 'string' && value.message.trim()) {
        return value.message;
      }
      if (typeof value.response === 'string' && value.response.trim()) {
        return value.response;
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private sanitizeForwardHeaders(source: Record<string, any>): Record<string, any> {
    const allow = this.resolveHeaderAllowlist();
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(source)) {
      const key = String(k).toLowerCase();
      if (!allow.has(key)) continue;
      if (v === undefined || v === null) continue;
      out[key] = v;
    }
    return out;
  }

  private resolveHeaderAllowlist(): Set<string> {
    const base = [
      'authorization',
      'x-user-key',
      'x-api-key',
      'x-agent-api-key',
      'content-type',
    ];
    const extra = (process.env.AGENT_EXTERNAL_HEADER_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return new Set([...base, ...extra]);
  }

  private resolveDefaultTimeout(kind: 'api' | 'external'): number {
    const raw =
      kind === 'api'
        ? process.env.AGENT_API_DEFAULT_TIMEOUT_MS
        : process.env.AGENT_EXTERNAL_DEFAULT_TIMEOUT_MS;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 30_000;
  }

  private async performWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let attempt = 0;
    let lastError: any;
    while (attempt <= retries) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        // Axios/network errors: retry on ECONNRESET/ETIMEDOUT/5xx indicated by response
        const status = err?.response?.status as number | undefined;
        const retriable = status ? status >= 500 : true;
        if (attempt === retries || !retriable) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
        attempt++;
      }
    }
    throw lastError;
  }

  private buildHttpErrorMessage(status: number, data: any): string {
    const base = `HTTP ${status}`;
    if (!data) return base;
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      const redacted = this.redactString(text);
      const snippet = redacted.length > 160 ? redacted.slice(0, 160) + '…' : redacted;
      return `${base}: ${snippet}`;
    } catch {
      return base;
    }
  }

  private buildRpcErrorMessage(error: any, status?: number): string {
    const statusText = status ? ` (HTTP ${status})` : '';
    if (!error) return `External A2A error${statusText}`;
    const code = error.code !== undefined ? ` [code ${error.code}]` : '';
    const raw = typeof error.message === 'string' ? error.message : this.stringifyContent(error);
    const msg = this.redactString(raw);
    const snippet = msg.length > 160 ? msg.slice(0, 160) + '…' : msg;
    return `External A2A error${statusText}${code}: ${snippet}`;
  }

  private safeLog(kind: 'api' | 'external', url: string, status: number, durationMs: number) {
    try {
      const target = new URL(url);
      const host = target.host;
      const path = target.pathname;
      const msg = `${kind.toUpperCase()} ${status} ${host}${path} in ${durationMs}ms`;
      if (status >= 200 && status < 300) {
        this.logger.debug(msg);
      } else if (status >= 500) {
        this.logger.error(msg);
      } else {
        this.logger.warn(msg);
      }
    } catch {
      // ignore logging errors
    }
  }

  private redactString(input: string): string {
    // Mask common secret patterns and headers
    let s = input;
    const patterns: Array<[RegExp, string]> = [
      // API keys (generic sk-..., bearer tokens, UUID-like secrets)
      [/sk-[A-Za-z0-9-_]{10,}/g, 'sk-REDACTED'],
      [/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer REDACTED'],
      [/api[-_]?key\s*[:=]\s*[^\s"']+/gi, 'api_key=REDACTED'],
      [/x-?api-?key\s*[:=]\s*[^\s"']+/gi, 'x-api-key=REDACTED'],
      [/authorization\s*[:=]\s*[^\s"']+/gi, 'authorization=REDACTED'],
      // JSON fields
      [/("authorization"\s*:\s*")[^"]+(")/gi, '"authorization":"REDACTED"'],
      [/("x-?api-?key"\s*:\s*")[^"]+(")/gi, '"x-api-key":"REDACTED"'],
      [/("api[-_]?key"\s*:\s*")[^"]+(")/gi, '"apiKey":"REDACTED"'],
      [/("token"\s*:\s*")[^"]+(")/gi, '"token":"REDACTED"'],
    ];
    for (const [re, repl] of patterns) {
      s = s.replace(re, repl);
    }
    return s;
  }

  private buildApiRequestBody(
    api: NonNullable<AgentRuntimeDefinition['transport']>['api'],
    options: AgentRuntimeDispatchOptions,
  ): any {
    const t = api?.requestTransform;
    const sessionId = options.request.sessionId ?? options.request.conversationId ?? null;
    const userMessage = options.prompt.userMessage ?? '';
    const conversationId = options.request.conversationId ?? null;
    const agentSlug = options.definition.slug;
    const organizationSlug = options.definition.organizationSlug ?? null;

    if (t && t.format === 'custom' && typeof t.template === 'string') {
      try {
        const rendered = t.template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
          switch (String(key)) {
            case 'userMessage':
            case 'prompt':
              return userMessage;
            case 'sessionId':
              return String(sessionId ?? '');
            case 'conversationId':
              return String(conversationId ?? '');
            case 'agentSlug':
              return String(agentSlug ?? '');
            case 'organizationSlug':
              return String(organizationSlug ?? '');
            default:
              return '';
          }
        });
        // If the template is JSON-like, parse it; otherwise send as string
        const maybeJson = rendered.trim();
        if ((maybeJson.startsWith('{') && maybeJson.endsWith('}')) || (maybeJson.startsWith('[') && maybeJson.endsWith(']'))) {
          return JSON.parse(maybeJson);
        }
        return rendered;
      } catch {
        // Fall through to minimal body
      }
    }

    // Minimal default body expected by n8n: send only prompt
    return { prompt: userMessage };
  }

  private extractApiResponseContent(
    api: NonNullable<AgentRuntimeDefinition['transport']>['api'],
    data: any,
  ): string {
    const rt = api?.responseTransform;
    if (rt && rt.format === 'field_extraction' && rt.field) {
      try {
        // Support dotted/bracket paths like "a.b[0].c"
        const tryExtract = (obj: any, path: string): any => {
          if (!obj || typeof obj !== 'object') return undefined;
          // direct field hit
          if (Object.prototype.hasOwnProperty.call(obj, path)) {
            return obj[path];
          }
          // dotted/bracket notation
          const parts: Array<string|number> = [];
          const re = /([^\.\[\]]+)|(\[(\d+)\])/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(path))) {
            if (m[1]) parts.push(m[1]);
            else if (m[3]) parts.push(parseInt(m[3], 10));
          }
          let cur: any = obj;
          for (const p of parts) {
            if (cur == null) return undefined;
            cur = typeof p === 'number' ? cur[p] : cur[p];
          }
          return cur;
        };

        const fromRoot = tryExtract(data, rt.field);
        if (fromRoot !== undefined) {
          return typeof fromRoot === 'string' ? fromRoot : this.stringifyContent(fromRoot);
        }
        if (data && typeof data === 'object' && data.result) {
          const fromResult = tryExtract(data.result, rt.field);
          if (fromResult !== undefined) {
            return typeof fromResult === 'string' ? fromResult : this.stringifyContent(fromResult);
          }
        }
      } catch {
        // fallthrough to generic stringify
      }
    }
    return this.stringifyContent(data);
  }
}
