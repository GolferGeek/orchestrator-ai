/**
 * VIP List Management Demo
 * Shows how to add custom PII patterns and test them via API
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:9000';

async function demonstrateVIPManagement() {
  console.log('🎭 VIP List Management Demo\n');

  // 1. Add VIP Executive Name Pattern
  console.log('1️⃣ Adding VIP Executive Name Pattern...');
  try {
    const vipNameResponse = await axios.post(`${API_BASE}/sanitization/pii/patterns`, {
      name: 'vip_executives_demo',
      dataType: 'name',
      pattern: '\\b(?:Elon Musk|Jeff Bezos|Tim Cook|Satya Nadella)\\b',
      description: 'VIP Tech Executive Names',
      priority: 5
    });
    console.log('✅ VIP Name Pattern Added:', vipNameResponse.data);
  } catch (error) {
    console.log('⚠️ VIP Name Pattern:', error.response?.data || error.message);
  }

  // 2. Add VIP Company Pattern
  console.log('\n2️⃣ Adding VIP Company Pattern...');
  try {
    const vipCompanyResponse = await axios.post(`${API_BASE}/sanitization/pii/patterns`, {
      name: 'vip_companies_demo',
      dataType: 'custom',
      pattern: '\\b(?:Microsoft|Apple|Google|Amazon|Tesla)\\b',
      description: 'VIP Tech Companies',
      priority: 10
    });
    console.log('✅ VIP Company Pattern Added:', vipCompanyResponse.data);
  } catch (error) {
    console.log('⚠️ VIP Company Pattern:', error.response?.data || error.message);
  }

  // 3. Test VIP Detection
  console.log('\n3️⃣ Testing VIP Detection...');
  const testText = `
    Hi, I'm Tim Cook from Apple and I need to discuss our partnership with Microsoft. 
    Please contact Elon Musk at Tesla for the joint project details.
    Also, Jeff Bezos from Amazon wants to schedule a meeting about the Google integration.
  `;

  try {
    const testResponse = await axios.post(`${API_BASE}/sanitization/test`, {
      text: testText,
      enablePseudonymization: true,
      enableRedaction: false
    });
    
    console.log('📝 Original Text:', testText.trim());
    console.log('🎭 Pseudonymized Text:', testResponse.data.result.sanitizedText);
    console.log('📊 PII Detected:', testResponse.data.result.piiDetected);
    console.log('🔄 Pseudonyms Applied:', testResponse.data.result.pseudonymsApplied);
  } catch (error) {
    console.log('❌ Test Error:', error.response?.data || error.message);
  }

  // 4. Get All PII Patterns
  console.log('\n4️⃣ Current PII Patterns...');
  try {
    const patternsResponse = await axios.get(`${API_BASE}/sanitization/pii/patterns`);
    console.log('📋 Total Patterns:', patternsResponse.data.patterns?.length || 0);
    console.log('📋 Custom Patterns:', patternsResponse.data.patterns?.filter(p => p.name.includes('vip') || p.name.includes('demo')).length || 0);
  } catch (error) {
    console.log('❌ Patterns Error:', error.response?.data || error.message);
  }

  // 5. Get Service Statistics
  console.log('\n5️⃣ Service Statistics...');
  try {
    const statsResponse = await axios.get(`${API_BASE}/sanitization/stats`);
    console.log('📊 PII Pattern Stats:', {
      builtIn: statsResponse.data.piiPatternStats.builtInPatterns,
      custom: statsResponse.data.piiPatternStats.customPatterns,
      total: statsResponse.data.piiPatternStats.totalPatterns
    });
  } catch (error) {
    console.log('❌ Stats Error:', error.response?.data || error.message);
  }
}

// Run the demo
demonstrateVIPManagement().catch(console.error);
