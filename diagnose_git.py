#!/usr/bin/env python3
import os
import subprocess
import sys
import json
from datetime import datetime

def print_section(title):
    """Print a section title."""
    print("\n" + "="*80)
    print(f" {title}")
    print("="*80)

def run_command(cmd, check=False, show_command=True, capture_error=True):
    """Run a command and return the result."""
    if show_command:
        print(f"\n$ {' '.join(cmd)}")
    
    try:
        if capture_error:
            result = subprocess.run(cmd, capture_output=True, text=True, check=check)
        else:
            result = subprocess.run(cmd, stdout=subprocess.PIPE, text=True, check=check)
        
        if result.stdout:
            print(result.stdout)
        if capture_error and result.stderr:
            print(f"ERROR: {result.stderr}")
        return result
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}")
        if e.stdout:
            print(e.stdout)
        if capture_error and e.stderr:
            print(f"ERROR: {e.stderr}")
        return e
    except Exception as e:
        print(f"Exception: {e}")
        return None

def check_environment():
    """Check environment variables."""
    print_section("Environment Variables")
    
    # Git-related environment variables
    env_vars = {
        "GIT_USER_NAME": os.environ.get("GIT_USER_NAME", "Not set"),
        "GIT_USER_EMAIL": os.environ.get("GIT_USER_EMAIL", "Not set"),
        "GIT_AUTO_PUSH": os.environ.get("GIT_AUTO_PUSH", "Not set"),
        "GIT_REMOTE": os.environ.get("GIT_REMOTE", "Not set"),
        "GIT_BRANCH": os.environ.get("GIT_BRANCH", "Not set"),
        "GIT_REPOSITORY_URL": os.environ.get("GIT_REPOSITORY_URL", "Not set"),
        "GITHUB_TOKEN": "Set" if os.environ.get("GITHUB_TOKEN") else "Not set",
        "SSH_PRIVATE_KEY": "Set" if os.environ.get("SSH_PRIVATE_KEY") else "Not set",
        "FLASK_ENV": os.environ.get("FLASK_ENV", "Not set"),
        "RENDER_EXTERNAL_URL": os.environ.get("RENDER_EXTERNAL_URL", "Not set"),
        "RENDER_SERVICE_ID": os.environ.get("RENDER_SERVICE_ID", "Not set"),
        "ALLOW_GIT_IN_PRODUCTION": os.environ.get("ALLOW_GIT_IN_PRODUCTION", "Not set")
    }
    
    # Print environment variables
    for var, value in env_vars.items():
        if var == "GITHUB_TOKEN":
            masked = value[:4] + "..." + value[-4:] if len(value) > 8 else "***"
            print(f"{var}: {masked}")
        else:
            print(f"{var}: {value}")
    
    # Provide recommendations for missing variables
    missing_vars = []
    if env_vars["GIT_USER_NAME"] == "Not set":
        missing_vars.append("GIT_USER_NAME (recommended: 'AwaazFlexyTimeTable App')")
    
    if env_vars["GIT_USER_EMAIL"] == "Not set":
        missing_vars.append("GIT_USER_EMAIL (recommended: 'app@awaazflexytimetable.onrender.com')")
    
    if env_vars["GITHUB_TOKEN"] == "Not set":
        missing_vars.append("GITHUB_TOKEN (required for Git push operations)")
    
    if env_vars["GIT_REPOSITORY_URL"] == "Not set":
        missing_vars.append("GIT_REPOSITORY_URL (recommended: 'https://github.com/perisri101/AwaazFlexyTimeTable.git')")
    
    if missing_vars:
        print("\nRecommended environment variables that are missing:")
        for var in missing_vars:
            print(f"- {var}")
        print("\nThese variables should be set in your Render environment.")
    
    return env_vars

def check_git_installation():
    """Check Git installation."""
    print_section("Git Installation")
    
    # Check Git version
    result = run_command(["git", "--version"])
    
    if result is None or result.returncode != 0:
        print("❌ Git is not installed or not available in PATH")
        return False
    
    # Check Git configuration
    run_command(["git", "config", "--list"])
    
    return True

