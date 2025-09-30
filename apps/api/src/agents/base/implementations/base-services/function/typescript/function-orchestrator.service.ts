import { Injectable } from '@nestjs/common';

export interface OrchestrationStep {
  name: string;
  function: (...args: any[]) => Promise<any>;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
  failureStrategy?: 'abort' | 'continue' | 'retry';
  metadata?: Record<string, any>;
}

export interface OrchestrationResult {
  stepName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  retryCount: number;
  timestamp: string;
}

export interface OrchestrationExecution {
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  steps: OrchestrationResult[];
  context: Record<string, any>;
  metadata: Record<string, any>;
}

export interface OrchestrationPlan {
  name: string;
  description?: string;
  steps: OrchestrationStep[];
  globalTimeout?: number;
  defaultRetries?: number;
  defaultFailureStrategy?: 'abort' | 'continue' | 'retry';
  context?: Record<string, any>;
}

/**
 * Service for orchestrating multi-step function executions in TypeScript agents
 * Provides dependency management, error handling, retries, and progress tracking
 */
@Injectable()
export class FunctionOrchestratorService {
  /**
   * Execute an orchestration plan
   */
  async executeOrchestration(
    plan: OrchestrationPlan,
    initialContext: Record<string, any> = {},
  ): Promise<OrchestrationExecution> {
    const executionId = this.generateExecutionId();
    const startTime = new Date().toISOString();

    const execution: OrchestrationExecution = {
      executionId,
      status: 'running',
      startTime,
      steps: [],
      context: { ...plan.context, ...initialContext },
      metadata: {
        planName: plan.name,
        totalSteps: plan.steps.length,
        globalTimeout: plan.globalTimeout,
        defaultRetries: plan.defaultRetries,
      },
    };

    try {
      const executionOrder = this.resolveExecutionOrder(plan.steps);

      for (const stepName of executionOrder) {
        const step = plan.steps.find((s) => s.name === stepName)!;
        const stepResult = await this.executeStep(
          step,
          execution.context,
          plan.defaultRetries || 0,
          plan.defaultFailureStrategy || 'abort',
        );

        execution.steps.push(stepResult);

        if (!stepResult.success) {
          const strategy =
            step.failureStrategy || plan.defaultFailureStrategy || 'abort';

          if (strategy === 'abort') {
            execution.status = 'failed';
            break;
          }
          // 'continue' strategy just moves to next step
        } else {
          // Add step result to context for subsequent steps
          execution.context[`${stepName}result`] = stepResult.result;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }
    } catch (error) {
      execution.status = 'failed';
      execution.metadata.globalError =
        error instanceof Error ? error.message : String(error);
    }

    execution.endTime = new Date().toISOString();
    execution.totalDuration =
      new Date(execution.endTime).getTime() -
      new Date(execution.startTime).getTime();

    return execution;
  }

  /**
   * Execute a single step with retries and error handling
   */
  private async executeStep(
    step: OrchestrationStep,
    context: Record<string, any>,
    defaultRetries: number,
    defaultFailureStrategy: string,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const maxRetries = step.retries ?? defaultRetries;
    let retryCount = 0;
    let lastError: any;

    while (retryCount <= maxRetries) {
      try {
        const result = await this.executeWithTimeout(
          () => step.function(context),
          step.timeout || 60000, // 60 second default timeout
        );

        return {
          stepName: step.name,
          success: true,
          result,
          duration: Date.now() - startTime,
          retryCount,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error;
        retryCount++;

        if (retryCount <= maxRetries) {
          // Wait before retry (exponential backoff)
          await this.delay(Math.pow(2, retryCount - 1) * 1000);
        }
      }
    }

    return {
      stepName: step.name,
      success: false,
      error: lastError instanceof Error ? lastError.message : String(lastError),
      duration: Date.now() - startTime,
      retryCount: retryCount - 1,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Function timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Resolve execution order based on dependencies
   */
  private resolveExecutionOrder(steps: OrchestrationStep[]): string[] {
    const resolved: string[] = [];
    const remaining = [...steps];

    while (remaining.length > 0) {
      const canExecute = remaining.filter(
        (step) =>
          !step.dependencies ||
          step.dependencies.every((dep) => resolved.includes(dep)),
      );

      if (canExecute.length === 0) {
        throw new Error('Circular dependency detected in orchestration steps');
      }

      // Execute steps without dependencies first, then in order of definition
      const nextStep = canExecute[0];
      if (!nextStep) {
        throw new Error('No executable steps found but remaining steps exist');
      }

      resolved.push(nextStep.name);

      const index = remaining.findIndex((step) => step.name === nextStep.name);
      remaining.splice(index, 1);
    }

    return resolved;
  }

  /**
   * Create a simple orchestration plan
   */
  createPlan(
    name: string,
    steps: Array<{
      name: string;
      function: (...args: any[]) => Promise<any>;
      dependencies?: string[];
      options?: Partial<OrchestrationStep>;
    }>,
    options?: {
      description?: string;
      globalTimeout?: number;
      defaultRetries?: number;
      defaultFailureStrategy?: 'abort' | 'continue' | 'retry';
    },
  ): OrchestrationPlan {
    return {
      name,
      description: options?.description,
      steps: steps.map((step) => ({
        name: step.name,
        function: step.function,
        dependencies: step.dependencies,
        ...step.options,
      })),
      globalTimeout: options?.globalTimeout,
      defaultRetries: options?.defaultRetries || 0,
      defaultFailureStrategy: options?.defaultFailureStrategy || 'abort',
    };
  }

  /**
   * Create a sequential orchestration (no dependencies)
   */
  createSequentialPlan(
    name: string,
    functions: Array<{
      name: string;
      function: (...args: any[]) => Promise<any>;
      options?: Partial<OrchestrationStep>;
    }>,
    options?: {
      description?: string;
      globalTimeout?: number;
      defaultRetries?: number;
      defaultFailureStrategy?: 'abort' | 'continue' | 'retry';
    },
  ): OrchestrationPlan {
    const steps = functions.map((fn, index) => {
      const prevFunction = functions[index - 1];
      return {
        name: fn.name,
        function: fn.function,
        dependencies:
          index > 0 && prevFunction ? [prevFunction.name] : undefined,
        ...fn.options,
      };
    });

    return this.createPlan(name, steps, options);
  }

  /**
   * Create a parallel orchestration (no dependencies between steps)
   */
  createParallelPlan(
    name: string,
    functions: Array<{
      name: string;
      function: (...args: any[]) => Promise<any>;
      options?: Partial<OrchestrationStep>;
    }>,
    options?: {
      description?: string;
      globalTimeout?: number;
      defaultRetries?: number;
      defaultFailureStrategy?: 'abort' | 'continue' | 'retry';
    },
  ): OrchestrationPlan {
    const steps = functions.map((fn) => ({
      name: fn.name,
      function: fn.function,
      dependencies: [], // No dependencies for parallel execution
      ...fn.options,
    }));

    return this.createPlan(name, steps, options);
  }

  /**
   * Generate execution summary
   */
  generateExecutionSummary(execution: OrchestrationExecution): {
    executionId: string;
    status: string;
    duration: number;
    successRate: number;
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    totalRetries: number;
    errors: string[];
  } {
    const successfulSteps = execution.steps.filter(
      (step) => step.success,
    ).length;
    const failedSteps = execution.steps.filter((step) => !step.success).length;
    const totalRetries = execution.steps.reduce(
      (sum, step) => sum + step.retryCount,
      0,
    );
    const errors = execution.steps
      .filter((step) => step.error)
      .map((step) => `${step.stepName}: ${step.error}`);

    return {
      executionId: execution.executionId,
      status: execution.status,
      duration: execution.totalDuration || 0,
      successRate:
        execution.steps.length > 0
          ? successfulSteps / execution.steps.length
          : 0,
      totalSteps: execution.steps.length,
      successfulSteps,
      failedSteps,
      totalRetries,
      errors,
    };
  }

  /**
   * Validate orchestration plan
   */
  validatePlan(plan: OrchestrationPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate step names
    const stepNames = plan.steps.map((step) => step.name);
    const duplicates = stepNames.filter(
      (name, index) => stepNames.indexOf(name) !== index,
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate step names found: ${duplicates.join(', ')}`);
    }

    // Check for invalid dependencies
    plan.steps.forEach((step) => {
      if (step.dependencies) {
        step.dependencies.forEach((dep) => {
          if (!stepNames.includes(dep)) {
            errors.push(
              `Step '${step.name}' depends on non-existent step '${dep}'`,
            );
          }
        });
      }
    });

    // Check for circular dependencies
    try {
      this.resolveExecutionOrder(plan.steps);
    } catch (_error) {
      errors.push('Circular dependency detected in plan');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Utility functions
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
