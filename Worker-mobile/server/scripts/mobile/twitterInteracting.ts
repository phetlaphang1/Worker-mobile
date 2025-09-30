/**
 * Mobile Twitter Interacting Script
 * Converted from browser to LDPlayer mobile app
 *
 * Original: Browser script for liking, retweeting, commenting
 * Mobile: Uses tap/swipe on Twitter app
 */

import TwitterMobileAutomation, { TwitterActionResult } from '../../automation/TwitterMobileAutomation.js';
import { MobileProfile } from '../../services/ProfileManager.js';
import { logger } from '../../utils/logger.js';

interface TaskConfig {
  profileId?: string;
  profile: MobileProfile;
  taskPath: string;
  taskId: string;
  type: string;
  task: {
    request: {
      action: 'like' | 'retweet' | 'comment' | 'follow' | 'engagement_batch';
      tweetUrl?: string;
      username?: string;
      searchQuery?: string;
      comment?: string;
      likeCount?: number;
      retweetCount?: number;
      followCount?: number;
    };
  };
}

interface InteractionResult {
  success: boolean;
  action: string;
  actionsPerformed: number;
  details: any;
}

/**
 * Main execution function for mobile Twitter interactions
 * @param twitter - TwitterMobileAutomation instance
 * @param config - Task configuration
 */
export async function execute(
  twitter: TwitterMobileAutomation,
  config: TaskConfig
): Promise<InteractionResult> {
  const req = config.task.request;

  try {
    logger.info(`[Mobile Twitter Interacting] Action: ${req.action}`);

    let result: InteractionResult;

    switch (req.action) {
      case 'like':
        result = await performLikes(twitter, req);
        break;

      case 'retweet':
        result = await performRetweets(twitter, req);
        break;

      case 'comment':
        result = await performComments(twitter, req);
        break;

      case 'follow':
        result = await performFollows(twitter, req);
        break;

      case 'engagement_batch':
        result = await performEngagementBatch(twitter, req);
        break;

      default:
        throw new Error(`Unknown action: ${req.action}`);
    }

    logger.info(`[Mobile Twitter Interacting] Completed: ${result.actionsPerformed} actions`);
    return result;
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Execution failed:', error);
    return {
      success: false,
      action: req.action,
      actionsPerformed: 0,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Perform likes
 */
async function performLikes(
  twitter: TwitterMobileAutomation,
  req: any
): Promise<InteractionResult> {
  try {
    // Navigate to search or URL
    if (req.searchQuery) {
      await twitter.search(req.searchQuery);
    } else if (req.tweetUrl) {
      // Extract tweet ID and navigate
      const tweetId = extractTweetId(req.tweetUrl);
      if (tweetId) {
        await twitter.search(tweetId);
      }
    }

    // Like tweets
    const likeCount = req.likeCount || 5;
    const result = await twitter.likeRandomTweets(likeCount);

    return {
      success: result.success,
      action: 'like',
      actionsPerformed: result.data?.liked || 0,
      details: result
    };
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Like failed:', error);
    throw error;
  }
}

/**
 * Perform retweets
 */
async function performRetweets(
  twitter: TwitterMobileAutomation,
  req: any
): Promise<InteractionResult> {
  try {
    // Navigate to content
    if (req.searchQuery) {
      await twitter.search(req.searchQuery);
    }

    // Retweet (simplified - retweet visible tweet)
    const result = await twitter.retweet(400, req.comment);

    return {
      success: result.success,
      action: 'retweet',
      actionsPerformed: result.success ? 1 : 0,
      details: result
    };
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Retweet failed:', error);
    throw error;
  }
}

/**
 * Perform comments
 */
async function performComments(
  twitter: TwitterMobileAutomation,
  req: any
): Promise<InteractionResult> {
  try {
    if (!req.comment) {
      throw new Error('Comment text is required');
    }

    // Navigate to tweet
    if (req.searchQuery) {
      await twitter.search(req.searchQuery);
    } else if (req.tweetUrl) {
      const tweetId = extractTweetId(req.tweetUrl);
      if (tweetId) {
        await twitter.search(tweetId);
      }
    }

    // Post comment
    const result = await twitter.commentOnTweet(400, req.comment);

    return {
      success: result.success,
      action: 'comment',
      actionsPerformed: result.success ? 1 : 0,
      details: result
    };
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Comment failed:', error);
    throw error;
  }
}

/**
 * Perform follows
 */
async function performFollows(
  twitter: TwitterMobileAutomation,
  req: any
): Promise<InteractionResult> {
  try {
    if (!req.username) {
      throw new Error('Username is required for follow action');
    }

    const result = await twitter.followUser(req.username);

    return {
      success: result.success,
      action: 'follow',
      actionsPerformed: result.success ? 1 : 0,
      details: result
    };
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Follow failed:', error);
    throw error;
  }
}

/**
 * Perform engagement batch (likes + retweets + comments)
 */
async function performEngagementBatch(
  twitter: TwitterMobileAutomation,
  req: any
): Promise<InteractionResult> {
  try {
    let totalActions = 0;
    const details: any = {};

    // Navigate to home or search
    if (req.searchQuery) {
      await twitter.search(req.searchQuery);
      details.searchQuery = req.searchQuery;
    } else {
      await twitter.goToHome();
    }

    // Perform likes
    if (req.likeCount && req.likeCount > 0) {
      const likeResult = await twitter.likeRandomTweets(req.likeCount);
      totalActions += likeResult.data?.liked || 0;
      details.likes = likeResult.data?.liked || 0;
    }

    // Scroll timeline
    await twitter.scrollTimeline(2, 2000);

    // Perform retweets (if count specified)
    if (req.retweetCount && req.retweetCount > 0) {
      for (let i = 0; i < req.retweetCount; i++) {
        const tweetY = 400 + i * 200;
        const retweetResult = await twitter.retweet(tweetY);
        if (retweetResult.success) {
          totalActions++;
        }
        await delay(2000, 4000);
      }
      details.retweets = req.retweetCount;
    }

    // Follow users (if count specified)
    if (req.followCount && req.followCount > 0) {
      // Would need list of usernames
      // For now, skip or implement random follow logic
      details.follows = 0;
    }

    logger.info(`[Mobile Twitter Interacting] Batch completed: ${totalActions} actions`);

    return {
      success: true,
      action: 'engagement_batch',
      actionsPerformed: totalActions,
      details
    };
  } catch (error) {
    logger.error('[Mobile Twitter Interacting] Engagement batch failed:', error);
    throw error;
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