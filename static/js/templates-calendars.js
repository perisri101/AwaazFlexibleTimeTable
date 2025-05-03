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
    
    // Reset the modal first
    resetScheduleModal();
    
    // Load template data
    $.get(`/api/templates/${id}`, function(template) {
        console.log("Template data loaded:", template);
        templateModule.currentTemplate = template;
        
        // Initialize schedule data
        templateModule.currentScheduleData = template.schedule || createEmptySchedule();
        console.log("Current schedule data:", templateModule.currentScheduleData);
        
        // Set template ID in hidden field
        $('#schedule-template-id').val(id);
        
        // Set modal title
        $('#scheduleModalLabel').text(`Edit Schedule: ${template.name}`);
        
        // Initialize schedule table
        populateScheduleTable();
        
        // Force any existing modal to be hidden first
        const existingModal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
        if (existingModal) {
            existingModal.hide();
            existingModal.dispose();
        }
        
        // Show modal with a slight delay to ensure DOM is updated
        setTimeout(() => {
            const scheduleModal = document.getElementById('scheduleModal');
            const modal = new bootstrap.Modal(scheduleModal);
            modal.show();
            
            // Debug the modal state
            debugModal('scheduleModal');
            
            // Set focus to the first focusable element
            setTimeout(() => {
                const firstFocusable = scheduleModal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }, 300);
        }, 100);
    }).fail(function(xhr) {
        showNotification('Failed to load template', 'danger');
        console.error('Error loading template:', xhr);
    });
}

/**
 * Create an empty schedule template
 */
function createEmptySchedule() {
    console.log("Creating empty schedule");
    
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
            // Make sure the day and time exist in the schedule data
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
 * Open modal for editing a cell
 */
function openCellEditModal(day, time) {
    console.log(`Opening cell edit modal for ${day} ${time}`);
    
    // Reset the modal first
    resetEditCellModal();
    
    // Format day name for display
    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    // Set current cell information
    templateModule.currentCellDay = day;
    templateModule.currentCellTime = time;
    
    // Update modal title
    $('#cell-day-time').text(`${formattedDay} ${time}`);
    
    // Check the current day and time in bulk selection
    $(`#day-${day}`).prop('checked', true);
    $(`#time-${time}`).prop('checked', true);
    
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
        
        // Force any existing modal to be hidden first
        const existingModal = bootstrap.Modal.getInstance(document.getElementById('editCellModal'));
        if (existingModal) {
            existingModal.hide();
            existingModal.dispose();
        }
        
        // Show modal with a slight delay to ensure DOM is updated
        setTimeout(() => {
            const editCellModal = document.getElementById('editCellModal');
            const modal = new bootstrap.Modal(editCellModal);
            modal.show();
            
            // Debug the modal state
            debugModal('editCellModal');
            
            // Set focus to the first focusable element
            setTimeout(() => {
                const firstFocusable = editCellModal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }, 300);
        }, 100);
    }).fail(function() {
        showNotification('Failed to load data', 'danger');
    });
}

/**
 * Update the list of assigned caregivers
 */
function updateAssignedCaregiversList(allCaregivers) {
    const list = $('#assigned-caregivers-list');
    list.empty();
    
    if (!templateModule.currentCellData.caregivers.length) {
        list.html('<li class="list-group-item text-muted">No caregivers assigned</li>');
        return;
    }
    
    // If allCaregivers is not provided, fetch them
    if (!allCaregivers) {
        $.get('/api/caregivers', function(caregivers) {
            updateAssignedCaregiversList(caregivers);
        });
        return;
    }
    
    // Map caregiver IDs to names
    const caregiversMap = {};
    allCaregivers.forEach(caregiver => {
        caregiversMap[caregiver.id] = caregiver.name;
    });
    
    // Create list items
    templateModule.currentCellData.caregivers.forEach(caregiverId => {
        const name = caregiversMap[caregiverId] || `Unknown (${caregiverId})`;
        const item = `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${name}
                <button type="button" class="btn btn-sm btn-danger remove-caregiver" data-id="${caregiverId}">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `;
        list.append(item);
    });
    
    // Add event handlers for remove buttons
    $('.remove-caregiver').off('click').on('click', function() {
        const id = $(this).data('id');
        console.log(`Removing caregiver with ID: ${id}`);
        templateModule.currentCellData.caregivers = templateModule.currentCellData.caregivers.filter(cid => cid !== id);
        updateAssignedCaregiversList(allCaregivers);
    });
}

