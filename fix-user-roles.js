const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUserRoles() {
  try {
    console.log('🔧 Fixing user roles...\n');
    
    // 1. Update testuser to have admin roles
    console.log('1. Adding admin roles to testuser@golfergeek.com...');
    const { data: testUserUpdate, error: testError } = await supabase
      .from('users')
      .update({ 
        roles: ['user', 'admin', 'evaluation-monitor'] 
      })
      .eq('email', 'testuser@golfergeek.com')
      .select();

    if (testError) {
      console.error('❌ Error updating testuser:', testError);
    } else {
      console.log('✅ Testuser updated:', testUserUpdate);
    }

    // 2. Check if golfergeek@gmail.com exists
    console.log('\n2. Checking for golfergeek@gmail.com...');
    const { data: golferUser, error: golferError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'golfergeek@gmail.com')
      .single();

    if (golferError && golferError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking golfergeek user:', golferError);
    } else if (golferUser) {
      console.log('✅ Found golfergeek user:', golferUser);
      
      // Update golfergeek user to have admin roles if needed
      if (!golferUser.roles || !golferUser.roles.includes('admin')) {
        console.log('3. Adding admin roles to golfergeek@gmail.com...');
        const { data: golferUpdate, error: updateError } = await supabase
          .from('users')
          .update({ 
            roles: ['user', 'admin', 'evaluation-monitor'] 
          })
          .eq('email', 'golfergeek@gmail.com')
          .select();
        
        if (updateError) {
          console.error('❌ Error updating golfergeek user:', updateError);
        } else {
          console.log('✅ Golfergeek user updated:', golferUpdate);
        }
      } else {
        console.log('✅ Golfergeek user already has admin roles');
      }
    } else {
      console.log('❌ golfergeek@gmail.com not found in users table');
      console.log('💡 You may need to sign up this user first, or use testuser@golfergeek.com');
    }

    // 3. Test authentication again
    console.log('\n4. Testing updated authentication...');
    const authResponse = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testuser@golfergeek.com',
        password: 'testuser01!'
      })
    });
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      
      const meResponse = await fetch('http://localhost:4000/auth/me', {
        headers: {
          'Authorization': `Bearer ${authData.accessToken}`
        }
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('✅ Updated user data:', userData);
        console.log('🎉 Admin access granted:', userData.roles?.includes('admin'));
      }
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

fixUserRoles();