const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./apps/api/dist/src/app.module');

async function testBlogPostResponseStructure() {
  console.log('🔍 Testing blog post service response structure...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const blogPostService = app.get('BlogPostService');
    
    console.log('✅ Blog Post Service found:', !!blogPostService);
    
    // Test the blog post service greeting to understand its base behavior
    const greetingResult = await blogPostService.executeTask('executeTask', {
      prompt: 'Hello',
      userId: 'test-user',
      conversationId: 'test-conv'
    });
    
    console.log(`\n🤝 GREETING RESPONSE STRUCTURE:`);
    console.log(`   Success: ${greetingResult.success}`);
    console.log(`   Keys: ${Object.keys(greetingResult)}`);
    console.log(`   Response type: ${typeof greetingResult.response}`);
    console.log(`   Response: ${greetingResult.response}`);
    console.log(`   Has metadata: ${!!greetingResult.metadata}`);
    if (greetingResult.metadata) {
      console.log(`   Metadata keys: ${Object.keys(greetingResult.metadata)}`);
      console.log(`   Agent name: ${greetingResult.metadata.agentName}`);
      console.log(`   Agent type: ${greetingResult.metadata.agentType}`);
    }
    console.log(`   Has deliverable_id: ${!!(greetingResult.deliverableId || greetingResult.metadata?.deliverable_id)}`);
    
    // Check if the BlogPost service uses the A2A base pattern that includes deliverable auto-creation
    console.log(`\n🔍 CHECKING DELIVERABLE CREATION CAPABILITY:`);
    console.log(`   Service class name: ${blogPostService.constructor.name}`);
    console.log(`   Has deliverablesService: ${!!blogPostService.deliverablesService}`);
    console.log(`   Has persistDeliverableIfPresent method: ${typeof blogPostService.persistDeliverableIfPresent === 'function'}`);
    console.log(`   Has completeTask method: ${typeof blogPostService.completeTask === 'function'}`);
    
    // Look at the inheritance chain
    console.log(`\n🔍 INHERITANCE CHAIN:`);
    let proto = Object.getPrototypeOf(blogPostService);
    let level = 0;
    while (proto && proto.constructor.name !== 'Object' && level < 5) {
      console.log(`   Level ${level}: ${proto.constructor.name}`);
      if (proto.constructor.name.includes('A2A')) {
        console.log(`     - Has persistDeliverableIfPresent: ${typeof proto.persistDeliverableIfPresent === 'function'}`);
        console.log(`     - Has completeTask: ${typeof proto.completeTask === 'function'}`);
        console.log(`     - Has isDeliverableContent: ${typeof proto.isDeliverableContent === 'function'}`);
      }
      proto = Object.getPrototypeOf(proto);
      level++;
    }
    
    await app.close();
    
    console.log(`\n📝 ANALYSIS:`);
    console.log(`   The blog post service returns a standard context agent response.`);
    console.log(`   For deliverable creation to work, either:`);
    console.log(`   1. The backend needs to automatically create deliverables (if A2A base has auto-persist)`);
    console.log(`   2. The frontend needs to detect and create deliverables (current approach)`);
    console.log(`   \n   Let's check if the backend auto-deliverable creation is working...`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testBlogPostResponseStructure();