def check_git_repo():
    """Check if current directory is a Git repository."""
    print_section("Git Repository")
    
    # Check if .git directory exists
    if os.path.isdir(".git"):
        print("✅ .git directory exists")
    else:
        print("❌ .git directory not found - this is not a Git repository")
        print("Attempting to initialize a new repository...")
        run_command(["git", "init"])
        return False
    
    # Check Git status
    run_command(["git", "status"])
    
    # Check remotes
    result = run_command(["git", "remote", "-v"])
    
    # Check for origin remote
    if not result or "origin" not in result.stdout:
        print("❌ No 'origin' remote found")
        repo_url = os.environ.get("GIT_REPOSITORY_URL")
        if repo_url:
            print(f"Setting up remote with GIT_REPOSITORY_URL: {repo_url}")
            run_command(["git", "remote", "add", "origin", repo_url])
        else:
            print("❌ GIT_REPOSITORY_URL not set, cannot add remote")
            return False
    else:
        print("✅ 'origin' remote exists")
    
    return True

def check_git_access():
    """Check access to Git remote repository."""
    print_section("Git Remote Access")
    
    # Get current remote URL
    result = run_command(["git", "config", "--get", "remote.origin.url"], show_command=False)
    remote_url = result.stdout.strip() if result and result.stdout else None
    
    if not remote_url:
        print("❌ No remote URL configured")
        return False
    
    print(remote_url)
    print(f"Remote URL: {remote_url}")
    
    # Try to list remote branches
    print("\nAttempting to list remote branches:")
    result = run_command(["git", "ls-remote", "--heads", "origin"])
    
    if result.returncode != 0:
        print("❌ Failed to access remote repository")
        
        # Check if this is an authentication issue
        if "Authentication failed" in result.stderr or "could not read Username" in result.stderr:
            print("\n🔑 Authentication issue detected:")
            print("- Make sure the GITHUB_TOKEN environment variable is set")
            print("- Token needs 'Contents: Read and write' permission for the repository")
            return False
    else:
        print("✅ Successfully accessed remote repository")
    
    return result.returncode == 0

def check_token_auth():
    """Quick test for GitHub token authentication."""
    print_section("GitHub Token Authentication Test")
    
    github_token = os.environ.get("GITHUB_TOKEN")
    
    if not github_token:
        print("❌ GITHUB_TOKEN is not set in environment variables")
        print("You must add the GITHUB_TOKEN to your Render environment.")
        print("See render_environment_setup.md for instructions.")
        return False
    
    # Test if token length is reasonable (tokens are usually >30 chars)
    if len(github_token) < 30:
        print("⚠️ Warning: GITHUB_TOKEN seems too short to be valid")
        print(f"Token length: {len(github_token)} characters")
    else:
        print("✅ GITHUB_TOKEN is set and has a reasonable length")
    
    repo_url = os.environ.get("GIT_REPOSITORY_URL", "https://github.com/perisri101/AwaazFlexyTimeTable.git")
    
    # Verify the repository exists by making a direct API call
    print("\nVerifying repository access via GitHub API...")
    
    # Extract owner and repo from the URL
    parts = repo_url.replace("https://github.com/", "").replace(".git", "").split("/")
    if len(parts) >= 2:
        owner, repo = parts[0], parts[1]
        
        cmd = [
            "curl", "-s", 
            "-H", f"Authorization: token {github_token}",
            f"https://api.github.com/repos/{owner}/{repo}"
        ]
        
        result = run_command(cmd, show_command=False)
        
        if result and result.returncode == 0:
            if "Not Found" in result.stdout or "Bad credentials" in result.stdout:
                print("❌ Repository access test failed")
                print("Your token does not have access to this repository")
                return False
            else:
                try:
                    data = json.loads(result.stdout)
                    if "id" in data:
                        print(f"✅ Successfully accessed repository: {data.get('full_name', repo_url)}")
                        return True
                except:
                    pass
        
        print("❌ Failed to verify repository access")
        return False
    else:
        print("❌ Could not parse repository URL")
        return False

