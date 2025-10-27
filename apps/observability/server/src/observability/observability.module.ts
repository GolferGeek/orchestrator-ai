import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { ObservabilityGateway } from './observability.gateway';
import { ObservabilityService } from './observability.service';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityGateway, ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
