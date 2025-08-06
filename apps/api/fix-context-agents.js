#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all context agent files that might need fixing
const contextAgentFiles = [
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/chat_support/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/voice_summary/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/sop/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/email_triage/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/calendar/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/marketing/market_research/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/hr/onboarding/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/product/product_launch_coordinator/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/voice_receptionist/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/policy_rag/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/operations/meetings/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/sales/leads/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/engineering/launcher/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/internal_rag/agent-service.ts',
  '/Users/golfergeek/projects/golfergeek/orchestrator-ai/apps/api/src/agents/actual/research/external_rag/agent-service.ts'
];

function fixContextAgent(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the constructor entirely
    const constructorRegex = /constructor\s*\([\s\S]*?\)\s*\{[\s\S]*?super\([\s\S]*?\);\s*\}/;
    const newConstructor = `constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    services: AgentServicesContext,
  ) {
    super(services);
  }`;
    
    content = content.replace(constructorRegex, newConstructor);
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing context agents with incorrect constructors...\n');

contextAgentFiles.forEach(fixContextAgent);

console.log('\n✅ All context agents fixed!');