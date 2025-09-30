// Stealth Helper Functions - CommonJS format for compatibility
// No external dependencies, pure JavaScript implementation

function randomSleep(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

function humanLikeScroll(page) {
    return page.evaluate(() => {
        return new Promise((resolve) => {
            let totalHeight = 0;
            const distance = Math.floor(Math.random() * 100 + 50);
            const timer = setInterval(() => {
                const scrollHeight = document.documentElement.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function moveMouseRandomly(page) {
    const viewport = page.viewport();
    if (!viewport) return;

    const startX = Math.floor(Math.random() * viewport.width);
    const startY = Math.floor(Math.random() * viewport.height);
    const endX = Math.floor(Math.random() * viewport.width);
    const endY = Math.floor(Math.random() * viewport.height);

    await page.mouse.move(startX, startY);
    await page.mouse.move(endX, endY, { steps: 10 });
}

async function typeHumanLike(page, selector, text, isXpath = false) {
    let element;

    if (isXpath) {
        await page.waitForXPath(selector);
        [element] = await page.$x(selector);
    } else {
        element = await page.waitForSelector(selector);
    }

    if (element) {
        await element.click();
        await randomSleep(300, 700);

        for (const char of text) {
            await page.keyboard.type(char);
            await randomSleep(30, 120);

            // Sometimes pause mid-typing
            if (Math.random() > 0.95) {
                await randomSleep(500, 1500);
            }
        }
    }
}

async function applyStealthToPage(page) {
    // Apply stealth JavaScript to the page
    await page.evaluateOnNewDocument(() => {
        // Enhanced webdriver bypass from fingerprint-injector
        // Remove webdriver property completely and handle all access attempts
        try {
            // Delete the property first
            delete Object.getPrototypeOf(navigator).webdriver;

            // Then redefine it to return undefined/false
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true,
                enumerable: false
            });
        } catch (e) {
            // Fallback method
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        }

        // Enhanced plugins check with more realistic array
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const plugins = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                ];
                plugins.length = 3;
                return plugins;
            },
        });

        // Enhanced chrome object - more complete implementation from fingerprint-injector
        const isChrome = /Chrome/.test(navigator.userAgent);
        if (isChrome && !window.chrome) {
            Object.defineProperty(window, 'chrome', {
                writable: true,
                enumerable: true,
                configurable: false,
                value: {
                    runtime: {
                        // Complete runtime object that passes all checks
                        id: undefined,
                        connect: () => {},
                        sendMessage: () => {},
                        onMessage: {
                            addListener: () => {},
                            removeListener: () => {},
                            hasListener: () => false
                        },
                        onConnect: {
                            addListener: () => {},
                            removeListener: () => {},
                            hasListener: () => false
                        },
                        onInstalled: {
                            addListener: () => {},
                            removeListener: () => {},
                            hasListener: () => false
                        },
                        getManifest: () => undefined,
                        getURL: (path) => `chrome-extension://fake/${path}`,
                        lastError: null
                    },
                    loadTimes: function() {
                        return {
                            commitLoadTime: Date.now() / 1000,
                            connectionInfo: 'http/1.1',
                            finishDocumentLoadTime: Date.now() / 1000,
                            finishLoadTime: Date.now() / 1000,
                            firstPaintAfterLoadTime: 0,
                            firstPaintTime: Date.now() / 1000,
                            navigationType: 'Other',
                            npnNegotiatedProtocol: 'unknown',
                            requestTime: Date.now() / 1000,
                            startLoadTime: Date.now() / 1000,
                            wasAlternateProtocolAvailable: false,
                            wasFetchedViaSpdy: false,
                            wasNpnNegotiated: true
                        };
                    },
                    csi: function() {
                        return {
                            onloadT: Date.now(),
                            pageT: Date.now() - performance.now(),
                            startE: Date.now() - performance.now(),
                            tran: 15
                        };
                    },
                    app: {
                        isInstalled: false,
                        getDetails: () => null,
                        getIsInstalled: () => false,
                        runningState: () => 'running'
                    }
                }
            });
        }

        // Pass permissions check
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Canvas fingerprint randomization - add noise to prevent fingerprinting
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const context = this.getContext('2d');
            if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                // Add minimal noise to pixels
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = Math.min(255, imageData.data[i] + (Math.random() * 2 - 1));     // R
                    imageData.data[i+1] = Math.min(255, imageData.data[i+1] + (Math.random() * 2 - 1)); // G
                    imageData.data[i+2] = Math.min(255, imageData.data[i+2] + (Math.random() * 2 - 1)); // B
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args);
        };

        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
            const imageData = originalGetImageData.apply(this, args);
            // Add tiny random noise to prevent exact fingerprinting
            for (let i = 0; i < imageData.data.length; i += 100) { // Only modify some pixels for performance
                imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + (Math.random() * 2 - 1)));
            }
            return imageData;
        };

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Spoof vendor
        Object.defineProperty(navigator, 'vendor', {
            get: () => 'Google Inc.',
        });

        // Spoof renderer
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, [parameter]);
        };

        // Enhanced automation indicator removal
        const automationProperties = [
            'webdriver', '__driver_evaluate', '__webdriver_evaluate', '__selenium_evaluate',
            '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
            '__selenium_unwrapped', '__fxdriver_unwrapped', '__webdriver_script_function',
            '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_script_fn',
            '__selenium_script_fn', '__webdriver_domAutomation', '__webdriver_domAutomationController',
            '__lastWatirAlert', '__lastWatirConfirm', '__lastWatirPrompt', '__webdriver_script_fn',
            '__webdriver__chr', '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
            '$chrome_asyncScriptInfo', '$cdc_asdjflasutopfhvcZLmcfl_'
        ];

        automationProperties.forEach(prop => {
            try {
                delete window[prop];
                delete document[prop];
            } catch (e) {}
        });

        // Remove CDP detection
        if (window.chrome && window.chrome.runtime) {
            try {
                const originalRuntime = window.chrome.runtime;
                Object.defineProperty(window.chrome, 'runtime', {
                    get: function() {
                        // Return runtime but filter out CDP-specific properties
                        return new Proxy(originalRuntime, {
                            get: function(target, prop) {
                                if (prop === 'id' && !target.id) {
                                    return undefined;
                                }
                                return target[prop];
                            }
                        });
                    }
                });
            } catch (e) {}
        }
    });

    // Set realistic viewport
    await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 100),
        height: 768 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    });

    // Set realistic user agent
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    // Add extra headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Additional headless-specific fixes from fingerprint-injector
    await page.evaluateOnNewDocument(() => {
        // Fix for iframe contentWindow in headless mode
        try {
            const contentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
            if (contentWindowDesc) {
                const originalGet = contentWindowDesc.get;
                contentWindowDesc.get = function() {
                    try {
                        const win = originalGet.call(this);
                        if (win && !win.chrome && window.chrome) {
                            Object.defineProperty(win, 'chrome', {
                                writable: true,
                                enumerable: true,
                                configurable: false,
                                value: window.chrome
                            });
                        }
                        return win;
                    } catch (err) {
                        return originalGet.call(this);
                    }
                };
                Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', contentWindowDesc);
            }
        } catch (e) {}
    });

    console.log('Enhanced stealth measures with fingerprint-injector techniques applied');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        randomSleep,
        humanLikeScroll,
        moveMouseRandomly,
        typeHumanLike,
        applyStealthToPage
    };
}