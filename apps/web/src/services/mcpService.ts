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
   * Get MCP pool health status
   */
  async getPoolHealth(): Promise<MCPHealthInfo> {
    try {
      const response = await apiService.get('/mcp-pool/health');
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
   * Get MCP pool statistics
   */
  async getPoolStats(): Promise<MCPPoolStats> {
    const response = await apiService.get('/mcp-pool/stats');
    return response;
  }

  /**
   * Get all registered MCP services
   */
  async getRegisteredMCPs(): Promise<MCPRegistration[]> {
    const response = await apiService.get('/mcp-pool/mcps');
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
    const response = await apiService.get('/mcp-pool/mcps/online');
    return response.map((mcp: any) => ({
      ...mcp,
      discoveredAt: new Date(mcp.discoveredAt),
      registeredAt: mcp.registeredAt ? new Date(mcp.registeredAt) : undefined,
      lastHeartbeat: mcp.lastHeartbeat ? new Date(mcp.lastHeartbeat) : undefined
    }));
  }

  /**
   * Get MCP services by type
   */
  async getMCPsByType(type: string): Promise<MCPRegistration[]> {
    const response = await apiService.get(`/mcp-pool/mcps/type/${type}`);
    return response.map((mcp: any) => ({
      ...mcp,
      discoveredAt: new Date(mcp.discoveredAt),
      registeredAt: mcp.registeredAt ? new Date(mcp.registeredAt) : undefined,
      lastHeartbeat: mcp.lastHeartbeat ? new Date(mcp.lastHeartbeat) : undefined
    }));
  }

  /**
   * Get MCP services by provider
   */
  async getMCPsByProvider(provider: string): Promise<MCPRegistration[]> {
    const response = await apiService.get(`/mcp-pool/mcps/provider/${provider}`);
    return response.map((mcp: any) => ({
      ...mcp,
      discoveredAt: new Date(mcp.discoveredAt),
      registeredAt: mcp.registeredAt ? new Date(mcp.registeredAt) : undefined,
      lastHeartbeat: mcp.lastHeartbeat ? new Date(mcp.lastHeartbeat) : undefined
    }));
  }

  /**
   * Get comprehensive MCP capabilities document for orchestrator
   */
  async getCapabilitiesDocument(): Promise<MCPCapabilitiesDocument> {
    const response = await apiService.get('/mcp-pool/capabilities');
    return {
      ...response,
      generatedAt: new Date(response.generatedAt),
      mcps: response.mcps.map((mcp: any) => ({
        ...mcp,
        lastHeartbeat: mcp.lastHeartbeat ? new Date(mcp.lastHeartbeat) : undefined
      }))
    };
  }

  /**
   * Get orchestration-friendly MCP list for LLM prompts
   */
  async getOrchestrationMCPList(): Promise<MCPOrchestrationInfo> {
    const response = await apiService.get('/mcp-pool/orchestration/mcps');
    return response;
  }

  /**
   * Get all available tools across MCP services
   */
  async getAllAvailableTools(): Promise<MCPToolsInfo> {
    const response = await apiService.get('/mcp-pool/tools');
    return response;
  }

  /**
   * Trigger manual MCP service discovery
   */
  async triggerDiscovery(): Promise<MCPDiscoveryResult> {
    const response = await apiService.post('/mcp-pool/discover');
    return {
      ...response,
      discoveredAt: new Date(response.discoveredAt),
      discovered: response.discovered.map((mcp: any) => ({
        ...mcp,
        discoveredAt: new Date(mcp.discoveredAt)
      })),
      errors: response.errors.map((error: any) => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }))
    };
  }

  /**
   * Execute a tool on a specific MCP service
   */
  async executeMCPTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
    const response = await apiService.post('/mcp-pool/execute', request);
    return {
      ...response,
      timestamp: new Date(response.timestamp)
    };
  }

  /**
   * Register a new MCP service manually
   */
  async registerMCP(registration: Omit<MCPRegistration, 'discoveredAt' | 'registeredAt' | 'lastHeartbeat'>): Promise<void> {
    await apiService.post('/mcp-pool/register', registration);
  }

  /**
   * Unregister an MCP service
   */
  async unregisterMCP(mcpId: string): Promise<void> {
    await apiService.delete(`/mcp-pool/mcps/${mcpId}`);
  }

  /**
   * Send heartbeat for an MCP service
   */
  async sendHeartbeat(mcpId: string, metrics?: any): Promise<void> {
    await apiService.post(`/mcp-pool/mcps/${mcpId}/heartbeat`, {
      mcpId,
      timestamp: new Date(),
      status: 'online',
      metrics
    });
  }

  /**
   * Get specific MCP service details
   */
  async getMCPDetails(mcpId: string): Promise<MCPRegistration> {
    const response = await apiService.get(`/mcp-pool/mcps/${mcpId}`);
    return {
      ...response,
      discoveredAt: new Date(response.discoveredAt),
      registeredAt: response.registeredAt ? new Date(response.registeredAt) : undefined,
      lastHeartbeat: response.lastHeartbeat ? new Date(response.lastHeartbeat) : undefined
    };
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