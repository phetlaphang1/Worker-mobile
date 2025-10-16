import LDPlayerController from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';

export interface AutomationConfig {
  instanceName: string;
  port: number;
  humanLike?: boolean;
  minDelay?: number;
  maxDelay?: number;
  
}

export class MobileAutomation {
  private controller: LDPlayerController;

  private config: AutomationConfig;

  constructor(controller: LDPlayerController, config: AutomationConfig) {
    this.controller = controller;
    this.config = {
      humanLike: true,
      minDelay: 500,
      maxDelay: 2000,
      ...config
    };
  }

  // Random delay for human-like behavior
  private async randomDelay(min?: number, max?: number): Promise<void> {
    if (!this.config.humanLike) return;

    const minDelay = min || this.config.minDelay || 500;
    const maxDelay = max || this.config.maxDelay || 2000;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Generate random offset for tap positions
  private getRandomOffset(maxOffset: number = 5): { x: number; y: number } {
    if (!this.config.humanLike) return { x: 0, y: 0 };

    return {
      x: Math.floor(Math.random() * maxOffset * 2 - maxOffset),
      y: Math.floor(Math.random() * maxOffset * 2 - maxOffset)
    };
  }

  // Human-like tap with random offset and delay
  async tap(x: number, y: number, options?: {
    offsetRadius?: number;
    beforeDelay?: [number, number];
    afterDelay?: [number, number];
  }): Promise<void> {
    try {
      // Delay before tap
      if (options?.beforeDelay) {
        await this.randomDelay(options.beforeDelay[0], options.beforeDelay[1]);
      } else {
        await this.randomDelay();
      }

      // Add random offset for human-like behavior
      const offset = this.getRandomOffset(options?.offsetRadius || 3);
      const finalX = x + offset.x;
      const finalY = y + offset.y;

      await this.controller.tap(this.config.port, finalX, finalY);

      // Delay after tap
      if (options?.afterDelay) {
        await this.randomDelay(options.afterDelay[0], options.afterDelay[1]);
      }

      logger.debug(`Tapped at (${finalX}, ${finalY}) with human-like behavior`);
    } catch (error) {
      logger.error(`Failed to perform human-like tap:`, error);
      throw error;
    }
  }

  // Human-like swipe with curved path
  async swipe(x1: number, y1: number, x2: number, y2: number, options?: {
    duration?: number;
    curve?: boolean;
    steps?: number;
  }): Promise<void> {
    try {
      await this.randomDelay();

      const duration = options?.duration || 500 + Math.random() * 500;

      if (options?.curve && this.config.humanLike) {
        // Create curved swipe path
        const steps = options.steps || 3;
        const points: Array<[number, number]> = [[x1, y1]];

        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20;
          const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20;
          points.push([x, y]);
        }
        points.push([x2, y2]);

        // Execute curved swipe
        for (let i = 0; i < points.length - 1; i++) {
          await this.controller.swipe(
            this.config.port,
            points[i][0], points[i][1],
            points[i + 1][0], points[i + 1][1],
            duration / (points.length - 1)
          );
        }
      } else {
        // Simple swipe with slight randomization
        const offset1 = this.getRandomOffset(5);
        const offset2 = this.getRandomOffset(5);

        await this.controller.swipe(
          this.config.port,
          x1 + offset1.x, y1 + offset1.y,
          x2 + offset2.x, y2 + offset2.y,
          duration
        );
      }

      await this.randomDelay(300, 800);
      logger.debug(`Performed human-like swipe from (${x1}, ${y1}) to (${x2}, ${y2})`);
    } catch (error) {
      logger.error(`Failed to perform human-like swipe:`, error);
      throw error;
    }
  }

  // Type text with human-like speed variations
  async typeText(text: string, options?: {
    field?: { x: number; y: number };
    clearFirst?: boolean;
    minCharDelay?: number;
    maxCharDelay?: number;
  }): Promise<void> {
    try {
      // Click on field if provided
      if (options?.field) {
        await this.tap(options.field.x, options.field.y);
        await this.randomDelay(500, 1000);
      }

      // Clear field if requested
      if (options?.clearFirst) {
        await this.controller.pressKey(this.config.port, 'KEYCODE_MOVE_END');
        await this.randomDelay(100, 200);

        // Select all and delete
        await this.controller.pressKey(this.config.port, 'KEYCODE_CTRL_A');
        await this.randomDelay(100, 200);
        await this.controller.pressKey(this.config.port, 'KEYCODE_DEL');
        await this.randomDelay(200, 400);
      }

      if (this.config.humanLike) {
        // Type character by character with variable speed
        for (const char of text) {
          await this.controller.inputText(this.config.port, char);

          // Random delay between characters
          const minDelay = options?.minCharDelay || 50;
          const maxDelay = options?.maxCharDelay || 200;
          await this.randomDelay(minDelay, maxDelay);

          // Occasionally pause (like thinking)
          if (Math.random() < 0.1) {
            await this.randomDelay(300, 800);
          }
        }
      } else {
        // Type all at once
        await this.controller.inputText(this.config.port, text);
      }

      logger.debug(`Typed text with human-like behavior: ${text.substring(0, 20)}...`);
    } catch (error) {
      logger.error(`Failed to type text:`, error);
      throw error;
    }
  }

