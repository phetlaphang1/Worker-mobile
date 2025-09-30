/**
 * Ví dụ: Scripts Twitter đã chuyển từ Browser sang LDPlayer Mobile
 *
 * File này show cách convert các browser scripts sang mobile
 */

import TwitterBrowserToMobileAdapter from '../TwitterBrowserToMobileAdapter.js';
import LDPlayerController from '../../core/LDPlayerController.js';
import { logger } from '../../utils/logger.js';

export interface TwitterTask {
  type: 'like' | 'follow' | 'retweet' | 'comment' | 'post' | 'search';
  data: Record<string, any>;
}

/**
 * Ví dụ 1: Like tweets
 * Trước: Dùng Puppeteer click elements
 * Sau: Dùng tap coordinates
 */
export async function likeTwitterPosts(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  count: number = 5
): Promise<void> {
  logger.info(`[Migration Example] Like ${count} tweets using mobile app`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    // Launch Twitter app (thay vì page.goto)
    await adapter.goto('https://twitter.com/home');

    // Login (nếu chưa login)
    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Like random tweets while scrolling
    const result = await adapter.likeRandomTweets(count);
    logger.info(`[Migration Example] Result:`, result);
  } catch (error) {
    logger.error('[Migration Example] Like failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 2: Follow multiple users
 * Trước: Navigate to profile pages và click follow button
 * Sau: Search user và tap follow
 */
export async function followMultipleUsers(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  usernames: string[]
): Promise<void> {
  logger.info(`[Migration Example] Follow ${usernames.length} users using mobile app`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    await adapter.goto('https://twitter.com');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Follow each user
    for (const username of usernames) {
      const result = await adapter.followUser(username);
      logger.info(`[Migration Example] Follow @${username}:`, result);

      // Delay between follows (anti-bot)
      await delay(3000, 5000);
    }
  } catch (error) {
    logger.error('[Migration Example] Follow failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 3: Post tweet with text
 * Trước: Type vào textarea và click post button
 * Sau: Tap compose và type text
 */
export async function postSingleTweet(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  tweetText: string,
  media?: string[]
): Promise<void> {
  logger.info(`[Migration Example] Post tweet using mobile app`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    await adapter.goto('https://twitter.com');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Post tweet
    const result = await adapter.postTweet(tweetText, { media });
    logger.info(`[Migration Example] Tweet posted:`, result);
  } catch (error) {
    logger.error('[Migration Example] Post failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 4: Search and interact
 * Trước: Type vào search box và parse results
 * Sau: Tap search, type query, scroll results
 */
export async function searchAndInteract(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  query: string,
  actions: { like?: number; retweet?: number }
): Promise<void> {
  logger.info(`[Migration Example] Search "${query}" and interact using mobile app`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    await adapter.goto('https://twitter.com/search');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Search
    await adapter.search(query);

    // Like tweets
    if (actions.like) {
      await adapter.likeRandomTweets(actions.like);
    }

    // Scroll timeline
    await adapter.scroll(3);
  } catch (error) {
    logger.error('[Migration Example] Search failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 5: Batch tasks (nhiều tasks trong 1 session)
 * Trước: Mở nhiều tabs hoặc sequential navigation
 * Sau: Sequential actions trong 1 app session
 */
export async function executeBatchTasks(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  tasks: TwitterTask[]
): Promise<void> {
  logger.info(`[Migration Example] Execute ${tasks.length} tasks in batch`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    // Init: Launch app and login once
    await adapter.goto('https://twitter.com');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Execute each task
    for (const task of tasks) {
      logger.info(`[Migration Example] Executing task:`, task.type);

      switch (task.type) {
        case 'like':
          await adapter.likeRandomTweets(task.data.count || 5);
          break;

        case 'follow':
          await adapter.followUser(task.data.username);
          break;

        case 'retweet':
          await adapter.search(task.data.searchQuery || '');
          await adapter.retweet(400, task.data.comment);
          break;

        case 'comment':
          await adapter.search(task.data.searchQuery || '');
          await adapter.comment(400, task.data.text);
          break;

        case 'post':
          await adapter.postTweet(task.data.text, {
            media: task.data.media
          });
          break;

        case 'search':
          await adapter.search(task.data.query);
          await adapter.scroll(task.data.scrollTimes || 3);
          break;

        default:
          logger.warn(`[Migration Example] Unknown task type: ${task.type}`);
      }

      // Delay between tasks (anti-bot)
      await delay(2000, 4000);
    }

    logger.info(`[Migration Example] All tasks completed`);
  } catch (error) {
    logger.error('[Migration Example] Batch execution failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 6: Scheduled automation
 * Trước: Cron job trigger Puppeteer script
 * Sau: Cron job trigger mobile automation
 */
export async function scheduledTwitterEngagement(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  schedule: {
    likesPerHour: number;
    followsPerDay: number;
    postsPerDay: number;
  }
): Promise<void> {
  logger.info(`[Migration Example] Scheduled engagement (mobile app)`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    await adapter.goto('https://twitter.com');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Like some tweets
    const likesThisRun = Math.floor(schedule.likesPerHour / 4); // Run 4 times/hour
    await adapter.likeRandomTweets(likesThisRun);

    // Random activity to appear human
    await adapter.scroll(2, 3000);
    await adapter.goto('https://twitter.com/notifications');
    await adapter.scroll(1, 2000);

    logger.info(`[Migration Example] Scheduled engagement completed`);
  } catch (error) {
    logger.error('[Migration Example] Scheduled engagement failed:', error);
    throw error;
  }
}

/**
 * Ví dụ 7: Profile warmup (new account behavior simulation)
 * Trước: Browser script để warm up mới account
 * Sau: Mobile app để warm up (realistic hơn)
 */
export async function warmupNewProfile(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  config: any,
  days: number = 7
): Promise<void> {
  logger.info(`[Migration Example] Warmup new profile - Day ${days}`);

  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  try {
    await adapter.goto('https://twitter.com');

    if (!(await adapter.isLoggedIn())) {
      await adapter.loginTwitter(config);
    }

    // Day 1-2: Just browse, no actions
    if (days <= 2) {
      await adapter.scroll(5, 4000);
      await adapter.viewProfile('elonmusk'); // View popular profiles
      return;
    }

    // Day 3-4: Light engagement
    if (days <= 4) {
      await adapter.likeRandomTweets(2);
      await adapter.scroll(3, 3000);
      return;
    }

    // Day 5+: Normal usage
    await adapter.likeRandomTweets(5);
    await adapter.followUser('twitter'); // Follow official accounts
    await adapter.scroll(5, 3000);

    // Maybe post if day 7+
    if (days >= 7) {
      await adapter.postTweet('Hello Twitter! 👋');
    }

    logger.info(`[Migration Example] Warmup completed for day ${days}`);
  } catch (error) {
    logger.error('[Migration Example] Warmup failed:', error);
    throw error;
  }
}

// Helper function
async function delay(min: number, max: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

export default {
  likeTwitterPosts,
  followMultipleUsers,
  postSingleTweet,
  searchAndInteract,
  executeBatchTasks,
  scheduledTwitterEngagement,
  warmupNewProfile
};