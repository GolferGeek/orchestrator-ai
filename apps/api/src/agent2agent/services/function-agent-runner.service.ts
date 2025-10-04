import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as vm from 'vm';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
// ImageAgentsService archived - image functionality to be implemented via agent-platform
import { AgentBuilderService } from '@agent-platform/services/agent-builder.service';

@Injectable()
export class FunctionAgentRunnerService {
  private readonly logger = new Logger(FunctionAgentRunnerService.name);

  constructor(
    @Inject(forwardRef(() => AgentBuilderService))
    private readonly agentBuilder: AgentBuilderService,
  ) {}

  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      // Function code must be in function_code column
      const code = (definition as any).function_code;

      if (!code || typeof code !== 'string' || !code.trim()) {
        throw new Error('function_code is required but missing from agent record');
      }

      // Get timeout from config
      const fnConfig = (definition.config as any)?.configuration?.function || (definition.config as any)?.function || {};

      const prompt = request.userMessage || (request.payload as any)?.prompt || 'Generate image';
      const input = { prompt, ...(request.payload || {}) } as Record<string, any>;
      const userId = (request.metadata as any)?.userId || (request.payload as any)?.metadata?.userId || process.env.SYSTEM_USER_ID || null;
      const conversationId = request.conversationId || null;

      // Build ctx.services
      const services = {
        images: {
          generate: async (args: { prompt: string; size?: string; n?: number; title?: string; provider?: string; providers?: string[]; deliverableId?: string }) => {
            if (!conversationId || !userId) {
              throw new Error('conversationId and userId are required for image generation');
            }
            // Image generation archived - to be reimplemented via agent-platform
            throw new Error('Image generation functionality has been archived and will be reimplemented via agent-platform');
          },
        },
        agentBuilder: this.agentBuilder.getContext(),
      };

      const sandbox: any = { console: { log: (...a: any[]) => this.logger.log(a.join(' ')) } };
      vm.createContext(sandbox);
      const script = new vm.Script(`"use strict";\n${code}\n;handler;`);
      const exported = script.runInContext(sandbox, { timeout: 1000 });
      if (typeof exported !== 'function') {
        return TaskResponseDto.failure(request.mode, 'function_handler_not_found');
      }

      const timeoutMs = Number(fnConfig.timeout_ms || 20000);
      const ctx = { services, organizationSlug, conversationId, userId, agent: { slug: definition.slug }, config: definition.config };
      const execPromise = Promise.resolve(exported(input, ctx));
      const timer = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('function_timeout')), timeoutMs));
      const result: any = await Promise.race([execPromise, timer]);

      // Normalize result
      // If images generated via services.images.generate, result contains deliverable/version
      if (result && result.deliverable && result.version) {
        const payload: any = {
          content: { status: 'build_completed', output: 'Images generated' },
          metadata: { provider: (result.version?.metadata as any)?.provider || 'image_service' },
          deliverables: [{ id: result.deliverable.id, versionId: result.version.id, title: result.deliverable.title }],
        };
        return TaskResponseDto.success(request.mode, payload);
      }

      // If returned a generic object with images/content
      return TaskResponseDto.success(request.mode, {
        content: result || { status: 'completed' },
      });
    } catch (error) {
      this.logger.warn(`Function agent execution failed: ${String(error)}`);
      return TaskResponseDto.failure(request.mode, 'function_execution_failed');
    }
  }
}
