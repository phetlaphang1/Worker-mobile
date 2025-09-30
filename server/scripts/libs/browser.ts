import puppeteer, { Browser, Page } from "puppeteer";
// Comment out problematic imports for now
// import { FingerprintInjector, newInjectedPage } from "../../antidetect/fingerprint-injector copy/dist/index";
// import { FingerprintGenerator } from "../../antidetect/fingerprint-generator copy/dist/index";
// import * as useProxy from "@lem0-packages/puppeteer-page-proxy";

export interface BrowserConfig {
    headless?: boolean;
    proxy?: string;
    fingerprint?: {
        browsers?: string[];
        devices?: string[];
        operatingSystems?: string[];
        locales?: string[];
    };
}

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
            '--window-size=1280,720',
            '--start-maximized',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null,
    });

    return browser;
}

export async function createStealthPage(browser: Browser, config: BrowserConfig = {}): Promise<Page> {
    // Create page without fingerprint generator for now
    const page = await browser.newPage();

    // Additional stealth settings
    await page.evaluateOnNewDocument(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Override navigator.plugins to look more realistic
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                originalQuery(parameters)
        );

        // Add chrome runtime
        (window as any).chrome = {
            runtime: {},
        };

        // Mouse movement simulation
        let mouseX = 100;
        let mouseY = 100;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
    });

    // Set proxy if provided (commented out for now)
    // if (config.proxy) {
    //     await useProxy(page, config.proxy);
    // }

    // Random delays between actions
    const originalClick = page.click.bind(page);
    page.click = async (selector: string, options?: any) => {
        await page.waitForSelector('body'); // Ensure page is ready
        await randomSleep(100, 600); // Use our random sleep function
        return originalClick(selector, options);
    };

    const originalType = page.type.bind(page);
    page.type = async (selector: string, text: string, options?: any) => {
        const delay = Math.random() * 100 + 50; // Random typing speed 50-150ms
        return originalType(selector, text, { ...options, delay });
    };

    return page;
}

export async function randomSleep(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

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

        // Sometimes scroll up a bit (human-like)
        if (Math.random() > 0.8) {
            currentPosition -= Math.floor(Math.random() * 50);
            await page.evaluate((y) => {
                window.scrollTo({
                    top: y,
                    behavior: 'smooth'
                });
            }, currentPosition);
            await randomSleep(300, 800);
        }
    }
}

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