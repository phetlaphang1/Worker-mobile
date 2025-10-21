/**
 * SessionPersistence - Save and restore cookies/sessions to avoid re-solving captchas
 *
 * Cloudflare saves challenge pass status in cookies.
 * By saving cookies after first pass, we can reuse them to avoid future challenges.
 *
 * Features:
 * - Save cookies from successful sessions
 * - Restore cookies before new sessions
 * - Automatic cleanup of expired cookies
 * - Per-profile cookie storage
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface SavedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number; // Unix timestamp
  httpOnly?: boolean;
  secure?: boolean;
}

export interface SessionData {
  profileId: number;
  app: string; // e.g., 'twitter', 'instagram'
  cookies: SavedCookie[];
  savedAt: Date;
  expiresAt?: Date;
}

export class SessionPersistence {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(process.cwd(), 'data', 'sessions');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      logger.info(`SessionPersistence initialized: ${this.sessionsDir}`);
    } catch (error) {
      logger.error('Failed to initialize SessionPersistence:', error);
      throw error;
    }
  }

  /**
   * Save session cookies for a profile
   */
  async saveSession(
    profileId: number,
    app: string,
    cookies: SavedCookie[]
  ): Promise<void> {
    try {
      const sessionData: SessionData = {
        profileId,
        app,
        cookies,
        savedAt: new Date(),
        expiresAt: this.calculateExpiry(cookies)
      };

      const filename = this.getSessionFilename(profileId, app);
      const filepath = path.join(this.sessionsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf-8');
      logger.info(`Session saved for profile ${profileId} (${app}): ${cookies.length} cookies`);

    } catch (error) {
      logger.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Load session cookies for a profile
   */
  async loadSession(
    profileId: number,
    app: string
  ): Promise<SavedCookie[] | null> {
    try {
      const filename = this.getSessionFilename(profileId, app);
      const filepath = path.join(this.sessionsDir, filename);

      // Check if file exists
      try {
        await fs.access(filepath);
      } catch {
        logger.debug(`No saved session for profile ${profileId} (${app})`);
        return null;
      }

      // Read session
      const content = await fs.readFile(filepath, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);

      // Check if expired
      if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
        logger.info(`Session expired for profile ${profileId} (${app}), deleting...`);
        await fs.unlink(filepath);
        return null;
      }

      logger.info(`Session loaded for profile ${profileId} (${app}): ${sessionData.cookies.length} cookies`);
      return sessionData.cookies;

    } catch (error) {
      logger.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Delete session for a profile
   */
  async deleteSession(profileId: number, app: string): Promise<void> {
    try {
      const filename = this.getSessionFilename(profileId, app);
      const filepath = path.join(this.sessionsDir, filename);

      await fs.unlink(filepath);
      logger.info(`Session deleted for profile ${profileId} (${app})`);
    } catch (error) {
      // Ignore if file doesn't exist
      logger.debug(`No session to delete for profile ${profileId} (${app})`);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(this.sessionsDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const sessionData: SessionData = JSON.parse(content);

        if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
          await fs.unlink(filepath);
          cleaned++;
          logger.debug(`Cleaned expired session: ${file}`);
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} expired sessions`);
      }

      return cleaned;

    } catch (error) {
      logger.error('Failed to cleanup sessions:', error);
      return 0;
    }
  }

  /**
   * Get all sessions for a profile
   */
  async getProfileSessions(profileId: number): Promise<SessionData[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: SessionData[] = [];

      for (const file of files) {
        if (!file.startsWith(`profile_${profileId}_`)) continue;

        const filepath = path.join(this.sessionsDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const sessionData: SessionData = JSON.parse(content);

        sessions.push(sessionData);
      }

      return sessions;

    } catch (error) {
      logger.error('Failed to get profile sessions:', error);
      return [];
    }
  }

  /**
   * Extract cookies from ADB (for Twitter app)
   */
  async extractCookiesFromApp(
    helpers: any,
    packageName: string
  ): Promise<SavedCookie[]> {
    try {
      logger.info(`Extracting cookies from ${packageName}...`);

      // Common cookie locations for Android apps
      const cookiePaths = [
        `/data/data/${packageName}/app_webview/Cookies`,
        `/data/data/${packageName}/app_webview/Default/Cookies`,
        `/data/data/${packageName}/databases/webview.db`,
        `/data/data/${packageName}/shared_prefs/WebViewChromiumPrefs.xml`
      ];

      const cookies: SavedCookie[] = [];

      // Try to pull cookie files
      for (const cookiePath of cookiePaths) {
        try {
          // Check if file exists
          const checkCmd = `shell "[ -f ${cookiePath} ] && echo 'exists' || echo 'not found'"`;
          const exists = await helpers.adb(checkCmd);

          if (exists.includes('exists')) {
            logger.info(`Found cookies at: ${cookiePath}`);

            // Pull file (requires root or debuggable app)
            // For production, we'd parse the file to extract cookies
            // For now, we'll use a simpler approach with WebView cookies

            // Note: This is simplified - real implementation would:
            // 1. Pull cookie database
            // 2. Parse SQLite database
            // 3. Extract cookie values
            // 4. Convert to SavedCookie format

            logger.warn('Cookie extraction from app requires root access or debuggable app');
          }
        } catch (error) {
          logger.debug(`Could not access ${cookiePath}`);
        }
      }

      return cookies;

    } catch (error) {
      logger.error('Failed to extract cookies:', error);
      return [];
    }
  }

  /**
   * Inject cookies into app (restore session)
   */
  async injectCookiesIntoApp(
    helpers: any,
    packageName: string,
    cookies: SavedCookie[]
  ): Promise<void> {
    try {
      logger.info(`Injecting ${cookies.length} cookies into ${packageName}...`);

      // Note: Direct cookie injection on Android is complex
      // Requires root access or debuggable app
      // Alternative: Use WebView JavaScript injection or app-specific methods

      logger.warn('Cookie injection requires root access or app-specific implementation');

      // For Twitter, alternative approach:
      // 1. Use Twitter API with auth tokens (saved separately)
      // 2. Use account login credentials (already have in profile.metadata.accounts)
      // 3. Re-login automatically using saved credentials

    } catch (error) {
      logger.error('Failed to inject cookies:', error);
      throw error;
    }
  }

  // Private helpers

  private getSessionFilename(profileId: number, app: string): string {
    return `profile_${profileId}_${app}.json`;
  }

  private calculateExpiry(cookies: SavedCookie[]): Date | undefined {
    // Find earliest expiry date
    const expiries = cookies
      .filter(c => c.expires)
      .map(c => c.expires!)
      .sort((a, b) => a - b);

    if (expiries.length === 0) {
      // Default: 7 days from now
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return new Date(Date.now() + sevenDays);
    }

    return new Date(expiries[0] * 1000);
  }
}

export default SessionPersistence;
