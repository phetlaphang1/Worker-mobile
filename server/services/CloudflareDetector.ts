/**
 * CloudflareDetector - Detect Cloudflare challenges in mobile apps/webviews
 *
 * Supports:
 * - Cloudflare Turnstile (new captcha)
 * - JavaScript Challenge (5-second wait)
 * - I'm Under Attack Mode
 * - Bot Management blocks
 */

import { logger } from '../utils/logger.js';

export interface CloudflareChallenge {
  type: 'turnstile' | 'javascript' | 'captcha' | 'blocked' | 'none';
  detected: boolean;
  sitekey?: string;
  url?: string;
  screenshot?: string;
  timestamp: Date;
}

export class CloudflareDetector {
  // Common Cloudflare detection patterns
  private static readonly CLOUDFLARE_INDICATORS = {
    texts: [
      'Checking your browser',
      'Just a moment',
      'Please wait',
      'Verify you are human',
      'Cloudflare',
      'This process is automatic',
      'Ray ID',
      'Performance & security by Cloudflare'
    ],
    ids: [
      'cf-wrapper',
      'cf-error-details',
      'challenge-form',
      'turnstile-wrapper',
      'cf-challenge-running'
    ],
    classes: [
      'cf-browser-verification',
      'cf-challenge-running',
      'cf-spinner',
      'turnstile'
    ]
  };

  /**
   * Detect Cloudflare challenge from UI dump
   */
  static async detectFromUI(uiDump: string): Promise<CloudflareChallenge> {
    const challenge: CloudflareChallenge = {
      type: 'none',
      detected: false,
      timestamp: new Date()
    };

    try {
      // Check for Cloudflare text indicators
      for (const text of this.CLOUDFLARE_INDICATORS.texts) {
        if (uiDump.includes(text)) {
          challenge.detected = true;

          // Determine challenge type
          if (uiDump.includes('Verify you are human') || uiDump.includes('turnstile')) {
            challenge.type = 'turnstile';
          } else if (uiDump.includes('Checking your browser') || uiDump.includes('Just a moment')) {
            challenge.type = 'javascript';
          } else if (uiDump.includes('blocked') || uiDump.includes('Ray ID')) {
            challenge.type = 'blocked';
          } else {
            challenge.type = 'captcha';
          }

          logger.info(`Cloudflare ${challenge.type} challenge detected!`);
          break;
        }
      }

      // Extract sitekey if Turnstile
      if (challenge.type === 'turnstile') {
        const sitekeyMatch = uiDump.match(/sitekey["']\s*[:=]\s*["']([^"']+)["']/i);
        if (sitekeyMatch) {
          challenge.sitekey = sitekeyMatch[1];
          logger.info(`Turnstile sitekey: ${challenge.sitekey}`);
        }
      }

      return challenge;

    } catch (error) {
      logger.error('Error detecting Cloudflare challenge:', error);
      return challenge;
    }
  }

  /**
   * Detect challenge using helpers (in script)
   */
  static async detectInScript(helpers: any): Promise<CloudflareChallenge> {
    const challenge: CloudflareChallenge = {
      type: 'none',
      detected: false,
      timestamp: new Date()
    };

    try {
      // Dump UI
      const uiDump = await helpers.dumpUI();

      // Check for indicators
      for (const text of this.CLOUDFLARE_INDICATORS.texts) {
        const exists = await helpers.exists(text, 'text');
        if (exists) {
          challenge.detected = true;

          // Determine type
          if (text.includes('Verify') || text.includes('human')) {
            challenge.type = 'turnstile';
          } else if (text.includes('Checking') || text.includes('moment')) {
            challenge.type = 'javascript';
          } else {
            challenge.type = 'captcha';
          }

          logger.info(`[SCRIPT] Cloudflare ${challenge.type} detected: "${text}"`);
          break;
        }
      }

      // Take screenshot if detected
      if (challenge.detected) {
        try {
          const screenshotPath = await helpers.screenshot();
          challenge.screenshot = screenshotPath;
          logger.info(`Cloudflare challenge screenshot saved: ${screenshotPath}`);
        } catch (err) {
          logger.warn('Failed to take screenshot:', err);
        }
      }

      return challenge;

    } catch (error) {
      logger.error('[SCRIPT] Error detecting Cloudflare:', error);
      return challenge;
    }
  }

  /**
   * Wait for Cloudflare challenge to pass (JavaScript challenge auto-solves)
   */
  static async waitForChallengePass(
    helpers: any,
    options?: {
      timeout?: number;
      checkInterval?: number;
    }
  ): Promise<boolean> {
    const { timeout = 30000, checkInterval = 2000 } = options || {};

    const startTime = Date.now();
    logger.info(`Waiting for Cloudflare challenge to pass (timeout: ${timeout}ms)...`);

    while (Date.now() - startTime < timeout) {
      // Check if challenge is still present
      const challenge = await this.detectInScript(helpers);

      if (!challenge.detected) {
        logger.info(`✅ Cloudflare challenge passed!`);
        return true;
      }

      logger.info(`Challenge still present (${challenge.type}), waiting...`);
      await helpers.sleep(checkInterval);
    }

    logger.warn(`⏰ Timeout waiting for Cloudflare challenge to pass`);
    return false;
  }

  /**
   * Check if URL is likely protected by Cloudflare
   */
  static isCloudflareProtectedUrl(url: string): boolean {
    // Common patterns
    const patterns = [
      /cloudflare/i,
      /cf-ray/i,
      /challenge-platform/i
    ];

    return patterns.some(pattern => pattern.test(url));
  }
}

export default CloudflareDetector;
