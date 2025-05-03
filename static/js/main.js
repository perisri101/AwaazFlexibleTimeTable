// Add this at the top of your main.js file
console.log('Main.js loaded');

// Global state
let categories = [];
let caregivers = [];
let activities = [];
let templates = [];
let calendars = [];
let currentTemplate = null;
let currentCalendar = null;
let backups = [];
let gitStatus = {};

// DOM Ready
$(document).ready(function() {
    console.log('Document ready in main.js');
    
    // Test if jQuery is working
    if (typeof $ === 'function') {
        console.log('jQuery is working');
    } else {
        console.error('jQuery is not working');
    }
    
    // Test if Bootstrap is working
    if (typeof bootstrap !== 'undefined') {
        console.log('Bootstrap is working');
    } else {
        console.error('Bootstrap is not working');
    }
    
    // Initialize the application
    initApp();
    
    // Navigation event handlers
    $('.nav-link').on('click', function(e) {
        e.preventDefault();
        const section = $(this).data('section');
        
        // Update active nav link
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        
        // Show the selected section
        $('.content-section').removeClass('active');
        $(`#${section}`).addClass('active');
        
        // Load section data if needed
        loadSectionData(section);
        
        // Log when navigation items are clicked
        console.log(`Navigation clicked: ${section}`);
    });
    
    // Add button event handlers
    $('#add-caregiver-btn').on('click', showCaregiverModal);
    $('#add-category-btn').on('click', showCategoryModal);
    $('#add-activity-btn').on('click', showActivityModal);
    $('#add-template-btn').on('click', showTemplateModal);
    $('#add-calendar-btn').on('click', showCalendarModal);
    
    // Save button event handlers
    $('#save-caregiver').on('click', saveCaregiver);
    $('#save-category').on('click', saveCategory);
    $('#save-activity').on('click', saveActivity);
    $('#save-template').on('click', saveTemplate);
    $('#save-calendar').on('click', saveCalendar);
    $('#save-schedule').on('click', saveSchedule);
    $('#save-block').on('click', saveBlock);
    
    // Filter category event handler
    $('#filter-category').on('change', function() {
        loadActivities($(this).val());
    });
    
    // Backup and Git operation handlers
    $('#backup-btn').on('click', backupData);
    $('#push-changes-btn').on('click', pushChanges);
    $('#refresh-backups-btn').on('click', loadBackups);
    $('#refresh-git-status-btn').on('click', loadGitStatus);
    
    // Picture preview handler
    $('#caregiver-picture').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#picture-preview').html(`<img src="${e.target.result}" class="mt-2 img-thumbnail">`);
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Location rates handlers
    $('#add-location-btn').on('click', addLocationRateField);
    
    // Use event delegation for dynamically added remove buttons
    $(document).on('click', '.remove-location', function() {
        $(this).closest('.location-rate-item').remove();
    });
    
    // Git connectivity test
    $(document).on('click', '#test-git-btn', function() {
        // Show the results section
        $('#git-test-results').show();
        
        // Show loading indicators
        $('#git-user-name, #git-user-email, #git-repo-url, #git-branch, #git-remote-access, #git-changes')
            .html('<i class="fas fa-spinner fa-spin"></i> Loading...');
        
        $.ajax({
            url: '/api/git/test',
            type: 'GET',
            success: function(response) {
                // Update the UI with the results
                $('#git-user-name').text(response.environment.GIT_USER_NAME);
                $('#git-user-email').text(response.environment.GIT_USER_EMAIL);
                $('#git-repo-url').text(response.environment.GIT_REPOSITORY_URL);
                $('#git-branch').text(response.branch);
                
                // Remote access status
                if (response.has_remote) {
                    if (response.can_access_remote) {
                        $('#git-remote-access').html('<span class="text-success"><i class="fas fa-check-circle"></i> Connected</span>');
                    } else {
                        $('#git-remote-access').html(`<span class="text-danger"><i class="fas fa-times-circle"></i> Error: ${response.remote_error || 'Unknown error'}</span>`);
                    }
                } else {
                    $('#git-remote-access').html('<span class="text-warning"><i class="fas fa-exclamation-circle"></i> No remote configured</span>');
                }
                
                // Changes status
                if (response.has_changes) {
                    $('#git-changes').html('<span class="text-warning"><i class="fas fa-exclamation-circle"></i> Uncommitted changes</span>');
                } else {
                    $('#git-changes').html('<span class="text-success"><i class="fas fa-check-circle"></i> No changes</span>');
                }
                
                // Pending commits status
                if (response.has_pending_commits) {
                    $('#git-pending-commits').html(`
                        <span class="text-warning">
                            <i class="fas fa-exclamation-circle"></i> 
                            ${response.pending_commits.length} unpushed commit(s)
                        </span>
                        <button id="view-pending-commits-btn" class="btn btn-sm btn-outline-info ms-2">View</button>
                    `);
                    
                    // Add click handler for the "View" button
                    $('#view-pending-commits-btn').on('click', function() {
                        // Show a modal with the pending commits
                        let commitsList = '';
                        response.pending_commits.forEach(function(commit) {
                            commitsList += `<li>${commit}</li>`;
                        });
                        
                        // Create and show modal
                        const modalHtml = `
                            <div class="modal fade" id="pendingCommitsViewModal" tabindex="-1">
                                <div class="modal-dialog">
                                    <div class="modal-content">
                                        <div class="modal-header">
                                            <h5 class="modal-title">Pending Commits</h5>
                                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                        </div>
                                        <div class="modal-body">
                                            <p>These commits have not been pushed to the remote repository:</p>
                                            <ul>${commitsList}</ul>
                                        </div>
                                        <div class="modal-footer">
                                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                            <button type="button" class="btn btn-primary" id="handle-these-commits-btn">Handle These Commits</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        // Remove any existing modal
                        $('#pendingCommitsViewModal').remove();
                        
                        // Add the modal to the page
                        $('body').append(modalHtml);
                        
                        // Show the modal
                        const modal = new bootstrap.Modal(document.getElementById('pendingCommitsViewModal'));
                        modal.show();
                        
                        // Add click handler for the "Handle These Commits" button
                        $('#handle-these-commits-btn').on('click', function() {
                            modal.hide();
                            $('#handle-commits-btn').click();
                        });
                    });
                } else {
                    $('#git-pending-commits').html('<span class="text-success"><i class="fas fa-check-circle"></i> No pending commits</span>');
                }
                
                // Also update the environment variables in the form
                $('#env-git-user-name-input').val(response.environment.GIT_USER_NAME !== 'Not set' ? response.environment.GIT_USER_NAME : '');
                $('#env-git-user-email-input').val(response.environment.GIT_USER_EMAIL !== 'Not set' ? response.environment.GIT_USER_EMAIL : '');
                $('#env-git-repo-url-input').val(response.environment.GIT_REPOSITORY_URL !== 'Not set' ? response.environment.GIT_REPOSITORY_URL : '');
                $('#env-github-token-input').val(''); // Don't display the token for security
                $('#env-git-auto-push-input').prop('checked', response.environment.GIT_AUTO_PUSH === 'true');
                $('#env-allow-git-in-production-input').prop('checked', response.environment.ALLOW_GIT_IN_PRODUCTION === 'true');
                
                // Also refresh the Git status display
                refreshGitStatus();
            },
            error: function(xhr) {
                let errorMsg = 'Error testing Git connectivity';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg += ': ' + response.error;
                    }
                } catch (e) {
                    errorMsg += ': ' + xhr.statusText;
                }
                showNotification(errorMsg, 'danger');
            }
        });
    });

    // Run Git setup script
    $(document).on('click', '#run-setup-btn', function() {
        if (confirm('This will run the Git setup script to fix common issues. Continue?')) {
            $.ajax({
                url: '/api/git/run-setup',
                type: 'POST',
                success: function(response) {
                    showNotification('Git setup completed. Please test connectivity again.', 'success');
                    // Refresh the test results after a short delay
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                },
                error: function(xhr) {
                    let errorMsg = 'Error running Git setup';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg += ': ' + response.error;
                        }
                    } catch (e) {
                        errorMsg += ': ' + xhr.statusText;
                    }
                    showNotification(errorMsg, 'danger');
                }
            });
        }
    });

    // Force save changes
    $(document).on('click', '#force-save-btn', function() {
        const message = prompt('Enter a commit message for the force save:');
        if (!message) return;
        
        if (confirm('This will attempt to force save changes, bypassing normal checks. Continue?')) {
            $.ajax({
                url: '/api/git/force-save',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ message: message }),
                success: function(response) {
                    if (response.success) {
                        showNotification('Force save successful: ' + response.message, 'success');
                    } else {
                        showNotification('Force save completed with issues: ' + response.message, 'warning');
                    }
                    // Refresh the test results after a short delay
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                },
                error: function(xhr) {
                    let errorMsg = 'Error during force save';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg += ': ' + response.error;
                        }
                    } catch (e) {
                        errorMsg += ': ' + xhr.statusText;
                    }
                    showNotification(errorMsg, 'danger');
                }
            });
        }
    });

    // Git troubleshooter
    $(document).on('click', '.fix-git-issue', function() {
        const issueType = $(this).data('issue');
        const issueName = $(this).text().trim().split('\n')[0];
        
        if (confirm(`This will attempt to fix "${issueName}". Continue?`)) {
            // Show the results section
            $('#troubleshooter-results').show();
            $('#troubleshooter-spinner').show();
            $('#troubleshooter-status').text('Working on fixes...');
            
            // Hide result containers initially
            $('#actions-taken-container, #errors-container, #recommendations-container').hide();
            
            // Make the API call
            $.ajax({
                url: '/api/git/troubleshoot',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ issue_type: issueType }),
                success: function(response) {
                    // Update status
                    $('#troubleshooter-spinner').hide();
                    if (response.success) {
                        $('#troubleshooter-status').html('<i class="fas fa-check-circle text-success"></i> Successfully fixed issues!');
                    } else if (response.errors && response.errors.length > 0) {
                        $('#troubleshooter-status').html('<i class="fas fa-exclamation-circle text-warning"></i> Completed with some errors');
                    } else {
                        $('#troubleshooter-status').html('<i class="fas fa-info-circle text-info"></i> No issues needed fixing');
                    }
                    
                    // Show actions taken
                    if (response.actions_taken && response.actions_taken.length > 0) {
                        $('#actions-taken-list').empty();
                        response.actions_taken.forEach(function(action) {
                            $('#actions-taken-list').append(`
                                <li class="list-group-item list-group-item-success">
                                    <i class="fas fa-check"></i> ${action}
                                </li>
                            `);
                        });
                        $('#actions-taken-container').show();
                    }
                    
                    // Show errors
                    if (response.errors && response.errors.length > 0) {
                        $('#errors-list').empty();
                        response.errors.forEach(function(error) {
                            $('#errors-list').append(`
                                <li class="list-group-item list-group-item-danger">
                                    <i class="fas fa-times"></i> ${error}
                                </li>
                            `);
                        });
                        $('#errors-container').show();
                    }
                    
                    // Show recommendations
                    if (response.recommendations && response.recommendations.length > 0) {
                        $('#recommendations-list').empty();
                        response.recommendations.forEach(function(recommendation) {
                            $('#recommendations-list').append(`
                                <li class="list-group-item list-group-item-info">
                                    <i class="fas fa-lightbulb"></i> ${recommendation}
                                </li>
                            `);
                        });
                        $('#recommendations-container').show();
                    }
                    
                    // Refresh the test results after a short delay
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                },
                error: function(xhr) {
                    $('#troubleshooter-spinner').hide();
                    $('#troubleshooter-status').html('<i class="fas fa-times-circle text-danger"></i> Error running troubleshooter');
                    
                    let errorMsg = 'Error fixing Git issues';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg = response.error;
                        }
                    } catch (e) {
                        errorMsg = xhr.statusText;
                    }
                    
                    $('#errors-list').empty();
                    $('#errors-list').append(`
                        <li class="list-group-item list-group-item-danger">
                            <i class="fas fa-times"></i> ${errorMsg}
                        </li>
                    `);
                    $('#errors-container').show();
                    
                    showNotification('Error fixing Git issues: ' + errorMsg, 'danger');
                }
            });
        }
    });

    // Toggle Git troubleshooter
    $(document).on('click', '#toggle-troubleshooter-btn', function() {
        $('#git-troubleshooter').toggle();
        
        // Update button text based on visibility
        if ($('#git-troubleshooter').is(':visible')) {
            $(this).html('<i class="fas fa-times"></i> Hide Troubleshooter');
        } else {
            $(this).html('<i class="fas fa-tools"></i> Advanced Troubleshooting');
        }
    });

    // Toggle Environment Variables section
    $(document).on('click', '#toggle-env-btn', function() {
        $('#env-variables-section').toggle();
        
        // Update button text based on visibility
        if ($('#env-variables-section').is(':visible')) {
            $(this).html('<i class="fas fa-times"></i> Hide Environment Variables');
        } else {
            $(this).html('<i class="fas fa-cog"></i> Environment Variables');
        }
    });

    // Initialize troubleshooter as hidden
    $(document).ready(function() {
        $('#git-troubleshooter').hide();
        $('#env-variables-section').hide();
    });

    // Update repository URL with credentials - improved version
    $(document).on('click', '#update-repo-url-with-auth-btn', function() {
        // Get values from form
        const username = $('#env-git-user-name-input').val();
        const token = $('#env-github-token-input').val();
        let repoUrl = $('#env-git-repo-url-input').val();
        
        if (!username || !token || !repoUrl) {
            showNotification('Please fill in username, token, and repository URL first', 'warning');
            return;
        }
        
        // Make sure URL is in the correct format
        if (!repoUrl.startsWith('https://')) {
            showNotification('Repository URL must start with https://', 'warning');
            return;
        }
        
        // Remove any existing auth info
        repoUrl = repoUrl.replace(/https:\/\/[^@]+@github\.com/, 'https://github.com');
        
        // Add new auth info
        const newUrl = repoUrl.replace('https://github.com', `https://${username}:${token}@github.com`);
        
        // Update the input field
        $('#env-git-repo-url-input').val(newUrl);
        
        // Apply the URL immediately
        if (confirm('Do you want to apply this URL to your Git repository now?')) {
            $.ajax({
                url: '/api/git/set-remote',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ url: newUrl }),
                success: function(response) {
                    if (response.success) {
                        showNotification('Repository URL with authentication applied successfully', 'success');
                        
                        // Save to environment variables
                        const formData = {
                            GIT_REPOSITORY_URL: newUrl
                        };
                        
                        $.ajax({
                            url: '/api/env/variables',
                            type: 'POST',
                            contentType: 'application/json',
                            data: JSON.stringify(formData),
                            success: function() {
                                // Refresh Git test results
                                setTimeout(function() {
                                    $('#test-git-btn').click();
                                }, 1000);
                            }
                        });
                    } else {
                        showNotification('Error applying repository URL: ' + response.error, 'danger');
                    }
                },
                error: function(xhr) {
                    showNotification('Error applying repository URL', 'danger');
                }
            });
        } else {
            showNotification('Repository URL updated with authentication. Click "Save Changes" to save to environment variables.', 'info');
        }
    });

    // Fix "Username not found" error
    $(document).on('click', '#fix-auth-url-btn', function() {
        if (confirm('This will fix the "could not read Username for https://github.com" error by embedding your credentials in the repository URL. Continue?')) {
            $.ajax({
                url: '/api/git/fix-auth-url',
                type: 'POST',
                success: function(response) {
                    if (response.success) {
                        showNotification(response.message, 'success');
                        // Refresh Git test results
                        setTimeout(function() {
                            $('#test-git-btn').click();
                        }, 1000);
                    } else {
                        showNotification('Error: ' + response.error, 'danger');
                    }
                },
                error: function(xhr) {
                    let errorMsg = 'Error fixing authentication URL';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg += ': ' + response.error;
                        }
                    } catch (e) {
                        errorMsg += ': ' + xhr.statusText;
                    }
                    showNotification(errorMsg, 'danger');
                }
            });
        }
    });

    // Fix rejected push
    $(document).on('click', '#fix-rejected-push-btn', function() {
        if (confirm('This will attempt to fix the "Updates were rejected" error by integrating remote changes. Any uncommitted changes may be stashed. Continue?')) {
            $.ajax({
                url: '/api/git/fix-rejected-push',
                type: 'POST',
                success: function(response) {
                    if (response.success) {
                        showNotification(response.message, 'success');
                    } else {
                        showNotification('Error: ' + response.error, 'danger');
                    }
                    // Refresh Git test results
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                },
                error: function(xhr) {
                    let errorMsg = 'Error fixing rejected push';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg += ': ' + response.error;
                        }
                    } catch (e) {
                        errorMsg += ': ' + xhr.statusText;
                    }
                    showNotification(errorMsg, 'danger');
                }
            });
        }
    });

    // Save changes to Git with comprehensive error handling
    $(document).on('click', '#save-to-git-btn', function() {
        const message = prompt('Enter a commit message for your changes:', 'Update from web interface');
        if (!message) return; // User cancelled
        
        // Show loading indicator
        const $btn = $(this);
        const originalText = $btn.html();
        $btn.html('<i class="fas fa-spinner fa-spin"></i> Saving...');
        $btn.prop('disabled', true);
        
        showNotification('Saving changes to Git...', 'info');
        
        $.ajax({
            url: '/api/git/save-changes',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                message: message,
                auto_fix: true  // Enable automatic fixes
            }),
            success: function(response) {
                // Reset button
                $btn.html(originalText);
                $btn.prop('disabled', false);
                
                if (response.success) {
                    showNotification(response.message, 'success');
                    
                    // If there's a warning, show it
                    if (response.warning) {
                        showNotification('Warning: ' + response.warning, 'warning');
                    }
                    
                    // Refresh Git status
                    refreshGitStatus();
                    
                    // Refresh Git test results if they're visible
                    if ($('#git-test-results').is(':visible')) {
                        setTimeout(function() {
                            $('#test-git-btn').click();
                        }, 1000);
                    }
                } else {
                    // Handle specific error types
                    switch(response.error_type) {
                        case 'auth':
                            showNotification(response.error, 'danger');
                            // Suggest fix
                            if (confirm('Would you like to fix the authentication issue now?')) {
                                $('#fix-credentials-btn').click();
                            }
                            break;
                            
                        case 'rejected':
                            showNotification(response.error, 'danger');
                            // Suggest fix
                            if (confirm('Would you like to fix the rejected push issue now?')) {
                                $('#fix-rejected-push-btn').click();
                            }
                            break;
                            
                        case 'locked':
                            showNotification(response.error, 'warning');
                            // Set a timer to try again
                            setTimeout(function() {
                                if (confirm('Another Git operation was in progress. Would you like to try saving again?')) {
                                    $('#save-to-git-btn').click();
                                }
                            }, 5000);
                            break;
                            
                        case 'no_remote':
                        case 'invalid_remote':
                            showNotification(response.error, 'danger');
                            // Suggest fix
                            if (confirm('Would you like to fix the remote repository configuration now?')) {
                                $('#fix-remote-btn').click();
                            }
                            break;
                            
                        case 'head_state':
                            showNotification(response.error, 'danger');
                            // This is a more complex issue, just show a detailed message
                            alert('Git HEAD state issue detected. This usually happens when Git is in "detached HEAD" state. The system will attempt to fix this automatically on the next save operation.');
                            break;
                            
                        default:
                            showNotification('Error: ' + response.error, 'danger');
                    }
                }
            },
            error: function(xhr) {
                // Reset button
                $btn.html(originalText);
                $btn.prop('disabled', false);
                
                let errorMsg = 'Error saving to Git';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg += ': ' + response.error;
                    }
                } catch (e) {
                    errorMsg += ': ' + xhr.statusText;
                }
                showNotification(errorMsg, 'danger');
            }
        });
    });

    // Function to refresh Git status with comprehensive information
    function refreshGitStatus() {
        $.ajax({
            url: '/api/git/status',
            type: 'GET',
            success: function(response) {
                if (response.success) {
                    // Update branch info
                    $('#git-branch').text(response.branch);
                    
                    // Update changes count
                    $('#git-changes-count').text(response.changes.length);
                    
                    // Update changes list
                    const $changesList = $('#git-changes-list');
                    $changesList.empty();
                    
                    if (response.changes.length === 0) {
                        $changesList.append('<li class="list-group-item">No pending changes</li>');
                    } else {
                        response.changes.forEach(function(change) {
                            const statusClass = getStatusClass(change.status);
                            $changesList.append(`
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <span>${change.file}</span>
                                    <span class="badge ${statusClass}">${change.status}</span>
                                </li>
                            `);
                        });
                    }
                    
                    // Update last commit info if available
                    if (response.last_commit) {
                        $('#git-last-commit').html(`
                            <strong>Last Commit:</strong> ${response.last_commit.hash} - 
                            ${response.last_commit.message} (${response.last_commit.time} by ${response.last_commit.author})
                        `);
                    } else {
                        $('#git-last-commit').text('No commits yet');
                    }
                    
                    // Update pending commits section
                    const $pendingCommitsList = $('#git-pending-commits-list');
                    $pendingCommitsList.empty();
                    
                    if (response.pending_commits.length === 0) {
                        $('#git-pending-commits-section').hide();
                    } else {
                        $('#git-pending-commits-section').show();
                        response.pending_commits.forEach(function(commit) {
                            $pendingCommitsList.append(`
                                <li class="list-group-item">
                                    <code>${commit.hash}</code> - ${commit.message}
                                </li>
                            `);
                        });
                        
                        // Show a warning if there are pending commits
                        if (!$('#pending-commits-warning').length) {
                            $('#git-status-card .card-body').prepend(`
                                <div id="pending-commits-warning" class="alert alert-warning">
                                    <i class="fas fa-exclamation-triangle"></i> 
                                    You have ${response.pending_commits.length} commit(s) that haven't been pushed to the remote.
                                    <button id="handle-pending-btn" class="btn btn-sm btn-warning ms-2">
                                        Handle Now
                                    </button>
                                </div>
                            `);
                            
                            // Add click handler for the "Handle Now" button
                            $('#handle-pending-btn').on('click', function() {
                                $('#handle-commits-btn').click();
                            });
                        }
                    }
                } else {
                    showNotification('Error refreshing Git status: ' + response.error, 'warning');
                }
            },
            error: function() {
                showNotification('Failed to refresh Git status', 'warning');
            }
        });
    }

    // Helper function to get badge class for Git status
    function getStatusClass(status) {
        switch(status.charAt(0)) {
            case 'M': return 'bg-warning';  // Modified
            case 'A': return 'bg-success';  // Added
            case 'D': return 'bg-danger';   // Deleted
            case 'R': return 'bg-info';     // Renamed
            case '?': return 'bg-secondary'; // Untracked
            default: return 'bg-primary';
        }
    }

    // Refresh Git status on page load and when refresh button is clicked
    $(document).ready(function() {
        // Initial load of Git status
        refreshGitStatus();
        
        // Refresh button
        $(document).on('click', '#refresh-git-status-btn', function() {
            refreshGitStatus();
            showNotification('Git status refreshed', 'info');
        });
    });

    // Fix remote repository
    $(document).on('click', '#fix-remote-btn', function() {
        // Get the repository URL from the form
        const repoUrl = $('#env-git-repo-url-input').val();
        
        if (!repoUrl) {
            showNotification('Please enter a repository URL in the settings form first', 'warning');
            return;
        }
        
        if (confirm(`This will reconfigure your Git remote to use: ${repoUrl}\nContinue?`)) {
            // Show loading indicator
            const $btn = $(this);
            const originalText = $btn.html();
            $btn.html('<i class="fas fa-spinner fa-spin"></i> Fixing...');
            $btn.prop('disabled', true);
            
            $.ajax({
                url: '/api/git/fix-remote',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ url: repoUrl }),
                success: function(response) {
                    // Reset button
                    $btn.html(originalText);
                    $btn.prop('disabled', false);
                    
                    if (response.success) {
                        showNotification(response.message, 'success');
                        
                        // If there's a warning, show it
                        if (response.warning) {
                            showNotification('Warning: ' + response.warning, 'warning');
                            
                            // If it's an auth issue, suggest fixing credentials
                            if (response.error_type === 'auth' && 
                                confirm('Would you like to fix the authentication issue now?')) {
                                $('#fix-credentials-btn').click();
                            }
                        }
                        
                        // Save to environment variables
                        const formData = {
                            GIT_REPOSITORY_URL: repoUrl
                        };
                        
                        $.ajax({
                            url: '/api/env/variables',
                            type: 'POST',
                            contentType: 'application/json',
                            data: JSON.stringify(formData)
                        });
                        
                        // Refresh Git test results
                        setTimeout(function() {
                            $('#test-git-btn').click();
                        }, 1000);
                    } else {
                        showNotification('Error: ' + response.error, 'danger');
                    }
                },
                error: function(xhr) {
                    // Reset button
                    $btn.html(originalText);
                    $btn.prop('disabled', false);
                    
                    let errorMsg = 'Error fixing remote repository';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.error) {
                            errorMsg += ': ' + response.error;
                        }
                    } catch (e) {
                        errorMsg += ': ' + xhr.statusText;
                    }
                    showNotification(errorMsg, 'danger');
                }
            });
        }
    });

    // Handle pending commits
    $(document).on('click', '#handle-commits-btn', function() {
        // Show the modal
        $('#pendingCommitsModal').modal('show');
    });

    // Confirm handling of pending commits
    $(document).on('click', '#confirmHandleCommits', function() {
        const action = $('input[name="commitAction"]:checked').val();
        
        // Close the modal
        $('#pendingCommitsModal').modal('hide');
        
        // Show loading notification
        showNotification('Processing pending commits...', 'info');
        
        $.ajax({
            url: '/api/git/handle-pending-commits',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: action }),
            success: function(response) {
                if (response.success) {
                    showNotification(response.message, 'success');
                    
                    // Refresh Git test results
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                } else {
                    showNotification('Error: ' + response.error, 'danger');
                }
            },
            error: function(xhr) {
                let errorMsg = 'Error handling pending commits';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg += ': ' + response.error;
                    }
                } catch (e) {
                    errorMsg += ': ' + xhr.statusText;
                }
                showNotification(errorMsg, 'danger');
            }
        });
    });

    // Debug template loading
    if (typeof loadTemplates === 'function') {
        console.log("loadTemplates function exists");
    } else {
        console.error("loadTemplates function is missing!");
    }
});

