#!/usr/bin/env node

/**
 * Direct test of the blog post agent to verify deliverable creation
 * Uses NestJS application context to bypass authentication issues
 */

async function testBlogPostAgent() {
  try {
    // Import required modules
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('./apps/api/dist/src/app.module');

    console.log('🚀 Starting direct blog post agent test...');
    
    // Create application context
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('✅ Application context created');

    // Get the blog post service
    const blogPostService = app.get('BlogPostService');
    console.log('✅ BlogPostService obtained:', !!blogPostService);

    // Create a test prompt that should trigger deliverable creation
    const testPrompt = 'Write a comprehensive blog post about "The Future of Remote Work: Technology, Culture, and Productivity" targeting business leaders. Include sections on current trends, benefits, challenges, and actionable recommendations for implementation.';
    
    console.log('\n🔍 Testing blog post generation...');
    console.log('📝 Prompt:', testPrompt);

    // Simulate task execution
    const mockParams = {
      prompt: testPrompt,
      userId: 'test-user-123',
      currentUser: { id: 'test-user-123' },
      taskId: 'test-task-' + Date.now(),
      providerId: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022'
    };

    const result = await blogPostService.executeTask('executeTask', mockParams);
    
    console.log('\n📊 Result Analysis:');
    console.log('  - Success:', result.success);
    console.log('  - Has response:', !!result.response);
    console.log('  - Response length:', result.response?.length || 0);
    console.log('  - Has deliverable ID:', !!result.deliverableId);
    console.log('  - Deliverable ID:', result.deliverableId || 'None');

    // Analyze the content for deliverable patterns
    if (result.response) {
      console.log('\n🔍 Content Analysis:');
      const content = result.response;
      console.log('  - Content length:', content.length);
      console.log('  - Has multiple paragraphs:', content.includes('\n\n'));
      console.log('  - Has markdown headers:', /^#+ /m.test(content));
      console.log('  - Has deliverable markers:', /(?:DELIVERABLE|DOCUMENT|REPORT|ANALYSIS|PLAN|REQUIREMENTS):/i.test(content));
      
      // Test the isDeliverableContent logic directly
      const hasStructure = content.includes('\n\n') || content.length > 300;
      const deliverableMarkers = [
        /^#\s+(.+)/m,
        /^##\s+(.+)/m,
        /^\*\*(.+)\*\*$/m,
        /DELIVERABLE:/i,
        /DOCUMENT:/i,
        /REPORT:/i,
        /ANALYSIS:/i,
        /PLAN:/i,
        /REQUIREMENTS:/i,
      ];
      const hasMarkers = deliverableMarkers.some(marker => marker.test(content));
      const shouldBeDeliverable = hasStructure || hasMarkers;
      
      console.log('  - Should be deliverable (logic test):', shouldBeDeliverable);
      console.log('  - Has structure:', hasStructure);
      console.log('  - Has markers:', hasMarkers);
    }

    if (result.deliverableId) {
      console.log('\n🎉 SUCCESS: Deliverable was auto-created!');
      console.log('📄 Deliverable ID:', result.deliverableId);
      
      // Try to get the deliverable details
      try {
        const deliverablesService = app.get('DeliverablesService');
        if (deliverablesService) {
          const deliverable = await deliverablesService.findById(result.deliverableId, 'test-user-123');
          console.log('✅ Deliverable details:', {
            id: deliverable.id,
            title: deliverable.title,
            type: deliverable.deliverable_type,
            format: deliverable.format,
            contentLength: deliverable.content.length,
            createdByAgent: deliverable.created_by_agent || 'Unknown'
          });
        }
      } catch (delError) {
        console.error('❌ Could not fetch deliverable details:', delError.message);
      }
    } else {
      console.log('\n❌ PROBLEM: No deliverable was auto-created');
      
      if (result.response) {
        console.log('📝 Content preview:');
        console.log(result.response.substring(0, 500) + '...');
      }
    }

    await app.close();
    return result;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

testBlogPostAgent()
  .then(() => console.log('\n✅ Direct test completed'))
  .catch(() => console.log('\n❌ Direct test failed'));