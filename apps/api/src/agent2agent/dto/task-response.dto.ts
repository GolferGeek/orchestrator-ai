export interface HumanResponsePayload {
  message: string;
  reason?: string;
}

export interface TaskResponsePayload {
  content?: any;
  deliverables?: any[];
  metadata?: Record<string, any>;
}

export class TaskResponseDto {
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
