import { Injectable } from '@nestjs/common';

@Injectable()
export class BaseService {
  async processTask(taskRequest: any): Promise<any> {
    // Base implementation for task processing
    // This will be overridden by specific agent implementations
    throw new Error('processTask must be implemented by derived service');
  }

  async getAgentCard(): Promise<any> {
    // Base implementation for agent card generation
    // This will be overridden by specific agent implementations
    throw new Error('getAgentCard must be implemented by derived service');
  }
} 