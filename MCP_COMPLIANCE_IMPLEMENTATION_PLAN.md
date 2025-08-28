# MCP Protocol Compliance Implementation Plan

## 📋 **Executive Summary**

Transform current MCP implementation into fully compliant MCP 2025-03-26 specification using single-app architecture, fix all non-conformance issues, and ensure seamless metrics agent integration.

---

## 🎯 **Phase 1: Architecture Simplification (2-3 hours)**

### **1.1 Single MCP Application Structure**

**Replace:** Over-engineered gateway pattern  
**With:** Direct service routing within single NestJS application

```typescript
apps/api/mcp/
├── mcp.controller.ts           # Single JSON-RPC 2.0 endpoint
├── mcp.service.ts             # Main orchestration service
├── services/
│   ├── supabase-mcp.service.ts    # Database operations
│   ├── slack-mcp.service.ts       # Team communication
│   ├── notion-mcp.service.ts      # Knowledge management
│   └── base-mcp.service.ts        # Shared MCP logic
├── interfaces/
│   ├── mcp-protocol.interface.ts  # MCP 2025-03-26 types
│   └── tool-definitions.interface.ts
└── mcp.module.ts              # Single module export
```

### **1.2 Port Configuration**
- **Single Port:** `9050` (from environment variable)
- **Single Endpoint:** `http://localhost:9050/mcp`
- **Remove:** All separate port configurations (9051-9054)

### **1.3 Service Consolidation**
```typescript
@Injectable()
export class MCPService {
  private readonly services = new Map([
    ['supabase', this.supabaseService],
    ['slack', this.slackService], 
    ['notion', this.notionService]
  ]);

  async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    const [namespace, toolName] = this.parseToolName(request.name);
    const service = this.services.get(namespace);
    
    if (!service) {
      throw new MCPError(-32601, `Unknown namespace: ${namespace}`);
    }
    
    return service.callTool({...request, name: toolName});
  }
}
```

---

## 🔧 **Phase 2: MCP 2025-03-26 Protocol Compliance (3-4 hours)**

### **2.1 JSON-RPC 2.0 Transport Layer** ⚡ **HIGH PRIORITY**

**Current Issue:** Using REST endpoints  
**Required Fix:** Full JSON-RPC 2.0 wrapper

```typescript
@Controller('mcp')
export class MCPController {
  @Post()
  async handleJsonRpc(@Body() request: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
    try {
      const result = await this.routeMethod(request.method, request.params);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0', 
        id: request.id,
        error: this.mapToMCPError(error)
      };
    }
  }

  private async routeMethod(method: string, params: any) {
    switch (method) {
      case 'initialize': return this.mcpService.initialize(params);
      case 'tools/list': return this.mcpService.listTools(params);
      case 'tools/call': return this.mcpService.callTool(params);
      case 'ping': return this.mcpService.ping(params);
      default: throw new MCPError(-32601, `Method not found: ${method}`);
    }
  }
}
```

### **2.2 Standard MCP Methods** ⚡ **HIGH PRIORITY**

**Required Methods:**
```typescript
interface IMCPService {
  // Core MCP methods
  initialize(params: MCPInitializeParams): Promise<MCPServerInfo>;
  listTools(params?: MCPListToolsParams): Promise<MCPToolDefinition[]>; 
  callTool(params: MCPToolRequest): Promise<MCPToolResponse>;
  
  // Health check extension
  ping(params?: any): Promise<{ status: 'ok', timestamp: string }>;
}
```

### **2.3 Standard Error Codes** ⚡ **HIGH PRIORITY**

```typescript
enum MCPErrorCode {
  PARSE_ERROR = -32700,      // Invalid JSON
  INVALID_REQUEST = -32600,   // Invalid request object
  METHOD_NOT_FOUND = -32601,  // Method doesn't exist
  INVALID_PARAMS = -32602,    // Invalid method parameters
  INTERNAL_ERROR = -32603,    // Internal JSON-RPC error
  SERVER_ERROR = -32000,      // Server error (custom range -32000 to -32099)
}

class MCPError extends Error {
  constructor(
    public code: MCPErrorCode,
    message: string,
    public data?: any
  ) {
    super(message);
  }
}
```

