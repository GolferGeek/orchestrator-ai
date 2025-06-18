import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';

export interface AgentFunctionParams {
  userMessage: string;
  sessionId?: string;
  conversationHistory?: any[];
  currentUser?: any;
  authToken?: string;
  llmService: LLMService | null;
  metadata: {
    method: string;
    originalParams: any;
    agentName: string;
    timestamp: string;
  };
}

export interface AgentFunctionResponse {
  response: string;
  metadata?: any;
}

/**
 * Python Function Agent Base Service that handles Python-based agent execution
 * This provides clean Python script execution with proper error handling and fallback capabilities
 */
@Injectable()
export class PythonFunctionAgentBaseService extends A2AAgentBaseService {
  protected readonly pythonLogger = new Logger(PythonFunctionAgentBaseService.name);
  private pythonScriptPath: string | null = null;
  private pythonExecutable: string = 'python3'; // Default, can be configured

  constructor(
    protected readonly httpService: HttpService,
    protected readonly llmService: LLMService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService
  ) {
    super(
      httpService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService
    );
  }

  /**
   * Set the Python script path for this agent (called by AgentDiscoveryService)
   */
  setPythonScriptPath(scriptPath: string): void {
    this.pythonScriptPath = scriptPath;
    this.pythonLogger.debug(`Python script path set for ${this.getAgentName()}: ${scriptPath}`);
  }

  /**
   * Set the Python executable to use (python3, python, specific path, etc.)
   */
  setPythonExecutable(executable: string): void {
    this.pythonExecutable = executable;
    this.pythonLogger.debug(`Python executable set for ${this.getAgentName()}: ${executable}`);
  }

  /**
   * Simple task execution using Python script
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    
    try {
      // If no Python script path, fall back to context processing
      if (!this.pythonScriptPath || !fs.existsSync(this.pythonScriptPath)) {
        this.pythonLogger.debug(`No Python script for ${agentName}, using context fallback`);
        return this.processWithContext(method, params);
      }

      // Prepare standardized parameters for the Python script
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: null, // Python script will handle LLM calls via API
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString()
        }
      };

      // Execute the Python script
      const result = await this.executePythonScript(functionParams);
      
      this.pythonLogger.debug(`Python script executed successfully for ${agentName}`);
      
      // Return structured response format to match FunctionAgentBaseService
      return {
        success: true,
        response: result.response || result,
        metadata: {
          agentType: this.getAgentType(),
          executionType: 'python_script',
          scriptPath: this.pythonScriptPath,
          processedAt: new Date().toISOString(),
          ...functionParams.metadata
        }
      };
      
    } catch (error) {
      this.pythonLogger.error(`Python script execution error for ${agentName}:`, error);
      
      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `I apologize, but I encountered an error while processing your request. Falling back to basic processing.`,
        metadata: {
          agentName: agentName,
          agentType: this.getAgentType(),
          executionType: 'python_script_error',
          scriptPath: this.pythonScriptPath,
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Execute Python script with parameters
   */
  private async executePythonScript(params: AgentFunctionParams): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.pythonScriptPath) {
        reject(new Error('Python script path not set'));
        return;
      }

      // Prepare input data for Python script
      const inputData = JSON.stringify(params);
      
      // Spawn Python process
      const pythonProcess: ChildProcess = spawn(this.pythonExecutable, [this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(this.pythonScriptPath)
      });

      let stdout = '';
      let stderr = '';

      // Collect output
      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}. Error: ${stderr}`));
          return;
        }

        try {
          // Try to parse JSON response from Python script
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          // If not JSON, return raw output
          resolve({ response: stdout.trim() });
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Send input data to Python script
      if (pythonProcess.stdin) {
        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();
      }

      // Set timeout for script execution
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill();
          reject(new Error('Python script execution timed out'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Extract user message from parameters
   */
  private extractUserMessage(params: any): string {
    if (typeof params === 'string') {
      return params;
    }
    
    if (params && typeof params === 'object') {
      const messageProps = ['message', 'userMessage', 'prompt', 'input', 'content', 'text'];
      
      for (const prop of messageProps) {
        if (params[prop] && typeof params[prop] === 'string') {
          return params[prop];
        }
      }
      
      return JSON.stringify(params);
    }
    
    return String(params || '');
  }

  /**
   * Simple context-based fallback processing
   */
  private async processWithContext(method: string, params: any): Promise<any> {
    this.pythonLogger.debug(`Using context fallback for ${this.getAgentName()}`);
    
    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} agent. I'm ready to help, but my Python script isn't available yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        executionType: 'fallback',
        reason: 'No Python script available',
        method,
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.pythonLogger.debug(`Agent path set to: ${path}`);
  }

  /**
   * Get agent card with Python script status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      pythonScriptStatus: this.pythonScriptPath && fs.existsSync(this.pythonScriptPath) ? 'available' : 'not_available',
      pythonScriptPath: this.pythonScriptPath,
      pythonExecutable: this.pythonExecutable,
      loadedAt: this.pythonScriptPath ? new Date().toISOString() : null
    };
  }
} 