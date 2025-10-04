import { Module } from '@nestjs/common';
import { AgentNameFormatter } from './agent-name.formatter';

@Module({
  providers: [AgentNameFormatter],
  exports: [AgentNameFormatter],
})
export class FormattersModule {}
