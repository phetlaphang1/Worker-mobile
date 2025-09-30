import * as fs from "fs";
import * as speakeasy from "speakeasy";
import { Page } from "puppeteer";
import * as act from "../act";   
import * as gen from "../gen";
import * as rai from "../rai";

const xpathTweet = "//article[@data-testid='tweet']";
export interface PostInfo {
    username: string;
    postId: string;
}

export interface Post {
    link: string;
}

export function getUserNameFromProfile(profile: any){
    const customField = gen.getCustomFieldFromProfile(profile);
    const twitterUsername = customField?.twitter_account?.username;
    return twitterUsername;
}

export async function loginTwitter(page: Page, config: any): Promise<boolean> {
    try {
        await page.goto("https://x.com");
    } catch (error) {
        throw new Error("Failed to load home page of twitter");
    }


    if (await isLoggedIn(page)) {
        return true;
    }

    const customField = gen.getCustomFieldFromProfile(config.profile);

    const twitterUsername = customField?.twitter_account?.username;
    const twitterPassword = customField?.twitter_account?.password;
    const twitterEmail = customField?.twitter_account?.email;
    const twitter2FA = customField?.twitter_account?.["2fa"];
    const cookies = customField?.twitter_account?.cookies;

    if (cookies) {
        await page.deleteCookie();
        await page.setCookie(...cookies);
        await page.goto("https://x.com");

        if (await isLoggedIn(page)) {
            return true;
        }
    }

    if (!(await isLoggedIn(page))) {
        await page.goto("https://x.com/i/flow/login");
        await act.type(
            page,
            "//input[@autocomplete='username']",
            twitterUsername || "",
        );

        await act.click(page, "//span[text()='Next']");
        const xpathEmail = "//*[contains(text(), 'Email')]";
        const xpathPassword = "//*[contains(text(), 'Password')]";
        if ( await act.waitForTrueElement(page, 20, xpathEmail, xpathPassword)) {
            await act.type(page, "//input[@autocomplete='on']", twitterEmail || "");
            await act.pause(3000);
            await act.click(page, "//span[text()='Next']");
        }
        console.log("Checking 01 .....");
        await act.pause(3000);
        await page.focus("input[autocomplete='current-password']");
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Delete'); // Or 'Backspace'
        await act.type(
            page,
            "//input[@autocomplete='current-password']",
            twitterPassword || "",
        );

        console.log("Checking 02 .....");
        await act.click(page, "//span[text()='Log in']");

        await act.pause(3000);

        for (let index = 0; index < 20; index++) {
            if (await act.checkElement(page, "//span[text()='Home']")) {
                break;
            }
            if (await act.checkElement(page, "//input[@autocomplete='on']")) {
                const token = speakeasy.totp({
                    secret: twitter2FA || "",
                    encoding: "base32",
                });
                await act.type(page, "//input[@autocomplete='on']", token);
                await act.click(page, "//span[text()='Next']");
                break;
            }
        }
    }

    if (await isLoggedIn(page)) {
        return true;
    } else {
        throw new Error("Failed to login twitter account");
    }

    // if (cookie) {
    //     await control.saveCookie(page, "./data_input/cookieson");
    // }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
    return await act.waitForTrueElement(
        page,
        20,
        "//a[@href='/home' and @aria-label='X']",
        "//span[text()='Sign in']",
    );
}

export async function gotoPostFromURL(page: Page, postURL: string): Promise<boolean> {
    if(!(await searchPostFromURL(page, postURL))){
        await page.goto(postURL);
    }    
    return await checkDisplayedPost(page);
}

export async function searchPostFromURL(page: Page, postURL: string): Promise<boolean> {
    try {        
        const info = getInfoFromPostURL(postURL);
        if(!info) {return false;}
        const xpathUser = `//span[text()='@${info.username}']`;
        
        await act.click(page, "//a[@href='/explore']");
        await act.pause(2000);
        await act.type(page, "//input[@placeholder='Search']", info.username);
        await act.pause(2000);        
        
        if(!await act.checkElement(page, xpathUser)){return false;}
        await act.click(page, xpathUser);
        await act.pause(2000);    

        if(await searchPostFromURLInPage(page, info)){return true;}
        await act.click(page, "//span[text()='Replies']");
        await act.pause(2000);
        return await searchPostFromURLInPage(page, info);        
    } catch (error) {
        return false;
    }    
}