// Initialize application
function initApp() {
    // Load dashboard data
    loadDashboardData();
}

// Load data for a specific section
function loadSectionData(section) {
    console.log(`Loading data for section: ${section}`);
    
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'caregivers':
            loadCaregivers();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'activities':
            loadActivities();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'calendars':
            loadCalendars();
            break;
        case 'backups':
            loadBackups();
            loadGitStatus();
            loadEnvironmentVariables();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// Dashboard Data
function loadDashboardData() {
    // Load counts
    $.get('/api/caregivers', function(data) {
        caregivers = data;
        $('#caregiver-count').text(data.length);
        populateRecentCaregivers();
    });
    
    $.get('/api/activities', function(data) {
        activities = data;
        $('#activity-count').text(data.length);
        populateRecentActivities();
    });
    
    $.get('/api/templates', function(data) {
        templates = data;
        $('#template-count').text(data.length);
    });
}

// Populate recent caregivers in dashboard
function populateRecentCaregivers() {
    if (!caregivers || !Array.isArray(caregivers) || caregivers.length === 0) {
        $('#recent-caregivers').html('<div class="text-center">No caregivers found</div>');
        return;
    }
    
    // Sort caregivers by performance score in descending order
    const sortedCaregivers = [...caregivers].sort((a, b) => {
        const scoreA = parseFloat(a.performance_score) || 0;
        const scoreB = parseFloat(b.performance_score) || 0;
        return scoreB - scoreA;
    });
    
    // Get the top 5 caregivers
    const topCaregivers = sortedCaregivers.slice(0, 5);
    
    let html = '';
    topCaregivers.forEach(caregiver => {
        const imgSrc = caregiver.picture 
            ? `/static/${caregiver.picture}` 
            : 'https://via.placeholder.com/40';
        
        // Get the default rate
        const defaultRate = caregiver.default_hourly_rate || caregiver.hourly_rate || 'N/A';
        
        html += `
            <div class="col-6 col-md-4 col-lg-2 mb-3">
                <div class="card">
                    <div class="card-body text-center">
                        <img src="${imgSrc}" class="rounded-circle mb-2" alt="${caregiver.name || 'Caregiver'}" style="width: 60px; height: 60px; object-fit: cover;">
                        <h6 class="mb-0">
                            ${caregiver.name || 'Unnamed'}
                            ${caregiver.initials ? `<span class="badge bg-secondary">${caregiver.initials}</span>` : ''}
                        </h6>
                        <p class="text-muted small mb-1">Score: ${caregiver.performance_score || 'N/A'}</p>
                        <p class="small mb-0">Rate: $${defaultRate}</p>
                    </div>
                </div>
            </div>
        `;
    });
    
    $('#recent-caregivers').html(html);
}

// Populate recent activities in dashboard
function populateRecentActivities() {
    const recentActivities = activities.slice(0, 5);
    let html = '';
    
    recentActivities.forEach(activity => {
        const category = categories.find(c => c.id === activity.category_id) || { name: 'N/A' };
        html += `
            <tr>
                <td>${activity.name}</td>
                <td>${category.name}</td>
            </tr>
        `;
    });
    
    $('#recent-activities').html(html || '<tr><td colspan="2" class="text-center">No activities found</td></tr>');
}

// Show notification toast
function showNotification(message, success = true) {
    $('#toast-message').text(message);
    $('#notification-toast').removeClass('bg-success bg-danger')
        .addClass(success ? 'bg-success' : 'bg-danger')
        .toast('show');
}

// Backup and Git Operations
function backupData() {
    const description = prompt('Enter a description for this backup (optional):');
    const url = description ? `/api/backup?description=${encodeURIComponent(description)}` : '/api/backup';
    
    $.get(url, function(response) {
        showNotification('Backup created successfully!');
        loadBackups();
    }).fail(function() {
        showNotification('Failed to create backup!', false);
    });
}

function loadBackups() {
    $.get('/api/backups', function(data) {
        backups = data;
        populateBackups();
    }).fail(function() {
        showNotification('Failed to load backups!', false);
    });
}

function populateBackups() {
    let html = '';
    
    backups.forEach(backup => {
        const created = backup.metadata.created_at 
            ? new Date(backup.metadata.created_at).toLocaleString()
            : 'Unknown';
            
        html += `
            <tr>
                <td>${backup.id}</td>
                <td>${created}</td>
                <td>${backup.metadata.description || ''}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-warning restore-backup" data-id="${backup.id}">
                        <i class="fa-solid fa-undo"></i> Restore
                    </button>
                </td>
            </tr>
        `;
    });
    
    $('#backups-list').html(html || '<tr><td colspan="4" class="text-center">No backups found</td></tr>');
    
    // Add event handlers
    $('.restore-backup').on('click', function() {
        const id = $(this).data('id');
        restoreBackup(id);
    });
}

function restoreBackup(id) {
    if (confirm(`Are you sure you want to restore from backup ${id}? This will overwrite current data.`)) {
        $.ajax({
            url: `/api/restore/${id}`,
            type: 'POST',
            success: function(response) {
                showNotification('Backup restored successfully!');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            },
            error: function() {
                showNotification('Failed to restore backup!', false);
            }
        });
    }
}

function loadGitStatus() {
    $.get('/api/git/status', function(data) {
        gitStatus = data;
        updateGitStatusDisplay();
    }).fail(function() {
        showNotification('Failed to load Git status!', false);
    });
}

function updateGitStatusDisplay() {
    // Update branch name
    $('#git-branch').text(gitStatus.branch || 'Unknown');
    
    // Update changes count
    const changesCount = gitStatus.changes ? gitStatus.changes.length : 0;
    $('#git-changes-count').text(changesCount);
    
    // Update changes list
    let changesHtml = '';
    if (gitStatus.changes && gitStatus.changes.length > 0) {
        changesHtml = gitStatus.changes.map(change => `<li class="list-group-item">${change}</li>`).join('');
    } else {
        changesHtml = '<li class="list-group-item">No changes detected</li>';
    }
    $('#git-changes-list').html(changesHtml);
    
    // Update push button status
    $('#push-changes-btn').prop('disabled', !gitStatus.has_changes);
}

function pushChanges() {
    const message = prompt('Enter a commit message:');
    if (!message) return;
    
    $.ajax({
        url: '/api/git/push',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ message }),
        success: function(response) {
            showNotification('Changes pushed successfully!');
            loadGitStatus();
        },
        error: function(xhr) {
            const errorMsg = xhr.responseJSON && xhr.responseJSON.error 
                ? xhr.responseJSON.error 
                : 'Failed to push changes!';
            showNotification(errorMsg, false);
        }
    });
}

