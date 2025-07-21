#!/usr/bin/env node

// Debug script to test requirements_writer agent setup
const { exec } = require('child_process');
const path = require('path');

console.log('🔍 Starting requirements_writer debug test...');

// Test 1: Check if agent-function.py exists
const agentFunctionPath = path.join(__dirname, 'apps/api/src/agents/actual/engineering/requirements_writer/agent-function.py');
const fs = require('fs');

console.log('\n📁 Test 1: File existence check');
console.log(`Checking: ${agentFunctionPath}`);
console.log(`Exists: ${fs.existsSync(agentFunctionPath)}`);

if (fs.existsSync(agentFunctionPath)) {
    const stats = fs.statSync(agentFunctionPath);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Last modified: ${stats.mtime}`);
}

// Test 2: Check YAML config
const yamlPath = path.join(__dirname, 'apps/api/src/agents/actual/engineering/requirements_writer/agent.yaml');
console.log('\n📋 Test 2: YAML config check');
console.log(`Checking: ${yamlPath}`);
console.log(`Exists: ${fs.existsSync(yamlPath)}`);

if (fs.existsSync(yamlPath)) {
    try {
        const yamlContent = fs.readFileSync(yamlPath, 'utf8');
        console.log('YAML content preview:');
        console.log(yamlContent.split('\n').slice(0, 15).join('\n'));
        
        // Check for the critical type field
        if (yamlContent.includes('type: "python-function"')) {
            console.log('✅ Found type: "python-function"');
        } else {
            console.log('❌ Missing or incorrect type field');
        }
    } catch (error) {
        console.log(`❌ Error reading YAML: ${error.message}`);
    }
}

// Test 3: Try to start a minimal NestJS app and check agent registration
console.log('\n🚀 Test 3: Starting backend and checking agent registration...');
console.log('This will start the backend and check for requirements_writer setup messages');
console.log('Look for these messages in the output:');
console.log('  - "🔧 Creating agent: requirements_writer"');
console.log('  - "📋 Config loaded - type: python-function"');
console.log('  - "🔧 Setting up functions for requirements_writer"');
console.log('  - "🐍 Set Python script path for requirements_writer"');

const startBackend = exec('cd apps/api && npm run start:dev', {
    cwd: __dirname
});

let foundMessages = [];

startBackend.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Check for key messages
    if (output.includes('Creating agent: requirements_writer')) {
        foundMessages.push('✅ Found: Creating agent');
        console.log('✅ Found: Creating agent: requirements_writer');
    }
    
    if (output.includes('Config loaded - type: python-function')) {
        foundMessages.push('✅ Found: Config loaded as python-function');
        console.log('✅ Found: Config loaded - type: python-function');
    }
    
    if (output.includes('Setting up functions for requirements_writer')) {
        foundMessages.push('✅ Found: Setting up functions');
        console.log('✅ Found: Setting up functions for requirements_writer');
    }
    
    if (output.includes('Set Python script path for requirements_writer')) {
        foundMessages.push('✅ Found: Python script path set');
        console.log('✅ Found: Set Python script path for requirements_writer');
    }
    
    if (output.includes('Successfully created agent: requirements_writer')) {
        foundMessages.push('✅ Found: Agent created successfully');
        console.log('✅ Found: Successfully created agent: requirements_writer');
        
        // Stop after successful creation
        setTimeout(() => {
            console.log('\n📊 Summary of found messages:');
            foundMessages.forEach(msg => console.log(`  ${msg}`));
            console.log('\n🔍 If any messages are missing, that\'s where the problem is!');
            startBackend.kill();
            process.exit(0);
        }, 2000);
    }
});

startBackend.stderr.on('data', (data) => {
    const output = data.toString();
    
    // Also check stderr for our debug messages
    if (output.includes('Creating agent: requirements_writer') ||
        output.includes('Config loaded - type: python-function') ||
        output.includes('Setting up functions for requirements_writer') ||
        output.includes('Set Python script path for requirements_writer')) {
        console.log('📝 Debug info from stderr:', output.substring(0, 200));
    }
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n⏰ Timeout reached');
    console.log('📊 Messages found so far:');
    foundMessages.forEach(msg => console.log(`  ${msg}`));
    console.log('\n❌ If messages are missing, the issue is in agent creation process');
    startBackend.kill();
    process.exit(1);
}, 30000);