/**
 * Update the list of assigned activities
 */
function updateAssignedActivitiesList(allActivities) {
    const list = $('#assigned-activities-list');
    list.empty();
    
    if (!templateModule.currentCellData.activities.length) {
        list.html('<li class="list-group-item text-muted">No activities assigned</li>');
        return;
    }
    
    // If allActivities is not provided, fetch them
    if (!allActivities) {
        $.get('/api/activities', function(activities) {
            updateAssignedActivitiesList(activities);
        });
        return;
    }
    
    // Map activity IDs to names
    const activitiesMap = {};
    allActivities.forEach(activity => {
        activitiesMap[activity.id] = activity.name;
    });
    
    // Create list items
    templateModule.currentCellData.activities.forEach(activityId => {
        const name = activitiesMap[activityId] || `Unknown (${activityId})`;
        const item = `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${name}
                <button type="button" class="btn btn-sm btn-danger remove-activity" data-id="${activityId}">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `;
        list.append(item);
    });
    
    // Add event handlers for remove buttons
    $('.remove-activity').off('click').on('click', function() {
        const id = $(this).data('id');
        console.log(`Removing activity with ID: ${id}`);
        templateModule.currentCellData.activities = templateModule.currentCellData.activities.filter(aid => aid !== id);
        updateAssignedActivitiesList(allActivities);
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
    let html = '<option value="">Select Activity</option>';
    filteredActivities.forEach(activity => {
        html += `<option value="${activity.id}">${activity.name}</option>`;
    });
    
    $('#activity-select').html(html);
}

/**
 * Save changes to the current cell and any selected cells in bulk mode
 */
function saveCellChanges() {
    const isBulkMode = $('#enable-bulk-selection').is(':checked');
    const replaceExisting = $('#replace-existing-data').is(':checked');
    
    if (isBulkMode) {
        // Get selected days and times
        const selectedDays = $('.day-checkbox:checked').map(function() {
            return $(this).val();
        }).get();
        
        const selectedTimes = $('.time-checkbox:checked').map(function() {
            return $(this).val();
        }).get();
        
        console.log(`Bulk saving to ${selectedDays.length} days and ${selectedTimes.length} time slots`);
        
        // Apply changes to all selected cells
        selectedDays.forEach(day => {
            selectedTimes.forEach(time => {
                if (replaceExisting) {
                    // Replace existing data
                    templateModule.currentScheduleData[day][time] = {
                        caregivers: [...templateModule.currentCellData.caregivers],
                        activities: [...templateModule.currentCellData.activities]
                    };
                } else {
                    // Merge with existing data
                    if (!templateModule.currentScheduleData[day]) {
                        templateModule.currentScheduleData[day] = {};
                    }
                    
                    if (!templateModule.currentScheduleData[day][time]) {
                        templateModule.currentScheduleData[day][time] = {
                            caregivers: [],
                            activities: []
                        };
                    }
                    
                    // Add caregivers that aren't already in the cell
                    templateModule.currentCellData.caregivers.forEach(caregiverId => {
                        if (!templateModule.currentScheduleData[day][time].caregivers.includes(caregiverId)) {
                            templateModule.currentScheduleData[day][time].caregivers.push(caregiverId);
                        }
                    });
                    
                    // Add activities that aren't already in the cell
                    templateModule.currentCellData.activities.forEach(activityId => {
                        if (!templateModule.currentScheduleData[day][time].activities.includes(activityId)) {
                            templateModule.currentScheduleData[day][time].activities.push(activityId);
                        }
                    });
                }
                
                // Update cell display
                updateCellDisplay(day, time);
            });
        });
        
        showNotification(`Updated ${selectedDays.length * selectedTimes.length} cells`, 'success');
    } else {
        // Single cell update
        templateModule.currentScheduleData[templateModule.currentCellDay][templateModule.currentCellTime] = {
            caregivers: [...templateModule.currentCellData.caregivers],
            activities: [...templateModule.currentCellData.activities]
        };
        
        // Update cell display
        updateCellDisplay(templateModule.currentCellDay, templateModule.currentCellTime);
        
        showNotification('Cell updated successfully', 'success');
    }
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCellModal'));
    modal.hide();
}

/**
 * Update the display of a cell in the schedule table
 */
function updateCellDisplay(day, time) {
    const cell = $(`.schedule-cell[data-day="${day}"][data-time="${time}"]`);
    const cellData = templateModule.currentScheduleData[day][time];
    
    // Clear the cell
    cell.empty();
    
    // If there's data, show a summary
    if (cellData.caregivers.length > 0 || cellData.activities.length > 0) {
        cell.html(createCellContentHtml(cellData));
        cell.addClass('has-content');
    } else {
        cell.removeClass('has-content');
    }
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
    
    // Bulk selection toggle
    $('#enable-bulk-selection').on('change', function() {
        if ($(this).is(':checked')) {
            $('.bulk-selection-options').slideDown();
        } else {
            $('.bulk-selection-options').slideUp();
        }
    });
    
    // Quick select buttons for days
    $('#select-all-days').on('click', function() {
        $('.day-checkbox').prop('checked', true);
    });
    
    $('#select-weekdays').on('click', function() {
        $('.day-checkbox').prop('checked', false);
        $('#day-monday, #day-tuesday, #day-wednesday, #day-thursday, #day-friday').prop('checked', true);
    });
    
    $('#select-weekend').on('click', function() {
        $('.day-checkbox').prop('checked', false);
        $('#day-saturday, #day-sunday').prop('checked', true);
    });
    
    // Quick select buttons for time slots
    $('#select-all-times').on('click', function() {
        $('.time-checkbox').prop('checked', true);
    });
    
    $('#select-morning').on('click', function() {
        $('.time-checkbox').prop('checked', false);
        $('#time-06-08, #time-08-10, #time-10-12').prop('checked', true);
    });
    
    $('#select-afternoon').on('click', function() {
        $('.time-checkbox').prop('checked', false);
        $('#time-12-14, #time-14-16, #time-16-18').prop('checked', true);
    });
    
    $('#select-evening').on('click', function() {
        $('.time-checkbox').prop('checked', false);
        $('#time-18-20, #time-20-22').prop('checked', true);
    });
    
    $('#select-night').on('click', function() {
        $('.time-checkbox').prop('checked', false);
        $('#time-22-24, #time-00-02, #time-02-04, #time-04-06').prop('checked', true);
    });
    
    // Ensure modals are properly disposed when hidden
    $('#scheduleModal, #editCellModal').on('hidden.bs.modal', function() {
        // Force the modal to be disposed to prevent issues with subsequent openings
        const modalInstance = bootstrap.Modal.getInstance(this);
        if (modalInstance) {
            modalInstance.dispose();
        }
    });
});

// Add this function to help with debugging
function debugModal(modalId) {
    const modal = document.getElementById(modalId);
    console.log(`Modal ${modalId} display:`, window.getComputedStyle(modal).display);
    console.log(`Modal ${modalId} visibility:`, window.getComputedStyle(modal).visibility);
    console.log(`Modal ${modalId} opacity:`, window.getComputedStyle(modal).opacity);
    console.log(`Modal ${modalId} classes:`, modal.className);
    
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
        console.log('Modal backdrop exists:', backdrop);
        console.log('Modal backdrop classes:', backdrop.className);
    } else {
        console.log('No modal backdrop found');
    }
}

// Call this in your modal open functions
// debugModal('scheduleModal'); // in editSchedule
// debugModal('editCellModal'); // in openCellEditModal 

/**
 * Reset and prepare the edit cell modal
 */
function resetEditCellModal() {
    // Clear all existing data
    $('#assigned-caregivers-list').empty();
    $('#assigned-activities-list').empty();
    $('#caregiver-select').empty().html('<option value="">Select Caregiver</option>');
    $('#activity-select').empty().html('<option value="">Select Activity</option>');
    $('#category-select').empty().html('<option value="">All Categories</option>');
    
    // Reset bulk selection
    $('#enable-bulk-selection').prop('checked', false);
    $('.bulk-selection-options').hide();
    $('.day-checkbox, .time-checkbox').prop('checked', false);
    $('#replace-existing-data').prop('checked', false);
    
    // Reset current cell data
    templateModule.currentCellData = { caregivers: [], activities: [] };
}

/**
 * Reset and prepare the schedule modal
 */
function resetScheduleModal() {
    // Clear the schedule table
    $('#schedule-table-body').empty();
    
    // Reset current schedule data
    templateModule.currentScheduleData = {};
    templateModule.currentTemplate = null;
} 