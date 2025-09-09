// Test if environment variables are being loaded correctly
require('dotenv').config({ path: '../../.env' });

console.log('🔍 Environment Variable Check:');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.startsWith('sk-') : false);

console.log('\nGROK_API_KEY exists:', !!process.env.GROK_API_KEY);
console.log('GROK_API_KEY length:', process.env.GROK_API_KEY ? process.env.GROK_API_KEY.length : 0);

console.log('\nANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0);
console.log('ANTHROPIC_API_KEY starts with sk-ant:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant') : false);
