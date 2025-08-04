#!/usr/bin/env node

/**
 * Orchestrator LLM Intelligence Test Runner
 * 
 * This script runs the real LLM intelligence tests that validate:
 * - Intent recognition accuracy
 * - Agent selection intelligence  
 * - Planning capabilities
 * - Marketing manager decision-making
 * 
 * These tests use REAL LLM calls - no mocking!
 */

const { execSync } = require('child_process');

console.log('🧠 Running Orchestrator LLM Intelligence Tests\n');
console.log('These tests validate REAL LLM decision-making capabilities...\n');

const testSuites = [
  {
    name: 'Intent Recognition Service',
    file: 'src/agents/base/implementations/base-services/orchestrator/intent-recognition.service.spec.ts',
    description: 'Tests LLM ability to classify user intent (delegate vs converse vs project)'
  },
  {
    name: 'Delegation Service', 
    file: 'src/agents/base/implementations/base-services/orchestrator/delegation.service.spec.ts',
    description: 'Tests LLM agent selection intelligence for marketing specialists'
  },
  {
    name: 'Planning Service',
    file: 'src/agents/base/implementations/base-services/orchestrator/planning.service.spec.ts', 
    description: 'Tests LLM planning capabilities and iterative refinement'
  },
  {
    name: 'Marketing Manager Orchestrator',
    file: 'src/agents/actual/orchestrator/marketing_manager_orchestrator/agent-service.spec.ts',
    description: 'Tests complete Marketing Manager LLM workflow intelligence'
  }
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

for (const suite of testSuites) {
  console.log(`\n📋 Running: ${suite.name}`);
  console.log(`   ${suite.description}`);
  console.log(`   File: ${suite.file}\n`);
  
  try {
    const command = `npx jest "${suite.file}" --verbose --detectOpenHandles --forceExit`;
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse Jest output for test results
    const lines = output.split('\n');
    const testResults = lines.filter(line => 
      line.includes('✓') || line.includes('✗') || line.includes('PASS') || line.includes('FAIL')
    );
    
    console.log('Results:');
    testResults.forEach(line => {
      if (line.includes('✓')) {
        console.log(`   ✅ ${line.trim()}`);
        passedTests++;
      } else if (line.includes('✗')) {
        console.log(`   ❌ ${line.trim()}`);
        failedTests++;
      } else if (line.includes('PASS')) {
        console.log(`   🎉 ${line.trim()}`);
      } else if (line.includes('FAIL')) {
        console.log(`   💥 ${line.trim()}`);
      }
      totalTests++;
    });
    
  } catch (error) {
    console.log(`   ❌ Test suite failed: ${error.message}`);
    failedTests++;
    
    // Show error details
    if (error.stdout) {
      console.log('\nError output:');
      console.log(error.stdout.toString());
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('🧠 Orchestrator LLM Intelligence Test Summary');
console.log('='.repeat(60));
console.log(`Total Test Suites: ${testSuites.length}`);
console.log(`Passed Tests: ${passedTests}`);
console.log(`Failed Tests: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All LLM intelligence tests passed!');
  console.log('The orchestrator system demonstrates strong AI decision-making capabilities.');
} else {
  console.log('\n⚠️  Some LLM intelligence tests failed.');
  console.log('Review the output above to understand LLM decision-making issues.');
}

console.log('\n💡 Note: These tests use REAL LLM calls to validate intelligence.');
console.log('Failures may indicate issues with:');
console.log('- LLM prompt engineering');
console.log('- Response parsing logic');
console.log('- Decision-making algorithms');
console.log('- Agent configuration');

process.exit(failedTests > 0 ? 1 : 0);