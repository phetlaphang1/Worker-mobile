/**
 * Appium Runner - Execute scripts on mobile devices using Appium
 * Similar to Puppeteer scriptRunner but for mobile automation
 */

import { remote, Browser } from 'webdriverio';
import LDPlayerController from '../core/LDPlayerController.js';
import { MobilePage } from './MobilePageAdapter.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppiumRunnerConfig {
  instanceName: string;
  port: number;
  appiumPort?: number;
  capabilities?: Record<string, any>;
  profilePath?: string;
  config?: any; // Custom config từ profile
}

export interface AppiumExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  logs: string[];
  screenshots?: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * AppiumRunner - Main class to run automation scripts on mobile
 *
 * Usage:
 * ```typescript
 * const runner = new AppiumRunner(controller, config);
 * const result = await runner.runScript(scriptCode);
 * ```
 */
export class AppiumRunner {
  private controller: LDPlayerController;
  private config: AppiumRunnerConfig;
  private driver: Browser | null = null;
  private page: MobilePage | null = null;
  private logs: string[] = [];
  private screenshots: string[] = [];

  constructor(controller: LDPlayerController, config: AppiumRunnerConfig) {
    this.controller = controller;
    this.config = {
      appiumPort: 4723,
      ...config
    };
  }

  /**
   * Initialize Appium driver and create MobilePage
   */
  private async initializeDriver(): Promise<void> {
    const capabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': this.config.instanceName,
      'appium:udid': `127.0.0.1:${this.config.port}`,
      'appium:systemPort': 8200 + parseInt(this.config.port.toString().slice(-2)),
      'appium:adbExecTimeout': 30000,
      'appium:newCommandTimeout': 300,
      'appium:noReset': true,
      'appium:fullReset': false,
      // Merge custom capabilities
      ...this.config.capabilities,
    };

    this.log(`Connecting to Appium server at http://127.0.0.1:${this.config.appiumPort}`);
    this.log(`Device: ${this.config.instanceName} (127.0.0.1:${this.config.port})`);

