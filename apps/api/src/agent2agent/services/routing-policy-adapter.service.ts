import { Injectable } from '@nestjs/common';
import { CentralizedRoutingService } from '@llm/centralized-routing.service';
import { TaskRequestDto } from '../dto/task-request.dto';

export interface RoutingAssessment {
  showstopper: boolean;
  humanMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RoutingPolicyAdapterService {
  constructor(private readonly routingService: CentralizedRoutingService) {}

  async evaluate(
    request: TaskRequestDto,
    agent: { slug: string },
  ): Promise<RoutingAssessment> {
    // TODO: leverage centralized routing service with real prompt/metadata.
    // Placeholder simply delegates to basic check without enforcing showstoppers.
    const decision = await this.routingService.determineRoute('placeholder', {
      agentSlug: agent.slug,
      mode: request.mode,
    });

    if (decision.routeToAgent === false && decision.blockingReason) {
      return {
        showstopper: true,
        humanMessage: decision.blockingReason,
        metadata: decision,
      };
    }

    return {
      showstopper: false,
      metadata: decision,
    };
  }
}
