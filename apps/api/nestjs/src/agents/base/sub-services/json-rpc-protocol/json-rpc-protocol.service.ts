import { Injectable, Logger } from '@nestjs/common';

// JSON-RPC 2.0 Protocol Interfaces
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Error Code Constants
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000
} as const;

export type JsonRpcErrorCode = typeof JSON_RPC_ERRORS[keyof typeof JSON_RPC_ERRORS];

// Processing Options
export interface JsonRpcProcessingOptions {
  preserveAuthContext?: boolean;
  enableBatchProcessing?: boolean;
  maxBatchSize?: number;
  validateParams?: boolean;
}

// Validation Result
export interface ValidationResult {
  isValid: boolean;
  error?: {
    code: JsonRpcErrorCode;
    message: string;
  };
}

// Method Handler Interface
export interface JsonRpcMethodHandler {
  (method: string, params: any): Promise<any>;
}

// Notification Handler Interface
export interface JsonRpcNotificationHandler {
  (notification: JsonRpcNotification): Promise<void>;
}

@Injectable()
export class JsonRpcProtocolService {
  private readonly logger = new Logger(JsonRpcProtocolService.name);

  /**
   * Process a JSON-RPC request (single or batch)
   */
  async processRequest(
    request: any,
    methodHandler: JsonRpcMethodHandler,
    notificationHandler?: JsonRpcNotificationHandler,
    options: JsonRpcProcessingOptions = {}
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    this.logger.debug('Processing JSON-RPC request', { 
      isBatch: Array.isArray(request),
      method: Array.isArray(request) ? 'batch' : request?.method 
    });

    // Handle batch requests
    if (Array.isArray(request)) {
      if (!options.enableBatchProcessing) {
        return this.createErrorResponse(
          JSON_RPC_ERRORS.INVALID_REQUEST,
          'Batch processing not enabled',
          null
        );
      }
      return this.processBatchRequest(request, methodHandler, notificationHandler, options);
    }

    // Process single request
    return this.processSingleRequest(request, methodHandler, notificationHandler, options);
  }

  /**
   * Process a single JSON-RPC request
   */
  async processSingleRequest(
    request: any,
    methodHandler: JsonRpcMethodHandler,
    notificationHandler?: JsonRpcNotificationHandler,
    options: JsonRpcProcessingOptions = {}
  ): Promise<JsonRpcResponse | null> {
    // Validate request structure
    const validation = this.validateRequest(request);
    if (!validation.isValid) {
      return this.createErrorResponse(
        validation.error!.code,
        validation.error!.message,
        request?.id ?? null
      );
    }

    const jsonRpcRequest = request as JsonRpcRequest;

    // Handle notifications (no response expected)
    if (jsonRpcRequest.id === undefined) {
      if (notificationHandler) {
        try {
          await notificationHandler(jsonRpcRequest as JsonRpcNotification);
        } catch (error) {
          this.logger.error('Notification handler error', { 
            method: jsonRpcRequest.method,
            error: (error as Error).message 
          });
        }
      }
      return null;
    }

    // Process regular request
    try {
      // Prepare parameters with optional auth context preservation
      let params = jsonRpcRequest.params;
      if (options.preserveAuthContext) {
        params = {
          ...jsonRpcRequest.params,
          currentUser: (request as any).currentUser,
          authToken: (request as any).authToken
        };
      }

      const result = await methodHandler(jsonRpcRequest.method, params);
      return this.createSuccessResponse(jsonRpcRequest.id, result);
    } catch (error) {
      return this.createErrorResponseFromException(error, jsonRpcRequest.id);
    }
  }

