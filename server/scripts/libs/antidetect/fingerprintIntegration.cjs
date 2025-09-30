// Fingerprint-Injector Integration Module
// Provides advanced anti-detection capabilities from fingerprint-injector package

const path = require('path');

// Core fingerprint injection functions
async function injectFingerprint(page, options = {}) {
    const {
        webdriver = true,
        chrome = true,
        permissions = true,
        plugins = true,
        webgl = true,
        battery = true,
        audioContext = true
    } = options;

    // Inject fingerprint overrides before page loads
    await page.evaluateOnNewDocument((opts) => {
        // Webdriver detection bypass
        if (opts.webdriver) {
            // Complete webdriver removal
            try {
                delete Object.getPrototypeOf(navigator).webdriver;
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                    configurable: true,
                    enumerable: false
                });
            } catch (e) {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            }

            // Remove CDC properties (Chrome Driver Control)
            delete window.cdc_adoQpoasnfa76pfcZLmcfl;
            delete document.$cdc_asdjflasutopfhvcZLmcfl_;
        }

        // Chrome runtime object
        if (opts.chrome) {
            const isChrome = /Chrome/.test(navigator.userAgent);
            if (isChrome && !window.chrome) {
                window.chrome = createChromeObject();
            }
        }

        // Permissions API
        if (opts.permissions) {
            overridePermissions();
        }

        // Plugins
        if (opts.plugins) {
            overridePlugins();
        }

        // WebGL vendor/renderer
        if (opts.webgl) {
            overrideWebGL();
        }

        // Battery API
        if (opts.battery) {
            overrideBattery();
        }

        // AudioContext
        if (opts.audioContext) {
            overrideAudioContext();
        }

        // Helper functions
        function createChromeObject() {
            return {
                runtime: {
                    id: undefined,
                    connect: () => {},
                    sendMessage: () => {},
                    onMessage: { addListener: () => {} }
                },
                loadTimes: function() {
                    const now = Date.now() / 1000;
                    return {
                        commitLoadTime: now - Math.random() * 2,
                        connectionInfo: 'http/1.1',
                        finishDocumentLoadTime: now - Math.random(),
                        finishLoadTime: now - Math.random() * 0.5,
                        firstPaintAfterLoadTime: 0,
                        firstPaintTime: now - Math.random() * 1.5,
                        navigationType: 'Other',
                        npnNegotiatedProtocol: 'unknown',
                        requestTime: now - Math.random() * 3,
                        startLoadTime: now - Math.random() * 2.5,
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
            };
        }

        function overridePermissions() {
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => {
                if (parameters.name === 'notifications') {
                    return Promise.resolve({ state: Notification.permission });
                }
                if (parameters.name === 'geolocation') {
                    return Promise.resolve({ state: 'prompt' });
                }
                return originalQuery(parameters);
            };
        }

        function overridePlugins() {
            const pluginData = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable' }
            ];

            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = pluginData.map(p => ({
                        name: p.name,
                        filename: p.filename,
                        description: p.description,
                        version: '1.0.0',
                        length: 1,
                        item: () => null,
                        namedItem: () => null
                    }));
                    plugins.length = pluginData.length;
                    return plugins;
                }
            });
        }

        function overrideWebGL() {
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                if (parameter === 7936) return 'WebKit WebGL';
                if (parameter === 7937) return 'WebKit';
                if (parameter === 37447) return 'Google Inc. (Intel Inc.)';
                return getParameter.apply(this, [parameter]);
            };

            const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
            WebGL2RenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                if (parameter === 7936) return 'WebKit WebGL';
                if (parameter === 7937) return 'WebKit';
                if (parameter === 37447) return 'Google Inc. (Intel Inc.)';
                return getParameter2.apply(this, [parameter]);
            };
        }

        function overrideBattery() {
            if (navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 0.99,
                    onchargingchange: null,
                    onchargingtimechange: null,
                    ondischargingtimechange: null,
                    onlevelchange: null
                });
            }
        }

        function overrideAudioContext() {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const OriginalAudioContext = AudioContext;
                Object.defineProperty(window, 'AudioContext', {
                    get: () => {
                        return function(...args) {
                            const ctx = new OriginalAudioContext(...args);
                            const originalCreateOscillator = ctx.createOscillator;
                            ctx.createOscillator = function() {
                                const oscillator = originalCreateOscillator.call(this);
                                const originalConnect = oscillator.connect;
                                oscillator.connect = function(destination) {
                                    // Add slight noise to audio fingerprinting
                                    const gainNode = ctx.createGain();
                                    gainNode.gain.value = 0.99999 + Math.random() * 0.00001;
                                    originalConnect.call(this, gainNode);
                                    gainNode.connect(destination);
                                    return oscillator;
                                };
                                return oscillator;
                            };
                            return ctx;
                        };
                    }
                });
            }
        }

        function overrideCanvasFingerprint() {
            // Override toDataURL to add noise
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

            const canvasNoise = () => (Math.random() - 0.5) * 0.0001; // Very small noise

            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                const context = this.getContext('2d');
                if (context && this.width > 0 && this.height > 0) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    // Add noise to random pixels
                    for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 100 + 50)) {
                        imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + canvasNoise()));
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, args);
            };

            HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
                const context = this.getContext('2d');
                if (context && this.width > 0 && this.height > 0) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 100 + 50)) {
                        imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + canvasNoise()));
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToBlob.call(this, callback, ...args);
            };

            CanvasRenderingContext2D.prototype.getImageData = function(...args) {
                const imageData = originalGetImageData.apply(this, args);
                // Add subtle noise to prevent exact fingerprinting
                for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 200 + 100)) {
                    imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + canvasNoise()));
                }
                return imageData;
            };
        }

        // Apply Canvas fingerprint protection
        overrideCanvasFingerprint();
    }, options);

    // Additional runtime fixes
    await applyRuntimeFixes(page);
}

