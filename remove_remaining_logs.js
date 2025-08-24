#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to process a single file and remove remaining log statements
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let lines = content.split('\n');
    let newLines = [];
    let i = 0;
    let removedCount = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for console.log statements with emojis or specific patterns
      if (trimmedLine.match(/^console\.log\s*\(\s*['"`]🔍/) ||
          trimmedLine.match(/^console\.log\s*\(\s*['"`]🚨/) ||
          trimmedLine.match(/^console\.log\s*\(\s*['"`]\[ModelsService\]/) ||
          trimmedLine.match(/^console\.log\s*\(\s*`\[ModelsService\]/)) {
        
        // Found start of console.log statement, now find the end
        let logLines = [line];
        let openParens = (line.match(/\(/g) || []).length;
        let closeParens = (line.match(/\)/g) || []).length;
        let j = i + 1;
        
        // Continue until we find the matching closing parenthesis
        while (j < lines.length && openParens > closeParens) {
          logLines.push(lines[j]);
          openParens += (lines[j].match(/\(/g) || []).length;
          closeParens += (lines[j].match(/\)/g) || []).length;
          j++;
        }
        
        // Skip all the log lines
        console.log(`🗑️  Removing console.log from ${filePath}:${i + 1}-${j}`);
        console.log(`    ${logLines[0].trim()}${logLines.length > 1 ? ' ...' : ''}`);
        removedCount++;
        i = j;
        continue;
      }
      
      // Keep non-log lines
      newLines.push(line);
      i++;
    }
    
    // Join lines back together
    content = newLines.join('\n');
    
    // Clean up multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Removed ${removedCount} console.log statements from: ${filePath}`);
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
console.log('🧹 Removing remaining console.log statements from API codebase...');
console.log(`📁 Scanning directory: ${apiDir}`);

const tsFiles = findTSFiles(apiDir);
console.log(`📄 Found ${tsFiles.length} TypeScript files to process`);

let processedCount = 0;
for (const file of tsFiles) {
  if (processFile(file)) {
    processedCount++;
  }
}

console.log(`\n🎉 Completed! Processed ${processedCount} files with console.log statements removed.`);
console.log(`📊 Total files scanned: ${tsFiles.length}`);
console.log(`✨ Your API codebase is now completely clean!`);
