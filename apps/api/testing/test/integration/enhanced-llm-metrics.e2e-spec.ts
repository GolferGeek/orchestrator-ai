import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LLMService } from '../../../src/llms/llm.service';
import { RunMetadataService } from '../../../src/llms/run-metadata.service';
import { SupabaseService } from '../../../src/supabase/supabase.service';
import { LLMModule } from '../../../src/llms/llm.module';
import { SupabaseModule } from '../../../src/supabase/supabase.module';
import { getTableName } from '../../../src/supabase/supabase.config';
import { randomUUID } from 'crypto';

describe('Enhanced LLM Metrics E2E', () => {
  let app: INestApplication;
  let llmService: LLMService;
  let runMetadataService: RunMetadataService;
  let supabaseService: SupabaseService;

  // Test data with different levels of sensitive content
  const testCases = [
    {
      name: 'Clean Data (No PII)',
      systemPrompt: 'You are a helpful assistant for general questions.',
      userMessage: 'What is the capital of France? Please provide a brief answer.',
      expectedSanitization: 'none',
      expectedPII: false,
      provider: 'ollama', // Test local provider
      description: 'Local provider with no sensitive data',
    },
    {
      name: 'Personal Information',
      systemPrompt: 'You are a customer service assistant.',
      userMessage: 'My name is John Smith, email john.smith@company.com, phone (555) 123-4567. I need help with my account.',
      expectedSanitization: 'standard',
      expectedPII: true,
      provider: 'openai', // Test external provider
      description: 'External provider with PII - should trigger sanitization',
    },
    {
      name: 'Sensitive Data with Secrets',
      systemPrompt: 'You are a technical support assistant.',
      userMessage: 'I am Sarah Johnson from Acme Corp. My API key is sk-1234567890abcdef and my password is MySecret123. Please help debug the integration.',
      expectedSanitization: 'strict',
      expectedPII: true,
      provider: 'anthropic', // Test different external provider
      description: 'External provider with secrets - should trigger redaction',
    },
    {
      name: 'Mixed Business Data',
      systemPrompt: 'You are a business analyst.',
      userMessage: 'Our company Globodyne Inc located in New York has revenue issues. Contact our CEO Michael Davis at mdavis@globodyne.com for more details.',
      expectedSanitization: 'standard',
      expectedPII: true,
      provider: 'openai',
      description: 'External provider with mixed PII and business data',
    },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [LLMModule, SupabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    llmService = moduleFixture.get<LLMService>(LLMService);
    runMetadataService = moduleFixture.get<RunMetadataService>(RunMetadataService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Comprehensive LLM Metrics Testing', () => {
    const testResults: any[] = [];

    for (const testCase of testCases) {
      it(`should properly track enhanced metrics for: ${testCase.name}`, async () => {
        console.log(`\n🧪 Testing: ${testCase.name}`);
        console.log(`📋 Description: ${testCase.description}`);
        console.log(`🔧 Provider: ${testCase.provider}`);

        let response: any;
        let runId: string | undefined;

        try {
          // Make the LLM call using centralized response (which includes enhanced metrics)
          const _result = await llmService.generateCentralizedResponse(
            testCase.systemPrompt,
            testCase.userMessage,
            {
              provider: testCase.provider,
              temperature: 0.1,
              maxTokens: 100,
              callerType: 'e2e-test',
              callerName: `enhanced-metrics-test-${testCase.name.toLowerCase().replace(/\s+/g, '-')}`,
              conversationId: randomUUID(),
              dataClassification: 'test',
              // Force the specified provider to be used (don't prefer local for external provider tests)
              preferLocal: testCase.provider === 'ollama',
            }
          );

          response = result;
          runId = result.runMetadata.runId;

          console.log(`✅ LLM call completed successfully`);
          console.log(`🆔 Run ID: ${runId}`);
          console.log(`💰 Cost: $${result.runMetadata.cost}`);
          console.log(`⏱️  Duration: ${result.runMetadata.duration}ms`);
          
          // Debug: Log sanitization metrics from the result
          console.log(`\n🔍 DEBUG: Sanitization Metrics from Result:`);
          console.log(`   PII Detected: ${result.runMetadata.enhancedMetrics?.piiDetected ? '✅' : '❌'}`);
          console.log(`   Sanitization Applied: ${result.runMetadata.enhancedMetrics?.dataSanitizationApplied ? '✅' : '❌'}`);
          console.log(`   Sanitization Level: ${result.runMetadata.enhancedMetrics?.sanitizationLevel || 'none'}`);
          console.log(`   PII Types: ${JSON.stringify(result.runMetadata.enhancedMetrics?.piiTypes || [])}`);
          console.log(`   Pseudonyms Used: ${result.runMetadata.enhancedMetrics?.pseudonymsUsed || 0}`);
          console.log(`   Redactions Applied: ${result.runMetadata.enhancedMetrics?.redactionsApplied || 0}`);

          // Verify basic response structure
          expect(response).toBeDefined();
          expect(response.content).toBeDefined();
          expect(response.runMetadata).toBeDefined();
          expect(response.runMetadata.runId).toBeDefined();

          // Wait a bit for async database operations to complete
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Query the database directly to verify enhanced metrics were stored
          const client = supabaseService.getServiceClient();
          const { data: dbRecords, error } = await client
            .from(getTableName('llm_usage'))
            .select('*')
            .eq('run_id', runId)
            .order('created_at', { ascending: false });

          if (error) {
            throw new Error(`Failed to retrieve database record: ${error.message}`);
          }

          if (!dbRecords || dbRecords.length === 0) {
            throw new Error('No database record found');
          }

          // Use the most recent record if multiple exist
          const dbRecord = dbRecords[0];

          console.log(`\n📊 Database Record Retrieved:`);
          console.log(`   🔧 Provider: ${dbRecord.provider_name}`);
          console.log(`   🤖 Model: ${dbRecord.model_name}`);
          console.log(`   📝 Status: ${dbRecord.status}`);

          // Verify enhanced metrics in database
          console.log(`\n🛡️  Data Sanitization Metrics:`);
          console.log(`   🔒 Applied: ${dbRecord.data_sanitization_applied ? '✅' : '❌'}`);
          console.log(`   📈 Level: ${dbRecord.sanitization_level}`);
          console.log(`   👁️  PII Detected: ${dbRecord.pii_detected ? '✅' : '❌'}`);
          
          if (dbRecord.pii_detected) {
            const piiTypes = JSON.parse(dbRecord.pii_types || '[]');
            console.log(`   🏷️  PII Types: ${piiTypes.join(', ')}`);
            console.log(`   🎭 Pseudonyms Used: ${dbRecord.pseudonyms_used}`);
          }

          if (dbRecord.redactions_applied > 0) {
            const redactionTypes = JSON.parse(dbRecord.redaction_types || '[]');
            console.log(`   🔴 Redactions: ${dbRecord.redactions_applied}`);
            console.log(`   🗂️  Redaction Types: ${redactionTypes.join(', ')}`);
          }

          console.log(`\n🕵️  Source Blinding Metrics:`);
          console.log(`   🔒 Applied: ${dbRecord.source_blinding_applied ? '✅' : '❌'}`);
          if (dbRecord.source_blinding_applied) {
            console.log(`   🚫 Headers Stripped: ${dbRecord.headers_stripped}`);
            console.log(`   🤖 Custom User-Agent: ${dbRecord.custom_user_agent_used ? '✅' : '❌'}`);
            console.log(`   🚫 No-Train Header: ${dbRecord.no_train_header_sent ? '✅' : '❌'}`);
          }

          console.log(`\n⚖️  Compliance Metrics:`);
          const complianceFlags = JSON.parse(dbRecord.compliance_flags || '{}');
          console.log(`   🇪🇺 GDPR: ${complianceFlags.gdprCompliant ? '✅' : '❌'}`);
          console.log(`   🏥 HIPAA: ${complianceFlags.hipaaCompliant ? '✅' : '❌'}`);
          console.log(`   💳 PCI: ${complianceFlags.pciCompliant ? '✅' : '❌'}`);

          // Assertions based on provider type
          if (testCase.provider === 'ollama') {
            // Local provider assertions
            expect(dbRecord.data_sanitization_applied).toBe(false);
            expect(dbRecord.sanitization_level).toBe('none');
            expect(dbRecord.source_blinding_applied).toBe(false);
            expect(dbRecord.sovereign_mode).toBe(true);
            console.log(`   ✅ Local provider correctly shows no sanitization/blinding`);
          } else {
            // External provider assertions
            expect(dbRecord.source_blinding_applied).toBe(true);
            expect(dbRecord.headers_stripped).toBeGreaterThan(0);
            expect(dbRecord.custom_user_agent_used).toBe(true);
            expect(dbRecord.no_train_header_sent).toBe(true);
            expect(dbRecord.sovereign_mode).toBe(false);
            console.log(`   ✅ External provider correctly shows source blinding applied`);
          }

          // PII detection assertions
          if (testCase.expectedPII && testCase.provider !== 'ollama') {
            expect(dbRecord.pii_detected).toBe(true);
            expect(dbRecord.data_sanitization_applied).toBe(true);
            expect(dbRecord.sanitization_level).not.toBe('none');
            console.log(`   ✅ PII correctly detected and sanitization applied`);
          }

          // Secrets/redaction assertions - only expect redactions if ENABLE_REDACTION=true
          if (testCase.userMessage.includes('sk-') || testCase.userMessage.includes('password')) {
            if (testCase.provider !== 'ollama') {
              if (process.env.ENABLE_REDACTION === 'true') {
                expect(dbRecord.redactions_applied).toBeGreaterThan(0);
                console.log(`   ✅ Secrets correctly detected and redacted`);
              } else {
                // With ENABLE_REDACTION=false, secrets should NOT be redacted
                expect(dbRecord.redactions_applied).toBe(0);
                console.log(`   ✅ Secrets correctly NOT redacted (ENABLE_REDACTION=false)`);
              }
            }
          }

          // Basic database field assertions
          expect(dbRecord.run_id).toBe(runId);
          expect(dbRecord.status).toBe('completed');
          expect(dbRecord.caller_type).toBe('e2e-test');
          expect(dbRecord.input_tokens).toBeGreaterThan(0);
          expect(dbRecord.output_tokens).toBeGreaterThan(0);
          expect(dbRecord.duration_ms).toBeGreaterThan(0);
          expect(dbRecord.started_at).toBeDefined();
          expect(dbRecord.completed_at).toBeDefined();

          // Store result for summary
          testResults.push({
            testCase: testCase.name,
            provider: testCase.provider,
            runId,
            dbRecord,
            success: true,
          });

          console.log(`\n✅ All assertions passed for ${testCase.name}\n`);

        } catch (_error) {
          console.error(`❌ Test failed for ${testCase.name}:`, _error);
          
          testResults.push({
            testCase: testCase.name,
            provider: testCase.provider,
            runId: runId || 'unknown',
            error: _error instanceof Error ? _error.message : String(_error),
            success: false,
          });

          // Re-throw to fail the test
          throw _error;
        }
      }, 30000); // 30 second timeout per test
    }

    it('should provide comprehensive test summary', async () => {
      console.log(`\n📊 COMPREHENSIVE TEST SUMMARY:`);
      console.log(`==============================`);
      
      const successful = testResults.filter(r => r.success);
      const failed = testResults.filter(r => r.success === false);

      console.log(`✅ Successful Tests: ${successful.length}`);
      console.log(`❌ Failed Tests: ${failed.length}`);
      console.log(`📊 Total Tests: ${testResults.length}`);

      successful.forEach(result => {
        console.log(`\n✅ ${result.testCase} (${result.provider}):`);
        console.log(`   📊 Run ID: ${result.runId}`);
        console.log(`   🛡️  Sanitization Applied: ${result.dbRecord?.data_sanitization_applied ? 'Yes' : 'No'}`);
        console.log(`   📈 Sanitization Level: ${result.dbRecord?.sanitization_level}`);
        console.log(`   🕵️  Source Blinding Applied: ${result.dbRecord?.source_blinding_applied ? 'Yes' : 'No'}`);
        console.log(`   👁️  PII Detected: ${result.dbRecord?.pii_detected ? 'Yes' : 'No'}`);
        console.log(`   🔴 Redactions Applied: ${result.dbRecord?.redactions_applied || 0}`);
      });

      if (failed.length > 0) {
        console.log(`\n❌ FAILED TESTS:`);
        failed.forEach(result => {
          console.log(`   ❌ ${result.testCase} (${result.provider}): ${result.error}`);
        });
      }

      // Summary assertions
      expect(failed.length).toBe(0);
      expect(successful.length).toBe(testCases.length);
      
      console.log(`\n🎉 All enhanced LLM metrics tests completed successfully!`);
    });
  });
});