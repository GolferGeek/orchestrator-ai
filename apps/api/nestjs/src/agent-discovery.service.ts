import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { LLMService } from '@llm/llm.service';
import { SessionsService } from './sessions/sessions.service';
import { SupabaseService } from './supabase/supabase.service';
import { AgentRegistrationService, AgentInfo } from './agents/base/sub-services/agent-registration/agent-registration.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';

export interface DiscoveredAgent {
  name: string;
  type: string;
  path: string;
  servicePath: string;
  serviceClass?: any;
  serviceInstance?: any;
  functionPath?: string;
  pythonFunctionPath?: string;
  agentFunction?: any;
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);
  private discoveredAgents: DiscoveredAgent[] = [];
  private agentInstances: any[] = [];
  private agentFunctionRegistry = new Map<string, any>();

  constructor(
    private readonly httpService: HttpService,
    private readonly sessionsService: SessionsService,
    private readonly supabaseService: SupabaseService,
    private readonly llmService: LLMService,
    private readonly registrationService: AgentRegistrationService,
    private readonly agentPoolService: AgentPoolService
  ) {
    // LLMService is now properly injected via constructor
    
    // Configure registration service to disable HTTP registration
    // since we use the internal agent pool service
    this.registrationService.configure({
      autoRegister: false,
      autoHeartbeat: false,
      maxRetryAttempts: 0 // Disable retries
    });
    
    this.logger.log('🔍 AgentDiscoveryService initialized with HTTP registration disabled');
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
        
        // Instantiate the service with proper dependencies based on base service type
        this.logger.debug(`🔧 Instantiating ${ServiceClass.name}...`);
        
        let serviceInstance;
        const serviceName = ServiceClass.name;
        const baseServiceType = this.determineBaseServiceType(ServiceClass);
        
        this.logger.debug(`📋 ${serviceName} uses base service type: ${baseServiceType}`);
        
        try {
          this.logger.debug(`Dependencies check: httpService=${!!this.httpService}, llmService=${!!this.llmService}, sessionsService=${!!this.sessionsService}, supabaseService=${!!this.supabaseService}`);
          
          switch (baseServiceType) {
            case 'orchestrator':
              this.logger.debug(`🎯 ${serviceName} is orchestrator - requires HTTP, LLM, Sessions, Supabase`);
              serviceInstance = new ServiceClass(this.httpService, this.llmService, this.sessionsService, this.supabaseService);
              break;
              
            case 'function':
              this.logger.debug(`⚙️ ${serviceName} is TypeScript function agent - requires HTTP, LLM`);
              // FunctionAgentBaseService constructor: (httpService, llmService, ...optional sub-services)
              serviceInstance = new ServiceClass(this.httpService, this.llmService);
              break;
              
            case 'python-function':
              this.logger.debug(`🐍 ${serviceName} is Python function agent - requires LLM, HTTP`);
              // PythonFunctionAgentBaseService constructor: (llmService, httpService, ...optional sub-services)
              serviceInstance = new ServiceClass(this.llmService, this.httpService);
              break;
              
            case 'context':
              this.logger.debug(`📝 ${serviceName} is context agent - requires HTTP only`);
              // Context agents using ContextAgentBaseService: (httpService, ...optional sub-services)
              serviceInstance = new ServiceClass(this.httpService);
              break;
              
            case 'api':
              this.logger.debug(`🌐 ${serviceName} is API agent - requires HTTP, LLM`);
              // Future API agents: (httpService, llmService, ...optional sub-services)
              serviceInstance = new ServiceClass(this.httpService, this.llmService);
              break;
              
            case 'external':
              this.logger.debug(`🔗 ${serviceName} is external agent - requires HTTP`);
              // Future external agents: (httpService, ...optional sub-services)
              serviceInstance = new ServiceClass(this.httpService);
              break;
              
            default:
              this.logger.warn(`❓ Unknown base service type for ${serviceName}, using minimal dependencies`);
              serviceInstance = new ServiceClass(this.httpService);
              break;
          }
          
          this.logger.debug(`✅ Successfully created instance of ${serviceName}`);
        } catch (instantiationError: any) {
          this.logger.error(`❌ Instantiation failed for ${serviceName}:`);
          this.logger.error(`Error: ${instantiationError.message}`);
          throw instantiationError;
        }
        
        // Set the discovered path information on the service instance
        if (serviceInstance && typeof serviceInstance.setDiscoveredPath === 'function') {
          serviceInstance.setDiscoveredPath(agent.path);
          this.logger.debug(`🗂️ Set discovered path '${agent.path}' for ${ServiceClass.name}`);
        }
        
        // Register with internal agent pool service instead of HTTP registration
        await this.registerAgentWithInternalPool(serviceInstance, agent);
        
        // Store agent instance for internal agent pool access
        this.agentInstances.push(serviceInstance);
        agent.serviceInstance = serviceInstance;
        
        this.logger.log(`✅ Successfully instantiated: ${ServiceClass.name}`);
        
      } catch (error: any) {
        this.logger.error(`❌ Failed to instantiate agent ${agent.name}:`);
        this.logger.error(`Error type: ${error.constructor.name}`);
        this.logger.error(`Error message: ${error.message}`);
        if (error.errors && Array.isArray(error.errors)) {
          error.errors.forEach((err: any, index: number) => {
            this.logger.error(`  Error ${index + 1}: ${err.message || err}`);
          });
        }
        this.logger.error(`Full error:`, error);
      }
    }
    
    this.logger.log(`🚀 Instantiated ${this.agentInstances.length} agent services`);
    
    // Now discover and pre-load agent functions
    await this.discoverAgentFunctions();
    
    return this.discoveredAgents;
  }

  /**
   * Register agent with internal agent pool service
   */
  private async registerAgentWithInternalPool(serviceInstance: any, agent: DiscoveredAgent): Promise<void> {
    try {
      this.logger.debug(`📝 Registering ${serviceInstance.constructor.name} with internal agent pool...`);
      
      // Build agent registration object
      const agentRegistration = {
        id: this.generateAgentId(agent.name, agent.path),
        name: agent.name,
        type: this.determineAgentType(agent.path),
        path: agent.path,
        url: this.buildAgentUrl(agent.path, agent.name),
        description: `${agent.name} - A specialized agent for handling specific tasks`,
        capabilities: [], // Will be enhanced by individual agents if needed
        skills: [], // Will be enhanced by individual agents if needed
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        metadata: {
          version: '1.0.0',
          agentPath: agent.path,
          servicePath: agent.servicePath
        },
        status: 'online' as const,
        registeredAt: new Date(),
        lastHeartbeat: new Date()
      };
      
      // Register with internal agent pool
      await this.agentPoolService.registerAgent(agentRegistration);
      
      this.logger.log(`✅ Successfully registered ${agent.name} with internal agent pool`);
      
    } catch (error: any) {
      this.logger.error(`❌ Failed to register ${agent.name} with internal agent pool:`, error.message);
      throw new Error(`AggregateError`);
    }
  }

  /**
   * Register agent with registration service instead of calling onModuleInit
   */
  private async registerAgentWithMetadataService(serviceInstance: any, agent: DiscoveredAgent): Promise<void> {
    try {
      this.logger.debug(`📝 Registering ${serviceInstance.constructor.name} with registration service...`);
      
      // Build agent info for registration
      const agentInfo: AgentInfo = {
        id: this.generateAgentId(agent.name, agent.path),
        name: agent.name,
        type: this.determineAgentType(agent.path),
        path: agent.path,
        url: this.buildAgentUrl(agent.path, agent.name),
        description: `${agent.name} - A specialized agent for handling specific tasks`,
        capabilities: [], // Will be enhanced by individual agents if needed
        skills: [], // Will be enhanced by individual agents if needed
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        metadata: {
          version: '1.0.0',
          agentPath: agent.path,
          servicePath: agent.servicePath,
          functionPath: agent.functionPath,
          pythonFunctionPath: agent.pythonFunctionPath
        }
      };
      
      // Register with agent pool
      const result = await this.registrationService.registerAgent(agentInfo);
      
      if (result.success) {
        this.logger.log(`✅ Agent ${agent.name} registered successfully`);
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (error) {
      this.logger.error(`❌ Failed to register agent ${agent.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate a stable agent ID from name and path
   */
  private generateAgentId(name: string, path: string): string {
    return path.replace(/\//g, '_').toLowerCase() || name.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Build agent URL for registration
   */
  private buildAgentUrl(agentPath: string, agentName: string): string {
    const baseUrl = 'http://localhost:4000';
    const agentType = this.determineAgentType(agentPath);
    const name = agentName.toLowerCase().replace(/\s+/g, '_');
    return `${baseUrl}/agents/${agentType}s/${name}/tasks`;
  }

  /**
   * Determine agent type from path
   */
  private determineAgentType(agentPath: string): 'orchestrator' | 'specialist' | 'manager' | 'external' {
    if (agentPath.includes('orchestrator')) {
      return 'orchestrator';
    } else if (agentPath.includes('specialists')) {
      return 'specialist';
    } else if (agentPath.includes('external')) {
      return 'external';
    }
    return 'specialist';
  }

  /**
   * Determine the base service type by examining the prototype chain
   */
  private determineBaseServiceType(ServiceClass: any): 'orchestrator' | 'function' | 'python-function' | 'context' | 'api' | 'external' | 'unknown' {
    try {
      const serviceName = ServiceClass.name;
      
      // Special case for orchestrator
      if (serviceName === 'OrchestratorService') {
        return 'orchestrator';
      }
      
      // Check the prototype chain for base service types
      let currentClass = ServiceClass;
      while (currentClass && currentClass.name !== 'Object') {
        const className = currentClass.name;
        
        // Check for specific base service classes
        if (className === 'FunctionAgentBaseService') {
          return 'function';
        }
        if (className === 'PythonFunctionAgentBaseService') {
          return 'python-function';
        }
        if (className === 'ContextAgentBaseService') {
          return 'context';
        }
        if (className === 'A2AAgentBaseService') {
          // If it directly extends A2AAgentBaseService (not through other base services), it's a context agent
          return 'context';
        }
        
        // Move up the prototype chain
        currentClass = Object.getPrototypeOf(currentClass);
      }
      
      // Fallback: Check class string for base service imports/extends
      const classString = ServiceClass.toString();
      if (classString.includes('FunctionAgentBaseService')) {
        return 'function';
      }
      if (classString.includes('PythonFunctionAgentBaseService')) {
        return 'python-function';
      }
      if (classString.includes('ContextAgentBaseService')) {
        return 'context';
      }
      if (classString.includes('A2AAgentBaseService')) {
        return 'context';
      }
      
      // Future base service types can be added here:
      // if (classString.includes('ApiAgentBaseService')) {
      //   return 'api';
      // }
      // if (classString.includes('ExternalAgentBaseService')) {
      //   return 'external';
      // }
      
      this.logger.warn(`Could not determine base service type for ${serviceName}`);
      return 'unknown';
      
    } catch (error) {
      this.logger.error(`Error determining base service type for ${ServiceClass.name}:`, error);
      return 'unknown';
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
   * Discover and pre-load agent functions at startup
   */
  private async discoverAgentFunctions(): Promise<void> {
    this.logger.log('🔧 Discovering agent functions...');
    
    for (const agent of this.discoveredAgents) {
      try {
        // Check if agent-function.ts exists in the same directory as agent-service.ts
        const agentDir = agent.servicePath.replace('/agent-service.ts', '');
        const functionPath = `${agentDir}/agent-function.ts`;
        const pythonFunctionPath = `${agentDir}/agent-function.py`;
        
        // Check if function file exists
        const fs = require('fs');
        
        // Check for Python script first (for Python agents)
        if (fs.existsSync(pythonFunctionPath)) {
          this.logger.log(`🐍 Found Python agent function for ${agent.name}: ${pythonFunctionPath}`);
          agent.pythonFunctionPath = pythonFunctionPath;
          
          // Set the Python script path on the service instance if it supports it
          if (agent.serviceInstance && typeof agent.serviceInstance.setPythonScriptPath === 'function') {
            agent.serviceInstance.setPythonScriptPath(pythonFunctionPath);
            this.logger.log(`✅ Set Python script path for: ${agent.name}`);
          }
          continue;
        }
        
        // Fall back to TypeScript function
        if (!fs.existsSync(functionPath)) {
          this.logger.debug(`📝 No agent-function.ts found for ${agent.name} (using context-based agent)`);
          continue;
        }
        
        // Import the function at startup
        const relativePath = functionPath.replace(process.cwd() + '/src/', './').replace('.ts', '');
        this.logger.debug(`🎯 Loading agent function for ${agent.name} from: ${relativePath}`);
        
        const functionModule = await import(relativePath);
        
        // Look for the agent function export (default export or named 'execute' export)
        let agentFunction = null;
        
        if (functionModule.default && typeof functionModule.default === 'function') {
          // Default export function
          agentFunction = functionModule.default;
          this.logger.debug(`Found default export function in ${agent.name}`);
        } else if (functionModule.execute && typeof functionModule.execute === 'function') {
          // Named 'execute' export function
          agentFunction = functionModule.execute;
          this.logger.debug(`Found named 'execute' export function in ${agent.name}`);
        }
        
        if (agentFunction) {
          // Store in registry using agent name as key
          this.agentFunctionRegistry.set(agent.name, agentFunction);
          agent.functionPath = functionPath;
          agent.agentFunction = agentFunction;
          
          // Set the function on the service instance if it supports it
          if (agent.serviceInstance && typeof agent.serviceInstance.setAgentFunction === 'function') {
            agent.serviceInstance.setAgentFunction(agentFunction);
            this.logger.log(`✅ Pre-loaded and set function for: ${agent.name}`);
          } else {
            this.logger.log(`✅ Pre-loaded function for: ${agent.name} (service doesn't support setAgentFunction)`);
          }
        } else {
          this.logger.warn(`⚠️ No valid function export found in ${functionPath} (looking for default export or named 'execute' export)`);
        }
        
      } catch (error: any) {
        this.logger.warn(`⚠️ Could not load agent function for ${agent.name}: ${error.message}`);
      }
    }
    
    this.logger.log(`🎯 Pre-loaded ${this.agentFunctionRegistry.size} agent functions`);
  }

  /**
   * Get pre-loaded agent function by agent name
   */
  getAgentFunction(agentName: string): any {
    return this.agentFunctionRegistry.get(agentName);
  }

  /**
   * Check if agent has a pre-loaded function
   */
  hasAgentFunction(agentName: string): boolean {
    return this.agentFunctionRegistry.has(agentName);
  }

  /**
   * Get all instantiated agent instances
   */
  getAgentInstances(): any[] {
    return this.agentInstances;
  }
} 