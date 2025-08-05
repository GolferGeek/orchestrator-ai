/**
 * Test Intent Classification Architectural Changes
 * 
 * This test verifies that CREATE_PROJECT has been properly removed from the 
 * intent classification system and that DELEGATE is now the primary path.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Intent Classification Architectural Changes...\n');

// Read the intent recognition service file
const intentServicePath = path.join(__dirname, 'src/agents/base/implementations/base-services/orchestrator/intent-recognition.service.ts');
const intentServiceContent = fs.readFileSync(intentServicePath, 'utf8');

// Test 1: Verify CREATE_PROJECT is removed from prompt
console.log('Test 1: Verify CREATE_PROJECT removed from classification prompt');
const hasCreateProjectInPrompt = intentServiceContent.includes('CREATE_PROJECT - EXTREMELY RARE') || 
                                  intentServiceContent.includes('CREATE_PROJECT - ONLY for explicit multi-step');
if (hasCreateProjectInPrompt) {
  console.log('❌ FAILED: CREATE_PROJECT still found in classification prompt');
} else {
  console.log('✅ PASSED: CREATE_PROJECT removed from classification prompt');
}

// Test 2: Verify DELEGATE is emphasized as primary path
console.log('\nTest 2: Verify DELEGATE is emphasized as primary path');
const hasDelegatePrimary = intentServiceContent.includes('95% of requests should be classified as DELEGATE') ||
                          intentServiceContent.includes('DELEGATE - DEFAULT choice for ALL task requests');
if (hasDelegatePrimary) {
  console.log('✅ PASSED: DELEGATE properly emphasized as primary path');
} else {
  console.log('❌ FAILED: DELEGATE not properly emphasized');
}

// Test 3: Verify valid actions list excludes CREATE_PROJECT
console.log('\nTest 3: Verify CREATE_PROJECT removed from valid actions');
const validActionsMatch = intentServiceContent.match(/const validActions = \[([\s\S]*?)\];/);
if (validActionsMatch) {
  const validActionsContent = validActionsMatch[1];
  const hasCreateProject = validActionsContent.includes("'CREATE_PROJECT'");
  if (hasCreateProject) {
    console.log('❌ FAILED: CREATE_PROJECT still in valid actions list');
  } else {
    console.log('✅ PASSED: CREATE_PROJECT removed from valid actions list');
  }
} else {
  console.log('❌ FAILED: Could not find valid actions list');
}

// Test 4: Verify facade service has explicit_create_project method
console.log('\nTest 4: Verify facade service updated for explicit project creation');
const facadeServicePath = path.join(__dirname, 'src/agents/base/implementations/base-services/orchestrator/orchestrator-facade.service.ts');
const facadeServiceContent = fs.readFileSync(facadeServicePath, 'utf8');

const hasExplicitCreateProject = facadeServiceContent.includes("'explicit_create_project'");
const hasOldCreateProject = facadeServiceContent.includes("case 'create_project':");
if (hasExplicitCreateProject && !hasOldCreateProject) {
  console.log('✅ PASSED: Facade service updated with explicit_create_project only');
} else if (hasOldCreateProject) {
  console.log('❌ FAILED: Old create_project still found in facade service');
} else {
  console.log('❌ FAILED: explicit_create_project not found in facade service');
}

// Test 5: Verify types updated
console.log('\nTest 5: Verify TypeScript types updated');
const typesPath = path.join(__dirname, 'src/orchestration/orchestration.types.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

const hasExplicitInTypes = typesContent.includes("'explicit_create_project'");
const methodsMatch = typesContent.match(/export type OrchestratorA2AMethod =([\s\S]*?);/);
if (methodsMatch) {
  const methodsContent = methodsMatch[1];
  const hasOldCreateInTypes = methodsContent.includes("'create_project'") && !methodsContent.includes("'explicit_create_project'");
  
  if (hasExplicitInTypes && !hasOldCreateInTypes) {
    console.log('✅ PASSED: Types updated with explicit_create_project only');
  } else {
    console.log('❌ FAILED: Types not properly updated');
    console.log(`   - Has explicit_create_project: ${hasExplicitInTypes}`);
    console.log(`   - Has old create_project: ${hasOldCreateInTypes}`);
  }
} else {
  console.log('❌ FAILED: Could not find OrchestratorA2AMethod type');
}

console.log('\n🎯 Architecture Change Summary:');
console.log('• CREATE_PROJECT removed from natural language classification');
console.log('• DELEGATE now emphasized as 95% primary path'); 
console.log('• Project creation moved to explicit UI actions only');
console.log('• This eliminates the root cause of classification errors');

console.log('\n✨ Expected Behavior:');
console.log('• All task requests should now classify as DELEGATE');
console.log('• Marketing agents should consistently get proper delegation');
console.log('• No more CREATE_PROJECT misclassification errors');
console.log('• UI will handle project creation explicitly');