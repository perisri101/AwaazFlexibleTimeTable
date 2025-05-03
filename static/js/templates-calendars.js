/**
 * Templates and Calendars Module
 * Simplified implementation focusing on reliability
 */

// Module state
const templateModule = {
    templates: [],
    currentTemplate: null,
    currentScheduleData: {},
    currentCell: {
        day: '',
        time: '',
        caregivers: [],
        activities: []
    }
};

// ==========================================
// TEMPLATE OPERATIONS
// ==========================================

/**
 * Load all templates from the server
 */
function loadTemplates() {
    console.log("Loading templates...");
    
    $.get('/api/templates')
        .done(function(data) {
            console.log(`Loaded ${data.length} templates`);
            templateModule.templates = data;
            displayTemplates();
        })
        .fail(function(xhr) {
            console.error("Failed to load templates:", xhr);
            showNotification('Failed to load templates', 'danger');
        });
}

/**
 * Display templates in the UI
 */
function displayTemplates() {
    const container = $('#templates-list');
    container.empty();
    
    if (templateModule.templates.length === 0) {
        container.html('<div class="col-12 text-center">No templates found</div>');
        return;
    }
    
    templateModule.templates.forEach(template => {
        const card = $(`
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
        `);
        
        container.append(card);
    });
}

/**
 * Add or edit a template
 */
function editTemplate(id = null) {
    // Reset form
    $('#template-form')[0].reset();
    
    if (id) {
        // Edit existing template
        const template = templateModule.templates.find(t => t.id === id);
        if (template) {
            $('#templateModalLabel').text('Edit Template');
            $('#template-id').val(template.id);
            $('#template-name').val(template.name);
            $('#template-description').val(template.description);
        } else {
            console.error(`Template with ID ${id} not found`);
            return;
        }
    } else {
        // Add new template
        $('#templateModalLabel').text('Add Template');
        $('#template-id').val('');
    }
    
    // Show modal
    $('#templateModal').modal('show');
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
    
    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            $('#templateModal').modal('hide');
            loadTemplates();
            showNotification(`Template ${id ? 'updated' : 'created'} successfully`, 'success');
        },
        error: function(xhr) {
            showNotification(`Failed to ${id ? 'update' : 'create'} template`, 'danger');
            console.error(`Error ${id ? 'updating' : 'creating'} template:`, xhr);
        }
    });
}

/**
 * Delete a template
 */