async function searchPostFromURLInPage(page: Page, info: PostInfo): Promise<boolean> {
    const NO_SCROLL = 2;
    for (let index = 0; index < NO_SCROLL; index++) {
        const xpathPost = `//a[contains(@href,'${info.username}/status/${info.postId}')]`;
        if(await act.checkElement(page, xpathPost)){
            await act.click(page, xpathPost);
            await act.pause(2000);
            return true;
        }else{
            await act.scrollToEndOfPage(page);
            await act.pause(2000);
        }
    }
    return false;    
}

export async function checkDisplayedPost(page: Page): Promise<boolean> {    
    await act.pause(3000);
    if(await act.checkElement(page, "//span[text()='Something went wrong. Try reloading.']")){
        await page.reload();
        await act.pause(3000);
        if(await act.checkElement(page, "//span[text()='Something went wrong. Try reloading.']")){
            throw new Error("Failed to load page");
        }
    }     
    const xpathPostNotExist = "//span[text()='Hmm...this page doesn’t exist. Try searching for something else.']";
    if(await act.checkElement(page, xpathPostNotExist)){
        throw new Error("Post does not exist");
    }    
    return false;
}

export async function getAllPostsInPage(page: Page): Promise<Post[]> {
    return await page.evaluate(() => {
        const playlists: Post[] = []; // Store objects with name and link

        const playlistElements = document.querySelectorAll("article");

        playlistElements.forEach((el) => {
            const anchor01 = el.querySelector("a:has(time)") as HTMLAnchorElement;
            if (anchor01 && anchor01.href) {
                playlists.push({
                    // name: anchor01.innerText.trim(),
                    link: anchor01.href,
                });
            }
        });

        const uniquePlaylists = Array.from(
            new Map(playlists.map((p) => [p.link, p])).values(),
        );
        return uniquePlaylists;
    });
}

export async function getPostURLByIndex(page: Page, index: number): Promise<void> {
    const xpathHref = "//a[contains(@href,'/status/') and time]";
    const tweetURL = await act.getAttribute(
        page,
        xpathTweet + xpathHref,
        "href",
        index,
    );
    console.log(tweetURL);
}

export function getHrefFromPostURL(url: string): string {
    let href = url.replace("https://x.com", "");
    href = href.replace("https://twitter.com", "");
    return href;
}

export function getInfoFromPostURL(url: string): PostInfo | null {
    try {
        // Regular expression to match the pattern /username/status/postId
        // Group 1 captures the username, Group 2 captures the status ID.
        const regex = /\/([a-zA-Z0-9_]+)\/status\/(\d+)/;
        const match = url.match(regex);

        if (match && match.length === 3) {
            const username = match[1];
            const postId = match[2];
            return { username, postId };
        } else {
            console.warn("URL format not recognized for extraction:", url);
            return null;
        }
    } catch (error) {
        console.error("Error parsing URL:", error);
        return null;
    }
}

export async function getNewPostID(page: Page): Promise<string> {
    const response = await page.waitForResponse(response => response.url().includes("CreateTweet"));
    const responseBody = await response.json();
    try{
        const postId = responseBody.data.create_tweet.tweet_results.result.rest_id;
        console.log("Post ID: ", postId);
        return postId;
    }catch(error){
        const message = responseBody.errors.message;
        throw new Error(message);
    }
}

export async function viewTweet(page: Page): Promise<boolean> {
    const seconds = 3;
    console.log(`View tweet in ${seconds} seconds`);
    await act.pause( seconds * 1000);
    return true;
}

