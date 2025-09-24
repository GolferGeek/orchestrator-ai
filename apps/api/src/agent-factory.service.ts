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
import { AgentServicesContext } from './agents/base/services/agent-services-context';
import { FunctionAgentServicesContext } from './agents/base/services/function-agent-services-context';
import { ApiAgentServicesContext } from './agents/base/services/api-agent-services-context';
import { PythonFunctionAgentServicesContext } from './agents/base/services/python-function-agent-services-context';
import { ExternalAgentServicesContext } from './agents/base/services/external-agent-services-context';
import { OrchestratorAgentServicesContext } from './agents/base/implementations/base-services/orchestrator/orchestrator-agent-services.context';
import { MarketingManagerOrchestratorService } from './agents/demo/marketing/marketing_manager_orchestrator/agent-service';
import { CEOOrchestratorService } from './agents/demo/orchestrator/ceo_orchestrator/agent-service';
import { EngineeringManagerOrchestratorService } from './agents/demo/engineering/engineering_manager_orchestrator/agent-service';
import { OperationsManagerOrchestratorService } from './agents/demo/operations/operations_manager_orchestrator/agent-service';
import { FinanceManagerOrchestratorService } from './agents/demo/finance/finance_manager_orchestrator/agent-service';
import { HRManagerOrchestratorService } from './agents/demo/hr/hr_manager_orchestrator/agent-service';
import { SalesManagerOrchestratorService } from './agents/demo/sales/sales_manager_orchestrator/agent-service';
import { ProductManagerOrchestratorService } from './agents/demo/product/product_manager_orchestrator/agent-service';
import { ResearchManagerOrchestratorService } from './agents/demo/research/research_manager_orchestrator/agent-service';
import { SpecialistsManagerOrchestratorService } from './agents/demo/specialists/specialists_manager_orchestrator/agent-service';
import { LegalManagerOrchestratorService } from './agents/demo/legal/legal_manager_orchestrator/agent-service';
import { ProductivityManagerOrchestratorService } from './agents/demo/productivity/productivity_manager_orchestrator/agent-service';
// Note: MCPClientService removed - replaced with LangChain.js services

