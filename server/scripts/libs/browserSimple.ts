import puppeteer, { Browser, Page } from "puppeteer";

export interface BrowserConfig {
    headless?: boolean;
    proxy?: string;
    userAgent?: string;
}

// Simple random sleep helper
export async function randomSleep(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Create browser with stealth settings
export async function createStealthBrowser(config: BrowserConfig = {}): Promise<Browser> {
    const browser = await puppeteer.launch({
        headless: config.headless ?? false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--no-first-run',
            '--window-size=1366,768',
            '--start-maximized'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null,
    });

    return browser;
}

// Create page with anti-detection
export async function createStealthPage(browser: Browser, config: BrowserConfig = {}): Promise<Page> {
    const page = await browser.newPage();

    // Set random viewport
    await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 200),
        height: 768 + Math.floor(Math.random() * 200),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    });

    // Set user agent
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
    const selectedUserAgent = config.userAgent || userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(selectedUserAgent);

    // Set extra headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Apply stealth JavaScript
    await page.evaluateOnNewDocument(() => {
        // Override webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Add chrome object
        (window as any).chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                originalQuery(parameters)
        );

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Override vendor
        Object.defineProperty(navigator, 'vendor', {
            get: () => 'Google Inc.',
        });

        // Remove automation properties
        const propsToDelete = ['__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function'];
        propsToDelete.forEach(prop => delete (window as any)[prop]);
    });

    // Override page methods with delays
    const originalClick = page.click.bind(page);
    (page as any).clickWithDelay = async (selector: string, options?: any) => {
        await randomSleep(100, 600);
        return originalClick(selector, options);
    };

    const originalType = page.type.bind(page);
    (page as any).typeWithDelay = async (selector: string, text: string, options?: any) => {
        const delay = Math.random() * 100 + 50;
        return originalType(selector, text, { ...options, delay });
    };

    return page;
}

// Human-like scrolling
export async function humanLikeScroll(page: Page): Promise<void> {
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    let currentPosition = 0;
    const scrollStep = Math.floor(Math.random() * 100 + 50);

    while (currentPosition < scrollHeight - viewportHeight) {
        currentPosition += scrollStep;
        await page.evaluate((y) => {
            window.scrollTo({
                top: y,
                behavior: 'smooth'
            });
        }, currentPosition);

        await randomSleep(500, 1500);

        // Sometimes scroll up
        if (Math.random() > 0.8) {
            currentPosition -= Math.floor(Math.random() * 50);
            await page.evaluate((y) => {
                window.scrollTo({
                    top: y,
                    behavior: 'smooth'
                });
            }, Math.max(0, currentPosition));
            await randomSleep(300, 800);
        }
    }
}

// Move mouse randomly
export async function moveMouseRandomly(page: Page): Promise<void> {
    const viewport = page.viewport();
    if (!viewport) return;

    const startX = Math.floor(Math.random() * viewport.width);
    const startY = Math.floor(Math.random() * viewport.height);
    const endX = Math.floor(Math.random() * viewport.width);
    const endY = Math.floor(Math.random() * viewport.height);

    await page.mouse.move(startX, startY);
    await page.mouse.move(endX, endY, { steps: 10 });
}

// Type text character by character
export async function typeHumanLike(page: Page, selector: string, text: string): Promise<void> {
    const element = await page.waitForSelector(selector);
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