/**
 * Mobile Page Adapter - Puppeteer-like API for mobile automation
 * Provides familiar Puppeteer Page interface using Appium/WebDriverIO underneath
 */

import { Browser, Element } from 'webdriverio';
import LDPlayerController from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';

export interface ClickOptions {
  delay?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
}

export interface TypeOptions {
  delay?: number;
}

export interface ScreenshotOptions {
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
}

export interface WaitForOptions {
  timeout?: number;
  visible?: boolean;
  hidden?: boolean;
}

export interface GotoOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * MobilePage - giống Puppeteer Page nhưng cho mobile
 * Usage:
 * ```typescript
 * const page = new MobilePage(driver, controller, port);
 * await page.goto('com.twitter.android'); // Launch app
 * await page.click('~username_field'); // Click element
 * await page.type('~username_field', 'my_username');
 * await page.screenshot({ path: 'screenshot.png' });
 * ```
 */
export class MobilePage {
  private driver: Browser;
  private controller: LDPlayerController;
  private port: number;
  private _screenshotCounter: number = 0;

  // Custom properties for mobile-specific features
  public __isMobile: boolean = true;
  public __ldplayer: LDPlayerController;

  constructor(driver: Browser, controller: LDPlayerController, port: number) {
    this.driver = driver;
    this.controller = controller;
    this.port = port;
    this.__ldplayer = controller;
  }

  /**
   * Navigate to URL or launch app
   * @param target - URL for browser, package name for app (e.g., 'com.twitter.android')
   */
  async goto(target: string, options?: GotoOptions): Promise<void> {
    const timeout = options?.timeout || 30000;

    try {
      // Check if it's a package name (app) or URL
      if (target.includes('.') && !target.includes('/') && !target.includes(':')) {
        // Looks like a package name
        logger.info(`[MobilePage] Launching app: ${target}`);
        await this.driver.execute('mobile: activateApp', { appId: target });
        await this.waitForTimeout(2000); // Wait for app to launch
      } else {
        // It's a URL - navigate in browser
        logger.info(`[MobilePage] Navigating to URL: ${target}`);
        await this.driver.url(target);
      }
    } catch (error) {
      logger.error(`[MobilePage] Failed to goto ${target}:`, error);
      throw error;
    }
  }

  /**
   * Find element by selector
   * Supports:
   * - Android UiAutomator: 'android=...'
   * - Accessibility ID: '~...'
   * - XPath: '//...'
   * - Text: 'text=...'
   */
  async $(selector: string): Promise<Element | null> {
    try {
      const element = await this.driver.$(this.normalizeSelector(selector));
      const exists = await element.isExisting();
      return exists ? element : null;
    } catch (error) {
      logger.debug(`[MobilePage] Element not found: ${selector}`);
      return null;
    }
  }

  /**
   * Find multiple elements
   */
  async $$(selector: string): Promise<Element[]> {
    try {
      const elements = await this.driver.$$(this.normalizeSelector(selector));
      return Array.from(elements);
    } catch (error) {
      logger.debug(`[MobilePage] Elements not found: ${selector}`);
      return [];
    }
  }

  /**
   * Click on element (by selector or coordinates)
   */
  async click(selectorOrX: string | number, y?: number, options?: ClickOptions): Promise<void> {
    const delay = options?.delay || 0;
    const clickCount = options?.clickCount || 1;

    if (typeof selectorOrX === 'string') {
      // Click by selector
      const element = await this.$(selectorOrX);
      if (!element) {
        throw new Error(`Element not found: ${selectorOrX}`);
      }

      for (let i = 0; i < clickCount; i++) {
        await element.click();
        if (delay > 0 && i < clickCount - 1) {
          await this.waitForTimeout(delay);
        }
      }

      logger.debug(`[MobilePage] Clicked element: ${selectorOrX}`);
    } else if (typeof selectorOrX === 'number' && typeof y === 'number') {
      // Click by coordinates
      for (let i = 0; i < clickCount; i++) {
        await this.controller.tap(this.port, selectorOrX, y);
        if (delay > 0 && i < clickCount - 1) {
          await this.waitForTimeout(delay);
        }
      }

      logger.debug(`[MobilePage] Clicked at (${selectorOrX}, ${y})`);
    } else {
      throw new Error('Invalid click parameters');
    }
  }

  /**
   * Type text into element
   */
  async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
    const element = await this.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Clear first
    await element.clearValue();

    if (options?.delay && options.delay > 0) {
      // Type character by character with delay
      for (const char of text) {
        await element.addValue(char);
        await this.waitForTimeout(options.delay);
      }
    } else {
      // Type all at once
      await element.setValue(text);
    }

