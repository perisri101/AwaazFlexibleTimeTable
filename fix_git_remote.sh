#!/bin/bash

# Get the GitHub token from environment variable
TOKEN=$GITHUB_TOKEN

# Check if token exists
if [ -z "$TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set"
  exit 1
fi

# Update the remote URL to include the token and point to your fork
git remote set-url origin https://${TOKEN}@github.com/YOUR_USERNAME/AwaazFlexyTimeTable.git

# Verify the change (will show URL with token masked)
echo "Remote URL updated. Verifying:"
git remote -v

echo "Ready to push now!" 