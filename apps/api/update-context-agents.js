#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of context agent files to update
const contextAgentFiles = [
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/chat_support/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/voice_summary/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/sop/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/email_triage/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/calendar/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/marketing/market_research/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/hr/onboarding/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/finance/invoice/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/product/product_launch_coordinator/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/voice_receptionist/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/policy_rag/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/meetings/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/leads/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/engineering/launcher/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/internal_rag/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/external_rag/agent-service.ts'
];

function updateContextAgent(filePath) {
  console.log(`Updating ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace imports - remove all individual service imports and add AgentServicesContext
    const importRegex = /import \{[^}]*\} from '[^']*';?\s*/g;
    const imports = content.match(importRegex) || [];
    
    // Keep only Injectable and ContextAgentBaseService imports, add AgentServicesContext
    let newImports = `import { Injectable } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

`;
    
    // Replace everything before the @Injectable decorator
    content = content.replace(/^[\s\S]*?(?=@Injectable)/m, newImports);
    
    // Replace constructor - find the constructor and replace it
    const constructorRegex = /constructor\s*\([^}]*\}\s*\)/s;
    const newConstructor = `constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    services: AgentServicesContext,
  ) {
    super(services);
  }`;
    
    content = content.replace(constructorRegex, newConstructor);
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

console.log('🔄 Updating all context agents to use pure service container pattern...\n');

contextAgentFiles.forEach(updateContextAgent);

console.log('\n✅ All context agents updated!');