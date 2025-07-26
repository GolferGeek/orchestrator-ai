/**
 * MCP Pool Service
 * 
 * Manages a pool of MCP (Model Context Protocol) services, providing
 * discovery, registration, health monitoring, and orchestration capabilities.
 * Mirrors the AgentPoolService architecture for consistency.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import {
  MCPRegistration,
  MCPHeartbeat,
  MCPCapabilitiesDocument,
  MCPPoolStats,
  MCPDiscoveryResult,
  MCPDiscoveryError,
  MCPExecutionRequest,
  MCPExecutionResult,
  MCPDiscoveryConfig,
  MCPInfo,
  MCPCapability,
  MCPTool
} from './interfaces';

@Injectable()
export class MCPPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPPoolService.name);
  private readonly mcps = new Map<string, MCPRegistration>();
  private readonly heartbeatInterval = 60000; // 60 seconds
  private readonly heartbeatTimeout = 180000; // 3 minutes (3 missed heartbeats = offline)
  private readonly discoveryConfig: MCPDiscoveryConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Initialize discovery configuration
    this.discoveryConfig = {
      enabled: this.configService.get<boolean>('MCP_DISCOVERY_ENABLED', true),
      intervalMs: this.configService.get<number>('MCP_DISCOVERY_INTERVAL_MS', 300000), // 5 minutes
      discoveryEndpoints: [
        'http://localhost:4000/mcp', // Local MCP services
      ],
      autoRegister: this.configService.get<boolean>('MCP_AUTO_REGISTER', true),
      healthCheckIntervalMs: this.configService.get<number>('MCP_HEALTH_CHECK_INTERVAL_MS', 120000), // 2 minutes
      timeoutMs: this.configService.get<number>('MCP_DISCOVERY_TIMEOUT_MS', 10000), // 10 seconds
    };

    this.logger.log('MCP Pool Service initialized');
  }

  async onModuleInit() {
    if (this.discoveryConfig.enabled) {
      this.logger.log('Starting MCP discovery on module init');
      await this.discoverMCPServices();
    }
  }

  /**
   * Register an MCP service with the pool
   */
  async registerMCP(registration: MCPRegistration): Promise<void> {
    const mcpId = registration.id;

    this.logger.log(
      `Registering MCP: ${mcpId} (${registration.name}) at ${registration.url}`,
    );

    // Add/update MCP registration
    this.mcps.set(mcpId, {
      ...registration,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'online',
    });

    this.logger.log(
      `MCP ${mcpId} registered successfully. Pool size: ${this.mcps.size}`,
    );
  }

  /**
   * Receive heartbeat from an MCP service
   */
  async receiveHeartbeat(heartbeat: MCPHeartbeat): Promise<void> {
    const mcp = this.mcps.get(heartbeat.mcpId);

    if (!mcp) {
      this.logger.warn(
        `Received heartbeat from unregistered MCP: ${heartbeat.mcpId}`,
      );
      return;
    }

    // Update heartbeat timestamp and status
    mcp.lastHeartbeat = new Date();
    mcp.status = 'online';
    mcp.metrics = heartbeat.metrics;

    this.logger.debug(`Heartbeat received from ${heartbeat.mcpId}`);
  }

  /**
   * Unregister an MCP service from the pool  
   */
  async unregisterMCP(mcpId: string): Promise<void> {
    if (this.mcps.has(mcpId)) {
      this.mcps.delete(mcpId);
      this.logger.log(
        `MCP ${mcpId} unregistered. Pool size: ${this.mcps.size}`,
      );
    }
  }

  /**
   * Get all registered MCP services
   */
  getRegisteredMCPs(): MCPRegistration[] {
    return Array.from(this.mcps.values());
  }

  /**
   * Get online MCP services only
   */
  getOnlineMCPs(): MCPRegistration[] {
    return Array.from(this.mcps.values()).filter(
      (mcp) => mcp.status === 'online',
    );
  }

  /**
   * Get MCP service by ID
   */
  getMCP(mcpId: string): MCPRegistration | undefined {
    return this.mcps.get(mcpId);
  }

  /**
   * Get MCP services by type
   */
  getMCPsByType(type: string): MCPRegistration[] {
    return Array.from(this.mcps.values()).filter(
      (mcp) => mcp.type === type,
    );
  }

  /**
   * Get MCP services by provider
   */
  getMCPsByProvider(provider: string): MCPRegistration[] {
    return Array.from(this.mcps.values()).filter(
      (mcp) => mcp.provider === provider,
    );
  }

  /**
   * Execute a tool on a specific MCP service
   */
  async executeMCPTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
    const mcp = this.getMCP(request.mcpId);
    if (!mcp) {
      throw new Error(`MCP service not found: ${request.mcpId}`);
    }

    if (mcp.status !== 'online') {
      throw new Error(`MCP service is not online: ${request.mcpId} (status: ${mcp.status})`);
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.debug(`Executing tool ${request.toolName} on MCP ${request.mcpId}`);

      // Make HTTP request to MCP service
      const response = await firstValueFrom(
        this.httpService.post(
          `${mcp.url}/tools/${request.toolName}`,
          {
            arguments: request.parameters,
            execution_id: executionId,
            user_id: request.userId,
            session_id: request.sessionId,
          },
          {
            timeout: request.timeout || 30000,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const executionTime = Date.now() - startTime;

      // Update metrics
      if (mcp.metrics) {
        mcp.metrics.totalExecutions++;
        mcp.metrics.successfulExecutions++;
        mcp.metrics.averageExecutionTime = 
          (mcp.metrics.averageExecutionTime + executionTime) / 2;
        mcp.metrics.lastExecutionAt = new Date();
        
        if (!mcp.metrics.toolsUsed) {
          mcp.metrics.toolsUsed = {};
        }
        if (!mcp.metrics.toolsUsed[request.toolName]) {
          mcp.metrics.toolsUsed[request.toolName] = 0;
        }
        mcp.metrics.toolsUsed[request.toolName] = (mcp.metrics.toolsUsed[request.toolName] || 0) + 1;
      }

      return {
        success: true,
        data: response.data,
        executionTime,
        mcpId: request.mcpId,
        toolName: request.toolName,
        timestamp: new Date(),
        executionId,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update error metrics
      if (mcp.metrics) {
        mcp.metrics.totalExecutions++;
        mcp.metrics.failedExecutions++;
        mcp.metrics.errorRate = mcp.metrics.failedExecutions / mcp.metrics.totalExecutions;
      }

      this.logger.error(`MCP tool execution failed for ${request.mcpId}:${request.toolName}`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        mcpId: request.mcpId,
        toolName: request.toolName,
        timestamp: new Date(),
        executionId,
      };
    }
  }

  /**
   * Discover MCP services from configured endpoints
   */
  async discoverMCPServices(): Promise<MCPDiscoveryResult> {
    this.logger.log('Starting MCP service discovery');
    
    const discovered: MCPRegistration[] = [];
    const errors: MCPDiscoveryError[] = [];
    let successfulRegistrations = 0;

    for (const endpoint of this.discoveryConfig.discoveryEndpoints) {
      try {
        this.logger.debug(`Discovering MCPs at ${endpoint}`);
        
        // Try to get list of available MCP services
        const response = await firstValueFrom(
          this.httpService.get(`${endpoint}/discover`, {
            timeout: this.discoveryConfig.timeoutMs,
          }),
        );

        if (response.data && response.data.services) {
          for (const serviceInfo of response.data.services) {
            try {
              const mcpRegistration = await this.createMCPRegistrationFromDiscovery(serviceInfo, endpoint);
              discovered.push(mcpRegistration);
              
              if (this.discoveryConfig.autoRegister) {
                await this.registerMCP(mcpRegistration);
                successfulRegistrations++;
              }
            } catch (error) {
              errors.push({
                source: `${endpoint}/${serviceInfo.id}`,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                retryable: true,
              });
            }
          }
        }

      } catch (error) {
        errors.push({
          source: endpoint,
          error: error instanceof Error ? error.message : 'Discovery endpoint unreachable',
          timestamp: new Date(),
          retryable: true,
        });
      }
    }

    const result: MCPDiscoveryResult = {
      discovered,
      errors,
      discoveredAt: new Date(),
      totalFound: discovered.length,
      successfulRegistrations,
    };

    this.logger.log(
      `MCP discovery completed: ${result.totalFound} found, ${result.successfulRegistrations} registered, ${result.errors.length} errors`,
    );

    return result;
  }

  /**
   * Create MCP registration from discovery data
   */
  private async createMCPRegistrationFromDiscovery(
    serviceInfo: any,
    baseUrl: string,
  ): Promise<MCPRegistration> {
    // Get detailed service information
    const detailResponse = await firstValueFrom(
      this.httpService.get(`${baseUrl}/${serviceInfo.path}`, {
        timeout: this.discoveryConfig.timeoutMs,
      }),
    );

    const details = detailResponse.data;

    return {
      id: serviceInfo.id,
      name: serviceInfo.name || serviceInfo.id,
      type: this.inferMCPType(serviceInfo),
      url: `${baseUrl}/${serviceInfo.path}`,
      description: serviceInfo.description || `MCP service: ${serviceInfo.name}`,
      capabilities: details.capabilities || [],
      tools: details.tools || [],
      version: details.version || '1.0.0',
      provider: details.provider || 'unknown',
      status: 'discovering',
      discoveredAt: new Date(),
      healthEndpoint: `${baseUrl}/${serviceInfo.path}/health`,
      discoveryEndpoint: `${baseUrl}/${serviceInfo.path}/discover`,
      metadata: {
        discoveredFrom: baseUrl,
        ...details.metadata,
      },
    };
  }

  /**
   * Infer MCP type from service information
   */
  private inferMCPType(serviceInfo: any): MCPRegistration['type'] {
    const name = serviceInfo.name?.toLowerCase() || serviceInfo.id?.toLowerCase() || '';
    
    if (name.includes('database') || name.includes('supabase') || name.includes('sql')) {
      return 'database';
    }
    if (name.includes('file') || name.includes('storage') || name.includes('fs')) {
      return 'file';
    }
    if (name.includes('mail') || name.includes('gmail') || name.includes('message')) {
      return 'communication';
    }
    if (name.includes('api') || name.includes('rest') || name.includes('http')) {
      return 'api';
    }
    if (name.includes('compute') || name.includes('calc') || name.includes('math')) {
      return 'computation';
    }
    
    return 'external';
  }

  /**
   * Generate comprehensive capabilities document for orchestrator
   */
  generateCapabilitiesDocument(): MCPCapabilitiesDocument {
    const onlineMCPs = this.getOnlineMCPs();
    
    // Aggregate all capabilities by category
    const capabilitiesByCategory = {
      data: [] as MCPCapability[],
      api: [] as MCPCapability[],
      file: [] as MCPCapability[],
      computation: [] as MCPCapability[],
      communication: [] as MCPCapability[],
      other: [] as MCPCapability[],
    };

    let totalTools = 0;
    const mcpsByProvider: Record<string, number> = {};

    onlineMCPs.forEach(mcp => {
      totalTools += mcp.tools.length;
      
      // Count by provider
      mcpsByProvider[mcp.provider] = (mcpsByProvider[mcp.provider] || 0) + 1;
      
      // Categorize capabilities
      mcp.capabilities.forEach(capability => {
        capabilitiesByCategory[capability.category].push(capability);
      });
    });

    const capabilitiesDoc: MCPCapabilitiesDocument = {
      generatedAt: new Date(),
      totalMCPs: onlineMCPs.length,
      mcpsByType: {
        database: onlineMCPs.filter(m => m.type === 'database').length,
        api: onlineMCPs.filter(m => m.type === 'api').length,
        file: onlineMCPs.filter(m => m.type === 'file').length,
        communication: onlineMCPs.filter(m => m.type === 'communication').length,
        computation: onlineMCPs.filter(m => m.type === 'computation').length,
        external: onlineMCPs.filter(m => m.type === 'external').length,
      },
      mcpsByProvider,
      totalTools,
      totalCapabilities: Object.values(capabilitiesByCategory).reduce((sum, caps) => sum + caps.length, 0),
      capabilitiesByCategory,
      mcps: onlineMCPs.map(mcp => ({
        id: mcp.id,
        name: mcp.name,
        type: mcp.type,
        url: mcp.url,
        description: mcp.description,
        capabilities: mcp.capabilities,
        tools: mcp.tools,
        provider: mcp.provider,
        version: mcp.version,
        status: mcp.status,
        lastHeartbeat: mcp.lastHeartbeat,
        metrics: mcp.metrics,
        metadata: mcp.metadata,
      })),
    };

    this.logger.debug(
      `Generated MCP capabilities document with ${capabilitiesDoc.totalMCPs} MCPs and ${capabilitiesDoc.totalTools} tools`,
    );

    return capabilitiesDoc;
  }

  /**
   * Get orchestrator-friendly MCP list for LLM prompts
   */
  getOrchestrationMCPList(): string {
    const onlineMCPs = this.getOnlineMCPs();
    const mcpDescriptions: string[] = [];

    if (onlineMCPs.length === 0) {
      return 'No MCP services are currently available.';
    }

    mcpDescriptions.push('**Available MCP Services:**');
    mcpDescriptions.push('');

    // Group by type
    const mcpsByType: Record<string, MCPRegistration[]> = {};
    onlineMCPs.forEach(mcp => {
      const typeKey = mcp.type as keyof typeof mcpsByType;
      if (!mcpsByType[typeKey]) {
        mcpsByType[typeKey] = [];
      }
      mcpsByType[typeKey].push(mcp);
    });

    Object.entries(mcpsByType).forEach(([type, mcps]) => {
      mcpDescriptions.push(`**${type.charAt(0).toUpperCase() + type.slice(1)} Services:**`);
      
      mcps.forEach(mcp => {
        mcpDescriptions.push(`- **${mcp.name}** (${mcp.id}): ${mcp.description}`);
        
        if (mcp.capabilities.length > 0) {
          const capabilityNames = mcp.capabilities.map(c => c.name).join(', ');
          mcpDescriptions.push(`  Capabilities: ${capabilityNames}`);
        }
        
        if (mcp.tools.length > 0) {
          const toolNames = mcp.tools.slice(0, 5).map(t => t.name).join(', ');
          const toolSuffix = mcp.tools.length > 5 ? `, +${mcp.tools.length - 5} more` : '';
          mcpDescriptions.push(`  Tools: ${toolNames}${toolSuffix}`);
        }
      });
      
      mcpDescriptions.push('');
    });

    return mcpDescriptions.join('\n');
  }

  /**
   * Check for stale MCPs and mark them offline
   */
  @Interval(120000) // Check every 2 minutes
  private checkMCPHealth(): void {
    const now = new Date();
    const staleMCPs: string[] = [];

    for (const [mcpId, mcp] of this.mcps.entries()) {
      if (!mcp.lastHeartbeat) {
        continue; // Skip MCPs without heartbeat data
      }

      const timeSinceLastHeartbeat = now.getTime() - mcp.lastHeartbeat.getTime();

      if (
        timeSinceLastHeartbeat > this.heartbeatTimeout &&
        mcp.status === 'online'
      ) {
        mcp.status = 'offline';
        staleMCPs.push(mcpId);
      }
    }

    if (staleMCPs.length > 0) {
      this.logger.warn(
        `Marked ${staleMCPs.length} MCPs as offline: ${staleMCPs.join(', ')}`,
      );
    }
  }

  /**
   * Periodic MCP service discovery
   */
  @Interval(300000) // Every 5 minutes
  private async periodicDiscovery(): Promise<void> {
    if (this.discoveryConfig.enabled) {
      await this.discoverMCPServices();
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): MCPPoolStats {
    const mcps = Array.from(this.mcps.values());
    const onlineMCPs = mcps.filter(m => m.status === 'online');
    
    const byProvider: Record<string, number> = {};
    mcps.forEach(mcp => {
      byProvider[mcp.provider] = (byProvider[mcp.provider] || 0) + 1;
    });

    const totalTools = mcps.reduce((sum, mcp) => sum + mcp.tools.length, 0);
    const totalCapabilities = mcps.reduce((sum, mcp) => sum + mcp.capabilities.length, 0);
    const healthScore = mcps.length > 0 ? Math.round((onlineMCPs.length / mcps.length) * 100) : 100;

    return {
      total: mcps.length,
      online: onlineMCPs.length,
      offline: mcps.filter(m => m.status === 'offline').length,
      discovering: mcps.filter(m => m.status === 'discovering').length,
      byType: {
        database: mcps.filter(m => m.type === 'database').length,
        api: mcps.filter(m => m.type === 'api').length,
        file: mcps.filter(m => m.type === 'file').length,
        communication: mcps.filter(m => m.type === 'communication').length,
        computation: mcps.filter(m => m.type === 'computation').length,
        external: mcps.filter(m => m.type === 'external').length,
      },
      byProvider,
      totalTools,
      totalCapabilities,
      healthScore,
    };
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    this.logger.log('MCP Pool Service shutting down');
    this.mcps.clear();
  }
}