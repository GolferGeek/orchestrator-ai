const testSupabaseSQLPatterns = async () => {
  try {
    console.log('🔍 Testing Supabase SQL patterns to understand limitations...\n');
    
    const testPatterns = [
      {
        name: "Simple SELECT with ORDER BY",
        sql: "SELECT id, name FROM departments ORDER BY name",
        expected: "Should work"
      },
      {
        name: "SELECT with AS alias",
        sql: "SELECT id, name AS department_name FROM departments ORDER BY name",
        expected: "Should work"
      },
      {
        name: "SELECT with calculated column",
        sql: "SELECT id, name, (id * 2) AS double_id FROM departments",
        expected: "May fail - calculated columns"
      },
      {
        name: "ORDER BY with alias",
        sql: "SELECT id, name AS dept_name FROM departments ORDER BY dept_name",
        expected: "May fail - ORDER BY alias"
      },
      {
        name: "Simple JOIN",
        sql: "SELECT d.id, d.name FROM departments d JOIN companies c ON d.company_id = c.id LIMIT 5",
        expected: "Should work"
      },
      {
        name: "JOIN with alias columns",
        sql: "SELECT d.name AS dept, c.name AS company FROM departments d JOIN companies c ON d.company_id = c.id LIMIT 5",
        expected: "May work"
      },
      {
        name: "Simple aggregation",
        sql: "SELECT COUNT(*) FROM departments",
        expected: "Should work"
      },
      {
        name: "GROUP BY simple",
        sql: "SELECT company_id, COUNT(*) FROM departments GROUP BY company_id",
        expected: "Should work"
      },
      {
        name: "ORDER BY with function",
        sql: "SELECT id, name FROM departments ORDER BY LOWER(name)",
        expected: "Will fail - functions in ORDER BY"
      },
      {
        name: "Multiple ORDER BY columns",
        sql: "SELECT id, name FROM departments ORDER BY name, id",
        expected: "Should work"
      }
    ];
    
    console.log(`🎯 Testing ${testPatterns.length} SQL patterns...\\n`);
    
    const results = [];
    
    for (let i = 0; i < testPatterns.length; i++) {
      const pattern = testPatterns[i];
      console.log(`=== PATTERN ${i + 1}/10: ${pattern.name} ===`);
      console.log(`📝 SQL: ${pattern.sql}`);
      console.log(`🎯 Expected: ${pattern.expected}`);
      
      try {
        const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: pattern.sql,
              dry_run: false
            }
          })
        });
        
        if (executeResponse.ok) {
          const executeResult = await executeResponse.json();
          const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
          
          if (executeContent.success) {
            console.log(`✅ SUCCESS: Pattern works`);
            console.log(`   Rows: ${executeContent.data?.row_count || 0}`);
            results.push({ ...pattern, status: 'success', error: null });
          } else {
            console.log(`❌ FAILED: ${executeContent.error}`);
            results.push({ ...pattern, status: 'failed', error: executeContent.error });
          }
        } else {
          console.log(`❌ HTTP ERROR: ${executeResponse.status}`);
          results.push({ ...pattern, status: 'http_error', error: `HTTP ${executeResponse.status}` });
        }
        
      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`);
        results.push({ ...pattern, status: 'exception', error: error.message });
      }
      
      console.log(`\\n${'='.repeat(60)}\\n`);
    }
    
    // Analyze patterns
    console.log('🏁 SUPABASE SQL PATTERN ANALYSIS\\n');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`✅ WORKING PATTERNS (${successful.length}/${results.length}):`);
    successful.forEach(r => {
      console.log(`   • ${r.name}: ${r.sql}`);
    });
    
    console.log(`\\n❌ FAILED PATTERNS (${failed.length}/${results.length}):`);
    failed.forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
      console.log(`     SQL: ${r.sql}`);
    });
    
    // Extract limitations
    console.log('\\n🔍 IDENTIFIED LIMITATIONS:');
    failed.forEach(r => {
      if (r.error?.includes('failed to parse')) {
        console.log(`   • ${r.name}: Parser limitation`);
      } else if (r.error?.includes('order')) {
        console.log(`   • ${r.name}: ORDER BY limitation`);
      } else if (r.error?.includes('select parameter')) {
        console.log(`   • ${r.name}: SELECT parameter limitation`);
      } else {
        console.log(`   • ${r.name}: ${r.error}`);
      }
    });
    
    console.log('\\n✅ Supabase SQL pattern testing complete!');
    return results;
    
  } catch (error) {
    console.error('❌ Pattern testing failed:', error.message);
    process.exit(1);
  }
};

testSupabaseSQLPatterns();