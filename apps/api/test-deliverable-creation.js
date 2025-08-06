const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabaseUrl = 'https://jcmkjecmdugfzvdijodg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWtqZWNtZHVnZnp2ZGlqb2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1ODg4ODQsImV4cCI6MjA2MzE2NDg4NH0.9KqoILWR-8PIMIQ7p0tCPyFEW5XAwz2OHXtachOqsc4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function signInAndTest() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'testuser@golfergeek.com',
      password: 'testuser01!'
    });
    
    if (error) {
      console.log('❌ Login failed:', error.message);
      return;
    }
    
    console.log('✅ Login successful');
    console.log('🔑 Access token:', data.session.access_token.substring(0, 50) + '...');
    
    // First test the deliverables endpoint
    console.log('🧪 Testing deliverables endpoint...');
    const deliverablesResponse = await fetch('http://localhost:4000/deliverables', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.session.access_token}`
      }
    });
    
    if (deliverablesResponse.ok) {
      const deliverables = await deliverablesResponse.json();
      console.log('✅ Deliverables endpoint working. Found:', deliverables.items?.length || 0, 'deliverables');
    } else {
      console.log('❌ Deliverables endpoint failed:', deliverablesResponse.status);
    }
    
    // Now test calling a simple agent first (HR assistant) 
    console.log('🧪 Testing HR assistant agent...');
    const hrResponse = await fetch('http://localhost:4000/agents/hr/hr_assistant/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        method: 'executeTask',
        prompt: 'Hello, can you help me with onboarding information?',
        userId: data.user.id
        // conversationId: null // Let's try without conversationId first
      })
    });
    
    if (hrResponse.ok) {
      const hrResult = await hrResponse.json();
      console.log('✅ HR Agent call successful');
      console.log('📊 HR Result:', JSON.stringify(hrResult, null, 2).substring(0, 300) + '...');
    } else {
      console.log('❌ HR Agent call failed:', hrResponse.status, hrResponse.statusText);
      const hrErrorText = await hrResponse.text();
      console.log('HR Error details:', hrErrorText);
    }
    
    // Now test calling the content agent
    console.log('🧪 Testing content agent...');
    const response = await fetch('http://localhost:4000/agents/marketing/content/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        method: 'executeTask',
        prompt: 'Write a comprehensive blog post about AI automation trends in 2025. Include an introduction, 3 main sections, and a conclusion.',
        userId: data.user.id
        // conversationId: null // Let's try without conversationId first
      })
    });
    
    if (!response.ok) {
      console.log('❌ Content Agent call failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Content Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Content Agent call successful');
    console.log('📊 Result preview:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
    
    // Check if deliverable was created
    if (result.deliverableId) {
      console.log('🎉 Deliverable created with ID:', result.deliverableId);
    } else {
      console.log('ℹ️  No deliverable ID in response');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

signInAndTest();