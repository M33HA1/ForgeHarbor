# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /app

# Update pip first and install build dependencies
RUN pip install --upgrade pip && \
    apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install dependencies
COPY requirements.txt .

# Install Python dependencies with longer timeout
RUN pip install --no-cache-dir --timeout=300 -r requirements.txt

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 8085

# Command to run the application
CMD ["python", "main.py"]