  // Scroll with human-like behavior
  async scroll(direction: 'up' | 'down', options?: {
    distance?: number;
    duration?: number;
    randomize?: boolean;
  }): Promise<void> {
    try {
      await this.randomDelay();

      const screenCenterX = 360; // Assuming 720p screen
      const screenCenterY = 640;

      const distance = options?.distance || 400;
      const duration = options?.duration || 500;

      let startY: number, endY: number;

      if (direction === 'down') {
        startY = screenCenterY + distance / 2;
        endY = screenCenterY - distance / 2;
      } else {
        startY = screenCenterY - distance / 2;
        endY = screenCenterY + distance / 2;
      }

      // Add randomization
      if (options?.randomize || this.config.humanLike) {
        startY += Math.random() * 50 - 25;
        endY += Math.random() * 50 - 25;
      }

      await this.swipe(screenCenterX, startY, screenCenterX, endY, {
        duration,
        curve: this.config.humanLike
      });

      logger.debug(`Scrolled ${direction} with human-like behavior`);
    } catch (error) {
      logger.error(`Failed to scroll:`, error);
      throw error;
    }
  }

  // Tap on element by text using ADB UI dump
  async tapByText(text: string, options?: {
    partialMatch?: boolean;
    caseSensitive?: boolean;
    timeout?: number;
    scrollToFind?: boolean;
  }): Promise<boolean> {
    try {
      const partialMatch = options?.partialMatch ?? true;
      const caseSensitive = options?.caseSensitive ?? false;
      const timeout = options?.timeout || 10000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        // Dump UI hierarchy
        const uiDumpResult = await this.controller.executeAdbCommand(
          this.config.port,
          'shell uiautomator dump /dev/tty'
        );

        if (!uiDumpResult) {
          logger.warn('Failed to get UI dump, retrying...');
          await this.randomDelay(500, 1000);
          continue;
        }

        // Parse XML to find element with matching text
        const searchText = caseSensitive ? text : text.toLowerCase();
        const regex = new RegExp(
          `text="${partialMatch ? '.*' : ''}${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${partialMatch ? '.*' : ''}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
          caseSensitive ? 'g' : 'gi'
        );

        const match = regex.exec(uiDumpResult);

        if (match) {
          // Extract bounds
          const left = parseInt(match[1]);
          const top = parseInt(match[2]);
          const right = parseInt(match[3]);
          const bottom = parseInt(match[4]);

          // Calculate center position
          const centerX = Math.floor((left + right) / 2);
          const centerY = Math.floor((top + bottom) / 2);

          logger.info(`Found element with text "${text}" at (${centerX}, ${centerY})`);

          // Tap on the element
          await this.tap(centerX, centerY);
          return true;
        }

        // If scroll enabled, try scrolling to find element
        if (options?.scrollToFind) {
          await this.scroll('down', { distance: 300 });
          await this.randomDelay(500, 1000);
        } else {
          logger.warn(`Element with text "${text}" not found in current view`);
          await this.randomDelay(500, 1000);
        }
      }

      logger.error(`Element with text "${text}" not found within timeout`);
      return false;
    } catch (error) {
      logger.error(`Failed to tap by text:`, error);
      throw error;
    }
  }

  // Find and click element (deprecated - use tapByText instead)
  async findAndClick(text: string, options?: {
    timeout?: number;
    scrollToFind?: boolean;
  }): Promise<boolean> {
    return this.tapByText(text, options);
  }

  // Wait for element to appear (requires OCR or UI automation)
  async waitForElement(identifier: string, timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // In real implementation, check if element exists
      // Using OCR or UI automation framework

      await this.randomDelay(500, 1000);
    }

    logger.warn(`Element ${identifier} not found within timeout`);
    return false;
  }

  // Common app interactions
  async doubleTap(x: number, y: number): Promise<void> {
    await this.tap(x, y);
    await this.randomDelay(50, 150);
    await this.tap(x, y);
  }

  async longPress(x: number, y: number, duration: number = 1000): Promise<void> {
    await this.controller.swipe(this.config.port, x, y, x, y, duration);
  }

  async pinch(zoom: 'in' | 'out', centerX: number = 360, centerY: number = 640): Promise<void> {
    // Pinch gesture simulation
    const offset = zoom === 'in' ? 100 : -100;

    // This would require multi-touch support
    // Simplified version using swipes
    if (zoom === 'in') {
      // Pinch in
      await this.swipe(centerX - 100, centerY, centerX, centerY, { duration: 300 });
    } else {
      // Pinch out
      await this.swipe(centerX, centerY, centerX + 100, centerY, { duration: 300 });
    }
  }

  // Navigation
  async goBack(): Promise<void> {
    await this.controller.pressKey(this.config.port, 'KEYCODE_BACK');
    await this.randomDelay();
  }

  async goHome(): Promise<void> {
    await this.controller.pressKey(this.config.port, 'KEYCODE_HOME');
    await this.randomDelay();
  }

  async openRecentApps(): Promise<void> {
    await this.controller.pressKey(this.config.port, 'KEYCODE_APP_SWITCH');
    await this.randomDelay();
  }
}

export default MobileAutomation;