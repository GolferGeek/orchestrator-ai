import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { LLMService } from '@/llms/llm.service';
import { SupabaseService } from './supabase/supabase.service';
import { ConfigurationService } from './agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from './agents/base/sub-services/agent-registration/agent-registration.service';
import { TaskProgressGateway } from './websocket/task-progress.gateway';
import { TasksService } from './tasks/tasks.service';
import { TaskStatusService } from './tasks/task-status.service';
import { DeliverablesService } from './deliverables/deliverables.service';
import { MarketingManagerOrchestratorService } from './agents/actual/marketing/marketing_manager_orchestrator/agent-service';
import { CEOOrchestratorService } from './agents/actual/orchestrator/ceo_orchestrator/agent-service';
import { EngineeringManagerOrchestratorService } from './agents/actual/engineering/engineering_manager_orchestrator/agent-service';
import { OperationsManagerOrchestratorService } from './agents/actual/operations/operations_manager_orchestrator/agent-service';
import { FinanceManagerOrchestratorService } from './agents/actual/finance/finance_manager_orchestrator/agent-service';
import { HRManagerOrchestratorService } from './agents/actual/hr/hr_manager_orchestrator/agent-service';
import { SalesManagerOrchestratorService } from './agents/actual/sales/sales_manager_orchestrator/agent-service';
import { ProductManagerOrchestratorService } from './agents/actual/product/product_manager_orchestrator/agent-service';
import { ResearchManagerOrchestratorService } from './agents/actual/research/research_manager_orchestrator/agent-service';
import { SpecialistsManagerOrchestratorService } from './agents/actual/specialists/specialists_manager_orchestrator/agent-service';
import { LegalManagerOrchestratorService } from './agents/actual/legal/legal_manager_orchestrator/agent-service';
import { ProductivityManagerOrchestratorService } from './agents/actual/productivity/productivity_manager_orchestrator/agent-service';
// Note: MCPClientService removed - replaced with LangChain.js services

export interface DiscoveredAgent {
  name: string;
  type: string;
  path: string;
  servicePath: string;
  serviceClass?: ServiceClass;
  serviceInstance?: any;
  functionPath?: string;
  pythonFunctionPath?: string;
  agentFunction?: AgentFunction;
}

export interface ServiceClass {
  new (...args: any[]): any;
  name: string;
}

export interface AgentFunction {
  (...args: any[]): Promise<any>;
}

