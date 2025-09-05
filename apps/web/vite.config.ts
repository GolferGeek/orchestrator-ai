/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * Get HTTPS configuration for Vite dev server
 */
function getHttpsConfig(env: Record<string, string>) {
  // Only use HTTPS if explicitly enabled
  if (env.VITE_ENFORCE_HTTPS !== 'true') {
    return false;
  }

  const certPath = path.resolve(__dirname, 'certs', 'localhost-cert.pem');
  const keyPath = path.resolve(__dirname, 'certs', 'localhost-key.pem');

  // Check if certificates exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.warn('⚠️  HTTPS enabled but certificates not found!');
    console.warn('   Run: node scripts/setup-https-dev.js');
    console.warn('   Falling back to HTTP...');
    return false;
  }

  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } catch (error) {
    console.error('❌ Failed to read SSL certificates:', error.message);
    console.warn('   Falling back to HTTP...');
    return false;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from project root (two levels up from apps/web)
  const env = loadEnv(mode, '../../', 'VITE_')
  
  // Debug: Log environment variables during build
  console.log('🔧 Vite Environment Variables:')
  console.log('VITE_API_BASE_URL:', env.VITE_API_BASE_URL)
  console.log('VITE_API_NESTJS_BASE_URL:', env.VITE_API_NESTJS_BASE_URL)
  

  
  // Set HMR environment variables based on mode
  if (mode === 'production') {
    process.env.VITE_HMR_HOST = 'app.orchestratorai.io'
    process.env.VITE_HMR_PORT = '443'
    process.env.VITE_HMR_PROTOCOL = 'wss'
  } else {
    process.env.VITE_HMR_HOST = 'localhost'
    process.env.VITE_HMR_PORT = '9001'
    process.env.VITE_HMR_PROTOCOL = 'ws'
  }
  
  return {
    plugins: [
      vue(),
      legacy(),
      // Add bundle analyzer for performance optimization
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap'
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: parseInt(env.WEB_PORT || (env.VITE_ENFORCE_HTTPS === 'true' ? '9443' : '9001')),
      host: true,
      https: getHttpsConfig(env),
      hmr: {
        // Server binds to localhost (this is what Vite can actually bind to)
        host: 'localhost',
        port: parseInt(env.WEB_PORT || (env.VITE_ENFORCE_HTTPS === 'true' ? '9443' : '9001')),
        protocol: env.VITE_ENFORCE_HTTPS === 'true' ? 'wss' : 'ws'
      }
    },
    build: {
      sourcemap: true,
      // CSS optimization
      cssCodeSplit: true,
      cssMinify: true,
      // Asset optimization
      assetsInlineLimit: 4096, // Inline assets smaller than 4KB
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            'vue-vendor': ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity'],
            'ionic-vendor': ['@ionic/vue', '@ionic/vue-router'],
            'chart-vendor': ['chart.js'],
            'pinia-vendor': ['pinia'],
            'router-vendor': ['vue-router'],
            'axios-vendor': ['axios'],
            
            // Store chunks for better organization
            'stores-auth': ['./src/stores/authStore.ts'],
            'stores-agent': ['./src/stores/agentChatStore/store.ts', './src/stores/agentChatStore/conversation.ts'],
            'stores-pii': ['./src/stores/piiPatternsStore.ts', './src/stores/pseudonymDictionariesStore.ts', './src/stores/pseudonymMappingsStore.ts'],
            'stores-analytics': ['./src/stores/analyticsStore.ts', './src/stores/llmUsageStore.ts', './src/stores/privacyDashboardStore.ts'],
            
            // Service chunks
            'services-api': ['./src/services/piiService.ts', './src/services/llmUsageService.ts', './src/services/sanitizationAnalyticsService.ts'],
            'services-utils': ['./src/services/projectsService.ts', './src/services/pseudonymService.ts']
          }
        }
      },
      chunkSizeWarningLimit: 1000, // Increase warning limit temporarily
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
