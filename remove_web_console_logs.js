#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Remove standalone console.log/warn/error/debug/info statements
    content = content.replace(/^\s*console\.(log|warn|error|debug|info|trace)\([^;]*\);\s*$/gm, '');
    
    // Remove empty lines that may have been left behind
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Processed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find files
function findWebFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry)) {
        findWebFiles(fullPath, files);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js') || fullPath.endsWith('.vue')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const webDir = path.join(__dirname, 'apps', 'web', 'src');

if (!fs.existsSync(webDir)) {
  console.error('Web source directory not found:', webDir);
  process.exit(1);
}

console.log('Finding web files (TS/JS/Vue) in web app...');
const files = findWebFiles(webDir);
console.log(`Found ${files.length} files to process`);

let processedCount = 0;
for (const file of files) {
  if (processFile(file)) {
    processedCount++;
  }
}

console.log(`\nProcessed ${processedCount} files with console statements removed.`);
