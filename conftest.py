# conftest.py at the project root

# import pytest_mock # Try importing directly to check availability - REMOVED

# pytest-mock should be auto-discovered if installed in the environment
# used by `pdm run pytest` from the root.
# pytest_plugins = [
#     "pytest_mock",
# ]

# Explicitly load pytest-mock to ensure the 'mocker' fixture is available globally.
# This is necessary when pytest-mock is a dependency of a workspace package (e.g., apps/api)
# and tests are run from the monorepo root.
# pytest_plugins = [
#     "pytest_mock",
#     # pytest_asyncio is often auto-detected but can be added here if issues persist.
#     # "pytest_asyncio", 
# ] 