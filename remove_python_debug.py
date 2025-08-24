#!/usr/bin/env python3

import os
import re
import sys

def process_file(file_path):
    """Remove DEBUG print statements from a Python file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Remove DEBUG print statements (various patterns)
        patterns = [
            r'^\s*print\s*\(\s*f?"?DEBUG:.*?\)\s*$',
            r'^\s*print\s*\(\s*f?"?MAIN_DEBUG:.*?\)\s*$',
            r'^\s*print\s*\(\s*f?"DEBUG \[.*?\].*?\)\s*$',
        ]
        
        lines_removed = 0
        for pattern in patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            lines_removed += len(matches)
            content = re.sub(pattern, '', content, flags=re.MULTILINE)
        
        # Clean up multiple empty lines
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Removed {lines_removed} DEBUG statements from: {file_path}")
            return True
        
        return False
    
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def find_python_files(directory):
    """Find all Python files in the directory."""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # Skip certain directories
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', '.venv', 'node_modules']]
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    return python_files

def main():
    api_dir = './apps/api/src'
    print('🧹 Removing DEBUG print statements from Python files...')
    print(f'📁 Scanning directory: {api_dir}')
    
    python_files = find_python_files(api_dir)
    print(f'📄 Found {len(python_files)} Python files to process')
    
    processed_count = 0
    for file_path in python_files:
        if process_file(file_path):
            processed_count += 1
    
    print(f'\n🎉 Completed! Processed {processed_count} Python files with DEBUG statements removed.')
    print(f'📊 Total Python files scanned: {len(python_files)}')
    print('✨ Your Python code is now clean!')

if __name__ == '__main__':
    main()
