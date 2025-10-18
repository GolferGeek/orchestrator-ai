// Test Setup - Global configuration for all tests
import { beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Configure environment for testing - disable HTTPS enforcement
// Set process.env which Vite will use
process.env.VITE_ENFORCE_HTTPS = 'false';
process.env.NODE_ENV = 'test';

// Global test setup
beforeEach(() => {
  // Create a fresh Pinia instance for each test
  const pinia = createPinia();
  setActivePinia(pinia);
});

afterEach(() => {
  // Clean up after each test
  setActivePinia(undefined as unknown);
});

// Mock console methods to reduce noise in tests (optional)
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Suppress known warnings in tests
  console.warn = (message: string, ...args: unknown[]) => {
    if (
      message.includes('Failed to resolve component') ||
      message.includes('[Vue warn]') ||
      message.includes('Pinia')
    ) {
      return;
    }
    originalConsoleWarn(message, ...args);
  };

  console.error = (message: string, ...args: unknown[]) => {
    if (
      message.includes('Failed to resolve component') ||
      message.includes('[Vue warn]') ||
      message.includes('Pinia')
    ) {
      return;
    }
    originalConsoleError(message, ...args);
  };
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Global test configuration
export const TEST_CONFIG = {
  API_TIMEOUT: 10000,
  MOCK_ENABLED: false, // We're using real API
  BASE_URL: 'http://localhost:3001', // Adjust based on your API
};

// Helper functions for tests
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const expectEventually = async (
  assertion: () => void | Promise<void>,
  timeout = 5000,
  interval = 100
) => {
  const start = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - start < timeout) {
    try {
      await assertion();
      return; // Success!
    } catch (error) {
      lastError = error as Error;
      await waitFor(interval);
    }
  }

  throw lastError || new Error('Assertion timed out');
};

