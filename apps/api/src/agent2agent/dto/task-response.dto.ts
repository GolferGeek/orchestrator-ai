import {
  TaskResponse,
  TaskResponsePayload,
  // Import strict response types
  StrictA2AResponse,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
  StrictPlanResponse,
  StrictBuildResponse,
  StrictConverseResponse,
  isStrictErrorResponse,
  isStrictSuccessResponse,
  isStrictPlanResponse,
  isStrictBuildResponse,
} from '@orchestrator-ai/a2a-protocol';

// Re-export shared types
export {
  TaskResponse,
  TaskResponsePayload,
  // Re-export strict response types
  StrictA2AResponse,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
  StrictPlanResponse,
  StrictBuildResponse,
  StrictConverseResponse,
  isStrictErrorResponse,
  isStrictSuccessResponse,
  isStrictPlanResponse,
  isStrictBuildResponse,
};

export interface HumanResponsePayload {
  message: string;
  reason?: string;
}

export class TaskResponseDto implements TaskResponse {
  constructor(
    public readonly success: boolean,
    public readonly mode: string,
    public readonly payload?: TaskResponsePayload,
    public readonly humanResponse?: HumanResponsePayload,
  ) {}

  static success(mode: string, payload?: TaskResponsePayload) {
    return new TaskResponseDto(true, mode, payload);
  }

  static human(
    message: string,
    metadataOrReason?: string | Record<string, any>,
    maybeReason?: string,
  ) {
    let reason: string | undefined = undefined;
    let metadata: Record<string, any> | undefined = undefined;
    if (typeof metadataOrReason === 'string') {
      reason = metadataOrReason;
    } else if (metadataOrReason && typeof metadataOrReason === 'object') {
      metadata = metadataOrReason as Record<string, any>;
    }
    if (typeof maybeReason === 'string') {
      reason = maybeReason;
    }

    return new TaskResponseDto(
      false,
      'human_response',
      metadata ? { metadata } : undefined,
      {
        message,
        reason,
      },
    );
  }

  static failure(mode: string, reason: string) {
    return new TaskResponseDto(false, mode, { metadata: { reason } });
  }
}
