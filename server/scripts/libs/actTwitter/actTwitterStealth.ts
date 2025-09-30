import { Page } from "puppeteer";
import * as twt from "./twitter";
import * as browser from "../browser";
import * as act from "../act";

export async function loginTwitterStealth(page: Page, config: any): Promise<boolean> {
    try {
        // Random delay before starting
        await browser.randomSleep(2000, 5000);

        // Move mouse randomly to simulate human behavior
        await browser.moveMouseRandomly(page);

        await page.goto("https://x.com", {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Check if already logged in
        if (await twt.isLoggedIn(page)) {
            console.log("Already logged in");
            return true;
        }

        const twitterAccount = config.profile.customField?.twitter_account;
        const cookies = twitterAccount?.cookies;

        // Try login with cookies first
        if (cookies) {
            await page.deleteCookie();
            await page.setCookie(...cookies);

            await browser.randomSleep(1000, 2000);
            await page.goto("https://x.com");

            if (await twt.isLoggedIn(page)) {
                console.log("Logged in with cookies");
                return true;
            }
        }

        // Login with username/password
        await page.goto("https://x.com/i/flow/login");
        await browser.randomSleep(2000, 3000);

        // Type username with human-like delays
        const usernameInput = await page.waitForSelector("input[autocomplete='username']");
        if (usernameInput) {
            await browser.moveMouseRandomly(page);
            await usernameInput.click();
            await browser.randomSleep(500, 1000);

            // Type character by character with random delays
            const username = twitterAccount?.username || "";
            for (const char of username) {
                await page.keyboard.type(char);
                await browser.randomSleep(50, 150);
            }
        }

        await browser.randomSleep(500, 1000);
        await page.click("xpath///span[text()='Next']");

        // Handle email verification if needed
        const emailNeeded = await page.waitForSelector("xpath///[contains(text(), 'Email')]", { timeout: 5000 }).catch(() => null);
        if (emailNeeded) {
            await browser.randomSleep(1000, 2000);
            const email = twitterAccount?.email || "";
            for (const char of email) {
                await page.keyboard.type(char);
                await browser.randomSleep(50, 150);
            }
            await page.click("xpath///span[text()='Next']");
        }

        // Type password
        await browser.randomSleep(2000, 3000);
        const passwordInput = await page.waitForSelector("input[autocomplete='current-password']");
        if (passwordInput) {
            await passwordInput.click();
            await browser.randomSleep(500, 1000);

            const password = twitterAccount?.password || "";
            for (const char of password) {
                await page.keyboard.type(char);
                await browser.randomSleep(50, 150);
            }
        }

        await browser.randomSleep(500, 1000);
        await page.click("xpath///span[text()='Log in']");

        // Handle 2FA if needed
        await browser.randomSleep(3000, 5000);

        // Check login success
        if (await twt.isLoggedIn(page)) {
            console.log("Login successful");
            return true;
        }

        throw new Error("Login failed");

    } catch (error) {
        console.error("Error during stealth login:", error);
        throw error;
    }
}

export async function interactWithTweetStealth(page: Page, action: 'like' | 'repost' | 'reply'): Promise<void> {
    // Scroll to tweet naturally
    await browser.humanLikeScroll(page);
    await browser.randomSleep(1000, 2000);

    // Move mouse around before interaction
    await browser.moveMouseRandomly(page);
    await browser.randomSleep(500, 1000);

    switch(action) {
        case 'like':
            await page.click("button[data-testid='like']");
            break;
        case 'repost':
            await page.click("button[data-testid='retweet']");
            await browser.randomSleep(500, 1000);
            await page.click("xpath///span[text()='Repost']");
            break;
        case 'reply':
            await page.click("button[data-testid='reply']");
            // Additional reply logic here
            break;
    }

    await browser.randomSleep(1000, 2000);
}

export async function browseFeedNaturally(page: Page, duration: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
        // Scroll down slowly
        await browser.humanLikeScroll(page);

        // Sometimes pause to "read"
        if (Math.random() > 0.7) {
            await browser.randomSleep(3000, 8000);
        }

        // Sometimes move mouse
        if (Math.random() > 0.5) {
            await browser.moveMouseRandomly(page);
        }

        // Sometimes click on a tweet to view
        if (Math.random() > 0.8) {
            const tweets = await page.$$("article[data-testid='tweet']");
            if (tweets.length > 0) {
                const randomTweet = tweets[Math.floor(Math.random() * Math.min(tweets.length, 5))];
                await randomTweet.click();
                await browser.randomSleep(2000, 5000);
                await page.goBack();
            }
        }

        await browser.randomSleep(2000, 4000);
    }
}