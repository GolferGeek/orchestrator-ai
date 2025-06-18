import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

@Injectable()
export class BlogPostService extends ContextAgentBaseService {
  constructor(httpService: HttpService) {
    super(httpService);
  }
} 