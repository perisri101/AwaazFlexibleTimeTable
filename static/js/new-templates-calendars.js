/**
 * Templates and Calendars Module
 * Mobile-friendly implementation with no modals
 */

// Templates and Calendars Module
// Module objects to store state
const templatesModule = {
    templates: [],
    currentTemplate: null,
    currentScheduleData: {},
    currentCell: { day: null, time: null, caregivers: [], activities: [] },
    allCaregivers: [],
    allActivities: [],
    allCategories: []
};

const calendarsModule = {
    calendars: [],
    currentCalendar: null,
    currentWeekOffset: 0
};

// ==========================================
// DATA OPERATIONS
// ==========================================

/**
 * Load all templates from the server
 */
function loadTemplates() {
    console.log("Loading templates...");
    
    $.get('/api/templates')
        .done(function(data) {
            console.log(`Loaded ${data.length} templates`);
            templatesModule.templates = data;
            displayTemplates();
            updateDashboardCount('template-count', data.length);
        })
        .fail(function(xhr) {
            console.error("Failed to load templates:", xhr);
            showNotification('Failed to load templates', 'danger');
        });
}

/**
 * Load all calendars from the server
 */
function loadCalendars() {
    console.log("Loading calendars...");
    
    $.get('/api/calendars')
        .done(function(data) {
            console.log(`Loaded ${data.length} calendars`);
            calendarsModule.calendars = data;
            displayCalendars();
            updateDashboardCount('calendar-count', data.length);
        })
        .fail(function(xhr) {
            console.error("Failed to load calendars:", xhr);
            showNotification('Failed to load calendars', 'danger');
        });
}

/**
 * Load required data for templates and calendars
 */
function loadRequiredData() {
    // Load caregivers, activities, and categories
    Promise.all([
        $.ajax({ url: '/api/caregivers', method: 'GET' }),
        $.ajax({ url: '/api/activities', method: 'GET' }),
        $.ajax({ url: '/api/categories', method: 'GET' })
    ])
    .then(([caregivers, activities, categories]) => {
        templatesModule.allCaregivers = caregivers;
        templatesModule.allActivities = activities;
        templatesModule.allCategories = categories;
        console.log("Loaded required data");
    })
    .catch(error => {
        console.error("Error loading required data:", error);
        showNotification('Failed to load required data', 'danger');
    });
}

/**
 * Update a dashboard count
 */
function updateDashboardCount(elementId, count) {
    $(`#${elementId}`).text(count);
}

// ==========================================
// TEMPLATES OPERATIONS
// ==========================================

/**
 * Display templates in the UI
 */
function displayTemplates() {
    const container = $('#templates-container');
    container.empty();
    
    if (templatesModule.templates.length === 0) {
        container.html('<div class="no-items-message">No templates found. Create your first template!</div>');
        return;
    }
    
    const templatesList = $('<div class="list-group templates-list"></div>');
    
    templatesModule.templates.forEach(template => {
        const item = $(`
            <div class="list-group-item template-item" data-id="${template.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${template.name}</h5>
                    <div class="template-actions">
                        <button class="btn btn-sm btn-primary edit-schedule" data-id="${template.id}" aria-label="Edit Schedule">
                            <i class="fa-solid fa-calendar-days"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary edit-template" data-id="${template.id}" aria-label="Edit Template">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-template" data-id="${template.id}" aria-label="Delete Template">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="mb-1">${template.description || 'No description'}</p>
            </div>
        `);
        
        templatesList.append(item);
    });
    
    container.append(templatesList);
}

/**
 * Show template form in the main content area
 */
function showTemplateForm(id = null) {
    templatesModule.currentTemplate = id !== null ? templatesModule.templates.find(t => t.id === id) : null;
    
    // Switch to template form view
    $('#templates-list-view').hide();
    $('#template-form-view').show();
    
    // Reset form
    $('#template-form')[0].reset();
    
    if (id) {
        // Edit existing template
        if (templatesModule.currentTemplate) {
            $('#template-form-title').text('Edit Template');
            $('#template-name').val(templatesModule.currentTemplate.name);
            $('#template-description').val(templatesModule.currentTemplate.description);
        } else {
            console.error(`Template with ID ${id} not found`);
            return;
        }
    } else {
        // Add new template
        $('#template-form-title').text('New Template');
    }
}

