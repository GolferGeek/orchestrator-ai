const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  try {
    console.log('🔍 Checking users table for golfergeek@gmail.com...');
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, roles, created_at')
      .eq('email', 'golfergeek@gmail.com')
      .single();

    if (error) {
      console.error('❌ Error querying user:', error);
      return;
    }

    if (!data) {
      console.log('❌ User golfergeek@gmail.com not found in users table');
      
      // Check if testuser exists instead
      console.log('🔍 Checking for testuser@golfergeek.com...');
      const { data: testUser, error: testError } = await supabase
        .from('users')
        .select('id, email, roles, created_at')
        .eq('email', 'testuser@golfergeek.com')
        .single();
        
      if (testError) {
        console.error('❌ Error querying testuser:', testError);
      } else if (testUser) {
        console.log('✅ Found testuser:', testUser);
      } else {
        console.log('❌ Neither user found');
      }
      return;
    }

    console.log('✅ User found:', data);
    console.log('📋 Roles:', data.roles);
    console.log('🔑 Has admin role:', data.roles?.includes('admin'));
    
    // Test authentication endpoint
    console.log('\n🔍 Testing auth endpoint...');
    const authResponse = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'golfergeek@gmail.com',
        password: 'your-password-here' // You'll need to replace this
      })
    });
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Auth test successful, token length:', authData.accessToken?.length || 0);
      
      // Test /auth/me endpoint
      const meResponse = await fetch('http://localhost:4000/auth/me', {
        headers: {
          'Authorization': `Bearer ${authData.accessToken}`
        }
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('✅ /auth/me successful:', userData);
      } else {
        console.log('❌ /auth/me failed:', await meResponse.text());
      }
    } else {
      console.log('❌ Auth test failed:', await authResponse.text());
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkUser();