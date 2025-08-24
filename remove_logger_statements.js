#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Remove logger statements with various patterns
    // this.logger.debug(...), this.logger.log(...), etc.
    content = content.replace(/\s*this\.logger\.(debug|log|warn|error|verbose)\([^;]*\);?\s*\n?/g, '');
    
    // Logger.debug(...), Logger.log(...), etc. (static calls)
    content = content.replace(/\s*Logger\.(debug|log|warn|error|verbose)\([^;]*\);?\s*\n?/g, '');
    
    // Remove standalone logger variable calls like logger.debug(...)
    content = content.replace(/\s*logger\.(debug|log|warn|error|verbose)\([^;]*\);?\s*\n?/g, '');
    
    // Remove console.error, console.warn, console.debug, console.info (but keep console.log as we handled that separately)
    content = content.replace(/\s*console\.(error|warn|debug|info|trace)\([^;]*\);?\s*\n?/g, '');
    
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

// Function to recursively find TypeScript files
function findTypeScriptFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry)) {
        findTypeScriptFiles(fullPath, files);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const apiDir = path.join(__dirname, 'apps', 'api', 'src');

if (!fs.existsSync(apiDir)) {
  console.error('API source directory not found:', apiDir);
  process.exit(1);
}

console.log('Finding TypeScript/JavaScript files in API...');
const files = findTypeScriptFiles(apiDir);
console.log(`Found ${files.length} files to process`);

let processedCount = 0;
for (const file of files) {
  if (processFile(file)) {
    processedCount++;
  }
}

console.log(`\nProcessed ${processedCount} files with logger statements removed.`);
