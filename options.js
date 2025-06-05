/**
 * adding, editing, and managing redirect rules.
 */

// Global variables to track the current state
let currentRules = [];
let isFirstTime = false;

/**
 * Initialize the options page when the DOM is loaded
 * This function sets up event handlers and loads existing configuration
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Smart Redirect Options: Initializing options page...');
    
    // Set up all event listeners for user interactions
    setupEventListeners();
    
    // Load and display existing redirect rules
    loadExistingRules();
});

/**
 * Set up event listeners for all interactive elements on the page
 * This centralizes all the event handling logic for better organization
 */
function setupEventListeners() {
    // Form submission for adding new rules
    const addRuleForm = document.getElementById('addRuleForm');
    addRuleForm.addEventListener('submit', handleAddRule);
    
    // Import/Export functionality
    document.getElementById('exportRules').addEventListener('click', exportRules);
    document.getElementById('importRules').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importRules);
    
    // Clear all rules with confirmation
    document.getElementById('clearAllRules').addEventListener('click', clearAllRules);
    
    console.log('Smart Redirect Options: Event listeners established');
}

/**
 * Load existing redirect rules from storage and display them
 * This function also detects if this is the user's first time setting up the extension
 */
function loadExistingRules() {
    // Retrieve rules from Firefox's local storage
    browser.storage.local.get(['redirectRules']).then(result => {
        currentRules = result.redirectRules || [];
        
        console.log('Smart Redirect Options: Loaded', currentRules.length, 'existing rules');
        
        // Check if this is the first time the user is setting up the extension
        if (currentRules.length === 0) {
            isFirstTime = true;
            showFirstTimeSetup();
        }
        
        // Display all the rules in the interface
        displayRules();
        
    }).catch(error => {
        console.error('Smart Redirect Options: Error loading rules:', error);
        showStatusMessage('Error loading existing rules', 'error');
    });
}

/**
 * Display the first-time setup message to welcome new users
 * This helps orient users who are configuring the extension for the first time
 */
function showFirstTimeSetup() {
    const firstSetupElement = document.getElementById('firstSetupMessage');
    firstSetupElement.style.display = 'block';
    
    // Smooth scroll to the setup message to draw attention
    firstSetupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Handle the form submission for adding a new redirect rule
 * This function validates the input and adds the rule to the collection
 * @param {Event} event - The form submission event
 */
function handleAddRule(event) {
    // Prevent the default form submission behavior
    event.preventDefault();
    
    // Extract values from the form fields
    const sourceUrl = document.getElementById('sourceUrl').value.trim();
    const destinationUrl = document.getElementById('destinationUrl').value.trim();
    const matchType = document.getElementById('matchType').value;
    
    // Validate the input before proceeding
    if (!validateInputs(sourceUrl, destinationUrl)) {
        return; // Validation failed, don't add the rule
    }
    
    // Clean up the source URL to ensure consistency
    const cleanedSource = cleanSourceUrl(sourceUrl);
    
    // Check if a rule for this source already exists
    const existingRule = currentRules.find(rule => 
        rule.source.toLowerCase() === cleanedSource.toLowerCase() && 
        rule.matchType === matchType
    );
    
    if (existingRule) {
        showStatusMessage('A rule for this website already exists!', 'error');
        return;
    }
    
    // Create the new rule object
    const newRule = {
        id: generateRuleId(), // Generate a unique identifier
        source: cleanedSource,
        destination: destinationUrl,
        matchType: matchType,
        enabled: true, // New rules are enabled by default
        created: new Date().toISOString() // Track when the rule was created
    };
    
    // Add the rule to our collection
    currentRules.push(newRule);
    
    // Save the updated rules to storage
    saveRules().then(() => {
        // Clear the form for the next entry
        document.getElementById('addRuleForm').reset();
        
        // Refresh the display
        displayRules();
        
        // Show success message
        showStatusMessage('Redirect rule added successfully!', 'success');
        
        // Hide first-time setup message if it was showing
        if (isFirstTime) {
            document.getElementById('firstSetupMessage').style.display = 'none';
            isFirstTime = false;
        }
        
    }).catch(error => {
        console.error('Smart Redirect Options: Error saving rule:', error);
        showStatusMessage('Error saving redirect rule', 'error');
    });
}

/**
 * Validate user inputs for creating a redirect rule
 * This ensures we have valid data before creating rules
 * @param {string} sourceUrl - The source website to redirect from
 * @param {string} destinationUrl - The destination URL to redirect to
 * @returns {boolean} True if inputs are valid, false otherwise
 */
function validateInputs(sourceUrl, destinationUrl) {
    // Check if source URL is provided and reasonable
    if (!sourceUrl || sourceUrl.length < 3) {
        showStatusMessage('Please enter a valid source website', 'error');
        return false;
    }
    
    // Check if destination URL is provided
    if (!destinationUrl) {
        showStatusMessage('Please enter a destination URL', 'error');
        return false;
    }
    
    // Validate that destination URL is properly formatted
    try {
        new URL(destinationUrl);
    } catch (error) {
        showStatusMessage('Please enter a valid destination URL (include http:// or https://)', 'error');
        return false;
    }
    
    // Check for obviously problematic patterns
    if (sourceUrl.includes('://')) {
        showStatusMessage('Source website should be just the domain name (without http://)', 'error');
        return false;
    }
    
    return true; // All validation checks passed
}

/**
 * Clean and normalize the source URL input
 * This removes common prefixes and ensures consistent formatting
 * @param {string} sourceUrl - The raw source URL input
 * @returns {string} Cleaned source URL
 */
function cleanSourceUrl(sourceUrl) {
    let cleaned = sourceUrl.toLowerCase().trim();
    
    // Remove common prefixes that users might accidentally include
    cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    // Remove trailing slashes
    cleaned = cleaned.replace(/\/+$/, '');
    
    return cleaned;
}

/**
 * Generate a unique identifier for a new rule
 * This helps us track and manage individual rules
 * @returns {string} Unique rule identifier
 */
function generateRuleId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Display all redirect rules in the user interface
 * This function creates the visual representation of each rule
 */
function displayRules() {
    const rulesList = document.getElementById('rulesList');
    
    // Clear existing content
    rulesList.innerHTML = '';
    
    if (currentRules.length === 0) {
        // Show empty state message
        rulesList.innerHTML = `
            <p style="color: #6b7280; text-align: center; padding: 40px;">
                No redirect rules configured yet. Add your first rule above!
            </p>
        `;
        return;
    }
    
    // Create a visual element for each rule
    currentRules.forEach(rule => {
        const ruleElement = createRuleElement(rule);
        rulesList.appendChild(ruleElement);
    });
    
    console.log('Smart Redirect Options: Displayed', currentRules.length, 'rules');
}

/**
 * Create a DOM element representing a single redirect rule
 * This builds the visual interface for each rule with all its controls
 * @param {Object} rule - The rule object to display
 * @returns {HTMLElement} DOM element representing the rule
 */
function createRuleElement(rule) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.setAttribute('data-rule-id', rule.id);
    
    // Build the HTML structure for this rule
    ruleDiv.innerHTML = `
        <div class="rule-header">
            <span class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
                ${rule.enabled ? 'Active' : 'Disabled'}
            </span>
        </div>
        
        <div class="rule-details">
            <div class="rule-field">
                <label>From Website:</label>
                <span>${rule.source}</span>
            </div>
            <div class="rule-field">
                <label>To URL:</label>
                <span>${rule.destination}</span>
            </div>
            <div class="rule-field">
                <label>Match Type:</label>
                <span>${rule.matchType}</span>
            </div>
        </div>
        
        <div class="rule-actions">
            <label class="toggle-switch">
                <input type="checkbox" ${rule.enabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <button class="button secondary edit-rule">Edit</button>
            <button class="button danger delete-rule">Delete</button>
        </div>
    `;
    
    // Set up event listeners for this specific rule
    setupRuleEventListeners(ruleDiv, rule);
    
    return ruleDiv;
}

