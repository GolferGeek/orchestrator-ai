import { Controller, Get, Post, Body } from '@nestjs/common';
import { BaseService } from './base.service';

@Controller()
export class BaseController {
  constructor(private readonly baseService: BaseService) {}

  @Post('tasks')
  async handleTask(@Body() taskRequest: any) {
    // Prefer JSON-RPC path when available to use A2A normalization and gating
    const svc: any = this.baseService as any;
    if (typeof svc.processJsonRpcRequest === 'function') {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: taskRequest?.taskId || Date.now().toString(),
        method: taskRequest?.method || 'converse',
        params: taskRequest,
      };
      const rpcResponse = await svc.processJsonRpcRequest(jsonRpcRequest);
      return rpcResponse?.result ?? rpcResponse;
    }
    // Fallback for legacy implementations
    return this.baseService.processTask(taskRequest);
  }

  @Get('.well-known/agent.json')
  async getAgentInfo() {
    return this.baseService.getAgentCard();
  }
}
