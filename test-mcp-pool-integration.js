const testMCPPoolIntegration = async () => {
  try {
    console.log('🔍 Testing MCP Pool Integration and Discovery...\n');
    
    // Test MCP Pool Service endpoints
    const tests = [
      {
        name: 'Get MCP Pool Health',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/health',
        description: 'Check if MCP pool service is running'
      },
      {
        name: 'Get Pool Statistics',
        method: 'GET', 
        url: 'http://localhost:4000/mcp-pool/stats',
        description: 'Get current pool statistics and metrics'
      },
      {
        name: 'Get All Registered MCPs',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/mcps',
        description: 'List all registered MCP services'
      },
      {
        name: 'Get Online MCPs',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/mcps/online',
        description: 'List only online MCP services'
      },
      {
        name: 'Get MCP Capabilities Document',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/capabilities',
        description: 'Get comprehensive capabilities for orchestrator'
      },
      {
        name: 'Get Orchestration MCP List',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/orchestration/mcps',
        description: 'Get formatted MCP list for LLM prompts'
      },
      {
        name: 'Get All Available Tools',
        method: 'GET',
        url: 'http://localhost:4000/mcp-pool/tools',
        description: 'Get all tools available across MCP services'
      },
      {
        name: 'Trigger MCP Discovery',
        method: 'POST',
        url: 'http://localhost:4000/mcp-pool/discover',
        description: 'Manually trigger MCP service discovery'
      }
    ];

    const results = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`=== TEST ${i + 1}/8: ${test.name} ===`);
      console.log(`📝 ${test.description}`);
      console.log(`🌐 ${test.method} ${test.url}`);

      try {
        const response = await fetch(test.url, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`📡 HTTP Status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ SUCCESS`);
          
          // Show relevant data based on test type
          if (test.name.includes('Health')) {
            console.log(`   Status: ${data.status}`);
            console.log(`   Pool Size: ${data.poolSize}`);
            console.log(`   Online MCPs: ${data.onlineMCPs}`);
            console.log(`   Health Score: ${data.healthScore}%`);
          }
          else if (test.name.includes('Statistics')) {
            console.log(`   Total MCPs: ${data.total}`);
            console.log(`   Online: ${data.online}, Offline: ${data.offline}`);
            console.log(`   Total Tools: ${data.totalTools}`);
            console.log(`   Health Score: ${data.healthScore}%`);
            console.log(`   By Type: ${JSON.stringify(data.byType)}`);
          }
          else if (test.name.includes('Registered MCPs')) {
            console.log(`   Found ${data.length} registered MCPs:`);
            data.forEach(mcp => {
              console.log(`     • ${mcp.name} (${mcp.id}) - ${mcp.status}`);
              console.log(`       Type: ${mcp.type}, Provider: ${mcp.provider}`);
              console.log(`       Tools: ${mcp.tools?.length || 0}, Capabilities: ${mcp.capabilities?.length || 0}`);
            });
          }
          else if (test.name.includes('Online MCPs')) {
            console.log(`   Found ${data.length} online MCPs:`);
            data.forEach(mcp => {
              console.log(`     • ${mcp.name} (${mcp.id})`);
            });
          }
          else if (test.name.includes('Capabilities Document')) {
            console.log(`   Total MCPs: ${data.totalMCPs}`);
            console.log(`   Total Tools: ${data.totalTools}`);
            console.log(`   Total Capabilities: ${data.totalCapabilities}`);
            console.log(`   MCPs by Type: ${JSON.stringify(data.mcpsByType)}`);
            console.log(`   MCPs by Provider: ${JSON.stringify(data.mcpsByProvider)}`);
          }
          else if (test.name.includes('Orchestration')) {
            console.log(`   MCP Count: ${data.mcpCount}`);
            console.log(`   Tool Count: ${data.toolCount}`);
            console.log(`   MCP List Preview: ${data.mcpList.substring(0, 200)}...`);
          }
          else if (test.name.includes('All Available Tools')) {
            console.log(`   Total Tools: ${data.totalTools}`);
            console.log(`   MCPs Included: ${data.mcpsIncluded}`);
            if (data.tools.length > 0) {
              console.log(`   Sample Tools:`);
              data.tools.slice(0, 3).forEach(tool => {
                console.log(`     • ${tool.name} (${tool.mcpName}) - ${tool.description.substring(0, 60)}...`);
              });
            }
          }
          else if (test.name.includes('Discovery')) {
            console.log(`   Total Found: ${data.totalFound}`);
            console.log(`   Successful Registrations: ${data.successfulRegistrations}`);
            console.log(`   Errors: ${data.errors?.length || 0}`);
            if (data.discovered?.length > 0) {
              console.log(`   Discovered Services:`);
              data.discovered.forEach(service => {
                console.log(`     • ${service.name} (${service.id})`);
              });
            }
          }
          
          results.push({ ...test, status: 'success', data });
        } else {
          console.log(`❌ FAILED: HTTP ${response.status}`);
          const errorText = await response.text();
          console.log(`   Error: ${errorText}`);
          results.push({ ...test, status: 'failed', error: `HTTP ${response.status}: ${errorText}` });
        }

      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`);
        results.push({ ...test, status: 'failed', error: error.message });
      }

      console.log(`\\n${'='.repeat(80)}\\n`);
    }

    // Test MCP tool execution if we have available MCPs
    console.log('=== TESTING MCP TOOL EXECUTION ===');
    
    try {
      // First get available MCPs
      const mcpsResponse = await fetch('http://localhost:4000/mcp-pool/mcps/online');
      if (mcpsResponse.ok) {
        const mcps = await mcpsResponse.json();
        
        if (mcps.length > 0) {
          const supabaseMCP = mcps.find(mcp => mcp.id === 'supabase-mcp');
          
          if (supabaseMCP) {
            console.log(`🧪 Testing tool execution on ${supabaseMCP.name}...`);
            
            // Test simple tool execution
            const executionRequest = {
              mcpId: 'supabase-mcp',
              toolName: 'get-schema',
              parameters: {
                format: 'json'
              },
              userId: 'test-user',
              sessionId: 'test-session'
            };
            
            const execResponse = await fetch('http://localhost:4000/mcp-pool/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(executionRequest)
            });
            
            if (execResponse.ok) {
              const execResult = await execResponse.json();
              console.log(`✅ Tool execution successful!`);
              console.log(`   Execution Time: ${execResult.executionTime}ms`);
              console.log(`   Tool: ${execResult.toolName}`);
              console.log(`   MCP: ${execResult.mcpId}`);
              console.log(`   Success: ${execResult.success}`);
            } else {
              console.log(`❌ Tool execution failed: HTTP ${execResponse.status}`);
            }
          } else {
            console.log(`⚠️  Supabase MCP not found in online MCPs`);
          }
        } else {
          console.log(`⚠️  No online MCPs available for tool execution test`);
        }
      }
    } catch (error) {
      console.log(`❌ Tool execution test failed: ${error.message}`);
    }

    // Summary
    console.log(`\\n${'='.repeat(80)}\\n`);
    console.log('🏁 MCP POOL INTEGRATION TEST RESULTS\\n');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log('📊 RESULTS BREAKDOWN:');
    console.log(`   ✅ Successful: ${successful.length}/${results.length} (${Math.round(successful.length / results.length * 100)}%)`);
    console.log(`   ❌ Failed: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      console.log(`\\n✅ WORKING ENDPOINTS:`);
      successful.forEach(r => {
        console.log(`   • ${r.name}: ${r.method} ${r.url}`);
      });
    }
    
    if (failed.length > 0) {
      console.log(`\\n❌ FAILED ENDPOINTS:`);
      failed.forEach(r => {
        console.log(`   • ${r.name}: ${r.error}`);
      });
    }
    
    console.log('\\n🎯 ASSESSMENT:');
    const successRate = successful.length / results.length;
    if (successRate >= 0.8) {
      console.log('🏆 EXCELLENT: MCP pool integration is working very well!');
    } else if (successRate >= 0.6) {
      console.log('✅ GOOD: Most endpoints working, some issues to resolve');
    } else {
      console.log('⚠️  NEEDS WORK: Multiple integration issues detected');
    }
    
    console.log('\\n🚀 MCP Pool Integration testing complete!');
    return results;
    
  } catch (error) {
    console.error('❌ MCP Pool integration test failed:', error.message);
    process.exit(1);
  }
};

testMCPPoolIntegration();