import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Metrics Agent SQL Generation E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;

  // Expected revenue data for validation
  const expectedRevenueData = [
    { department_name: 'Enterprise Accounts', total_revenue: 154775.0 },
    { department_name: 'Professional Services', total_revenue: 154775.0 },
    { department_name: 'Sales', total_revenue: 187185.0 },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered and auto-registered
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Authenticate as test user
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();
    console.log('✅ Authentication successful');
  }, 60000); // 60 second timeout for module setup

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Generation Tests', () => {
    it('should generate valid SQL for revenue by department query', async () => {
      const _response = await request(app.getHttpServer())
        .post('/agents/finance/metrics/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Give me all of the revenues by department',
          metadata: {
            userId: 'test-user',
            source: 'e2e-test',
          },
        })
        .expect(200);

      // Log the full response for debugging
      console.log('📊 Metrics Agent Response:', JSON.stringify(response.body, null, 2));

      // Extract the task ID and response
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('status');
      
      // If the response is async, wait for completion
      let taskResponse = response.body;
      const taskId = taskResponse.taskId;
      
      // Poll for task completion if needed
      if (taskResponse.status === 'pending' || taskResponse.status === 'processing') {
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          const statusResponse = await request(app.getHttpServer())
            .get(`/tasks/${taskId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
          
          taskResponse = statusResponse.body;
          
          if (taskResponse.status === 'completed' || taskResponse.status === 'failed') {
            break;
          }
          
          attempts++;
        }
      }

      // Validate the response
      expect(taskResponse.status).toBe('completed');
      expect(taskResponse).toHaveProperty('response');
      
      const agentResponse = taskResponse.response;
      console.log('🤖 Agent Response:', agentResponse);

      // Check for SQL in the response
      const sqlPattern = /SELECT[\s\S]*FROM[\s\S]*(?:departments|kpi_data|kpi_metrics)/i;
      const hasSql = sqlPattern.test(agentResponse);
      
      if (!hasSql) {
        console.error('❌ No SQL found in response');
        console.error('Response:', agentResponse);
      }
      
      expect(hasSql).toBe(true);

      // Validate SQL structure
      const sqlLower = agentResponse.toLowerCase();
      
      // Should have key tables
      expect(sqlLower).toContain('departments');
      expect(sqlLower).toContain('kpi_data');
      
      // Should have aggregation
      expect(sqlLower).toMatch(/sum\s*\(/);
      
      // Should have grouping
      expect(sqlLower).toContain('group by');
      
      console.log('✅ SQL Generation validated successfully');
    }, 60000); // 60 second timeout for test

    it('should include SQL even when encountering errors', async () => {
      const _response = await request(app.getHttpServer())
        .post('/agents/finance/metrics/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Show me invalid nonsense query that will fail',
          metadata: {
            userId: 'test-user',
            source: 'e2e-test-error',
          },
        })
        .expect(200);

      // Log the response
      console.log('📊 Error Test Response:', JSON.stringify(response.body, null, 2));

      // Even with errors, we should get a response with attempted SQL or error explanation
      expect(response.body).toHaveProperty('taskId');
      
      // Wait for task completion
      let taskResponse = response.body;
      const taskId = taskResponse.taskId;
      
      if (taskResponse.status === 'pending' || taskResponse.status === 'processing') {
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await request(app.getHttpServer())
            .get(`/tasks/${taskId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
          
          taskResponse = statusResponse.body;
          
          if (taskResponse.status === 'completed' || taskResponse.status === 'failed') {
            break;
          }
          
          attempts++;
        }
      }

      // Should have a response even if it failed
      expect(taskResponse).toHaveProperty('response');
      
      // Should either have SQL or an explanation of why SQL couldn't be generated
      const response_text = taskResponse.response || '';
      const hasSqlOrExplanation = 
        response_text.toLowerCase().includes('select') || 
        response_text.toLowerCase().includes('sql') ||
        response_text.toLowerCase().includes('query') ||
        response_text.toLowerCase().includes('unable');
      
      expect(hasSqlOrExplanation).toBe(true);
      console.log('✅ Error handling validated - response includes SQL context');
    }, 60000);
  });

  describe('SQL Validation Helper Functions', () => {
    it('should validate SQL structure', () => {
      // Test SQL validator function
      const validSQL = `
        SELECT 
          d.name as department_name,
          SUM(kd.value) as total_revenue
        FROM departments d
        JOIN kpi_data kd ON d.id = kd.department_id
        JOIN kpi_metrics km ON kd.metric_id = km.id
        WHERE km.name LIKE '%revenue%'
        GROUP BY d.id, d.name
        ORDER BY d.name;
      `;

      const isValidSQL = validateRevenueSQL(validSQL);
      expect(isValidSQL).toBe(true);
    });

    it('should reject invalid SQL', () => {
      const invalidSQL = 'This is not SQL';
      const isValidSQL = validateRevenueSQL(invalidSQL);
      expect(isValidSQL).toBe(false);
    });
  });
});

// Helper function to validate SQL structure
function validateRevenueSQL(sql: string): boolean {
  const sqlLower = sql.toLowerCase();
  
  // Check for required elements
  const hasSelect = sqlLower.includes('select');
  const hasFrom = sqlLower.includes('from');
  const hasDepartments = sqlLower.includes('departments');
  const hasKpiData = sqlLower.includes('kpi_data');
  const hasAggregation = /sum\s*\(/.test(sqlLower) || /count\s*\(/.test(sqlLower);
  const hasGroupBy = sqlLower.includes('group by');
  
  return hasSelect && hasFrom && hasDepartments && hasKpiData && hasAggregation && hasGroupBy;
}

// Helper function to extract SQL from agent response
function extractSQLFromResponse(response: string): string | null {
  // Try to find SQL in various formats
  const patterns = [
    /```sql\n([\s\S]*?)```/i,
    /```\n(SELECT[\s\S]*?)```/i,
    /(SELECT[\s\S]*?;)/i,
    /(SELECT[\s\S]*?GROUP BY[\s\S]*?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}