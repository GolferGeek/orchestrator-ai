#!/usr/bin/env node

// Load production environment variables
require('dotenv').config({ path: '../../.env.production' });

// Set NODE_ENV
process.env.NODE_ENV = 'production';

// Start the NestJS application using ts-node with path resolution
const { execSync } = require('child_process');

try {
  console.log('🚀 Starting Orchestrator AI API in production mode...');
  console.log('📂 Loading environment from .env.production');
  console.log('🔧 Using ts-node with path resolution');
  
  // Use ts-node with the tsconfig-paths plugin for path resolution
  execSync('npx ts-node -r tsconfig-paths/register src/main.ts', {
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('❌ Failed to start API:', error.message);
  process.exit(1);
}
