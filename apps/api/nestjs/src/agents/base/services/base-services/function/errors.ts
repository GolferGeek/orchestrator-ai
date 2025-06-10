/**
 * Custom error classes for function-based agent operations
 * Provides better error categorization and handling for debugging and monitoring
 */

/**
 * Base class for all agent function-related errors
 */
export abstract class AgentFunctionError extends Error {
  public readonly agentName: string;
  public readonly timestamp: Date;
  public readonly context: Record<string, any>;

  constructor(
    message: string,
    agentName: string,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.agentName = agentName;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to a structured object for logging
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      agentName: this.agentName,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Thrown when an agent function file cannot be found
 */
export class AgentFunctionNotFoundError extends AgentFunctionError {
  public readonly searchPaths: string[];

  constructor(
    agentName: string,
    searchPaths: string[],
    context: Record<string, any> = {}
  ) {
    const message = `Agent function file not found for agent "${agentName}". Searched paths: ${searchPaths.join(', ')}`;
    super(message, agentName, { ...context, searchPaths });
    this.searchPaths = searchPaths;
  }
}

/**
 * Thrown when an agent function file exists but cannot be loaded
 */
export class AgentFunctionLoadError extends AgentFunctionError {
  public readonly filePath: string;
  public readonly loadError: Error;

  constructor(
    agentName: string,
    filePath: string,
    loadError: Error,
    context: Record<string, any> = {}
  ) {
    const message = `Failed to load agent function from "${filePath}": ${loadError.message}`;
    super(message, agentName, { ...context, filePath, originalError: loadError.message });
    this.filePath = filePath;
    this.loadError = loadError;
  }
}

/**
 * Thrown when an agent function file loads but doesn't export the expected structure
 */
export class AgentFunctionValidationError extends AgentFunctionError {
  public readonly filePath: string;
  public readonly exportedKeys: string[];

  constructor(
    agentName: string,
    filePath: string,
    exportedKeys: string[],
    context: Record<string, any> = {}
  ) {
    const message = `Agent function file "${filePath}" does not export expected structure. Expected: { execute: function } or { default: { execute: function } }. Found exports: [${exportedKeys.join(', ')}]`;
    super(message, agentName, { ...context, filePath, exportedKeys });
    this.filePath = filePath;
    this.exportedKeys = exportedKeys;
  }
}

/**
 * Thrown when an agent function executes but throws an error
 */
export class AgentFunctionExecutionError extends AgentFunctionError {
  public readonly method: string;
  public readonly executionError: Error;
  public readonly executionTime: number;

  constructor(
    agentName: string,
    method: string,
    executionError: Error,
    executionTime: number,
    context: Record<string, any> = {}
  ) {
    const message = `Agent function execution failed for agent "${agentName}" method "${method}": ${executionError.message}`;
    super(message, agentName, { 
      ...context, 
      method, 
      executionTime, 
      originalError: executionError.message,
      originalStack: executionError.stack 
    });
    this.method = method;
    this.executionError = executionError;
    this.executionTime = executionTime;
  }
}

/**
 * Thrown when agent function parameters are invalid or cannot be processed
 */
export class AgentFunctionParameterError extends AgentFunctionError {
  public readonly method: string;
  public readonly invalidParams: any;

  constructor(
    agentName: string,
    method: string,
    invalidParams: any,
    details: string,
    context: Record<string, any> = {}
  ) {
    const message = `Invalid parameters for agent "${agentName}" method "${method}": ${details}`;
    super(message, agentName, { ...context, method, invalidParams, details });
    this.method = method;
    this.invalidParams = invalidParams;
  }
}

/**
 * Thrown when agent function times out during execution
 */
export class AgentFunctionTimeoutError extends AgentFunctionError {
  public readonly method: string;
  public readonly timeoutMs: number;

  constructor(
    agentName: string,
    method: string,
    timeoutMs: number,
    context: Record<string, any> = {}
  ) {
    const message = `Agent function execution timed out for agent "${agentName}" method "${method}" after ${timeoutMs}ms`;
    super(message, agentName, { ...context, method, timeoutMs });
    this.method = method;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when agent function configuration is invalid
 */
export class AgentFunctionConfigurationError extends AgentFunctionError {
  public readonly configField: string;
  public readonly configValue: any;

  constructor(
    agentName: string,
    configField: string,
    configValue: any,
    details: string,
    context: Record<string, any> = {}
  ) {
    const message = `Invalid configuration for agent "${agentName}" field "${configField}": ${details}`;
    super(message, agentName, { ...context, configField, configValue, details });
    this.configField = configField;
    this.configValue = configValue;
  }
}

/**
 * Type guard to check if an error is an AgentFunctionError
 */
export function isAgentFunctionError(error: unknown): error is AgentFunctionError {
  return error instanceof AgentFunctionError;
}

/**
 * Type guard to check if an error is a specific type of AgentFunctionError
 */
export function isAgentFunctionErrorOfType<T extends AgentFunctionError>(
  error: unknown,
  errorClass: new (...args: any[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Safely extract error information from unknown error types
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  name: string;
  stack?: string;
  isAgentError: boolean;
} {
  if (isAgentFunctionError(error)) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      isAgentError: true
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      isAgentError: false
    };
  }
  
  return {
    message: String(error),
    name: 'UnknownError',
    isAgentError: false
  };
} 