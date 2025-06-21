import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('db')
  @ApiOperation({ summary: 'Check database connectivity' })
  @ApiResponse({ 
    status: 200, 
    description: 'Database connection successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        message: { type: 'string', example: 'Database connection successful' },
      },
    },
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Database connection failed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Connection error details' },
      },
    },
  })
  async checkDbConnection() {
    return await this.supabaseService.checkConnection();
  }

  @Get()
  @ApiOperation({ summary: 'General health check' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'NestJS A2A Agent Framework' },
      },
    },
  })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'NestJS A2A Agent Framework',
    };
  }

  @Get('supabase')
  async checkSupabase() {
    try {
      const result = await this.supabaseService.checkConnection();
      return {
        status: 'ok',
        supabase: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        supabase: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
} 