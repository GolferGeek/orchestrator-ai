import { Test, TestingModule } from '@nestjs/testing';
import {
  JsonRpcProtocolService,
  JsonRpcRequest,
  JsonRpcNotification,
  JSON_RPC_ERRORS,
  JsonRpcProcessingOptions,
  JsonRpcMethodHandler,
  JsonRpcNotificationHandler,
} from './json-rpc-protocol.service';

describe('JsonRpcProtocolService', () => {
  let service: JsonRpcProtocolService;
  let mockMethodHandler: jest.MockedFunction<JsonRpcMethodHandler>;
  let mockNotificationHandler: jest.MockedFunction<JsonRpcNotificationHandler>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JsonRpcProtocolService],
    }).compile();

    service = module.get<JsonRpcProtocolService>(JsonRpcProtocolService);

    // Create mock handlers
    mockMethodHandler = jest.fn();
    mockNotificationHandler = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('should validate a correct JSON-RPC request', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: { test: 'value' },
        id: '123',
      };

      const result = service.validateRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate a notification (no id)', () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
        params: { test: 'value' },
      };

      const result = service.validateRequest(notification);
      expect(result.isValid).toBe(true);
    });

    it('should reject null/undefined request', () => {
      const result = service.validateRequest(null);
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(result.error?.message).toBe('Invalid Request');
    });

    it('should reject request with wrong jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        method: 'test.method',
        id: '123',
      };

      const result = service.validateRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(result.error?.message).toContain('jsonrpc must be "2.0"');
    });

    it('should reject request without method', () => {
      const request = {
        jsonrpc: '2.0',
        id: '123',
      };

      const result = service.validateRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(result.error?.message).toContain('method must be a string');
    });

    it('should reject request with invalid id type', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test.method',
        id: true, // boolean is invalid
      };

      const result = service.validateRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(result.error?.message).toContain(
        'id must be string, number, or null',
      );
    });

    it('should accept valid id types', () => {
      const validIds = ['string-id', 123, null];

      validIds.forEach((id) => {
        const request = {
          jsonrpc: '2.0',
          method: 'test.method',
          id,
        };

        const result = service.validateRequest(request);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('processSingleRequest', () => {
    it('should process a valid request successfully', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: { input: 'test' },
        id: '123',
      };

      const expectedResult = { output: 'success' };
      mockMethodHandler.mockResolvedValue(expectedResult);

      const response = await service.processSingleRequest(
        request,
        mockMethodHandler,
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        result: expectedResult,
      });
      expect(mockMethodHandler).toHaveBeenCalledWith('test.method', {
        input: 'test',
      });
    });

    it('should handle notifications without returning response', async () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
        params: { data: 'test' },
      };

      const response = await service.processSingleRequest(
        notification,
        mockMethodHandler,
        mockNotificationHandler,
      );

      expect(response).toBeNull();
      expect(mockNotificationHandler).toHaveBeenCalledWith(notification);
      expect(mockMethodHandler).not.toHaveBeenCalled();
    });

    it('should preserve auth context when enabled', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: { input: 'test' },
        id: '123',
        currentUser: { id: 'user1' },
        authToken: 'token123',
      };

      const options: JsonRpcProcessingOptions = {
        preserveAuthContext: true,
      };

      mockMethodHandler.mockResolvedValue({ success: true });

      await service.processSingleRequest(
        request,
        mockMethodHandler,
        undefined,
        options,
      );

      expect(mockMethodHandler).toHaveBeenCalledWith('test.method', {
        input: 'test',
        currentUser: { id: 'user1' },
        authToken: 'token123',
      });
    });

    it('should handle method execution errors', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        id: '123',
      };

      mockMethodHandler.mockRejectedValue(new Error('Method not found'));

      const response = await service.processSingleRequest(
        request,
        mockMethodHandler,
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        error: {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          message: 'Method not found',
        },
      });
    });

    it('should return error for invalid request', async () => {
      const invalidRequest = {
        jsonrpc: '1.0', // wrong version
        method: 'test.method',
        id: '123',
      };

      const response = await service.processSingleRequest(
        invalidRequest,
        mockMethodHandler,
      );

      expect(response).toBeDefined();
      expect(response?.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(mockMethodHandler).not.toHaveBeenCalled();
    });
  });

  describe('processBatchRequest', () => {
    it('should process multiple valid requests', async () => {
      const batchRequest = [
        { jsonrpc: '2.0', method: 'method1', id: '1' },
        { jsonrpc: '2.0', method: 'method2', id: '2' },
      ];

      mockMethodHandler
        .mockResolvedValueOnce({ result: 'result1' })
        .mockResolvedValueOnce({ result: 'result2' });

      const responses = await service.processBatchRequest(
        batchRequest,
        mockMethodHandler,
      );

      expect(responses).toHaveLength(2);
      expect(responses[0]).toEqual({
        jsonrpc: '2.0',
        id: '1',
        result: { result: 'result1' },
      });
      expect(responses[1]).toEqual({
        jsonrpc: '2.0',
        id: '2',
        result: { result: 'result2' },
      });
    });

    it('should handle empty batch request', async () => {
      const responses = await service.processBatchRequest(
        [],
        mockMethodHandler,
      );

      expect(responses).toHaveLength(1);
      expect(responses[0]?.error?.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
    });

    it('should enforce batch size limits', async () => {
      const batchRequest = [
        { jsonrpc: '2.0', method: 'method1', id: '1' },
        { jsonrpc: '2.0', method: 'method2', id: '2' },
      ];

      const options: JsonRpcProcessingOptions = {
        maxBatchSize: 1,
      };

      const responses = await service.processBatchRequest(
        batchRequest,
        mockMethodHandler,
        undefined,
        options,
      );

      expect(responses).toHaveLength(1);
      expect(responses[0]?.error?.message).toContain(
        'Batch size exceeds maximum',
      );
    });

    it('should filter out notification responses', async () => {
      const batchRequest = [
        { jsonrpc: '2.0', method: 'method1', id: '1' },
        { jsonrpc: '2.0', method: 'notification' }, // no id = notification
        { jsonrpc: '2.0', method: 'method2', id: '2' },
      ];

      mockMethodHandler
        .mockResolvedValueOnce({ result: 'result1' })
        .mockResolvedValueOnce({ result: 'result2' });

      const responses = await service.processBatchRequest(
        batchRequest,
        mockMethodHandler,
        mockNotificationHandler,
      );

      expect(responses).toHaveLength(2); // Only non-notification responses
      expect(mockNotificationHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('processRequest', () => {
    it('should route single requests correctly', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        id: '123',
      };

      mockMethodHandler.mockResolvedValue({ success: true });

      const response = await service.processRequest(request, mockMethodHandler);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        result: { success: true },
      });
    });

    it('should route batch requests correctly', async () => {
      const batchRequest = [{ jsonrpc: '2.0', method: 'method1', id: '1' }];

      const options: JsonRpcProcessingOptions = {
        enableBatchProcessing: true,
      };

      mockMethodHandler.mockResolvedValue({ success: true });

      const response = await service.processRequest(
        batchRequest,
        mockMethodHandler,
        undefined,
        options,
      );

      expect(Array.isArray(response)).toBe(true);
    });

    it('should reject batch requests when disabled', async () => {
      const batchRequest = [{ jsonrpc: '2.0', method: 'method1', id: '1' }];

      const response = await service.processRequest(
        batchRequest,
        mockMethodHandler,
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSON_RPC_ERRORS.INVALID_REQUEST,
          message: 'Batch processing not enabled',
        },
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create valid success response', () => {
      const response = service.createSuccessResponse('123', { data: 'test' });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        result: { data: 'test' },
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response without data', () => {
      const response = service.createErrorResponse(
        JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        'Method not found',
        '123',
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        error: {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          message: 'Method not found',
        },
      });
    });

    it('should create error response with data', () => {
      const errorData = { details: 'Additional info' };
      const response = service.createErrorResponse(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Invalid parameters',
        '123',
        errorData,
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: '123',
        error: {
          code: JSON_RPC_ERRORS.INVALID_PARAMS,
          message: 'Invalid parameters',
          data: errorData,
        },
      });
    });
  });

  describe('createErrorResponseFromException', () => {
    it('should map method not found errors', () => {
      const error = new Error('Method not found: test.method');
      const response = service.createErrorResponseFromException(error, '123');

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
      expect(response.error?.message).toBe('Method not found');
    });

    it('should map invalid params errors', () => {
      const error = new Error('Invalid params provided');
      const response = service.createErrorResponseFromException(error, '123');

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(response.error?.message).toBe('Invalid params');
    });

    it('should map parse errors', () => {
      const error = new Error('JSON parse error');
      const response = service.createErrorResponseFromException(error, '123');

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
      expect(response.error?.message).toBe('Parse error');
    });

    it('should default to internal error', () => {
      const error = new Error('Unknown error');
      const response = service.createErrorResponseFromException(error, '123');

      expect(response.error?.code).toBe(JSON_RPC_ERRORS.INTERNAL_ERROR);
      expect(response.error?.message).toBe('Internal error');
    });

    it('should include original error in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const response = service.createErrorResponseFromException(error, '123');

      expect(response.error?.data?.originalError).toBe('Test error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('utility methods', () => {
    it('should identify notifications correctly', () => {
      const notification = { jsonrpc: '2.0', method: 'test' };
      const request = { jsonrpc: '2.0', method: 'test', id: '123' };

      expect(service.isNotification(notification)).toBe(true);
      expect(service.isNotification(request)).toBe(false);
    });

    it('should identify batch requests correctly', () => {
      const batchRequest = [{ jsonrpc: '2.0', method: 'test', id: '1' }];
      const singleRequest = { jsonrpc: '2.0', method: 'test', id: '1' };

      expect(service.isBatchRequest(batchRequest)).toBe(true);
      expect(service.isBatchRequest(singleRequest)).toBe(false);
    });

    it('should extract method name correctly', () => {
      const request = { jsonrpc: '2.0', method: 'test.method', id: '1' };
      const invalidRequest = { jsonrpc: '2.0', id: '1' };

      expect(service.getMethodName(request)).toBe('test.method');
      expect(service.getMethodName(invalidRequest)).toBeNull();
      expect(service.getMethodName(null)).toBeNull();
    });

    it('should extract parameters correctly', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
        params: { test: 'value' },
        id: '1',
      };
      const requestWithoutParams = { jsonrpc: '2.0', method: 'test', id: '1' };

      expect(service.getParameters(request)).toEqual({ test: 'value' });
      expect(service.getParameters(requestWithoutParams)).toBeUndefined();
      expect(service.getParameters(null)).toBeUndefined();
    });

    it('should return error codes', () => {
      const errorCodes = service.getErrorCodes();
      expect(errorCodes).toBe(JSON_RPC_ERRORS);
      expect(errorCodes.METHOD_NOT_FOUND).toBe(-32601);
    });
  });

  describe('notification handling', () => {
    it('should handle notification handler errors gracefully', async () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
      };

      mockNotificationHandler.mockRejectedValue(new Error('Handler error'));

      // Should not throw, just log the error
      const response = await service.processSingleRequest(
        notification,
        mockMethodHandler,
        mockNotificationHandler,
      );

      expect(response).toBeNull();
      expect(mockNotificationHandler).toHaveBeenCalled();
    });

    it('should handle missing notification handler', async () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
      };

      const response = await service.processSingleRequest(
        notification,
        mockMethodHandler,
        // No notification handler provided
      );

      expect(response).toBeNull();
    });
  });
});
