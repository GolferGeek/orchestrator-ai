import {
  TaskResponse,
  TaskResponsePayload,
} from '@orchestrator-ai/transport-types';

// Re-export shared types
export { TaskResponse, TaskResponsePayload };

export interface HumanResponsePayload {
  message: string;
  reason?: string;
}

export class TaskResponseDto implements TaskResponse {
  constructor(
    public readonly success: boolean,
    public readonly mode: string,
    public readonly payload: TaskResponsePayload,
    public readonly humanResponse?: HumanResponsePayload,
  ) {}

  static success(mode: string, payload: TaskResponsePayload) {
    return new TaskResponseDto(true, mode, payload);
  }

  static human(
    message: string,
    metadataOrReason?: string | Record<string, unknown>,
    maybeReason?: string,
  ) {
    let reason: string | undefined = undefined;
    let metadata: Record<string, unknown> | undefined = undefined;
    if (typeof metadataOrReason === 'string') {
      reason = metadataOrReason;
    } else if (metadataOrReason && typeof metadataOrReason === 'object') {
      metadata = metadataOrReason;
    }
    if (typeof maybeReason === 'string') {
      reason = maybeReason;
    }

    // Changed from 'orchestrate' to 'converse' - human review is not orchestration-specific
    return new TaskResponseDto(
      false,
      'converse',
      {
        content: {
          action: 'run_human_response',
          message,
          reason,
        },
        metadata: metadata || {},
      },
      {
        message,
        reason,
      },
    );
  }

  static failure(mode: string, reason: string) {
    return new TaskResponseDto(false, mode, {
      content: {},
      metadata: { reason },
    });
  }
}
