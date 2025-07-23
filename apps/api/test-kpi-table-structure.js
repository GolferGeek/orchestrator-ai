#!/usr/bin/env node

const http = require('http');

async function makeRequest(path, method = 'GET', data = null) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: path,
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          console.log('Raw response:', responseData);
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testKPITableStructure() {
  console.log('🔍 Testing KPI table structure\n');

  try {
    // Check table columns
    console.log('1. Getting kpi_metrics table columns...');
    const columnsResponse = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: `SELECT column_name, data_type 
                   FROM information_schema.columns 
                   WHERE table_name = 'kpi_metrics' 
                   AND table_schema = 'public' 
                   ORDER BY ordinal_position`,
        format: 'json'
      }
    });

    const columnsResult = JSON.parse(columnsResponse.tool_result.content[0].text);
    console.log('✅ Table columns:');
    columnsResult.data.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type})`);
    });

    // Check actual data
    console.log('\n2. Getting sample data from kpi_metrics...');
    const dataResponse = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: 'SELECT * FROM kpi_metrics LIMIT 3',
        format: 'json'
      }
    });

    const dataResult = JSON.parse(dataResponse.tool_result.content[0].text);
    console.log(`✅ Sample data (${dataResult.data.length} records):`);
    if (dataResult.data.length > 0) {
      console.log(JSON.stringify(dataResult.data[0], null, 2));
    } else {
      console.log('   No data in table');
    }

    // Check row count
    console.log('\n3. Getting row count...');
    const countResponse = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: 'SELECT COUNT(*) as row_count FROM kpi_metrics',
        format: 'json'
      }
    });

    const countResult = JSON.parse(countResponse.tool_result.content[0].text);
    console.log(`✅ Total rows: ${countResult.data[0].row_count}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testKPITableStructure();