import { apiService } from './apiService';
import {
  MCPRegistration,
  MCPPoolStats,
  MCPDiscoveryResult,
  MCPCapabilitiesDocument,
  MCPOrchestrationInfo,
  MCPToolsInfo,
  MCPExecutionRequest,
  MCPExecutionResult,
  MCPHealthInfo,
  MCPListItem
} from '../types/mcp';

/**
 * MCP Service for interacting with the MCP Pool API
 */
class MCPService {
  
  /**
   * Get MCP client health status
   */
  async getPoolHealth(): Promise<MCPHealthInfo> {
    try {
      const response = await apiService.get('/mcp/health');
      return {
        status: response.status === 'healthy' ? 'healthy' : 'degraded',
        poolSize: response.poolSize || 0,
        onlineMCPs: response.onlineMCPs || 0,
        healthScore: response.healthScore || 0,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'offline',
        poolSize: 0,
        onlineMCPs: 0,
        healthScore: 0,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get MCP client statistics (placeholder for compatibility)
   */
  async getPoolStats(): Promise<MCPPoolStats> {
    try {
      const health = await this.getPoolHealth();
      return {
        totalRegistered: health.poolSize,
        totalOnline: health.onlineMCPs,
        totalTools: 0, // Will be calculated from MCP services
        totalExecutions: 0, // Not tracked in current system
        averageResponseTime: 0, // Not tracked in current system
        lastUpdated: new Date()
      };
    } catch (error) {
      return {
        totalRegistered: 0,
        totalOnline: 0,
        totalTools: 0,
        totalExecutions: 0,
        averageResponseTime: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get all registered MCP services
   */
  async getRegisteredMCPs(): Promise<MCPRegistration[]> {
    const response = await apiService.get('/mcp/mcps');
    return response.map((mcp: any) => ({
      ...mcp,
      discoveredAt: new Date(mcp.discoveredAt),
      registeredAt: mcp.registeredAt ? new Date(mcp.registeredAt) : undefined,
      lastHeartbeat: mcp.lastHeartbeat ? new Date(mcp.lastHeartbeat) : undefined
    }));
  }

  /**
   * Get only online MCP services
   */
  async getOnlineMCPs(): Promise<MCPRegistration[]> {
    const allMCPs = await this.getRegisteredMCPs();
    return allMCPs.filter(mcp => mcp.status === 'online');
  }

  /**
   * Get MCP services by type
   */
  async getMCPsByType(type: string): Promise<MCPRegistration[]> {
    const allMCPs = await this.getRegisteredMCPs();
    return allMCPs.filter(mcp => mcp.type === type);
  }

  /**
   * Get MCP services by provider
   */
  async getMCPsByProvider(provider: string): Promise<MCPRegistration[]> {
    const allMCPs = await this.getRegisteredMCPs();
    return allMCPs.filter(mcp => mcp.provider === provider);
  }

  /**
   * Get comprehensive MCP capabilities document for orchestrator
   */
  async getCapabilitiesDocument(): Promise<MCPCapabilitiesDocument> {
    try {
      const [mcps, tools, health] = await Promise.all([
        this.getRegisteredMCPs(),
        this.getAllAvailableTools(),
        this.getPoolHealth()
      ]);

      return {
        version: '1.0.0',
        mcps: mcps,
        tools: tools,
        capabilities: {
          database: true,
          analytics: true,
          automation: false
        },
        health: health,
        generatedAt: new Date()
      };
    } catch (error) {
      return {
        version: '1.0.0',
        mcps: [],
        tools: { total_tools: 0, services: [], categories: {} },
        capabilities: { database: false, analytics: false, automation: false },
        health: { status: 'offline', poolSize: 0, onlineMCPs: 0, healthScore: 0, lastCheck: new Date() },
        generatedAt: new Date()
      };
    }
  }

  /**
   * Get orchestration-friendly MCP list for LLM prompts
   */
  async getOrchestrationMCPList(): Promise<MCPOrchestrationInfo> {
    const mcps = await this.getRegisteredMCPs();
    return {
      available_mcps: mcps.map(mcp => ({
        id: mcp.id,
        name: mcp.name,
        type: mcp.type,
        status: mcp.status,
        capabilities: mcp.capabilities || []
      })),
      total_count: mcps.length,
      online_count: mcps.filter(mcp => mcp.status === 'online').length
    };
  }

  /**
   * Get all available tools across MCP services
   */
  async getAllAvailableTools(): Promise<MCPToolsInfo> {
    const response = await apiService.get('/mcp/tools');
    return response;
  }

  /**
   * Trigger manual MCP service discovery
   */
  async triggerDiscovery(): Promise<MCPDiscoveryResult> {
    // Since we only have one MCP server (Supabase), just return its current status
    const mcps = await this.getRegisteredMCPs();
    return {
      total_searched: 1,
      total_discovered: mcps.length,
      discovered: mcps.map(mcp => ({
        id: mcp.id,
        name: mcp.name,
        type: mcp.type,
        status: mcp.status,
        discoveredAt: new Date()
      })),
      errors: [],
      discoveredAt: new Date()
    };
  }

  /**
   * Execute a tool on a specific MCP service
   */
  async executeMCPTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
    // For now, this would need to be implemented if the frontend needs direct tool execution
    // Currently, tool execution goes through the metrics agent and other agents
    throw new Error('Direct MCP tool execution not implemented in current architecture. Use specific agent endpoints instead.');
  }

  /**
   * Register a new MCP service manually (not applicable with single server)
   */
  async registerMCP(registration: Omit<MCPRegistration, 'discoveredAt' | 'registeredAt' | 'lastHeartbeat'>): Promise<void> {
    throw new Error('Manual MCP registration not supported with single server architecture');
  }

  /**
   * Unregister an MCP service (not applicable with single server)
   */
  async unregisterMCP(mcpId: string): Promise<void> {
    throw new Error('MCP unregistration not supported with single server architecture');
  }

  /**
   * Send heartbeat for an MCP service (handled internally)
   */
  async sendHeartbeat(mcpId: string, metrics?: any): Promise<void> {
    // Heartbeats are handled internally by the MCP client service
    console.log(`Heartbeat requested for ${mcpId} - handled internally`);
  }

  /**
   * Get specific MCP service details
   */
  async getMCPDetails(mcpId: string): Promise<MCPRegistration> {
    const allMCPs = await this.getRegisteredMCPs();
    const mcp = allMCPs.find(m => m.id === mcpId);
    
    if (!mcp) {
      throw new Error(`MCP service with ID ${mcpId} not found`);
    }
    
    return mcp;
  }

  /**
   * Convert MCP registrations to UI-friendly list items
   */
  convertToListItems(mcps: MCPRegistration[]): MCPListItem[] {
    return mcps.map(mcp => ({
      id: mcp.id,
      name: mcp.name,
      type: mcp.type,
      status: mcp.status,
      provider: mcp.provider,
      toolCount: mcp.tools.length,
      capabilityCount: mcp.capabilities.length,
      lastSeen: mcp.lastHeartbeat || mcp.discoveredAt,
      healthScore: this.calculateHealthScore(mcp)
    }));
  }

  /**
   * Calculate health score for an MCP service
   */
  private calculateHealthScore(mcp: MCPRegistration): number {
    if (mcp.status === 'offline') return 0;
    if (mcp.status === 'discovering') return 50;
    
    let score = 100;
    
    // Reduce score based on time since last heartbeat
    if (mcp.lastHeartbeat) {
      const minutesSinceHeartbeat = (Date.now() - mcp.lastHeartbeat.getTime()) / (1000 * 60);
      if (minutesSinceHeartbeat > 5) {
        score -= Math.min(50, minutesSinceHeartbeat * 2);
      }
    }
    
    // Factor in error rate if available
    if (mcp.metrics?.errorRate) {
      score -= mcp.metrics.errorRate * 30;
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Format time since for display
   */
  formatTimeSince(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
  }

  /**
   * Get status color for UI display
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'danger';
      case 'discovering': return 'warning';
      default: return 'medium';
    }
  }

  /**
   * Get type color for UI display
   */
  getTypeColor(type: string): string {
    switch (type) {
      case 'database': return 'primary';
      case 'api': return 'secondary';
      case 'file': return 'tertiary';
      case 'communication': return 'success';
      case 'computation': return 'warning';
      case 'external': return 'medium';
      default: return 'dark';
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService();
export default mcpService;