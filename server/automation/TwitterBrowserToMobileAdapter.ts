/**
 * Twitter Browser to Mobile App Adapter
 * Converts browser-based Twitter automation to LDPlayer mobile app automation
 */

import TwitterMobileAutomation, { TwitterAccount, TwitterActionResult } from './TwitterMobileAutomation.js';
import LDPlayerController from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';

export interface BrowserTwitterConfig {
  profile: {
    customField?: {
      twitter_account?: {
        username: string;
        password: string;
        email?: string;
        '2fa'?: string;
        cookies?: any;
      }
    }
  }
}

/**
 * Adapter class that provides browser-like API for LDPlayer mobile app
 * Usage: Replace browser automation with this adapter
 *
 * Before (Browser):
 * ```
 * await page.goto('https://twitter.com');
 * await loginTwitter(page, config);
 * ```
 *
 * After (LDPlayer):
 * ```
 * const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);
 * await adapter.loginTwitter(config);
 * ```
 */
export class TwitterBrowserToMobileAdapter {
  private twitter: TwitterMobileAutomation;
  private controller: LDPlayerController;
  private port: number;

  constructor(controller: LDPlayerController, instanceName: string, port: number) {
    this.controller = controller;
    this.port = port;
    this.twitter = new TwitterMobileAutomation(controller, instanceName, port);
  }

  /**
   * Replace: await page.goto('https://twitter.com')
   * With: await adapter.goto('https://twitter.com')
   */
  async goto(url: string): Promise<void> {
    logger.info(`[Adapter] Navigating to ${url} -> Launching Twitter app`);

    if (url.includes('twitter.com') || url.includes('x.com')) {
      await this.twitter.launchTwitter();

      // Parse URL to navigate to specific section
      if (url.includes('/search')) {
        await this.twitter.goToSearch();
      } else if (url.includes('/home')) {
        await this.twitter.goToHome();
      }
      // Add more URL patterns as needed
    } else {
      logger.warn(`[Adapter] Non-Twitter URL: ${url} - using browser would be needed`);
    }
  }

  /**
   * Replace: await loginTwitter(page, config)
   * With: await adapter.loginTwitter(config)
   */
  async loginTwitter(config: BrowserTwitterConfig): Promise<boolean> {
    logger.info('[Adapter] Converting browser login to mobile app login');

    const customField = config.profile?.customField;
    const twitterAccount = customField?.twitter_account;

    if (!twitterAccount?.username || !twitterAccount?.password) {
      logger.error('[Adapter] Missing Twitter credentials');
      return false;
    }

    const account: TwitterAccount = {
      username: twitterAccount.username,
      password: twitterAccount.password,
      email: twitterAccount.email,
      // Note: 2FA handling may differ on mobile app
    };

    const result = await this.twitter.login(account);
    return result.success;
  }

  /**
   * Replace: await isLoggedIn(page)
   * With: await adapter.isLoggedIn()
   */
  async isLoggedIn(): Promise<boolean> {
    return this.twitter.isAuthenticated();
  }

  /**
   * Replace: await click(page, xpath)
   * With: await adapter.click(elementDescription)
   */
  async click(elementDescription: string): Promise<void> {
    logger.info(`[Adapter] Converting browser click to mobile tap: ${elementDescription}`);

    // Map common Twitter elements to mobile tap coordinates
    if (elementDescription.includes('Home')) {
      await this.twitter.goToHome();
    } else if (elementDescription.includes('Search')) {
      await this.twitter.goToSearch();
    } else if (elementDescription.includes('Next') || elementDescription.includes('Log in')) {
      // These are handled by the login flow
      logger.debug('[Adapter] Click handled by mobile login flow');
    } else {
      logger.warn(`[Adapter] Unknown element: ${elementDescription}`);
    }
  }

  /**
   * Replace: await type(page, xpath, text)
   * With: await adapter.type(text)
   */
  async type(text: string): Promise<void> {
    logger.info(`[Adapter] Converting browser type to mobile text input`);
    // Text input is handled contextually in mobile automation
    // This is mainly for compatibility
  }