def fix_remote_url():
    """Try to fix the remote URL using the GITHUB_TOKEN."""
    print_section("Fixing Remote URL")
    
    github_token = os.environ.get("GITHUB_TOKEN")
    repo_url = os.environ.get("GIT_REPOSITORY_URL")
    
    if not github_token:
        print("❌ GITHUB_TOKEN environment variable not set")
        print("Please set the GITHUB_TOKEN environment variable in your Render dashboard")
        print("Instructions: See render_environment_setup.md for details on creating and setting up a token")
        return False
    
    if not repo_url:
        print("❌ GIT_REPOSITORY_URL environment variable not set")
        print("Using default repository URL: https://github.com/perisri101/AwaazFlexyTimeTable.git")
        repo_url = "https://github.com/perisri101/AwaazFlexyTimeTable.git"
    
    # Get current remote URL
    result = run_command(["git", "config", "--get", "remote.origin.url"], show_command=False)
    current_url = result.stdout.strip() if result and result.stdout else None
    
    if current_url:
        print(f"Current remote URL: {current_url}")
    else:
        print("No remote URL configured, setting it now...")
        run_command(["git", "remote", "add", "origin", repo_url])
        print(f"Added remote origin: {repo_url}")
    
    # Update the URL to include the token for GitHub HTTPS URLs
    if repo_url.startswith("https://github.com/"):
        # Create URL with token
        new_url = f"https://{github_token}@github.com/{repo_url.split('github.com/')[1]}"
        run_command(["git", "remote", "set-url", "origin", new_url])
        print("✅ Updated remote URL to use GitHub token for authentication")
        
        # Verify URL includes token (without showing the token in output)
        result = run_command(["git", "remote", "-v"], show_command=False)
        if result and github_token in result.stdout:
            print("✅ Verified remote URL contains GitHub token")
        else:
            print("⚠️ Remote URL does not appear to include the GitHub token")
        
        return True
    else:
        print("❌ Repository URL is not a GitHub HTTPS URL, cannot fix")
        return False

def fix_detached_head():
    """Fix detached HEAD state by creating or checking out master branch."""
    print_section("Fixing Detached HEAD State")
    
    # Check current HEAD state
    result = run_command(["git", "rev-parse", "--abbrev-ref", "HEAD"], show_command=False)
    current_branch = result.stdout.strip() if result and result.stdout else None
    
    if current_branch == "HEAD":
        print("Detected detached HEAD state")
        
        # Try to check out master branch
        checkout_result = run_command(["git", "checkout", "master"], check=False)
        
        if checkout_result.returncode != 0:
            print("Master branch does not exist, creating it...")
            
            # Create and check out a new master branch
            run_command(["git", "checkout", "-b", "master"])
            print("✅ Created and checked out new master branch")
        else:
            print("✅ Successfully checked out master branch")
        
        return True
    else:
        print(f"Current branch: {current_branch}")
        print("✅ Not in detached HEAD state, no fix needed")
        return False