// Caregiver CRUD Operations
function loadCaregivers() {
    $.get('/api/caregivers', function(data) {
        caregivers = data;
        populateCaregivers();
    });
}

function populateCaregivers() {
    let html = '';
    
    caregivers.forEach(caregiver => {
        const imgSrc = caregiver.picture 
            ? `/static/${caregiver.picture}` 
            : 'https://via.placeholder.com/40';
            
        // Get the default rate
        const defaultRate = caregiver.default_hourly_rate || caregiver.hourly_rate || 'N/A';
        
        // Format location rates if available
        let locationRatesHtml = '';
        if (caregiver.location_rates && Array.isArray(caregiver.location_rates) && caregiver.location_rates.length > 0) {
            const safeContent = formatLocationRates(caregiver.location_rates);
            const safeName = caregiver.name ? 
                caregiver.name.replace(/"/g, '&quot;').replace(/'/g, '&#039;') : 
                'Caregiver';
                
            locationRatesHtml = `
                <button class="btn btn-sm btn-outline-info location-rates-btn" 
                    data-caregiver-id="${caregiver.id}">
                    <i class="fas fa-map-marker-alt"></i> View Rates
                </button>
            `;
        }
            
        html += `
            <tr>
                <td><img src="${imgSrc}" class="caregiver-img" alt="${caregiver.name || ''}"></td>
                <td>
                    ${caregiver.name || ''}
                    ${caregiver.initials ? `<span class="badge bg-secondary">${caregiver.initials}</span>` : ''}
                </td>
                <td>${caregiver.performance_score || 'N/A'}</td>
                <td>
                    $${defaultRate}
                    ${locationRatesHtml}
                </td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary edit-caregiver" data-id="${caregiver.id}">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-caregiver" data-id="${caregiver.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    $('#caregivers-list').html(html || '<tr><td colspan="5" class="text-center">No caregivers found</td></tr>');
    
    // Set up location rates popovers after the HTML is added to the DOM
    $('.location-rates-btn').each(function() {
        const caregiverId = $(this).data('caregiver-id');
        const caregiver = caregivers.find(c => c.id === caregiverId);
        
        if (caregiver && caregiver.location_rates) {
            const title = `Location Rates for ${caregiver.name || 'Caregiver'}`;
            const content = formatLocationRates(caregiver.location_rates);
            
            // Initialize popover
            new bootstrap.Popover(this, {
                title: title,
                content: content,
                html: true,
                trigger: 'click',
                placement: 'top'
            });
        }
    });
    
    // Add event handlers
    $('.edit-caregiver').on('click', function() {
        const id = $(this).data('id');
        editCaregiver(id);
    });
    
    $('.delete-caregiver').on('click', function() {
        const id = $(this).data('id');
        deleteCaregiver(id);
    });
    
    // Add global click handler to close popovers when clicking outside
    $(document).off('click.popoverClose').on('click.popoverClose', function(e) {
        if ($(e.target).closest('.popover').length === 0 && 
            !$(e.target).hasClass('location-rates-btn') && 
            $(e.target).closest('.location-rates-btn').length === 0) {
            $('.location-rates-btn').each(function() {
                const popover = bootstrap.Popover.getInstance(this);
                if (popover) {
                    popover.hide();
                }
            });
        }
    });
}

// Format location rates for popover display
function formatLocationRates(rates) {
    // Check if rates is valid
    if (!rates || !Array.isArray(rates) || rates.length === 0) {
        return '<div class="text-center p-2">No location rates available</div>';
    }
    
    let html = '<div class="location-rates-table">';
    html += '<table class="table table-sm mb-0">';
    html += '<thead><tr><th>Location</th><th>Rate</th></tr></thead>';
    html += '<tbody>';
    
    // Only process valid rates
    rates.forEach(rate => {
        if (rate && rate.location && rate.rate !== undefined) {
            // Escape location name for XSS protection
            const safeLoc = rate.location
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
                
            html += `<tr>
                <td>${safeLoc}</td>
                <td>$${rate.rate}</td>
            </tr>`;
        }
    });
    
    html += '</tbody></table></div>';
    return html;
}

function showCaregiverModal(caregiver = null) {
    // Reset form
    $('#caregiver-form')[0].reset();
    $('#picture-preview').empty();
    
    // Clear any existing location rate fields except the first one
    $('.location-rate-item:not(:first)').remove();
    
    // Reset the first location rate field
    $('.location-name:first').val('');
    $('.location-rate:first').val('');
    
    if (caregiver) {
        // Edit mode
        $('#caregiverModalLabel').text('Edit Caregiver');
        $('#caregiver-id').val(caregiver.id);
        $('#caregiver-name').val(caregiver.name);
        $('#caregiver-initials').val(caregiver.initials || '');
        $('#caregiver-performance').val(caregiver.performance_score);
        $('#caregiver-default-rate').val(caregiver.default_hourly_rate || caregiver.hourly_rate || '');
        
        // Load location rates if they exist
        if (caregiver.location_rates && caregiver.location_rates.length > 0) {
            // Clear the first empty row
            $('#location-rates-container').empty();
            
            // Add each location rate
            caregiver.location_rates.forEach(locationRate => {
                const newField = `
                    <div class="location-rate-item row mb-2">
                        <div class="col-md-6">
                            <input type="text" class="form-control location-name" placeholder="Location Name" name="location_names[]" value="${locationRate.location || ''}">
                        </div>
                        <div class="col-md-5">
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control location-rate" placeholder="Rate" name="location_rates[]" min="0" step="0.01" value="${locationRate.rate || ''}">
                            </div>
                        </div>
                        <div class="col-md-1">
                            <button type="button" class="btn btn-sm btn-danger remove-location"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
                $('#location-rates-container').append(newField);
            });
        }
        
        if (caregiver.picture) {
            $('#picture-preview').html(`<img src="/static/${caregiver.picture}" class="mt-2 img-thumbnail">`);
        }
    } else {
        // Add mode
        $('#caregiverModalLabel').text('Add Caregiver');
        $('#caregiver-id').val('');
    }
    
    // Show modal
    const caregiverModal = new bootstrap.Modal(document.getElementById('caregiverModal'));
    caregiverModal.show();
}

