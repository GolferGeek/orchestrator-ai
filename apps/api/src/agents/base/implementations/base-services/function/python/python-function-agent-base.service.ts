import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../../a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentFunctionParams } from '../../a2a-base/interfaces';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { TasksService } from '@/tasks/tasks.service';
import { TaskStatusService } from '@/tasks/task-status.service';

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
  protected readonly pythonLogger = new Logger(
    PythonFunctionAgentBaseService.name,
  );
  private pythonScriptPath: string | null = null;
  private pythonExecutable: string = 'pdm'; // Use PDM by default for dependency management
  private pythonArgs: string[] = ['run', 'python']; // PDM run python args
  private currentUserId: string | null = null; // Store current user ID for task completion

  constructor(
    protected readonly httpService: HttpService,
    protected readonly llmService: LLMService,
    @Inject(forwardRef(() => TaskProgressGateway))
    protected readonly taskProgressGateway: TaskProgressGateway | undefined,
    @Inject(forwardRef(() => TasksService))
    protected readonly tasksService: TasksService | undefined,
    @Inject(forwardRef(() => TaskStatusService))
    protected readonly taskStatusService: TaskStatusService | undefined,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    super(
      httpService,
      undefined, // TaskStatusService will be injected automatically
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );
  }

  /**
   * Set the Python script path for this agent (called by AgentDiscoveryService)
   */
  setPythonScriptPath(scriptPath: string): void {
    this.pythonScriptPath = scriptPath;
    const exists = fs.existsSync(scriptPath);
    this.pythonLogger.debug(
      `🐍 Python script path set for ${this.getAgentName()}: ${scriptPath} (exists: ${exists})`,
    );
    if (!exists) {
      this.pythonLogger.error(`❌ Python script file does not exist: ${scriptPath}`);
    }
  }

  /**
   * Set the Python executable to use (python3, python, pdm, specific path, etc.)
   */
  setPythonExecutable(executable: string): void {
    if (executable === 'pdm') {
      this.pythonExecutable = 'pdm';
      this.pythonArgs = ['run', 'python'];
    } else {
      this.pythonExecutable = executable;
      this.pythonArgs = [];
    }
    this.pythonLogger.debug(
      `Python executable set for ${this.getAgentName()}: ${executable} (args: ${this.pythonArgs.join(' ')})`,
    );
  }

  /**
   * Simple task execution using Python script
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    
    // Store current user ID for task completion handling
    if (params.currentUser?.id) {
      this.currentUserId = params.currentUser.id;
    }

    try {
      this.pythonLogger.debug(`🔍 executeTask called for ${agentName}:`);
      this.pythonLogger.debug(`   - pythonScriptPath: ${this.pythonScriptPath}`);
      this.pythonLogger.debug(`   - file exists: ${this.pythonScriptPath ? fs.existsSync(this.pythonScriptPath) : 'N/A'}`);
      
      // If no Python script path, fall back to context processing
      if (!this.pythonScriptPath || !fs.existsSync(this.pythonScriptPath)) {
        this.pythonLogger.debug(
          `❌ No Python script for ${agentName}, using context fallback`,
        );
        return this.processWithContext(method, params);
      }
      
      this.pythonLogger.debug(`✅ Python script found, proceeding with execution`);
      

      // Prepare standardized parameters for the Python script
      // Note: Python scripts use API calls, so we pass user preferences in metadata
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
          timestamp: new Date().toISOString(),
          taskId: params.taskId, // Pass task ID for progress tracking
          // Pass LLM preferences to Python script via metadata
          llmPreferences: {
            providerId: params.providerId,
            modelId: params.modelId,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            cidafmOptions: params.cidafmOptions,
          },
        },
      };

      // Execute the Python script
      const result = await this.executePythonScript(functionParams);

      this.pythonLogger.debug(
        `Python script executed successfully for ${agentName}`,
      );

      // Return structured response format to match FunctionAgentBaseService
      return {
        success: true,
        response: result.response || result,
        metadata: {
          agentType: this.getAgentType(),
          executionType: 'python_script',
          scriptPath: this.pythonScriptPath,
          processedAt: new Date().toISOString(),
          ...functionParams.metadata,
        },
      };
    } catch (error) {
      this.pythonLogger.error(
        `Python script execution error for ${agentName}:`,
        error,
      );

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
          processedAt: new Date().toISOString(),
        },
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

      // Spawn Python process using PDM
      const args = [...this.pythonArgs, this.pythonScriptPath];
      const pythonProcess: ChildProcess = spawn(this.pythonExecutable, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(this.pythonScriptPath),
      });

      let stdout = '';
      let stderr = '';

      // Collect output
      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        const stderrData = data.toString();
        stderr += stderrData;

        // Parse progress events from stderr
        const lines = stderrData.split('\n');
        this.pythonLogger.debug(`Processing ${lines.length} stderr lines from Python script`);
        for (const line of lines) {
          if (line.trim()) {
            this.pythonLogger.debug(`Python stderr line: ${line}`);
          }
          if (line.startsWith('PROGRESS_EVENT:')) {
            try {
              const progressJson = line
                .substring('PROGRESS_EVENT:'.length)
                .trim();
              const progressEvent = JSON.parse(progressJson);

              // Store message in live cache for polling clients
              this.pythonLogger.debug(
                `TaskStatusService debug: service=${!!this.taskStatusService}, taskId=${progressEvent.taskId}`,
              );
              if (this.taskStatusService && progressEvent.taskId) {
                const messageContent = JSON.stringify({
                  stepName: progressEvent.stepName,
                  stepIndex: progressEvent.stepIndex,
                  totalSteps: progressEvent.totalSteps,
                  status: progressEvent.status,
                  message: progressEvent.message
                });
                
                this.taskStatusService.addTaskMessage(
                  progressEvent.taskId,
                  messageContent,
                  'progress',
                  {
                    progress: progressEvent.stepIndex && progressEvent.totalSteps 
                      ? Math.round(((progressEvent.stepIndex + 1) / progressEvent.totalSteps) * 100) 
                      : undefined,
                    stepName: progressEvent.stepName,
                    stepIndex: progressEvent.stepIndex,
                    totalSteps: progressEvent.totalSteps,
                    stepStatus: progressEvent.status
                  }
                );
                
                this.pythonLogger.debug(
                  `Stored progress message in live cache for task ${progressEvent.taskId}`,
                );
              }

              // Broadcast workflow step progress via WebSocket
              if (this.taskProgressGateway) {
                this.taskProgressGateway.broadcastWorkflowStepProgress(
                  progressEvent.taskId,
                  progressEvent.stepName,
                  progressEvent.stepIndex,
                  progressEvent.totalSteps,
                  progressEvent.status,
                  progressEvent.message,
                );
              } else {
                this.pythonLogger.error('TaskProgressGateway is not available for broadcasting progress events');
              }

              this.pythonLogger.debug(
                `Broadcast workflow step progress: ${progressEvent.stepName} (${progressEvent.status})`,
              );
            } catch (error) {
              this.pythonLogger.warn(
                `Failed to parse progress event: ${line}`,
                error,
              );
            }
          } else if (line.startsWith('COMPLETION_EVENT:')) {
            try {
              const completionJson = line
                .substring('COMPLETION_EVENT:'.length)
                .trim();
              const completionEvent = JSON.parse(completionJson);

              // Update task status in database and broadcast completion via WebSocket
              if (this.taskProgressGateway) {
                this.taskProgressGateway.broadcastTaskCompletion(
                  completionEvent.taskId,
                  completionEvent.status,
                  completionEvent.message,
                );
              } else {
                this.pythonLogger.error('TaskProgressGateway is not available for broadcasting completion events');
              }

              // Note: Task completion with result is now handled in process completion
              // This event is just for broadcasting completion to WebSocket clients

              this.pythonLogger.debug(
                `Python script confirmed task completion: ${completionEvent.taskId} (${completionEvent.status})`,
              );
            } catch (error) {
              this.pythonLogger.warn(
                `Failed to parse completion event: ${line}`,
                error,
              );
            }
          }
        }
      });

      // Handle process completion
      pythonProcess.on('close', async (code) => {
        this.pythonLogger.debug(`🔍 Python process closed with code: ${code}`);
        this.pythonLogger.debug(`🔍 Python stdout length: ${stdout.length}`);
        this.pythonLogger.debug(`🔍 Python stderr length: ${stderr.length}`);
        this.pythonLogger.debug(`🔍 Python stdout content: ${stdout.substring(0, 500)}...`);
        
        if (code !== 0) {
          this.pythonLogger.error(`❌ Python script failed with code ${code}. Error: ${stderr}`);
          reject(
            new Error(
              `Python script exited with code ${code}. Error: ${stderr}`,
            ),
          );
          return;
        }

        try {
          // Try to parse JSON response from Python script
          this.pythonLogger.debug(`🔍 Attempting to parse Python script output as JSON...`);
          const result = JSON.parse(stdout.trim());
          this.pythonLogger.debug(`🔍 Successfully parsed JSON result:`, result);
          
          // Save the result to the task in database for async tasks
          this.pythonLogger.debug(`🔍 Checking if we can save result to database:`);
          this.pythonLogger.debug(`  - tasksService available: ${!!this.tasksService}`);
          this.pythonLogger.debug(`  - currentUserId available: ${!!this.currentUserId}`);
          this.pythonLogger.debug(`  - params.metadata.taskId: ${params.metadata?.taskId}`);
          this.pythonLogger.debug(`  - result to save: ${JSON.stringify(result).substring(0, 300)}...`);
          
          this.pythonLogger.debug(`🔍 About to attempt database save...`);
          
          const taskId = params.metadata?.taskId;
          if (this.tasksService && this.currentUserId && taskId) {
            try {
              const updateData = {
                status: 'completed' as const,
                progress: 100,
                response: JSON.stringify(result), // Save the full result
                responseMetadata: result.metadata || {},
              };
              
              this.pythonLogger.debug(`🔍 Calling updateTask with:`, {
                taskId: taskId,
                userId: this.currentUserId,
                updateData: updateData
              });
              
              const updateResult = await this.tasksService.updateTask(taskId, this.currentUserId, updateData);
              
              this.pythonLogger.debug(
                `✅ Task ${taskId} result saved to database successfully. Update result:`, updateResult
              );
            } catch (error) {
              this.pythonLogger.error(
                `❌ Failed to save task ${taskId} result:`,
                error
              );
              this.pythonLogger.error(
                `❌ Error details:`, {
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined
                }
              );
            }
          } else {
            this.pythonLogger.warn(
              `❌ Cannot save result - missing requirements:`,
              {
                tasksService: !!this.tasksService,
                currentUserId: this.currentUserId,
                taskId: taskId,
                hasTasksService: !!this.tasksService,
                hasCurrentUserId: !!this.currentUserId,
                hasTaskId: !!taskId
              }
            );
          }
          
          resolve(result);
        } catch {
          // If not JSON, return raw output
          const rawResult = { response: stdout.trim() };
          
          // Save raw result to database for async tasks
          const taskId = params.metadata?.taskId;
          if (this.tasksService && this.currentUserId && taskId) {
            try {
              await this.tasksService.updateTask(taskId, this.currentUserId, {
                status: 'completed' as const,
                progress: 100,
                response: stdout.trim(),
              });
              
              this.pythonLogger.debug(
                `✅ Task ${taskId} raw result saved to database`,
              );
            } catch (error) {
              this.pythonLogger.error(
                `❌ Failed to save task ${taskId} raw result:`,
                error,
              );
            }
          }
          
          resolve(rawResult);
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
      const messageProps = [
        'message',
        'userMessage',
        'prompt',
        'input',
        'content',
        'text',
      ];

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
  private async processWithContext(method: string, _params: any): Promise<any> {
    this.pythonLogger.debug(
      `Using context fallback for ${this.getAgentName()}`,
    );

    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} agent. I'm ready to help, but my Python script isn't available yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        executionType: 'fallback',
        reason: 'No Python script available',
        method,
        processedAt: new Date().toISOString(),
      },
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
      pythonScriptStatus:
        this.pythonScriptPath && fs.existsSync(this.pythonScriptPath)
          ? 'available'
          : 'not_available',
      pythonScriptPath: this.pythonScriptPath,
      pythonExecutable: this.pythonExecutable,
      loadedAt: this.pythonScriptPath ? new Date().toISOString() : null,
    };
  }
}
