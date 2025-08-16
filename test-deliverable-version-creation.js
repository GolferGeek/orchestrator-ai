const axios = require('axios');

/**
 * Test script to debug deliverable version creation
 * This script will help identify where the save process is failing
 */

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:9000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'testuser@golfergeek.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testuser01!';

async function testDeliverableVersionCreation() {
  console.log('🧪 Starting deliverable version creation test...\n');

  try {
    // Step 1: Authenticate
    console.log('🔐 Step 1: Authenticating...');
    console.log('Auth URL:', `${API_BASE_URL}/auth/login`);
    console.log('Auth credentials:', { email: TEST_EMAIL, password: '[REDACTED]' });
    
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    console.log('Auth response status:', authResponse.status);
    console.log('Auth response data:', authResponse.data);

    if (!authResponse.data.access_token) {
      throw new Error('No access token received from authentication');
    }

    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful');

    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Step 2: Create a test deliverable first
    console.log('\n📝 Step 2: Creating a test deliverable...');
    const testDeliverable = {
      title: 'Test Deliverable for Version Creation',
      content: '# Test Content\n\nThis is a test deliverable for version creation testing.',
      type: 'document',
      format: 'markdown',
      created_by_agent: 'test-script'
    };

    const createResponse = await apiClient.post('/deliverables', testDeliverable);
    const parentDeliverable = createResponse.data;
    
    console.log('✅ Test deliverable created:', {
      id: parentDeliverable.id,
      title: parentDeliverable.title,
      version: parentDeliverable.version
    });

    // Step 3: Create a new version
    console.log('\n🔄 Step 3: Creating a new version...');
    const versionData = {
      title: 'Test Deliverable for Version Creation - Version 2',
      content: '# Test Content - Updated\n\nThis is the updated content for version 2 of the test deliverable.\n\n## New Section\n\nAdded some new content to test version creation.',
      created_by_agent: 'test-script'
    };

    console.log('📤 Sending version creation request with data:', versionData);

    const versionResponse = await apiClient.post(`/deliverables/${parentDeliverable.id}/versions`, versionData);
    const newVersion = versionResponse.data;

    console.log('✅ New version created successfully:', {
      id: newVersion.id,
      title: newVersion.title,
      version: newVersion.version,
      is_latest_version: newVersion.is_latest_version,
      parent_deliverable_id: newVersion.parent_deliverable_id
    });

    // Step 4: Verify the version was saved by fetching it
    console.log('\n🔍 Step 4: Verifying version was saved...');
    const fetchResponse = await apiClient.get(`/deliverables/${newVersion.id}`);
    const fetchedVersion = fetchResponse.data;

    console.log('✅ Version successfully fetched from database:', {
      id: fetchedVersion.id,
      title: fetchedVersion.title,
      version: fetchedVersion.version,
      is_latest_version: fetchedVersion.is_latest_version
    });

    // Step 5: Get version history
    console.log('\n📚 Step 5: Getting version history...');
    const historyResponse = await apiClient.get(`/deliverables/${parentDeliverable.id}/versions`);
    const versions = historyResponse.data;

    console.log('✅ Version history retrieved:', versions.map(v => ({
      id: v.id,
      title: v.title,
      version: v.version,
      is_latest_version: v.is_latest_version
    })));

    // Step 6: Clean up - delete the test deliverable
    console.log('\n🧹 Step 6: Cleaning up test data...');
    await apiClient.delete(`/deliverables/${parentDeliverable.id}`);
    console.log('✅ Test deliverable deleted');

    console.log('\n🎉 All tests passed! Deliverable version creation is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response data',
      config: error.config ? {
        method: error.config.method,
        url: error.config.url,
        data: error.config.data
      } : 'No config data'
    });
  }
}

// Run the test
testDeliverableVersionCreation().catch(console.error);