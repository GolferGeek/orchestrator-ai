import { Module } from '@nestjs/common';
import { HierarchyController } from './hierarchy.controller';
import { AgentDiscoveryService } from '../agent-discovery.service';

@Module({
  controllers: [HierarchyController],
  providers: [AgentDiscoveryService],
  exports: [AgentDiscoveryService],
})
export class HierarchyModule {}