def fix_git_identity():
    """Fix Git identity issues by setting user name and email."""
    print_section("Fixing Git Identity")
    
    # Check if Git user name is set
    name_result = run_command(["git", "config", "user.name"], show_command=False)
    email_result = run_command(["git", "config", "user.email"], show_command=False)
    
    identity_fixed = False
    
    # Fix Git user name if not set
    if not name_result or not name_result.stdout.strip():
        # Use environment variable or default
        git_user_name = os.environ.get("GIT_USER_NAME", "AwaazFlexyTimeTable App")
        run_command(["git", "config", "--global", "user.name", git_user_name])
        print(f"✅ Set Git user.name to: {git_user_name}")
        identity_fixed = True
    else:
        print(f"Git user.name already set: {name_result.stdout.strip()}")
    
    # Fix Git user email if not set
    if not email_result or not email_result.stdout.strip():
        # Use environment variable or default
        git_user_email = os.environ.get("GIT_USER_EMAIL", "app@awaazflexytimetable.onrender.com")
        run_command(["git", "config", "--global", "user.email", git_user_email])
        print(f"✅ Set Git user.email to: {git_user_email}")
        identity_fixed = True
    else:
        print(f"Git user.email already set: {email_result.stdout.strip()}")
    
    # Test if identity is now working
    run_command(["git", "config", "--list"])
    
    # Try with a simple test commit
    print("\nTesting Git identity with test commit:")
    with open(".git_identity_test", "w") as f:
        f.write(f"Git identity test\n{datetime.now().isoformat()}\n")
    
    add_result = run_command(["git", "add", ".git_identity_test"], show_command=False)
    commit_test = run_command(["git", "commit", "--dry-run", "-m", "Testing Git identity"], check=False)
    
    # Clean up test file regardless of outcome
    os.remove(".git_identity_test")
    run_command(["git", "reset", "HEAD", ".git_identity_test"], show_command=False)
    
    if commit_test.returncode == 0:
        print("✅ Git identity is working correctly")
    else:
        print("❌ Git identity is still not configured correctly")
        print("Please ensure GIT_USER_NAME and GIT_USER_EMAIL are set in your environment")
    
    return identity_fixed

def check_push_access():
    """Check if we can push to the remote repository."""
    print_section("Git Push Access Test")
    
    # Create a test file
    test_file = f"git_test_{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
    with open(test_file, "w") as f:
        f.write(f"Git diagnostic test\n")
        f.write(f"Created at: {datetime.now().isoformat()}\n")
        f.write(f"Environment: {os.environ.get('FLASK_ENV', 'unknown')}\n")
        f.write(f"Host: {os.environ.get('RENDER_EXTERNAL_URL', 'unknown')}\n")
    
    print(f"Created test file: {test_file}")
    
    # Add and commit
    run_command(["git", "add", test_file])
    commit_result = run_command(["git", "commit", "-m", f"Diagnostic test commit at {datetime.now().isoformat()}"])
    
    if commit_result.returncode != 0:
        print("❌ Failed to commit test file")
        return False
    
    # Try to push
    print("\nAttempting to push:")
    auto_push = os.environ.get("GIT_AUTO_PUSH", "").lower() == "true"
    
    if auto_push:
        push_result = run_command(["git", "push", "origin", "master"], check=False)
        
        if push_result.returncode != 0:
            print("❌ Push failed")
            
            # Provide helpful message based on error
            if "could not read Username" in push_result.stderr:
                print("\n🔑 Authentication issue detected:")
                print("- The GITHUB_TOKEN environment variable is likely missing")
                print("- Follow the instructions in render_environment_setup.md to set up a token")
            
            elif "Authentication failed" in push_result.stderr:
                print("\n🔑 Authentication failed:")
                print("- Your GitHub token may be invalid or expired")
                print("- The token may not have sufficient permissions")
                print("- Create a new token with 'Contents: Read and write' permission")
            
            elif "Permission denied" in push_result.stderr:
                print("\n🔑 Permission denied:")
                print("- Your GitHub token doesn't have permission to push to this repository")
                print("- Make sure the token is configured with access to this specific repository")
            
            elif "Repository not found" in push_result.stderr:
                print("\n❌ Repository not found:")
                print("- The repository URL may be incorrect")
                print("- The repository may not exist or may be private")
                print("- Your GitHub token may not have access to this repository")
            
            return False
        else:
            print("✅ Push successful")
            return True
    else:
        print("Auto-push is disabled, skipping push test")
        print("To enable auto-push, set GIT_AUTO_PUSH=true in your environment variables")
        return None

