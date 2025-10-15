/**
 * Response Handler
 *
 * Routes responses from the backend to the appropriate service handler.
 * This acts as a central dispatcher based on response mode.
 *
 * Key Responsibilities:
 * - Inspect response mode
 * - Route to correct service (conversation, plan, deliverable)
 * - Handle unknown modes gracefully
 */

import type { ServiceConfig } from './types';
import { createServiceError, debugLog } from './types';
import { conversationService } from './conversationService';
import { planService } from './planService';
import { deliverableService } from './deliverableService';

/**
 * Response Handler
 */
export class ResponseHandler {
  private config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Routes a task response to the appropriate service handler
   *
   * @param response - Raw backend response
   * @param conversationId - Conversation ID
   * @returns Processed response
   */
  async handleTaskResponse(response: any, conversationId: string): Promise<any> {
    debugLog(this.config, 'handleTaskResponse', { response, conversationId });

    try {
      // Extract result from JSON-RPC response
      const result = response.result;
      if (!result) {
        throw createServiceError(
          'INVALID_RESPONSE',
          'Response does not contain result',
          { response }
        );
      }

      // Get mode from result
      const mode = result.mode || result.payload?.mode;
      if (!mode) {
        throw createServiceError(
          'INVALID_RESPONSE',
          'Response does not contain mode',
          { response }
        );
      }

      debugLog(this.config, `Routing response for mode: ${mode}`);

      // Route based on mode
      switch (mode) {
        case 'converse':
          return await conversationService.handleResponse(response, conversationId);

        case 'plan':
          return await planService.handleResponse(response, conversationId);

        case 'build':
          return await deliverableService.handleResponse(response, conversationId);

        default:
          throw createServiceError(
            'UNKNOWN_MODE',
            `Unknown or unsupported mode: ${mode}`,
            { mode, response }
          );
      }
    } catch (error) {
      debugLog(this.config, 'Error in handleTaskResponse:', error);
      throw error;
    }
  }

  /**
   * Checks if a response is an error
   *
   * @param response - Response to check
   * @returns True if response is an error
   */
  isErrorResponse(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      (response.success === false || response.error !== undefined)
    );
  }

  /**
   * Extracts error information from a response
   *
   * @param response - Response containing error
   * @returns Error information
   */
  extractError(response: any): { code: string; message: string; details?: any } {
    const error = response.error || response.payload?.error || {};

    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details,
    };
  }
}

// Export singleton instance
export const responseHandler = new ResponseHandler();