export interface DiscoveredAgent {
  name: string;
  type: string;
  namespace: string;
  relativePath: string;
  namespacedPath: string;
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
    @Optional() private readonly agentServicesContext?: AgentServicesContext,
    @Optional()
    private readonly functionAgentServicesContext?: FunctionAgentServicesContext,
    @Optional()
    private readonly apiAgentServicesContext?: ApiAgentServicesContext,
    @Optional()
    private readonly pythonFunctionAgentServicesContext?: PythonFunctionAgentServicesContext,
    @Optional()
    private readonly externalAgentServicesContext?: ExternalAgentServicesContext,
    @Optional()
    private readonly orchestratorAgentServicesContext?: OrchestratorAgentServicesContext,
    @Optional()
    private readonly marketingManagerOrchestratorService?: MarketingManagerOrchestratorService,
    @Optional()
    private readonly ceoOrchestratorService?: CEOOrchestratorService,
    @Optional()
    private readonly engineeringManagerOrchestratorService?: EngineeringManagerOrchestratorService,
    @Optional()
    private readonly operationsManagerOrchestratorService?: OperationsManagerOrchestratorService,
    @Optional()
    private readonly financeManagerOrchestratorService?: FinanceManagerOrchestratorService,
    @Optional()
    private readonly hrManagerOrchestratorService?: HRManagerOrchestratorService,
    @Optional()
    private readonly salesManagerOrchestratorService?: SalesManagerOrchestratorService,
    @Optional()
    private readonly productManagerOrchestratorService?: ProductManagerOrchestratorService,
    @Optional()
    private readonly researchManagerOrchestratorService?: ResearchManagerOrchestratorService,
    @Optional()
    private readonly specialistsManagerOrchestratorService?: SpecialistsManagerOrchestratorService,
    @Optional()
    private readonly legalManagerOrchestratorService?: LegalManagerOrchestratorService,
    @Optional()
    private readonly productivityManagerOrchestratorService?: ProductivityManagerOrchestratorService,
    // mcpClientService removed - using LangChain.js services instead
    // supabaseToolsService removed - using utility functions instead
  ) {

  }

  /**
   * Create an agent instance from discovered metadata
   */
  async createAgent(discoveredAgent: DiscoveredAgent): Promise<any> {

    try {
      // Load agent configuration from YAML

      const config = await this.loadAgentConfig(discoveredAgent);

      // Import the service class

      const ServiceClass = await this.importServiceClass(discoveredAgent);
      if (!ServiceClass) {
        throw new Error(`No service class found for ${discoveredAgent.name}`);
      }

      // Store the service class on the discovered agent
      discoveredAgent.serviceClass = ServiceClass;

      // Create instance based on agent type

      const serviceInstance = await this.instantiateAgent(ServiceClass, config);

      // Set discovered path and initialize

      await this.initializeAgent(serviceInstance, discoveredAgent, config);

      // Store the instance
      discoveredAgent.serviceInstance = serviceInstance;

      return serviceInstance;
    } catch (error: any) {

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

    if (!fs.existsSync(yamlPath)) {

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
      const isCompiled =
        servicePath.includes('/dist/') ||
        require.resolve('./app.module').includes('/dist/');

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
            importPath =
              '.' + servicePath.substring(srcIndex).replace('.ts', '');
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

    try {
      switch (config.type) {
        case 'orchestrator': {

          if (!this.orchestratorAgentServicesContext) {
            throw new Error(
              'OrchestratorAgentServicesContext not available - required for orchestrator agents. Please ensure OrchestratorAgentServicesContextModule is imported.',
            );
          }

          return new ServiceClass(this.orchestratorAgentServicesContext);
        }

        case 'function': {

          if (!this.functionAgentServicesContext) {
            throw new Error(
              'FunctionAgentServicesContext not available - required for function agents. Please ensure FunctionAgentServicesContextModule is imported.',
            );
          }

          return new ServiceClass(this.functionAgentServicesContext);
        }

        case 'python-function': {

          if (!this.pythonFunctionAgentServicesContext) {
            throw new Error(
              'PythonFunctionAgentServicesContext not available - required for Python function agents. Please ensure PythonFunctionAgentServicesContextModule is imported.',
            );
          }

          return new ServiceClass(this.pythonFunctionAgentServicesContext);
        }

        case 'context': {

          if (!this.agentServicesContext) {
            throw new Error(
              'AgentServicesContext not available - required for context agents. Please ensure AgentServicesContextModule is imported.',
            );
          }

          return new ServiceClass(this.agentServicesContext);
        }

        case 'api': {

          if (!this.apiAgentServicesContext) {
            throw new Error(
              'ApiAgentServicesContext not available - required for API agents. Please ensure ApiAgentServicesContextModule is imported.',
            );
          }

          return new ServiceClass(this.apiAgentServicesContext);
        }

        case 'external': {

          if (!this.externalAgentServicesContext) {
            throw new Error('ExternalAgentServicesContext not available');
          }

          return new ServiceClass(this.externalAgentServicesContext);
        }

        default: {

          return new ServiceClass(this.httpService);
        }
      }
    } catch (error: any) {

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

    }

    // Set up function paths based on agent type BEFORE calling onModuleInit
    await this.setupAgentFunctions(serviceInstance, discoveredAgent, config);

    // Call onModuleInit to trigger configuration loading
    if (typeof serviceInstance.onModuleInit === 'function') {
      try {

        await serviceInstance.onModuleInit();

      } catch (initError: any) {

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

          } else {

          }
        } catch (error: any) {

        }
      } else {

      }
    }

    if (config.type === 'python-function') {
      // Set up Python function agent
      const pythonFunctionPath = path.join(agentDirectory, 'agent-function.py');

      if (fs.existsSync(pythonFunctionPath)) {
        serviceInstance.setPythonScriptPath(pythonFunctionPath);

      } else {

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

    }

    // Load markdown context data if available
    const contextPath = path.join(agentDirectory, 'context.md');
    if (fs.existsSync(contextPath)) {
      const contextContent = fs.readFileSync(contextPath, 'utf8');
      serviceInstance.setContextData(contextContent);

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