/**
 * Cancel template form and return to list view
 */
function cancelTemplateForm() {
    $('#template-form-view').hide();
    $('#templates-list-view').show();
    templatesModule.currentTemplate = null;
}

/**
 * Save template to server
 */
function saveTemplate() {
    const data = {
        name: $('#template-name').val(),
        description: $('#template-description').val()
    };
    
    if (!data.name) {
        showNotification('Template name is required', 'warning');
        return;
    }
    
    const id = templatesModule.currentTemplate?.id;
    const url = id ? `/api/templates/${id}` : '/api/templates';
    const method = id ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            cancelTemplateForm();
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
 * Show schedule editor for a template
 */
function showScheduleEditor(id) {
    console.log("Editing schedule for template ID:", id);
    
    // Switch to schedule editor view
    $('#templates-list-view').hide();
    $('#schedule-editor-view').show();
    
    $.get(`/api/templates/${id}`)
        .done(function(template) {
            console.log("Template data loaded:", template);
            templatesModule.currentTemplate = template;
            templatesModule.currentScheduleData = template.schedule || createEmptySchedule();
            
            // Set template name in header
            $('#schedule-editor-title').text(`Schedule: ${template.name}`);
            $('#schedule-template-id').val(id);
            
            // Populate schedule table
            populateScheduleTable();
        })
        .fail(function(xhr) {
            showNotification('Failed to load template', 'danger');
            console.error('Error loading template:', xhr);
        });
}

/**
 * Cancel schedule editor and return to list view
 */
function cancelScheduleEditor() {
    $('#schedule-editor-view').hide();
    $('#templates-list-view').show();
    templatesModule.currentTemplate = null;
    templatesModule.currentCell = null;
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
    
    // Format day names for display
    const dayLabels = {
        'monday': 'Mon',
        'tuesday': 'Tue',
        'wednesday': 'Wed',
        'thursday': 'Thu',
        'friday': 'Fri',
        'saturday': 'Sat',
        'sunday': 'Sun'
    };
    
    // Get table container
    const tableContainer = $('#schedule-table-container');
    tableContainer.empty();
    
    // Create responsive table
    const table = $('<div class="schedule-table"></div>');
    
    // Create header row
    const headerRow = $('<div class="schedule-row header-row"></div>');
    headerRow.append('<div class="schedule-cell time-cell">Time</div>');
    
    days.forEach(day => {
        headerRow.append(`<div class="schedule-cell day-cell">${dayLabels[day]}</div>`);
    });
    
    table.append(headerRow);
    
    // Create rows for each time slot
    timeSlots.forEach(time => {
        const row = $(`<div class="schedule-row" data-time="${time}"></div>`);
        
        // Add time column
        row.append(`<div class="schedule-cell time-cell">${time}</div>`);
        
        // Add day columns
        days.forEach(day => {
            // Ensure the day and time exist in the schedule data
            if (!templatesModule.currentScheduleData[day]) {
                templatesModule.currentScheduleData[day] = {};
            }
            
            if (!templatesModule.currentScheduleData[day][time]) {
                templatesModule.currentScheduleData[day][time] = {
                    caregivers: [],
                    activities: []
                };
            }
            
            const cellData = templatesModule.currentScheduleData[day][time];
            const hasContent = cellData.caregivers.length > 0 || cellData.activities.length > 0;
            
            const cell = $(`<div class="schedule-cell day-slot ${hasContent ? 'has-content' : ''}" data-day="${day}" data-time="${time}"></div>`);
            
            if (hasContent) {
                cell.html(createCellContentHtml(cellData));
            }
            
            row.append(cell);
        });
        
        table.append(row);
    });
    
    tableContainer.append(table);
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
 * Show cell editor for a specific day and time
 */
function showCellEditor(day, time) {
    console.log(`Editing cell for ${day} ${time}`);
    
    // Format day name for display
    const formattedDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    // Set current cell information
    templatesModule.currentCell = {
        day: day,
        time: time,
        caregivers: [...templatesModule.currentScheduleData[day][time].caregivers],
        activities: [...templatesModule.currentScheduleData[day][time].activities]
    };
    
    // Switch to cell editor view
    $('#schedule-editor-view').hide();
    $('#cell-editor-view').show();
    
    // Update cell editor header
    $('#cell-editor-title').text(`${formattedDay} ${time}`);
    
    // If required data not loaded yet, load it
    if (templatesModule.allCaregivers.length === 0) {
        loadRequiredData();
    }
    
    // Populate dropdowns and lists
    populateCellEditorDropdowns();
    updateAssignedLists();
}

/**
 * Populate dropdowns in the cell editor
 */
function populateCellEditorDropdowns() {
    // Caregivers dropdown
    const caregiversSelect = $('#caregiver-select');
    caregiversSelect.empty().append('<option value="">Select Caregiver</option>');
    templatesModule.allCaregivers.forEach(caregiver => {
        caregiversSelect.append(`<option value="${caregiver.id}">${caregiver.name}</option>`);
    });
    
    // Categories dropdown
    const categoriesSelect = $('#category-select');
    categoriesSelect.empty().append('<option value="">All Categories</option>');
    templatesModule.allCategories.forEach(category => {
        categoriesSelect.append(`<option value="${category.id}">${category.name}</option>`);
    });
    
    // Activities dropdown
    updateActivitiesDropdown();
}

/**
 * Update the activities dropdown based on selected category
 */
function updateActivitiesDropdown(categoryId) {
    let filteredActivities = templatesModule.allActivities;
    
    // Filter by category if specified
    if (categoryId) {
        filteredActivities = templatesModule.allActivities.filter(activity => activity.category_id === categoryId);
    }
    
    // Build dropdown options
    const activitySelect = $('#activity-select');
    activitySelect.empty().append('<option value="">Select Activity</option>');
    filteredActivities.forEach(activity => {
        activitySelect.append(`<option value="${activity.id}">${activity.name}</option>`);
    });
}

/**
 * Update the list of assigned caregivers and activities
 */
function updateAssignedLists() {
    // Caregivers list
    const caregiversList = $('#assigned-caregivers-list');
    caregiversList.empty();
    
    if (!templatesModule.currentCell.caregivers.length) {
        caregiversList.html('<li class="list-group-item text-muted">No caregivers assigned</li>');
    } else {
        // Map caregiver IDs to names
        const caregiversMap = {};
        templatesModule.allCaregivers.forEach(caregiver => {
            caregiversMap[caregiver.id] = caregiver.name;
        });
        
        // Create list items
        templatesModule.currentCell.caregivers.forEach(caregiverId => {
            const name = caregiversMap[caregiverId] || `Unknown (${caregiverId})`;
            const item = $(`
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${name}
                    <button type="button" class="btn btn-sm btn-danger remove-caregiver" data-id="${caregiverId}">
                        <i class="fas fa-times"></i>
                    </button>
                </li>
            `);
            caregiversList.append(item);
        });
    }
    
    // Activities list
    const activitiesList = $('#assigned-activities-list');
    activitiesList.empty();
    
    if (!templatesModule.currentCell.activities.length) {
        activitiesList.html('<li class="list-group-item text-muted">No activities assigned</li>');
    } else {
        // Map activity IDs to names
        const activitiesMap = {};
        templatesModule.allActivities.forEach(activity => {
            activitiesMap[activity.id] = activity.name;
        });
        
        // Create list items
        templatesModule.currentCell.activities.forEach(activityId => {
            const name = activitiesMap[activityId] || `Unknown (${activityId})`;
            const item = $(`
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${name}
                    <button type="button" class="btn btn-sm btn-danger remove-activity" data-id="${activityId}">
                        <i class="fas fa-times"></i>
                    </button>
                </li>
            `);
            activitiesList.append(item);
        });
    }
}

/**
 * Save cell changes and return to schedule editor
 */
function saveCellChanges() {
    const { day, time, caregivers, activities } = templatesModule.currentCell;
    
    // Update the schedule data
    templatesModule.currentScheduleData[day][time] = {
        caregivers: [...caregivers],
        activities: [...activities]
    };
    
    // Return to schedule editor
    $('#cell-editor-view').hide();
    $('#schedule-editor-view').show();
    
    // Update the schedule table
    populateScheduleTable();
    
    showNotification('Cell updated successfully', 'success');
}

/**
 * Cancel cell editing and return to schedule editor
 */
function cancelCellEditor() {
    $('#cell-editor-view').hide();
    $('#schedule-editor-view').show();
    templatesModule.currentCell = null;
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
        schedule: templatesModule.currentScheduleData
    };
    
    $.ajax({
        url: `/api/templates/${templateId}/schedule`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            cancelScheduleEditor();
            loadTemplates();
            showNotification('Schedule saved successfully', 'success');
        },
        error: function(xhr) {
            showNotification('Failed to save schedule', 'danger');
            console.error('Error saving schedule:', xhr);
        }
    });
}

