# Dockerfile for Python FastAPI v2 Application

# Use an official Python runtime as a parent image (consider aligning with v1 or choosing a newer version like 3.10 or 3.11)
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
# This will likely include dependencies for the shared v2 components as well.
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container at /app
# This includes the FastAPI v2 specific code and potentially a way to include/reference
# the shared generated Python code from `../../shared/v2/generated/python/`
# Depending on monorepo setup, this step might need adjustment (e.g., copying specific workspaces or built artifacts)
COPY . /app/

# Make port 80 available to the world outside this container
# Replace 80 with the port your FastAPI v2 app runs on (e.g., 8001 or a configured port)
EXPOSE 80

# Define environment variable (if needed)
# ENV MODULE_NAME app.main

# Run the FastAPI v2 application
# Replace main:app with your actual FastAPI application instance
# Example: CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
CMD ["echo", "Replace with uvicorn command for FastAPI v2 app"] 