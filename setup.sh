#!/bin/bash

echo "Setting up AwaazFlexibleTimeTable..."

# Check Python version
python_version=$(python3 --version)
echo "Using $python_version"

# Create and activate virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install flask python-dotenv werkzeug gunicorn

echo "Setup complete! Run 'source venv/bin/activate' to activate the environment." 