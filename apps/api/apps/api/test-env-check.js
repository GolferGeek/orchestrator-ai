// Test if the server process can see the environment variables
require('dotenv').config({ path: '../../.env' });

console.log('🔍 Environment Variable Check from Node process:');
console.log('GROK_API_KEY exists:', !!process.env.GROK_API_KEY);
console.log('GROK_API_KEY length:', process.env.GROK_API_KEY ? process.env.GROK_API_KEY.length : 0);
console.log('GROK_API_KEY starts with xai-:', process.env.GROK_API_KEY ? process.env.GROK_API_KEY.startsWith('xai-') : false);

console.log('\nXAI_API_KEY exists:', !!process.env.XAI_API_KEY);
console.log('XAI_API_KEY length:', process.env.XAI_API_KEY ? process.env.XAI_API_KEY.length : 0);
console.log('XAI_API_KEY starts with xai-:', process.env.XAI_API_KEY ? process.env.XAI_API_KEY.startsWith('xai-') : false);

console.log('\nOPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
