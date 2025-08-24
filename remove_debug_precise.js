#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file and remove debug statements
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let lines = content.split('\n');
    let newLines = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check if this line starts a debug statement
      if (trimmedLine.match(/^this\.\w*[Ll]ogger\.debug\s*\(/)) {
        // Found start of debug statement, now find the end
        let debugLines = [line];
        let openParens = (line.match(/\(/g) || []).length;
        let closeParens = (line.match(/\)/g) || []).length;
        let j = i + 1;
        
        // Continue until we find the matching closing parenthesis
        while (j < lines.length && openParens > closeParens) {
          debugLines.push(lines[j]);
          openParens += (lines[j].match(/\(/g) || []).length;
          closeParens += (lines[j].match(/\)/g) || []).length;
          j++;
        }
        
        // Skip all the debug lines
        console.log(`🗑️  Removing debug statement from ${filePath}:${i + 1}-${j}`);
        console.log(`    ${debugLines[0].trim()}${debugLines.length > 1 ? ' ...' : ''}`);
        i = j;
        continue;
      }
      
      // Keep non-debug lines
      newLines.push(line);
      i++;
    }
    
    // Join lines back together
    content = newLines.join('\n');
    
    // Clean up multiple empty lines
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
