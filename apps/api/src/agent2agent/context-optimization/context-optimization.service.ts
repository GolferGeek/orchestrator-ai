import { Injectable, Logger } from '@nestjs/common';
import { AgentConversationsService } from '../conversations/agent-conversations.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContextOptimizationService {
  private readonly logger = new Logger(ContextOptimizationService.name);

  constructor(
    private readonly agentConversationsService: AgentConversationsService,
    private readonly deliverablesService: DeliverablesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async optimizeContext(request: {
    fullHistory: ConversationMessage[];
    conversationId?: string;
    workProductType?: 'project' | 'deliverable';
    workProductId?: string;
    tokenBudget: number;
  }): Promise<ConversationMessage[]> {
    const { fullHistory, tokenBudget } = request;

    const start = Date.now();

    // Fast-path: under 80% of budget → pass through
    const totalTokens = this.calculateTokens(fullHistory);
    if (totalTokens <= tokenBudget * 0.8) {
      return fullHistory;
    }

    // Layered optimization
    const optimized = await this.performLayeredOptimization(request);
    const duration = Date.now() - start;

    // Emit metrics
    try {
      this.eventEmitter.emit('context_optimization.metrics', {
        originalCount: fullHistory.length,
        optimizedCount: optimized.length,
        processingTimeMs: duration,
        workProductType: request.workProductType,
      });
    } catch (error) {
      this.logger.warn('Failed to emit context optimization metrics', error);
    }
    return optimized;
  }

  private async performLayeredOptimization(request: {
    fullHistory: ConversationMessage[];
    workProductType?: 'project' | 'deliverable';
    workProductId?: string;
    tokenBudget: number;
  }): Promise<ConversationMessage[]> {
    const essentialContext: unknown = await this.extractWorkProductContext(
      request.workProductType,
      request.workProductId,
    );

    const scored = this.scoreMessageRelevance(
      request.fullHistory,
      essentialContext,
    );

    return this.selectOptimalWindow(scored, request.tokenBudget);
  }

  private async extractWorkProductContext(
    type?: 'project' | 'deliverable',
    id?: string,
  ): Promise<unknown> {
    if (!type || !id) return null;

    try {
      if (type === 'deliverable') {
        // Read-only context; implement as needed (userId required in real impl)
        return await this.deliverablesService.findOne(
          id,
          '00000000-0000-0000-0000-000000000000',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to load ${type ?? 'unknown'} context for ${id ?? 'unknown id'}`,
        error,
      );
    }
    return null;
  }

  private scoreMessageRelevance(
    messages: ConversationMessage[],
    essentialContext: unknown,
  ): Array<{ message: ConversationMessage; score: number; tokens: number }> {
    return messages.map((m, idx) => {
      const tokens = this.estimateTokens(m);
      let score = 1;

      // Simple heuristics; can be upgraded later
      if (m.role === 'system') score += 2;
      if (m.role === 'assistant') score += 1;
      if (essentialContext) {
        const hint = JSON.stringify(essentialContext).slice(0, 1024);
        if (m.content && hint && m.content.length > 0) {
          const overlap = this.keywordOverlap(m.content, hint);
          score += overlap;
        }
      }

      // Boost recent messages
      score += Math.min(3, Math.floor((messages.length - idx) / 5));

      return { message: m, score, tokens };
    });
  }

  private selectOptimalWindow(
    scored: Array<{
      message: ConversationMessage;
      score: number;
      tokens: number;
    }>,
    tokenBudget: number,
  ): ConversationMessage[] {
    // Sort by score desc, maintain order via stable mapping
    const ranked = scored
      .map((s, i) => ({ ...s, idx: i }))
      .sort((a, b) => b.score - a.score);

    const selectedIdx = new Set<number>();
    let used = 0;
    for (const item of ranked) {
      if (used + item.tokens > tokenBudget) continue;
      selectedIdx.add(item.idx);
      used += item.tokens;
      if (used >= tokenBudget * 0.95) break;
    }

    // Always try to include first and last user/assistant turns if possible
    const boundaryCandidates = [0, scored.length - 1].filter((x) => x >= 0);
    for (const idx of boundaryCandidates) {
      const item = scored[idx];
      if (!item) continue;
      if (!selectedIdx.has(idx) && used + item.tokens <= tokenBudget) {
        selectedIdx.add(idx);
        used += item.tokens;
      }
    }

    // Reconstruct in original order
    return scored
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => selectedIdx.has(i))
      .sort((a, b) => a.i - b.i)
      .map(({ s }) => s.message);
  }

  private calculateTokens(messages: ConversationMessage[]): number {
    return messages.reduce((acc, m) => acc + this.estimateTokens(m), 0);
  }

  private estimateTokens(m: ConversationMessage): number {
    // Cheap heuristics: ~4 chars per token
    const contentTokens = Math.ceil((m.content || '').length / 4);
    const metaTokens = m.metadata
      ? Math.min(128, JSON.stringify(m.metadata).length / 8)
      : 0;
    return contentTokens + Math.ceil(metaTokens);
  }

  private keywordOverlap(a: string, b: string): number {
    const as = new Set(
      a
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
    const bs = new Set(
      b
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
    let overlap = 0;
    for (const w of as) if (bs.has(w)) overlap++;
    return Math.min(3, overlap / 5); // cap contribution
  }
}
