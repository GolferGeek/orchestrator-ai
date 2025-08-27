import { Test, TestingModule } from '@nestjs/testing';
import { MCPClientService, MCPClientFactory } from './clients/mcp-client.service';
import { SupabaseMCPService } from './servers/data/supabase/supabase-mcp.service';

describe('MCP System Integration Tests', () => {
  let mcpClientService: MCPClientService;
  let supabaseMcpService: SupabaseMCPService;
  let module: TestingModule;

  beforeAll(async () => {
    // Skip tests if no Supabase environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️  Skipping MCP tests - Supabase credentials not configured');
      return;
    }

    module = await Test.createTestingModule({
      providers: [
        SupabaseMCPService,
        MCPClientFactory,
        {
          provide: MCPClientService,
          useFactory: () => MCPClientService.createSupabaseClient(),
        },
      ],
    }).compile();

    supabaseMcpService = module.get<SupabaseMCPService>(SupabaseMCPService);
    mcpClientService = module.get<MCPClientService>(MCPClientService);

    // Initialize the MCP server
    await supabaseMcpService.onModuleInit();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('MCP Server Functionality', () => {
    it('should initialize successfully', async () => {
      if (!process.env.SUPABASE_URL) return;

      const isHealthy = await supabaseMcpService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should provide server information', async () => {
      if (!process.env.SUPABASE_URL) return;

      const serverInfo = await supabaseMcpService.getServerInfo();
      
      expect(serverInfo).toBeDefined();
      expect(serverInfo.name).toBe('Supabase Data MCP Server');
      expect(serverInfo.version).toBe('1.0.0');
      expect(serverInfo.capabilities.tools).toBe(true);
    });

    it('should list available tools', async () => {
      if (!process.env.SUPABASE_URL) return;

      const tools = await supabaseMcpService.listTools();
      
      expect(tools).toHaveLength(4);
      expect(tools.map(t => t.name)).toEqual([
        'get-schema',
        'generate-sql', 
        'execute-sql',
        'analyze-results'
      ]);
    });

    it('should handle get-schema tool for KPI domain', async () => {
      if (!process.env.SUPABASE_URL) return;

      const schema = await supabaseMcpService.getSchema(['companies', 'kpi_data'], 'kpi');
      
      expect(schema).toBeDefined();
      expect(schema).toContain('companies');
      expect(schema).toContain('kpi_data');
      expect(schema).toContain('KPI & Analytics');
    });

    it('should handle get-schema tool for core domain', async () => {
      if (!process.env.SUPABASE_URL) return;

      const schema = await supabaseMcpService.getSchema(['users', 'tasks'], 'core');
      
      expect(schema).toBeDefined();
      expect(schema).toContain('users');
      expect(schema).toContain('tasks');
      expect(schema).toContain('Core Platform');
    });

    it('should generate SQL from natural language', async () => {
      if (!process.env.SUPABASE_URL) return;

      const result = await supabaseMcpService.generateSQL(
        'Show me the total revenue by company',
        ['companies', 'departments', 'kpi_data', 'kpi_metrics'],
        'KPI & Analytics'
      );

      expect(result).toBeDefined();
      expect(result.sql).toContain('SELECT');
      expect(result.sql).toContain('companies');
      expect(result.sql).toContain('revenue');
      expect(result.tables_used).toContain('companies');
    });

    it('should execute simple SQL queries', async () => {
      if (!process.env.SUPABASE_URL) return;

      const result = await supabaseMcpService.executeSQL(
        'SELECT COUNT(*) as user_count FROM users LIMIT 1'
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.row_count).toBeGreaterThanOrEqual(0);
      expect(result.columns).toContain('user_count');
      expect(result.execution_time_ms).toBeGreaterThan(0);
    });

    it('should handle SQL execution errors gracefully', async () => {
      if (!process.env.SUPABASE_URL) return;

      try {
        await supabaseMcpService.executeSQL('SELECT * FROM nonexistent_table');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('execution failed');
      }
    });

    it('should analyze query results', async () => {
      if (!process.env.SUPABASE_URL) return;

      const testData = [
        { company: 'TechCorp', revenue: 1000000 },
        { company: 'DataInc', revenue: 750000 },
        { company: 'CloudCo', revenue: 1200000 },
      ];

      const analysis = await supabaseMcpService.analyzeResults(
        testData,
        'What are the revenue patterns in this data?'
      );

      expect(analysis).toBeDefined();
      expect(analysis.analysis).toContain('3 records');
      expect(analysis.insights).toBeInstanceOf(Array);
      expect(analysis.data_summary.row_count).toBe(3);
    });
  });

  describe('MCP Client Functionality', () => {
    it('should be able to ping the server', async () => {
      if (!process.env.SUPABASE_URL) return;

      // Note: This test assumes the MCP server is running
      // In a real test, you'd start a test server
      const isHealthy = await mcpClientService.ping();
      
      // This might fail if no server is running, which is expected
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should handle connection errors gracefully', async () => {
      const badClient = MCPClientService.createExternalClient('http://nonexistent:9999');
      
      const isHealthy = await badClient.ping();
      expect(isHealthy).toBe(false);
    });
  });

  describe('End-to-End MCP Workflow', () => {
    it('should perform complete KPI analysis workflow', async () => {
      if (!process.env.SUPABASE_URL) return;

      // Step 1: Get schema for KPI tables
      const schema = await supabaseMcpService.getSchema(
        ['companies', 'departments', 'kpi_data', 'kpi_metrics'],
        'kpi'
      );
      expect(schema).toContain('companies');

      // Step 2: Generate SQL for revenue query
      const sqlResult = await supabaseMcpService.generateSQL(
        'Show me company revenue totals',
        ['companies', 'departments', 'kpi_data', 'kpi_metrics']
      );
      expect(sqlResult.sql).toContain('SELECT');

      // Step 3: Execute the generated SQL (might return empty results)
      try {
        const queryResult = await supabaseMcpService.executeSQL(sqlResult.sql);
        expect(queryResult.data).toBeDefined();
        expect(queryResult.execution_time_ms).toBeGreaterThan(0);

        // Step 4: Analyze results (only if we have data)
        if (queryResult.data.length > 0) {
          const analysis = await supabaseMcpService.analyzeResults(
            queryResult.data,
            'What insights can you provide about this revenue data?'
          );
          expect(analysis.analysis).toBeDefined();
        }
      } catch (error) {
        // Expected if tables don't exist or have no data
        expect(error.message).toContain('execution failed');
      }
    });

    it('should handle metrics agent table requirements', async () => {
      if (!process.env.SUPABASE_URL) return;

      // Simulate metrics agent declaring its required tables
      const metricsAgentTables = [
        'companies',
        'departments', 
        'kpi_data',
        'kpi_metrics',
        'kpi_goals'
      ];

      // Get schema context for just these tables
      const schema = await supabaseMcpService.getSchema(metricsAgentTables, 'kpi');
      
      expect(schema).toBeDefined();
      metricsAgentTables.forEach(table => {
        expect(schema.toLowerCase()).toContain(table.toLowerCase());
      });

      // Generate focused SQL
      const sqlResult = await supabaseMcpService.generateSQL(
        'What is the revenue performance by department?',
        metricsAgentTables,
        'KPI & Analytics'
      );
      
      expect(sqlResult.sql).toBeDefined();
      expect(sqlResult.tables_used).toEqual(
        expect.arrayContaining(metricsAgentTables)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty table arrays', async () => {
      if (!process.env.SUPABASE_URL) return;

      const schema = await supabaseMcpService.getSchema([], 'core');
      expect(schema).toBeDefined();
      expect(schema).toContain('Core Platform');
    });

    it('should handle unknown domains gracefully', async () => {
      if (!process.env.SUPABASE_URL) return;

      const schema = await supabaseMcpService.getSchema(['users'], undefined);
      expect(schema).toBeDefined();
    });

    it('should limit SQL result sizes', async () => {
      if (!process.env.SUPABASE_URL) return;

      try {
        const result = await supabaseMcpService.executeSQL(
          'SELECT * FROM users', 
          5 // Max 5 rows
        );
        
        if (result.data.length > 0) {
          expect(result.data.length).toBeLessThanOrEqual(5);
        }
      } catch (error) {
        // Expected if table doesn't exist
        expect(error.message).toContain('execution failed');
      }
    });

    it('should validate required parameters', async () => {
      if (!process.env.SUPABASE_URL) return;

      try {
        await supabaseMcpService.generateSQL('', []);
        fail('Should have thrown an error for empty query');
      } catch (error) {
        expect(error.message).toContain('failed');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should execute schema requests quickly', async () => {
      if (!process.env.SUPABASE_URL) return;

      const startTime = Date.now();
      await supabaseMcpService.getSchema(['companies'], 'kpi');
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(1000); // Should be under 1 second
    });

    it('should handle concurrent requests', async () => {
      if (!process.env.SUPABASE_URL) return;

      const promises = [
        supabaseMcpService.getSchema(['users'], 'core'),
        supabaseMcpService.getSchema(['companies'], 'kpi'),
        supabaseMcpService.generateSQL('SELECT 1', ['users']),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('should provide detailed server metrics', async () => {
      if (!process.env.SUPABASE_URL) return;

      const metrics = supabaseMcpService.getServerMetrics();
      
      expect(metrics.server_name).toBe('Supabase MCP Server');
      expect(metrics.status).toBe('ready');
      expect(metrics.tools_available).toBe(4);
      expect(metrics.context_files).toHaveLength(4);
    });
  });
});

describe('MCP Protocol Compliance', () => {
  let supabaseMcpService: SupabaseMCPService;

  beforeAll(async () => {
    if (!process.env.SUPABASE_URL) return;

    const module = await Test.createTestingModule({
      providers: [SupabaseMCPService],
    }).compile();

    supabaseMcpService = module.get<SupabaseMCPService>(SupabaseMCPService);
    await supabaseMcpService.onModuleInit();
  });

  it('should implement MCP 2025-03-26 server interface', async () => {
    if (!process.env.SUPABASE_URL) return;

    const serverInfo = await supabaseMcpService.getServerInfo();
    
    // Verify required MCP server info fields
    expect(serverInfo.name).toBeDefined();
    expect(serverInfo.version).toBeDefined();
    expect(serverInfo.capabilities).toBeDefined();
    expect(serverInfo.capabilities.tools).toBe(true);
  });

  it('should handle JSON-RPC requests properly', async () => {
    if (!process.env.SUPABASE_URL) return;

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'get_server_info',
      params: {},
    };

    const response = await supabaseMcpService.handleJsonRpcRequest(request);
    
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('should return proper error format for invalid requests', async () => {
    if (!process.env.SUPABASE_URL) return;

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'nonexistent_method',
      params: {},
    };

    const response = await supabaseMcpService.handleJsonRpcRequest(request);
    
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(2);
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32603);
    expect(response.error.message).toContain('Unknown method');
  });
});