### **2.4 Content Format Standardization**

**Ensure all responses use MCP content format:**
```typescript
interface MCPToolResponse {
  content: MCPContent[];
  isError?: boolean;
  _meta?: {
    provider?: string;
    model?: string;  
    usage?: TokenUsage;
  };
}

interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;      // base64 for images
  resource?: string;  // URI for resources
  mimeType?: string;
}
```

---

## 🛠️ **Phase 3: Fix Non-Conformance Issues (2-3 hours)**

### **3.1 Tool Definition Standardization**

**Current Issue:** Inconsistent tool schemas  
**Fix:** Standardize all tool definitions

```typescript
interface MCPToolDefinition {
  name: string;           // Without namespace prefix
  description: string;    // Clear, actionable description
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

// Example standardized tools
const SUPABASE_TOOLS: MCPToolDefinition[] = [
  {
    name: 'generate-sql',
    description: 'Generate SQL query from natural language description',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        tables: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Optional table names to focus on'
        },
        max_rows: { type: 'number', default: 100, minimum: 1, maximum: 10000 }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
];
```

### **3.2 Capability Reporting**

```typescript
async initialize(): Promise<MCPServerInfo> {
  return {
    name: 'Orchestrator MCP Server',
    version: '1.0.0',
    description: 'Multi-domain MCP server for database, productivity, and communication tools',
    capabilities: {
      tools: true,          // ✅ Tool execution
      resources: false,     // 🚫 Not implemented yet  
      prompts: false,       // 🚫 Not implemented yet
      logging: true         // ✅ Request logging
    },
    metadata: {
      protocol_version: '2025-03-26',
      transport: 'http+json-rpc',
      namespaces: ['supabase', 'slack', 'notion'],
      total_tools: 15
    }
  };
}
```

### **3.3 Input Validation & Sanitization**

```typescript
@Injectable()
export class MCPValidationService {
  validateToolRequest(request: MCPToolRequest, definition: MCPToolDefinition): void {
    const { error } = this.validateAgainstSchema(request.arguments, definition.inputSchema);
    if (error) {
      throw new MCPError(-32602, `Invalid parameters: ${error.message}`, {
        tool: request.name,
        validation_errors: error.details
      });
    }
  }

  sanitizeSQL(sql: string): string {
    // Remove dangerous SQL patterns
    const dangerous = ['DROP ', 'DELETE ', 'UPDATE ', 'INSERT ', 'CREATE ', 'ALTER '];
    const upperSQL = sql.toUpperCase();
    
    for (const pattern of dangerous) {
      if (upperSQL.includes(pattern)) {
        throw new MCPError(-32000, 'Dangerous SQL operation not allowed', {
          detected_pattern: pattern.trim(),
          sql_preview: sql.substring(0, 100)
        });
      }
    }
    
    return sql.endsWith(';') ? sql.slice(0, -1) : sql; // Remove trailing semicolon
  }
}
```

---

## 🔄 **Phase 4: MCP Client Compatibility (1 hour)**

### **4.1 Update MCP Client Method Names** ⚡ **HIGH PRIORITY**

**Current Issue:** Client uses non-standard method names  
**Required Fix:** Update to MCP 2025-03-26 standard methods

```typescript
// In mcp-client.service.ts - UPDATE THESE LINES:

// Line 39: Change method name
async getServerInfo(): Promise<MCPServerInfo> {
  const response = await this.sendRequest('initialize', {}); // Was: 'get_server_info'
  return response.result;
}

// Line 47: Change method name  
async listTools(): Promise<MCPToolDefinition[]> {
  const response = await this.sendRequest('tools/list', {}); // Was: 'list_tools'
  return response.result.tools || response.result || [];
}

// Line 55: Change method name
async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
  const response = await this.sendRequest('tools/call', { // Was: 'call_tool'
    name: request.name,
    arguments: request.arguments || {},
    context: request.context || {},
  });
  // ... rest unchanged
}
```

