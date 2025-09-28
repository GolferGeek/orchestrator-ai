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

  static human(message: string, reason?: string) {
    return new TaskResponseDto(false, 'human_response', undefined, {
      message,
      reason,
    });
  }

  static failure(mode: string, reason: string) {
    return new TaskResponseDto(false, mode, { metadata: { reason } });
  }
}
