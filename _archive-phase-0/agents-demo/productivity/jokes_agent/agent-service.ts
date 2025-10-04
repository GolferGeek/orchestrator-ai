import { Injectable } from '@nestjs/common';
import { ApiAgentBaseService } from '../../../base/implementations/base-services/api';
import { ApiAgentServicesContext } from '../../../base/services/api-agent-services-context';

@Injectable()
export class ProductivityJokesAgentService extends ApiAgentBaseService {
  constructor(services: ApiAgentServicesContext) {
    super(services);
  }

  getAgentName(): string {
    return 'Productivity Jokes Agent';
  }

  getAgentType(): 'operations' {
    return 'operations';
  }
}
