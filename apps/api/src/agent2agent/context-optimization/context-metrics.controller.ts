import { Controller, Get } from '@nestjs/common';
import {
  ContextMetricsListener,
  RollupMetrics,
} from './context-metrics.listener';

@Controller('metrics/context')
export class ContextMetricsController {
  constructor(private readonly listener: ContextMetricsListener) {}

  @Get('rollup')
  getRollup(): RollupMetrics {
    return this.listener.getRollup();
  }
}
