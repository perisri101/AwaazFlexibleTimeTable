#!/bin/bash

echo "Setting up Git configuration..."

# Check if we're in a detached HEAD state
if [ "$(git rev-parse --abbrev-ref HEAD)" == "HEAD" ]; then
    echo "Detected detached HEAD state, checking out main branch..."
    git checkout main 2>/dev/null || git checkout -b main
fi

# Configure Git credentials
echo "Configuring Git credentials..."
git config --global credential.helper store
echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials

# Set Git identity
echo "Setting Git identity..."
git config --global user.name "${GIT_USER_NAME:-perisri101}"
git config --global user.email "${GIT_USER_EMAIL:-perisri101@gmail.com}"

# Configure remote
echo "Configuring Git remote..."
git remote set-url origin "https://github.com/perisri101/AwaazFlexibleTimeTable.git"

# Set upstream branch
echo "Setting upstream branch..."
git branch --set-upstream-to=origin/main main 2>/dev/null || echo "Could not set upstream (this is normal for new repos)"

echo "Git setup complete!" 