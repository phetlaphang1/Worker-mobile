// Twitter Action with Stealth Protection
// Uses only supported imports that Worker can handle

import { Page } from "puppeteer";
import * as twtAction from "../libs/actTwitter/twitterAction";
import * as act from "../libs/act";

// Stealth helper functions inline (no external imports)
async function randomSleep(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await act.pause(delay);
}

async function moveMouseRandomly(page: Page): Promise<void> {
    const viewport = page.viewport();
    if (!viewport) return;

    const x = Math.floor(Math.random() * viewport.width);
    const y = Math.floor(Math.random() * viewport.height);

    await page.mouse.move(x, y, { steps: 10 });
}

async function humanLikeScroll(page: Page): Promise<void> {
    await page.evaluate(() => {
        return new Promise<void>((resolve) => {
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

async function applyStealthToPage(page: Page): Promise<void> {
    // Apply stealth JavaScript to the page
    await page.evaluateOnNewDocument(() => {
        // Pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Pass plugins check
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Pass chrome check
        (window as any).chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // Pass permissions check
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                originalQuery(parameters)
        );

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Spoof vendor
        Object.defineProperty(navigator, 'vendor', {
            get: () => 'Google Inc.',
        });

        // Hide automation indicators
        ['__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
         '__webdriver_script_func', '__webdriver_script_fn', '__webdriver_unwrapped'].forEach(prop => {
            delete (window as any)[prop];
        });
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
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    // Add extra headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    console.log('Stealth measures applied to page');
}

interface TaskConfig {
    profile: any;
    taskPath: string;
    taskId: string;
    type?: string;
    task: {
        request: any;
    };
}

// The page and config parameters are available in the script context
declare const page: Page;
declare const config: TaskConfig;

(async () => {
    console.log("Twitter Action with Stealth Protection Starting...");

    try {
        // Apply all stealth measures to the page
        await applyStealthToPage(page);

        // Add random initial delay
        await randomSleep(2000, 5000);

        // Move mouse randomly before starting
        await moveMouseRandomly(page);

        console.log("Executing Twitter action...");

        // Execute the original Twitter action
        const result = await twtAction.execute(page, config);

        // Add natural behavior after action
        console.log("Adding natural post-action behavior...");
        await randomSleep(3000, 5000);
        await humanLikeScroll(page);
        await moveMouseRandomly(page);
        await randomSleep(2000, 4000);

        console.log("Twitter Action completed with stealth protection");
        console.log("Result:", result);

    } catch (error) {
        console.error("Error in stealth Twitter action:", error);
        throw error;
    }
})();