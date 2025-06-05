/**
 * Smart Redirect Extension - Background Script
 * This script runs persistently in the background and intercepts web requests
 * to perform redirections based on user-configured rules.
 */

// Global variables to store redirect rules and extension state
let redirectRules = [];
let extensionEnabled = true;

/**
 * Initialize the extension when it starts up
 * This function loads saved settings and sets up the web request listener
 */
function initializeExtension() {
    console.log('Smart Redirect: Initializing extension...');
    
    // Load existing redirect rules from browser storage
    loadRedirectRules().then(() => {
        console.log('Smart Redirect: Rules loaded successfully');
        
        // Set up the web request interceptor
        setupWebRequestListener();
    }).catch(error => {
        console.error('Smart Redirect: Error loading rules:', error);
        
        // Even if loading fails, we should still set up the listener
        setupWebRequestListener();
    });
}

/**
 * Load redirect rules from browser's local storage
 * @returns {Promise} Promise that resolves when rules are loaded
 */
function loadRedirectRules() {
    return new Promise((resolve, reject) => {
        // Use Firefox's storage API to retrieve saved rules and extension state
        browser.storage.local.get(['redirectRules', 'defaultRedirectUrl', 'extensionEnabled']).then(result => {
            // If rules exist, use them; otherwise initialize with empty array
            redirectRules = result.redirectRules || [];
            extensionEnabled = result.extensionEnabled !== false; // Default to true
            
            // Handle first-time setup: if no rules exist and no default URL is set
            if (redirectRules.length === 0 && !result.defaultRedirectUrl) {
                console.log('Smart Redirect: First time setup detected');
                // Open options page for initial configuration
                browser.tabs.create({ url: browser.runtime.getURL('options.html') });
            }
            
            resolve();
        }).catch(error => {
            reject(error);
        });
    });
}

/**
 * Set up the web request listener that intercepts navigation requests
 * This is the core functionality that performs the actual redirections
 */
function setupWebRequestListener() {
    // Remove any existing listener to avoid duplicates
    if (browser.webRequest.onBeforeRequest.hasListener(handleWebRequest)) {
        browser.webRequest.onBeforeRequest.removeListener(handleWebRequest);
    }
    
    // Add listener for all HTTP/HTTPS requests
    browser.webRequest.onBeforeRequest.addListener(
        handleWebRequest,
        {
            urls: ["<all_urls>"], // Listen to all URLs
            types: ["main_frame"] // Only intercept main page requests (not images, scripts, etc.)
        },
        ["blocking"] // Allow us to modify the request
    );
    
    console.log('Smart Redirect: Web request listener established');
}

/**
 * Handle incoming web requests and perform redirections if needed
 * @param {Object} details - Request details from webRequest API
 * @returns {Object|undefined} Redirect response or undefined to allow normal loading
 */
function handleWebRequest(details) {
    // Check if extension is enabled
    if (!extensionEnabled) {
        return; // Extension is disabled, allow normal loading
    }
    
    const requestUrl = details.url;
    
    // Skip non-HTTP protocols (chrome://, moz-extension://, etc.)
    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
        return;
    }
    
    // Check if this URL matches any of our redirect rules
    const matchingRule = findMatchingRule(requestUrl);
    
    if (matchingRule) {
        console.log(`Smart Redirect: Redirecting ${requestUrl} to ${matchingRule.destination}`);
        
        // Return redirect response to Firefox
        return {
            redirectUrl: matchingRule.destination
        };
    }
    
    // No matching rule found, allow normal page loading
    return;
}

/**
 * Find a redirect rule that matches the given URL
 * @param {string} url - The URL to check against rules
 * @returns {Object|null} Matching rule object or null if no match
 */
function findMatchingRule(url) {
    try {
        // Parse the URL to extract hostname and other components
        const urlObject = new URL(url);
        const hostname = urlObject.hostname.toLowerCase();
        
        // Check each rule to see if it matches this URL
        for (const rule of redirectRules) {
            if (!rule.enabled) {
                continue; // Skip disabled rules
            }
            
            const sourcePattern = rule.source.toLowerCase();
            
            // Support different matching modes
            if (rule.matchType === 'exact') {
                // Exact hostname match
                if (hostname === sourcePattern) {
                    return rule;
                }
            } else if (rule.matchType === 'contains') {
                // Hostname contains the pattern
                if (hostname.includes(sourcePattern)) {
                    return rule;
                }
            } else if (rule.matchType === 'startswith') {
                // Hostname starts with the pattern
                if (hostname.startsWith(sourcePattern)) {
                    return rule;
                }
            } else {
                // Default: exact match for backward compatibility
                if (hostname === sourcePattern) {
                    return rule;
                }
            }
        }
        
        return null; // No matching rule found
        
    } catch (error) {
        console.error('Smart Redirect: Error parsing URL:', url, error);
        return null;
    }
}

/**
 * Update redirect rules and reload them
 * This function is called when settings are changed
 */
function updateRedirectRules() {
    console.log('Smart Redirect: Updating rules...');
    loadRedirectRules().then(() => {
        console.log('Smart Redirect: Rules updated successfully');
    }).catch(error => {
        console.error('Smart Redirect: Error updating rules:', error);
    });
}

/**
 * Listen for messages from other parts of the extension
 * This allows the options page to communicate with the background script
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'updateRules':
            updateRedirectRules();
            sendResponse({ success: true });
            break;
            
        case 'getRules':
            sendResponse({ rules: redirectRules });
            break;
            
        default:
            console.log('Smart Redirect: Unknown message action:', message.action);
    }
});

/**
 * Listen for storage changes to automatically update rules and extension state
 * This ensures the background script stays in sync with settings changes
 */
browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.redirectRules) {
            console.log('Smart Redirect: Storage changed, updating rules...');
            updateRedirectRules();
        }
        if (changes.extensionEnabled) {
            extensionEnabled = changes.extensionEnabled.newValue;
            console.log('Smart Redirect: Extension state changed to:', extensionEnabled);
        }
    }
});

// Initialize the extension when the background script loads
initializeExtension();