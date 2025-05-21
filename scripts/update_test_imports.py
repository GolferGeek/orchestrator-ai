import re
from pathlib import Path

# Path to the API V1 directory
API_V1_DIR = Path("apps/api-v1")
TEST_FILES = list(API_V1_DIR.glob("tests/integration/agents/**/test_*.py"))

# Pattern to match the old PROJECT_ROOT and context file path
OLD_PATTERN = re.compile(
    r'^(PROJECT_ROOT\s*=\s*Path\(__file__\)\.resolve\(\)\.parents\[\d+\]\s*#.*?\n)'
    r'([A-Z_]+_CONTEXT_FILE_PATH\s*=\s*PROJECT_ROOT\s*/\s*["\']markdown_context["\']\s*/\s*[A-Z_]+_CONTEXT_FILE\s*\n)',
    re.MULTILINE
)

# Replacement pattern
REPLACEMENT = '''# Import test helper for getting context file paths
from tests.test_helpers import get_test_context_path

# Get the path to the context file
\2'''

def update_test_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    new_content = OLD_PATTERN.sub(REPLACEMENT, content)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Updated: {file_path}")
    else:
        print(f"No changes needed: {file_path}")

if __name__ == "__main__":
    for test_file in TEST_FILES:
        update_test_file(test_file)
