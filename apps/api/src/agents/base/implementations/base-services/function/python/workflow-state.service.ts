import { Injectable } from '@nestjs/common';

export interface WorkflowStep {
  name: string;
  index: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  workflowId: string;
  taskId: string;
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  status: 'initialized' | 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  metadata: Record<string, any>;
  startTime: string;
  endTime?: string;
}

/**
 * Service for managing LangGraph workflow state patterns
 * Provides utilities for tracking workflow progress, step transitions,
 * and state management across Python-based LangGraph agents
 */
@Injectable()
export class WorkflowStateService {

  /**
   * Create initial workflow state
   */
  createInitialState(
    workflowId: string,
    taskId: string,
    stepNames: string[],
    initialMetadata: Record<string, any> = {}
  ): WorkflowState {
    const steps: WorkflowStep[] = stepNames.map((name, index) => ({
      name,
      index,
      status: 'pending'
    }));

    return {
      workflowId,
      taskId,
      currentStep: stepNames[0] || '',
      stepIndex: 0,
      totalSteps: stepNames.length,
      status: 'initialized',
      steps,
      metadata: {
        ...initialMetadata,
        createdAt: new Date().toISOString()
      },
      startTime: new Date().toISOString()
    };
  }

  /**
   * Update workflow state for step transition
   */
  updateStepProgress(
    state: WorkflowState,
    stepName: string,
    status: 'in_progress' | 'completed' | 'failed',
    error?: string,
    stepMetadata?: Record<string, any>
  ): WorkflowState {
    const stepIndex = state.steps.findIndex(step => step.name === stepName);
    
    if (stepIndex === -1) {
      throw new Error(`Step '${stepName}' not found in workflow`);
    }

    const updatedSteps = [...state.steps];
    const currentTime = new Date().toISOString();

    // Update the specific step
    const currentStep = updatedSteps[stepIndex];
    if (!currentStep) {
      throw new Error(`Step at index ${stepIndex} not found`);
    }
    
    updatedSteps[stepIndex] = {
      ...currentStep,
      status,
      ...(status === 'in_progress' && { startTime: currentTime }),
      ...(status === 'completed' || status === 'failed') && { endTime: currentTime },
      ...(error && { error }),
      ...(stepMetadata && { metadata: { ...currentStep.metadata || {}, ...stepMetadata } })
    };

    // Determine overall workflow status
    let workflowStatus: WorkflowState['status'] = 'running';
    
    if (status === 'failed') {
      workflowStatus = 'failed';
    } else if (status === 'completed' && stepIndex === state.totalSteps - 1) {
      workflowStatus = 'completed';
    }

    return {
      ...state,
      currentStep: stepName,
      stepIndex,
      status: workflowStatus,
      steps: updatedSteps,
      ...(workflowStatus === 'completed' || workflowStatus === 'failed') && { 
        endTime: currentTime 
      }
    };
  }

  /**
   * Get workflow progress summary
   */
  getProgressSummary(state: WorkflowState): {
    completedSteps: number;
    totalSteps: number;
    progressPercent: number;
    currentStep: string;
    estimatedTimeRemaining?: number;
  } {
    const completedSteps = state.steps.filter(step => step.status === 'completed').length;
    const progressPercent = Math.round((completedSteps / state.totalSteps) * 100);

    return {
      completedSteps,
      totalSteps: state.totalSteps,
      progressPercent,
      currentStep: state.currentStep,
      // Could add time estimation logic here
    };
  }

  /**
   * Check if workflow can proceed to next step
   */
  canProceedToNextStep(state: WorkflowState, currentStepName: string): boolean {
    const currentStep = state.steps.find(step => step.name === currentStepName);
    return currentStep?.status === 'completed' || false;
  }

  /**
   * Get next step in workflow
   */
  getNextStep(state: WorkflowState, currentStepName: string): WorkflowStep | null {
    const currentIndex = state.steps.findIndex(step => step.name === currentStepName);
    
    if (currentIndex === -1 || currentIndex >= state.steps.length - 1) {
      return null;
    }

    return state.steps[currentIndex + 1] || null;
  }

  /**
   * Generate workflow state for Python LangGraph scripts
   */
  generatePythonStateCode(state: WorkflowState): string {
    return `
# Workflow State Configuration
WORKFLOW_STATE = {
    "workflow_id": "${state.workflowId}",
    "task_id": "${state.taskId}",
    "current_step": "${state.currentStep}",
    "step_index": ${state.stepIndex},
    "total_steps": ${state.totalSteps},
    "status": "${state.status}",
    "metadata": ${JSON.stringify(state.metadata, null, 4)},
    "start_time": "${state.startTime}"
}

# Step definitions
WORKFLOW_STEPS = ${JSON.stringify(state.steps.map(step => ({
  name: step.name,
  index: step.index,
  status: step.status
})), null, 4)}
`;
  }

  /**
   * Convert workflow state to Python TypedDict format
   */
  generatePythonTypedDictCode(state: WorkflowState): string {
    const stateFields = Object.keys(state.metadata || {});
    
    return `
from typing import Dict, List, Any, Optional, TypedDict

class WorkflowState(TypedDict):
    workflow_id: str
    task_id: str
    current_step: str
    step_index: int
    total_steps: int
    status: str
    metadata: Dict[str, Any]
    start_time: str
    end_time: Optional[str]
    ${stateFields.map(field => `${field}: Optional[Any]`).join('\n    ')}
`;
  }
}