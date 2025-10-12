import { Controller, Get, Header } from '@nestjs/common';
import { OrchestrationMetricsService } from '../services/orchestration-metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: OrchestrationMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async fetch(): Promise<string> {
    return this.metrics.snapshot();
  }
}
