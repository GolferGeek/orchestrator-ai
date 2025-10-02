import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { ImageAgentsService } from '@/image-agents/image-agents.service';

@Injectable()
export class FunctionAgentRunnerService {
  private readonly logger = new Logger(FunctionAgentRunnerService.name);

  constructor(private readonly images: ImageAgentsService) {}

  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const fnConfig = (definition.config as any)?.configuration?.function || (definition.config as any)?.function;
      if (!fnConfig || typeof fnConfig.code !== 'string' || !fnConfig.code.trim()) {
        return TaskResponseDto.failure(request.mode, 'function_code_missing');
      }

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
            const providers = Array.isArray(args.providers) && args.providers.length ? args.providers : [args.provider || (request.payload as any)?.provider || (request.payload as any)?.providers?.[0] || 'openai'];
            let last: any = null;
            for (const p of providers) {
              last = await this.images.generateImage({
                prompt: args.prompt,
                conversationId,
                userId,
                organizationSlug,
                size: (args.size as any) || '512x512',
                n: args.n || (request.payload as any)?.n || 1,
                title: args.title || undefined,
                provider: p as any,
                deliverableId: (args.deliverableId as any) || (request.payload as any)?.deliverableId || null,
              });
            }
            return last;
          },
        },
      };

      const sandbox: any = { console: { log: (...a: any[]) => this.logger.log(a.join(' ')) } };
      vm.createContext(sandbox);
      const script = new vm.Script(`"use strict";\n${fnConfig.code}\n;handler;`);
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
