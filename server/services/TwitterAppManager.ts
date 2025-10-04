/**
 * Twitter App Manager - Keep Twitter app running for fast script execution
 *
 * Thay vì:
 * - Bật Twitter app
 * - Chạy script
 * - Tắt app
 * - Lặp lại...
 *
 * Giờ:
 * - Bật Twitter app 1 lần
 * - Chạy nhiều scripts liên tục
 * - Tự động keep-alive
 */

import LDPlayerController from '../core/LDPlayerController.js';
import TwitterMobileAutomation from '../automation/TwitterMobileAutomation.js';
import { logger } from '../utils/logger.js';
import { MobileProfile } from './ProfileManager.js';

interface TwitterAppSession {
  profile: MobileProfile;
  twitter: TwitterMobileAutomation;
  lastUsed: Date;
  isLoggedIn: boolean;
  isAppRunning: boolean;
}

export class TwitterAppManager {
  private controller: LDPlayerController;
  private sessions: Map<string, TwitterAppSession> = new Map();
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.startKeepAlive();
  }

  /**
   * Get Twitter automation instance (reuse existing or create new)
   * Scripts chạy nhanh vì app đã sẵn sàng
   */
  async getTwitterSession(profile: MobileProfile): Promise<TwitterMobileAutomation> {
    const sessionKey = profile.id;

    // Check if session exists and is still valid
    if (this.sessions.has(sessionKey)) {
      const session = this.sessions.get(sessionKey)!;

      // Update last used
      session.lastUsed = new Date();

      // Check if app is still running
      if (session.isAppRunning) {
        logger.info(`[TwitterAppManager] Reusing existing Twitter session for ${profile.name}`);
        return session.twitter;
      } else {
        logger.info(`[TwitterAppManager] App stopped, restarting for ${profile.name}`);
        await this.ensureAppRunning(session);
        return session.twitter;
      }
    }

    // Create new session
    logger.info(`[TwitterAppManager] Creating new Twitter session for ${profile.name}`);
    return await this.createSession(profile);
  }

  /**
   * Create new Twitter app session
   */
  private async createSession(profile: MobileProfile): Promise<TwitterMobileAutomation> {
    const twitter = new TwitterMobileAutomation(
      this.controller,
      profile.instanceName,
      profile.port
    );

    // Launch Twitter app
    await twitter.launchTwitter();

    // Auto-login if credentials available
    let isLoggedIn = false;
    if (profile.apps.twitter?.username) {
      try {
        const twitterApp = profile.apps.twitter as any;
        const loginResult = await twitter.login({
          username: twitterApp.username,
          password: twitterApp.password || '',
          email: twitterApp.email
        });
        isLoggedIn = loginResult.success;
      } catch (error) {
        logger.warn(`[TwitterAppManager] Auto-login failed for ${profile.name}:`, error);
      }
    }

    // Store session
    const session: TwitterAppSession = {
      profile,
      twitter,
      lastUsed: new Date(),
      isLoggedIn,
      isAppRunning: true
    };

    this.sessions.set(profile.id, session);
    logger.info(`[TwitterAppManager] Twitter session created for ${profile.name}`);

    return twitter;
  }

  /**
   * Ensure Twitter app is running
   */
  private async ensureAppRunning(session: TwitterAppSession): Promise<void> {
    try {
      // Check if app is running by tapping and seeing if it responds
      await this.controller.launchApp(session.profile.port, 'com.twitter.android');
      await this.delay(2000, 3000);
      session.isAppRunning = true;
      logger.info(`[TwitterAppManager] Twitter app restarted for ${session.profile.name}`);
    } catch (error) {
      logger.error(`[TwitterAppManager] Failed to restart Twitter app:`, error);
      session.isAppRunning = false;
      throw error;
    }
  }

  /**
   * Execute script with auto-managed Twitter session
   *
   * Usage:
   * await twitterAppManager.executeWithSession(profile, async (twitter) => {
   *   await twitter.likeTweet(400);
   *   await twitter.postTweet("Hello!");
   * });
   */
  async executeWithSession<T>(
    profile: MobileProfile,
    scriptFn: (twitter: TwitterMobileAutomation) => Promise<T>
  ): Promise<T> {
    const twitter = await this.getTwitterSession(profile);

    try {
      const result = await scriptFn(twitter);
      logger.info(`[TwitterAppManager] Script executed successfully for ${profile.name}`);
      return result;
    } catch (error) {
      logger.error(`[TwitterAppManager] Script execution failed:`, error);

      // Mark session as potentially broken
      const session = this.sessions.get(profile.id);
      if (session) {
        session.isAppRunning = false;
      }

      throw error;
    }
  }

  /**
   * Execute multiple scripts in batch (super fast)
   */
  async executeBatch<T>(
    profile: MobileProfile,
    scripts: Array<(twitter: TwitterMobileAutomation) => Promise<T>>
  ): Promise<T[]> {
    const twitter = await this.getTwitterSession(profile);
    const results: T[] = [];

    for (const script of scripts) {
      try {
        const result = await script(twitter);
        results.push(result);

        // Small delay between scripts
        await this.delay(1000, 2000);
      } catch (error) {
        logger.error(`[TwitterAppManager] Batch script failed:`, error);
        throw error;
      }
    }

    logger.info(`[TwitterAppManager] Batch of ${scripts.length} scripts completed`);
    return results;
  }

  /**
   * Keep-alive mechanism
   * Periodically check sessions and clean up stale ones
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      const now = Date.now();

      for (const [profileId, session] of this.sessions.entries()) {
        const timeSinceLastUse = now - session.lastUsed.getTime();

        // Clean up sessions older than timeout
        if (timeSinceLastUse > this.sessionTimeout) {
          logger.info(`[TwitterAppManager] Cleaning up stale session for ${session.profile.name}`);
          this.sessions.delete(profileId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Stop keep-alive and clean up all sessions
   */
  async shutdown(): Promise<void> {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    logger.info('[TwitterAppManager] Shutting down all Twitter sessions');
    this.sessions.clear();
  }

  /**
   * Force close Twitter app for a profile
   */
  async closeTwitterApp(profileId: string): Promise<void> {
    const session = this.sessions.get(profileId);
    if (!session) {
      return;
    }

    try {
      await this.controller.closeApp(session.profile.port, 'com.twitter.android');
      session.isAppRunning = false;
      this.sessions.delete(profileId);
      logger.info(`[TwitterAppManager] Twitter app closed for ${session.profile.name}`);
    } catch (error) {
      logger.error('[TwitterAppManager] Failed to close Twitter app:', error);
    }
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session info
   */
  getSessionInfo(profileId: string): TwitterAppSession | undefined {
    return this.sessions.get(profileId);
  }

  /**
   * Check if profile has active session
   */
  hasActiveSession(profileId: string): boolean {
    const session = this.sessions.get(profileId);
    return session?.isAppRunning ?? false;
  }

  private async delay(min: number, max: number): Promise<void> {
    const delayMs = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

export default TwitterAppManager;