function saveCaregiver() {
    const id = $('#caregiver-id').val();
    const formData = new FormData($('#caregiver-form')[0]);
    
    // Process location rates
    const locationNames = [];
    $('input[name="location_names[]"]').each(function() {
        locationNames.push($(this).val());
    });
    
    const locationRates = [];
    $('input[name="location_rates[]"]').each(function() {
        locationRates.push($(this).val());
    });
    
    // Create location rates array for JSON
    const locationRatesArray = [];
    for (let i = 0; i < locationNames.length; i++) {
        if (locationNames[i] && locationRates[i]) {
            locationRatesArray.push({
                location: locationNames[i],
                rate: parseFloat(locationRates[i])
            });
        }
    }
    
    // Add location rates as JSON string
    formData.append('location_rates_json', JSON.stringify(locationRatesArray));
    
    // For backward compatibility
    if (formData.get('default_hourly_rate')) {
        formData.append('hourly_rate', formData.get('default_hourly_rate'));
    }
    
    if (id) {
        // Update
        $.ajax({
            url: `/api/caregivers/${id}`,
            type: 'PUT',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('caregiverModal')).hide();
                loadCaregivers();
                showNotification('Caregiver updated successfully!');
            },
            error: function() {
                showNotification('Failed to update caregiver!', false);
            }
        });
    } else {
        // Create
        $.ajax({
            url: '/api/caregivers',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('caregiverModal')).hide();
                loadCaregivers();
                loadDashboardData();
                showNotification('Caregiver added successfully!');
            },
            error: function() {
                showNotification('Failed to add caregiver!', false);
            }
        });
    }
}

