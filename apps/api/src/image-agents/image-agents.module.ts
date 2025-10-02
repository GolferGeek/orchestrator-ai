import { Module } from '@nestjs/common';
import { ImageAgentsController } from './image-agents.controller';
import { ImageAgentsService } from './image-agents.service';
import { AssetsModule } from '@/assets/assets.module';
import { DeliverablesModule } from '@/deliverables/deliverables.module';

@Module({
  imports: [AssetsModule, DeliverablesModule],
  controllers: [ImageAgentsController],
  providers: [ImageAgentsService],
  exports: [ImageAgentsService],
})
export class ImageAgentsModule {}

