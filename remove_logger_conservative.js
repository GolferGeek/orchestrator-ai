#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // More conservative patterns that only match complete statements
    // Remove this.logger.debug/log/warn/error statements (standalone lines)
    content = content.replace(/^\s*this\.logger\.(debug|log|warn|error|verbose)\([^;]*\);\s*$/gm, '');
    
    // Remove Logger.debug/log/warn/error statements (standalone lines)
    content = content.replace(/^\s*Logger\.(debug|log|warn|error|verbose)\([^;]*\);\s*$/gm, '');
    
    // Remove logger.debug/log/warn/error statements (standalone lines)
    content = content.replace(/^\s*logger\.(debug|log|warn|error|verbose)\([^;]*\);\s*$/gm, '');
    
    // Remove console.error/warn/debug/info statements (standalone lines)
    content = content.replace(/^\s*console\.(error|warn|debug|info|trace)\([^;]*\);\s*$/gm, '');
    
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