// ==========================================
// CALENDARS OPERATIONS
// ==========================================

/**
 * Display calendars in the UI
 */
function displayCalendars() {
    const container = $('#calendars-container');
    container.empty();
    
    if (calendarsModule.calendars.length === 0) {
        container.html('<div class="no-items-message">No calendars found. Create your first calendar!</div>');
        return;
    }
    
    const calendarsList = $('<div class="list-group calendars-list"></div>');
    
    calendarsModule.calendars.forEach(calendar => {
        const item = $(`
            <div class="list-group-item calendar-item" data-id="${calendar.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${calendar.name}</h5>
                    <div class="calendar-actions">
                        <button class="btn btn-sm btn-primary view-calendar" data-id="${calendar.id}" aria-label="View Calendar">
                            <i class="fa-solid fa-calendar-days"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary edit-calendar" data-id="${calendar.id}" aria-label="Edit Calendar">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-calendar" data-id="${calendar.id}" aria-label="Delete Calendar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="mb-1">Week of ${calendar.start_date || 'Unknown'}</p>
                <small class="text-muted">Based on: ${calendar.template_name || 'No template'}</small>
            </div>
        `);
        
        calendarsList.append(item);
    });
    
    container.append(calendarsList);
}

/**
 * Show the calendar form for creating or editing a calendar
 * @param {string|null} id - The calendar ID to edit, or null for a new calendar
 */
