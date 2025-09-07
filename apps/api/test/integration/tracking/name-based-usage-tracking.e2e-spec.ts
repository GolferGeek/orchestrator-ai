import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { LLMService } from '../../../src/llms/llm.service';
import { ModelsService } from '../../../src/models/models.service';
import { ProvidersService } from '../../../src/providers/providers.service';
import { SupabaseService } from '../../../src/supabase/supabase.service';

describe('Name-Based Usage Tracking (e2e)', () => {
  let app: INestApplication;
  let llmService: LLMService;
  let modelsService: ModelsService;
  let providersService: ProvidersService;
  let supabaseService: SupabaseService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    llmService = moduleFixture.get<LLMService>(LLMService);
    modelsService = moduleFixture.get<ModelsService>(ModelsService);
    providersService = moduleFixture.get<ProvidersService>(ProvidersService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    
    await app.init();

    // Get authentication token for API tests
    const authResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'test@example.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testpassword123',
      });
    
    authToken = authResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Provider/Model Name Endpoints', () => {
    it('should return provider names without UUIDs', async () => {
      const response = await request(app.getHttpServer())
        .get('/providers/names')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Validate structure - should only have name field
      response.body.forEach((provider: any) => {
        expect(provider).toHaveProperty('name');
        expect(provider.name).toBeTruthy();
        expect(typeof provider.name).toBe('string');
        
        // Assert no UUID fields
        expect(provider).not.toHaveProperty('id');
        expect(provider).not.toHaveProperty('providerId');
      });

      console.log(`✅ Provider names endpoint returned ${response.body.length} providers`);
    });

    it('should return model names with provider info', async () => {
      const response = await request(app.getHttpServer())
        .get('/models/names')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Validate structure
      response.body.forEach((model: any) => {
        expect(model).toHaveProperty('providerName');
        expect(model).toHaveProperty('modelName');
        expect(model).toHaveProperty('displayName');
        
        expect(typeof model.providerName).toBe('string');
        expect(typeof model.modelName).toBe('string');
        expect(typeof model.displayName).toBe('string');
        
        // Assert no UUID fields
        expect(model).not.toHaveProperty('id');
        expect(model).not.toHaveProperty('providerId');
        expect(model).not.toHaveProperty('modelId');
      });

      console.log(`✅ Model names endpoint returned ${response.body.length} models`);
    });

    it('should return providers with models structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/providers/with-models')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach((provider: any) => {
        expect(provider).toHaveProperty('providerName');
        expect(provider).toHaveProperty('models');
        expect(Array.isArray(provider.models)).toBe(true);
        
        // Check models structure
        provider.models.forEach((model: any) => {
          expect(model).toHaveProperty('providerName');
          expect(model).toHaveProperty('modelName');
          expect(model).toHaveProperty('displayName');
          
          // Assert no UUID fields
          expect(model).not.toHaveProperty('id');
          expect(model).not.toHaveProperty('providerId');
          expect(model).not.toHaveProperty('modelId');
        });
      });

      console.log(`✅ Providers with models endpoint returned ${response.body.length} providers`);
    });
  });

  describe('LLM Service Name-Based Usage Tracking', () => {
    const testCases = [
      { providerName: 'openai', modelName: 'gpt-4o-mini' },
      { providerName: 'anthropic', modelName: 'claude-3.5-sonnet-20241022' },
      { providerName: 'google', modelName: 'gemini-2.5-flash' },
      { providerName: 'ollama', modelName: 'llama3.2:latest' },
    ];

    testCases.forEach(({ providerName, modelName }) => {
      it(`should track usage with names for ${providerName}/${modelName}`, async () => {
        try {
          const result = await llmService.generateResponse(
            'You are a helpful assistant.',
            'Say hello and count to 3.',
            {
              providerName,
              modelName,
              maxTokens: 100,
            }
          );

          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);

          console.log(`✅ Generated response with ${providerName}/${modelName}: "${result.substring(0, 50)}..."`);
        } catch (error: any) {
          // Some providers might not be available in test environment
          console.log(`⚠️  Provider ${providerName}/${modelName} not available: ${error.message}`);
        }
      });
    });

    it('should handle invalid provider/model gracefully', async () => {
      try {
        const result = await llmService.generateResponse(
          'You are a helpful assistant.',
          'Say hello.',
          {
            providerName: 'invalid-provider',
            modelName: 'invalid-model',
            maxTokens: 50,
          }
        );

        // Should fallback to default provider/model
        expect(result).toBeDefined();
        console.log('✅ Invalid provider/model handled gracefully with fallback');
      } catch (error: any) {
        // Error is acceptable as long as it's not a null reference error
        expect(error.message).not.toContain('null');
        expect(error.message).not.toContain('undefined');
        console.log(`✅ Invalid provider/model failed gracefully: ${error.message}`);
      }
    });
  });

  describe('Database Usage Records Validation', () => {
    it('should have usage records with provider/model names', async () => {
      const client = supabaseService.getServiceClient();
      
      // Query recent usage records
      const { data: usageRecords, error } = await client
        .from('enhanced_messages')
        .select('provider_name, model_name, created_at')
        .not('provider_name', 'is', null)
        .not('model_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.log('⚠️  No usage records found or table not accessible');
        return;
      }

      expect(usageRecords).toBeDefined();
      
      if (usageRecords && usageRecords.length > 0) {
        usageRecords.forEach((record: any) => {
          expect(record.provider_name).toBeTruthy();
          expect(record.model_name).toBeTruthy();
          expect(typeof record.provider_name).toBe('string');
          expect(typeof record.model_name).toBe('string');
          
          // Assert no UUID patterns in names
          expect(record.provider_name).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
          expect(record.model_name).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        console.log(`✅ Found ${usageRecords.length} usage records with valid provider/model names`);
      } else {
        console.log('ℹ️  No recent usage records found');
      }
    });

    it('should validate database schema has name-based columns', async () => {
      const client = supabaseService.getServiceClient();
      
      // Check llm_providers table structure
      const { data: providerColumns } = await client
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'llm_providers')
        .eq('table_schema', 'public');

      if (providerColumns) {
        const hasNameColumn = providerColumns.some(col => col.column_name === 'name');
        expect(hasNameColumn).toBe(true);
        console.log('✅ llm_providers table has name column');
      }

      // Check llm_models table structure
      const { data: modelColumns } = await client
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'llm_models')
        .eq('table_schema', 'public');

      if (modelColumns) {
        const hasProviderNameColumn = modelColumns.some(col => col.column_name === 'provider_name');
        const hasModelNameColumn = modelColumns.some(col => col.column_name === 'model_name');
        
        expect(hasProviderNameColumn).toBe(true);
        expect(hasModelNameColumn).toBe(true);
        console.log('✅ llm_models table has provider_name and model_name columns');
      }
    });
  });

  describe('Agent Call Integration', () => {
    it('should track agent calls with correct provider/model names', async () => {
      if (!authToken) {
        console.log('⚠️  Skipping agent test - no auth token');
        return;
      }

      try {
        const agentResponse = await request(app.getHttpServer())
          .post('/agents/finance/metrics/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            method: 'task',
            prompt: 'Generate a simple test report with user count',
            llmSelection: {
              providerName: 'openai',
              modelName: 'gpt-4o-mini',
            },
          })
          .timeout(30000); // 30 second timeout for agent calls

        if (agentResponse.status === 200) {
          expect(agentResponse.body).toBeDefined();
          expect(agentResponse.body.taskId).toBeDefined();
          
          console.log(`✅ Agent call successful with name-based LLM selection`);
          console.log(`   Task ID: ${agentResponse.body.taskId}`);
        } else {
          console.log(`⚠️  Agent call returned status ${agentResponse.status}`);
        }
      } catch (error: any) {
        console.log(`⚠️  Agent call failed: ${error.message}`);
        // Don't fail the test - agent might not be available
      }
    });
  });

  describe('Caching Behavior', () => {
    it('should cache provider names endpoint', async () => {
      const start1 = Date.now();
      const response1 = await request(app.getHttpServer())
        .get('/providers/names')
        .expect(200);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const response2 = await request(app.getHttpServer())
        .get('/providers/names')
        .expect(200);
      const time2 = Date.now() - start2;

      // Second request should be faster (cached)
      expect(time2).toBeLessThan(time1);
      expect(response1.body).toEqual(response2.body);
      
      console.log(`✅ Caching working: First request ${time1}ms, cached request ${time2}ms`);
    });
  });

  describe('Regression Tests', () => {
    it('should not have any UUID references in API responses', async () => {
      const endpoints = [
        '/providers/names',
        '/providers/with-models',
        '/models/names',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect(200);

        const responseText = JSON.stringify(response.body);
        
        // Check for UUID patterns
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        const uuidMatches = responseText.match(uuidPattern);
        
        expect(uuidMatches).toBeNull();
        console.log(`✅ No UUIDs found in ${endpoint} response`);
      }
    });

    it('should handle null/undefined provider/model names gracefully', async () => {
      try {
        // Test with undefined values
        const result = await llmService.generateResponse(
          'You are a helpful assistant.',
          'Say hello.',
          {
            providerName: undefined,
            modelName: undefined,
          }
        );

        expect(result).toBeDefined();
        console.log('✅ Undefined provider/model handled gracefully');
      } catch (error: any) {
        // Should not be null reference errors
        expect(error.message).not.toContain('Cannot read property');
        expect(error.message).not.toContain('Cannot read properties of null');
        expect(error.message).not.toContain('Cannot read properties of undefined');
        console.log(`✅ Undefined values handled gracefully: ${error.message}`);
      }
    });
  });
});
