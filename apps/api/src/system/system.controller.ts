import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';
import { IsOptional, IsObject, IsString } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { cpus } from 'os';

class UpdateGlobalModelConfigDto {
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  config_json?: string; // alternative: raw JSON string
}

@ApiTags('System')
@Controller('system')
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get basic system health status
   */
  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'System health data' })
  async getSystemHealth() {
    try {
      const uptime = process.uptime() * 1000;
      const memoryUsage = process.memoryUsage();

      // Test database connectivity
      const client = this.supabaseService.getServiceClient();
      const { error: dbError } = await client
        .from('users')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: uptime,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapUtilization: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          ),
        },
        services: {
          database: dbError ? 'unhealthy' : 'healthy',
          api: 'healthy',
        },
      };
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'System health check failed',
      };
    }
  }

  /**
   * Get system analytics overview
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Get system analytics overview' })
  @ApiResponse({ status: 200, description: 'System analytics data' })
  async getSystemAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      // Get current timestamp
      const now = new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate ? new Date(endDate) : now;

      // System metrics
      const uptime = process.uptime() * 1000; // milliseconds
      const memoryUsage = process.memoryUsage();

      // Get real data from database - use service client for admin analytics
      const client = this.supabaseService.getServiceClient();

      const [usersResult, tasksResult, conversationsResult, projectsResult] =
        await Promise.all([
          client.from('users').select('id', { count: 'exact', head: true }),
          client.from('tasks').select('id', { count: 'exact', head: true }),
          client
            .from('conversations')
            .select('id', { count: 'exact', head: true }),
          client.from('projects').select('id', { count: 'exact', head: true }),
        ]);

      // Get task completion stats
      const [completedTasks, failedTasks] = await Promise.all([
        client
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
        client
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed'),
      ]);

      const totalUsers = usersResult.count || 0;
      const totalTasks = tasksResult.count || 0;
      const totalConversations = conversationsResult.count || 0;
      const totalProjects = projectsResult.count || 0;
      const completedTasksCount = completedTasks.count || 0;
      const failedTasksCount = failedTasks.count || 0;

      // Calculate success rate
      const successRate =
        totalTasks > 0 ? (completedTasksCount / totalTasks) * 100 : 100;

      const analytics = {
        timestamp: now.toISOString(),
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          durationDays: Math.ceil(
            (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
          ),
        },
        system: {
          uptime: uptime,
          uptimeDays: Math.floor(uptime / (24 * 60 * 60 * 1000)),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024), // MB
            heapUtilization: Math.round(
              (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            ),
          },
          cpu: {
            usage: Math.round(process.cpuUsage().user / 1000), // Convert microseconds to milliseconds
            cores: cpus().length,
          },
        },
        performance: {
          averageResponseTime: Math.round(uptime / (totalTasks || 1)), // Rough estimate based on uptime/tasks
          requestsPerSecond: Math.round(totalTasks / (uptime / 1000) || 0), // Tasks per second since startup
          errorRate: Math.round(successRate * 100) / 100, // Success rate as error rate inverse
        },
        health: {
          status: 'healthy',
          services: {
            database: usersResult.error ? 'unhealthy' : 'healthy',
            llm: 'healthy', // TODO: Add real LLM health check
            monitoring: 'healthy',
            authentication: 'healthy',
          },
        },
        statistics: {
          totalRequests: totalTasks, // Use tasks as proxy for requests
          totalUsers: totalUsers,
          totalAgents: 37, // TODO: Get from agent discovery service
          totalTasks: totalTasks,
          totalProjects: totalProjects,
          totalConversations: totalConversations,
          completedTasks: completedTasksCount,
          failedTasks: failedTasksCount,
          successRate: Math.round(successRate * 100) / 100,
        },
      };

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to get system analytics', error);
      throw error;
    }
  }

  // ==============================
  // Global Model Config Management
  // ==============================

  @Get('model-config/global')
  @ApiOperation({ summary: 'Get global model configuration (DB-backed)' })
  @ApiResponse({
    status: 200,
    description: 'Returns DB value and env override presence',
  })
  async getGlobalModelConfig() {
    try {
      const envOverride = this.configService.get<string>(
        'MODEL_CONFIG_GLOBAL_JSON',
      );
      const client = this.supabaseService.getServiceClient();
      const { data, error } = (await client.rpc('get_global_model_config')) as {
        data: unknown;
        error: unknown;
      };
      if (error) {
        throw new Error(
          (error as unknown as Record<string, unknown>).message as string,
        );
      }
      const dbConfig =
        typeof data === 'string'
          ? (JSON.parse(data) as Record<string, unknown>)
          : (data as Record<string, unknown>);
      return {
        success: true,
        source: envOverride ? 'env_override' : 'database',
        dbConfig: dbConfig,
        envOverrideActive: Boolean(envOverride),
      };
    } catch (error) {
      this.logger.error('Failed to get global model config', error);
      throw new HttpException(
        'Failed to fetch model config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('model-config/global')
  @ApiOperation({ summary: 'Update global model configuration (writes to DB)' })
  @ApiResponse({ status: 200, description: 'Stored configuration' })
  async setGlobalModelConfig(@Body() dto: UpdateGlobalModelConfigDto) {
    try {
      const envOverride = this.configService.get<string>(
        'MODEL_CONFIG_GLOBAL_JSON',
      );
      if (envOverride) {
        // Warn that env override takes precedence
        this.logger.warn(
          'MODEL_CONFIG_GLOBAL_JSON is set; DB updates will not take effect until env override is removed',
        );
      }

      // Determine payload
      let payload: Record<string, unknown> | undefined = dto.config;
      if (!payload && dto.config_json) {
        payload = JSON.parse(dto.config_json) as Record<string, unknown>;
      }
      if (!payload || typeof payload !== 'object') {
        throw new HttpException(
          'Missing config object or config_json',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Basic shape check: either flat {provider, model} or dual {default, localOnly?}
      const isFlat = 'provider' in payload && 'model' in payload;
      const isDual =
        'default' in payload && typeof payload.default === 'object';
      if (!isFlat && !isDual) {
        throw new HttpException(
          'Invalid config shape: expected {provider, model} or {default, localOnly?}',
          HttpStatus.BAD_REQUEST,
        );
      }

      const client = this.supabaseService.getServiceClient();
      const { error } = await client.from('system_settings').upsert(
        {
          key: 'model_config_global',
          value: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
      if (error) {
        throw new Error(
          (error as unknown as Record<string, unknown>).message as string,
        );
      }
      return {
        success: true,
        message: 'Global model configuration updated',
        envOverrideActive: Boolean(envOverride),
      };
    } catch (error) {
      this.logger.error('Failed to update global model config', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to update model config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
