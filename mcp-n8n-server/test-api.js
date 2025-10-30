#!/usr/bin/env node

import { N8nAPI } from './n8n-api.js';

const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const apiKey = process.env.N8N_API_KEY;

console.log('Testing N8n API connection...');
console.log('URL:', n8nUrl);
console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT SET');

const api = new N8nAPI(n8nUrl, apiKey);

// Test connection
api.testConnection()
  .then(result => {
    console.log('\n=== Connection Test ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      // If connection successful, try listing workflows
      return api.listWorkflows();
    }
    return null;
  })
  .then(result => {
    if (result) {
      console.log('\n=== List Workflows ===');
      console.log(JSON.stringify(result, null, 2));
    }
  })
  .catch(error => {
    console.error('\n=== Error ===');
    console.error(error.message);
    console.error(error.stack);
  });
