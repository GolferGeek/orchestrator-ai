import { Injectable } from '@nestjs/common';
import { MCPClientService } from './client/mcp-client.service';

/**
 * Global singleton registry for MCP services to ensure all parts of the application
 * use the same MCPClientService instance, bypassing potential DI circular dependency issues.
 */
@Injectable()
export class MCPRegistryService {
  private static mcpClientInstance: MCPClientService | null = null;

  static setMCPClient(instance: MCPClientService): void {
    this.mcpClientInstance = instance;
  }

  static getMCPClient(): MCPClientService | null {
    return this.mcpClientInstance;
  }

  static hasMCPClient(): boolean {
    return this.mcpClientInstance !== null;
  }
}