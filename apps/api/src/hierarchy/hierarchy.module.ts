import { Module } from '@nestjs/common';
import { HierarchyController } from './hierarchy.controller';

@Module({
  controllers: [HierarchyController],
  providers: [],
  exports: [],
})
export class HierarchyModule {}
