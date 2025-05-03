/**
 * Templates and Calendars Module
 * Handles all functionality related to schedule templates and calendars
 */

// ==========================================
// GLOBAL VARIABLES
// ==========================================
const templateModule = {
    templates: [],
    calendars: [],
    currentTemplate: null,
    currentScheduleData: {},
    currentCellDay: '',
    currentCellTime: '',
    currentCellData: { caregivers: [], activities: [] }
};

// ==========================================
// TEMPLATE OPERATIONS
// ==========================================

/**
 * Load all templates from the server
 */
function loadTemplates() {
    console.log("Loading templates...");
    
    return $.ajax({
        url: '/api/templates',
        type: 'GET',
        success: function(data) {
            console.log(`Loaded ${data.length} templates`);
            templateModule.templates = data;
            displayTemplates();
        },
        error: function(xhr) {
            console.error("Failed to load templates:", xhr);
            showNotification('Failed to load templates', 'danger');
        }
    });
}

/**
 * Display templates in the UI
 */
function displayTemplates() {
    let html = '';
    
    if (templateModule.templates.length === 0) {
        $('#templates-list').html('<div class="col-12 text-center">No templates found</div>');
        return;
    }
    
    templateModule.templates.forEach(template => {
        html += `
            <div class="col-md-4 mb-4">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${template.name}</h5>
                        <p class="card-text">${template.description || 'No description'}</p>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-sm btn-primary edit-schedule" data-id="${template.id}">
                                <i class="fa-solid fa-calendar-days"></i> Edit Schedule
                            </button>
                            <div>
                                <button class="btn btn-sm btn-outline-primary edit-template" data-id="${template.id}">
                                    <i class="fa-solid fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-template" data-id="${template.id}">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    $('#templates-list').html(html);
    
    // Attach event handlers
    $('.edit-template').on('click', function() {
        const id = $(this).data('id');
        editTemplate(id);
    });
    
    $('.delete-template').on('click', function() {
        const id = $(this).data('id');
        deleteTemplate(id);
    });
    
    $('.edit-schedule').on('click', function() {
        const id = $(this).data('id');
        editSchedule(id);
    });
}

/**
 * Show modal for adding/editing a template
 */
function showTemplateModal(template = null) {
    console.log("Showing template modal", template);
    
    // Reset form
    $('#template-form')[0].reset();
    
    if (template) {
        // Edit mode
        $('#templateModalLabel').text('Edit Template');
        $('#template-id').val(template.id);
        $('#template-name').val(template.name);
        $('#template-description').val(template.description);
    } else {
        // Add mode
        $('#templateModalLabel').text('Add Template');
        $('#template-id').val('');
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('templateModal'));
    modal.show();
}

/**
 * Save template to server
 */
function saveTemplate() {
    const id = $('#template-id').val();
    const data = {
        name: $('#template-name').val(),
        description: $('#template-description').val()
    };
    
    if (!data.name) {
        showNotification('Template name is required', 'warning');
        return;
    }
    
    const url = id ? `/api/templates/${id}` : '/api/templates';
    const method = id ? 'PUT' : 'POST';
    const successMessage = id ? 'Template updated successfully' : 'Template created successfully';
    
    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('templateModal'));
            modal.hide();
            loadTemplates();
            showNotification(successMessage, 'success');
        },
        error: function(xhr) {
            showNotification(`Failed to ${id ? 'update' : 'create'} template`, 'danger');
            console.error(`Error ${id ? 'updating' : 'creating'} template:`, xhr);
        }
    });
}

/**
 * Edit an existing template
 */
function editTemplate(id) {
    const template = templateModule.templates.find(t => t.id === id);
    if (template) {
        showTemplateModal(template);
    } else {
        $.get(`/api/templates/${id}`, function(template) {
            showTemplateModal(template);
        }).fail(function(xhr) {
            showNotification('Failed to load template', 'danger');
            console.error('Error loading template:', xhr);
        });
    }
}

/**
 * Delete a template
 */
function deleteTemplate(id) {
    if (confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
        $.ajax({
            url: `/api/templates/${id}`,
            type: 'DELETE',
            success: function(response) {
                loadTemplates();
                showNotification('Template deleted successfully', 'success');
            },
            error: function(xhr) {
                showNotification('Failed to delete template', 'danger');
                console.error('Error deleting template:', xhr);
            }
        });
    }
}

/**
 * Edit schedule for a template
 */
function editSchedule(id) {
    console.log("Editing schedule for template ID:", id);
    
    $.get(`/api/templates/${id}`, function(template) {
        console.log("Template data loaded:", template);
        templateModule.currentTemplate = template;
        
        // Initialize schedule data
        templateModule.currentScheduleData = template.schedule || createEmptySchedule();
        
        // Set template ID in hidden field
        $('#schedule-template-id').val(id);
        
        // Set modal title
        $('#scheduleModalLabel').text(`Edit Schedule: ${template.name}`);
        
        // Initialize schedule table
        populateScheduleTable();
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
        modal.show();
    }).fail(function(xhr) {
        showNotification('Failed to load template', 'danger');
        console.error('Error loading template:', xhr);
    });
}

/**
 * Create an empty schedule template
 */
function createEmptySchedule() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeSlots = [
        '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
        '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
    ];
    
    const schedule = {};
    
    days.forEach(day => {
        schedule[day] = {};
        timeSlots.forEach(time => {
            schedule[day][time] = {
                caregivers: [],
                activities: []
            };
        });
    });
    
    return schedule;
}

/**
 * Populate the schedule table with data
 */
function populateScheduleTable() {
    console.log("Populating schedule table");
    
    // Define time slots
    const timeSlots = [
        '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
        '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
    ];
    
    // Define days
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Get table body
    const tableBody = $('#schedule-table-body');
    tableBody.empty();
    
    // Create rows for each time slot
    timeSlots.forEach(time => {
        let row = `<tr><td>${time}</td>`;
        
        days.forEach(day => {
            const cellData = templateModule.currentScheduleData[day][time];
            const hasContent = cellData && (cellData.caregivers.length > 0 || cellData.activities.length > 0);
            
            row += `<td class="schedule-cell ${hasContent ? 'has-content' : ''}" data-day="${day}" data-time="${time}">`;
            
            if (hasContent) {
                row += createCellContentHtml(cellData);
            }
            
            row += '</td>';
        });
        
        row += '</tr>';
        tableBody.append(row);
    });
    
    // Add click handlers to cells
    $('.schedule-cell').on('click', function() {
        const day = $(this).data('day');
        const time = $(this).data('time');
        openCellEditModal(day, time);
    });
}

/**
 * Create HTML content for a cell
 */
function createCellContentHtml(cellData) {
    let html = '<div class="cell-content">';
    
    // Add caregiver count
    if (cellData.caregivers && cellData.caregivers.length > 0) {
        html += `<div class="caregivers-count"><i class="fas fa-user-nurse"></i> ${cellData.caregivers.length}</div>`;
    }
    
    // Add activity count
    if (cellData.activities && cellData.activities.length > 0) {
        html += `<div class="activities-count"><i class="fas fa-list-check"></i> ${cellData.activities.length}</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * Open modal for editing a cell
 */
function openCellEditModal(day, time) {
    console.log(`Opening cell edit modal for ${day} ${time}`);
    
    // Format day name for display
    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    // Set current cell information
    templateModule.currentCellDay = day;
    templateModule.currentCellTime = time;
    
    // Update modal title
    $('#cell-day-time').text(`${formattedDay} ${time}`);
    
    // Get current cell data
    const cellData = templateModule.currentScheduleData[day][time] || { caregivers: [], activities: [] };
    templateModule.currentCellData = {
        caregivers: [...cellData.caregivers],
        activities: [...cellData.activities]
    };
    
    // Load caregivers and activities
    $.when(
        $.get('/api/caregivers'),
        $.get('/api/activities'),
        $.get('/api/categories')
    ).done(function(caregiversResponse, activitiesResponse, categoriesResponse) {
        const caregivers = caregiversResponse[0];
        const activities = activitiesResponse[0];
        const categories = categoriesResponse[0];
        
        // Populate caregivers dropdown
        let caregiversHtml = '<option value="">Select Caregiver</option>';
        caregivers.forEach(caregiver => {
            caregiversHtml += `<option value="${caregiver.id}">${caregiver.name}</option>`;
        });
        $('#caregiver-select').html(caregiversHtml);
        
        // Populate categories dropdown
        let categoriesHtml = '<option value="">All Categories</option>';
        categories.forEach(category => {
            categoriesHtml += `<option value="${category.id}">${category.name}</option>`;
        });
        $('#category-select').html(categoriesHtml);
        
        // Populate activities dropdown
        updateActivitiesDropdown(activities);
        
        // Update assigned caregivers and activities lists
        updateAssignedCaregiversList(caregivers);
        updateAssignedActivitiesList(activities);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editCellModal'));
        modal.show();
    }).fail(function() {
        showNotification('Failed to load data', 'danger');
    });
}

/**
 * Update the assigned caregivers list
 */
function updateAssignedCaregiversList(caregivers) {
    if (!caregivers) {
        $.get('/api/caregivers', function(data) {
            updateAssignedCaregiversList(data);
        });
        return;
    }
    
    let html = '';
    
    if (templateModule.currentCellData.caregivers.length === 0) {
        html = '<li class="list-group-item">No caregivers assigned</li>';
    } else {
        templateModule.currentCellData.caregivers.forEach(caregiverId => {
            const caregiver = caregivers.find(c => c.id === caregiverId);
            if (caregiver) {
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${caregiver.name}
                        <button class="btn btn-sm btn-danger remove-caregiver" data-id="${caregiverId}">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `;
            }
        });
    }
    
    $('#assigned-caregivers-list').html(html);
    
    // Add event handlers for remove buttons
    $('.remove-caregiver').on('click', function() {
        const caregiverId = $(this).data('id');
        const index = templateModule.currentCellData.caregivers.indexOf(caregiverId);
        if (index !== -1) {
            templateModule.currentCellData.caregivers.splice(index, 1);
            updateAssignedCaregiversList(caregivers);
        }
    });
}

/**
 * Update the activities dropdown based on selected category
 */
function updateActivitiesDropdown(activities, categoryId = '') {
    if (!activities) {
        $.get('/api/activities', function(data) {
            updateActivitiesDropdown(data, categoryId);
        });
        return;
    }
    
    let filteredActivities = activities;
    
    if (categoryId) {
        filteredActivities = activities.filter(activity => activity.category_id === categoryId);
    }
    
    let html = '<option value="">Select Activity</option>';
    
    filteredActivities.forEach(activity => {
        html += `<option value="${activity.id}">${activity.name}</option>`;
    });
    
    $('#activity-select').html(html);
}

/**
 * Update the assigned activities list
 */
function updateAssignedActivitiesList(activities) {
    if (!activities) {
        $.get('/api/activities', function(data) {
            updateAssignedActivitiesList(data);
        });
        return;
    }
    
    let html = '';
    
    if (templateModule.currentCellData.activities.length === 0) {
        html = '<li class="list-group-item">No activities assigned</li>';
    } else {
        templateModule.currentCellData.activities.forEach(activityId => {
            const activity = activities.find(a => a.id === activityId);
            if (activity) {
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${activity.name}
                        <button class="btn btn-sm btn-danger remove-activity" data-id="${activityId}">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `;
            }
        });
    }
    
    $('#assigned-activities-list').html(html);
    
    // Add event handlers for remove buttons
    $('.remove-activity').on('click', function() {
        const activityId = $(this).data('id');
        const index = templateModule.currentCellData.activities.indexOf(activityId);
        if (index !== -1) {
            templateModule.currentCellData.activities.splice(index, 1);
            updateAssignedActivitiesList(activities);
        }
    });
}

/**
 * Save changes to the current cell
 */
function saveCellChanges() {
    // Update the schedule data with the current cell data
    templateModule.currentScheduleData[templateModule.currentCellDay][templateModule.currentCellTime] = {
        caregivers: [...templateModule.currentCellData.caregivers],
        activities: [...templateModule.currentCellData.activities]
    };
    
    // Update the cell display
    const cell = $(`.schedule-cell[data-day="${templateModule.currentCellDay}"][data-time="${templateModule.currentCellTime}"]`);
    const cellData = templateModule.currentScheduleData[templateModule.currentCellDay][templateModule.currentCellTime];
    
    // Clear the cell
    cell.empty();
    
    // If there's data, show a summary
    if (cellData.caregivers.length > 0 || cellData.activities.length > 0) {
        cell.html(createCellContentHtml(cellData));
        cell.addClass('has-content');
    } else {
        cell.removeClass('has-content');
    }
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCellModal'));
    modal.hide();
    
    // Show success notification
    showNotification('Cell updated successfully', 'success');
}

/**
 * Save the entire schedule
 */
function saveSchedule() {
    const templateId = $('#schedule-template-id').val();
    
    $.ajax({
        url: `/api/templates/${templateId}/schedule`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(templateModule.currentScheduleData),
        success: function(response) {
            showNotification('Schedule saved successfully', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
            modal.hide();
        },
        error: function(xhr) {
            showNotification('Failed to save schedule', 'danger');
            console.error('Error saving schedule:', xhr);
        }
    });
}

// ==========================================
// EVENT HANDLERS
// ==========================================

// Initialize when the document is ready
$(document).ready(function() {
    console.log('Templates and calendars module loaded');
    
    // Template buttons
    $('#add-template-btn').on('click', function() {
        showTemplateModal();
    });
    
    $('#save-template').on('click', function() {
        saveTemplate();
    });
    
    // Cell editing buttons
    $('#add-caregiver-to-cell').on('click', function() {
        const caregiverId = $('#caregiver-select').val();
        if (caregiverId) {
            // Check if caregiver is already assigned
            if (!templateModule.currentCellData.caregivers.includes(caregiverId)) {
                templateModule.currentCellData.caregivers.push(caregiverId);
                updateAssignedCaregiversList();
            } else {
                showNotification('This caregiver is already assigned to this time slot', 'warning');
            }
        }
    });
    
    $('#add-activity-to-cell').on('click', function() {
        const activityId = $('#activity-select').val();
        if (activityId) {
            // Check if activity is already assigned
            if (!templateModule.currentCellData.activities.includes(activityId)) {
                templateModule.currentCellData.activities.push(activityId);
                updateAssignedActivitiesList();
            } else {
                showNotification('This activity is already assigned to this time slot', 'warning');
            }
        }
    });
    
    // Category filter change
    $('#category-select').on('change', function() {
        const categoryId = $(this).val();
        updateActivitiesDropdown(null, categoryId);
    });
    
    // Save buttons
    $('#save-cell-changes').on('click', function() {
        saveCellChanges();
    });
    
    $('#save-schedule').on('click', function() {
        saveSchedule();
    });
}); 