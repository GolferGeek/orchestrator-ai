import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { AgentFunctionParams, AgentFunctionResponse, AgentFunction } from '../a2a-base/interfaces';
import { LLMService } from '../../llm/llm.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  AgentFunctionError,
  AgentFunctionNotFoundError,
  AgentFunctionLoadError,
  AgentFunctionValidationError,
  AgentFunctionExecutionError,
  AgentFunctionParameterError,
  AgentFunctionTimeoutError,
  isAgentFunctionError,
  extractErrorInfo
} from './errors';

interface CachedAgentFunction {
  function: AgentFunction;
  loadedAt: Date;
  filePath: string;
}

@Injectable()
export class FunctionAgentBaseService extends A2AAgentBaseService {
  protected readonly functionLogger = new Logger(FunctionAgentBaseService.name);
  private agentFunctionCache: CachedAgentFunction | null = null;
  private functionLoadAttempted = false;
  private loadingPromise: Promise<void> | null = null;
  
  // Error recovery configuration
  private readonly maxRetryAttempts = 3;
  private readonly timeoutMs = 30000; // 30 seconds
  private retryCount = 0;

  constructor(
    protected readonly llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(httpService, contextService);
  }

  /**
   * Override executeTask to use dynamically imported agent functions with enhanced error handling
   */
  protected async executeTask(method: string, params: any): Promise<any> {
    const startTime = Date.now();
    const agentName = this.getAgentName();
    
    try {
      // Validate parameters before proceeding
      this.validateExecutionParams(method, params);

      // Load the agent function if not already loaded (with concurrent safety)
      if (!this.functionLoadAttempted) {
        if (!this.loadingPromise) {
          this.loadingPromise = this.loadAgentFunction();
        }
        await this.loadingPromise;
        this.functionLoadAttempted = true;
        this.loadingPromise = null;
      }

      // If no agent function is available, fall back to context-based processing
      if (!this.agentFunctionCache?.function) {
        this.functionLogger.warn('No agent function found, falling back to context-based processing', {
          agentName,
          method,
          fallbackReason: 'function_not_loaded'
        });
        return this.processWithContext(method, params);
      }

      // Prepare standardized parameters for the agent function
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: this.getLLMService(),
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString(),
          functionLoadedAt: this.agentFunctionCache.loadedAt.toISOString(),
          functionFilePath: this.agentFunctionCache.filePath
        }
      };

      // Execute the agent function with timeout protection
      const result = await this.executeWithTimeout(
        this.agentFunctionCache.function.execute(functionParams),
        this.timeoutMs,
        agentName,
        method
      );
      
      // Reset retry count on successful execution
      this.retryCount = 0;
      
      // Add processing time to metadata
      if (result.metadata) {
        result.metadata.processingTime = Date.now() - startTime;
        result.metadata.cacheHit = true;
      }

      this.functionLogger.debug('Agent function executed successfully', {
        agentName,
        method,
        processingTime: Date.now() - startTime,
        hasResult: !!result?.response
      });

