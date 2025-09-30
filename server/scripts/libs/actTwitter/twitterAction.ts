import * as path from "path";
import { Page } from "puppeteer";
import * as scriptConfig from "../config";
import * as gen from "../gen";
import * as act from "../act";
import * as twt from "./twitter";

let res:any = {};
export async function execute(page: Page, config: any): Promise<any> {
    // Before
    const req = gen.getRequestFromConfig(config);
    const username = twt.getUserNameFromProfile(config.profile);
    await twt.loginTwitter(page, config);

    // Body
    await twt.gotoPostFromURL(page, req.URL);
    await uploadImage(page, req.imageURL, config.taskPath);
    res.postURL =  await replyOrPostContent(page, req.content, req.URL, username) || undefined;
    await deleteImage(page, req.imageURL, config.taskPath);

    // After    
    if(res.postURL){
        res.postResultToN8N = await postResultToN8N(scriptConfig.N8N_ROXANE_URL_FOR_REPLY, req.comment_task_id, res.postURL);            
    }else{
        throw new Error("Can not reply or post");
    }
    return res;
}

async function uploadImage(page: Page, imageURL: string | undefined, taskPath: string): Promise<void> {
    if (imageURL) {
        const imagePath = path.join(taskPath, "attachedImage.jpeg");
        await gen.saveFileFromURL(imageURL, imagePath);
        // --- Select Image from Desktop ---
        console.log(`Attempting to upload image from: ${imagePath}`);
        // Upload file
        console.log("Uploading file...");
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.uploadFile(imagePath);
        }
        console.log("File uploaded successfully!");

        // Wait for the image to appear in the composer (optional, but good for stability)
        await page.waitForSelector('div[data-testid="attachments"]', {
            visible: true,
            timeout: 20000,
        });
        console.log("Image preview appeared in composer.");
    }
}

async function replyOrPostContent(page: Page, content: string, postURL: string, username: string | undefined): Promise<string | null> {
    const xpathPostedURL = `//span[text()='${content}']`;
    if(await act.checkElement(page, xpathPostedURL )){
        await act.click(page, xpathPostedURL);
        await act.pause(2000);
        const newPostURL = await page.url();
        console.log("New URL is already posted: ", newPostURL);
        return newPostURL;
    }
    if (postURL) {
        await act.type(page, "//div[@data-testid='tweetTextarea_0']", content);
        await page.keyboard.press('Enter');
        await act.pause(2000);
        await act.click(page, "//button/div/span/span[text()='Reply']");

    } else {
        await act.type(page, "//div[@data-testid='tweetTextarea_0']", content);
        await page.keyboard.press('Enter');
        await act.pause(2000);
        await act.click(page, "//button/div/span/span[text()='Post']");
    }

    try{
        const postId = await twt.getNewPostID(page);
        if(postId && username){
            const newPostURL = `https://twitter.com/${username}/status/${postId}`;
            return newPostURL;
        }
    }catch(error: any){
        const message = error.message;
        console.log("Post ID not found", message);
    }
    return null;
}

async function deleteImage(page: Page, imageURL: string | undefined, taskPath: string): Promise<void> {
    await gen.takeScreen(page, path.join(taskPath, "output", "result.png"));
    if(imageURL){
        await gen.deleteFile(path.join(taskPath, "attachedImage.jpeg"));
    }
}

interface N8NResult {
    success?: boolean | string;
    [key: string]: any;
}

async function postResultToN8N(N8N_ROXANE_URL: string, comment_task_id: string | undefined, newPostURL: string | null): Promise<N8NResult | null> {
    if(comment_task_id){
        if(newPostURL){
            try {
                const postData = {
                    comment_task_id: comment_task_id,
                    url: newPostURL,
                };

                return await gen.postToWebhook(N8N_ROXANE_URL, postData);
            } catch (error) {
                console.error("Error posting result:", error);
                return error as N8NResult;
            }
        }else{
            console.log("Post URL not found");
            return null;
        }
    }
    return null;
}

interface SocialAccount {
    type: string;
    account: string;
    userId: number;
    taskId: number;
    scriptId: number;
    actionType: string;
    postURL: string | null;
    status: string;
    result: string;
}

async function postToTaskCenter(userName: string | undefined, taskId: string, comment_task_id: string | undefined, newPostURL: string | null, n8nResult: N8NResult | null): Promise<void> {
    if (process.env.TASK_CENTER_URL && userName) {
        try {
            const apiKey = process.env.TASK_CENTER_API_KEY;
            const userId = process.env.TASK_CENTER_USER_ID;
            if (!apiKey) {
                return;
            }

            let resultDetails = {
                account: userName,
                taskId: taskId,
                comment_task_id: comment_task_id,
                newPostURL: newPostURL,
                postResultToN8N: n8nResult
            };
            const socialAccount: SocialAccount = {
                type: "TWITTER",
                account: userName,
                userId: parseInt(userId || "0"),
                taskId: parseInt(taskId),
                scriptId: 10,
                actionType: "REPLY",
                postURL: newPostURL,
                status: n8nResult?.success == 'true' ? 'PASS' : 'FAIL',
                result: JSON.stringify(resultDetails),
            };

            console.log("result", socialAccount.result);
            console.log("socialAccount", socialAccount);
            const updateUrl = `${process.env.TASK_CENTER_URL}/api/social-accounts`;
            console.log("Updating task to center.....", updateUrl);
            const updateResult = await fetch(updateUrl, {
                method: 'POST',
                headers: {
                    'api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(socialAccount),
            });
            if (!updateResult.ok) {
                throw new Error(`Failed to update social account in Task Center: ${updateResult.status}`);
            }
        } catch (error) {
            console.error(`Error happened when update social account in Task Center:`, error);
        }
    }
}