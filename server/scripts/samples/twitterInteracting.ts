import { Page } from "puppeteer";
import * as twitterInteracting from "../libs/actTwitter/twitterInteracting";

interface TaskConfig {
    profileId: string;
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
    console.log("Hello....");
    await twitterInteracting.execute(page, config);
})();