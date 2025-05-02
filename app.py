import os
from flask import Flask, render_template, request, redirect, url_for, jsonify
from werkzeug.utils import secure_filename
import json
from datetime import datetime
import shutil
import subprocess
from dotenv import load_dotenv
import sys

# Load environment variables from .env file if it exists
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'images', 'caregivers')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['GIT_AUTO_PUSH'] = os.environ.get('GIT_AUTO_PUSH', 'false').lower() == 'true'
app.config['GIT_REMOTE'] = os.environ.get('GIT_REMOTE', 'origin')
app.config['GIT_BRANCH'] = os.environ.get('GIT_BRANCH', 'master')
app.config['ENVIRONMENT'] = os.environ.get('FLASK_ENV', 'production')

# Ensure data directories exist
os.makedirs('data/caregivers', exist_ok=True)
os.makedirs('data/categories', exist_ok=True)
os.makedirs('data/activities', exist_ok=True)
os.makedirs('data/templates', exist_ok=True)
os.makedirs('data/calendars', exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# After app initialization

git_user_name = os.environ.get('GIT_USER_NAME')
git_user_email = os.environ.get('GIT_USER_EMAIL')
if git_user_name and git_user_email:
    try:
        subprocess.run(["git", "config", "--global", "user.name", git_user_name], check=True)
        subprocess.run(["git", "config", "--global", "user.email", git_user_email], check=True)
    except Exception as e:
        print(f"Failed to configure git credentials: {e}")

# Git utility functions
def git_add_commit(commit_message, files=None, force=False):
    """Add and commit changes to Git, and optionally push to remote.
    
    Args:
        commit_message: Message for the commit
        files: List of specific files to commit (None for all changes)
        force: If True, attempt to commit even if there are errors
        
    Returns:
        Tuple of (success, message)
    """
    # Check if in development mode or explicitly allowed in production
    if not force and app.config['ENVIRONMENT'].lower() != 'development' and not os.environ.get('ALLOW_GIT_IN_PRODUCTION', 'false').lower() == 'true':
        app.logger.info("Git operations skipped in production. Set ALLOW_GIT_IN_PRODUCTION=true to enable.")
        return False, "Git operations disabled in production"
    
    try:
        # Get auto push setting from environment each time
        auto_push = os.environ.get('GIT_AUTO_PUSH', 'false').lower() == 'true'
        app.logger.debug(f"Git auto-push is {'enabled' if auto_push else 'disabled'}")

        # Check if we're in a detached HEAD state and fix if needed
        try:
            head_state = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
            if head_state == 'HEAD':
                app.logger.warning("Detected detached HEAD state, attempting to fix...")
                # Try to checkout main branch
                try:
                    subprocess.run(['git', 'checkout', 'main'], check=True, capture_output=True)
                    app.logger.info("Successfully checked out main branch")
                except subprocess.CalledProcessError:
                    # If main doesn't exist, try master
                    try:
                        subprocess.run(['git', 'checkout', 'master'], check=True, capture_output=True)
                        app.logger.info("Successfully checked out master branch")
                    except subprocess.CalledProcessError:
                        # Create main branch if needed
                        subprocess.run(['git', 'checkout', '-b', 'main'], check=True, capture_output=True)
                        app.logger.info("Created and checked out new main branch")
        except Exception as e:
            app.logger.error(f"Error checking/fixing HEAD state: {str(e)}")
            if not force:
                return False, f"Error checking Git HEAD state: {str(e)}"

        # If no files specified, add all changes
        if files is None:
            subprocess.run(['git', 'add', '.'], check=True)
        else:
            subprocess.run(['git', 'add'] + files, check=True)
            
        # Configure git identity if not already set
        try:
            user_name = subprocess.check_output(['git', 'config', 'user.name']).decode().strip()
        except subprocess.CalledProcessError:
            git_user_name = os.environ.get('GIT_USER_NAME', 'perisri101')
            subprocess.run(['git', 'config', 'user.name', git_user_name], check=True)
            
        try:
            user_email = subprocess.check_output(['git', 'config', 'user.email']).decode().strip()
        except subprocess.CalledProcessError:
            git_user_email = os.environ.get('GIT_USER_EMAIL', 'perisri101@gmail.com')
            subprocess.run(['git', 'config', 'user.email', git_user_email], check=True)
        
        # Check if there are changes to commit
        status_output = subprocess.check_output(['git', 'status', '--porcelain']).decode().strip()
        if not status_output and not force:
            app.logger.info("No changes to commit")
            return True, "No changes to commit"
        
        # Commit changes
        try:
            subprocess.run(['git', 'commit', '-m', commit_message], check=True)
            app.logger.info(f"Changes committed: {commit_message}")
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            app.logger.warning(f"Commit failed: {error_msg}")
            
            if "nothing to commit" in error_msg:
                return True, "No changes to commit"
            
            if not force:
                return False, f"Commit failed: {error_msg}"
            else:
                app.logger.warning("Continuing with push despite commit failure (force mode)")
        
        # Push to remote if enabled
        if auto_push or force:
            try:
                # Set up credentials if token is available
                github_token = os.environ.get('GITHUB_TOKEN')
                repo_url = os.environ.get('GIT_REPOSITORY_URL')
                
                if github_token and repo_url and force:
                    app.logger.info("Setting up Git credentials for force push")
                    # Configure credential helper
                    subprocess.run(['git', 'config', '--global', 'credential.helper', 'store'], check=False)
                    
                    # Extract the domain from repo URL
                    if repo_url.startswith('https://'):
                        domain = repo_url.split('//')[1].split('/')[0]
                        # Create credentials file in memory
                        cred_process = subprocess.Popen(
                            ['git', 'credential', 'approve'],
                            stdin=subprocess.PIPE,
                            universal_newlines=True
                        )
                        cred_process.communicate(f"protocol=https\nhost={domain}\nusername=x-access-token\npassword={github_token}\n\n")
                
                # Get current branch
                branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
                
                # Push to the current branch
                push_cmd = ['git', 'push', '--set-upstream', 'origin', branch]
                result = subprocess.run(push_cmd, check=False, capture_output=True)
                
                if result.returncode == 0:
                    app.logger.info("Changes pushed to remote repository")
                    return True, "Changes committed and pushed"
                else:
                    error_msg = result.stderr.decode() if result.stderr else "Unknown push error"
                    app.logger.error(f"Git push failed: {error_msg}")
                    
                    # Try to provide helpful error messages
                    if "Permission denied" in error_msg or "403" in error_msg:
                        error_details = "Authentication failed. Check your GitHub token."
                    elif "not found" in error_msg or "404" in error_msg:
                        error_details = "Repository not found. Check your repository URL."
                    elif "rejected" in error_msg:
                        error_details = "Push rejected. Try pulling changes first."
                    else:
                        error_details = error_msg
                    
                    if not force:
                        return False, f"Commit successful, but push failed: {error_details}"
                    else:
                        app.logger.warning(f"Push failed even in force mode: {error_details}")
                        return False, f"Force commit succeeded, but push still failed: {error_details}"
            except Exception as e:
                app.logger.error(f"Unexpected error during push: {str(e)}")
                return False, f"Commit successful, but push failed with error: {str(e)}"
                
        return True, "Changes committed" + (" and push attempted" if auto_push or force else "")
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        
        # Check for common errors and provide helpful messages
        if "could not read Username" in error_msg:
            diagnostic_msg = """
Git authentication failed. This is likely because the GITHUB_TOKEN is not set.

Please run the diagnostic script to identify and fix the issue:
    ./git_diagnosis.sh  or  python3 diagnose_git.py

For detailed setup instructions, see render_environment_setup.md
"""
            app.logger.error(f"Git authentication error: {error_msg}\n{diagnostic_msg}")
        else:
            app.logger.error(f"Git operation failed: {error_msg}")
            
        if force:
            app.logger.warning(f"Git operation failed even in force mode: {error_msg}")
            
        return False, f"Git operation failed: {error_msg}"
    except Exception as e:
        app.logger.error(f"Unexpected error in git operation: {str(e)}")
        return False, f"Unexpected error: {str(e)}"

# Routes
@app.route('/')
def hello_world():
    return render_template('index.html');

# API Routes for Caregivers
@app.route('/api/caregivers', methods=['GET'])
def get_caregivers():
    caregivers = []
    for filename in os.listdir('data/caregivers'):
        if filename.endswith('.json'):
            with open(os.path.join('data/caregivers', filename), 'r') as f:
                caregiver = json.load(f)
                caregivers.append(caregiver)
    return jsonify(caregivers)

@app.route('/api/caregivers/<id>', methods=['GET'])
def get_caregiver(id):
    try:
        with open(os.path.join('data/caregivers', f'{id}.json'), 'r') as f:
            caregiver = json.load(f)
        return jsonify(caregiver)
    except FileNotFoundError:
        return jsonify({"error": "Caregiver not found"}), 404

@app.route('/api/caregivers', methods=['POST'])
def create_caregiver():
    data = request.form.to_dict()
    id = datetime.now().strftime('%Y%m%d%H%M%S')
    data['id'] = id
    
    # Handle image upload
    if 'picture' in request.files:
        file = request.files['picture']
        if file.filename:
            filename = secure_filename(file.filename)
            extension = os.path.splitext(filename)[1]
            image_filename = f"{id}{extension}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
            file.save(file_path)
            data['picture'] = os.path.join('images', 'caregivers', image_filename)
    
    # Process location rates
    if 'location_rates_json' in data:
        try:
            data['location_rates'] = json.loads(data['location_rates_json'])
            del data['location_rates_json']
            # Delete the individual location fields to prevent duplication
            if 'location_names[]' in data:
                del data['location_names[]']
            if 'location_rates[]' in data:
                del data['location_rates[]']
        except:
            # If there's an error processing the JSON, just ignore it
            if 'location_rates_json' in data:
                del data['location_rates_json']
    
    # If default_hourly_rate is provided, make it the primary rate for backward compatibility
    if 'default_hourly_rate' in data:
        data['hourly_rate'] = data['default_hourly_rate']
    
    with open(os.path.join('data/caregivers', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Added caregiver {data.get('name', id)}")
    
    return jsonify(data), 201

@app.route('/api/caregivers/<id>', methods=['PUT'])
def update_caregiver(id):
    data = request.form.to_dict()
    data['id'] = id
    
    try:
        with open(os.path.join('data/caregivers', f'{id}.json'), 'r') as f:
            existing = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Caregiver not found"}), 404
    
    # Handle image upload
    if 'picture' in request.files:
        file = request.files['picture']
        if file.filename:
            # Remove old picture if exists
            if 'picture' in existing and existing['picture'] and os.path.exists(os.path.join('static', existing['picture'])):
                os.remove(os.path.join('static', existing['picture']))
            
            filename = secure_filename(file.filename)
            extension = os.path.splitext(filename)[1]
            image_filename = f"{id}{extension}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
            file.save(file_path)
            data['picture'] = os.path.join('images', 'caregivers', image_filename)
        else:
            # Keep existing picture
            data['picture'] = existing.get('picture', '')
    else:
        # Keep existing picture
        data['picture'] = existing.get('picture', '')
    
    # Process location rates
    if 'location_rates_json' in data:
        try:
            data['location_rates'] = json.loads(data['location_rates_json'])
            del data['location_rates_json']
            # Delete the individual location fields to prevent duplication
            if 'location_names[]' in data:
                del data['location_names[]']
            if 'location_rates[]' in data:
                del data['location_rates[]']
        except:
            # If there's an error processing the JSON, just ignore it
            if 'location_rates_json' in data:
                del data['location_rates_json']
    
    # If default_hourly_rate is provided, make it the primary rate for backward compatibility
    if 'default_hourly_rate' in data:
        data['hourly_rate'] = data['default_hourly_rate']
    
    with open(os.path.join('data/caregivers', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Updated caregiver {data.get('name', id)}")
    
    return jsonify(data)

@app.route('/api/caregivers/<id>', methods=['DELETE'])
def delete_caregiver(id):
    try:
        file_path = os.path.join('data/caregivers', f'{id}.json')
        with open(file_path, 'r') as f:
            caregiver = json.load(f)
        
        # Remove profile picture if exists
        if 'picture' in caregiver and caregiver['picture'] and os.path.exists(os.path.join('static', caregiver['picture'])):
            os.remove(os.path.join('static', caregiver['picture']))
        
        os.remove(file_path)
        git_add_commit(f"Deleted caregiver {caregiver.get('name', id)}")
        
        return jsonify({"message": "Caregiver deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Caregiver not found"}), 404

# API Routes for Categories
@app.route('/api/categories', methods=['GET'])
def get_categories():
    categories = []
    for filename in os.listdir('data/categories'):
        if filename.endswith('.json'):
            with open(os.path.join('data/categories', filename), 'r') as f:
                category = json.load(f)
                categories.append(category)
    return jsonify(categories)

@app.route('/api/categories/<id>', methods=['GET'])
def get_category(id):
    try:
        with open(os.path.join('data/categories', f'{id}.json'), 'r') as f:
            category = json.load(f)
        return jsonify(category)
    except FileNotFoundError:
        return jsonify({"error": "Category not found"}), 404

@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.get_json()
    id = datetime.now().strftime('%Y%m%d%H%M%S')
    data['id'] = id
    
    with open(os.path.join('data/categories', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Added category {data.get('name', id)}")
    
    return jsonify(data), 201

@app.route('/api/categories/<id>', methods=['PUT'])
def update_category(id):
    data = request.get_json()
    data['id'] = id
    
    try:
        with open(os.path.join('data/categories', f'{id}.json'), 'r') as f:
            existing = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Category not found"}), 404
    
    with open(os.path.join('data/categories', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Updated category {data.get('name', id)}")
    
    return jsonify(data)

@app.route('/api/categories/<id>', methods=['DELETE'])
def delete_category(id):
    try:
        file_path = os.path.join('data/categories', f'{id}.json')
        with open(file_path, 'r') as f:
            category = json.load(f)
        
        os.remove(file_path)
        git_add_commit(f"Deleted category {category.get('name', id)}")
        
        return jsonify({"message": "Category deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Category not found"}), 404

# API Routes for Activities
@app.route('/api/activities', methods=['GET'])
def get_activities():
    category_id = request.args.get('category_id')
    activities = []
    
    for filename in os.listdir('data/activities'):
        if filename.endswith('.json'):
            with open(os.path.join('data/activities', filename), 'r') as f:
                activity = json.load(f)
                if not category_id or activity.get('category_id') == category_id:
                    activities.append(activity)
                    
    return jsonify(activities)

@app.route('/api/activities/<id>', methods=['GET'])
def get_activity(id):
    try:
        with open(os.path.join('data/activities', f'{id}.json'), 'r') as f:
            activity = json.load(f)
        return jsonify(activity)
    except FileNotFoundError:
        return jsonify({"error": "Activity not found"}), 404

@app.route('/api/activities', methods=['POST'])
def create_activity():
    data = request.get_json()
    id = datetime.now().strftime('%Y%m%d%H%M%S')
    data['id'] = id
    
    with open(os.path.join('data/activities', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Added activity {data.get('name', id)}")
    
    return jsonify(data), 201

@app.route('/api/activities/<id>', methods=['PUT'])
def update_activity(id):
    data = request.get_json()
    data['id'] = id
    
    try:
        with open(os.path.join('data/activities', f'{id}.json'), 'r') as f:
            existing = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Activity not found"}), 404
    
    with open(os.path.join('data/activities', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Updated activity {data.get('name', id)}")
    
    return jsonify(data)

@app.route('/api/activities/<id>', methods=['DELETE'])
def delete_activity(id):
    try:
        file_path = os.path.join('data/activities', f'{id}.json')
        with open(file_path, 'r') as f:
            activity = json.load(f)
        
        os.remove(file_path)
        git_add_commit(f"Deleted activity {activity.get('name', id)}")
        
        return jsonify({"message": "Activity deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Activity not found"}), 404

# API Routes for Templates
@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates = []
    for filename in os.listdir('data/templates'):
        if filename.endswith('.json'):
            with open(os.path.join('data/templates', filename), 'r') as f:
                template = json.load(f)
                templates.append(template)
    return jsonify(templates)

@app.route('/api/templates/<id>', methods=['GET'])
def get_template(id):
    try:
        with open(os.path.join('data/templates', f'{id}.json'), 'r') as f:
            template = json.load(f)
        return jsonify(template)
    except FileNotFoundError:
        return jsonify({"error": "Template not found"}), 404

@app.route('/api/templates', methods=['POST'])
def create_template():
    data = request.get_json()
    id = datetime.now().strftime('%Y%m%d%H%M%S')
    data['id'] = id
    
    # Initialize empty weekly schedule with 2-hour blocks
    if 'schedule' not in data:
        data['schedule'] = {
            'Monday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Tuesday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Wednesday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Thursday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Friday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Saturday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}},
            'Sunday': {'8-10': {}, '10-12': {}, '12-14': {}, '14-16': {}, '16-18': {}, '18-20': {}, '20-22': {}}
        }
    
    with open(os.path.join('data/templates', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Added template {data.get('name', id)}")
    
    return jsonify(data), 201

@app.route('/api/templates/<id>', methods=['PUT'])
def update_template(id):
    data = request.get_json()
    data['id'] = id
    
    try:
        with open(os.path.join('data/templates', f'{id}.json'), 'r') as f:
            existing = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Template not found"}), 404
    
    with open(os.path.join('data/templates', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Updated template {data.get('name', id)}")
    
    return jsonify(data)

@app.route('/api/templates/<id>', methods=['DELETE'])
def delete_template(id):
    try:
        file_path = os.path.join('data/templates', f'{id}.json')
        with open(file_path, 'r') as f:
            template = json.load(f)
        
        os.remove(file_path)
        git_add_commit(f"Deleted template {template.get('name', id)}")
        
        return jsonify({"message": "Template deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Template not found"}), 404

# API Routes for Calendars
@app.route('/api/calendars', methods=['GET'])
def get_calendars():
    calendars = []
    for filename in os.listdir('data/calendars'):
        if filename.endswith('.json'):
            with open(os.path.join('data/calendars', filename), 'r') as f:
                calendar = json.load(f)
                calendars.append(calendar)
    return jsonify(calendars)

@app.route('/api/calendars/<id>', methods=['GET'])
def get_calendar(id):
    try:
        with open(os.path.join('data/calendars', f'{id}.json'), 'r') as f:
            calendar = json.load(f)
        return jsonify(calendar)
    except FileNotFoundError:
        return jsonify({"error": "Calendar not found"}), 404

@app.route('/api/calendars', methods=['POST'])
def create_calendar():
    data = request.get_json()
    id = datetime.now().strftime('%Y%m%d%H%M%S')
    data['id'] = id
    
    # If based on a template, copy the template structure
    if 'template_id' in data:
        template_path = os.path.join('data/templates', f"{data['template_id']}.json")
        if os.path.exists(template_path):
            with open(template_path, 'r') as f:
                template = json.load(f)
                data['schedule'] = template.get('schedule', {})
    
    with open(os.path.join('data/calendars', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Added calendar {data.get('name', id)}")
    
    return jsonify(data), 201

@app.route('/api/calendars/<id>', methods=['PUT'])
def update_calendar(id):
    data = request.get_json()
    data['id'] = id
    
    try:
        with open(os.path.join('data/calendars', f'{id}.json'), 'r') as f:
            existing = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Calendar not found"}), 404
    
    with open(os.path.join('data/calendars', f'{id}.json'), 'w') as f:
        json.dump(data, f, indent=2)
    
    git_add_commit(f"Updated calendar {data.get('name', id)}")
    
    return jsonify(data)

@app.route('/api/calendars/<id>', methods=['DELETE'])
def delete_calendar(id):
    try:
        file_path = os.path.join('data/calendars', f'{id}.json')
        with open(file_path, 'r') as f:
            calendar = json.load(f)
        
        os.remove(file_path)
        git_add_commit(f"Deleted calendar {calendar.get('name', id)}")
        
        return jsonify({"message": "Calendar deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Calendar not found"}), 404

# Backup and restore functions
@app.route('/api/backup', methods=['GET'])
def backup_data():
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup_dir = f'data/backup_{timestamp}'
    os.makedirs(backup_dir, exist_ok=True)
    
    # Copy all data folders to backup directory
    for folder in ['caregivers', 'categories', 'activities', 'templates', 'calendars']:
        if os.path.exists(os.path.join('data', folder)):
            shutil.copytree(os.path.join('data', folder), os.path.join(backup_dir, folder))
    
    # Copy caregiver images
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        images_backup_dir = os.path.join(backup_dir, 'images', 'caregivers')
        os.makedirs(images_backup_dir, exist_ok=True)
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            shutil.copy2(
                os.path.join(app.config['UPLOAD_FOLDER'], filename),
                os.path.join(images_backup_dir, filename)
            )
    
    # Create a JSON file with metadata about the backup
    metadata = {
        'timestamp': timestamp,
        'created_at': datetime.now().isoformat(),
        'description': request.args.get('description', f'Backup created at {timestamp}')
    }
    
    with open(os.path.join(backup_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    git_add_commit(backup_dir, f"Backup created at {timestamp}")
    
    return jsonify({
        "message": f"Backup created at {timestamp}", 
        "backup_dir": backup_dir,
        "metadata": metadata
    })

@app.route('/api/backups', methods=['GET'])
def list_backups():
    """List all available backups"""
    backups = []
    
    for dirname in os.listdir('data'):
        if dirname.startswith('backup_'):
            metadata_path = os.path.join('data', dirname, 'metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    backups.append({
                        'id': dirname.replace('backup_', ''),
                        'path': dirname,
                        'metadata': metadata
                    })
            else:
                # For backups without metadata
                backups.append({
                    'id': dirname.replace('backup_', ''),
                    'path': dirname,
                    'metadata': {
                        'timestamp': dirname.replace('backup_', ''),
                        'created_at': None,
                        'description': f'Backup {dirname}'
                    }
                })
    
    # Sort by timestamp (newest first)
    backups.sort(key=lambda x: x['id'], reverse=True)
    
    return jsonify(backups)

@app.route('/api/restore/<backup_id>', methods=['POST'])
def restore_backup(backup_id):
    """Restore data from a backup"""
    backup_dir = f'data/backup_{backup_id}'
    
    if not os.path.exists(backup_dir):
        return jsonify({"error": f"Backup {backup_id} not found"}), 404
    
    # Create a backup of current state before restoring
    current_timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    current_backup_dir = f'data/pre_restore_backup_{current_timestamp}'
    
    # Backup current data before restoring
    backup_data()
    
    # Remove current data
    for folder in ['caregivers', 'categories', 'activities', 'templates', 'calendars']:
        folder_path = os.path.join('data', folder)
        if os.path.exists(folder_path):
            for filename in os.listdir(folder_path):
                if filename != '.gitkeep':  # Keep .gitkeep files
                    file_path = os.path.join(folder_path, filename)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
    
    # Copy from backup
    for folder in ['caregivers', 'categories', 'activities', 'templates', 'calendars']:
        backup_folder = os.path.join(backup_dir, folder)
        if os.path.exists(backup_folder):
            for filename in os.listdir(backup_folder):
                src_path = os.path.join(backup_folder, filename)
                dst_path = os.path.join('data', folder, filename)
                if os.path.isfile(src_path):
                    shutil.copy2(src_path, dst_path)
    
    # Restore caregiver images if they exist in the backup
    backup_images_dir = os.path.join(backup_dir, 'images', 'caregivers')
    if os.path.exists(backup_images_dir):
        # Clear current images
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        
        # Copy images from backup
        for filename in os.listdir(backup_images_dir):
            src_path = os.path.join(backup_images_dir, filename)
            dst_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(src_path):
                shutil.copy2(src_path, dst_path)
    
    # Commit all changes
    git_add_commit('data', f"Restored from backup {backup_id}")
    
    return jsonify({
        "message": f"Data restored from backup {backup_id}",
        "backup_id": backup_id
    })

# Modified Git status route for production
@app.route('/api/git/status', methods=['GET'])
def git_status_api():
    """Get the current Git status."""
    try:
        # Get current branch
        try:
            branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
        except:
            branch = "Unknown"
        
        # Get status
        try:
            status_output = subprocess.check_output(['git', 'status', '--porcelain']).decode().strip()
            changes = [line for line in status_output.split('\n') if line.strip()]
            has_changes = len(changes) > 0
        except:
            changes = []
            has_changes = False
        
        # Get remote status
        try:
            remote_output = subprocess.check_output(['git', 'remote', '-v']).decode().strip()
            remotes = [line for line in remote_output.split('\n') if line.strip()]
            has_remote = len(remotes) > 0
        except:
            remotes = []
            has_remote = False
        
        # Check if .git directory exists
        is_git_repo = os.path.exists('.git')
        
        # Check if we can access the remote
        can_access_remote = False
        remote_error = None
        if has_remote:
            try:
                result = subprocess.run(['git', 'ls-remote', '--heads', 'origin'], 
                                      check=False, capture_output=True, text=True, timeout=5)
                can_access_remote = result.returncode == 0
                if not can_access_remote:
                    remote_error = result.stderr.strip()
            except Exception as e:
                remote_error = str(e)
        
        return jsonify({
            'is_git_repo': is_git_repo,
            'branch': branch,
            'changes': changes,
            'has_changes': has_changes,
            'remotes': remotes,
            'has_remote': has_remote,
            'can_access_remote': can_access_remote,
            'remote_error': remote_error,
            'environment': {
                'GIT_AUTO_PUSH': os.environ.get('GIT_AUTO_PUSH', 'Not set'),
                'ALLOW_GIT_IN_PRODUCTION': os.environ.get('ALLOW_GIT_IN_PRODUCTION', 'Not set'),
                'GIT_USER_NAME': os.environ.get('GIT_USER_NAME', 'Not set'),
                'GIT_USER_EMAIL': os.environ.get('GIT_USER_EMAIL', 'Not set'),
                'GITHUB_TOKEN': 'Set' if os.environ.get('GITHUB_TOKEN') else 'Not set',
                'GIT_REPOSITORY_URL': os.environ.get('GIT_REPOSITORY_URL', 'Not set')
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Modified Git push route for production
@app.route('/api/git/push', methods=['POST'])
def git_push():
    """Force push all changes to the remote repository"""
    # Return dummy success in production
    if app.config['ENVIRONMENT'] == 'production':
        return jsonify({
            "message": "Git operations are disabled in production environment",
            "details": "This is a simulated success response"
        })
    
    try:
        remote = app.config['GIT_REMOTE']
        branch = app.config['GIT_BRANCH']
        
        # Add all changes
        subprocess.run(["git", "add", "--all"], check=True)
        
        # Check if there are changes to commit
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            check=True,
            capture_output=True,
            text=True
        )
        
        if status_result.stdout.strip():
            # Commit changes
            message = request.json.get('message', f"Automatic commit at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            subprocess.run(["git", "commit", "-m", message], check=True)
        
        # Push to remote
        push_result = subprocess.run(
            ["git", "push", remote, branch],
            check=True,
            capture_output=True,
            text=True
        )
        
        return jsonify({
            "message": f"Successfully pushed to {remote}/{branch}",
            "details": push_result.stdout
        })
    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"Git operation failed: {str(e)}", "details": e.stderr}), 500
    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500

# Test endpoint for Git configuration
@app.route('/api/git/test', methods=['GET'])
def test_git_config():
    """Test Git configuration and operations"""
    try:
        # Create a temporary test file
        test_file_path = 'test_git_config.txt'
        with open(test_file_path, 'w') as f:
            f.write(f"Git test from {app.config['ENVIRONMENT']} environment\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            f.write(f"Server: {request.host}\n")
            
        # Get Git configuration
        git_config = subprocess.run(
            ["git", "config", "--list"],
            check=True,
            capture_output=True,
            text=True
        ).stdout
        
        # Try to add and commit the file (won't push)
        add_result = subprocess.run(
            ["git", "add", test_file_path],
            check=True,
            capture_output=True,
            text=True
        )
        
        commit_result = subprocess.run(
            ["git", "commit", "-m", f"Test commit from {app.config['ENVIRONMENT']} at {datetime.now().isoformat()}"],
            check=True,
            capture_output=True,
            text=True
        )
        
        # Test auto-push setting but don't actually push
        auto_push = os.environ.get('GIT_AUTO_PUSH', 'false').lower() == 'true'
        
        return jsonify({
            "environment": app.config['ENVIRONMENT'],
            "git_config": git_config.strip().split('\n'),
            "auto_push_enabled": auto_push,
            "test_file": test_file_path,
            "add_result": add_result.stdout.strip(),
            "commit_result": commit_result.stdout.strip(),
            "success": True,
            "message": "Git configuration test completed successfully"
        })
    except subprocess.CalledProcessError as e:
        return jsonify({
            "error": f"Git operation failed: {str(e)}",
            "details": e.stderr,
            "success": False
        }), 500
    except Exception as e:
        return jsonify({
            "error": f"Error: {str(e)}",
            "success": False
        }), 500

# Diagnostic endpoint for Git configuration
@app.route('/api/git/diagnose', methods=['GET'])
def git_diagnose():
    """Endpoint to run Git diagnostics and return results."""
    try:
        # Create a unique filename for the output
        output_file = f"git_diagnostic_{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
        
        # Run the diagnostic script and capture output
        result = subprocess.run(['python3', 'diagnose_git.py'], 
                               capture_output=True, 
                               text=True)
        
        # Save output to file
        with open(output_file, 'w') as f:
            f.write(result.stdout)
            if result.stderr:
                f.write("\n\nERRORS:\n")
                f.write(result.stderr)
        
        # Return the results
        response = {
            'success': result.returncode == 0,
            'output': result.stdout,
            'errors': result.stderr if result.stderr else None,
            'output_file': output_file,
            'exit_code': result.returncode
        }
        
        return jsonify(response)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to run diagnostics. Try running ./git_diagnosis.sh from the command line.'
        }), 500

# Add this with the other API routes

@app.route('/api/git/test-connection', methods=['POST'])
def test_git_connection_api():
    """Test Git connectivity and configuration."""
    try:
        # Get the current Git configuration
        git_config = {}
        try:
            git_config['user.name'] = subprocess.check_output(['git', 'config', 'user.name']).decode().strip()
        except:
            git_config['user.name'] = 'Not set'
            
        try:
            git_config['user.email'] = subprocess.check_output(['git', 'config', 'user.email']).decode().strip()
        except:
            git_config['user.email'] = 'Not set'
            
        try:
            git_config['remote.origin.url'] = subprocess.check_output(['git', 'config', '--get', 'remote.origin.url']).decode().strip()
        except:
            git_config['remote.origin.url'] = 'Not set'
        
        # Test repository access
        repo_access = False
        repo_error = None
        try:
            result = subprocess.run(['git', 'ls-remote', '--heads', 'origin'], 
                                   check=False, capture_output=True, text=True)
            repo_access = result.returncode == 0
            if not repo_access:
                repo_error = result.stderr.strip()
        except Exception as e:
            repo_error = str(e)
        
        # Test push access by creating a test file
        push_access = False
        push_error = None
        test_file = f'git_test_{datetime.now().strftime("%Y%m%d%H%M%S")}.txt'
        
        try:
            # Create test file
            with open(test_file, 'w') as f:
                f.write(f"Git connectivity test\n")
                f.write(f"Date: {datetime.now().isoformat()}\n")
                f.write(f"Server: {request.host}\n")
            
            # Add and commit the file
            subprocess.run(['git', 'add', test_file], check=True)
            subprocess.run(['git', 'commit', '-m', f'Git connectivity test at {datetime.now().isoformat()}'], check=True)
            
            # Try to push
            result = subprocess.run(['git', 'push', 'origin', 'HEAD'], 
                                   check=False, capture_output=True, text=True)
            push_access = result.returncode == 0
            if not push_access:
                push_error = result.stderr.strip()
        except Exception as e:
            push_error = str(e)
        
        # Get current branch
        current_branch = 'Unknown'
        try:
            current_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
        except:
            pass
        
        # Return the results
        return jsonify({
            'success': True,
            'git_config': git_config,
            'repository_access': {
                'success': repo_access,
                'error': repo_error
            },
            'push_access': {
                'success': push_access,
                'error': push_error,
                'test_file': test_file
            },
            'current_branch': current_branch,
            'environment': {
                'GIT_AUTO_PUSH': os.environ.get('GIT_AUTO_PUSH', 'Not set'),
                'ALLOW_GIT_IN_PRODUCTION': os.environ.get('ALLOW_GIT_IN_PRODUCTION', 'Not set'),
                'GIT_USER_NAME': os.environ.get('GIT_USER_NAME', 'Not set'),
                'GIT_USER_EMAIL': os.environ.get('GIT_USER_EMAIL', 'Not set'),
                'GITHUB_TOKEN': 'Set' if os.environ.get('GITHUB_TOKEN') else 'Not set',
                'GIT_REPOSITORY_URL': os.environ.get('GIT_REPOSITORY_URL', 'Not set')
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/force-save', methods=['POST'])
def force_save_api():
    """Force save changes to Git, attempting to fix common issues."""
    try:
        data = request.json
        message = data.get('message', 'Force save via API')
        
        # Run the setup script first to fix common issues
        try:
            setup_result = subprocess.run(['./setup_git.sh'], 
                                         check=False, 
                                         capture_output=True,
                                         text=True)
            setup_output = setup_result.stdout
            setup_error = setup_result.stderr
        except Exception as e:
            setup_output = ""
            setup_error = str(e)
        
        # Force commit and push
        success, git_message = git_add_commit(message, force=True)
        
        return jsonify({
            'success': success,
            'message': git_message,
            'setup_output': setup_output,
            'setup_error': setup_error
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/run-setup', methods=['POST'])
def run_git_setup_api():
    """Run the Git setup script to fix common issues."""
    try:
        # Run the setup script
        result = subprocess.run(['./setup_git.sh'], 
                               check=False, 
                               capture_output=True,
                               text=True)
        
        return jsonify({
            'success': result.returncode == 0,
            'output': result.stdout,
            'error': result.stderr if result.stderr else None,
            'exit_code': result.returncode
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/troubleshoot', methods=['POST'])
def git_troubleshoot_api():
    """Advanced troubleshooting for Git connectivity issues."""
    try:
        # Get the issue type from the request
        data = request.json
        issue_type = data.get('issue_type', 'unknown')
        
        results = {
            'success': False,
            'actions_taken': [],
            'errors': [],
            'recommendations': []
        }
        
        # Check repository URL format and fix if needed
        if issue_type in ['repo_url', 'all']:
            try:
                # Get current repository URL
                current_url = None
                try:
                    current_url = subprocess.check_output(['git', 'config', '--get', 'remote.origin.url']).decode().strip()
                except:
                    results['actions_taken'].append("No remote URL found")
                
                # Get URL from environment
                env_url = os.environ.get('GIT_REPOSITORY_URL')
                
                if env_url:
                    # Fix URL if it contains embedded token
                    if '@' in env_url and '//' in env_url and not env_url.startswith('git@'):
                        # Extract the clean URL without token
                        parts = env_url.split('@')
                        domain_part = parts[-1]
                        protocol = env_url.split('//')[0] + '//'
                        clean_url = protocol + domain_part
                        
                        # Set the clean URL
                        subprocess.run(['git', 'remote', 'set-url', 'origin', clean_url], check=True)
                        results['actions_taken'].append(f"Fixed repository URL format (removed embedded token)")
                    elif not current_url or current_url != env_url:
                        # Set or update the URL
                        if current_url:
                            subprocess.run(['git', 'remote', 'set-url', 'origin', env_url], check=True)
                            results['actions_taken'].append(f"Updated remote URL to match environment variable")
                        else:
                            subprocess.run(['git', 'remote', 'add', 'origin', env_url], check=True)
                            results['actions_taken'].append(f"Added remote origin with URL from environment")
                else:
                    results['recommendations'].append("Set GIT_REPOSITORY_URL environment variable")
            except Exception as e:
                results['errors'].append(f"Error fixing repository URL: {str(e)}")
        
        # Fix authentication issues
        if issue_type in ['authentication', 'all']:
            try:
                token = os.environ.get('GITHUB_TOKEN')
                if token:
                    # Configure credential helper
                    subprocess.run(['git', 'config', '--global', 'credential.helper', 'store'], check=True)
                    results['actions_taken'].append("Set credential helper to 'store'")
                    
                    # Create credentials file
                    home_dir = os.path.expanduser("~")
                    with open(os.path.join(home_dir, '.git-credentials'), 'w') as f:
                        f.write(f"https://x-access-token:{token}@github.com\n")
                    os.chmod(os.path.join(home_dir, '.git-credentials'), 0o600)
                    results['actions_taken'].append("Created .git-credentials file with token")
                    
                    # Test authentication
                    auth_test = subprocess.run(
                        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 
                         '-H', f'Authorization: token {token}', 
                         'https://api.github.com/user'],
                        capture_output=True, text=True, check=False
                    )
                    
                    if auth_test.stdout.strip() == '200':
                        results['actions_taken'].append("GitHub token authentication successful")
                    else:
                        results['errors'].append(f"GitHub token authentication failed (HTTP {auth_test.stdout.strip()})")
                        results['recommendations'].append("Generate a new GitHub token with 'repo' scope")
                else:
                    results['recommendations'].append("Set GITHUB_TOKEN environment variable")
            except Exception as e:
                results['errors'].append(f"Error fixing authentication: {str(e)}")
        
        # Fix branch issues
        if issue_type in ['branch', 'all']:
            try:
                # Check if we're in detached HEAD state
                head_state = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
                
                if head_state == 'HEAD':
                    # Try to get the default branch from remote
                    try:
                        remote_info = subprocess.check_output(['git', 'remote', 'show', 'origin'], 
                                                            capture_output=True, text=True, check=False)
                        
                        # Extract default branch
                        default_branch = None
                        for line in remote_info.stdout.splitlines():
                            if 'HEAD branch:' in line:
                                default_branch = line.split('HEAD branch:')[1].strip()
                                break
                        
                        if default_branch:
                            # Try to checkout the default branch
                            subprocess.run(['git', 'checkout', default_branch], check=False)
                            results['actions_taken'].append(f"Checked out default branch '{default_branch}'")
                        else:
                            # Fallback to main or master
                            try:
                                subprocess.run(['git', 'checkout', 'main'], check=False)
                                results['actions_taken'].append("Checked out 'main' branch")
                            except:
                                try:
                                    subprocess.run(['git', 'checkout', 'master'], check=False)
                                    results['actions_taken'].append("Checked out 'master' branch")
                                except:
                                    # Create main branch
                                    subprocess.run(['git', 'checkout', '-b', 'main'], check=False)
                                    results['actions_taken'].append("Created and checked out new 'main' branch")
                    except Exception as branch_e:
                        results['errors'].append(f"Error determining default branch: {str(branch_e)}")
                        # Create main branch as fallback
                        subprocess.run(['git', 'checkout', '-b', 'main'], check=False)
                        results['actions_taken'].append("Created and checked out new 'main' branch (fallback)")
                else:
                    results['actions_taken'].append(f"Already on branch '{head_state}'")
                    
                # Set upstream branch
                current_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
                subprocess.run(['git', 'branch', '--set-upstream-to=origin/' + current_branch, current_branch], 
                              check=False, capture_output=True)
                results['actions_taken'].append(f"Set upstream to origin/{current_branch}")
                
            except Exception as e:
                results['errors'].append(f"Error fixing branch issues: {str(e)}")
        
        # Fix repository initialization issues
        if issue_type in ['init', 'all']:
            try:
                # Check if .git directory exists
                if not os.path.exists('.git'):
                    # Initialize git repository
                    subprocess.run(['git', 'init'], check=True)
                    results['actions_taken'].append("Initialized new Git repository")
                    
                    # Set user identity
                    git_user_name = os.environ.get('GIT_USER_NAME')
                    git_user_email = os.environ.get('GIT_USER_EMAIL')
                    
                    if git_user_name:
                        subprocess.run(['git', 'config', '--global', 'user.name', git_user_name], check=True)
                        results['actions_taken'].append(f"Set Git user.name to '{git_user_name}'")
                    
                    if git_user_email:
                        subprocess.run(['git', 'config', '--global', 'user.email', git_user_email], check=True)
                        results['actions_taken'].append(f"Set Git user.email to '{git_user_email}'")
                    
                    # Add remote if URL is available
                    repo_url = os.environ.get('GIT_REPOSITORY_URL')
                    if repo_url:
                        subprocess.run(['git', 'remote', 'add', 'origin', repo_url], check=True)
                        results['actions_taken'].append(f"Added remote 'origin' with URL from environment")
                    
                    # Create initial commit if needed
                    status = subprocess.check_output(['git', 'status', '--porcelain']).decode().strip()
                    if status:
                        subprocess.run(['git', 'add', '.'], check=True)
                        subprocess.run(['git', 'commit', '-m', 'Initial commit'], check=True)
                        results['actions_taken'].append("Created initial commit")
                else:
                    results['actions_taken'].append("Git repository already initialized")
            except Exception as e:
                results['errors'].append(f"Error initializing repository: {str(e)}")
        
        # Run the setup script as a final step
        try:
            setup_result = subprocess.run(['./setup_git.sh'], 
                                         check=False, 
                                         capture_output=True,
                                         text=True)
            if setup_result.returncode == 0:
                results['actions_taken'].append("Successfully ran setup_git.sh script")
            else:
                results['errors'].append(f"setup_git.sh script exited with code {setup_result.returncode}")
                if setup_result.stderr:
                    results['errors'].append(f"Setup script error: {setup_result.stderr}")
        except Exception as e:
            results['errors'].append(f"Error running setup script: {str(e)}")
        
        # Set success flag if we took actions and had no errors
        results['success'] = len(results['actions_taken']) > 0 and len(results['errors']) == 0
        
        return jsonify(results)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/env/variables', methods=['GET'])
def get_env_variables():
    """Get environment variables relevant to the application."""
    # Define which variables we want to expose
    env_vars = {
        'GIT_USER_NAME': os.environ.get('GIT_USER_NAME', ''),
        'GIT_USER_EMAIL': os.environ.get('GIT_USER_EMAIL', ''),
        'GIT_AUTO_PUSH': os.environ.get('GIT_AUTO_PUSH', 'false'),
        'ALLOW_GIT_IN_PRODUCTION': os.environ.get('ALLOW_GIT_IN_PRODUCTION', 'false'),
        'GIT_REPOSITORY_URL': os.environ.get('GIT_REPOSITORY_URL', ''),
        'GIT_BRANCH': os.environ.get('GIT_BRANCH', 'main'),
        'GITHUB_TOKEN': os.environ.get('GITHUB_TOKEN', ''),
        'FLASK_ENV': os.environ.get('FLASK_ENV', 'production')
    }
    
    # Mask sensitive values
    if env_vars['GITHUB_TOKEN']:
        env_vars['GITHUB_TOKEN'] = '••••••••' + env_vars['GITHUB_TOKEN'][-4:] if len(env_vars['GITHUB_TOKEN']) > 4 else '••••••••'
    
    return jsonify(env_vars)

@app.route('/api/env/variables', methods=['POST'])
def update_env_variables():
    """Update environment variables and save to .env file."""
    try:
        data = request.json
        
        # Validate input
        if not isinstance(data, dict):
            return jsonify({'success': False, 'error': 'Invalid data format'}), 400
        
        # List of allowed variables to update
        allowed_vars = [
            'GIT_USER_NAME', 
            'GIT_USER_EMAIL', 
            'GIT_AUTO_PUSH', 
            'ALLOW_GIT_IN_PRODUCTION',
            'GIT_REPOSITORY_URL',
            'GIT_BRANCH'
        ]
        
        # Special handling for GITHUB_TOKEN
        if 'GITHUB_TOKEN' in data and data['GITHUB_TOKEN'] and not data['GITHUB_TOKEN'].startswith('••••••••'):
            os.environ['GITHUB_TOKEN'] = data['GITHUB_TOKEN']
            allowed_vars.append('GITHUB_TOKEN')
        
        # Update environment variables
        updated_vars = []
        for key, value in data.items():
            if key in allowed_vars and value is not None:
                # Skip masked token
                if key == 'GITHUB_TOKEN' and value.startswith('••••••••'):
                    continue
                    
                os.environ[key] = str(value)
                updated_vars.append(key)
                
                # Update app config if applicable
                if key == 'GIT_AUTO_PUSH':
                    app.config['GIT_AUTO_PUSH'] = value.lower() == 'true'
                elif key == 'GIT_BRANCH':
                    app.config['GIT_BRANCH'] = value
        
        # Save to .env file
        try:
            env_path = os.path.join(os.getcwd(), '.env')
            
            # Read existing .env file if it exists
            env_vars = {}
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            env_vars[key.strip()] = value.strip()
            
            # Update with new values
            for key in updated_vars:
                env_vars[key] = os.environ[key]
            
            # Write back to .env file
            with open(env_path, 'w') as f:
                for key, value in env_vars.items():
                    # Quote values with spaces
                    if ' ' in value and not (value.startswith('"') and value.endswith('"')):
                        value = f'"{value}"'
                    f.write(f"{key}={value}\n")
            
            # Commit the changes to Git if auto-push is enabled
            if os.environ.get('GIT_AUTO_PUSH', 'false').lower() == 'true':
                git_add_commit("Update environment variables", ['.env'])
            
            return jsonify({
                'success': True, 
                'updated': updated_vars,
                'message': f"Updated {len(updated_vars)} environment variables"
            })
        except Exception as e:
            app.logger.error(f"Error saving .env file: {str(e)}")
            return jsonify({
                'success': True, 
                'updated': updated_vars,
                'warning': f"Variables updated in memory but failed to save to .env file: {str(e)}"
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/set-remote', methods=['POST'])
def set_git_remote():
    """Set the Git remote repository URL."""
    try:
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({'success': False, 'error': 'No URL provided'}), 400
        
        # Check if remote exists
        try:
            subprocess.check_output(['git', 'remote']).decode().strip()
            # Update existing remote
            subprocess.run(['git', 'remote', 'set-url', 'origin', url], check=True)
            action = "Updated"
        except:
            # Add new remote
            subprocess.run(['git', 'remote', 'add', 'origin', url], check=True)
            action = "Added"
        
        # Update environment variable
        os.environ['GIT_REPOSITORY_URL'] = url
        
        # Save to .env file
        try:
            env_path = os.path.join(os.getcwd(), '.env')
            
            # Read existing .env file if it exists
            env_vars = {}
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            env_vars[key.strip()] = value.strip()
            
            # Update with new URL
            env_vars['GIT_REPOSITORY_URL'] = url
            
            # Write back to .env file
            with open(env_path, 'w') as f:
                for key, value in env_vars.items():
                    # Quote values with spaces
                    if ' ' in value and not (value.startswith('"') and value.endswith('"')):
                        value = f'"{value}"'
                    f.write(f"{key}={value}\n")
        except Exception as e:
            app.logger.warning(f"Failed to update .env file: {str(e)}")
        
        # Try to fetch from the remote to verify it works
        try:
            subprocess.run(['git', 'fetch', 'origin'], check=False, capture_output=True, timeout=5)
            remote_verified = True
        except:
            remote_verified = False
        
        return jsonify({
            'success': True,
            'message': f"{action} remote 'origin' with URL: {url}",
            'remote_verified': remote_verified
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/initialize', methods=['POST'])
def initialize_git_repository():
    """Initialize or reset Git repository."""
    try:
        # Check if .git directory exists
        if os.path.exists('.git'):
            # Repository exists, just reset it
            try:
                # Get current branch
                current_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
                
                # Reset to clean state
                subprocess.run(['git', 'reset', '--hard'], check=True)
                subprocess.run(['git', 'clean', '-fd'], check=True)
                
                message = f"Reset existing Git repository (branch: {current_branch})"
            except:
                message = "Reset existing Git repository"
        else:
            # Initialize new repository
            subprocess.run(['git', 'init'], check=True)
            message = "Initialized new Git repository"
        
        # Configure Git user if needed
        git_user_name = os.environ.get('GIT_USER_NAME')
        git_user_email = os.environ.get('GIT_USER_EMAIL')
        
        if git_user_name:
            subprocess.run(['git', 'config', '--global', 'user.name', git_user_name], check=True)
        
        if git_user_email:
            subprocess.run(['git', 'config', '--global', 'user.email', git_user_email], check=True)
        
        # Set up remote if URL is available
        repo_url = os.environ.get('GIT_REPOSITORY_URL')
        if repo_url:
            try:
                # Check if remote exists
                remotes = subprocess.check_output(['git', 'remote']).decode().strip().split('\n')
                if 'origin' in remotes:
                    subprocess.run(['git', 'remote', 'set-url', 'origin', repo_url], check=True)
                else:
                    subprocess.run(['git', 'remote', 'add', 'origin', repo_url], check=True)
                
                message += f" and configured remote 'origin' with URL: {repo_url}"
            except:
                message += " but failed to configure remote"
        
        return jsonify({
            'success': True,
            'message': message
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/git/update-gitignore', methods=['POST'])
def update_gitignore():
    """Update .gitignore file with common Python patterns."""
    try:
        gitignore_path = os.path.join(os.getcwd(), '.gitignore')
        
        # Common Python patterns to ignore
        python_patterns = [
            "# Python virtual environment",
            ".venv/",
            "venv/",
            "env/",
            "ENV/",
            "",
            "# Python cache files",
            "__pycache__/",
            "*.py[cod]",
            "*$py.class",
            "*.so",
            ".Python",
            "build/",
            "develop-eggs/",
            "dist/",
            "downloads/",
            "eggs/",
            ".eggs/",
            "lib/",
            "lib64/",
            "parts/",
            "sdist/",
            "var/",
            "wheels/",
            "*.egg-info/",
            ".installed.cfg",
            "*.egg",
            "",
            "# Flask stuff",
            "instance/",
            ".webassets-cache",
            "",
            "# IDE files",
            ".idea/",
            ".vscode/",
            "*.swp",
            "*.swo",
            ".DS_Store",
            "",
            "# Local environment files",
            ".env.local",
            ".env.development.local",
            ".env.test.local",
            ".env.production.local",
            "",
            "# Log files",
            "*.log",
            "logs/"
        ]
        
        # Read existing .gitignore if it exists
        existing_patterns = []
        if os.path.exists(gitignore_path):
            with open(gitignore_path, 'r') as f:
                existing_patterns = [line.strip() for line in f.readlines()]
        
        # Merge patterns, avoiding duplicates
        all_patterns = []
        for pattern in python_patterns:
            if pattern not in existing_patterns:
                all_patterns.append(pattern)
        
        # Add existing patterns that aren't in our standard list
        for pattern in existing_patterns:
            if pattern not in python_patterns:
                all_patterns.append(pattern)
        
        # Write updated .gitignore
        with open(gitignore_path, 'w') as f:
            f.write('\n'.join(all_patterns))
        
        # Add to Git and commit
        success, message = git_add_commit("Update .gitignore file", ['.gitignore'])
        
        # Remove cached files that should now be ignored
        try:
            subprocess.run(['git', 'rm', '-r', '--cached', '.'], check=True)
            subprocess.run(['git', 'add', '.'], check=True)
            subprocess.run(['git', 'commit', '-m', "Apply .gitignore rules"], check=True)
        except Exception as e:
            return jsonify({
                'success': True,
                'message': f"Updated .gitignore but failed to apply rules: {str(e)}"
            })
        
        return jsonify({
            'success': True,
            'message': "Updated .gitignore and applied rules"
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Use environment variables for host and port if available
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_ENV', 'production') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug) 