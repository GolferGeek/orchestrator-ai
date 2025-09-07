import { Injectable, Logger } from '@nestjs/common';
import { A2AAgentBaseService } from '../../a2a-base/a2a-agent-base.service';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AgentFunctionParams } from '../../a2a-base/interfaces';
import { PythonFunctionAgentServicesContext } from '../../../../services/python-function-agent-services-context';

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
    // Pure service container pattern - only accepts PythonFunctionAgentServicesContext
    private readonly services: PythonFunctionAgentServicesContext,
  ) {
    super(
      services.httpService,
      services.taskStatusService,
      services.deliverablesService,
      services.deliverableVersionsService,
      services.tasksService, // Fix: Pass tasksService to enable deliverable creation
      services.agentRegistrationService,
      services.jsonRpcProtocolService,
      services.loggingService,
      services.authService,
      services.configurationService,
    );
  }

  /**
   * Set the Python script path for this agent (called by AgentDiscoveryService)
   */
  setPythonScriptPath(scriptPath: string): void {
    this.pythonScriptPath = scriptPath;
    const exists = fs.existsSync(scriptPath);
    if (!exists) {
      this.pythonLogger.error(
        `❌ Python script file does not exist: ${scriptPath}`,
      );
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

      // If no Python script path, fall back to context processing
      if (!this.pythonScriptPath || !fs.existsSync(this.pythonScriptPath)) {
        return this.processWithContext(method, params);
      }

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
            providerName: params.providerName,
            modelName: params.modelName,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            cidafmOptions: params.cidafmOptions,
          },
        },
      };

      // Execute the Python script
      const result = await this.executePythonScript(functionParams);

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
        for (const line of lines) {
          if (line.trim()) {
          }
          if (line.startsWith('PROGRESS_EVENT:')) {
            try {
              const progressJson = line
                .substring('PROGRESS_EVENT:'.length)
                .trim();
              const progressEvent = JSON.parse(progressJson);

              // Store message in live cache for polling clients
              if (this.taskStatusService && progressEvent.taskId) {
                const messageContent = JSON.stringify({
                  stepName: progressEvent.stepName,
                  stepIndex: progressEvent.stepIndex,
                  totalSteps: progressEvent.totalSteps,
                  status: progressEvent.status,
                  message: progressEvent.message,
                });

                this.taskStatusService.addTaskMessage(
                  progressEvent.taskId,
                  messageContent,
                  'progress',
                  {
                    progress:
                      progressEvent.stepIndex && progressEvent.totalSteps
                        ? Math.round(
                            ((progressEvent.stepIndex + 1) /
                              progressEvent.totalSteps) *
                              100,
                          )
                        : undefined,
                    stepName: progressEvent.stepName,
                    stepIndex: progressEvent.stepIndex,
                    totalSteps: progressEvent.totalSteps,
                    stepStatus: progressEvent.status,
                  },
                );

              }

              // Broadcast workflow step progress via WebSocket
              if (this.services.taskProgressGateway) {
                this.services.taskProgressGateway.broadcastWorkflowStepProgress(
                  progressEvent.taskId,
                  progressEvent.stepName,
                  progressEvent.stepIndex,
                  progressEvent.totalSteps,
                  progressEvent.status,
                  progressEvent.message,
                );
              } else {
                this.pythonLogger.error(
                  'TaskProgressGateway is not available for broadcasting progress events',
                );
              }

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
              if (this.services.taskProgressGateway) {
                this.services.taskProgressGateway.broadcastTaskCompletion(
                  completionEvent.taskId,
                  completionEvent.status,
                  completionEvent.message,
                );
              } else {
                this.pythonLogger.error(
                  'TaskProgressGateway is not available for broadcasting completion events',
                );
              }

              // Note: Task completion with result is now handled in process completion
              // This event is just for broadcasting completion to WebSocket clients

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

        if (code !== 0) {
          this.pythonLogger.error(
            `❌ Python script failed with code ${code}. Error: ${stderr}`,
          );
          reject(
            new Error(
              `Python script exited with code ${code}. Error: ${stderr}`,
            ),
          );
          return;
        }

        try {
          // Try to parse JSON response from Python script
          const result = JSON.parse(stdout.trim());

          // Save the result to the task in database for async tasks

          const taskId = params.metadata?.taskId;
          if (this.services.tasksService && this.currentUserId && taskId) {
            try {
              const updateData = {
                status: 'completed' as const,
                progress: 100,
                response: JSON.stringify(result), // Save the full result
                responseMetadata: result.metadata || {},
              };

              // Use parent class completeTask method which includes deliverable creation
              await this.completeTask(taskId, this.currentUserId, result);

              // Broadcast final response to WebSocket clients
              if (this.services.taskProgressGateway) {
                this.services.taskProgressGateway.broadcastTaskCompletionWithResponse(
                  taskId,
                  'completed',
                  'Task completed successfully with response',
                  result.response || result, // Include the actual response content
                  result.metadata || {},
                );
              }
            } catch (error) {
              this.pythonLogger.error(
                `❌ Failed to save task ${taskId} result:`,
                error,
              );
              this.pythonLogger.error(`❌ Error details:`, {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              });
            }
          } else {
            this.pythonLogger.warn(
              `❌ Cannot save result - missing requirements:`,
              {
                tasksService: !!this.services.tasksService,
                currentUserId: this.currentUserId,
                taskId: taskId,
                hasTasksService: !!this.services.tasksService,
                hasCurrentUserId: !!this.currentUserId,
                hasTaskId: !!taskId,
              },
            );
          }

          resolve(result);
        } catch {
          // If not JSON, return raw output
          const rawResult = { response: stdout.trim() };

          // Use parent class completeTask method for proper deliverable creation
          const taskId = params.metadata?.taskId;
          if (this.services.tasksService && this.currentUserId && taskId) {
            try {
              // Use parent class completeTask method which includes deliverable creation
              await this.completeTask(taskId, this.currentUserId, rawResult);

              // Broadcast final response to WebSocket clients for raw result
              if (this.services.taskProgressGateway) {
                this.services.taskProgressGateway.broadcastTaskCompletionWithResponse(
                  taskId,
                  'completed',
                  'Task completed successfully with raw response',
                  rawResult.response,
                  {},
                );
              }
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
      }, 60000); // 60 second timeout
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
