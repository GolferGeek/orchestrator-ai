import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentPoolService } from './agent-pool.service';
import { AgentPoolController } from './agent-pool.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [AgentPoolService],
  controllers: [AgentPoolController],
  exports: [AgentPoolService],
})
export class AgentPoolModule {}
