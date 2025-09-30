import { Injectable, Logger } from '@nestjs/common';
import {
  HealthStatus,
  HealthCheck,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  /**
   * Get overall health status by checking all dependencies
   */
  async getHealthStatus(
    taskLifecycleService?: any,
    evaluationService?: any,
  ): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check task lifecycle service
    if (taskLifecycleService) {
      try {
        const taskMetrics = await taskLifecycleService.getMetrics();
        const taskCheck: HealthCheck = {
          name: 'task_lifecycle',
          status: taskMetrics.activeTasks < 100 ? 'pass' : 'warn',
          message: `Active tasks: ${taskMetrics.activeTasks}, Completed: ${taskMetrics.completedTasks}, Failed: ${taskMetrics.failedTasks}`,
        };
        checks.push(taskCheck);

        if (taskCheck.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        } else if (taskCheck.status === 'fail') {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        checks.push({
          name: 'task_lifecycle',
          status: 'fail',
          message: `Task lifecycle service error: ${error instanceof Error ? error.message : String(error)}`,
        });
        overallStatus = 'unhealthy';
      }
    }

    // Check evaluation service
    if (evaluationService) {
      try {
        const evalMetrics = await evaluationService.getEvaluationMetrics();
        const evalCheck: HealthCheck = {
          name: 'evaluation_service',
          status: evalMetrics.totalRequests > 0 ? 'pass' : 'warn',
          message: `Total requests: ${evalMetrics.totalRequests}, Success rate: ${evalMetrics.successRate}%, Avg response time: ${evalMetrics.averageResponseTime}ms`,
        };
        checks.push(evalCheck);

        if (evalCheck.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        } else if (evalCheck.status === 'fail') {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        checks.push({
          name: 'evaluation_service',
          status: 'fail',
          message: `Evaluation service error: ${error instanceof Error ? error.message : String(error)}`,
        });
        overallStatus = 'unhealthy';
      }
    }

    // Basic system health check
    const systemCheck: HealthCheck = {
      name: 'system',
      status: 'pass',
      message: `Uptime: ${Math.floor(process.uptime())}s, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    };
    checks.push(systemCheck);

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      uptime: process.uptime(),
    };
  }

  /**
   * Simple health check for basic status
   */
  async isHealthy(): Promise<boolean> {
    try {
      const _status = await this.getHealthStatus();
      return status.status === 'healthy';
    } catch (_error) {
      return false;
    }
  }
}
