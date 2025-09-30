// Human-like Behavior Helpers
// Integrates ghost-cursor and typing behaviors for natural automation

const ghostCursor = require('ghost-cursor');

// Behavior configuration profiles
const behaviorProfiles = {
    careful: {
        mouse: {
            hesitation: { min: 100, max: 500 },
            moveSpeed: 0.7,
            overshoot: { frequency: 3, radius: 10 }
        },
        typing: {
            speed: { min: 80, max: 150 },
            mistakes: { chance: 2, fixDelay: { min: 500, max: 1000 } },
            delays: {
                space: { chance: 70, min: 50, max: 150 },
                punctuation: { chance: 80, min: 100, max: 300 },
                sentence: { chance: 90, min: 300, max: 800 }
            }
        },
        scrolling: {
            speed: { min: 300, max: 700 },
            acceleration: 1.2,
            deceleration: 0.8
        }
    },
    normal: {
        mouse: {
            hesitation: { min: 50, max: 300 },
            moveSpeed: 1,
            overshoot: { frequency: 5, radius: 20 }
        },
        typing: {
            speed: { min: 100, max: 200 },
            mistakes: { chance: 4, fixDelay: { min: 300, max: 700 } },
            delays: {
                space: { chance: 60, min: 30, max: 100 },
                punctuation: { chance: 70, min: 80, max: 250 },
                sentence: { chance: 85, min: 200, max: 600 }
            }
        },
        scrolling: {
            speed: { min: 400, max: 800 },
            acceleration: 1.3,
            deceleration: 0.7
        }
    },
    fast: {
        mouse: {
            hesitation: { min: 20, max: 150 },
            moveSpeed: 1.5,
            overshoot: { frequency: 7, radius: 30 }
        },
        typing: {
            speed: { min: 150, max: 300 },
            mistakes: { chance: 6, fixDelay: { min: 200, max: 500 } },
            delays: {
                space: { chance: 50, min: 20, max: 70 },
                punctuation: { chance: 60, min: 50, max: 150 },
                sentence: { chance: 75, min: 150, max: 400 }
            }
        },
        scrolling: {
            speed: { min: 500, max: 1000 },
            acceleration: 1.5,
            deceleration: 0.6
        }
    }
};

// Initialize cursor for a page with behavior profile
async function initializeCursor(page, profile = 'normal') {
    const config = behaviorProfiles[profile];

    try {
        // Simple cursor without getRandomPagePoint to avoid context issues
        const cursor = ghostCursor.createCursor(page);

        // Install mouse helper for debugging (optional)
        if (process.env.DEBUG_CURSOR === 'true') {
            await ghostCursor.installMouseHelper(page);
        }

        return cursor;
    } catch (error) {
        console.log('Ghost cursor initialization failed, creating fallback cursor');
        // Return a fallback cursor object
        return {
            page: page,
            move: async (target) => {
                try {
                    if (typeof target === 'string') {
                        // If it's a selector, hover over it
                        await page.hover(target);
                    } else if (target.x && target.y) {
                        // If it's coordinates, move mouse
                        await page.mouse.move(target.x, target.y);
                    }
                } catch (e) {
                    console.log('Fallback cursor move failed:', e.message);
                }
            },
            click: async (selector) => {
                try {
                    await page.click(selector);
                } catch (e) {
                    console.log('Fallback cursor click failed:', e.message);
                }
            }
        };
    }
}

// Human-like mouse click with ghost-cursor
async function humanClick(cursor, selector, options = {}) {
    const {
        hesitateBeforeClick = true,
        hesitateAfterClick = true,
        doubleClick = false,
        rightClick = false
    } = options;

    try {
        // Wait for element
        const element = await cursor.page.waitForSelector(selector, {
            visible: true,
            timeout: 10000
        });

        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        // Move to element with human-like movement
        try {
            await cursor.move(selector);
        } catch (moveError) {
            // Fallback to hover if ghost cursor fails
            console.log('Ghost cursor move failed, using hover fallback');
            await cursor.page.hover(selector);
        }

        // Hesitate before clicking (human behavior)
        if (hesitateBeforeClick) {
            await randomSleep(100, 400);
        }

        // Click action - use page.click as fallback
        try {
            if (doubleClick) {
                await cursor.click(selector, { clickCount: 2 });
            } else if (rightClick) {
                await cursor.click(selector, { button: 'right' });
            } else {
                await cursor.click(selector);
            }
        } catch (clickError) {
            // Fallback to page.click
            console.log('Ghost cursor click failed, using page.click fallback');
            if (doubleClick) {
                await cursor.page.click(selector, { clickCount: 2 });
            } else if (rightClick) {
                await cursor.page.click(selector, { button: 'right' });
            } else {
                await cursor.page.click(selector);
            }
        }

        // Hesitate after clicking
        if (hesitateAfterClick) {
            await randomSleep(50, 200);
        }

        return true;
    } catch (error) {
        console.error('Human click failed:', error.message);
        // Final fallback - simple click
        try {
            await cursor.page.click(selector);
            return true;
        } catch (finalError) {
            return false;
        }
    }
}

