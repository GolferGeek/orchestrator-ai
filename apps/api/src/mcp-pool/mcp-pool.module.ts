/**
 * MCP Pool Module
 * 
 * NestJS module for MCP (Model Context Protocol) pool management,
 * providing discovery, registration, and orchestration capabilities.
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MCPPoolService } from './mcp-pool.service';
import { MCPPoolController } from './mcp-pool.controller';
import { MCPDiscoveryService } from './mcp-discovery.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds default timeout
      maxRedirects: 3,
    }),
    ConfigModule,
    ScheduleModule.forRoot(), // Enable scheduled tasks
  ],
  controllers: [MCPPoolController],
  providers: [MCPPoolService, MCPDiscoveryService],
  exports: [MCPPoolService, MCPDiscoveryService], // Export for use in other modules
})
export class MCPPoolModule {}