// Apply runtime fixes for headless detection
async function applyRuntimeFixes(page) {
    // Fix iframe contentWindow chrome property
    await page.evaluateOnNewDocument(() => {
        try {
            const contentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
            if (contentWindowDesc && contentWindowDesc.get) {
                const originalGet = contentWindowDesc.get;
                contentWindowDesc.get = function() {
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
                };
                Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', contentWindowDesc);
            }
        } catch (e) {}
    });

    // Remove automation-related properties from all contexts
    await page.evaluateOnNewDocument(() => {
        const automationProps = [
            '__webdriver_script_fn',
            '__driver_evaluate',
            '__webdriver_evaluate',
            '__selenium_evaluate',
            '__fxdriver_evaluate',
            '__driver_unwrapped',
            '__webdriver_unwrapped',
            '__selenium_unwrapped',
            '__fxdriver_unwrapped',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'calledSelenium',
            '$chrome_asyncScriptInfo',
            '$cdc_asdjflasutopfhvcZLmcfl_'
        ];

        const removeProps = (obj) => {
            automationProps.forEach(prop => {
                try {
                    delete obj[prop];
                } catch (e) {}
            });
        };

        removeProps(window);
        removeProps(document);

        // Monitor for new properties
        const observer = new MutationObserver(() => {
            removeProps(window);
            removeProps(document);
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });
    });
}

// Browser profile configuration
function generateBrowserProfile() {
    const profiles = [
        {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            platform: 'Win32',
            vendor: 'Google Inc.'
        },
        {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1440, height: 900 },
            platform: 'MacIntel',
            vendor: 'Google Inc.'
        },
        {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            platform: 'Linux x86_64',
            vendor: 'Google Inc.'
        }
    ];

    return profiles[Math.floor(Math.random() * profiles.length)];
}

// Apply full stealth configuration
async function applyFullStealth(page) {
    const profile = generateBrowserProfile();

    // Set user agent
    await page.setUserAgent(profile.userAgent);

    // Set viewport with slight randomization
    await page.setViewport({
        width: profile.viewport.width + Math.floor(Math.random() * 50 - 25),
        height: profile.viewport.height + Math.floor(Math.random() * 50 - 25),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false
    });

    // Inject all fingerprint modifications
    await injectFingerprint(page, {
        webdriver: true,
        chrome: true,
        permissions: true,
        plugins: true,
        webgl: true,
        battery: true,
        audioContext: true
    });

    // Set platform-specific overrides
    await page.evaluateOnNewDocument((prof) => {
        Object.defineProperty(navigator, 'platform', {
            get: () => prof.platform
        });
        Object.defineProperty(navigator, 'vendor', {
            get: () => prof.vendor
        });
    }, profile);

    // Set extra headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': `"${profile.platform.includes('Win') ? 'Windows' : profile.platform.includes('Mac') ? 'macOS' : 'Linux'}"`
    });

    console.log('Full stealth configuration applied with fingerprint-injector integration');
}

module.exports = {
    injectFingerprint,
    applyRuntimeFixes,
    generateBrowserProfile,
    applyFullStealth
};