export interface AgentConfig {
  name: string;
  type:
    | 'orchestrator'
    | 'function'
    | 'python-function'
    | 'context'
    | 'api'
    | 'external';
  description?: string;
  capabilities?: string[];
  skills?: string[];
  inputModes?: string[];
  outputModes?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class AgentFactoryService {
  private readonly logger = new Logger(AgentFactoryService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly llmService: LLMService,
    private readonly supabaseService: SupabaseService,
    private readonly configurationService: ConfigurationService,
    private readonly agentRegistrationService: AgentRegistrationService,
    private readonly taskProgressGateway: TaskProgressGateway,
    private readonly tasksService: TasksService,
    private readonly taskStatusService: TaskStatusService,
    private readonly deliverablesService: DeliverablesService,
    @Optional() private readonly marketingManagerOrchestratorService?: MarketingManagerOrchestratorService,
    @Optional() private readonly ceoOrchestratorService?: CEOOrchestratorService,
    @Optional() private readonly engineeringManagerOrchestratorService?: EngineeringManagerOrchestratorService,
    @Optional() private readonly operationsManagerOrchestratorService?: OperationsManagerOrchestratorService,
    @Optional() private readonly financeManagerOrchestratorService?: FinanceManagerOrchestratorService,
    @Optional() private readonly hrManagerOrchestratorService?: HRManagerOrchestratorService,
    @Optional() private readonly salesManagerOrchestratorService?: SalesManagerOrchestratorService,
    @Optional() private readonly productManagerOrchestratorService?: ProductManagerOrchestratorService,
    @Optional() private readonly researchManagerOrchestratorService?: ResearchManagerOrchestratorService,
    @Optional() private readonly specialistsManagerOrchestratorService?: SpecialistsManagerOrchestratorService,
    @Optional() private readonly legalManagerOrchestratorService?: LegalManagerOrchestratorService,
    @Optional() private readonly productivityManagerOrchestratorService?: ProductivityManagerOrchestratorService,
    // mcpClientService removed - using LangChain.js services instead
    // supabaseToolsService removed - using utility functions instead
  ) {
    this.logger.log('🏭 AgentFactoryService initialized');
    this.logger.log(`🎯 Marketing Orchestrator available: ${!!this.marketingManagerOrchestratorService}`);
    this.logger.log(`🎯 CEO Orchestrator available: ${!!this.ceoOrchestratorService}`);
    this.logger.log(`🎯 Engineering Manager Orchestrator available: ${!!this.engineeringManagerOrchestratorService}`);
    this.logger.log(`🎯 Operations Manager Orchestrator available: ${!!this.operationsManagerOrchestratorService}`);
    this.logger.log(`🎯 Finance Manager Orchestrator available: ${!!this.financeManagerOrchestratorService}`);
    this.logger.log(`🎯 HR Manager Orchestrator available: ${!!this.hrManagerOrchestratorService}`);
    this.logger.log(`🎯 Sales Manager Orchestrator available: ${!!this.salesManagerOrchestratorService}`);
    this.logger.log(`🎯 Product Manager Orchestrator available: ${!!this.productManagerOrchestratorService}`);
    this.logger.log(`🎯 Research Manager Orchestrator available: ${!!this.researchManagerOrchestratorService}`);
    this.logger.log(`🎯 Specialists Manager Orchestrator available: ${!!this.specialistsManagerOrchestratorService}`);
    this.logger.log(`🎯 Legal Manager Orchestrator available: ${!!this.legalManagerOrchestratorService}`);
    this.logger.log(`🎯 Productivity Manager Orchestrator available: ${!!this.productivityManagerOrchestratorService}`);
  }

  /**
   * Create an agent instance from discovered metadata
   */
  async createAgent(discoveredAgent: DiscoveredAgent): Promise<any> {
    this.logger.debug(`🔧 Creating agent: ${discoveredAgent.name}`);

    try {
      // Load agent configuration from YAML
      this.logger.debug(
        `📋 Step 1: Loading config for ${discoveredAgent.name}`,
      );
      const config = await this.loadAgentConfig(discoveredAgent);
      this.logger.debug(
        `📋 Config loaded - type: ${config.type}, name: ${config.name}`,
      );

      // Import the service class
      this.logger.debug(
        `📦 Step 2: Importing service class for ${discoveredAgent.name}`,
      );
      const ServiceClass = await this.importServiceClass(discoveredAgent);
      if (!ServiceClass) {
        throw new Error(`No service class found for ${discoveredAgent.name}`);
      }
      this.logger.debug(`📦 Service class imported: ${ServiceClass.name}`);

      // Store the service class on the discovered agent
      discoveredAgent.serviceClass = ServiceClass;

      // Create instance based on agent type
      this.logger.debug(
        `🏗️ Step 3: Instantiating agent ${discoveredAgent.name} as type: ${config.type}`,
      );
      const serviceInstance = await this.instantiateAgent(ServiceClass, config);
      this.logger.debug(`🏗️ Agent instance created successfully`);

      // Set discovered path and initialize
      this.logger.debug(
        `🔧 Step 4: Initializing agent ${discoveredAgent.name}`,
      );
      await this.initializeAgent(serviceInstance, discoveredAgent, config);
      this.logger.debug(`🔧 Agent initialization completed`);

      // Store the instance
      discoveredAgent.serviceInstance = serviceInstance;

      this.logger.log(`✅ Successfully created agent: ${discoveredAgent.name}`);
      return serviceInstance;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to create agent ${discoveredAgent.name}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Load agent configuration from YAML file
   */
  private async loadAgentConfig(
    discoveredAgent: DiscoveredAgent,
  ): Promise<AgentConfig> {
    const agentDirectory = path.dirname(discoveredAgent.servicePath);
    const yamlPath = path.join(agentDirectory, 'agent.yaml');

    this.logger.debug(`📋 Loading config from: ${yamlPath}`);

    if (!fs.existsSync(yamlPath)) {
      this.logger.warn(`No agent.yaml found at: ${yamlPath}, using defaults`);
      return this.createDefaultConfig(discoveredAgent);
    }

    try {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      const yamlData = yaml.load(yamlContent) as Record<string, unknown>;

      if (!yamlData || typeof yamlData !== 'object') {
        throw new Error('Invalid YAML structure');
      }

      return this.validateAndNormalizeConfig(yamlData, discoveredAgent);
    } catch (error: any) {
      this.logger.warn(
        `Failed to parse YAML from ${yamlPath}: ${error.message}, using defaults`,
      );
      return this.createDefaultConfig(discoveredAgent);
    }
  }

  /**
   * Import the service class dynamically
   */
  private async importServiceClass(
    discoveredAgent: DiscoveredAgent,
  ): Promise<ServiceClass | null> {
    try {
      // Handle both development (source) and production (compiled) paths
      const servicePath = discoveredAgent.servicePath;
      let importPath: string;

      // Check if we're running in a compiled environment (dist exists)
      const isCompiled = servicePath.includes('/dist/') || require.resolve('./app.module').includes('/dist/');

      if (isCompiled) {
        // Production/compiled environment: import from compiled JS files
        if (servicePath.includes('/dist/')) {
          // Path already points to dist, just remove .js extension if present
          importPath = servicePath.replace(/\.js$/, '');
        } else {
          // Source path but running compiled - convert to compiled path
          // /Users/.../apps/api/src/agents/... -> ./agents/...
          const srcIndex = servicePath.indexOf('/src/');
          if (srcIndex !== -1) {
            const relativePath = servicePath.substring(srcIndex + 5); // Remove "/src/"
            importPath = './' + relativePath.replace('.ts', '');
          } else {
            throw new Error(`Cannot find /src/ in path: ${servicePath}`);
          }
        }
      } else {
        // Development environment: import from source files
        if (process.cwd().includes('/apps/api')) {
          // Monorepo: convert /Users/.../apps/api/src/... to ./src/...
          const srcIndex = servicePath.indexOf('/src/');
          if (srcIndex !== -1) {
            importPath = '.' + servicePath.substring(srcIndex).replace('.ts', '');
          } else {
            throw new Error(`Cannot find /src/ in path: ${servicePath}`);
          }
        } else {
          // Standalone: convert /Users/.../src/... to ./...
          importPath = servicePath
            .replace(process.cwd() + '/src/', './')
            .replace('.ts', '');
        }
      }

      this.logger.debug(`📦 Importing service from: ${importPath} (original: ${servicePath}, compiled: ${isCompiled})`);

      const serviceModule = await import(importPath);

      // Find the exported service class
      const ServiceClass = Object.values(serviceModule).find(
        (exp: unknown): exp is ServiceClass =>
          typeof exp === 'function' &&
          'name' in exp &&
          typeof exp.name === 'string' &&
          exp.name.endsWith('Service'),
      );

      return ServiceClass || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to import service class for ${discoveredAgent.name}:`,
        error.message,
      );
      this.logger.error(`Service path: ${discoveredAgent.servicePath}`);
      this.logger.error(`Process CWD: ${process.cwd()}`);
      this.logger.error(`__dirname: ${__dirname}`);
      return null;
    }
  }

  /**
   * Instantiate agent based on type with correct dependencies
   */
  private async instantiateAgent(
    ServiceClass: ServiceClass,
    config: AgentConfig,
  ): Promise<any> {
    const serviceName = ServiceClass.name;

    this.logger.debug(
      `🏗️ Instantiating ${serviceName} as type: ${config.type}`,
    );

    try {
      switch (config.type) {
        case 'orchestrator': {
          this.logger.debug(`🎯 Getting orchestrator agent from DI container: ${serviceName}`);
          
          // Return the properly injected orchestrator instance from NestJS DI container
          switch (serviceName) {
            case 'MarketingManagerOrchestratorService':
              if (!this.marketingManagerOrchestratorService) {
                throw new Error(`MarketingManagerOrchestratorService not available in DI container. Is MarketingManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning MarketingManagerOrchestratorService from DI`);
              return this.marketingManagerOrchestratorService;

            case 'CEOOrchestratorService':
              if (!this.ceoOrchestratorService) {
                throw new Error(`CEOOrchestratorService not available in DI container. Is CEOOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning CEOOrchestratorService from DI`);
              return this.ceoOrchestratorService;

            case 'EngineeringManagerOrchestratorService':
              if (!this.engineeringManagerOrchestratorService) {
                throw new Error(`EngineeringManagerOrchestratorService not available in DI container. Is EngineeringManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning EngineeringManagerOrchestratorService from DI`);
              return this.engineeringManagerOrchestratorService;

            case 'OperationsManagerOrchestratorService':
              if (!this.operationsManagerOrchestratorService) {
                throw new Error(`OperationsManagerOrchestratorService not available in DI container. Is OperationsManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning OperationsManagerOrchestratorService from DI`);
              return this.operationsManagerOrchestratorService;

            case 'FinanceManagerOrchestratorService':
              if (!this.financeManagerOrchestratorService) {
                throw new Error(`FinanceManagerOrchestratorService not available in DI container. Is FinanceManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning FinanceManagerOrchestratorService from DI`);
              return this.financeManagerOrchestratorService;

            case 'HRManagerOrchestratorService':
              if (!this.hrManagerOrchestratorService) {
                throw new Error(`HRManagerOrchestratorService not available in DI container. Is HRManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning HRManagerOrchestratorService from DI`);
              return this.hrManagerOrchestratorService;

            case 'SalesManagerOrchestratorService':
              if (!this.salesManagerOrchestratorService) {
                throw new Error(`SalesManagerOrchestratorService not available in DI container. Is SalesManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning SalesManagerOrchestratorService from DI`);
              return this.salesManagerOrchestratorService;

            case 'ProductManagerOrchestratorService':
              if (!this.productManagerOrchestratorService) {
                throw new Error(`ProductManagerOrchestratorService not available in DI container. Is ProductManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning ProductManagerOrchestratorService from DI`);
              return this.productManagerOrchestratorService;

            case 'ResearchManagerOrchestratorService':
              if (!this.researchManagerOrchestratorService) {
                throw new Error(`ResearchManagerOrchestratorService not available in DI container. Is ResearchManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning ResearchManagerOrchestratorService from DI`);
              return this.researchManagerOrchestratorService;

            case 'SpecialistsManagerOrchestratorService':
              if (!this.specialistsManagerOrchestratorService) {
                throw new Error(`SpecialistsManagerOrchestratorService not available in DI container. Is SpecialistsManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning SpecialistsManagerOrchestratorService from DI`);
              return this.specialistsManagerOrchestratorService;

            case 'LegalManagerOrchestratorService':
              if (!this.legalManagerOrchestratorService) {
                throw new Error(`LegalManagerOrchestratorService not available in DI container. Is LegalManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning LegalManagerOrchestratorService from DI`);
              return this.legalManagerOrchestratorService;

            case 'ProductivityManagerOrchestratorService':
              if (!this.productivityManagerOrchestratorService) {
                throw new Error(`ProductivityManagerOrchestratorService not available in DI container. Is ProductivityManagerOrchestratorModule imported in AppModule?`);
              }
              this.logger.debug(`✅ Returning ProductivityManagerOrchestratorService from DI`);
              return this.productivityManagerOrchestratorService;

            default:
              throw new Error(`Unknown orchestrator service: ${serviceName}. Check if the corresponding module is imported in AppModule.`);
          }
        }

        case 'function': {
          this.logger.debug(`⚙️ Creating TypeScript function agent`);
          return new ServiceClass(
            this.httpService,
            this.llmService,
            this.taskProgressGateway,
            this.tasksService,
            this.taskStatusService,
            this.deliverablesService, // Pass DeliverablesService
            undefined, // mcpClientService (removed)
            this.agentRegistrationService,
            undefined, // jsonRpcProtocolService
            undefined, // loggingService
            undefined, // authService
            this.configurationService,
          );
        }

        case 'python-function': {
          this.logger.debug(`🐍 Creating Python function agent`);
          return new ServiceClass(
            this.httpService,
            this.llmService,
            this.taskProgressGateway,
            this.tasksService,
            this.taskStatusService,
          );
        }

        case 'context': {
          this.logger.debug(`📝 Creating context agent`);
          this.logger.debug(
            `📝 Injecting services: taskStatusService=${!!this.taskStatusService}, tasksService=${!!this.tasksService}, deliverablesService=${!!this.deliverablesService}`,
          );
          return new ServiceClass(
            this.httpService,
            this.llmService,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            this.taskStatusService,
            this.tasksService,
            this.deliverablesService, // Now inject DeliverablesService for context agents
          );
        }

        case 'api': {
          this.logger.debug(`🌐 Creating API agent`);
          this.logger.debug(
            `🌐 Injecting services: taskStatusService=${!!this.taskStatusService}, tasksService=${!!this.tasksService}`,
          );
          return new ServiceClass(
            this.httpService,
            undefined, // agentRegistrationService
            undefined, // jsonRpcProtocolService
            undefined, // loggingService
            undefined, // authService
            this.configurationService,
            this.taskStatusService,
            this.tasksService,
          );
        }

        case 'external': {
          this.logger.debug(`🔗 Creating external A2A agent`);
          return new ServiceClass(
            this.httpService,
            this.configurationService,
            this.agentRegistrationService,
          );
        }

        default: {
          this.logger.warn(
            `❓ Unknown agent type: ${config.type}, using minimal dependencies`,
          );
          return new ServiceClass(this.httpService);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to instantiate ${serviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize the agent instance
   */
  private async initializeAgent(
    serviceInstance: any,
    discoveredAgent: DiscoveredAgent,
    config: AgentConfig,
  ): Promise<void> {
    // Set discovered path
    if (typeof serviceInstance.setDiscoveredPath === 'function') {
      serviceInstance.setDiscoveredPath(discoveredAgent.path);
      this.logger.debug(`🗂️ Set discovered path for ${config.name}`);
    }

    // Set up function paths based on agent type BEFORE calling onModuleInit
    await this.setupAgentFunctions(serviceInstance, discoveredAgent, config);

    // Call onModuleInit to trigger configuration loading
    if (typeof serviceInstance.onModuleInit === 'function') {
      try {
        this.logger.debug(`🔧 Calling onModuleInit for ${config.name}...`);
        await serviceInstance.onModuleInit();
        this.logger.debug(`✅ onModuleInit completed for ${config.name}`);
      } catch (initError: any) {
        this.logger.error(
          `❌ onModuleInit failed for ${config.name}:`,
          initError.message,
        );
        // Don't throw - let agent continue with fallback behavior
      }
    }

    // For context agents, load context data
    if (
      config.type === 'context' &&
      typeof serviceInstance.setContextData === 'function'
    ) {
      try {
        await this.loadContextData(serviceInstance, discoveredAgent);
      } catch (contextError: any) {
        this.logger.error(
          `❌ Failed to load context for ${config.name}:`,
          contextError.message,
        );
        // Don't throw - let agent continue without context
      }
    }
  }

  /**
   * Set up function paths and functions for function-based agents
   */
  private async setupAgentFunctions(
    serviceInstance: any,
    discoveredAgent: DiscoveredAgent,
    config: AgentConfig,
  ): Promise<void> {
    const agentDirectory = path.dirname(discoveredAgent.servicePath);

    this.logger.debug(`🔧 Setting up functions for ${config.name}:`);
    this.logger.debug(`   - Config type: ${config.type}`);
    this.logger.debug(`   - Agent directory: ${agentDirectory}`);
    this.logger.debug(
      `   - Service instance type: ${serviceInstance.constructor.name}`,
    );

    if (config.type === 'function') {
      // Set up TypeScript function agent
      const functionPath = path.join(agentDirectory, 'agent-function.ts');

      if (fs.existsSync(functionPath)) {
        try {
          // Import the function module
          const relativePath = functionPath
            .replace(process.cwd() + '/src/', './')
            .replace('.ts', '');

          const functionModule = await import(relativePath);

          // Look for the exported function (usually named executeAgentFunction)
          const agentFunction =
            functionModule.executeAgentFunction ||
            functionModule.default ||
            Object.values(functionModule)[0];

          if (typeof agentFunction === 'function') {
            serviceInstance.setAgentFunction(agentFunction);
            this.logger.debug(
              `⚙️ Loaded TypeScript function for ${config.name}`,
            );
          } else {
            this.logger.warn(`❓ No valid function found in ${functionPath}`);
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Failed to load function for ${config.name}:`,
            error.message,
          );
        }
      } else {
        this.logger.warn(
          `❓ No agent-function.ts found for ${config.name} at ${functionPath}`,
        );
      }
    }

    if (config.type === 'python-function') {
      // Set up Python function agent
      const pythonFunctionPath = path.join(agentDirectory, 'agent-function.py');

      this.logger.debug(`🔍 Checking Python function for ${config.name}:`);
      this.logger.debug(`   - Expected path: ${pythonFunctionPath}`);
      this.logger.debug(
        `   - File exists: ${fs.existsSync(pythonFunctionPath)}`,
      );
      this.logger.debug(`   - Agent directory: ${agentDirectory}`);

      if (fs.existsSync(pythonFunctionPath)) {
        serviceInstance.setPythonScriptPath(pythonFunctionPath);
        this.logger.debug(
          `🐍 Set Python script path for ${config.name}: ${pythonFunctionPath}`,
        );
      } else {
        this.logger.warn(
          `❓ No agent-function.py found for ${config.name} at ${pythonFunctionPath}`,
        );
      }
    }
  }

