// Full Automation Integration
// Combines antidetect + behavior features for complete human-like automation

const stealthHelpers = require('./stealthHelpers.cjs');
const behaviorHelpers = require('./behaviorHelpers.cjs');
const fingerprintIntegration = require('./antidetect/fingerprintIntegration.cjs');
const AutomationMonitor = require('./monitoringHelpers.cjs');

/**
 * Apply full automation suite to a page
 * Includes both antidetect and behavior features
 */
async function applyFullAutomation(page, options = {}) {
    const {
        antidetect = true,
        behavior = true,
        behaviorProfile = 'normal', // 'careful', 'normal', 'fast'
        debug = false,
        monitoring = true // Enable visual monitoring
    } = options;

    // Step 1: Apply antidetect measures
    if (antidetect) {
        console.log('Applying antidetect measures...');

        // Apply stealth helpers
        await stealthHelpers.applyStealthToPage(page);

        // Apply fingerprint integration
        await fingerprintIntegration.applyFullStealth(page);

        console.log('Antidetect measures applied successfully');
    }

    // Step 2: Initialize behavior automation
    let cursor = null;
    if (behavior) {
        console.log(`Initializing behavior automation (${behaviorProfile} profile)...`);

        // Initialize ghost cursor
        cursor = await behaviorHelpers.initializeCursor(page, behaviorProfile);

        console.log('Behavior automation initialized');
    }

    // Step 3: Initialize monitoring
    let monitor = null;
    if (monitoring) {
        console.log('Initializing monitoring system...');
        monitor = new AutomationMonitor(page, {
            showMouse: true,
            showClicks: true,
            showTyping: true,
            logToConsole: true
        });
        await monitor.initialize();
    }

    // Return automation interface
    return {
        page,
        cursor,
        monitor,

        // Wrapped click function with both antidetect and behavior
        async click(selector, options = {}) {
            if (monitor) {
                await monitor.logAction('click', selector);
            }
            if (cursor) {
                return await behaviorHelpers.humanClick(cursor, selector, options);
            } else {
                // Fallback to regular click with small delay
                await behaviorHelpers.randomSleep(50, 150);
                await page.click(selector);
                return true;
            }
        },

        // Wrapped type function with human-like behavior
        async type(selector, text, options = {}) {
            if (monitor) {
                await monitor.logAction('type', `${text.substring(0, 20)}...`);
                await monitor.showTypingIndicator(text);
            }
            const profile = options.profile || behaviorProfile;
            return await behaviorHelpers.humanType(page, selector, text, profile);
        },

        // Wrapped scroll function
        async scroll(direction = 'down', distance = null) {
            if (monitor) {
                await monitor.logAction('scroll', `${direction} ${distance || 'auto'}px`);
            }
            return await behaviorHelpers.humanScroll(page, direction, distance, behaviorProfile);
        },

        // Random mouse movements
        async randomMove(count = 1) {
            if (cursor) {
                return await behaviorHelpers.randomMouseMovement(cursor, count);
            }
        },

        // Wait with random delay
        async wait(minSeconds, maxSeconds) {
            if (monitor) {
                await monitor.logAction('wait', `${minSeconds}-${maxSeconds || minSeconds}s`);
            }
            const min = minSeconds * 1000;
            const max = maxSeconds ? maxSeconds * 1000 : min * 1.5;
            return await behaviorHelpers.randomSleep(min, max);
        },

        // Get monitoring report
        getReport() {
            if (monitor) {
                return monitor.generateReport();
            }
            return null;
        },

        // Navigate with human-like behavior
        async goto(url, options = {}) {
            if (monitor) {
                await monitor.logAction('navigate', url);
            }
            // Random delay before navigation
            await behaviorHelpers.randomSleep(500, 1500);

            const result = await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000,
                ...options
            });

            // Wait for page to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Random delay after page load
            await behaviorHelpers.randomSleep(1000, 3000);

            // Sometimes do random mouse movement after page load
            if (cursor && Math.random() > 0.7) {
                // Extra safety delay before mouse movement
                await behaviorHelpers.randomSleep(500, 1000);
                await behaviorHelpers.randomMouseMovement(cursor, 1);
            }

            return result;
        },

        // Check element with retry and human-like behavior
        async waitAndClick(selector, options = {}) {
            const {
                timeout = 10000,
                visible = true,
                retries = 3
            } = options;

            for (let i = 0; i < retries; i++) {
                try {
                    // Wait for element
                    await page.waitForSelector(selector, {
                        visible,
                        timeout: timeout / retries
                    });

                    // Human-like delay before clicking
                    await behaviorHelpers.randomSleep(200, 600);

                    // Click with behavior
                    const success = await this.click(selector, options);
                    if (success) return true;

                } catch (error) {
                    console.log(`Attempt ${i + 1} failed, retrying...`);

                    // Scroll a bit and try again
                    if (i < retries - 1) {
                        await this.scroll('down', 200);
                        await behaviorHelpers.randomSleep(500, 1000);
                    }
                }
            }

            return false;
        },

        // Fill form with human-like behavior
        async fillForm(formData) {
            for (const [selector, value] of Object.entries(formData)) {
                // Click on field
                await this.click(selector);
                await behaviorHelpers.randomSleep(100, 300);

                // Clear field
                await page.keyboard.down('Control');
                await page.keyboard.press('a');
                await page.keyboard.up('Control');
                await behaviorHelpers.randomSleep(50, 150);

                // Type value
                await this.type(selector, value);

                // Tab to next field or small delay
                if (Math.random() > 0.5) {
                    await page.keyboard.press('Tab');
                } else {
                    await behaviorHelpers.randomSleep(300, 800);
                }
            }
        }
    };
}

/**
 * Create a browser with full automation features
 */
async function createAutomatedBrowser(puppeteer, options = {}) {
    const {
        headless = false,
        antidetect = true,
        behaviorProfile = 'normal',
        viewport = { width: 1366, height: 768 },
        args = []
    } = options;

    // Prepare browser args for antidetect
    const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1400,900',
        ...args
    ];

    // Launch browser
    const browser = await puppeteer.launch({
        headless,
        args: browserArgs,
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null
    });

    // Create page
    const page = await browser.newPage();

    // Set viewport with randomization
    await page.setViewport({
        width: viewport.width + Math.floor(Math.random() * 100 - 50),
        height: viewport.height + Math.floor(Math.random() * 100 - 50),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false
    });

    // Apply full automation
    const automation = await applyFullAutomation(page, {
        antidetect,
        behavior: true,
        behaviorProfile
    });

    return {
        browser,
        page,
        automation
    };
}

module.exports = {
    applyFullAutomation,
    createAutomatedBrowser
};