  /**
   * Replace: Browser-based like action
   * With: await adapter.likeTweet(tweetPosition)
   */
  async likeTweet(tweetY: number = 400): Promise<TwitterActionResult> {
    logger.info('[Adapter] Converting browser like to mobile tap');
    return await this.twitter.likeTweet(tweetY);
  }

  /**
   * Replace: Browser-based retweet
   * With: await adapter.retweet(tweetPosition, comment)
   */
  async retweet(tweetY: number = 400, withComment?: string): Promise<TwitterActionResult> {
    logger.info('[Adapter] Converting browser retweet to mobile action');
    return await this.twitter.retweet(tweetY, withComment);
  }

  /**
   * Replace: Browser-based comment
   * With: await adapter.comment(tweetPosition, text)
   */
  async comment(tweetY: number = 400, text: string): Promise<TwitterActionResult> {
    logger.info('[Adapter] Converting browser comment to mobile action');
    return await this.twitter.commentOnTweet(tweetY, text);
  }

  /**
   * Replace: Browser-based tweet posting
   * With: await adapter.postTweet(text, options)
   */
  async postTweet(text: string, options?: {
    media?: string[];
    poll?: { options: string[]; duration: string };
  }): Promise<TwitterActionResult> {
    logger.info('[Adapter] Converting browser tweet post to mobile action');
    return await this.twitter.postTweet(text, options);
  }

  /**
   * Replace: Browser-based search
   * With: await adapter.search(query)
   */
  async search(query: string): Promise<TwitterActionResult> {
    logger.info(`[Adapter] Converting browser search to mobile: ${query}`);
    return await this.twitter.search(query);
  }

  /**
   * Replace: Browser-based follow
   * With: await adapter.followUser(username)
   */
  async followUser(username: string): Promise<TwitterActionResult> {
    logger.info(`[Adapter] Converting browser follow to mobile: @${username}`);
    return await this.twitter.followUser(username);
  }

  /**
   * Replace: Browser-based scrolling
   * With: await adapter.scroll(times)
   */
  async scroll(times: number = 1, readTime: number = 3000): Promise<void> {
    logger.info(`[Adapter] Converting browser scroll to mobile swipe`);
    await this.twitter.scrollTimeline(times, readTime);
  }

  /**
   * Replace: Browser-based like random tweets
   * With: await adapter.likeRandomTweets(count)
   */
  async likeRandomTweets(count: number = 5): Promise<TwitterActionResult> {
    logger.info(`[Adapter] Converting browser bulk like to mobile action`);
    return await this.twitter.likeRandomTweets(count);
  }

  /**
   * Replace: Browser-based view profile
   * With: await adapter.viewProfile(username)
   */
  async viewProfile(username: string): Promise<TwitterActionResult> {
    logger.info(`[Adapter] Converting browser profile view to mobile`);
    return await this.twitter.viewProfile(username);
  }

  /**
   * Replace: await page.close() or browser logout
   * With: await adapter.logout()
   */
  async logout(): Promise<void> {
    logger.info('[Adapter] Logging out from Twitter mobile app');
    await this.twitter.logout();
  }

  /**
   * Get the underlying mobile automation instance for advanced usage
   */
  getMobileAutomation(): TwitterMobileAutomation {
    return this.twitter;
  }
}

/**
 * Helper function to migrate browser-based task to mobile
 */
export async function migrateBrowserTaskToMobile(
  controller: LDPlayerController,
  instanceName: string,
  port: number,
  browserTask: (page: any) => Promise<void>
): Promise<void> {
  const adapter = new TwitterBrowserToMobileAdapter(controller, instanceName, port);

  // Create a mock "page" object that forwards calls to the adapter
  const mockPage = {
    goto: (url: string) => adapter.goto(url),
    close: () => adapter.logout(),
    // Add more mocked methods as needed
  };

  try {
    await browserTask(mockPage);
    logger.info('[Migration] Browser task successfully migrated to mobile');
  } catch (error) {
    logger.error('[Migration] Failed to migrate browser task:', error);
    throw error;
  }
}

export default TwitterBrowserToMobileAdapter;