#!/usr/bin/env node

/**
 * Test Direct Supabase Connection without NestJS
 */

const { createClient } = require('@supabase/supabase-js');

async function testDirectConnection() {
  console.log('🔗 Testing Direct Supabase Connection');
  console.log('====================================');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 Key: ${supabaseKey ? '***' + supabaseKey.slice(-4) : 'NOT_FOUND'}`);

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('\n🔍 Testing basic query...');
    
    // Try to query public schema tables (should work without specific table config)
    const { data, error } = await supabase
      .from('llm_configuration')
      .select('id, provider, model, is_default')
      .limit(5);

    if (error) {
      console.error('❌ Direct query failed:', error);
      console.log('\n🔄 Trying with public prefix...');
      
      // Try with explicit public schema
      const { data: data2, error: error2 } = await supabase
        .from('public.llm_configuration')
        .select('id, provider, model, is_default')
        .limit(5);
        
      if (error2) {
        console.error('❌ Public schema query also failed:', error2);
      } else {
        console.log('✅ Public schema query succeeded!');
        console.log(`Found ${data2?.length || 0} configurations`);
        if (data2 && data2.length > 0) {
          data2.forEach(config => {
            console.log(`- ${config.provider}/${config.model} ${config.is_default ? '(default)' : ''}`);
          });
        }
      }
    } else {
      console.log('✅ Direct query succeeded!');
      console.log(`Found ${data?.length || 0} configurations`);
      if (data && data.length > 0) {
        data.forEach(config => {
          console.log(`- ${config.provider}/${config.model} ${config.is_default ? '(default)' : ''}`);
        });
      }
    }

    console.log('\n🎉 Direct connection test completed!');

  } catch (error) {
    console.error('💥 Connection test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Load environment variables
require('dotenv').config();
testDirectConnection();