// Human-like typing with mistakes and corrections
async function humanType(page, selector, text, profile = 'normal') {
    const config = behaviorProfiles[profile].typing;

    // Click on the input field first
    const element = await page.waitForSelector(selector);
    await element.click();
    await randomSleep(100, 300);

    // Clear existing text if any
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await randomSleep(50, 150);

    // Type character by character
    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Random typing speed
        const typeDelay = randomInRange(config.speed.min, config.speed.max);

        // Sometimes make a mistake
        if (Math.random() * 100 < config.mistakes.chance) {
            // Type wrong character
            const wrongChar = getRandomChar();
            await page.keyboard.type(wrongChar);
            await randomSleep(typeDelay, typeDelay * 1.5);

            // Realize mistake and fix it
            await randomSleep(config.mistakes.fixDelay.min, config.mistakes.fixDelay.max);
            await page.keyboard.press('Backspace');
            await randomSleep(50, 150);
        }

        // Type the correct character
        await page.keyboard.type(char);

        // Add delays based on character type
        if (char === ' ' && Math.random() * 100 < config.delays.space.chance) {
            await randomSleep(config.delays.space.min, config.delays.space.max);
        } else if (['.', ',', '!', '?'].includes(char) && Math.random() * 100 < config.delays.punctuation.chance) {
            await randomSleep(config.delays.punctuation.min, config.delays.punctuation.max);
        } else if (char === '.' && Math.random() * 100 < config.delays.sentence.chance) {
            await randomSleep(config.delays.sentence.min, config.delays.sentence.max);
        } else {
            await randomSleep(typeDelay * 0.8, typeDelay * 1.2);
        }

        // Sometimes pause mid-typing (thinking)
        if (Math.random() > 0.95) {
            await randomSleep(500, 2000);
        }
    }
}

// Human-like scrolling with acceleration/deceleration
async function humanScroll(page, direction = 'down', distance = null, profile = 'normal') {
    const config = behaviorProfiles[profile].scrolling;

    // Get page dimensions
    const dimensions = await page.evaluate(() => {
        return {
            height: document.documentElement.scrollHeight,
            viewHeight: window.innerHeight,
            currentScroll: window.scrollY
        };
    });

    // Calculate scroll distance if not provided
    if (!distance) {
        distance = direction === 'down'
            ? dimensions.viewHeight * (0.5 + Math.random() * 0.5)
            : -dimensions.viewHeight * (0.5 + Math.random() * 0.5);
    } else if (direction === 'up') {
        distance = -Math.abs(distance);
    }

    // Perform smooth scrolling with acceleration
    let currentSpeed = config.speed.min;
    let scrolled = 0;
    const targetDistance = Math.abs(distance);
    const scrollDirection = distance > 0 ? 1 : -1;

    while (Math.abs(scrolled) < targetDistance) {
        // Acceleration phase (first 30%)
        if (Math.abs(scrolled) < targetDistance * 0.3) {
            currentSpeed = Math.min(currentSpeed * config.acceleration, config.speed.max);
        }
        // Deceleration phase (last 30%)
        else if (Math.abs(scrolled) > targetDistance * 0.7) {
            currentSpeed = Math.max(currentSpeed * config.deceleration, config.speed.min);
        }

        const step = Math.min(currentSpeed / 10, targetDistance - Math.abs(scrolled));

        await page.evaluate((scrollStep) => {
            window.scrollBy(0, scrollStep);
        }, step * scrollDirection);

        scrolled += step;
        await randomSleep(10, 30);

        // Sometimes pause during scrolling (reading)
        if (Math.random() > 0.95) {
            await randomSleep(200, 800);
        }
    }
}

// Random mouse movement on page
async function randomMouseMovement(cursor, count = 1) {
    try {
        // Make sure page is ready
        if (!cursor || !cursor.page) {
            console.log('Cursor or page not ready, skipping random movement');
            return;
        }

        // Wait a bit for page to stabilize
        await randomSleep(100, 300);

        for (let i = 0; i < count; i++) {
            try {
                // Use safer method to get random point
                const viewport = await cursor.page.viewport();
                if (viewport) {
                    const x = Math.floor(Math.random() * viewport.width * 0.8) + viewport.width * 0.1;
                    const y = Math.floor(Math.random() * viewport.height * 0.8) + viewport.height * 0.1;
                    await cursor.move({ x, y });
                } else {
                    // Fallback if viewport not available
                    const point = await ghostCursor.getRandomPagePoint(cursor.page);
                    await cursor.move(point);
                }
                await randomSleep(500, 1500);
            } catch (moveError) {
                console.log('Error in mouse movement, continuing...', moveError.message);
            }
        }
    } catch (error) {
        console.log('Random mouse movement error:', error.message);
    }
}

// Helper functions
function randomSleep(min, max) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function getRandomChar() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return chars[Math.floor(Math.random() * chars.length)];
}

// Export all functions
module.exports = {
    behaviorProfiles,
    initializeCursor,
    humanClick,
    humanType,
    humanScroll,
    randomMouseMovement,
    randomSleep
};