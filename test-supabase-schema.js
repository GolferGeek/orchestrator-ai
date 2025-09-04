#!/usr/bin/env node

/**
 * Check Supabase Schema and Set Up Tables if Needed
 */

const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  console.log('🔍 Checking Supabase Schema');
  console.log('===========================');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check what tables exist
    console.log('\n📋 Checking existing tables...');
    const { data: tables, error } = await supabase.rpc('get_tables');
    
    if (error) {
      console.log('❌ Cannot list tables via RPC, trying direct query...');
      
      // Try using information_schema
      const { data: schemaTables, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
        
      if (schemaError) {
        console.error('❌ Schema query failed:', schemaError);
      } else {
        console.log('✅ Found tables via information_schema:');
        schemaTables.forEach(table => {
          console.log(`- ${table.table_name}`);
        });
      }
    } else {
      console.log('✅ Found tables via RPC:');
      tables.forEach(table => {
        console.log(`- ${table}`);
      });
    }

    // Try to create the basic LLM tables
    console.log('\n🛠️  Attempting to create required tables...');
    
    const createLLMConfigTable = `
      CREATE TABLE IF NOT EXISTS public.llm_configuration (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const createLLMUsageTable = `
      CREATE TABLE IF NOT EXISTS public.llm_usage (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        run_id UUID NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_cost DECIMAL(10,6),
        data_sanitization_applied BOOLEAN DEFAULT FALSE,
        sanitization_level TEXT,
        pii_detected BOOLEAN DEFAULT FALSE,
        pii_types JSONB DEFAULT '[]',
        pseudonyms_used INTEGER DEFAULT 0,
        redactions_applied INTEGER DEFAULT 0,
        redaction_types JSONB DEFAULT '[]',
        source_blinding_applied BOOLEAN DEFAULT FALSE,
        headers_stripped INTEGER DEFAULT 0,
        custom_user_agent_used BOOLEAN DEFAULT FALSE,
        no_train_header_sent BOOLEAN DEFAULT FALSE,
        compliance_flags JSONB DEFAULT '{}',
        sovereign_mode BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const { error: configError } = await supabase.rpc('exec_sql', {
      sql: createLLMConfigTable
    });

    if (configError) {
      console.error('❌ Failed to create llm_configuration table:', configError);
    } else {
      console.log('✅ llm_configuration table created/verified');
    }

    const { error: usageError } = await supabase.rpc('exec_sql', {
      sql: createLLMUsageTable
    });

    if (usageError) {
      console.error('❌ Failed to create llm_usage table:', usageError);
    } else {
      console.log('✅ llm_usage table created/verified');
    }

    // Try to insert a default configuration
    console.log('\n🔧 Setting up default LLM configuration...');
    const { data: existingConfig, error: checkError } = await supabase
      .from('llm_configuration')
      .select('*')
      .eq('is_default', true)
      .limit(1);

    if (checkError) {
      console.error('❌ Cannot check existing configs:', checkError);
    } else if (!existingConfig || existingConfig.length === 0) {
      // Insert default Ollama configuration
      const { error: insertError } = await supabase
        .from('llm_configuration')
        .insert([
          { provider: 'ollama', model: 'llama3.2:latest', is_default: true }
        ]);

      if (insertError) {
        console.error('❌ Failed to insert default config:', insertError);
      } else {
        console.log('✅ Default Ollama configuration added');
      }
    } else {
      console.log('✅ Default configuration already exists');
    }

    console.log('\n🎉 Schema check/setup completed!');

  } catch (error) {
    console.error('💥 Schema check failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkSchema();