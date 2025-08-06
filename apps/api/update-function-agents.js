#!/usr/bin/env node

/**
 * Script to convert all function agents to pure service container pattern
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function findAgentConfigs(dir) {
  let configs = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      const subPath = path.join(dir, item.name);
      configs = configs.concat(findAgentConfigs(subPath));
    } else if (item.name === 'agent.yaml') {
      const configPath = path.join(dir, item.name);
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(content);
        if (config && config.type === 'function') {
          const servicePath = path.join(dir, 'agent-service.ts');
          if (fs.existsSync(servicePath)) {
            configs.push({
              configPath,
              servicePath,
              agentName: config.name,
              type: config.type
            });
          }
        }
      } catch (error) {
        console.log(`Could not parse ${configPath}: ${error.message}`);
      }
    }
  }
  return configs;
}

function convertFunctionAgentService(servicePath, agentName) {
  console.log(`📝 Converting ${agentName} at ${servicePath}`);
  
  let content = fs.readFileSync(servicePath, 'utf8');
  
  // Check if already converted
  if (content.includes('FunctionAgentServicesContext') && content.includes('super(services)')) {
    console.log(`✅ ${agentName} already converted`);
    return false;
  }
  
  // Replace imports - remove all the individual service imports and add FunctionAgentServicesContext
  content = content.replace(
    /import { Injectable, Inject, forwardRef } from '@nestjs\/common';\s*/,
    "import { Injectable } from '@nestjs/common';\n"
  );
  
  // Remove all individual service imports
  const servicesToRemove = [
    'HttpService',
    'LLMService', 
    'TaskProgressGateway',
    'TasksService',
    'TaskStatusService',
    'DeliverablesService',
    'AgentRegistrationService',
    'JsonRpcProtocolService',
    'LoggingService',
    'AuthService',
    'ConfigurationService'
  ];
  
  servicesToRemove.forEach(service => {
    // Remove import lines for individual services
    const importRegex = new RegExp(`import.*${service}.*from.*?;\n`, 'g');
    content = content.replace(importRegex, '');
  });
  
  // Add FunctionAgentServicesContext import if not already present
  if (!content.includes('FunctionAgentServicesContext')) {
    const functionImportMatch = content.match(/import.*FunctionAgentBaseService.*from.*?;\n/);
    if (functionImportMatch) {
      const newImport = functionImportMatch[0] + "import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';\n";
      content = content.replace(functionImportMatch[0], newImport);
    }
  }
  
  // Replace constructor with pure service container pattern
  const constructorRegex = /constructor\s*\(\s*[\s\S]*?\)\s*\{[\s\S]*?super\s*\([\s\S]*?\);/;
  const constructorMatch = content.match(constructorRegex);
  
  if (constructorMatch) {
    // Extract any logic after super() call but before the closing brace
    const superCallEnd = constructorMatch[0].lastIndexOf(');');
    const afterSuper = constructorMatch[0].substring(superCallEnd + 2).replace(/\s*$/, '');
    
    const newConstructor = `constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
  ) {
    super(services);${afterSuper}`;
    
    content = content.replace(constructorMatch[0], newConstructor);
  }
  
  // Write the updated content
  fs.writeFileSync(servicePath, content);
  console.log(`✅ Converted ${agentName}`);
  return true;
}

// Main execution
const agentsDir = path.join(__dirname, 'src', 'agents', 'actual');
console.log('🔍 Searching for function agents...');

const functionAgents = findAgentConfigs(agentsDir);
console.log(`📊 Found ${functionAgents.length} function agents:`);

functionAgents.forEach(agent => {
  console.log(`  - ${agent.agentName} (${agent.servicePath})`);
});

console.log('\n🔄 Converting function agents to pure service container pattern...');

let convertedCount = 0;
functionAgents.forEach(agent => {
  const converted = convertFunctionAgentService(agent.servicePath, agent.agentName);
  if (converted) convertedCount++;
});

console.log(`\n🎉 Conversion complete! ${convertedCount} function agents converted.`);
console.log('✅ All function agents now use the pure service container pattern');