function editCaregiver(id) {
    $.get(`/api/caregivers/${id}`, function(caregiver) {
        showCaregiverModal(caregiver);
    });
}

function deleteCaregiver(id) {
    if (confirm('Are you sure you want to delete this caregiver?')) {
        $.ajax({
            url: `/api/caregivers/${id}`,
            type: 'DELETE',
            success: function() {
                loadCaregivers();
                loadDashboardData();
                showNotification('Caregiver deleted successfully!');
            },
            error: function() {
                showNotification('Failed to delete caregiver!', false);
            }
        });
    }
}

// Category CRUD Operations
function loadCategories() {
    return $.get('/api/categories', function(data) {
        categories = data;
        populateCategories();
    });
}

function populateCategories() {
    let html = '';
    
    categories.forEach(category => {
        html += `
            <tr>
                <td>${category.name}</td>
                <td>${category.description || ''}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary edit-category" data-id="${category.id}">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-category" data-id="${category.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    $('#categories-list').html(html || '<tr><td colspan="3" class="text-center">No categories found</td></tr>');
    
    // Add event handlers
    $('.edit-category').on('click', function() {
        const id = $(this).data('id');
        editCategory(id);
    });
    
    $('.delete-category').on('click', function() {
        const id = $(this).data('id');
        deleteCategory(id);
    });
}

function populateCategorySelect(selector) {
    let html = '<option value="">Select Category</option>';
    
    categories.forEach(category => {
        html += `<option value="${category.id}">${category.name}</option>`;
    });
    
    $(selector).html(html);
}

function showCategoryModal(category = null) {
    // Reset form
    $('#category-form')[0].reset();
    
    if (category) {
        // Edit mode
        $('#categoryModalLabel').text('Edit Category');
        $('#category-id').val(category.id);
        $('#category-name').val(category.name);
        $('#category-description').val(category.description);
    } else {
        // Add mode
        $('#categoryModalLabel').text('Add Category');
        $('#category-id').val('');
    }
    
    // Show modal
    const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
    categoryModal.show();
}

function saveCategory() {
    const id = $('#category-id').val();
    const data = {
        name: $('#category-name').val(),
        description: $('#category-description').val()
    };
    
    if (id) {
        // Update
        $.ajax({
            url: `/api/categories/${id}`,
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
                loadCategories();
                loadActivities();
                showNotification('Category updated successfully!');
            },
            error: function() {
                showNotification('Failed to update category!', false);
            }
        });
    } else {
        // Create
        $.ajax({
            url: '/api/categories',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
                loadCategories();
                showNotification('Category added successfully!');
            },
            error: function() {
                showNotification('Failed to add category!', false);
            }
        });
    }
}

function editCategory(id) {
    $.get(`/api/categories/${id}`, function(category) {
        showCategoryModal(category);
    });
}

function deleteCategory(id) {
    if (confirm('Are you sure you want to delete this category? This will affect activities in this category.')) {
        $.ajax({
            url: `/api/categories/${id}`,
            type: 'DELETE',
            success: function() {
                loadCategories();
                loadActivities();
                showNotification('Category deleted successfully!');
            },
            error: function() {
                showNotification('Failed to delete category!', false);
            }
        });
    }
}

// Activity CRUD Operations
function loadActivities(categoryId = '') {
    const url = categoryId ? `/api/activities?category_id=${categoryId}` : '/api/activities';
    
    $.get(url, function(data) {
        activities = data;
        populateActivities();
    });
}

function populateActivities() {
    let html = '';
    
    activities.forEach(activity => {
        const category = categories.find(c => c.id === activity.category_id) || { name: 'N/A' };
        
        html += `
            <tr>
                <td>${activity.name}</td>
                <td>${category.name}</td>
                <td>${activity.description || ''}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary edit-activity" data-id="${activity.id}">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-activity" data-id="${activity.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    $('#activities-list').html(html || '<tr><td colspan="4" class="text-center">No activities found</td></tr>');
    
    // Add event handlers
    $('.edit-activity').on('click', function() {
        const id = $(this).data('id');
        editActivity(id);
    });
    
    $('.delete-activity').on('click', function() {
        const id = $(this).data('id');
        deleteActivity(id);
    });
}

function showActivityModal(activity = null) {
    // Reset form
    $('#activity-form')[0].reset();
    
    if (activity) {
        // Edit mode
        $('#activityModalLabel').text('Edit Activity');
        $('#activity-id').val(activity.id);
        $('#activity-name').val(activity.name);
        $('#activity-category').val(activity.category_id);
        $('#activity-description').val(activity.description);
        $('#activity-duration').val(activity.duration);
    } else {
        // Add mode
        $('#activityModalLabel').text('Add Activity');
        $('#activity-id').val('');
    }
    
    // Show modal
    const activityModal = new bootstrap.Modal(document.getElementById('activityModal'));
    activityModal.show();
}

function saveActivity() {
    const id = $('#activity-id').val();
    const data = {
        name: $('#activity-name').val(),
        category_id: $('#activity-category').val(),
        description: $('#activity-description').val(),
        duration: $('#activity-duration').val()
    };
    
    if (id) {
        // Update
        $.ajax({
            url: `/api/activities/${id}`,
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('activityModal')).hide();
                loadActivities($('#filter-category').val());
                loadDashboardData();
                showNotification('Activity updated successfully!');
            },
            error: function() {
                showNotification('Failed to update activity!', false);
            }
        });
    } else {
        // Create
        $.ajax({
            url: '/api/activities',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                bootstrap.Modal.getInstance(document.getElementById('activityModal')).hide();
                loadActivities($('#filter-category').val());
                loadDashboardData();
                showNotification('Activity added successfully!');
            },
            error: function() {
                showNotification('Failed to add activity!', false);
            }
        });
    }
}

