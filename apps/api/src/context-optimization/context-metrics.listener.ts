import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskProgressGateway } from '../websocket/task-progress.gateway';

export interface ContextMetricsEvent {
  originalCount: number;
  optimizedCount: number;
  processingTimeMs: number;
  workProductType?: 'project' | 'deliverable';
}

export interface RollupMetrics {
  events: number;
  optimizationRate: number; // % of requests optimized
  averageCompressionRatio: number; // optimizedCount / originalCount (avg)
  averageProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
}

@Injectable()
export class ContextMetricsListener {
  private readonly logger = new Logger(ContextMetricsListener.name);
  private readonly bufferSize = 1000;
  private readonly events: ContextMetricsEvent[] = [];

  constructor(private readonly wsGateway: TaskProgressGateway) {}

  @OnEvent('context_optimization.metrics')
  handleMetrics(event: ContextMetricsEvent) {
    this.events.push(event);
    if (this.events.length > this.bufferSize) this.events.shift();

    const broadcast = (process.env.CONTEXT_METRICS_BROADCAST || 'true') === 'true';
    if (broadcast) {
      const rollup = this.getRollup();
      try {
        // Global broadcast
        this.wsGateway.server.emit('context_metrics_updated', {
          event,
          rollup,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        this.logger.debug(`Failed to broadcast context metrics: ${e}`);
      }
    }
  }

  getRollup(): RollupMetrics {
    const n = this.events.length || 1;
    const optimizedEvents = this.events.filter(
      (e) => e.optimizedCount < e.originalCount,
    );
    const optimizationRate = (optimizedEvents.length / n) * 100;

    const compressionRatios = this.events.map((e) =>
      e.originalCount > 0 ? e.optimizedCount / e.originalCount : 1,
    );
    const averageCompressionRatio =
      compressionRatios.reduce((a, b) => a + b, 0) / n;

    const times = this.events.map((e) => e.processingTimeMs).sort((a, b) => a - b);
    const averageProcessingTimeMs =
      times.reduce((a, b) => a + b, 0) / (this.events.length || 1);
    const p50ProcessingTimeMs = times[Math.floor(0.5 * (times.length - 1))] || 0;
    const p95ProcessingTimeMs = times[Math.floor(0.95 * (times.length - 1))] || 0;

    return {
      events: this.events.length,
      optimizationRate,
      averageCompressionRatio,
      averageProcessingTimeMs,
      p50ProcessingTimeMs,
      p95ProcessingTimeMs,
    };
  }
}


