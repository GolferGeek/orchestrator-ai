import { Controller, Get, Post, Body } from '@nestjs/common';
import { BaseService } from './base.service';

@Controller()
export class BaseController {
  constructor(private readonly baseService: BaseService) {}

  @Post('tasks')
  async handleTask(@Body() taskRequest: any) {
    return this.baseService.processTask(taskRequest);
  }

  @Get('.well-known/agent.json')
  async getAgentInfo() {
    return this.baseService.getAgentCard();
  }
}
