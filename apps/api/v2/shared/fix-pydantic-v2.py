#!/usr/bin/env python3
"""
Fix Pydantic v2 compatibility issues in generated Python contract files.

This script updates the generated Python files to use Pydantic v2 syntax:
- Replace __root__ with RootModel[T]
- Replace regex= with pattern=
- Add RootModel import
"""

import re
import os
from pathlib import Path

def fix_pydantic_v2_file(file_path: Path):
    """Fix Pydantic v2 compatibility issues in a single file."""
    print(f"Fixing {file_path}")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Add RootModel to imports if needed
    if '__root__:' in content and 'RootModel' not in content:
        # Find the pydantic import line and add RootModel
        content = re.sub(
            r'from pydantic import ([^)]+)\n',
            lambda m: f"from pydantic import {m.group(1).rstrip()}, RootModel\n",
            content
        )
    
    # Replace __root__ patterns with RootModel - more precise pattern
    # Pattern: class ClassName(BaseModel):\n    __root__: Type = Field(...)
    content = re.sub(
        r'class (\w+)\(BaseModel\):\s*\n\s*__root__:\s*([^=\s]+)\s*=\s*Field\(',
        r'class \1(RootModel[\2]):\n    root: \2 = Field(',
        content
    )
    
    # Replace regex= with pattern= in constr()
    content = re.sub(r'constr\([^)]*regex=', lambda m: m.group(0).replace('regex=', 'pattern='), content)
    
    # Fix any remaining standalone __root__ references
    content = re.sub(r'__root__:', 'root:', content)
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"  ✅ Fixed {file_path}")
    else:
        print(f"  ⏭️  No changes needed for {file_path}")

def main():
    """Fix all generated Python files."""
    script_dir = Path(__file__).parent
    generated_dir = script_dir / "contracts" / "generated" / "python"
    
    if not generated_dir.exists():
        print(f"❌ Generated directory not found: {generated_dir}")
        return 1
    
    python_files = list(generated_dir.glob("*.py"))
    if not python_files:
        print(f"❌ No Python files found in {generated_dir}")
        return 1
    
    print(f"🔧 Fixing Pydantic v2 compatibility in {len(python_files)} files...")
    
    for py_file in python_files:
        if py_file.name != "__init__.py":  # Skip __init__.py
            fix_pydantic_v2_file(py_file)
    
    print("✅ All files processed!")
    return 0

if __name__ == "__main__":
    exit(main()) 