const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./apps/api/dist/src/app.module');

async function testBlogPostDeliverableFlow() {
  console.log('🔍 Testing blog post deliverable creation flow...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const blogPostService = app.get('BlogPostService');
    
    console.log('✅ Blog Post Service found:', !!blogPostService);
    
    // Test a blog post request to see what the response structure looks like
    const testPrompt = 'Write a blog post about AI automation in business';
    console.log(`\n🚀 Testing blog post request: ${testPrompt}`);
    
    const result = await blogPostService.executeTask('executeTask', {
      prompt: testPrompt,
      userId: 'test-user',
      conversationId: 'test-conv'
    });
    
    console.log(`\n📊 RESULT STRUCTURE:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Keys: ${Object.keys(result)}`);
    console.log(`   Has response: ${!!result.response}`);
    console.log(`   Response type: ${typeof result.response}`);
    console.log(`   Response length: ${result.response?.length || 0}`);
    console.log(`   Response preview: ${result.response ? result.response.substring(0, 200) + '...' : 'none'}`);
    console.log(`   Has metadata: ${!!result.metadata}`);
    console.log(`   Metadata keys: ${result.metadata ? Object.keys(result.metadata) : 'none'}`);
    console.log(`   Has deliverable_id: ${!!(result.deliverableId || result.metadata?.deliverable_id)}`);
    
    // Simulate frontend deliverable detection logic
    console.log(`\n🎭 FRONTEND DELIVERABLE DETECTION SIMULATION:`);
    
    const content = result.response || '';
    const hasMarkdownIndicators = 
      content.includes('#') ||      // Headers
      content.includes('**') ||     // Bold text
      content.includes('*') ||      // Italic or lists  
      content.includes('```') ||    // Code blocks
      content.includes('\n\n');     // Multiple paragraphs
    
    const isSubstantial = content.length > 200;
    
    console.log(`   Content length: ${content.length}`);
    console.log(`   Has markdown indicators: ${hasMarkdownIndicators}`);
    console.log(`   Is substantial (>200 chars): ${isSubstantial}`);
    console.log(`   Should create deliverable: ${hasMarkdownIndicators && isSubstantial}`);
    
    // Check specific markdown patterns
    console.log(`\n📝 MARKDOWN PATTERN ANALYSIS:`);
    console.log(`   Contains '#': ${content.includes('#')}`);
    console.log(`   Contains '**': ${content.includes('**')}`);
    console.log(`   Contains '*': ${content.includes('*')}`);
    console.log(`   Contains '\`\`\`': ${content.includes('```')}`);
    console.log(`   Contains '\\n\\n': ${content.includes('\n\n')}`);
    
    await app.close();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testBlogPostDeliverableFlow();