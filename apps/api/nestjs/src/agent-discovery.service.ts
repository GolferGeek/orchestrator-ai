import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { LLMService } from './agents/base/services/llm/llm.service';

export interface DiscoveredAgent {
  name: string;
  type: string;
  path: string;
  servicePath: string;
  serviceClass?: any;
  serviceInstance?: any;
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);
  private discoveredAgents: DiscoveredAgent[] = [];
  private agentInstances: any[] = [];
  private llmService: LLMService;

  constructor(private readonly httpService: HttpService) {
    // Initialize LLM service for dependency injection
    this.llmService = new LLMService();
  }

  /**
   * Discover and instantiate all agent services
   */
  async discoverAndInstantiateAgents(): Promise<DiscoveredAgent[]> {
    this.logger.log('🔍 Starting agent discovery...');
    
    const agentsBasePath = join(process.cwd(), 'src', 'agents', 'actual');
    this.discoveredAgents = [];
    this.agentInstances = [];
    
    await this.traverseDirectory(agentsBasePath);
    
    this.logger.log(`✅ Discovered ${this.discoveredAgents.length} agents`);
    
    // Now instantiate all discovered agents
    for (const agent of this.discoveredAgents) {
      try {
        // Get the relative path for dynamic import
        const relativePath = agent.servicePath.replace(process.cwd() + '/src/', './').replace('.ts', '');
        this.logger.debug(`📦 Importing agent from: ${relativePath}`);
        
        const serviceModule = await import(relativePath);
        
        // Find the exported service class
        const ServiceClass = Object.values(serviceModule).find((exp: any) => 
          typeof exp === 'function' && 
          exp.name && 
          exp.name.endsWith('Service')
        ) as any;
        
        if (!ServiceClass) {
          this.logger.warn(`⚠️ No service class found in ${agent.servicePath}`);
          continue;
        }
        
        agent.serviceClass = ServiceClass;
        
        // Instantiate the service with proper dependencies
        this.logger.debug(`🔧 Instantiating ${ServiceClass.name}...`);
        
        let serviceInstance;
        
        // Check if this service needs LLM service by examining constructor parameters
        const serviceNeedsLLM = this.checkIfServiceNeedsLLM(ServiceClass);
        
        if (serviceNeedsLLM) {
          this.logger.debug(`🧠 ${ServiceClass.name} requires LLM service`);
          serviceInstance = new ServiceClass(this.httpService, this.llmService);
        } else {
          this.logger.debug(`📡 ${ServiceClass.name} uses basic HTTP service only`);
          serviceInstance = new ServiceClass(this.httpService);
        }
        
        // Set the discovered path information on the service instance
        if (serviceInstance && typeof serviceInstance.setDiscoveredPath === 'function') {
          serviceInstance.setDiscoveredPath(agent.path);
          this.logger.debug(`🗂️ Set discovered path '${agent.path}' for ${ServiceClass.name}`);
        }
        
        // Manually call the lifecycle hook to register with agent pool
        if (serviceInstance.onModuleInit && typeof serviceInstance.onModuleInit === 'function') {
          this.logger.debug(`🔄 Calling onModuleInit for ${ServiceClass.name}...`);
          await serviceInstance.onModuleInit();
        }
        
        this.agentInstances.push(serviceInstance);
        agent.serviceInstance = serviceInstance;
        
        this.logger.log(`✅ Successfully instantiated: ${ServiceClass.name}`);
        
      } catch (error: any) {
        this.logger.error(`❌ Failed to instantiate agent ${agent.name}:`, error.message);
      }
    }
    
    this.logger.log(`🚀 Instantiated ${this.agentInstances.length} agent services`);
    return this.discoveredAgents;
  }

  /**
   * Check if a service class needs LLM service by examining its constructor
   */
  private checkIfServiceNeedsLLM(ServiceClass: any): boolean {
    try {
      // Check constructor parameter count as a heuristic
      // Services with LLM dependency will have 2 parameters: HttpService, LLMService
      // Services without LLM will have 1 parameter: HttpService only
      const constructorString = ServiceClass.toString();
      
      // Check if the constructor explicitly mentions LLMService
      if (constructorString.includes('llmService') || constructorString.includes('LLMService')) {
        return true;
      }
      
      // Check constructor parameter count
      const paramMatch = constructorString.match(/constructor\s*\([^)]*\)/);
      if (paramMatch) {
        const paramString = paramMatch[0];
        const paramCount = (paramString.match(/,/g) || []).length + 1;
        // If constructor has 2+ parameters, assume it needs LLM service
        return paramCount >= 2;
      }
      
      return false;
    } catch (error) {
      this.logger.warn(`Could not determine LLM dependency for ${ServiceClass.name}, defaulting to false`);
      return false;
    }
  }

  /**
   * Recursively traverse directory looking for agent-service.ts files
   */
  private async traverseDirectory(dirPath: string): Promise<void> {
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively check subdirectories
          await this.traverseDirectory(fullPath);
        } else if (item === 'agent-service.ts') {
          // Found an agent service file
          await this.processAgentService(fullPath);
        }
      }
    } catch (error: any) {
      this.logger.warn(`⚠️ Could not read directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Process a discovered agent-service.ts file
   */
  private async processAgentService(servicePath: string): Promise<void> {
    try {
      // Extract agent info from path
      const pathParts = servicePath.split('/');
      const agentIndex = pathParts.findIndex(part => part === 'actual') + 1;
      
      if (agentIndex < pathParts.length) {
        const agentPathParts = pathParts.slice(agentIndex, -1); // Remove 'agent-service.ts'
        const agentType = agentPathParts[0] || 'unknown';
        const agentName = agentPathParts[agentPathParts.length - 1] || 'unknown';
        
        // Create agent path format for routing (e.g., "orchestrator/orchestrator", "specialists/blog_post")
        const agentPath = `${agentType}/${agentName}`;
        
        const agent: DiscoveredAgent = {
          name: agentName,
          type: agentType,
          path: agentPath, // Use agent path format instead of file path
          servicePath: servicePath, // Keep full file path for imports
        };

        this.discoveredAgents.push(agent);
        this.logger.log(`📁 Found agent: ${agentPath} at ${servicePath}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error processing agent service ${servicePath}:`, error);
    }
  }

  /**
   * Get all discovered agents
   */
  getDiscoveredAgents(): DiscoveredAgent[] {
    return this.discoveredAgents;
  }

  /**
   * Get all instantiated agent instances
   */
  getAgentInstances(): any[] {
    return this.agentInstances;
  }
} 