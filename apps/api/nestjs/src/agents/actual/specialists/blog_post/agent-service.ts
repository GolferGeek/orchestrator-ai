import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MCPContextAgentBaseService } from '../../../base/services/base-services/mcp-context/mcp-context-agent-base.service';

@Injectable()
export class BlogPostService extends MCPContextAgentBaseService {
  constructor(httpService: HttpService) {
    super(httpService);
  }
} 