### **4.2 Update Client Factory for Single Endpoint**

**Current Issue:** Hardcoded old gateway URLs  
**Required Fix:** Use single MCP endpoint

```typescript
// In mcp-client.service.ts - UPDATE STATIC METHODS:

static createSupabaseClient(): MCPClientService {
  const config: MCPClientConfig = {
    serverUrl: `http://localhost:${process.env.MCP_GATEWAY_PORT || '9050'}/mcp`, // Updated URL
    timeout: 30000,
    retries: 3,
    headers: {
      'User-Agent': 'Orchestrator-AI-MCP-Client/1.0',
    },
  };
  return new MCPClientService(config);
}

// Remove createExternalClient since we now have single endpoint
static createUniversalClient(): MCPClientService {
  const config: MCPClientConfig = {
    serverUrl: `http://localhost:${process.env.MCP_GATEWAY_PORT || '9050'}/mcp`,
    timeout: 30000,
    retries: 3,
    headers: {
      'User-Agent': 'Orchestrator-AI-MCP-Client/1.0',
    },
  };
  return new MCPClientService(config);
}
```

### **4.3 Add New MCP Methods Support**

```typescript
// Add ping method support
async ping(): Promise<{status: string, timestamp: string}> {
  const response = await this.sendRequest('ping', {});
  return response.result;
}

// Add capability querying
async getCapabilities(): Promise<MCPCapabilities> {
  const serverInfo = await this.getServerInfo();
  return serverInfo.capabilities;
}
```

---

## 🔄 **Phase 5: Metrics Agent Integration (1-2 hours)**

### **5.1 Update Function Agent Base Service**

**Replace:** Gateway HTTP calls  
**With:** Direct MCP JSON-RPC calls

```typescript
// In function-agent-base.service.ts
const mcpService = {
  isAvailable: () => true,
  
  generateSQL: async (params: {
    natural_language_query: string;
    max_rows?: number;
    schema_tables?: string[];
  }) => {
    const mcpRequest: MCPJsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'supabase/generate-sql',
        arguments: {
          query: params.natural_language_query,
          tables: params.schema_tables || [],
          max_rows: params.max_rows || 100
        }
      }
    };

    const response = await this.services.httpService.axiosRef.post(
      `http://localhost:${process.env.MCP_GATEWAY_PORT || '9050'}/mcp`,
      mcpRequest
    );

    if (response.data.error) {
      throw new Error(`MCP Error: ${response.data.error.message}`);
    }

    return response.data.result;
  }
};
```

### **4.2 End-to-End Testing**

```typescript
// Test metrics agent workflow
describe('Metrics Agent MCP Integration', () => {
  it('should generate and execute SQL for revenue metrics', async () => {
    const result = await metricsAgent.executeTask('executeTask', {
      prompt: 'What is the average monthly revenue across all companies?',
      userId: 'test-user',
      conversationId: 'test-conv'
    });

    expect(result.success).toBe(true);
    expect(result.response).toContain('revenue');
    expect(result.metadata.tools_used).toContain('supabase/generate-sql');
  });
});
```

---

## 📊 **Phase 5: Quality Assurance & Validation (2-3 hours)**

### **5.1 MCP Protocol Compliance Testing**

```typescript
describe('MCP Protocol Compliance', () => {
  describe('JSON-RPC 2.0 Transport', () => {
    it('should handle valid JSON-RPC requests', async () => {
      const request = {
        jsonrpc: '2.0',
        id: '123',
        method: 'tools/list',
        params: {}
      };
      
      const response = await mcpController.handleJsonRpc(request);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('123');
      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it('should return proper error for invalid method', async () => {
      const request = {
        jsonrpc: '2.0', 
        id: '456',
        method: 'invalid/method',
        params: {}
      };
      
      const response = await mcpController.handleJsonRpc(request);
      
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Method not found');
    });
  });

  describe('Tool Discovery & Execution', () => {
    it('should list all namespaced tools', async () => {
      const tools = await mcpService.listTools();
      
      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'supabase/generate-sql',
          description: expect.stringContaining('Generate SQL')
        })
      );
    });
  });
});
```

### **5.2 Performance Testing**

```typescript
describe('MCP Performance', () => {
  it('should handle tool calls under 2 seconds', async () => {
    const start = Date.now();
    
    await mcpService.callTool({
      name: 'supabase/generate-sql',
      arguments: { query: 'SELECT COUNT(*) FROM companies' }
    });
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  it('should handle concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() => 
      mcpService.callTool({
        name: 'supabase/generate-sql', 
        arguments: { query: 'SELECT 1' }
      })
    );
    
    const results = await Promise.all(requests);
    expect(results).toHaveLength(10);
    results.forEach(result => expect(result.isError).toBeFalsy());
  });
});
```

---

## 🚀 **Phase 6: Deployment & Monitoring (1 hour)**

### **6.1 Environment Configuration**

```bash
# .env.production
MCP_GATEWAY_PORT=9050
MCP_LOG_LEVEL=info
MCP_REQUEST_TIMEOUT=30000
MCP_MAX_CONCURRENT_REQUESTS=50
MCP_ENABLE_METRICS=true
```

### **6.2 Health Monitoring**

```typescript
@Injectable()
export class MCPMonitoringService {
  private metrics = {
    requests_total: 0,
    requests_success: 0,
    requests_error: 0,
    avg_response_time: 0,
    active_connections: 0
  };

