import { Injectable } from '@nestjs/common';

export interface ProgressEvent {
  type: 'workflow_step_progress';
  taskId: string;
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'in_progress' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
}

export interface CompletionEvent {
  type: 'task_completion';
  taskId: string;
  status: 'completed' | 'failed';
  message?: string;
  timestamp: string;
}

/**
 * Service for handling progress emission patterns used by Python agents
 * Provides utilities for creating and managing progress events that are
 * emitted to stderr for WebSocket communication
 */
@Injectable()
export class ProgressEmitterService {
  
  /**
   * Create a progress event object with standardized format
   */
  createProgressEvent(
    taskId: string,
    stepName: string,
    stepIndex: number,
    totalSteps: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string
  ): ProgressEvent {
    return {
      type: 'workflow_step_progress',
      taskId,
      stepName,
      stepIndex,
      totalSteps,
      status,
      message: message || `Step ${stepIndex + 1} of ${totalSteps}: ${stepName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a completion event object with standardized format
   */
  createCompletionEvent(
    taskId: string,
    status: 'completed' | 'failed' = 'completed',
    message?: string
  ): CompletionEvent {
    return {
      type: 'task_completion',
      taskId,
      status,
      message: message || 'Task completed successfully',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format progress event for stderr emission (used by Python scripts)
   */
  formatForStderr(event: ProgressEvent | CompletionEvent): string {
    const eventType = event.type === 'workflow_step_progress' ? 'PROGRESS_EVENT' : 'COMPLETION_EVENT';
    return `${eventType}: ${JSON.stringify(event)}`;
  }

  /**
   * Parse progress event from stderr line
   */
  parseFromStderr(line: string): ProgressEvent | CompletionEvent | null {
    try {
      if (line.startsWith('PROGRESS_EVENT:')) {
        const eventJson = line.substring('PROGRESS_EVENT:'.length).trim();
        return JSON.parse(eventJson) as ProgressEvent;
      } else if (line.startsWith('COMPLETION_EVENT:')) {
        const eventJson = line.substring('COMPLETION_EVENT:'.length).trim();
        return JSON.parse(eventJson) as CompletionEvent;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate Python code snippet for progress emission
   * This can be used to inject progress emission into Python scripts
   */
  generatePythonEmissionCode(
    taskId: string,
    stepName: string,
    stepIndex: number,
    totalSteps: number,
    status: string,
    message?: string
  ): string {
    const event = this.createProgressEvent(taskId, stepName, stepIndex, totalSteps, status as any, message);
    return `
import sys
import json
from datetime import datetime

progress_event = ${JSON.stringify(event, null, 2)}
print(f"PROGRESS_EVENT: {json.dumps(progress_event)}", file=sys.stderr)
sys.stderr.flush()
`;
  }
}