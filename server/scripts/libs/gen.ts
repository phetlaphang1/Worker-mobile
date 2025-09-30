import { Page } from "puppeteer";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

interface WebhookResponse {
    success: boolean;
    error?: string;
    errorType?: string;
}

interface UpdateResultData {
    entries: Array<{
        timestamp: string;
        [key: string]: any;
    }>;
}

export function getRequestFromConfig(config: any): any {
    let jsonConfig: any = config;
    let request: any;
    try{
        jsonConfig = JSON.parse(config as string)
    }catch(e){
        // console.log(e);
    }

    request = jsonConfig.task.request;

    try{
        request = JSON.parse(request)
    }catch(e){
        // console.log(e);
    }

    return request;
}

export function getCustomFieldFromProfile(profile: any){
    let customField = profile.customField;
      try{
          customField = JSON.parse(customField as string)
      }catch(e){
          // console.log(e);
      }
    return customField;
  }

export async function takeScreen(page: Page, filePath: string): Promise<void> {
    await page.screenshot({
        path: filePath as any,  // Type assertion to bypass path template literal requirement
        fullPage: true,
    });
}

export async function saveFileFromURL(url: string, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const request = url.startsWith("https") ? https : http;

        request
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    resolve();
                });

                file.on("error", (err) => {
                    fs.unlink(filepath, () => {}); // Delete the file on error
                    reject(err);
                });
            })
            .on("error", (err) => {
                reject(err);
            });
    });
}

export async function deleteFile(filepath: string): Promise<void> {
    if (!filepath) return;
    return new Promise((resolve, reject) => {
        fs.unlink(filepath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function postToWebhook(url: string, postData: any): Promise<WebhookResponse> {
    try {
        console.log("Posting to webhook:", url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        // Check if the request was successful
        if (response.ok) {
            const contentType = response.headers.get("content-type");
            let data: any;

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            console.log(`✓ Webhook post successful`);
            console.log("Webhook response:", { status: response.status, data });
            return {
                success: true,
            };
        } else {
            const errorText = await response.text();
            console.error('✗ Webhook post failed');
            console.error('Status:', response.status);
            console.error('Error response:', errorText);
            return {
                success: false,
                error: errorText
            };
        }

    } catch (error: any) {
        console.error('✗ Webhook post error - fetch failed');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return {
            success: false,
            error: error.message,
            errorType: error.name
        };
    }
}

export async function updateResult(res: any, filename: string): Promise<void> {
    const jsonFilePath = path.join(process.cwd(),"../", "../",  filename);
    try {
        console.log(jsonFilePath);

        // Read existing data or create empty structure
        let existingData: UpdateResultData = { entries: [] };
        try {
            const fileContent = await fs.promises.readFile(jsonFilePath, 'utf8');
            existingData = JSON.parse(fileContent);

            // Ensure entries array exists
            if (!existingData.entries) {
                existingData.entries = [];
            }
        } catch (error) {
            // File doesn't exist or is invalid, use default structure
            console.log(`Creating new ${filename} file`);
        }

        // Append the new result
        existingData.entries.push(res);

        // Write back to file
        await fs.promises.writeFile(jsonFilePath, JSON.stringify(existingData, null, 2), 'utf8');
        console.log(`Result appended to ${filename} successfully`);

    } catch (error) {
        console.error(`Failed to update ${filename}:`, error);
    }
}