  /**
   * Load context data for context agents
   */
  private async loadContextData(
    serviceInstance: any,
    discoveredAgent: DiscoveredAgent,
  ): Promise<void> {
    const agentDirectory = path.dirname(discoveredAgent.servicePath);

    // Initialize context from AgentContextService (loads YAML data including skills)
    if (typeof serviceInstance.initializeContext === 'function') {
      await serviceInstance.initializeContext(agentDirectory);
      this.logger.debug(
        `📋 Initialized context service for ${discoveredAgent.name}`,
      );
    }

    // Load markdown context data if available
    const contextPath = path.join(agentDirectory, 'context.md');
    if (fs.existsSync(contextPath)) {
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      serviceInstance.setContextData(contextContent);
      this.logger.debug(`📄 Loaded context data for ${discoveredAgent.name}`);
    }
  }

  /**
   * Create default configuration when YAML is missing or invalid
   */
  private createDefaultConfig(discoveredAgent: DiscoveredAgent): AgentConfig {
    // Infer type from path structure
    const inferredType = this.inferTypeFromPath(discoveredAgent.path);

    return {
      name: discoveredAgent.name,
      type: inferredType,
      description: `${discoveredAgent.name} - Auto-generated configuration`,
      capabilities: [],
      skills: [],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json'],
      metadata: {
        version: '1.0.0',
        autoGenerated: true,
      },
    };
  }

