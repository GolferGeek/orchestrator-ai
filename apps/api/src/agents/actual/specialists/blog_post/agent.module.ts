import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BlogPostService } from './agent-service';

@Module({
  imports: [HttpModule],
  providers: [BlogPostService],
  exports: [BlogPostService],
})
export class BlogPostModule {}
