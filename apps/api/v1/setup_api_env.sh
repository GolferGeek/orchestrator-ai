#!/bin/bash
# Script to set up the Python environment for THIS API version using PDM.
# This script should be located INSIDE a versioned API directory (e.g., apps/api/v1/).

echo "--- API Environment Setup for $(basename "$(pwd)") ---"

# Function to check if a command exists
command_exists () {
    command -v "$1" &> /dev/null ;
}

# Ensure we are in the script's directory (e.g., apps/api/v1 or apps/api/v2)
# This is important if the script is called from elsewhere, e.g. "apps/api/v1/setup_api_env.sh"
cd "$(dirname "$0")" || exit 1
API_VERSION_DIR=$(pwd)

echo "[INFO] Operating in directory: ${API_VERSION_DIR}"

# Check for PDM
echo "[INFO] Checking for PDM..."
PDM_CMD=""
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
        USER_SCRIPTS_PATH=""
        if command_exists python3; then
            USER_SCRIPTS_PATH=$(python3 -m site --user-base)"/bin"
        elif command_exists python; then
            USER_SCRIPTS_PATH=$(python -m site --user-base)"/bin"
        fi
        if [ -n "$USER_SCRIPTS_PATH" ] && [ -d "$USER_SCRIPTS_PATH" ]; then
             echo "You might need to add '${USER_SCRIPTS_PATH}' to your PATH."
        else
             echo "You might need to add the user script directory (e.g., ~/.local/bin or Python's Scripts dir) to your PATH."
        fi
        exit 1
    fi
    echo "[INFO] PDM installed. You might need to restart your shell or add its location to your PATH to use 'pdm' directly."
fi

echo "[INFO] Using '$PDM_CMD' for PDM commands."

# Check if pyproject.toml exists in the current directory
if [ ! -f "pyproject.toml" ]; then
    echo "[ERROR] pyproject.toml not found in $(pwd)."
    echo "[INFO] This script expects to be in a directory with a PDM project (pyproject.toml)."
    exit 1
fi
echo "[INFO] Found pyproject.toml in $(pwd)."

echo "[INFO] Generating/updating PDM lockfile (pdm.lock) from pyproject.toml in $(pwd)..."
$PDM_CMD lock 
if [ $? -ne 0 ]; then
    echo "[ERROR] '$PDM_CMD lock' failed in $(pwd)."
    exit 1
fi
echo "[INFO] Lockfile updated in $(pwd)."

echo "[INFO] Syncing dependencies using PDM (this will use pdm.lock and pyproject.toml) in $(pwd)..."
# Consider if PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 is needed for your specific dependencies
$PDM_CMD sync --no-editable
if [ $? -ne 0 ]; then
    echo "[ERROR] '$PDM_CMD sync' failed in $(pwd)."
    exit 1
fi

echo "[INFO] API environment setup complete for $(basename "$(pwd)")!"
echo "[INFO] A .venv directory should now exist in $(pwd) if PDM created one (depends on PDM config and if 'pdm venv create' was used)."
echo "[INFO] To activate the environment, run 'source .venv/bin/activate' (if it exists) or '$PDM_CMD shell' from the '$(pwd)' directory." 