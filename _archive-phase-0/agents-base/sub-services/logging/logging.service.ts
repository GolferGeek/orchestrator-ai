import { Injectable, Logger } from '@nestjs/common';

export interface LogContext {
  agentName?: string;
  agentType?: string;
  method?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  timestamp?: string;
  [key: string]: any;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);

  /**
   * Log with structured context
   */
  logWithContext(
    level: 'log' | 'error' | 'warn' | 'debug',
    message: string,
    context?: LogContext,
  ): void {
    const logEntry = {
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };

    switch (level) {
      case 'error':
        break;
      case 'warn':
        break;
      case 'debug':
        break;
      default:
    }
  }

  /**
   * Log request processing
   */
  logRequest(method: string, params: any, context?: LogContext): void {
    this.logWithContext('log', 'Processing request', {
      ...context,
      method,
      paramsType: typeof params,
      hasParams: !!params,
    });
  }

  /**
   * Log response
   */
  logResponse(
    method: string,
    success: boolean,
    responseTime?: number,
    context?: LogContext,
  ): void {
    // Only log errors, not successful requests
    if (!success) {
      this.logWithContext('error', 'Request failed', {
        ...context,
        method,
        success,
        responseTime: responseTime ? `${responseTime}ms` : undefined,
      });
    }
  }

  /**
   * Log error with context
   */
  logError(error: Error | string, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logWithContext('error', errorMessage, {
      ...context,
      errorStack,
      errorType: error instanceof Error ? error.constructor.name : 'string',
    });
  }

  /**
   * Log task lifecycle events
   */
  logTaskEvent(
    taskId: string,
    event: string,
    details?: any,
    context?: LogContext,
  ): void {
    this.logWithContext('log', `Task ${event}`, {
      ...context,
      taskId,
      event,
      details,
    });
  }

  /**
   * Log agent registration events
   */
  logAgentEvent(
    agentName: string,
    event: string,
    details?: any,
    context?: LogContext,
  ): void {
    this.logWithContext('log', `Agent ${event}`, {
      ...context,
      agentName,
      event,
      details,
    });
  }
}