  @Cron('*/30 * * * * *') // Every 30 seconds
  logMetrics() {
    this.logger.log(`MCP Metrics: ${JSON.stringify(this.metrics)}`);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    metrics: typeof this.metrics;
  }> {
    const serviceHealth = {
      supabase: await this.testSupabaseConnection(),
      slack: await this.testSlackConnection(),
      notion: await this.testNotionConnection()
    };

    const overallHealthy = Object.values(serviceHealth).every(Boolean);

    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      services: serviceHealth,
      metrics: this.metrics
    };
  }
}
```

---

## 📋 **Implementation Checklist**

### **Phase 1: Architecture (✅ Ready to implement)**
- [ ] Create single MCP module structure
- [ ] Consolidate service classes
- [ ] Remove gateway HTTP routing
- [ ] Update environment variables

### **Phase 2: Protocol Compliance (✅ Ready to implement)**
- [ ] Implement JSON-RPC 2.0 controller
- [ ] Add standard MCP methods
- [ ] Implement proper error codes
- [ ] Standardize content format

### **Phase 3: Fix Non-conformance (✅ Ready to implement)**
- [ ] Standardize tool definitions
- [ ] Add capability reporting
- [ ] Implement input validation
- [ ] Add SQL sanitization

### **Phase 4: Metrics Integration (✅ Ready to implement)**
- [ ] Update function agent service
- [ ] Test end-to-end workflow
- [ ] Validate JSON-RPC calls

### **Phase 5: Quality Assurance (✅ Ready to implement)**
- [ ] Create compliance test suite
- [ ] Add performance tests
- [ ] Test error scenarios
- [ ] Load testing

### **Phase 6: Deployment (✅ Ready to implement)**
- [ ] Configure production environment
- [ ] Add health monitoring
- [ ] Set up request metrics
- [ ] Deploy and validate

---

## ❓ **What I Need Defined (If Anything):**

1. **Security Requirements:** Do we need authentication/authorization for MCP calls?
2. **Performance SLAs:** Target response times? Throughput requirements?
3. **Error Recovery:** How should we handle Supabase downtime? Retry strategies?
4. **Logging Level:** What level of MCP request/response logging is needed?
5. **Backward Compatibility:** Do we need to maintain current REST endpoints during transition?

**Everything else looks complete and ready to implement!** 

This plan provides full MCP 2025-03-26 compliance, simplified single-app architecture, fixes all non-conformance issues, and ensures seamless metrics agent integration.

**Estimated Total Time: 8-12 hours**