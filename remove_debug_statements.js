#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Remove ALL DEBUG logger statements (standalone lines and multi-line)
    // Match this.logger.debug, this.functionLogger.debug, this.pythonLogger.debug, etc.
    content = content.replace(/^[ \t]*this\.\w*[Ll]ogger\.debug\([^)]*\);?\s*$/gm, '');
    
    // Handle multi-line debug statements that span multiple lines
    content = content.replace(/^[ \t]*this\.\w*[Ll]ogger\.debug\(\s*[\s\S]*?\);?\s*$/gm, '');
    
    // Handle Logger.debug static calls
    content = content.replace(/^[ \t]*Logger\.debug\([^;]*\);?\s*$/gm, '');
    
    // Handle standalone logger.debug calls
    content = content.replace(/^[ \t]*logger\.debug\([^;]*\);?\s*$/gm, '');
    
    // Clean up multiple empty lines that may have been left behind
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned DEBUG statements from: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find TypeScript files
function findTSFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, and other build directories
      if (!['node_modules', 'dist', '.git', '.venv', '__pycache__'].includes(item)) {
        files.push(...findTSFiles(fullPath));
      }
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const apiDir = './apps/api/src';
console.log('🧹 Removing all DEBUG logger statements from API codebase...');
console.log(`📁 Scanning directory: ${apiDir}`);

const tsFiles = findTSFiles(apiDir);
console.log(`📄 Found ${tsFiles.length} TypeScript files to process`);

let processedCount = 0;
for (const file of tsFiles) {
  if (processFile(file)) {
    processedCount++;
  }
}

console.log(`\n🎉 Completed! Processed ${processedCount} files with DEBUG statements removed.`);
console.log(`📊 Total files scanned: ${tsFiles.length}`);
console.log(`✨ Your API codebase is now clean and ready for fresh debugging!`);
