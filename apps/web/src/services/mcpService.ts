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
  MCPListItem,
  MCPType,
  MCPCapability,
  MCPCapabilityCategory
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
        total: health.poolSize,
        online: health.onlineMCPs,
        offline: health.poolSize - health.onlineMCPs,
        discovering: 0,
        byType: {} as Record<MCPType, number>,
        byProvider: {} as Record<string, number>,
        totalTools: 0,
        totalCapabilities: 0,
        healthScore: health.healthScore
      };
    } catch (error) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        discovering: 0,
        byType: {} as Record<MCPType, number>,
        byProvider: {} as Record<string, number>,
        totalTools: 0,
        totalCapabilities: 0,
        healthScore: 0
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
        generatedAt: new Date(),
        totalMCPs: mcps.length,
        mcpsByType: {} as Record<MCPType, number>,
        mcpsByProvider: {} as Record<string, number>,
        totalTools: tools.totalTools,
        totalCapabilities: 0,
        capabilitiesByCategory: {} as Record<MCPCapabilityCategory, MCPCapability[]>,
        mcps: mcps
      };
    } catch (error) {
      return {
        generatedAt: new Date(),
        totalMCPs: 0,
        mcpsByType: {} as Record<MCPType, number>,
        mcpsByProvider: {} as Record<string, number>,
        totalTools: 0,
        totalCapabilities: 0,
        capabilitiesByCategory: {} as Record<MCPCapabilityCategory, MCPCapability[]>,
        mcps: []
      };
    }
  }

  /**
   * Get orchestration-friendly MCP list for LLM prompts
   */
  async getOrchestrationMCPList(): Promise<MCPOrchestrationInfo> {
    const mcps = await this.getRegisteredMCPs();
    return {
      mcpCount: mcps.length,
      toolCount: mcps.reduce((total, mcp) => total + mcp.tools.length, 0),
      mcpList: mcps.map(mcp => `${mcp.name}(${mcp.type})`).join(', ')
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
      discovered: mcps,
      errors: [],
      discoveredAt: new Date(),
      totalFound: mcps.length,
      successfulRegistrations: mcps.filter(mcp => mcp.status === 'online').length
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