function deleteTemplate(id) {
    if (confirm('Are you sure you want to delete this template?')) {
        $.ajax({
            url: `/api/templates/${id}`,
            type: 'DELETE',
            success: function() {
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

// ==========================================
// SCHEDULE OPERATIONS
// ==========================================

/**
 * Edit schedule for a template
 */
function editSchedule(id) {
    console.log("Editing schedule for template ID:", id);
    
    $.get(`/api/templates/${id}`)
        .done(function(template) {
            console.log("Template data loaded:", template);
            templateModule.currentTemplate = template;
            templateModule.currentScheduleData = template.schedule || createEmptySchedule();
            
            // Set template ID in hidden field
            $('#schedule-template-id').val(id);
            
            // Set modal title
            $('#scheduleModalLabel').text(`Edit Schedule: ${template.name}`);
            
            // Populate schedule table
            populateScheduleTable();
            
            // Show modal
            $('#scheduleModal').modal('show');
        })
        .fail(function(xhr) {
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
        const row = $('<tr></tr>');
        
        // Add time column
        row.append(`<td>${time}</td>`);
        
        // Add day columns
        days.forEach(day => {
            // Ensure the day and time exist in the schedule data
            if (!templateModule.currentScheduleData[day]) {
                templateModule.currentScheduleData[day] = {};
            }
            
            if (!templateModule.currentScheduleData[day][time]) {
                templateModule.currentScheduleData[day][time] = {
                    caregivers: [],
                    activities: []
                };
            }
            
            const cellData = templateModule.currentScheduleData[day][time];
            const hasContent = cellData.caregivers.length > 0 || cellData.activities.length > 0;
            
            const cell = $(`<td class="schedule-cell ${hasContent ? 'has-content' : ''}" data-day="${day}" data-time="${time}"></td>`);
            
            if (hasContent) {
                cell.html(createCellContentHtml(cellData));
            }
            
            row.append(cell);
        });
        
        tableBody.append(row);
    });
}

/**
 * Create HTML content for a cell
 */
function createCellContentHtml(cellData) {
    let html = '<div class="cell-content">';
    
    if (cellData.caregivers && cellData.caregivers.length > 0) {
        html += `<div class="caregivers-count"><i class="fas fa-user-nurse"></i> ${cellData.caregivers.length}</div>`;
    }
    
    if (cellData.activities && cellData.activities.length > 0) {
        html += `<div class="activities-count"><i class="fas fa-list-check"></i> ${cellData.activities.length}</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * Save schedule to server
 */
function saveSchedule() {
    const templateId = $('#schedule-template-id').val();
    
    if (!templateId) {
        showNotification('Template ID is missing', 'danger');
        return;
    }
    
    const data = {
        schedule: templateModule.currentScheduleData
    };
    
    $.ajax({
        url: `/api/templates/${templateId}`,
        type: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            $('#scheduleModal').modal('hide');
            showNotification('Schedule saved successfully', 'success');
        },
        error: function(xhr) {
            showNotification('Failed to save schedule', 'danger');
            console.error('Error saving schedule:', xhr);
        }
    });
}

/**
 * Open modal for editing a cell
 */
function openCellEditModal(day, time) {
    console.log(`Opening cell edit modal for ${day} ${time}`);
    
    // Format day name for display
    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    // Set current cell information
    templateModule.currentCell = {
        day: day,
        time: time,
        caregivers: [...templateModule.currentScheduleData[day][time].caregivers],
        activities: [...templateModule.currentScheduleData[day][time].activities]
    };
    
    // Update modal title
    $('#cell-day-time').text(`${formattedDay} ${time}`);
    
    // Load data and populate dropdowns
    Promise.all([
        $.get('/api/caregivers'),
        $.get('/api/activities'),
        $.get('/api/categories')
    ])
    .then(([caregivers, activities, categories]) => {
        // Populate caregivers dropdown
        const caregiversSelect = $('#caregiver-select');
        caregiversSelect.empty().append('<option value="">Select Caregiver</option>');
        caregivers.forEach(caregiver => {
            caregiversSelect.append(`<option value="${caregiver.id}">${caregiver.name}</option>`);
        });
        
        // Populate categories dropdown
        const categoriesSelect = $('#category-select');
        categoriesSelect.empty().append('<option value="">All Categories</option>');
        categories.forEach(category => {
            categoriesSelect.append(`<option value="${category.id}">${category.name}</option>`);
        });
        
        // Populate activities dropdown
        updateActivitiesDropdown(activities);
        
        // Update assigned caregivers and activities lists
        updateAssignedCaregiversList(caregivers);
        updateAssignedActivitiesList(activities);
        
        // Show modal
        $('#editCellModal').modal('show');
    })
    .catch(error => {
        console.error('Error loading data:', error);
        showNotification('Failed to load data', 'danger');
    });
}

/**
 * Update the list of assigned caregivers
 */
function updateAssignedCaregiversList(allCaregivers) {
    const list = $('#assigned-caregivers-list');
    list.empty();
    
    if (!templateModule.currentCell.caregivers.length) {
        list.html('<li class="list-group-item text-muted">No caregivers assigned</li>');
        return;
    }
    
    // Map caregiver IDs to names
    const caregiversMap = {};
    allCaregivers.forEach(caregiver => {
        caregiversMap[caregiver.id] = caregiver.name;
    });
    
    // Create list items
    templateModule.currentCell.caregivers.forEach(caregiverId => {
        const name = caregiversMap[caregiverId] || `Unknown (${caregiverId})`;
        const item = $(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${name}
                <button type="button" class="btn btn-sm btn-danger remove-caregiver" data-id="${caregiverId}">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `);
        list.append(item);
    });
}

/**
 * Update the list of assigned activities
 */
function updateAssignedActivitiesList(allActivities) {
    const list = $('#assigned-activities-list');
    list.empty();
    
    if (!templateModule.currentCell.activities.length) {
        list.html('<li class="list-group-item text-muted">No activities assigned</li>');
        return;
    }
    
    // Map activity IDs to names
    const activitiesMap = {};
    allActivities.forEach(activity => {
        activitiesMap[activity.id] = activity.name;
    });
    
    // Create list items
    templateModule.currentCell.activities.forEach(activityId => {
        const name = activitiesMap[activityId] || `Unknown (${activityId})`;
        const item = $(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${name}
                <button type="button" class="btn btn-sm btn-danger remove-activity" data-id="${activityId}">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `);
        list.append(item);
    });
}

/**
 * Update the activities dropdown based on selected category
 */
function updateActivitiesDropdown(activities, categoryId) {
    if (!activities) {
        $.get('/api/activities', function(data) {
            updateActivitiesDropdown(data, categoryId);
        });
        return;
    }
    
    let filteredActivities = activities;
    
    // Filter by category if specified
    if (categoryId) {
        filteredActivities = activities.filter(activity => activity.category_id === categoryId);
    }
    
    // Build dropdown options
    const activitySelect = $('#activity-select');
    activitySelect.empty().append('<option value="">Select Activity</option>');
    filteredActivities.forEach(activity => {
        activitySelect.append(`<option value="${activity.id}">${activity.name}</option>`);
    });
}

/**
 * Save changes to the current cell
 */
function saveCellChanges() {
    const { day, time, caregivers, activities } = templateModule.currentCell;
    
    // Update the schedule data
    templateModule.currentScheduleData[day][time] = {
        caregivers: [...caregivers],
        activities: [...activities]
    };
    
    // Update the cell display
    const cell = $(`.schedule-cell[data-day="${day}"][data-time="${time}"]`);
    const hasContent = caregivers.length > 0 || activities.length > 0;
    
    if (hasContent) {
        cell.addClass('has-content').html(createCellContentHtml(templateModule.currentScheduleData[day][time]));
    } else {
        cell.removeClass('has-content').empty();
    }
    
    // Close the modal
    $('#editCellModal').modal('hide');
    
    showNotification('Cell updated successfully', 'success');
}

// ==========================================
// EVENT HANDLERS
// ==========================================

// Initialize when the document is ready
$(document).ready(function() {
    console.log('Templates and calendars module loaded');
    
    // Load templates
    loadTemplates();
    
    // Template buttons
    $('#add-template-btn').on('click', function() {
        editTemplate();
    });
    
    $('#save-template').on('click', function() {
        saveTemplate();
    });
    
    // Schedule table cell click
    $(document).on('click', '.schedule-cell', function() {
        const day = $(this).data('day');
        const time = $(this).data('time');
        openCellEditModal(day, time);
    });
    
    // Cell editing buttons
    $('#add-caregiver-to-cell').on('click', function() {
        const caregiverId = $('#caregiver-select').val();
        if (caregiverId && !templateModule.currentCell.caregivers.includes(caregiverId)) {
            templateModule.currentCell.caregivers.push(caregiverId);
            $.get('/api/caregivers', function(caregivers) {
                updateAssignedCaregiversList(caregivers);
            });
        }
    });
    
    $('#add-activity-to-cell').on('click', function() {
        const activityId = $('#activity-select').val();
        if (activityId && !templateModule.currentCell.activities.includes(activityId)) {
            templateModule.currentCell.activities.push(activityId);
            $.get('/api/activities', function(activities) {
                updateAssignedActivitiesList(activities);
            });
        }
    });
    
    // Remove buttons (using event delegation)
    $(document).on('click', '.remove-caregiver', function() {
        const id = $(this).data('id');
        templateModule.currentCell.caregivers = templateModule.currentCell.caregivers.filter(cid => cid !== id);
        $.get('/api/caregivers', function(caregivers) {
            updateAssignedCaregiversList(caregivers);
        });
    });
    
    $(document).on('click', '.remove-activity', function() {
        const id = $(this).data('id');
        templateModule.currentCell.activities = templateModule.currentCell.activities.filter(aid => aid !== id);
        $.get('/api/activities', function(activities) {
            updateAssignedActivitiesList(activities);
        });
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
    
    // Template list event delegation
    $(document).on('click', '.edit-template', function() {
        const id = $(this).data('id');
        editTemplate(id);
    });
    
    $(document).on('click', '.delete-template', function() {
        const id = $(this).data('id');
        deleteTemplate(id);
    });
    
    $(document).on('click', '.edit-schedule', function() {
        const id = $(this).data('id');
        editSchedule(id);
    });
});

/**
 * Show a notification message
 */
function showNotification(message, type = 'info') {
    const toast = $(`
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `);
    
    $('#toast-container').append(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    
    bsToast.show();
    
    // Remove the toast from the DOM after it's hidden
    toast.on('hidden.bs.toast', function() {
        $(this).remove();
    });
} 