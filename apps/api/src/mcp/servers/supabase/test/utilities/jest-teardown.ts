/**
 * Jest Global Teardown for Supabase MCP Tests
 * 
 * Handles final cleanup after all test suites complete.
 */

import { getTestSetup } from './test-setup';

export default async (): Promise<void> => {
  try {
    const testSetup = getTestSetup();
    await testSetup.cleanup();
    console.log('Global test teardown completed successfully');
  } catch (error) {
    console.error('Error during global test teardown:', error);
    // Don't throw to avoid affecting test results
  }
};