    logger.debug(`[MobilePage] Typed text into ${selector}`);
  }

  /**
   * Wait for element to appear
   */
  async waitForSelector(selector: string, options?: WaitForOptions): Promise<Element | null> {
    const timeout = options?.timeout || 30000;
    const visible = options?.visible !== false;

    try {
      const element = await this.driver.$(this.normalizeSelector(selector));

      if (options?.hidden) {
        await element.waitForExist({ timeout, reverse: true });
        return null;
      } else {
        await element.waitForExist({ timeout });

        if (visible) {
          await element.waitForDisplayed({ timeout });
        }

        return element;
      }
    } catch (error) {
      logger.error(`[MobilePage] waitForSelector timeout: ${selector}`);
      throw error;
    }
  }

  /**
   * Wait for timeout (sleep)
   */
  async waitForTimeout(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Take screenshot
   */
  async screenshot(options?: ScreenshotOptions): Promise<string> {
    try {
      const screenshot = await this.driver.takeScreenshot();

      if (options?.path) {
        // Save to file
        const fs = await import('fs/promises');
        const buffer = Buffer.from(screenshot, 'base64');
        await fs.writeFile(options.path, buffer);
        logger.info(`[MobilePage] Screenshot saved to ${options.path}`);
      }

      return screenshot;
    } catch (error) {
      logger.error('[MobilePage] Failed to take screenshot:', error);
      throw error;
    }
  }

  /**
   * Get element text
   */
  async textContent(selector: string): Promise<string | null> {
    const element = await this.$(selector);
    if (!element) return null;

    return await element.getText();
  }

  /**
   * Check if element exists
   */
  async isVisible(selector: string): Promise<boolean> {
    const element = await this.$(selector);
    if (!element) return false;

    try {
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Tap at coordinates (mobile-specific)
   */
  async tap(x: number, y: number): Promise<void> {
    await this.controller.tap(this.port, x, y);
    logger.debug(`[MobilePage] Tapped at (${x}, ${y})`);
  }

  /**
   * Swipe gesture (mobile-specific)
   */
  async swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    await this.controller.swipe(this.port, x1, y1, x2, y2, duration || 500);
    logger.debug(`[MobilePage] Swiped from (${x1}, ${y1}) to (${x2}, ${y2})`);
  }

  /**
   * Scroll down
   */
  async scrollDown(distance?: number): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    const centerX = width / 2;
    const dist = distance || height * 0.6;
    const startY = height * 0.8;
    const endY = startY - dist;

    await this.swipe(centerX, startY, centerX, endY, 500);
  }

  /**
   * Scroll up
   */
  async scrollUp(distance?: number): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    const centerX = width / 2;
    const dist = distance || height * 0.6;
    const startY = height * 0.2;
    const endY = startY + dist;

    await this.swipe(centerX, startY, centerX, endY, 500);
  }

  /**
   * Press Android key
   */
  async pressKey(keyName: string): Promise<void> {
    await this.controller.pressKey(this.port, keyName);
    logger.debug(`[MobilePage] Pressed key: ${keyName}`);
  }

  /**
   * Go back (Android back button)
   */
  async goBack(): Promise<void> {
    await this.pressKey('KEYCODE_BACK');
  }

  /**
   * Go home
   */
  async goHome(): Promise<void> {
    await this.pressKey('KEYCODE_HOME');
  }

  /**
   * Launch app by package name
   */
  async launchApp(packageName: string): Promise<void> {
    await this.driver.execute('mobile: activateApp', { appId: packageName });
    await this.waitForTimeout(2000);
    logger.info(`[MobilePage] Launched app: ${packageName}`);
  }

  /**
   * Close/terminate app
   */
  async closeApp(packageName: string): Promise<void> {
    await this.driver.execute('mobile: terminateApp', { appId: packageName });
    logger.info(`[MobilePage] Closed app: ${packageName}`);
  }

  /**
   * Evaluate JavaScript (limited on mobile)
   * This is more for compatibility - mobile has limited JS execution
   */
  async evaluate<T>(pageFunction: (() => T) | string, ...args: any[]): Promise<T> {
    logger.warn('[MobilePage] evaluate() has limited support on mobile');

    if (typeof pageFunction === 'function') {
      const funcString = pageFunction.toString();
      return await this.driver.execute(funcString, ...args) as T;
    } else {
      return await this.driver.execute(pageFunction, ...args) as T;
    }
  }

  /**
   * Get page title (app name or current activity)
   */
  async title(): Promise<string> {
    try {
      // Try to get current activity
      const activity = await this.driver.getCurrentActivity();
      return activity || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get URL (current app package)
   */
  async url(): Promise<string> {
    try {
      const pkg = await this.driver.getCurrentPackage();
      return pkg || '';
    } catch {
      return '';
    }
  }

  /**
   * Reload app (restart)
   */
  async reload(): Promise<void> {
    const pkg = await this.url();
    if (pkg) {
      await this.closeApp(pkg);
      await this.waitForTimeout(1000);
      await this.launchApp(pkg);
    }
  }

  /**
   * Focus element (tap on it)
   */
  async focus(selector: string): Promise<void> {
    await this.click(selector);
  }

  /**
   * Get element attribute
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const element = await this.$(selector);
    if (!element) return null;

    return await element.getAttribute(attribute);
  }

  /**
   * Helper: Normalize selector for WebDriverIO
   * Converts Puppeteer-style selectors to mobile selectors
   */
  private normalizeSelector(selector: string): string {
    // Already a valid mobile selector
    if (selector.startsWith('~') ||
        selector.startsWith('android=') ||
        selector.startsWith('//') ||
        selector.startsWith('text=')) {
      return selector;
    }

    // Convert CSS-like selectors to XPath (basic conversion)
    if (selector.startsWith('#')) {
      // ID selector
      const id = selector.substring(1);
      return `android=new UiSelector().resourceId("${id}")`;
    }

    if (selector.startsWith('.')) {
      // Class selector
      const className = selector.substring(1);
      return `android=new UiSelector().className("${className}")`;
    }

    // Default: treat as accessibility ID
    return `~${selector}`;
  }

  /**
   * Close the page/session
   */
  async close(): Promise<void> {
    // Mobile doesn't really "close" pages like browser
    // This is more for compatibility
    logger.info('[MobilePage] close() called - this is a no-op on mobile');
  }
}

export default MobilePage;
