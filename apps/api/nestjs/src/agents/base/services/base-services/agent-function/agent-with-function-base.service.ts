import { Injectable } from '@nestjs/common';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

@Injectable()
export class AgentWithFunctionBaseService extends A2AAgentBaseService {
  
  private registeredFunctions: Map<string, AgentFunction> = new Map();
  
  async onModuleInit() {
    // Initialize and register agent functions
    await this.registerAgentFunctions();
  }

  protected async executeTask(method: string, params: any): Promise<any> {
    // Check if method corresponds to a registered function
    const agentFunction = this.registeredFunctions.get(method);
    
    if (agentFunction) {
      return this.executeAgentFunction(agentFunction, params);
    }

    // Fall back to custom processing if no function is found
    return this.processCustomMethod(method, params);
  }

  // Register a function for the agent
  protected registerFunction(agentFunction: AgentFunction): void {
    this.registeredFunctions.set(agentFunction.name, agentFunction);
  }

  // Abstract method to register agent-specific functions
  protected async registerAgentFunctions(): Promise<void> {
    throw new Error('registerAgentFunctions must be implemented by derived service');
  }

  // Abstract method for custom method processing
  protected async processCustomMethod(method: string, params: any): Promise<any> {
    throw new Error(`Unknown method: ${method}`);
  }

  private async executeAgentFunction(agentFunction: AgentFunction, params: any): Promise<any> {
    try {
      // Validate parameters against function schema
      this.validateFunctionParams(agentFunction, params);
      
      // Execute the function
      const result = await agentFunction.execute(params);
      
      // Ensure result is JSON serializable
      return this.sanitizeResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Function execution failed: ${errorMessage}`);
    }
  }

  private validateFunctionParams(agentFunction: AgentFunction, params: any): void {
    // Basic parameter validation
    if (!params && Object.keys(agentFunction.parameters).length > 0) {
      throw new Error(`Function ${agentFunction.name} requires parameters`);
    }
    // Additional parameter validation can be implemented here
  }

  private sanitizeResult(result: any): any {
    // Ensure the result is JSON serializable
    try {
      JSON.stringify(result);
      return result;
    } catch {
      // If result is not serializable, convert to string
      return { result: String(result) };
    }
  }

  // Enhanced agent card with function information
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    const functions = Array.from(this.registeredFunctions.values()).map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));

    return {
      ...baseCard,
      functions: functions,
      functionCount: functions.length,
      supportsLangGraph: true
    };
  }

  // Utility method to get all registered functions
  protected getRegisteredFunctions(): AgentFunction[] {
    return Array.from(this.registeredFunctions.values());
  }
} 