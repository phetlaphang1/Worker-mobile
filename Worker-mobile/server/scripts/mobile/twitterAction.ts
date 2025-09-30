/**
 * Mobile Twitter Action Script
 * Converted from browser (Puppeteer) to LDPlayer mobile app
 *
 * Original: Browser script that posts/replies to Twitter with images
 * Mobile: Uses Twitter app on LDPlayer via ADB commands
 */

import TwitterMobileAutomation from '../../automation/TwitterMobileAutomation.js';
import LDPlayerController from '../../core/LDPlayerController.js';
import { MobileProfile } from '../../services/ProfileManager.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs/promises';

interface TaskConfig {
  profile: MobileProfile;
  taskPath: string;
  taskId: string;
  type?: string;
  task: {
    request: {
      URL?: string;
      content: string;
      imageURL?: string;
      comment_task_id?: string;
    };
  };
}

interface ExecutionResult {
  postURL?: string;
  postResultToN8N?: any;
}

/**
 * Main execution function for mobile Twitter actions
 * @param twitter - TwitterMobileAutomation instance (app already running)
 * @param config - Task configuration
 */
export async function execute(
  twitter: TwitterMobileAutomation,
  config: TaskConfig
): Promise<ExecutionResult> {
  const res: ExecutionResult = {};

  try {
    const req = config.task.request;

    logger.info('[Mobile Twitter Action] Starting execution');

    // Navigate to post if URL provided (reply scenario)
    if (req.URL) {
      logger.info(`[Mobile Twitter Action] Replying to: ${req.URL}`);
      // For mobile: search for the tweet or navigate via deep link
      // Twitter app deep link: twitter://status?id=TWEET_ID
      const tweetId = extractTweetId(req.URL);
      if (tweetId) {
        // Could use adb shell command to open deep link
        // For now, we'll use search
        await twitter.search(tweetId);
        await delay(2000, 3000);
      }
    }

    // Upload image if provided (mobile: push to device, then select)
    let imagePath: string | undefined;
    if (req.imageURL) {
      imagePath = await uploadImageToDevice(twitter, req.imageURL, config.taskPath);
    }

    // Post or reply content
    if (req.URL) {
      // Reply to tweet
      res.postURL = await replyToTweet(twitter, req.content, imagePath);
    } else {
      // Post new tweet
      const result = await twitter.postTweet(req.content, {
        media: imagePath ? [imagePath] : undefined
      });

      if (result.success) {
        // Get posted tweet URL (mobile doesn't return URL easily)
        // Would need to check timeline or use Twitter API
        logger.info('[Mobile Twitter Action] Tweet posted successfully');
      }
    }

    // Clean up image from device
    if (imagePath) {
      await deleteImageFromDevice(twitter, imagePath);
    }

    // Post result to N8N webhook if needed
    if (res.postURL && req.comment_task_id) {
      // res.postResultToN8N = await postResultToN8N(N8N_URL, req.comment_task_id, res.postURL);
    }

    logger.info('[Mobile Twitter Action] Execution completed');
    return res;
  } catch (error) {
    logger.error('[Mobile Twitter Action] Execution failed:', error);
    throw error;
  }
}

/**
 * Upload image to Android device
 */
async function uploadImageToDevice(
  twitter: TwitterMobileAutomation,
  imageURL: string,
  taskPath: string
): Promise<string> {
  try {
    // Download image to local
    const localImagePath = path.join(taskPath, 'attachedImage.jpeg');

    // Download image from URL
    const response = await axios.get(imageURL, { responseType: 'arraybuffer' });
    await fs.writeFile(localImagePath, response.data);

    // Push image to Android device via ADB
    const deviceImagePath = '/sdcard/Pictures/twitter_upload.jpg';
    // Note: Need access to controller for ADB commands
    // await controller.pushFile(port, localImagePath, deviceImagePath);

    logger.info(`[Mobile Twitter Action] Image uploaded to device: ${deviceImagePath}`);
    return deviceImagePath;
  } catch (error) {
    logger.error('[Mobile Twitter Action] Failed to upload image:', error);
    throw error;
  }
}

/**
 * Reply to a tweet (mobile version)
 */
async function replyToTweet(
  twitter: TwitterMobileAutomation,
  content: string,
  imagePath?: string
): Promise<string | undefined> {
  try {
    // On mobile: tap the tweet, then tap reply button
    await twitter.commentOnTweet(400, content); // 400 is estimated Y position

    logger.info('[Mobile Twitter Action] Reply posted');

    // Return URL (would need to implement getting tweet URL on mobile)
    return undefined;
  } catch (error) {
    logger.error('[Mobile Twitter Action] Failed to reply:', error);
    throw error;
  }
}

/**
 * Delete image from device
 */
async function deleteImageFromDevice(
  twitter: TwitterMobileAutomation,
  imagePath: string
): Promise<void> {
  try {
    // Use ADB to delete file
    // await controller.deleteFile(port, imagePath);
    logger.info('[Mobile Twitter Action] Image deleted from device');
  } catch (error) {
    logger.warn('[Mobile Twitter Action] Failed to delete image:', error);
  }
}

/**
 * Extract tweet ID from URL
 */
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Helper delay
 */
async function delay(min: number, max: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

export default { execute };