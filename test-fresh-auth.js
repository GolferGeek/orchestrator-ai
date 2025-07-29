async function testFreshAuth() {
  console.log('🔍 Testing fresh authentication...');
  
  // Fresh login to get new token
  const loginResponse = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testuser@golfergeek.com',
      password: 'testuser01!'
    })
  });
  
  if (!loginResponse.ok) {
    console.log('❌ Login failed:', await loginResponse.text());
    return;
  }
  
  const authData = await loginResponse.json();
  console.log('✅ Fresh login successful');
  
  // Test /auth/me with fresh token
  const meResponse = await fetch('http://localhost:4000/auth/me', {
    headers: { 'Authorization': `Bearer ${authData.accessToken}` }
  });
  
  if (meResponse.ok) {
    const userData = await meResponse.json();
    console.log('✅ Fresh /auth/me result:', userData);
    console.log('🎉 Admin access:', userData.roles?.includes('admin'));
  } else {
    console.log('❌ /auth/me failed:', await meResponse.text());
  }
}

testFreshAuth();