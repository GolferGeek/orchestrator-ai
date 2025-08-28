/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode - try project root first, then current directory
  const env = loadEnv(mode, '../../', '') || loadEnv(mode, '.', '') || {}
  

  
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
      https: false, // Keep HTTP for now, let Cloudflare handle HTTPS
      hmr: {
        // Server binds to localhost (this is what Vite can actually bind to)
        host: 'localhost',
        port: 9001,
        protocol: 'ws'
      }
    },
    build: {
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