export async function likeTweet(page: Page): Promise<any> {
    let status = false, details;
    try {
        const xpathLikeTweet = "//div[div[@data-testid='inline_reply_offscreen']]//button[@data-testid='like']";
        const xpathUnLikeTweet = "//div[div[@data-testid='inline_reply_offscreen']]//button[@data-testid='unlike']";
        
        await act.click(page, xpathLikeTweet);        
        await act.pause(3000);
        
        if(await act.checkElement(page, xpathUnLikeTweet)){
            status = true;
            details = "Tweet liked successfully";
        }else{
            details = "Failed to like tweet.";
        }
    } catch (error) {  
        details = `Failed to like tweet:${(error as Error) .message}`;  
    }
    return { status, details };
}

export async function repostTweet(page: Page): Promise<any> {
    let status = false, details;
    try {
        const xpathRetweetTweet = "//div[div[@data-testid='inline_reply_offscreen']]//button[@data-testid='retweet']";
        const xpathUnRetweetTweet = "//div[div[@data-testid='inline_reply_offscreen']]//button[@data-testid='unretweet']";
        const xpathRepostTweet = "//span[text()='Repost']";

        await act.click(page, xpathRetweetTweet);
        await act.pause(1000);
        await act.click(page, xpathRepostTweet);
        await act.pause(3000);

        if(await act.checkElement(page, xpathUnRetweetTweet)){
            status = true;
            details = "Tweet reposted successfully";
        }else{
            details = "Failed to repost tweet.";
        }
    } catch (error) {        
        details = `Failed to repost tweet: ${(error as Error) .message}`;
    }
    return { status, details };
}

export async function quoteTweet(page: Page): Promise<any> {
    let status = false, details, newPostId;
    try {
        const xpathTweetText = "//div[div[@data-testid='inline_reply_offscreen']]//div[@data-testid='tweetText']";
        const xpathRetweetTweet = "//div[div[@data-testid='inline_reply_offscreen']]//button[@data-testid='retweet']";
        const xpathQuoteTweet = "//span[text()='Quote']";
        const xpathAddComment = "//div[div[text()='Add a comment']]";
        const xpathPostComment = "//button[@data-testid='tweetButton']/div/span/span[text()='Post']";

        const tweetText = await act.getAttribute(page, xpathTweetText,"innerText");
        const reply = await rai.getCommentByAI(tweetText);

        if(reply?.result?.status == "SUCCESS") {
            await act.click(page, xpathRetweetTweet);
            await act.pause(1000);
            await act.click(page, xpathQuoteTweet);
            await act.pause(1000);
            await act.type(page, xpathAddComment, reply.result.comment);
            await act.pause(1000);
            await act.click(page, xpathPostComment);
            newPostId = await getNewPostID(page);
            details = reply.result.comment;                
        }else{
            details = reply?.result?.reasoning;
        }

    } catch (error) {        
        details = `Failed to quote tweet: ${(error as Error) .message}`;
        throw error;
    }

    if(newPostId){
        status = true;
    }
    return { status, details, newPostId};
}

export async function replyTweet(page: Page): Promise<any> {
    let status = false, details, newPostId;
    try {
        const xpathTweetText = "//div[div[@data-testid='inline_reply_offscreen']]//div[@data-testid='tweetText']";
        const xpathReplyTweet = "//button[@data-testId='reply']";
        const xpathAddReply = "//div[@data-testid='tweetTextarea_0']";
        const xpathPostReply = "//button/div/span/span[text()='Reply']";
                
        const tweetText = await act.getAttribute(page, xpathTweetText,"innerText");
        const reply = await rai.getCommentByAI(tweetText);
        
        if(reply?.result?.status == "SUCCESS") {
            await act.click(page, xpathReplyTweet);
            await act.pause(1000);
            await act.type(page, xpathAddReply, reply.result.comment);
            await act.pause(1000);
            await act.click(page, xpathPostReply);
            newPostId = await getNewPostID(page);
            details = reply.result.comment;
        }else{
            details = reply?.result?.reasoning;
        }       

    } catch (error) {        
        details = `Failed to reply to tweet: ${(error as Error) .message}`;        
    }

    if(newPostId){
        status = true;
    }
    return { status, details, newPostId};
}