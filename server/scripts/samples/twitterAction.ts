import { Page } from "puppeteer";
import * as twtAction from "../libs/actTwitter/twitterAction";

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
    console.log("Hello....");
    await twtAction.execute(page, config);
})();