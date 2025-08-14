/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode - try project root first, then current directory
  const env = loadEnv(mode, '../../', '') || loadEnv(mode, '.', '') || {}
  
  // Determine if we're in production or local development
  const isProduction = mode === 'production' || env.NODE_ENV === 'production'
  const isLocalDev = !isProduction
  
  return {
    plugins: [
      vue(),
      legacy()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: parseInt(env.WEB_PORT || '9001'),
      host: true,
      https: false, // Temporarily disable HTTPS
      hmr: {
        // Configure HMR to work for both local and external access
        host: 'localhost',
        port: 9001,
        protocol: 'ws'
      }
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