    try {
      this.driver = await remote({
        protocol: 'http',
        hostname: '127.0.0.1',
        port: this.config.appiumPort!,
        path: '/',
        capabilities,
        logLevel: 'error', // Reduce noise
      });

      this.log('Appium driver initialized successfully');

      // Create MobilePage wrapper
      this.page = new MobilePage(this.driver, this.controller, this.config.port);
      this.log('MobilePage adapter created');

    } catch (error: any) {
      this.log(`Failed to initialize Appium driver: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run user script with Puppeteer-like API
   * Script has access to: page, driver, config, helpers
   */
  async runScript(scriptCode: string): Promise<AppiumExecutionResult> {
    const startTime = new Date();
    this.logs = [];
    this.screenshots = [];

    try {
      this.log('Starting script execution...');

      // Initialize driver if not already initialized
      if (!this.driver || !this.page) {
        await this.initializeDriver();
      }

      // Helper functions for scripts
      const helpers = {
        // Sleep/delay
        sleep: async (ms: number) => {
          this.log(`Sleeping for ${ms}ms`);
          await new Promise(resolve => setTimeout(resolve, ms));
        },

        // Random delay (human-like)
        randomDelay: async (min: number = 1000, max: number = 3000) => {
          const delay = Math.floor(Math.random() * (max - min) + min);
          await helpers.sleep(delay);
        },

        // Take screenshot with auto-naming
        screenshot: async (name?: string) => {
          if (!this.page) throw new Error('Page not initialized');

          const filename = name || `screenshot_${Date.now()}.png`;
          const filepath = this.config.profilePath
            ? path.join(this.config.profilePath, 'outputs', filename)
            : filename;

          await this.page.screenshot({ path: filepath });
          this.screenshots.push(filepath);
          this.log(`Screenshot saved: ${filepath}`);

          return filepath;
        },

        // Log message
        log: (message: string) => {
          this.log(`[User Script] ${message}`);
        },

        // Find element by text (OCR alternative)
        findByText: async (text: string, timeout: number = 10000) => {
          this.log(`Finding element by text: "${text}"`);
          const selector = `android=new UiSelector().textContains("${text}")`;
          return await this.page!.waitForSelector(selector, { timeout });
        },

        // Tap by coordinates with offset
        tapWithOffset: async (x: number, y: number, offsetX: number = 0, offsetY: number = 0) => {
          const finalX = x + offsetX;
          const finalY = y + offsetY;
          await this.page!.tap(finalX, finalY);
          this.log(`Tapped at (${finalX}, ${finalY})`);
        },

        // Swipe gestures
        swipeLeft: async () => {
          const { width, height } = await this.driver!.getWindowSize();
          await this.page!.swipe(width * 0.8, height / 2, width * 0.2, height / 2, 300);
        },

        swipeRight: async () => {
          const { width, height } = await this.driver!.getWindowSize();
          await this.page!.swipe(width * 0.2, height / 2, width * 0.8, height / 2, 300);
        },

        // Install APK
        installAPK: async (apkPath: string) => {
          this.log(`Installing APK: ${apkPath}`);
          await this.controller.installAPK(this.config.port, apkPath);
        },

        // Launch app
        launchApp: async (packageName: string) => {
          this.log(`Launching app: ${packageName}`);
          await this.page!.launchApp(packageName);
        },

        // Get current package
        getCurrentApp: async () => {
          return await this.page!.url();
        },

        // Access to LDPlayer controller for advanced operations
        ldplayer: this.controller,
      };

      // Create script execution context
      // User script có access tới: page, driver, config, helpers
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

      const scriptFunction = new AsyncFunction(
        'page',
        'driver',
        'config',
        'helpers',
        '$',
        '$$',
        'log',
        `
        try {
          ${scriptCode}
        } catch (error) {
          log('Script error: ' + error.message);
          throw error;
        }
        `
      );

      this.log('Executing user script...');

      const result = await scriptFunction(
        this.page,
        this.driver,
        this.config.config || {},
        helpers,
        // Shortcuts
        (selector: string) => this.page!.$(selector),
        (selector: string) => this.page!.$$(selector),
        (msg: string) => this.log(`[Script] ${msg}`)
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.log(`Script execution completed in ${duration}ms`);

      return {
        success: true,
        data: result,
        logs: this.logs,
        screenshots: this.screenshots,
        startTime,
        endTime,
        duration
      };

    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.log(`Script execution failed: ${error.message}`);

      // Try to take error screenshot
      try {
        if (this.page) {
          const errorScreenshot = this.config.profilePath
            ? path.join(this.config.profilePath, 'outputs', `error_${Date.now()}.png`)
            : `error_${Date.now()}.png`;

          await this.page.screenshot({ path: errorScreenshot });
          this.screenshots.push(errorScreenshot);
        }
      } catch (screenshotError) {
        this.log('Failed to take error screenshot');
      }

      return {
        success: false,
        error: error.message,
        logs: this.logs,
        screenshots: this.screenshots,
        startTime,
        endTime,
        duration
      };
    }
  }

  /**
   * Run script from file
   */
  async runScriptFile(scriptPath: string): Promise<AppiumExecutionResult> {
    const fs = await import('fs/promises');
    const scriptCode = await fs.readFile(scriptPath, 'utf-8');
    return await this.runScript(scriptCode);
  }

  /**
   * Close driver and cleanup
   */
  async close(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.deleteSession();
        this.log('Appium driver session closed');
      } catch (error) {
        this.log('Error closing driver session');
      }
      this.driver = null;
      this.page = null;
    }
  }

  /**
   * Get current page (for external access)
   */
  getPage(): MobilePage | null {
    return this.page;
  }

  /**
   * Get current driver (for external access)
   */
  getDriver(): Browser | null {
    return this.driver;
  }

  /**
   * Get logs
   */
  getLogs(): string[] {
    return this.logs;
  }

  /**
   * Internal logging
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    logger.info(`[AppiumRunner] ${message}`);
  }
}

export default AppiumRunner;
