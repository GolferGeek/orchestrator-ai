#!/usr/bin/env node

/**
 * Test Supabase Connection and Check LLM Configurations
 */

const { NestFactory } = require('@nestjs/core');
const { LLMModule } = require('./dist/src/llms/llm.module');
const { SupabaseService } = require('./dist/src/supabase/supabase.service');
const { getTableName } = require('./dist/src/supabase/supabase.config');

async function testSupabaseConnection() {
  console.log('🔌 Testing Supabase Connection');
  console.log('==============================');

  try {
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: ['error'], // Minimal logging
    });

    const supabaseService = app.get(SupabaseService);
    console.log('✅ Supabase Service loaded');

    // Test connection by querying LLM configurations
    console.log('\n📊 Querying LLM configurations...');
    const client = supabaseService.getServiceClient();
    
    const { data: configs, error } = await client
      .from(getTableName('llm_configuration'))
      .select('id, provider, model, is_default')
      .order('is_default', { ascending: false });

    if (error) {
      console.error('❌ Database query failed:', error.message);
      console.error('   Details:', error);
    } else {
      console.log('✅ Database query succeeded!');
      console.log(`   Found ${configs?.length || 0} LLM configurations:`);
      
      if (configs && configs.length > 0) {
        configs.forEach((config, index) => {
          console.log(`   ${index + 1}. ${config.provider}/${config.model} ${config.is_default ? '(default)' : ''}`);
        });
      } else {
        console.log('   No LLM configurations found in database');
      }
    }

    // Test querying LLM usage table
    console.log('\n📈 Checking LLM usage table...');
    const { data: usage, error: usageError } = await client
      .from(getTableName('llm_usage'))
      .select('run_id, provider, model, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (usageError) {
      console.error('❌ LLM usage query failed:', usageError.message);
    } else {
      console.log(`✅ LLM usage table accessible! Found ${usage?.length || 0} recent records`);
      if (usage && usage.length > 0) {
        usage.forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.provider}/${record.model} - ${record.created_at}`);
        });
      }
    }

    await app.close();
    console.log('\n🎉 Supabase connection test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSupabaseConnection();