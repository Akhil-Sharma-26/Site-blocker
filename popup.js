// Global variables for popup state
let currentRules = [];
let currentTab = null;
let extensionEnabled = true;

/**
 * Initialize the popup when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Smart Redirect Popup: Initializing...');
    
    // Set up event listeners for popup buttons
    setupEventListeners();
    
    // Load current state and display information
    loadPopupData();
});

/**
 * Set up event listeners for popup interactions
 */
function setupEventListeners() {
    // Open settings page
    document.getElementById('openSettings').addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL('options.html') });
        window.close(); // Close the popup
    });
    
    // Add quick rule for current site
    document.getElementById('addQuickRule').addEventListener('click', addQuickRule);
    
    // Toggle extension on/off
    document.getElementById('toggleExtension').addEventListener('click', toggleExtension);
}

/**
 * Load all necessary data for the popup display
 */
async function loadPopupData() {
    try {
        // Get current active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];
        
        // Load redirect rules from storage
        const result = await browser.storage.local.get(['redirectRules', 'extensionEnabled']);
        currentRules = result.redirectRules || [];
        extensionEnabled = result.extensionEnabled !== false; // Default to true
        
        // Update the popup display
        updatePopupDisplay();
        
    } catch (error) {
        console.error('Smart Redirect Popup: Error loading data:', error);
        updatePopupDisplay(); // Show what we can even if there's an error
    }
}

/**
 * Update the popup display with current information
 */
function updatePopupDisplay() {
    // Update rule count
    const activeRules = currentRules.filter(rule => rule.enabled).length;
    document.getElementById('ruleCount').textContent = activeRules;
    
    // Update current site information
    updateCurrentSiteInfo();
    
    // Update extension toggle button
    updateToggleButton();
}

/**
 * Update the current site information section
 */
function updateCurrentSiteInfo() {
    const currentSiteElement = document.getElementById('currentSite');
    const siteStatusElement = document.getElementById('siteStatus');
    
    if (!currentTab || !currentTab.url) {
        currentSiteElement.textContent = 'Unable to detect current site';
        siteStatusElement.textContent = 'Unknown';
        siteStatusElement.className = 'site-status normal';
        return;
    }
    
    try {
        const url = new URL(currentTab.url);
        const hostname = url.hostname;
        
        // Display the current site
        currentSiteElement.textContent = hostname;
        
        // Check if there's a matching redirect rule
        const matchingRule = findMatchingRule(currentTab.url);
        
        if (matchingRule && matchingRule.enabled) {
            siteStatusElement.textContent = 'Will redirect';
            siteStatusElement.className = 'site-status redirected';
        } else {
            siteStatusElement.textContent = 'No redirect rule';
            siteStatusElement.className = 'site-status normal';
        }
        
    } catch (error) {
        currentSiteElement.textContent = 'Invalid URL';
        siteStatusElement.textContent = 'Error';
        siteStatusElement.className = 'site-status normal';
    }
}

/**
 * Find a matching redirect rule for a given URL
 * @param {string} url - The URL to check
 * @returns {Object|null} Matching rule or null
 */
function findMatchingRule(url) {
    try {
        const urlObject = new URL(url);
        const hostname = urlObject.hostname.toLowerCase();
        
        for (const rule of currentRules) {
            if (!rule.enabled) continue;
            
            const sourcePattern = rule.source.toLowerCase();
            
            switch (rule.matchType) {
                case 'exact':
                    if (hostname === sourcePattern) return rule;
                    break;
                case 'contains':
                    if (hostname.includes(sourcePattern)) return rule;
                    break;
                case 'startswith':
                    if (hostname.startsWith(sourcePattern)) return rule;
                    break;
                default:
                    if (hostname === sourcePattern) return rule;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Update the toggle button based on extension state
 */
function updateToggleButton() {
    const toggleButton = document.getElementById('toggleExtension');
    
    if (extensionEnabled) {
        toggleButton.innerHTML = `
            <span>Disable Extension</span>
            <span class="button-icon">⏸️</span>
        `;
    } else {
        toggleButton.innerHTML = `
            <span>Enable Extension</span>
            <span class="button-icon">▶️</span>
        `;
    }
}

/**
 * Add a quick rule for the current site
 */
async function addQuickRule() {
    if (!currentTab || !currentTab.url) {
        alert('Unable to detect current site');
        return;
    }
    
    try {
        const url = new URL(currentTab.url);
        const hostname = url.hostname;
        
        // Check if rule already exists
        const existingRule = currentRules.find(rule => 
            rule.source.toLowerCase() === hostname.toLowerCase()
        );
        
        if (existingRule) {
            alert('A redirect rule for this site already exists!');
            return;
        }
        
        // Prompt user for destination URL
        const destination = prompt(
            `Create a redirect rule for ${hostname}\n\n` +
            `Enter the destination URL (include http:// or https://):`,
            'https://'
        );
        
        if (!destination) {
            return; // User cancelled
        }
        
        // Validate destination URL
        try {
            new URL(destination);
        } catch (error) {
            alert('Please enter a valid destination URL');
            return;
        }
        
        // Create new rule
        const newRule = {
            id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            source: hostname,
            destination: destination,
            matchType: 'exact',
            enabled: true,
            created: new Date().toISOString()
        };
        
        // Add rule to collection
        currentRules.push(newRule);
        
        // Save to storage
        await browser.storage.local.set({ redirectRules: currentRules });
        
        // Notify background script
        await browser.runtime.sendMessage({ action: 'updateRules' });
        
        // Update display
        updatePopupDisplay();
        
        alert('Redirect rule added successfully!');
        
    } catch (error) {
        console.error('Smart Redirect Popup: Error adding quick rule:', error);
        alert('Error adding redirect rule');
    }
}

/**
 * Toggle the extension on/off
 */
async function toggleExtension() {
    try {
        extensionEnabled = !extensionEnabled;
        
        // Save the new state
        await browser.storage.local.set({ extensionEnabled: extensionEnabled });
        
        // Update display
        updateToggleButton();
        
        // Show confirmation
        const message = extensionEnabled ? 'Extension enabled' : 'Extension disabled';
        alert(message);
        
    } catch (error) {
        console.error('Smart Redirect Popup: Error toggling extension:', error);
        alert('Error toggling extension');
    }
}