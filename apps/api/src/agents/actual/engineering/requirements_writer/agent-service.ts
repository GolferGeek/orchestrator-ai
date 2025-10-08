import { Injectable } from '@nestjs/common';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';

@Injectable()
export class RequirementsWriterService extends FunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
  ) {
    super(services);
    // Align total workflow steps with the TypeScript implementation
    this.setTotalSteps(6);
  }

  getAgentName(): string {
    return 'requirements_writer';
  }

  getAgentType(): 'engineering' {
    return 'engineering';
  }

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
