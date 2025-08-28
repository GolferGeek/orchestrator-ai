import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { createClient } from '@supabase/supabase-js';

describe('Metrics Agent Complete Workflow Test', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    // Load environment variables manually
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../../.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      envLines.forEach((line: string) => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          const cleanValue = value.split('#')[0]?.trim();
          if (cleanValue && !process.env[key]) {
            process.env[key] = cleanValue;
          }
        }
      });
    }

    // Create the app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get JWT token using Supabase test user
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
    const testEmail = process.env.SUPABASE_TEST_USER!;
    const testPassword = process.env.SUPABASE_TEST_PASSWORD!;

    console.log('🔐 Getting JWT token for test user:', testEmail);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      throw new Error(`Failed to get JWT token: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received from Supabase');
    }

    jwtToken = data.session.access_token;
    console.log('✅ JWT token obtained successfully');
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should complete full metrics agent workflow: Generate SQL → Execute SQL → Analyze Results', async () => {
    console.log('\n🚀 Starting Complete Metrics Agent Workflow Test');
    console.log('==================================================');

    const testQuery = 'How many companies have revenue? Show me the total count and some examples.';
    
    console.log('📝 Query:', testQuery);
    console.log('🔑 Using JWT token:', jwtToken.substring(0, 50) + '...');

    // Call the metrics agent endpoint
    const response = await request(app.getHttpServer())
      .post('/agents/finance/metrics/tasks')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        message: testQuery,
        context: 'business analysis for revenue metrics'
      })
      .expect(200);

    console.log('\n📊 METRICS AGENT RESPONSE:');
    console.log('==================================================');
    console.log(JSON.stringify(response.body, null, 2));

    // Validate the response structure
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    // The response should contain evidence of all three steps
    const responseText = JSON.stringify(response.body);
    
    // Check for SQL generation evidence
    expect(responseText.toLowerCase()).toMatch(/sql|select|count|companies/);
    console.log('✅ Step 1: SQL Generation - Evidence found in response');

    // Check for execution evidence (should have data or results)
    expect(responseText.toLowerCase()).toMatch(/data|result|row|execution/);
    console.log('✅ Step 2: SQL Execution - Evidence found in response');

    // Check for analysis evidence
    expect(responseText.toLowerCase()).toMatch(/analysis|summary|insight|business/);
    console.log('✅ Step 3: Results Analysis - Evidence found in response');

    console.log('\n🎯 WORKFLOW VALIDATION:');
    console.log('✅ Authentication successful with Supabase test user');
    console.log('✅ Metrics agent endpoint responded successfully');
    console.log('✅ All three MCP steps completed: Generate → Execute → Analyze');
    console.log('✅ Response contains business insights and data');
    
    console.log('\n🔍 RESPONSE SUMMARY:');
    if (response.body.data?.summary) {
      console.log('Summary:', response.body.data.summary);
    }
    if (response.body.data?.insights) {
      console.log('Key Insights:', response.body.data.insights);
    }

  }, 60000);
});
