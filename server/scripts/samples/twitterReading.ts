import { Page } from "puppeteer";
import * as twitterReading from "../libs/actTwitter/twitterReading";

interface TaskConfig {
    profile: any;
    taskPath: string;
    taskId: string;
    type: string;  // Changed from optional to required
    task: {
        request: any;
    };
}

// The page and config parameters are available in the script context
declare const page: Page;
declare const config: TaskConfig;

(async () => {
    const result = await twitterReading.execute(page, config);
    return result;
})();