async function testAdminEndpoint() {
  console.log('🔍 Testing admin analytics endpoint...');
  
  // Fresh login
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
  console.log('✅ Login successful');
  
  // Test /auth/me to confirm roles
  const meResponse = await fetch('http://localhost:4000/auth/me', {
    headers: { 'Authorization': `Bearer ${authData.accessToken}` }
  });
  
  if (meResponse.ok) {
    const user = await meResponse.json();
    console.log('👤 User data:', user);
    console.log('🔑 Has admin role:', user.roles?.includes('admin'));
  }
  
  // Test admin analytics endpoint
  const analyticsResponse = await fetch('http://localhost:4000/evaluation/admin/analytics/overview', {
    headers: { 'Authorization': `Bearer ${authData.accessToken}` }
  });
  
  console.log('📊 Analytics status:', analyticsResponse.status);
  
  if (analyticsResponse.ok) {
    const data = await analyticsResponse.json();
    console.log('✅ Analytics data:', data);
  } else {
    const error = await analyticsResponse.text();
    console.log('❌ Analytics error:', error);
  }
}

testAdminEndpoint();