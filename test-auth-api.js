const https = require('https');
const http = require('http');

// Test the auth/me endpoint with different scenarios
async function testAuthEndpoints() {
  console.log('🔍 Testing Auth API Endpoints...\n');
  
  // Test 1: /auth/me without token (should get 401)
  console.log('1. Testing /auth/me without token:');
  try {
    const response = await fetch('http://localhost:4000/auth/me');
    const data = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${data}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 2: Login with testuser (from .env)
  console.log('2. Testing login with testuser@golfergeek.com:');
  try {
    const loginResponse = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testuser@golfergeek.com',
        password: 'testuser01!'
      })
    });
    
    console.log(`   Status: ${loginResponse.status}`);
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log(`   Login successful! Token received: ${!!loginData.accessToken}`);
      
      // Test 3: /auth/me with valid token
      console.log('\n3. Testing /auth/me with valid token:');
      const meResponse = await fetch('http://localhost:4000/auth/me', {
        headers: {
          'Authorization': `Bearer ${loginData.accessToken}`
        }
      });
      
      console.log(`   Status: ${meResponse.status}`);
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log(`   User data:`, JSON.stringify(userData, null, 2));
        console.log(`   Has roles: ${!!userData.roles}`);
        console.log(`   Is admin: ${userData.roles?.includes('admin')}`);
      } else {
        const errorData = await meResponse.text();
        console.log(`   Error: ${errorData}`);
      }
    } else {
      const loginError = await loginResponse.text();
      console.log(`   Login failed: ${loginError}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n🔍 API Test Complete');
}

testAuthEndpoints();