      return result.response;
      
    } catch (error) {
      return this.handleFunctionExecutionError(error, method, params, startTime);
    }
  }

  /**
   * Handle execution errors with proper categorization and recovery strategies
   */
  private async handleFunctionExecutionError(error: unknown, method: string, params: any, startTime: number): Promise<any> {
    const agentName = this.getAgentName();
    const processingTime = Date.now() - startTime;
    
    // Log structured error information
    if (isAgentFunctionError(error)) {
      this.functionLogger.error('Agent function error occurred', {
        ...error.toLogObject(),
        method,
        processingTime,
        retryCount: this.retryCount
      });
    } else {
      const errorInfo = extractErrorInfo(error);
      this.functionLogger.error('Unexpected error during agent function execution', {
        ...errorInfo,
        agentName,
        method,
        processingTime,
        retryCount: this.retryCount
      });
    }

    // Implement retry logic for recoverable errors
    if (this.shouldRetryError(error) && this.retryCount < this.maxRetryAttempts) {
      this.retryCount++;
      this.functionLogger.warn(`Retrying agent function execution (attempt ${this.retryCount}/${this.maxRetryAttempts})`, {
        agentName,
        method,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      // Clear function cache for retry if it's a load error
      if (error instanceof AgentFunctionLoadError) {
        this.invalidateCache();
      }
      
      // Wait briefly before retry with exponential backoff
      await this.delay(Math.pow(2, this.retryCount - 1) * 1000);
      
      return this.executeTask(method, params);
    }

    // Reset retry count after max attempts
    this.retryCount = 0;

    // For execution errors, attempt graceful degradation to context-based processing
    if (error instanceof AgentFunctionExecutionError || 
        error instanceof AgentFunctionTimeoutError ||
        error instanceof AgentFunctionParameterError) {
      
      this.functionLogger.warn('Falling back to context-based processing due to function execution error', {
        agentName,
        method,
        errorType: error.constructor.name,
        fallbackReason: 'execution_failed'
      });
      
      return this.processWithContext(method, params);
    }

    // For critical errors that can't be recovered, re-throw with proper context
    if (error instanceof AgentFunctionError) {
      throw error;
    }
    
    // Wrap unknown errors in execution error
    throw new AgentFunctionExecutionError(
      agentName,
      method,
      error instanceof Error ? error : new Error(String(error)),
      processingTime,
      { originalParams: params }
    );
  }

  /**
   * Execute function with timeout protection
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    agentName: string,
    method: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AgentFunctionTimeoutError(agentName, method, timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Validate execution parameters
   */
  private validateExecutionParams(method: string, params: any): void {
    const agentName = this.getAgentName();
    
    if (!method || typeof method !== 'string') {
      throw new AgentFunctionParameterError(
        agentName,
        method || 'undefined',
        params,
        'Method must be a non-empty string'
      );
    }

    if (!params || typeof params !== 'object') {
      throw new AgentFunctionParameterError(
        agentName,
        method,
        params,
        'Parameters must be an object'
      );
    }

    // Validate essential parameters exist
    if (!this.extractUserMessage(params)) {
      throw new AgentFunctionParameterError(
        agentName,
        method,
        params,
        'User message is required but not found in parameters'
      );
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryError(error: unknown): boolean {
    // Retry on load errors, timeout errors, and generic execution errors
    return error instanceof AgentFunctionLoadError ||
           error instanceof AgentFunctionTimeoutError ||
           (error instanceof AgentFunctionExecutionError && !error.executionError.message.includes('ValidationError'));
  }

  /**
   * Simple delay utility for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dynamically load the agent-function.ts file from the agent's directory
   * Enhanced with custom error classes and better error categorization
   */
  private async loadAgentFunction(): Promise<void> {
    const agentName = this.getAgentName();
    
    try {
      const agentDirectory = this.getAgentDirectory();
      if (!agentDirectory) {
        this.functionLogger.debug('No agent directory found, cannot load agent function', { agentName });
        return;
      }

      // For dynamic imports, we need to use the compiled JavaScript files from dist
      // Convert src path to dist path
      const srcPrefix = path.join(process.cwd(), 'src');
      const distPrefix = path.join(process.cwd(), 'dist');
      const relativePath = path.relative(srcPrefix, agentDirectory);
      const distDirectory = path.join(distPrefix, relativePath);
      
      const functionPath = path.join(agentDirectory, 'agent-function.ts');
      const jsPath = path.join(agentDirectory, 'agent-function.js');
      const distJsPath = path.join(distDirectory, 'agent-function.js');
      
      // Prioritize compiled JavaScript files for dynamic import
      const searchPaths = [distJsPath, jsPath, functionPath];
      let importPath: string | null = null;
      
      for (const checkPath of searchPaths) {
        if (fs.existsSync(checkPath)) {
          importPath = checkPath;
          this.functionLogger.debug(`Found agent function at: ${checkPath}`, { agentName });
          break;
        }
      }

      if (!importPath) {
        throw new AgentFunctionNotFoundError(agentName, searchPaths, {
          agentDirectory,
          searchedExtensions: ['.ts', '.js']
        });
      }

      this.functionLogger.debug(`Loading agent function from ${importPath}`, { agentName });
      
      const loadStartTime = Date.now();
      
      // For JavaScript files, use relative path import; for TypeScript, convert path
      let importSpecifier: string;
      if (importPath.endsWith('.js')) {
        // For compiled JS files, create a relative path from current working directory
        importSpecifier = path.relative(process.cwd(), importPath);
        // Ensure the path starts with ./ for relative imports
        if (!importSpecifier.startsWith('.')) {
          importSpecifier = './' + importSpecifier;
        }
      } else {
        // For TypeScript files, use file:// URL (though this might not work in all cases)
        const resolvedPath = path.resolve(importPath);
        importSpecifier = `file://${resolvedPath}`;
      }
      
      this.functionLogger.debug(`Import specifier: ${importSpecifier}`, { agentName });
      
      // Dynamically import the agent function with enhanced error handling
      let module: any;
      try {
        module = await import(importSpecifier);
      } catch (importError) {
        throw new AgentFunctionLoadError(
          agentName,
          importPath,
          importError instanceof Error ? importError : new Error(String(importError)),
          {
            importSpecifier,
            loadStartTime
          }
        );
      }
      
      // Validate and cache the module
      const agentFunction = this.validateAndExtractFunction(module, importPath);
      if (agentFunction) {
        this.agentFunctionCache = {
          function: agentFunction,
          loadedAt: new Date(),
          filePath: importPath
        };
        
        const loadTime = Date.now() - loadStartTime;
        this.functionLogger.log(`Successfully loaded agent function from ${importPath} (${loadTime}ms)`, {
          agentName,
          loadTime,
          filePath: importPath
        });
      }
    } catch (error) {
      // Re-throw AgentFunctionErrors as-is
      if (isAgentFunctionError(error)) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw new AgentFunctionLoadError(
        agentName,
        'unknown',
        error instanceof Error ? error : new Error(String(error)),
        {
          agentDirectory: this.getAgentDirectory(),
          phase: 'general_loading'
        }
      );
    }
  }

  /**
   * Validate and extract the agent function from the imported module
   * Enhanced with proper error throwing
   */
  private validateAndExtractFunction(module: any, filePath: string): AgentFunction | null {
    const agentName = this.getAgentName();
    const exportedKeys = Object.keys(module || {});
    
    // Check if the module exports the expected structure
    if (module.execute && typeof module.execute === 'function') {
      return {
        execute: module.execute
      };
    } else if (module.default && module.default.execute && typeof module.default.execute === 'function') {
      return module.default;
    } else {
      throw new AgentFunctionValidationError(
        agentName,
        filePath,
        exportedKeys,
        {
          moduleType: typeof module,
          hasDefault: !!module.default,
          defaultType: typeof module.default
        }
      );
    }
  }

  /**
   * Extract user message from various parameter formats
   * Enhanced with better type handling
   */
  private extractUserMessage(params: any): string {
    if (typeof params === 'string') {
      return params;
    }
    
    if (params && typeof params === 'object') {
      // Try different common property names in order of preference
      const messageProps = ['message', 'userMessage', 'prompt', 'input', 'content', 'text'];
      
      for (const prop of messageProps) {
        if (params[prop] && typeof params[prop] === 'string') {
          return params[prop];
        }
      }
      
      // If no string property found, stringify the object
      return JSON.stringify(params);
    }
    
    // Handle null specifically to match test expectations
    if (params === null) {
      return 'null';
    }
    
    return String(params || '');
  }

  /**
   * Get LLM service instance with LangGraph support
   */
  private getLLMService(): LLMService {
    return this.llmService;
  }

  /**
   * Fallback to context-based processing when no agent function is available
   * Enhanced with more helpful error information
   */
  private async processWithContext(method: string, params: any): Promise<any> {
    const fallbackResponse = {
      response: `Agent function not available for ${this.getAgentName()}. Method: ${method}`,
      metadata: {
        fallback: true,
        method,
        agentName: this.getAgentName(),
        reason: this.agentFunctionCache ? 'Function load failed' : 'No function file found',
        suggestion: 'Create an agent-function.ts file in the agent directory with an execute function'
      }
    };

    // Log the fallback for debugging
    this.functionLogger.debug('Using fallback processing', {
      agentName: this.getAgentName(),
      method,
      reason: fallbackResponse.metadata.reason
    });

    return fallbackResponse.response;
  }

  /**
   * Override getAgentCard to include enhanced function-based capabilities
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    
    return {
      ...baseCard,
      capabilities: {
        ...baseCard.capabilities,
        functionBased: true,
        dynamicImport: true,
        autoParameterHandling: true,
        enhancedCaching: true,
        errorCategorization: true,
        performanceOptimized: true
      },
      // Add enhanced function-specific information to the card
      functionInfo: {
        hasFunctionFile: this.agentFunctionCache !== null,
        functionLoadAttempted: this.functionLoadAttempted,
        functionLoadedAt: this.agentFunctionCache?.loadedAt?.toISOString(),
        functionFilePath: this.agentFunctionCache?.filePath
      }
    };
  }

  /**
   * Public method to reload the agent function (useful for development/testing)
   */
  async reloadAgentFunction(): Promise<boolean> {
    this.functionLogger.log('Manually reloading agent function');
    
    // Reset cache and load state
    this.agentFunctionCache = null;
    this.functionLoadAttempted = false;
    this.loadingPromise = null;
    
    // Force reload
    await this.loadAgentFunction();
    this.functionLoadAttempted = true;
    
    const success = this.agentFunctionCache !== null;
    this.functionLogger.log(`Agent function reload ${success ? 'successful' : 'failed'}`);
    
    return success;
  }

  /**
   * Get performance metrics for the cached function
   */
  getPerformanceMetrics(): {
    hasCachedFunction: boolean;
    loadedAt?: string;
    filePath?: string;
    cacheAge?: number;
  } {
    return {
      hasCachedFunction: this.agentFunctionCache !== null,
      loadedAt: this.agentFunctionCache?.loadedAt?.toISOString(),
      filePath: this.agentFunctionCache?.filePath,
      cacheAge: this.agentFunctionCache ? Date.now() - this.agentFunctionCache.loadedAt.getTime() : undefined
    };
  }

  private invalidateCache(): void {
    this.agentFunctionCache = null;
    this.functionLoadAttempted = false;
    this.loadingPromise = null;
  }
} 