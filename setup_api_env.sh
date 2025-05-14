#!/bin/bash
# Script to set up the Python environment for the Orchestrator AI API using PDM

echo "--- Orchestrator AI API Environment Setup ---"

# Function to check if a command exists
command_exists () {
    command -v "$1" &> /dev/null ;
}

# Ensure we are in the script's directory (project root)
cd "$(dirname "$0")" || exit 1
PROJECT_ROOT=$(pwd)
API_DIR="${PROJECT_ROOT}/apps/api"

# Check for PDM
echo "[INFO] Checking for PDM..."
if command_exists pdm; then
    echo "[INFO] PDM is already installed."
    PDM_CMD="pdm"
elif command_exists python3 && python3 -m pdm --version &> /dev/null; then
    echo "[INFO] PDM is accessible via 'python3 -m pdm'."
    PDM_CMD="python3 -m pdm"
elif command_exists python && python -m pdm --version &> /dev/null; then
    echo "[INFO] PDM is accessible via 'python -m pdm'."
    PDM_CMD="python -m pdm"
else
    echo "[WARNING] PDM command not found. Attempting to install PDM for the current user..."
    if command_exists python3; then
        python3 -m pip install --user pdm
    elif command_exists python; then
        python -m pip install --user pdm
    else
        echo "[ERROR] Python (python3 or python) not found. Cannot install PDM. Please install Python."
        exit 1
    fi

    # Try to find PDM again after installation
    if command_exists pdm; then
        PDM_CMD="pdm"
    elif command_exists python3 && python3 -m pdm --version &> /dev/null; then
        PDM_CMD="python3 -m pdm"
    elif command_exists python && python -m pdm --version &> /dev/null; then
        PDM_CMD="python -m pdm"
    else
        echo "[ERROR] PDM installation failed or PDM is not in your PATH."
        echo "Please ensure PDM is installed and accessible."
        echo "You might need to add the user script directory (e.g., ~/.local/bin or Python's Scripts dir) to your PATH."
        echo "Common user script path on macOS/Linux for Python 3.13: /Users/golfergeek/Library/Python/3.13/bin"
        exit 1
    fi
    echo "[INFO] PDM installed. You might need to restart your shell or add its location to your PATH to use 'pdm' directly."
fi

echo "[INFO] Using '$PDM_CMD' for PDM commands."

# Navigate to the API directory
echo "[INFO] Navigating to ${API_DIR}..."
cd "${API_DIR}" || { echo "[ERROR] Failed to navigate to ${API_DIR}."; exit 1; }

# Check if pyproject.toml already exists
if [ -f "pyproject.toml" ]; then
    echo "[INFO] pyproject.toml already exists."
else
    echo "[INFO] Initializing PDM project (creating pyproject.toml)..."
    # --non-interactive might not select the desired Python interpreter if multiple are available
    # It's often better to let the user confirm or specify, but for automation:
    # We'll assume the current Python environment is the desired one.
    # PDM usually picks up the active virtual environment's Python or the first `python3` found.
    $PDM_CMD init --non-interactive
    if [ $? -ne 0 ]; then
        echo "[ERROR] 'pdm init' failed."
        exit 1
    fi
    echo "[INFO] PDM project initialized."
fi

# The pyproject.toml is now the single source of truth for dependencies.
# The pdm import step is no longer needed.

echo "[INFO] Generating/updating PDM lockfile (pdm.lock) from pyproject.toml..."
$PDM_CMD lock
if [ $? -ne 0 ]; then
    echo "[ERROR] 'pdm lock' failed."
    exit 1
fi
echo "[INFO] Lockfile updated."

echo "[INFO] Syncing dependencies using PDM (this will use pdm.lock and pyproject.toml)..."
PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 $PDM_CMD sync --no-editable
if [ $? -ne 0 ]; then
    echo "[ERROR] 'pdm sync' failed."
    exit 1
fi

echo "[INFO] API environment setup complete with PDM!"
echo "[INFO] A .venv directory should now exist in ${API_DIR}."
echo "[INFO] To activate the environment, run 'source .venv/bin/activate' or 'pdm shell' from the '${API_DIR}' directory." 