import { Page } from "puppeteer";
import * as gen from "../gen";
import * as act from "../act";
import * as twt from "./twitter";

const default_post_url = "https://x.com/uJMBP4jQ3YvGwN/status/1968865501913776480";
const default_type = "VIEW";

let req: any = {
    URL: "",
    Type: ""
};

let res: any = {
    post_author: ""
};

export async function execute(page: Page, config: any): Promise<any> {
    // Before
    setupRes(config);
    await twt.loginTwitter(page, config);

    // Body
    await twt.gotoPostFromURL(page, req.URL);    
    switch (req.Type) {
        case "VIEW":
            await twt.viewTweet(page);
            break;
        case "LIKE":
            await twt.likeTweet(page);
            break;
        case "REPOST":
            await twt.repostTweet(page);
            break;
        default:
            console.log("Invalid type: " + req.Type);
            break;
    }

    await act.pause(3000);
    return res;
}

function setupRes(config: any): void {
    if(config.type == "task"){
        req = gen.getRequestFromConfig(config);
    }else{
        req.URL = default_post_url;
        req.Type = default_type;
    }

    const info = twt.getInfoFromPostURL(req.URL);
    res.post_author = info ? info.username : "";
}