def run_quick_fixes():
    """Run quick fixes for common Git issues."""
    print_section("Quick Fixes")
    
    fixes_applied = []
    
    # Check if Git is installed
    if check_git_installation():
        fixes_applied.append("Git installation verified")
    else:
        print("❌ Git installation issues cannot be automatically fixed")
        return False
    
    # Fix Git identity issues
    if fix_git_identity():
        fixes_applied.append("Fixed Git identity")
    
    # Check and fix Git repository
    if not os.path.isdir(".git"):
        print("Initializing Git repository")
        run_command(["git", "init"])
        fixes_applied.append("Initialized Git repository")
    
    # Check and fix remote URL
    if fix_remote_url():
        fixes_applied.append("Fixed remote URL")
    
    # Check and fix detached HEAD state
    if fix_detached_head():
        fixes_applied.append("Fixed detached HEAD state")
    
    print("\nFixes applied:")
    for fix in fixes_applied:
        print(f"- {fix}")
    
    return len(fixes_applied) > 0

def create_summary(results):
    """Create a summary of the diagnostic results."""
    print_section("Diagnostic Summary")
    
    for key, value in results.items():
        if value is True:
            status = "✅"
        elif value is False:
            status = "❌"
        else:
            status = "⚠️"
        print(f"{status} {key}")
    
    # Overall assessment
    if all(v for v in results.values() if v is not None):
        print("\n✅ All checks passed! Git is configured correctly.")
    else:
        print("\n⚠️ Some checks failed. Please review the output above for issues.")
        
        # Add recommendations based on failed checks
        if results.get("GitHub Token Auth") is False:
            print("\n🔑 GitHub Token Authentication Issue:")
            print("1. Set up a GitHub personal access token")
            print("2. Add the token to your environment variables as GITHUB_TOKEN")
            print("3. Follow the instructions in render_environment_setup.md")
        
        elif results.get("Git Push Access") is False:
            print("\nRecommended action for push failure:")
            print("1. Set up a GitHub personal access token")
            print("2. Add the token to your environment variables as GITHUB_TOKEN")
            print("3. Set GIT_AUTO_PUSH=true in your environment variables")
            print("4. Run this diagnostic script again")
            print("\nFor detailed instructions, see the render_environment_setup.md file.")

def test_git_connection():
    # Check if GITHUB_TOKEN is set
    token = os.environ.get("GITHUB_TOKEN")
    repo_url = os.environ.get("GIT_REPOSITORY_URL")
    
    if not token:
        print("\n=== GitHub Token Test ===")
        print("GITHUB_TOKEN is not set. Authentication may fail.")
        return
    
    if not repo_url:
        print("\n=== Repository URL Test ===")
        print("GIT_REPOSITORY_URL is not set. Using current remote.")
    
    # Test connection with ls-remote
    print("\n=== Testing Git Connection ===")
    
    # Construct the URL with token if available
    if token and repo_url:
        # Extract the domain and path
        if repo_url.startswith("https://"):
            parts = repo_url.split("//")
            test_url = f"{parts[0]}//{token}@{parts[1]}"
        else:
            test_url = repo_url
    else:
        test_url = None
    
    if test_url:
        cmd = ["git", "ls-remote", test_url]
        # Don't print the actual command as it contains the token
        print("Running: git ls-remote [REPOSITORY_URL with token]")
    else:
        cmd = ["git", "ls-remote", "origin"]
        print("Running: git ls-remote origin")
    
    try:
        result = subprocess.run(cmd, check=False, capture_output=True, text=True)
        print(f"Exit code: {result.returncode}")
        if result.returncode == 0:
            print("Connection successful!")
            print(f"Found {len(result.stdout.splitlines())} refs")
        else:
            print("Connection failed!")
            print(result.stderr)
    except Exception as e:
        print(f"Error testing connection: {e}")

