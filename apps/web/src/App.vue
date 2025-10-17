<template>
  <ion-app>
    <!-- Main application content -->
    <ErrorBoundary 
      :show-details="isDevelopment"
      :max-retries="3"
      @error="onGlobalError"
      @retry="onErrorRetry"
      @report="onErrorReport"
    >
      <ion-router-outlet id="main-content"></ion-router-outlet>
    </ErrorBoundary>
    
    <!-- Global error notifications -->
    <GlobalErrorNotification />
    
    <!-- User-friendly error boundary -->
    <GlobalErrorBoundary />
  </ion-app>
</template>
<script lang="ts" setup>
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import ErrorBoundary from '@/components/common/ErrorBoundary.vue';
import GlobalErrorNotification from '@/components/common/GlobalErrorNotification.vue';
import GlobalErrorBoundary from '@/components/ErrorHandling/GlobalErrorBoundary.vue';
import { useGlobalErrorHandler } from '@/composables/useGlobalErrorHandler';

// Environment check
const isDevelopment = import.meta.env.DEV;

// Set up global error handling
const {
  errorStore,
  handleVueError,
  getErrorSummary,
  testErrorHandling 
} = useGlobalErrorHandler();

type ErrorBoundaryInfo = Record<string, unknown>;

interface ErrorDebugContext {
  store: typeof errorStore;
  handler: { handleVueError: typeof handleVueError };
  summary: typeof getErrorSummary;
  test: typeof testErrorHandling;
}

// Global error event handlers
const onGlobalError = (error: Error, _errorInfo: ErrorBoundaryInfo) => {
  console.log('🚨 App-level error captured:', error);
  
  // Error is already handled by ErrorBoundary and added to store
  // This is just for additional app-level logic if needed
};

const onErrorRetry = (attempt: number) => {
  console.log(`🔄 App-level retry attempt ${attempt}`);
  
  // You could add app-level retry logic here
  // For example, clearing caches, refreshing auth tokens, etc.
};

const onErrorReport = (error: Error, _errorInfo: ErrorBoundaryInfo) => {
  console.log('🐛 App-level error report requested:', error);
  
  // Additional reporting logic could go here
  // For example, showing a feedback form, etc.
};

// Set up global Vue error handler
onMounted(() => {
  // Log initial error summary
  console.log('📊 Initial error summary:', getErrorSummary());

  // Test error handling in development
  if (isDevelopment && import.meta.env.VITE_TEST_ERRORS === 'true') {
    console.log('🧪 Testing error handling in 5 seconds...');
    setTimeout(() => {
      testErrorHandling();
    }, 5000);
  }
});

// Expose error handling for debugging
if (isDevelopment) {
  (window as Window & { errorDebug?: ErrorDebugContext }).errorDebug = {
    store: errorStore,
    handler: { handleVueError },
    summary: getErrorSummary,
    test: testErrorHandling
  };
}
</script>
<style>
@import '@/styles/landing.css';
@import '@/styles/components.css';
@import '@/styles/animations.css';
</style>