  /**
   * Process batch JSON-RPC requests
   */
  async processBatchRequest(
    batchRequest: any[],
    methodHandler: JsonRpcMethodHandler,
    notificationHandler?: JsonRpcNotificationHandler,
    options: JsonRpcProcessingOptions = {}
  ): Promise<JsonRpcResponse[]> {
    this.logger.debug('Processing batch request', { count: batchRequest.length });

    // Validate batch size
    if (batchRequest.length === 0) {
      return [this.createErrorResponse(JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request', null)];
    }

    if (options.maxBatchSize && batchRequest.length > options.maxBatchSize) {
      return [this.createErrorResponse(
        JSON_RPC_ERRORS.INVALID_REQUEST,
        `Batch size exceeds maximum of ${options.maxBatchSize}`,
        null
      )];
    }

    // Process all requests in parallel
    const results = await Promise.allSettled(
      batchRequest.map(request => 
        this.processSingleRequest(request, methodHandler, notificationHandler, options)
      )
    );

    // Filter out null responses (from notifications) and extract values
    const responses: JsonRpcResponse[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        responses.push(result.value);
      } else if (result.status === 'rejected') {
        // Handle unexpected batch processing errors
        responses.push(this.createErrorResponse(
          JSON_RPC_ERRORS.INTERNAL_ERROR,
          'Batch processing error',
          null
        ));
      }
    }

    return responses;
  }

  /**
   * Validate JSON-RPC request structure
   */
  validateRequest(request: any): ValidationResult {
    // Check if request exists
    if (!request || typeof request !== 'object') {
      return {
        isValid: false,
        error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid Request' }
      };
    }

    // Check JSON-RPC version
    if (request.jsonrpc !== '2.0') {
      return {
        isValid: false,
        error: { 
          code: JSON_RPC_ERRORS.INVALID_REQUEST, 
          message: 'Invalid Request: jsonrpc must be "2.0"' 
        }
      };
    }

    // Check method exists and is string
    if (!request.method || typeof request.method !== 'string') {
      return {
        isValid: false,
        error: { 
          code: JSON_RPC_ERRORS.INVALID_REQUEST, 
          message: 'Invalid Request: method must be a string' 
        }
      };
    }

    // Check id type if present (string, number, or null)
    if (request.id !== undefined && 
        request.id !== null && 
        typeof request.id !== 'string' && 
        typeof request.id !== 'number') {
      return {
        isValid: false,
        error: { 
          code: JSON_RPC_ERRORS.INVALID_REQUEST, 
          message: 'Invalid Request: id must be string, number, or null' 
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Create JSON-RPC 2.0 compliant success response
   */
  createSuccessResponse(id: string | number | null, result: any): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id,
      result: result
    };
  }

  /**
   * Create JSON-RPC 2.0 compliant error response
   */
  createErrorResponse(
    code: JsonRpcErrorCode,
    message: string,
    id: string | number | null,
    data?: any
  ): JsonRpcResponse {
    const error: JsonRpcError = {
      code: code,
      message: message
    };

    if (data !== undefined) {
      error.data = data;
    }

    return {
      jsonrpc: '2.0',
      id: id,
      error: error
    };
  }

  /**
   * Create error response from exception with intelligent error mapping
   */
  createErrorResponseFromException(
    error: any,
    id: string | number | null
  ): JsonRpcResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.logger.error('Method execution error', { error: errorMessage, id });

    // Map specific error types to JSON-RPC error codes
    if (errorMessage.includes('Method not found') || 
        errorMessage.includes('executeTask must be implemented')) {
      return this.createErrorResponse(
        JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        'Method not found',
        id
      );
    }

    if (errorMessage.includes('Invalid params')) {
      return this.createErrorResponse(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Invalid params',
        id
      );
    }

    if (errorMessage.includes('Parse error') || errorMessage.includes('JSON')) {
      return this.createErrorResponse(
        JSON_RPC_ERRORS.PARSE_ERROR,
        'Parse error',
        id
      );
    }

    // Default to internal error
    return this.createErrorResponse(
      JSON_RPC_ERRORS.INTERNAL_ERROR,
      'Internal error',
      id,
      process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
    );
  }

  /**
   * Check if a request is a notification (no id field)
   */
  isNotification(request: any): boolean {
    return request && typeof request === 'object' && request.id === undefined;
  }

  /**
   * Check if a request is a batch request
   */
  isBatchRequest(request: any): boolean {
    return Array.isArray(request);
  }

  /**
   * Extract method name from request
   */
  getMethodName(request: any): string | null {
    if (!request || typeof request !== 'object') {
      return null;
    }
    return typeof request.method === 'string' ? request.method : null;
  }

  /**
   * Extract parameters from request
   */
  getParameters(request: any): any {
    if (!request || typeof request !== 'object') {
      return undefined;
    }
    return request.params;
  }

  /**
   * Get error code constants for external use
   */
  getErrorCodes() {
    return JSON_RPC_ERRORS;
  }
} 