/**
 * Set up event listeners for a specific rule element
 * This handles toggling, editing, and deleting individual rules
 * @param {HTMLElement} ruleElement - The DOM element for the rule
 * @param {Object} rule - The rule object
 */
function setupRuleEventListeners(ruleElement, rule) {
    // Toggle switch for enabling/disabling the rule
    const toggleSwitch = ruleElement.querySelector('input[type="checkbox"]');
    toggleSwitch.addEventListener('change', () => {
        toggleRule(rule.id, toggleSwitch.checked);
    });
    
    // Edit button functionality
    const editButton = ruleElement.querySelector('.edit-rule');
    editButton.addEventListener('click', () => {
        editRule(rule.id);
    });
    
    // Delete button functionality
    const deleteButton = ruleElement.querySelector('.delete-rule');
    deleteButton.addEventListener('click', () => {
        deleteRule(rule.id);
    });
}

/**
 * Toggle a rule's enabled/disabled state
 * @param {string} ruleId - The ID of the rule to toggle
 * @param {boolean} enabled - Whether the rule should be enabled
 */
function toggleRule(ruleId, enabled) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) {
        rule.enabled = enabled;
        
        // Save the updated rules
        saveRules().then(() => {
            displayRules(); // Refresh the display
            showStatusMessage(`Rule ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
        }).catch(error => {
            console.error('Smart Redirect Options: Error toggling rule:', error);
            showStatusMessage('Error updating rule', 'error');
        });
    }
}

/**
 * Edit an existing rule by populating the form with its current values
 * @param {string} ruleId - The ID of the rule to edit
 */
function editRule(ruleId) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Populate the form with the rule's current values
    document.getElementById('sourceUrl').value = rule.source;
    document.getElementById('destinationUrl').value = rule.destination;
    document.getElementById('matchType').value = rule.matchType;
    
    // Remove the rule from the list (it will be re-added when the form is submitted)
    currentRules = currentRules.filter(r => r.id !== ruleId);
    
    // Save the updated rules and refresh display
    saveRules().then(() => {
        displayRules();
        showStatusMessage('Rule loaded for editing. Modify the values above and click "Add Redirect Rule" to save changes.', 'success');
        
        // Scroll to the form
        document.getElementById('addRuleForm').scrollIntoView({ behavior: 'smooth' });
    });
}

/**
 * Delete a rule after user confirmation
 * @param {string} ruleId - The ID of the rule to delete
 */
function deleteRule(ruleId) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Ask for confirmation before deleting
    const confirmed = confirm(`Are you sure you want to delete the redirect rule for "${rule.source}"?`);
    
    if (confirmed) {
        // Remove the rule from the array
        currentRules = currentRules.filter(r => r.id !== ruleId);
        
        // Save the updated rules
        saveRules().then(() => {
            displayRules(); // Refresh the display
            showStatusMessage('Rule deleted successfully', 'success');
        }).catch(error => {
            console.error('Smart Redirect Options: Error deleting rule:', error);
            showStatusMessage('Error deleting rule', 'error');
        });
    }
}

/**
 * Save the current rules to browser storage
 * This function also notifies the background script to update its rules
 * @returns {Promise} Promise that resolves when rules are saved
 */
function saveRules() {
    return browser.storage.local.set({ redirectRules: currentRules }).then(() => {
        // Notify the background script that rules have been updated
        return browser.runtime.sendMessage({ action: 'updateRules' });
    });
}

/**
 * Export all rules to a JSON file for backup purposes
 * This allows users to save their configuration and restore it later
 */
function exportRules() {
    if (currentRules.length === 0) {
        showStatusMessage('No rules to export', 'error');
        return;
    }
    
    // Create export data with metadata
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        rules: currentRules
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a downloadable file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `smart-redirect-rules-${new Date().toISOString().split('T')[0]}.json`;
    
    // Trigger the download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    showStatusMessage('Rules exported successfully', 'success');
}

/**
 * Import rules from a JSON file
 * This allows users to restore their configuration from a backup
 * @param {Event} event - The file input change event
 */
function importRules(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's a JSON file
    if (!file.name.endsWith('.json')) {
        showStatusMessage('Please select a valid JSON file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // Parse the JSON data
            const importData = JSON.parse(e.target.result);
            
            // Validate the import data structure
            if (!importData.rules || !Array.isArray(importData.rules)) {
                throw new Error('Invalid file format');
            }
            
            // Ask for confirmation before importing
            const confirmed = confirm(
                `This will import ${importData.rules.length} rules. ` +
                `Do you want to replace your current rules or merge them?\n\n` +
                `Click OK to REPLACE all current rules, or Cancel to MERGE with existing rules.`
            );
            
            if (confirmed) {
                // Replace all current rules
                currentRules = importData.rules;
            } else {
                // Merge with existing rules (avoid duplicates)
                const existingSources = new Set(currentRules.map(r => r.source.toLowerCase()));
                const newRules = importData.rules.filter(rule => 
                    !existingSources.has(rule.source.toLowerCase())
                );
                currentRules = [...currentRules, ...newRules];
            }
            
            // Ensure all rules have required properties
            currentRules = currentRules.map(rule => ({
                id: rule.id || generateRuleId(),
                source: rule.source,
                destination: rule.destination,
                matchType: rule.matchType || 'exact',
                enabled: rule.enabled !== false, // Default to true if not specified
                created: rule.created || new Date().toISOString()
            }));
            
            // Save the imported rules
            saveRules().then(() => {
                displayRules();
                showStatusMessage(`Successfully imported ${importData.rules.length} rules`, 'success');
            });
            
        } catch (error) {
            console.error('Smart Redirect Options: Error importing rules:', error);
            showStatusMessage('Error importing rules. Please check the file format.', 'error');
        }
    };
    
    reader.readAsText(file);
    
    // Clear the file input for future use
    event.target.value = '';
}

/**
 * Clear all rules after user confirmation
 * This provides a way to reset the extension to its initial state
 */
function clearAllRules() {
    if (currentRules.length === 0) {
        showStatusMessage('No rules to clear', 'error');
        return;
    }
    
    // Ask for confirmation before clearing all rules
    const confirmed = confirm(
        `Are you sure you want to delete ALL ${currentRules.length} redirect rules?\n\n` +
        `This action cannot be undone. Consider exporting your rules first as a backup.`
    );
    
    if (confirmed) {
        currentRules = [];
        
        saveRules().then(() => {
            displayRules();
            showStatusMessage('All rules have been cleared', 'success');
            
            // Show first-time setup message again
            isFirstTime = true;
            showFirstTimeSetup();
        }).catch(error => {
            console.error('Smart Redirect Options: Error clearing rules:', error);
            showStatusMessage('Error clearing rules', 'error');
        });
    }
}

/**
 * Display a status message to the user
 * This provides feedback for user actions
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success' or 'error')
 */
function showStatusMessage(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    
    // Create the message element
    statusDiv.innerHTML = `
        <div class="alert ${type}">
            ${message}
        </div>
    `;
    
    // Scroll to the message so the user sees it
    statusDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 5000);
    }
    
    console.log(`Smart Redirect Options: ${type.toUpperCase()} - ${message}`);
}