/**
 * Mobile Twitter Reading Script
 * Converted from browser to LDPlayer mobile app
 *
 * Original: Browser script that reads Twitter timeline/profiles
 * Mobile: Uses Twitter app scrolling and viewing
 */

import TwitterMobileAutomation, { TwitterActionResult } from '../../automation/TwitterMobileAutomation.js';
import { MobileProfile } from '../../services/ProfileManager.js';
import { logger } from '../../utils/logger.js';

interface TaskConfig {
  profile: MobileProfile;
  taskPath: string;
  taskId: string;
  type: string;
  task: {
    request: {
      action: 'read_timeline' | 'read_profile' | 'read_search';
      username?: string;
      searchQuery?: string;
      scrollCount?: number;
      readTime?: number;
    };
  };
}

interface ReadingResult {
  success: boolean;
  action: string;
  tweetsViewed?: number;
  timeSpent?: number;
  data?: any;
}

/**
 * Main execution function for mobile Twitter reading
 * @param twitter - TwitterMobileAutomation instance
 * @param config - Task configuration
 */
export async function execute(
  twitter: TwitterMobileAutomation,
  config: TaskConfig
): Promise<ReadingResult> {
  const req = config.task.request;
  const startTime = Date.now();

  try {
    logger.info(`[Mobile Twitter Reading] Action: ${req.action}`);

    let result: ReadingResult = {
      success: false,
      action: req.action
    };

    switch (req.action) {
      case 'read_timeline':
        result = await readTimeline(twitter, req.scrollCount || 5, req.readTime || 3000);
        break;

      case 'read_profile':
        if (!req.username) {
          throw new Error('Username required for read_profile action');
        }
        result = await readProfile(twitter, req.username, req.scrollCount || 3);
        break;

      case 'read_search':
        if (!req.searchQuery) {
          throw new Error('Search query required for read_search action');
        }
        result = await readSearchResults(
          twitter,
          req.searchQuery,
          req.scrollCount || 3,
          req.readTime || 3000
        );
        break;

      default:
        throw new Error(`Unknown action: ${req.action}`);
    }

    result.timeSpent = Date.now() - startTime;
    logger.info(`[Mobile Twitter Reading] Completed in ${result.timeSpent}ms`);

    return result;
  } catch (error) {
    logger.error('[Mobile Twitter Reading] Execution failed:', error);
    return {
      success: false,
      action: req.action,
      timeSpent: Date.now() - startTime,
      data: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Read home timeline
 */
async function readTimeline(
  twitter: TwitterMobileAutomation,
  scrollCount: number,
  readTime: number
): Promise<ReadingResult> {
  try {
    // Navigate to home
    await twitter.goToHome();

    // Scroll and read tweets
    await twitter.scrollTimeline(scrollCount, readTime);

    logger.info(`[Mobile Twitter Reading] Read timeline: ${scrollCount} scrolls`);

    return {
      success: true,
      action: 'read_timeline',
      tweetsViewed: scrollCount * 3 // Estimate ~3 tweets per scroll
    };
  } catch (error) {
    logger.error('[Mobile Twitter Reading] Failed to read timeline:', error);
    throw error;
  }
}

/**
 * Read user profile
 */
async function readProfile(
  twitter: TwitterMobileAutomation,
  username: string,
  scrollCount: number
): Promise<ReadingResult> {
  try {
    // View profile
    const result = await twitter.viewProfile(username);

    if (!result.success) {
      throw new Error(`Failed to view profile: ${result.message}`);
    }

    logger.info(`[Mobile Twitter Reading] Read profile: @${username}`);

    return {
      success: true,
      action: 'read_profile',
      data: {
        username,
        scrollsPerformed: scrollCount
      }
    };
  } catch (error) {
    logger.error('[Mobile Twitter Reading] Failed to read profile:', error);
    throw error;
  }
}

/**
 * Read search results
 */
async function readSearchResults(
  twitter: TwitterMobileAutomation,
  searchQuery: string,
  scrollCount: number,
  readTime: number
): Promise<ReadingResult> {
  try {
    // Perform search
    const searchResult = await twitter.search(searchQuery);

    if (!searchResult.success) {
      throw new Error(`Search failed: ${searchResult.message}`);
    }

    // Scroll through results
    await twitter.scrollTimeline(scrollCount, readTime);

    logger.info(`[Mobile Twitter Reading] Read search: "${searchQuery}"`);

    return {
      success: true,
      action: 'read_search',
      tweetsViewed: scrollCount * 3,
      data: {
        searchQuery
      }
    };
  } catch (error) {
    logger.error('[Mobile Twitter Reading] Failed to read search results:', error);
    throw error;
  }
}

/**
 * Advanced: Read and analyze tweets (future enhancement)
 * Could add OCR or screenshot analysis to extract tweet content
 */
async function readAndAnalyzeTweets(
  twitter: TwitterMobileAutomation,
  scrollCount: number
): Promise<any[]> {
  const tweets: any[] = [];

  // For each scroll, take screenshot and analyze
  for (let i = 0; i < scrollCount; i++) {
    // Take screenshot
    // const screenshot = await controller.screenshot(port, `tweet_${i}.png`);

    // Could use OCR to extract text from screenshot
    // const text = await ocrService.extractText(screenshot);

    // tweets.push({ text, timestamp: Date.now() });

    await twitter.scrollTimeline(1, 2000);
  }

  return tweets;
}

export default { execute };