function showCalendarForm(id = null) {
    // Clear previous form data
    $('#calendar-form')[0].reset();
    $('#calendar-id').val('');
    
    if (id) {
        // Edit existing calendar
        const calendar = calendarsModule.calendars.find(c => c.id === id);
        if (calendar) {
            $('#calendar-id').val(calendar.id);
            $('#calendar-name').val(calendar.name);
            $('#calendar-description').val(calendar.description || '');
            $('#calendar-template').val(calendar.template_id || '');
            $('#calendar-start-date').val(calendar.start_date || '');
            $('#calendar-form-title').text('Edit Calendar');
        }
    } else {
        // New calendar
        $('#calendar-form-title').text('Add New Calendar');
        $('#calendar-start-date').val(new Date().toISOString().split('T')[0]); // Set today as default
    }
    
    // Populate template dropdown
    $('#calendar-template').empty();
    $('#calendar-template').append('<option value="">None</option>');
    templatesModule.templates.forEach(template => {
        $('#calendar-template').append(`<option value="${template.id}">${template.name}</option>`);
    });
    
    // Show form view, hide other views
    $('#calendars-list-view').hide();
    $('#calendar-view').hide();
    $('#calendar-form-view').show();
}

/**
 * Save the calendar form
 */
function saveCalendar() {
    const id = $('#calendar-id').val();
    const calendarData = {
        name: $('#calendar-name').val(),
        description: $('#calendar-description').val(),
        template_id: $('#calendar-template').val() || null,
        start_date: $('#calendar-start-date').val()
    };
    
    if (!calendarData.name) {
        showNotification('Please enter a calendar name', 'warning');
        return;
    }
    
    if (!calendarData.start_date) {
        showNotification('Please select a start date', 'warning');
        return;
    }
    
    if (id) {
        // Update existing calendar
        $.ajax({
            url: `/api/calendars/${id}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ ...calendarData, id }),
            success: function(data) {
                showNotification('Calendar updated successfully', 'success');
                loadCalendars();
                $('#calendar-form-view').hide();
                $('#calendars-list-view').show();
            },
            error: function(xhr) {
                showNotification('Error updating calendar', 'danger');
                console.error('Error updating calendar:', xhr);
            }
        });
    } else {
        // Create new calendar
        $.ajax({
            url: '/api/calendars',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(calendarData),
            success: function(data) {
                showNotification('Calendar created successfully', 'success');
                loadCalendars();
                $('#calendar-form-view').hide();
                $('#calendars-list-view').show();
            },
            error: function(xhr) {
                showNotification('Error creating calendar', 'danger');
                console.error('Error creating calendar:', xhr);
            }
        });
    }
}

/**
 * Cancel the calendar form and return to the list view
 */
function cancelCalendarForm() {
    $('#calendar-form-view').hide();
    $('#calendars-list-view').show();
}

/**
 * Show the calendar view for a specific calendar
 * @param {string} id - The calendar ID to view
 */
function showCalendarView(id) {
    const calendar = calendarsModule.calendars.find(c => c.id === id);
    if (!calendar) {
        showNotification('Calendar not found', 'danger');
        return;
    }
    
    // Set current calendar
    calendarsModule.currentCalendar = calendar;
    calendarsModule.currentWeekOffset = 0;
    
    // Update title
    $('#calendar-view-title').text(calendar.name);
    
    // Generate calendar view
    updateCalendarView();
    
    // Show calendar view, hide other views
    $('#calendars-list-view').hide();
    $('#calendar-form-view').hide();
    $('#calendar-view').show();
}

/**
 * Update the calendar view based on the current calendar and week offset
 */
function updateCalendarView() {
    if (!calendarsModule.currentCalendar) {
        return;
    }
    
    const calendar = calendarsModule.currentCalendar;
    const weekOffset = calendarsModule.currentWeekOffset || 0;
    
    // Calculate week dates
    const startDate = new Date(calendar.start_date);
    startDate.setDate(startDate.getDate() + (weekOffset * 7));
    
    // Update week display
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    $('#week-display').text(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
    
    // Add date headers
    const dateHeaders = [''];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dateRow = $('#calendar-dates-header');
    dateRow.empty();
    dateRow.append('<th></th>');
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayCell = $('<th>').text(date.toLocaleDateString());
        dateRow.append(dayCell);
    }
    
    // Generate time slots
    const calendarBody = $('#calendar-table-body');
    calendarBody.empty();
    
    const timeSlots = [
        '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
        '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
    ];
    
    timeSlots.forEach(timeSlot => {
        const row = $('<tr>');
        row.append($('<td>').addClass('time-cell').text(timeSlot));
        
        days.forEach((day, index) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + index);
            const dateStr = date.toISOString().split('T')[0];
            
            const td = $('<td>');
            const cellData = calendar.schedule && calendar.schedule[day.toLowerCase()] && 
                            calendar.schedule[day.toLowerCase()][timeSlot] ? 
                            calendar.schedule[day.toLowerCase()][timeSlot] : {};
            
            // Create cell content
            if (cellData.caregivers && cellData.caregivers.length > 0 || 
                cellData.activities && cellData.activities.length > 0) {
                const content = createCellContentHtml(cellData);
                td.html(content).addClass('has-content');
            }
            
            // Add date classes
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                td.addClass('today');
            } else if (date < today) {
                td.addClass('past');
            } else {
                td.addClass('future');
            }
            
            td.addClass('day-slot')
              .attr('data-day', day.toLowerCase())
              .attr('data-time', timeSlot)
              .attr('data-date', dateStr);
            
            row.append(td);
        });
        
        calendarBody.append(row);
    });
}

/**
 * Show the calendars list view
 */
function showCalendarsList() {
    $('#calendar-view').hide();
    $('#calendar-form-view').hide();
    $('#calendars-list-view').show();
}

/**
 * Navigate the calendar view by the specified number of weeks
 * @param {number} weekDelta - Number of weeks to move (+1 for next, -1 for previous)
 */
function navigateCalendar(weekDelta) {
    if (!calendarsModule.currentCalendar) {
        return;
    }
    
    calendarsModule.currentWeekOffset = (calendarsModule.currentWeekOffset || 0) + weekDelta;
    updateCalendarView();
}

/**
 * Edit the calendar schedule
 */
function editCalendarSchedule() {
    if (!calendarsModule.currentCalendar) {
        return;
    }
    
    // Clone the template
    templatesModule.currentTemplate = {
        id: calendarsModule.currentCalendar.id,
        name: calendarsModule.currentCalendar.name,
        schedule: JSON.parse(JSON.stringify(calendarsModule.currentCalendar.schedule || {}))
    };
    
    // Show schedule editor
    $('#schedule-editor-title').text(`Edit Calendar: ${calendarsModule.currentCalendar.name}`);
    
    // Populate schedule table
    populateScheduleTable();
    
    // Show the schedule editor
    $('#calendar-view').hide();
    $('#schedule-editor-view').show();
}

/**
 * Print the current calendar view
 */
function printCalendar() {
    window.print();
}

// ==========================================
// GENERAL UTILITIES
// ==========================================

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

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Load the templates and calendars HTML content
 */
function loadTemplatesCalendarsContent() {
    $.get('/templates/templates-calendars.html')
        .done(function(html) {
            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract templates and calendars sections
            const templatesSection = doc.getElementById('templates-content');
            const calendarsSection = doc.getElementById('calendars-content');
            
            // Replace content in the existing containers
            if (templatesSection) {
                $('#templates').html(templatesSection.innerHTML);
            }
            
            if (calendarsSection) {
                $('#calendars').html(calendarsSection.innerHTML);
            }
            
            // Initialize now that the content is loaded
            initializeTemplatesCalendars();
        })
        .fail(function(xhr) {
            console.error('Failed to load templates-calendars.html:', xhr);
            showNotification('Failed to load templates and calendars UI', 'danger');
        });
}

/**
 * Initialize templates and calendars after HTML content is loaded
 */
function initializeTemplatesCalendars() {
    console.log('Initializing templates and calendars');
    
    // Load templates and calendars
    loadTemplates();
    loadCalendars();
    
    // Template list view buttons
    $('#add-template-btn').on('click', function() {
        showTemplateForm();
    });
    
    // Template form buttons
    $('#save-template-btn').on('click', function() {
        saveTemplate();
    });
    
    $('#back-to-templates-btn, #cancel-template-btn').on('click', function() {
        cancelTemplateForm();
    });
    
    // Schedule editor buttons
    $('#save-schedule-btn').on('click', function() {
        saveSchedule();
    });
    
    $('#back-from-schedule-btn').on('click', function() {
        cancelScheduleEditor();
    });
    
    // Cell editor buttons
    $('#add-caregiver-btn').on('click', function() {
        const caregiverId = $('#select-caregiver').val();
        if (caregiverId && !templatesModule.currentCell.caregivers.includes(caregiverId)) {
            templatesModule.currentCell.caregivers.push(caregiverId);
            updateAssignedLists();
        }
    });
    
    $('#add-activity-btn').on('click', function() {
        const activityId = $('#select-activity').val();
        if (activityId && !templatesModule.currentCell.activities.includes(activityId)) {
            templatesModule.currentCell.activities.push(activityId);
            updateAssignedLists();
        }
    });
    
    $('#save-cell-btn, #save-cell-changes-btn').on('click', function() {
        saveCellChanges();
    });
    
    $('#back-from-cell-btn, #cancel-cell-edit-btn').on('click', function() {
        cancelCellEditor();
    });
    
    // Category filter change
    $('#category-filter').on('change', function() {
        const categoryId = $(this).val();
        updateActivitiesDropdown(categoryId);
    });
    
    // Template list event delegation
    $(document).on('click', '.edit-template', function() {
        const id = $(this).data('id');
        showTemplateForm(id);
    });
    
    $(document).on('click', '.delete-template', function() {
        const id = $(this).data('id');
        deleteTemplate(id);
    });
    
    $(document).on('click', '.edit-schedule', function() {
        const id = $(this).data('id');
        showScheduleEditor(id);
    });
    
    // Cell editor event delegation
    $(document).on('click', '.remove-caregiver', function() {
        const id = $(this).data('id');
        templatesModule.currentCell.caregivers = templatesModule.currentCell.caregivers.filter(cid => cid !== id);
        updateAssignedLists();
    });
    
    $(document).on('click', '.remove-activity', function() {
        const id = $(this).data('id');
        templatesModule.currentCell.activities = templatesModule.currentCell.activities.filter(aid => aid !== id);
        updateAssignedLists();
    });
    
    // Schedule table cell click
    $(document).on('click', '.day-slot', function() {
        const day = $(this).data('day');
        const time = $(this).data('time');
        showCellEditor(day, time);
    });
}

// Initialize when the document is ready
$(document).ready(function() {
    console.log('Templates and calendars module loaded');
    
    // Load templates and calendars content
    loadTemplatesCalendarsContent();
}); 