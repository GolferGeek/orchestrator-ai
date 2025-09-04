/**
 * Direct Database VIP List Demo
 * Shows how VIP patterns are stored and managed in the database
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function demonstrateVIPDatabase() {
  console.log('🎭 VIP List Database Demo\n');

  try {
    // 1. Show existing redaction patterns
    console.log('1️⃣ Current Redaction Patterns in Database:');
    const { data: patterns, error: patternsError } = await supabase
      .from('redaction_patterns')
      .select('name, pattern_regex, description, category, priority, is_active')
      .order('priority');

    if (patternsError) {
      console.log('❌ Error fetching patterns:', patternsError);
    } else {
      console.log(`📋 Found ${patterns.length} patterns:`);
      patterns.forEach(p => {
        console.log(`   • ${p.name}: ${p.pattern_regex} (${p.category}, priority: ${p.priority})`);
      });
    }

    // 2. Add VIP Executive Names Pattern
    console.log('\n2️⃣ Adding VIP Executive Names Pattern...');
    const { data: vipPattern, error: vipError } = await supabase
      .from('redaction_patterns')
      .insert({
        name: 'vip_tech_executives',
        pattern_regex: '\\b(?:Elon Musk|Jeff Bezos|Tim Cook|Satya Nadella|Mark Zuckerberg)\\b',
        replacement: '[VIP_EXECUTIVE]',
        description: 'VIP Tech Executive Names for pseudonymization',
        category: 'pii_custom',
        priority: 5,
        is_active: true
      })
      .select()
      .single();

    if (vipError) {
      if (vipError.code === '23505') {
        console.log('⚠️ VIP pattern already exists (duplicate key)');
      } else {
        console.log('❌ Error adding VIP pattern:', vipError);
      }
    } else {
      console.log('✅ VIP Executive pattern added:', vipPattern.name);
    }

    // 3. Add VIP Company Names Pattern
    console.log('\n3️⃣ Adding VIP Company Names Pattern...');
    const { data: companyPattern, error: companyError } = await supabase
      .from('redaction_patterns')
      .insert({
        name: 'vip_tech_companies',
        pattern_regex: '\\b(?:Microsoft|Apple|Google|Amazon|Tesla|Meta|Netflix)\\b',
        replacement: '[VIP_COMPANY]',
        description: 'VIP Tech Company Names for pseudonymization',
        category: 'pii_custom',
        priority: 10,
        is_active: true
      })
      .select()
      .single();

    if (companyError) {
      if (companyError.code === '23505') {
        console.log('⚠️ Company pattern already exists (duplicate key)');
      } else {
        console.log('❌ Error adding company pattern:', companyError);
      }
    } else {
      console.log('✅ VIP Company pattern added:', companyPattern.name);
    }

    // 4. Show pseudonym dictionaries
    console.log('\n4️⃣ Current Pseudonym Dictionaries:');
    const { data: dictionaries, error: dictError } = await supabase
      .from('pseudonym_dictionaries')
      .select('data_type, category, value, frequency_weight')
      .order('data_type, frequency_weight', { ascending: false })
      .limit(20);

    if (dictError) {
      console.log('❌ Error fetching dictionaries:', dictError);
    } else {
      console.log(`📚 Found ${dictionaries.length} dictionary entries (showing first 20):`);
      let currentType = '';
      dictionaries.forEach(d => {
        if (d.data_type !== currentType) {
          console.log(`\n   ${d.data_type.toUpperCase()} (${d.category}):`);
          currentType = d.data_type;
        }
        console.log(`     • ${d.value} (weight: ${d.frequency_weight})`);
      });
    }

    // 5. Add VIP-style pseudonym dictionaries
    console.log('\n5️⃣ Adding VIP-style Pseudonym Dictionaries...');
    const vipDictionaries = [
      { data_type: 'name', category: 'first_names_executive', value: 'Alexander', frequency_weight: 9 },
      { data_type: 'name', category: 'first_names_executive', value: 'Victoria', frequency_weight: 9 },
      { data_type: 'name', category: 'first_names_executive', value: 'Jonathan', frequency_weight: 8 },
      { data_type: 'name', category: 'last_names_executive', value: 'Sterling', frequency_weight: 9 },
      { data_type: 'name', category: 'last_names_executive', value: 'Whitman', frequency_weight: 8 },
      { data_type: 'email', category: 'domains_executive', value: 'executive-group.com', frequency_weight: 8 }
    ];

    for (const dict of vipDictionaries) {
      const { error: dictInsertError } = await supabase
        .from('pseudonym_dictionaries')
        .insert(dict);

      if (dictInsertError) {
        if (dictInsertError.code === '23505') {
          console.log(`⚠️ Dictionary entry '${dict.value}' already exists`);
        } else {
          console.log(`❌ Error adding '${dict.value}':`, dictInsertError);
        }
      } else {
        console.log(`✅ Added dictionary entry: ${dict.value} (${dict.category})`);
      }
    }

    // 6. Show updated patterns count
    console.log('\n6️⃣ Updated Pattern Counts:');
    const { count: totalPatterns } = await supabase
      .from('redaction_patterns')
      .select('*', { count: 'exact', head: true });
    
    const { count: customPatterns } = await supabase
      .from('redaction_patterns')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'pii_custom');

    console.log(`📊 Total redaction patterns: ${totalPatterns}`);
    console.log(`📊 Custom PII patterns: ${customPatterns}`);

    // 7. Test pattern matching (simulate)
    console.log('\n7️⃣ Pattern Matching Simulation:');
    const testText = "Hi, I'm Tim Cook from Apple and I need to discuss our partnership with Microsoft. Please contact Elon Musk at Tesla.";
    console.log(`📝 Test Text: "${testText}"`);
    
    const { data: activePatterns } = await supabase
      .from('redaction_patterns')
      .select('name, pattern_regex, replacement')
      .eq('category', 'pii_custom')
      .eq('is_active', true);

    console.log('\n🔍 Patterns that would match:');
    activePatterns.forEach(pattern => {
      const regex = new RegExp(pattern.pattern_regex, 'gi');
      const matches = testText.match(regex);
      if (matches) {
        console.log(`   ✅ ${pattern.name}: Found "${matches.join('", "')}" → ${pattern.replacement}`);
      }
    });

  } catch (error) {
    console.log('❌ Demo Error:', error);
  }
}

// Run the demo
demonstrateVIPDatabase().catch(console.error);