def fix_git_config():
    print("\n=== Fixing Git Configuration ===")
    
    # Set user name and email if provided in environment
    user_name = os.environ.get("GIT_USER_NAME")
    user_email = os.environ.get("GIT_USER_EMAIL")
    
    if user_name:
        run_command(["git", "config", "--global", "user.name", user_name], 
                   f"Setting git user.name to {user_name}")
    
    if user_email:
        run_command(["git", "config", "--global", "user.email", user_email], 
                   f"Setting git user.email to {user_email}")
    
    # Set up repository URL if provided
    repo_url = os.environ.get("GIT_REPOSITORY_URL")
    if repo_url:
        # Check if origin remote exists
        result = run_command(["git", "remote"], "Checking remotes")
        if "origin" in result.stdout:
            run_command(["git", "remote", "set-url", "origin", repo_url], 
                       f"Updating origin remote to {repo_url}")
        else:
            run_command(["git", "remote", "add", "origin", repo_url], 
                       f"Adding origin remote with {repo_url}")
    
    # Test if we can push with the token
    token = os.environ.get("GITHUB_TOKEN")
    if token and repo_url:
        # Modify the URL to include the token for this test
        if repo_url.startswith("https://"):
            parts = repo_url.split("//")
            token_url = f"{parts[0]}//{token}@{parts[1]}"
            
            # Set a credential helper to store the token
            run_command(["git", "config", "--global", "credential.helper", "store"], 
                       "Setting credential helper to store")
            
            # Create a test file
            with open(".git-credentials", "w") as f:
                f.write(f"https://{token}:x-oauth-basic@github.com\n")
            
            run_command(["git", "config", "--global", "credential.helper", "store"], 
                       "Storing credentials")

def main():
    """Run the diagnostic checks."""
    print_section("Git Diagnostics")
    print(f"Date/Time: {datetime.now().isoformat()}")
    print(f"Working Directory: {os.getcwd()}")
    
    results = {}
    
    # Check environment
    env_vars = check_environment()
    
    # Quick check for GitHub token - if missing, do this first
    results["GitHub Token Auth"] = check_token_auth()
    
    if not results["GitHub Token Auth"]:
        print("\n❌ GitHub token authentication failed. This is the most critical issue to fix.")
        print("Please configure your GitHub token before proceeding with other diagnostics.")
        print("Follow the instructions in render_environment_setup.md")
        
        # Create a simple summary and exit
        create_summary({"GitHub Token Auth": False})
        return 1
    
    # Check Git installation
    results["Git Installation"] = check_git_installation()
    
    # If Git is not installed, we can't proceed
    if not results["Git Installation"]:
        print("❌ Git is not installed or not working properly")
        print("Please install Git before continuing")
        create_summary(results)
        return 1
    
    # Fix Git identity issues
    fix_git_identity()
    
    # Check Git repository
    results["Git Repository"] = check_git_repo()
    
    # Check if fixes should be attempted
    should_fix = (not results["Git Repository"] or 
                 env_vars["GITHUB_TOKEN"] == "Not set" or 
                 env_vars["GIT_USER_NAME"] == "Not set")
    
    # Run quick fixes if needed
    if should_fix:
        print("\n⚠️ Issues detected that may require fixes")
        results["Quick Fixes"] = run_quick_fixes()
    
    # Check Git access
    results["Git Remote Access"] = check_git_access()
    
    # If access check failed and GITHUB_TOKEN is set, try to fix the remote URL
    if not results["Git Remote Access"] and os.environ.get("GITHUB_TOKEN"):
        results["Fix Remote URL"] = fix_remote_url()
        
        # Check access again after fixing
        if results.get("Fix Remote URL", False):
            print("\nRechecking remote access after fix:")
            results["Git Remote Access (After Fix)"] = check_git_access()
    
    # Check push access
    results["Git Push Access"] = check_push_access()
    
    # Test Git connection
    test_git_connection()
    
    # Fix Git configuration if needed
    fix_git_config()
    
    # Create summary
    create_summary(results)
    
    # Return non-zero exit code if any check failed
    return 0 if all(v for v in results.values() if v is not None) else 1

if __name__ == "__main__":
    sys.exit(main()) 