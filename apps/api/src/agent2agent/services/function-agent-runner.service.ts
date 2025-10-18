import { Injectable } from '@nestjs/common';
import * as vm from 'vm';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { BaseAgentRunner } from './base-agent-runner.service';
import { DeliverablesService } from '@/agent2agent/deliverables/deliverables.service';
import {
  DeliverableFormat,
  DeliverableType,
  DeliverableVersionCreationType,
} from '@/agent2agent/deliverables/dto';
import { AssetsService } from '@/assets/assets.service';
import { LLMService } from '@llm/llm.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';

/**
 * Function Agent Runner
 *
 * Executes JavaScript function code in a sandboxed VM environment.
 * Function agents only support BUILD mode and must be fully self-contained.
 *
 * Configuration:
 * - function_code: JavaScript code with a 'handler' function export
 * - config.function.timeout_ms: Execution timeout (default: 20000ms)
 *
 * The handler function receives:
 * - input: { prompt, ...payload } - User input
 * - ctx: provides infrastructure helpers (deliverables, assets, env access)
 */
@Injectable()
export class FunctionAgentRunnerService extends BaseAgentRunner {
  private readonly allowedModules = ['axios', 'crypto', 'url'];

  constructor(
    deliverablesService: DeliverablesService,
    private readonly assetsService: AssetsService,
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
    );
  }

  /**
   * Function agents only support BUILD mode
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      request.mode!,
      'Function agents only support BUILD mode',
    );
  }

  /**
   * Function agents only support BUILD mode
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      request.mode!,
      'Function agents only support BUILD mode',
    );
  }

  /**
   * Execute function agent code in sandboxed VM
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const code = this.resolveFunctionCode(definition);

      if (!code || typeof code !== 'string' || !code.trim()) {
        throw new Error(
          'function_code is required but missing from agent record',
        );
      }

      const fnConfig =
        (definition.config as any)?.configuration?.function ||
        (definition.config as any)?.function ||
        {};

      const prompt =
        request.userMessage ||
        (request.payload as any)?.prompt ||
        'Function agent execution';
      const input = { prompt, ...(request.payload || {}) } as Record<
        string,
        any
      >;
      const userId =
        (request.metadata as any)?.userId ||
        (request.payload as any)?.metadata?.userId ||
        process.env.SYSTEM_USER_ID ||
        null;
      const conversationId = request.conversationId || null;
      const taskId = (request.payload as any)?.taskId || null;

      const allowedModules = new Set(this.allowedModules);
      const sandboxRequire = (moduleName: string) => {
        if (!allowedModules.has(moduleName)) {
          throw new Error(
            `Module '${moduleName}' is not allowed in function sandbox`,
          );
        }

        return require(moduleName);
      };

      const sandbox: vm.Context = vm.createContext({
        console: {
          log: (...a: any[]) => this.logger.log(a.join(' ')),
          warn: (...a: any[]) => this.logger.warn(a.join(' ')),
          error: (...a: any[]) => this.logger.error(a.join(' ')),
        },
        Buffer,
        setTimeout,
        clearTimeout,
      });

      const script = new vm.Script(`"use strict";\n${code}\n;handler;`);
      const exported = script.runInContext(sandbox, { timeout: 1000 });
      if (typeof exported !== 'function') {
        return TaskResponseDto.failure(
          request.mode!,
          'function_handler_not_found',
        );
      }

      const timeoutMs = Number(fnConfig.timeout_ms || 20000);
      const ctx = this.buildExecutionContext({
        sandboxRequire,
        organizationSlug,
        conversationId,
        userId,
        agentSlug: definition.slug,
        config: definition.config,
        taskId,
      });

      const execPromise = Promise.resolve(exported(input, ctx));
      const timer = new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('function_timeout')), timeoutMs),
      );
      const result: any = await Promise.race([execPromise, timer]);

      const payload = this.normalizeResultPayload(result);
      return TaskResponseDto.success(request.mode!, payload);
    } catch (error) {
      this.logger.warn(`Function agent execution failed: ${String(error)}`);
      return TaskResponseDto.failure(
        request.mode!,
        error instanceof Error ? error.message : 'function_execution_failed',
      );
    }
  }

  private resolveFunctionCode(
    definition: AgentRuntimeDefinition,
  ): string | null {
    const recordCode = (definition as any)?.record?.function_code;
    if (typeof recordCode === 'string' && recordCode.trim().length > 0) {
      return recordCode;
    }

    const configCode =
      (definition.config as any)?.configuration?.function?.code ||
      (definition.config as any)?.function?.code;
    if (typeof configCode === 'string' && configCode.trim().length > 0) {
      return configCode;
    }

    return null;
  }

  private buildExecutionContext(params: {
    sandboxRequire: (moduleName: string) => any;
    organizationSlug: string | null;
    conversationId: string | null;
    userId: string | null;
    agentSlug: string;
    config: any;
    taskId: string | null;
  }) {
    const {
      sandboxRequire,
      organizationSlug,
      conversationId,
      userId,
      agentSlug,
      config,
      taskId,
    } = params;

    const allowedEnvKeys = [
      'OPENAI_API_KEY',
      'OPENAI_API_BASE',
      'OPENAI_ORG_ID',
      'GOOGLE_ACCESS_TOKEN',
      'GOOGLE_PROJECT_ID',
      'GOOGLE_REGION',
      'GOOGLE_API_KEY',
      'ANTHROPIC_API_KEY',
      'STABILITY_API_KEY',
      'REPLICATE_API_TOKEN',
    ];

    const filteredEnv = Object.fromEntries(
      allowedEnvKeys
        .filter((key) => process.env[key])
        .map((key) => [key, process.env[key] as string]),
    );

    return {
      require: sandboxRequire,
      process: {
        env: filteredEnv,
      },
      deliverables: {
        create: async (args: {
          title: string;
          content: string;
          format: string;
          type: string;
          attachments?: Record<string, any>;
          metadata?: Record<string, any>;
        }) => {
          if (!userId) {
            throw new Error('userId is required to create deliverables');
          }
          if (!conversationId) {
            throw new Error(
              'conversationId is required to create deliverables',
            );
          }

          return this.deliverablesService.create(
            {
              title: args.title,
              conversationId,
              agentName: agentSlug,
              type: args.type as DeliverableType,
              initialContent: args.content,
              initialFormat:
                (args.format as DeliverableFormat) ||
                DeliverableFormat.MARKDOWN,
              initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
              initialTaskId: taskId || undefined,
              initialMetadata: args.metadata || {},
              initialFileAttachments: args.attachments || {},
            },
            userId,
          );
        },
      },
      assets: {
        saveBuffer: async (args: {
          buffer: Buffer;
          mime: string;
          filename?: string;
          subpath?: string;
        }) => {
          if (!args || !(args.buffer instanceof Buffer)) {
            throw new Error('buffer must be a Buffer instance');
          }

          return this.assetsService.saveBuffer({
            organizationSlug,
            conversationId,
            userId,
            buffer: args.buffer,
            mime: args.mime,
            filename: args.filename,
            subpath: args.subpath || 'generated',
          });
        },
      },
      organizationSlug,
      conversationId,
      userId,
      agent: { slug: agentSlug },
      config,
      taskId,
    };
  }

  private normalizeResultPayload(result: any): {
    content: any;
    metadata: Record<string, any>;
    deliverables?: Array<{
      id: string;
      versionId?: string | null;
      title?: string;
    }>;
  } {
    if (result === null || result === undefined) {
      return {
        content: { status: 'completed' },
        metadata: {},
      };
    }

    let content =
      typeof result === 'object' && result !== null ? { ...result } : result;
    const deliverable =
      typeof result === 'object' && result
        ? (result.deliverable as
            | {
                id: string;
                title?: string;
                currentVersion?: { id?: string | null };
              }
            | undefined)
        : undefined;

    const metadata =
      typeof result === 'object' && result.metadata
        ? { ...(result.metadata as Record<string, any>) }
        : {};

    if (typeof content === 'object' && content) {
      delete content.deliverable;
      delete content.version;
      delete content.metadata;
    }

    if (
      typeof result === 'object' &&
      result &&
      'images' in result &&
      metadata.images === undefined
    ) {
      metadata.images = result.images;
    }

    if (
      typeof content === 'object' &&
      content &&
      Object.keys(content).length === 0
    ) {
      content = { status: 'completed' };
    }

    const payload: {
      content: any;
      metadata: Record<string, any>;
      deliverables?: Array<{
        id: string;
        versionId?: string | null;
        title?: string;
      }>;
    } = {
      content,
      metadata,
    };

    if (deliverable && deliverable.id) {
      payload.deliverables = [
        {
          id: deliverable.id,
          title: deliverable.title,
          versionId: deliverable.currentVersion?.id ?? null,
        },
      ];
    }

    return payload;
  }
}
