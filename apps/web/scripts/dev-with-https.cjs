#!/usr/bin/env node

/**
 * Smart Development Server Launcher
 * Automatically sets up HTTPS certificates if needed and starts Vite
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CERTS_DIR = path.join(__dirname, '..', 'certs');
const KEY_FILE = path.join(CERTS_DIR, 'localhost-key.pem');
const CERT_FILE = path.join(CERTS_DIR, 'localhost-cert.pem');

console.log('🚀 Starting development server...\n');

// Check if HTTPS should be enabled
const forceHttps = process.env.VITE_ENFORCE_HTTPS === 'true';
const httpsPreferred = process.env.VITE_PREFER_HTTPS === 'true' || forceHttps;

if (httpsPreferred) {
  console.log('🔒 HTTPS mode requested');
  
  // Check if certificates exist and are valid
  const needsCertificates = !fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE);
  
  if (needsCertificates) {
    console.log('📝 Setting up HTTPS certificates (one-time setup)...');
    try {
      execSync('node scripts/setup-https-dev.cjs', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ HTTPS certificates ready!\n');
    } catch (error) {
      console.error('❌ Failed to setup HTTPS certificates:', error.message);
      if (forceHttps) {
        console.error('   HTTPS is required but certificate setup failed. Exiting...');
        process.exit(1);
      } else {
        console.warn('   Falling back to HTTP mode...\n');
      }
    }
  } else {
    console.log('✅ HTTPS certificates found\n');
  }
}

// Prepare environment variables
const env = { ...process.env };
if (httpsPreferred && fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
  env.VITE_ENFORCE_HTTPS = 'true';
  console.log('🌐 Starting Vite with HTTPS on https://localhost:9443');
} else {
  console.log('🌐 Starting Vite with HTTP on http://localhost:9001');
}

// Start Vite development server
const viteProcess = spawn('npx', ['vite'], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..')
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  viteProcess.kill('SIGTERM');
});

viteProcess.on('close', (code) => {
  process.exit(code);
});
