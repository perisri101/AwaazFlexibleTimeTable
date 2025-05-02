import os
import subprocess

# Run the fix_git_remote.sh script
try:
    # First make it executable
    subprocess.run(['chmod', '+x', 'fix_git_remote.sh'], check=True)
    
    # Then run it
    result = subprocess.run(['./fix_git_remote.sh'], 
                           capture_output=True, 
                           text=True,
                           check=True)
    print("Git remote URL updated successfully:")
    print(result.stdout)
    
    # Fetch the remote repository
    subprocess.run(['git', 'fetch', 'origin'], check=True)
    
    # Check if we're in detached HEAD state and fix it
    head_status = subprocess.run(['git', 'status'], capture_output=True, text=True)
    if "HEAD detached" in head_status.stdout:
        # Checkout the master branch (or create it if it doesn't exist locally)
        try:
            # Try to checkout existing master branch
            subprocess.run(['git', 'checkout', 'master'], check=True)
        except subprocess.CalledProcessError:
            # If that fails, create a new master branch tracking origin/master
            subprocess.run(['git', 'checkout', '-b', 'master', 'origin/master'], check=True)
    
    print("Git branch setup complete")
    
except Exception as e:
    print(f"Error in Git setup: {e}")

# Continue with your normal application startup
# For example, if you have an app.py file:
# exec(open('app.py').read()) 