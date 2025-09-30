import { Page } from "puppeteer";
import * as twtAction from "../libs/actTwitter/twitterAction";

// Import stealth helpers
const stealth = require("../libs/stealthHelpers.js");

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
    console.log("Applying stealth measures to Twitter Action...");

    try {
        // Apply all stealth measures to the page
        await stealth.applyStealthToPage(page);

        // Add random initial delay
        await stealth.randomSleep(2000, 5000);

        // Move mouse randomly before starting
        await stealth.moveMouseRandomly(page);

        console.log("Starting Twitter Action with stealth enabled...");

        // Execute the original Twitter action
        await twtAction.execute(page, config);

        // Add natural behavior after action
        await stealth.randomSleep(3000, 5000);
        await stealth.humanLikeScroll(page);
        await stealth.moveMouseRandomly(page);

        console.log("Twitter Action completed with stealth protection");

    } catch (error) {
        console.error("Error in stealth Twitter action:", error);
        throw error;
    }
})();