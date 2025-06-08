import { Injectable } from '@nestjs/common';
import { BaseService } from '../../base.service';

@Injectable()
export class A2AAgentBaseService extends BaseService {
  
  async processTask(taskRequest: any): Promise<any> {
    // JSON-RPC message handling implementation
    // This will contain the core A2A protocol logic
    
    // Validate JSON-RPC request format
    if (!this.isValidJsonRpcRequest(taskRequest)) {
      return this.createJsonRpcError(-32600, 'Invalid Request', null);
    }

    // Process the task based on method
    try {
      const result = await this.executeTask(taskRequest.method, taskRequest.params);
      return this.createJsonRpcResponse(taskRequest.id, result);
    } catch (error) {
      return this.createJsonRpcError(-32603, 'Internal error', taskRequest.id);
    }
  }

  async getAgentCard(): Promise<any> {
    // Generate agent card with A2A protocol compliance
    return {
      name: this.getAgentName(),
      type: this.getAgentType(),
      version: "1.0.0",
      capabilities: this.getCapabilities(),
      endpoints: {
        tasks: "/tasks",
        health: "/health"
      },
      protocol: "A2A-1.0"
    };
  }

  // Abstract methods to be implemented by derived classes
  protected getAgentName(): string {
    throw new Error('getAgentName must be implemented by derived service');
  }

  protected getAgentType(): string {
    throw new Error('getAgentType must be implemented by derived service');
  }

  protected getCapabilities(): string[] {
    throw new Error('getCapabilities must be implemented by derived service');
  }

  protected async executeTask(method: string, params: any): Promise<any> {
    throw new Error('executeTask must be implemented by derived service');
  }

  // JSON-RPC utility methods
  private isValidJsonRpcRequest(request: any): boolean {
    return request && 
           request.jsonrpc === '2.0' && 
           request.method && 
           typeof request.method === 'string';
  }

  private createJsonRpcResponse(id: any, result: any) {
    return {
      jsonrpc: '2.0',
      id: id,
      result: result
    };
  }

  private createJsonRpcError(code: number, message: string, id: any) {
    return {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: code,
        message: message
      }
    };
  }
} 