import { Injectable } from '@nestjs/common';
import { PythonFunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { PythonFunctionAgentServicesContext } from '@agents/base/services/python-function-agent-services-context';

@Injectable()
export class RequirementsWriterService extends PythonFunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts PythonFunctionAgentServicesContext
    services: PythonFunctionAgentServicesContext,
  ) {
    super(services);
    // Python script path will be set by AgentDiscoveryService during discovery
  }

  getAgentName(): string {
    return 'requirements_writer';
  }

  // Task type is no longer used - all tasks are handled as ephemeral

  /**
   * Define status schema for workflow progress tracking
   */
  protected getStatusSchema(): Record<string, any> {
    return {
      currentStep: 'string',
      stepIndex: 'number',
      totalSteps: 'number',
      workflowSteps: {
        type: 'array',
        items: {
          stepName: 'string',
          stepIndex: 'number',
          status: 'string',
          message: 'string',
          timestamp: 'string',
        },
      },
    };
  }
}
