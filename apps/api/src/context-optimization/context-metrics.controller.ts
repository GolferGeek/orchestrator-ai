import { Controller, Get } from '@nestjs/common';
import { ContextMetricsListener } from './context-metrics.listener';

@Controller('metrics/context')
export class ContextMetricsController {
  constructor(private readonly listener: ContextMetricsListener) {}

  @Get('rollup')
  getRollup() {
    return this.listener.getRollup();
  }
}