function editActivity(id) {
    $.get(`/api/activities/${id}`, function(activity) {
        showActivityModal(activity);
    });
}

function deleteActivity(id) {
    if (confirm('Are you sure you want to delete this activity?')) {
        $.ajax({
            url: `/api/activities/${id}`,
            type: 'DELETE',
            success: function() {
                loadActivities($('#filter-category').val());
                loadDashboardData();
                showNotification('Activity deleted successfully!');
            },
            error: function() {
                showNotification('Failed to delete activity!', false);
            }
        });
    }
}

// Add new location rate field
function addLocationRateField() {
    const newField = `
        <div class="location-rate-item row mb-2">
            <div class="col-md-6">
                <input type="text" class="form-control location-name" placeholder="Location Name" name="location_names[]">
            </div>
            <div class="col-md-5">
                <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input type="number" class="form-control location-rate" placeholder="Rate" name="location_rates[]" min="0" step="0.01">
                </div>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-sm btn-danger remove-location"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;
    $('#location-rates-container').append(newField);
}

// Load environment variables
function loadEnvironmentVariables() {
    $.ajax({
        url: '/api/env/variables',
        type: 'GET',
        success: function(data) {
            // Update form fields
            $('#env-git-user-name-input').val(data.GIT_USER_NAME || '');
            $('#env-git-user-email-input').val(data.GIT_USER_EMAIL || '');
            $('#env-git-repo-url-input').val(data.GIT_REPOSITORY_URL || '');
            $('#env-git-branch-input').val(data.GIT_BRANCH || 'main');
            $('#env-github-token-input').val(data.GITHUB_TOKEN || '');
            $('#env-git-auto-push-input').prop('checked', data.GIT_AUTO_PUSH === 'true');
            $('#env-allow-git-in-production-input').prop('checked', data.ALLOW_GIT_IN_PRODUCTION === 'true');
        },
        error: function(xhr) {
            showNotification('Error loading environment variables', 'danger');
        }
    });
}

// Save environment variables
$(document).on('click', '#save-env-btn', function() {
    // Collect form data
    const formData = {
        GIT_USER_NAME: $('#env-git-user-name-input').val(),
        GIT_USER_EMAIL: $('#env-git-user-email-input').val(),
        GIT_REPOSITORY_URL: $('#env-git-repo-url-input').val(),
        GIT_BRANCH: $('#env-git-branch-input').val(),
        GITHUB_TOKEN: $('#env-github-token-input').val(),
        GIT_AUTO_PUSH: $('#env-git-auto-push-input').is(':checked') ? 'true' : 'false',
        ALLOW_GIT_IN_PRODUCTION: $('#env-allow-git-in-production-input').is(':checked') ? 'true' : 'false'
    };
    
    // Send to server
    $.ajax({
        url: '/api/env/variables',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(formData),
        success: function(response) {
            if (response.success) {
                showNotification('Environment variables updated successfully', 'success');
                
                // If there's a warning, show it
                if (response.warning) {
                    showNotification(response.warning, 'warning');
                }
                
                // Refresh Git test results if they're visible
                if ($('#git-test-results').is(':visible')) {
                    setTimeout(function() {
                        $('#test-git-btn').click();
                    }, 1000);
                }
            } else {
                showNotification('Error updating environment variables: ' + response.error, 'danger');
            }
        },
        error: function(xhr) {
            let errorMsg = 'Error updating environment variables';
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMsg += ': ' + response.error;
                }
            } catch (e) {
                errorMsg += ': ' + xhr.statusText;
            }
            showNotification(errorMsg, 'danger');
        }
    });
});

// Refresh environment variables
$(document).on('click', '#refresh-env-btn', function() {
    loadEnvironmentVariables();
    showNotification('Environment variables refreshed', 'info');
});

// Add this function to main.js if it's missing
function loadTemplates() {
    return $.get('/api/templates', function(data) {
        window.templates = data;
        populateTemplates();
    }).fail(function(error) {
        console.error("Failed to load templates:", error);
        showNotification('Failed to load templates', 'danger');
    });
}

// Make sure this function exists
function loadSectionData(section) {
    console.log(`Loading data for section: ${section}`);
    
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'caregivers':
            loadCaregivers();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'activities':
            loadActivities();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'calendars':
            loadCalendars();
            break;
        // Add other sections as needed
    }
} 