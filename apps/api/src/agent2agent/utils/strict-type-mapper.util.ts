/**
 * Strict Type Mapper Utility
 * Converts between internal DTOs and strict A2A protocol types
 */

import {
  AgentTaskMode,
  StrictA2ARequest,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
  StrictPlanRequest,
  StrictBuildRequest,
  StrictConverseRequest,
  StrictPlanResponse,
  StrictBuildResponse,
  StrictConverseResponse,
  isStrictPlanResponse,
  isStrictBuildResponse,
} from '@orchestrator-ai/a2a-protocol';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';

/**
 * Map a TaskRequestDto to a strict A2A request type based on mode
 */
export function toStrictRequest(
  dto: TaskRequestDto,
  jsonrpcId: string | number,
): StrictA2ARequest | null {
  const mode = dto.mode;

  if (!mode) {
    return null;
  }

  // Base params common to all requests
  const baseParams = {
    conversationId: dto.conversationId || '',
    userMessage: dto.userMessage || '',
    messages: dto.messages?.map(m => ({
      role: m.role,
      content: m.content,
    })) || [],
    metadata: dto.metadata,
  };

  switch (mode) {
    case AgentTaskMode.CONVERSE:
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        method: 'converse',
        params: {
          mode: AgentTaskMode.CONVERSE,
          ...baseParams,
        },
      } as StrictConverseRequest;

    case AgentTaskMode.PLAN:
      if (!dto.payload?.action) {
        throw new Error('Plan mode requires action field in payload');
      }
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        method: 'plan',
        params: {
          mode: AgentTaskMode.PLAN,
          ...baseParams,
          payload: dto.payload,
        },
      } as unknown as StrictPlanRequest;

    case AgentTaskMode.BUILD:
      if (!dto.payload?.action) {
        throw new Error('Build mode requires action field in payload');
      }
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        method: 'build',
        params: {
          mode: AgentTaskMode.BUILD,
          ...baseParams,
          payload: dto.payload,
        },
      } as unknown as StrictBuildRequest;

    default:
      // For unsupported modes, return null
      return null;
  }
}

/**
 * Map a TaskResponseDto to a strict A2A success response based on mode
 */
export function toStrictSuccessResponse(
  dto: TaskResponseDto,
  jsonrpcId: string | number,
): StrictA2ASuccessResponse | null {
  if (!dto.success || !dto.mode) {
    return null;
  }

  const mode = dto.mode;
  const payload = dto.payload || {};

  switch (mode) {
    case 'converse':
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        result: {
          success: true,
          mode: 'converse',
          payload: {
            content: payload.content || { message: '' },
            metadata: payload.metadata || { timestamp: new Date().toISOString() },
          },
        },
      } as StrictConverseResponse;

    case 'plan':
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        result: {
          success: true,
          mode: 'plan',
          payload: {
            content: payload.content || {},
            metadata: payload.metadata || { timestamp: new Date().toISOString() },
          },
        },
      } as StrictPlanResponse;

    case 'build':
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        result: {
          success: true,
          mode: 'build',
          payload: {
            content: payload.content || {},
            metadata: payload.metadata || { timestamp: new Date().toISOString() },
          },
        },
      } as StrictBuildResponse;

    default:
      // For other modes, create a generic success response
      return {
        jsonrpc: '2.0',
        id: jsonrpcId,
        result: {
          success: true,
          mode: mode,
          payload: {
            content: payload.content || payload,
            metadata: payload.metadata || { timestamp: new Date().toISOString() },
          },
        },
      } as any;
  }
}

/**
 * Map an error to a strict A2A error response
 */
export function toStrictErrorResponse(
  error: unknown,
  mode: string | undefined,
  jsonrpcId: string | number | null,
  errorCode: number = -32603,
  errorMessage?: string,
): StrictA2AErrorResponse {
  const message = errorMessage ||
    (error instanceof Error ? error.message : 'Internal server error');

  return {
    jsonrpc: '2.0',
    id: jsonrpcId,
    error: {
      code: errorCode,
      message,
      data: {
        mode: mode || 'unknown',
        details: error instanceof Error ? error.stack : undefined,
      },
    },
  };
}

/**
 * Validate if a response can be converted to a strict type
 */
export function canConvertToStrictResponse(dto: TaskResponseDto): boolean {
  if (!dto.success || !dto.mode) {
    return false;
  }

  // Check if mode is one of the supported strict modes
  const supportedModes = ['converse', 'plan', 'build'];
  return supportedModes.includes(dto.mode);
}
