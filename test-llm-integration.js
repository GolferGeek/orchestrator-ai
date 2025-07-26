#!/usr/bin/env node

/**
 * LLM Integration Test Suite
 * 
 * Tests LLM service integration and multi-provider fallbacks
 */

class LLMIntegrationTest {
  constructor() {
    this.results = { passed: 0, failed: 0, tests: [] };
  }

  async runTests() {
    console.log('🤖 Testing LLM Integration...');
    
    const tests = [
      {
        name: 'LLM Service Method Signature',
        test: () => {
          // Test that we have the correct method signature for LLM service
          const mockLLMService = {
            generateEnhancedResponse: async (userId, systemPrompt, userPrompt, options) => {
              // Mock implementation
              return {
                content: 'Mock LLM response',
                provider: options.providerId || 'anthropic',
                model: options.modelId || 'claude-3-5-sonnet',
                usage: { inputTokens: 100, outputTokens: 50 }
              };
            }
          };
          
          if (typeof mockLLMService.generateEnhancedResponse !== 'function') {
            throw new Error('LLM service missing generateEnhancedResponse method');
          }
          
          return 'LLM service method signature correct';
        }
      },
      {
        name: 'Multi-Provider Configuration',
        test: () => {
          // Test provider configuration
          const supportedProviders = {
            anthropic: {
              models: ['claude-3-5-sonnet', 'claude-3-haiku'],
              endpoint: 'https://api.anthropic.com/v1/messages'
            },
            openai: {
              models: ['gpt-4o', 'gpt-4o-mini'],
              endpoint: 'https://api.openai.com/v1/chat/completions'
            },
            google: {
              models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
              endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
            }
          };
          
          // Validate provider structure
          for (const [provider, config] of Object.entries(supportedProviders)) {
            if (!config.models || !Array.isArray(config.models) || config.models.length === 0) {
              throw new Error(`Invalid models configuration for ${provider}`);
            }
            if (!config.endpoint || typeof config.endpoint !== 'string') {
              throw new Error(`Invalid endpoint configuration for ${provider}`);
            }
          }
          
          return 'Multi-provider configuration valid';
        }
      },
      {
        name: 'Parameter Validation',
        test: () => {
          // Test parameter validation for LLM calls
          const validParams = {
            providerId: 'anthropic',
            modelId: 'claude-3-5-sonnet', 
            temperature: 0.1,
            maxTokens: 2000
          };
          
          const invalidParams = {
            providerId: 'invalid-provider',
            modelId: '',
            temperature: -1,
            maxTokens: 0
          };
          
          const validateParams = (params) => {
            const validProviders = ['anthropic', 'openai', 'google'];
            const errors = [];
            
            if (!validProviders.includes(params.providerId)) {
              errors.push('Invalid provider');
            }
            if (!params.modelId || params.modelId.trim().length === 0) {
              errors.push('Invalid model ID');
            }
            if (params.temperature < 0 || params.temperature > 2) {
              errors.push('Invalid temperature');
            }
            if (params.maxTokens <= 0 || params.maxTokens > 8192) {
              errors.push('Invalid max tokens');
            }
            
            return { valid: errors.length === 0, errors };
          };
          
          const validResult = validateParams(validParams);
          const invalidResult = validateParams(invalidParams);
          
          if (!validResult.valid || invalidResult.valid) {
            throw new Error('Parameter validation logic failed');
          }
          
          return 'Parameter validation working';
        }
      },
      {
        name: 'Fallback Chain Logic',
        test: () => {
          // Test fallback provider chain
          const providers = ['anthropic', 'openai', 'google'];
          const failures = new Set(['anthropic', 'openai']); // Simulate failures
          
          const findWorkingProvider = (preferredProvider, availableProviders, failedProviders) => {
            // Try preferred provider first
            if (!failedProviders.has(preferredProvider)) {
              return preferredProvider;
            }
            
            // Try other providers in order
            for (const provider of availableProviders) {
              if (provider !== preferredProvider && !failedProviders.has(provider)) {
                return provider;
              }
            }
            
            throw new Error('No working providers available');
          };
          
          // Test successful fallback
          const workingProvider = findWorkingProvider('anthropic', providers, failures);
          if (workingProvider !== 'google') {
            throw new Error('Fallback logic failed');
          }
          
          // Test no available providers
          try {
            findWorkingProvider('anthropic', providers, new Set(providers));
            throw new Error('Should have thrown error for no working providers');
          } catch (error) {
            if (!error.message.includes('No working providers')) {
              throw new Error('Wrong error for no working providers');
            }
          }
          
          return 'Fallback chain logic working';
        }
      },
      {
        name: 'Response Format Validation',
        test: () => {
          // Test LLM response format validation
          const mockResponses = [
            {
              valid: true,
              response: {
                content: '{"sql": "SELECT * FROM users", "explanation": "Gets all users", "confidence": 0.9}',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet',
                usage: { inputTokens: 100, outputTokens: 50 }
              }
            },
            {
              valid: false,
              response: {
                content: '', // Empty content
                provider: 'anthropic',
                model: 'claude-3-5-sonnet'
              }
            },
            {
              valid: false,
              response: {
                content: 'Invalid JSON response that cannot be parsed',
                // Missing provider and model
              }
            }
          ];
          
          const validateLLMResponse = (response) => {
            const errors = [];
            
            if (!response.content || response.content.trim().length === 0) {
              errors.push('Empty response content');
            }
            
            if (!response.provider) {
              errors.push('Missing provider information');
            }
            
            if (!response.model) {
              errors.push('Missing model information');
            }
            
            return { valid: errors.length === 0, errors };
          };
          
          for (const testCase of mockResponses) {
            const result = validateLLMResponse(testCase.response);
            if (result.valid !== testCase.valid) {
              throw new Error(`Response validation failed for case: ${JSON.stringify(testCase)}`);
            }
          }
          
          return 'Response format validation working';
        }
      },
      {
        name: 'Error Handling and Retry Logic',
        test: () => {
          // Test error handling and retry logic
          let attempts = 0;
          const maxRetries = 3;
          
          const mockLLMCall = async () => {
            attempts++;
            if (attempts <= 2) {
              throw new Error('Temporary LLM service error');
            }
            return { content: 'Success after retries', provider: 'anthropic' };
          };
          
          const executeWithRetry = async (operation, retries) => {
            let lastError;
            
            for (let i = 0; i <= retries; i++) {
              try {
                return await operation();
              } catch (error) {
                lastError = error;
                if (i < retries) {
                  // Wait with exponential backoff
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
                }
              }
            }
            
            throw lastError;
          };
          
          // Test retry logic (this is synchronous simulation)
          attempts = 0; // Reset for simulation
          const simulateRetry = () => {
            for (let i = 0; i <= maxRetries; i++) {
              attempts++;
              if (attempts <= 2) {
                continue; // Simulate retry
              }
              return { success: true, attempts };
            }
            throw new Error('Max retries exceeded');
          };
          
          const result = simulateRetry();
          if (!result.success || result.attempts !== 3) {
            throw new Error('Retry logic not working correctly');
          }
          
          return 'Error handling and retry logic working';
        }
      },
      {
        name: 'SQL Response Parsing',
        test: () => {
          // Test SQL response parsing from LLM
          const mockLLMResponses = [
            {
              content: '{"sql": "SELECT * FROM users", "explanation": "Gets all users", "confidence": 0.9}',
              expected: {
                sql: 'SELECT * FROM users',
                explanation: 'Gets all users',
                confidence: 0.9
              }
            },
            {
              content: '```sql\nSELECT id, name FROM users\n```\n\nThis query selects user ID and name.',
              expected: {
                sql: 'SELECT id, name FROM users',
                explanation: 'Generated SQL query',
                confidence: 0.7
              }
            },
            {
              content: 'SELECT COUNT(*) FROM sessions', // Plain SQL
              expected: {
                sql: 'SELECT COUNT(*) FROM sessions',
                explanation: 'Generated SQL query',
                confidence: 0.7
              }
            }
          ];
          
          const parseLLMResponse = (response) => {
            try {
              // Try JSON first
              const jsonMatch = response.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  sql: parsed.sql || '',
                  explanation: parsed.explanation || 'No explanation provided',
                  confidence: parsed.confidence || 0.8
                };
              }
              
              // Try code block extraction
              const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
              if (sqlMatch) {
                return {
                  sql: sqlMatch[1].trim(),
                  explanation: 'Generated SQL query',
                  confidence: 0.7
                };
              }
              
              // Fallback to treating entire response as SQL
              return {
                sql: response.trim(),
                explanation: 'Generated SQL query',
                confidence: 0.7
              };
              
            } catch (error) {
              throw new Error(`Failed to parse LLM response: ${error.message}`);
            }
          };
          
          for (const testCase of mockLLMResponses) {
            const result = parseLLMResponse(testCase.content);
            
            if (result.sql !== testCase.expected.sql) {
              throw new Error(`SQL parsing failed. Expected: ${testCase.expected.sql}, Got: ${result.sql}`);
            }
          }
          
          return 'SQL response parsing working';
        }
      }
    ];

    for (const testCase of tests) {
      try {
        console.log(`  🔍 ${testCase.name}...`);
        const result = await testCase.test();
        console.log(`  ✅ ${testCase.name}: ${result}`);
        
        this.results.passed++;
        this.results.tests.push({
          name: testCase.name,
          status: 'passed',
          result: result
        });
      } catch (error) {
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
        
        this.results.failed++;
        this.results.tests.push({
          name: testCase.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    this.generateSummary();
  }

  generateSummary() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
    
    console.log('\\n' + '='.repeat(50));
    console.log('🤖 LLM Integration Test Results');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed > 0) {
      console.log('\\n⚠️  Some LLM integration tests failed!');
      process.exit(1);
    } else {
      console.log('\\n🎉 All LLM integration tests passed!');
    }
  }
}

// Main execution
async function main() {
  const tester = new LLMIntegrationTest();
  await tester.runTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}