  /**
   * Validate and normalize YAML configuration
   */
  private validateAndNormalizeConfig(
    yamlData: Record<string, unknown>,
    discoveredAgent: DiscoveredAgent,
  ): AgentConfig {
    const config: AgentConfig = {
      name: (yamlData.name as string) || discoveredAgent.name,
      type:
        this.validateAgentType(yamlData.type as string) ||
        this.inferTypeFromPath(discoveredAgent.path),
      description: yamlData.description as string,
      capabilities: Array.isArray(yamlData.capabilities)
        ? (yamlData.capabilities as string[])
        : [],
      skills: Array.isArray(yamlData.skills)
        ? (yamlData.skills as string[])
        : [],
      inputModes: Array.isArray(yamlData.inputModes)
        ? (yamlData.inputModes as string[])
        : ['text/plain', 'application/json'],
      outputModes: Array.isArray(yamlData.outputModes)
        ? (yamlData.outputModes as string[])
        : ['text/plain', 'application/json'],
      metadata: (yamlData.metadata as Record<string, any>) || {},
    };

    return config;
  }

  /**
   * Validate agent type from YAML
   */
  private validateAgentType(type: string): AgentConfig['type'] | null {
    const validTypes: AgentConfig['type'][] = [
      'orchestrator',
      'function',
      'python-function',
      'context',
      'api',
      'external',
    ];
    return validTypes.includes(type as AgentConfig['type'])
      ? (type as AgentConfig['type'])
      : null;
  }

  /**
   * Infer agent type from directory path
   */
  private inferTypeFromPath(agentPath: string): AgentConfig['type'] {
    if (agentPath.includes('orchestrator')) {
      return 'orchestrator';
    } else if (agentPath.includes('external')) {
      return 'external';
    } else {
      // Default to context for specialists
      return 'context';
    }
  }
}
