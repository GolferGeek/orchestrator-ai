import { Injectable } from '@nestjs/common';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import {
  GenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
} from '@llm/services/llm-interfaces';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { PromptPayload } from './agent-runtime-prompt.service';
import { TaskRequestDto } from '@agent2agent/dto/task-request.dto';

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
  constructor(private readonly llmFactory: LLMServiceFactory) {}

  async dispatch(
    options: AgentRuntimeDispatchOptions,
  ): Promise<AgentRuntimeDispatchResult> {
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
}
