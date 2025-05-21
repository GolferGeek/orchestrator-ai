from setuptools import setup, find_packages

setup(
    name="orchestrator-ai",
    version="0.1.0",
    packages=find_packages(include=['apps*']),
    install_requires=[
        # Dependencies will be installed from the pyproject.toml
    ],
    python_requires='>=3.13',
)
