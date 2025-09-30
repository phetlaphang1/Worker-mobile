import * as fs from 'fs';
import { Page } from "puppeteer";
import * as gen from "../gen";
import * as act from "../act";
import * as twt from "./twitter";

const ACT_RATE = [10, 20, 60];

// const TIME_FOR_NEXT_ROUND = [60, 240];
const TIME_FOR_NEXT_ROUND = [10, 5];

let res: any = {
    profileId: "",
    username: "",
    actionType: "",
    postURL: "",
    newPostId: "",
    newPostURL: "",
    status: "FAILED",
    details: "",
};

export async function execute(page: Page, config: any): Promise<any> {
    // Before
    res.username = twt.getUserNameFromProfile(config.profile);
    await twt.loginTwitter(page, config);

    // Body
    await scrollDownAndUpRandomly(page);
    res.postURL = await selectTweetRandomly(page) || "";
    const actionTypeIndex = getActionRandomly(ACT_RATE);
    let result;
    switch (actionTypeIndex) {
        case 0:
            res.actionType = "like";
            result = await twt.likeTweet(page);
            break;
        case 1:
            res.actionType = "repost";
            result = await twt.repostTweet(page);
            break;
        case 2:
            res.actionType = "quote";
            result = await twt.quoteTweet(page);
            break;
        case 3:
            res.actionType = "reply";
            result = await twt.replyTweet(page);
            break;
        default:
            break;
    }
    await waitForNextRound(page, TIME_FOR_NEXT_ROUND);

    // After    
    res.timestamp = new Date().toISOString(),
    res.profileId = config.profileId;
    result.status ? res.status = "COMPLETED" : "";
    result.details ? res.details = result.details : "";
    result.newPostId ? res.newPostId = result.newPostId : "";
    result.newPostId ? res.newPostURL = `https://twitter.com/${res.username}/status/${res.newPostId}` : "";
    console.log("Result: ", res);
    await gen.updateResult(res, "twitterCaring.json");
    return res;
}

async function scrollDownAndUpRandomly(page: Page): Promise<void> {
    await act.pause(2000);
    await act.scrollToEndOfPage(page);
    const moreScrolls = Math.floor(5 * Math.random());
    console.log("Number of next scroll down and up as: " + moreScrolls);
    for (let index = 0; index < moreScrolls; index++) {
        const typeOfScroll = Math.random();
        if (typeOfScroll < 0.5) {
            await act.scrollToEndOfPage(page);
        } else {
            await act.scrollToHomeOfPage(page);
        }
        await act.pause(5000);
    }
}

async function selectTweetRandomly(page: Page): Promise<string | null> {
    await act.pause(3000);
    const xpathTweet = "//a[contains(@href,'/status/') and time]";
    const elements = await page.$$("xpath/" + xpathTweet);
    const tweetIndex = Math.floor(elements.length * Math.random());
    console.log("Selected " + (tweetIndex + 1) + " in total of " + elements.length + " tweets randomly");
    const tweetPost = elements[tweetIndex];
    if (!tweetPost) {
        res.details = "Cannot select tweet - no tweet found";
        return null;
    }
    const propertyHandle = await tweetPost.getProperty("href");
    const postURL = await propertyHandle.jsonValue() as string;
    await tweetPost.click();

    await act.pause(3000);
    if (postURL == (await page.url())){
        console.log(postURL);
        return postURL;
    }
    res.details = "Can not select tweet";
    return null;
}

function getActionRandomly(actRate: number[]): number {
    const randomNo = Math.floor(100 * Math.random());
    if (randomNo < actRate[0]) {
        console.log("Choose action as 'like' randomly");
        return 0; //like
    } else {
        if (randomNo < actRate[1]) {
            console.log("Choose action as 'repost' randomly");
            return 1; //repost
        } else {
            if (randomNo < actRate[2]) {
                console.log("Choose action as 'quote' randomly");
                return 2; //quote
            } else {
                console.log("Choose action as 'reply' randomly");
                return 3; //reply
            }
        }
    }
}

async function waitForNextRound(page: Page, timeForNextRound: number[]): Promise<void> {
    await act.pause(2000);
    await act.scrollToHomeOfPage(page);
    const waitingTime = timeForNextRound[0] + Math.floor(timeForNextRound[1] * Math.random());
    console.log("Waiting for next round in " + waitingTime + " seconds...");
    await act.pause(waitingTime * 1000);
}